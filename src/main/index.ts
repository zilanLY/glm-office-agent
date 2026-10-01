import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { GLMFreeServer } from './services/glm-free-server'
import { ToolRegistry } from './tools/tool-registry'

let mainWindow: BrowserWindow | null = null
let glmServer: GLMFreeServer | null = null
let toolRegistry: ToolRegistry | null = null
let trayInstance: Tray | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 开发环境加载 Vite Dev Server，生产环境加载构建产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function resolveIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png')
  }
  return path.join(app.getAppPath(), 'build/icon.png')
}

async function startGLMService() {
  try {
    glmServer = new GLMFreeServer()
    await glmServer.start()
    console.log('✅ GLM-Free-API started successfully')

    // 注册系统工具
    toolRegistry = new ToolRegistry()
    await toolRegistry.initialize(glmServer)

    // 发送状态到前端
    mainWindow?.webContents.send('glm-status-changed', {
      status: 'running',
      message: '服务已启动，可开始使用'
    })
  } catch (error) {
    console.error('❌ Failed to start GLM service:', error)
    mainWindow?.webContents.send('glm-status-changed', {
      status: 'error',
      message: `服务启动失败：${error}`
    })
  }
}

// IPC Handlers
ipcMain.handle('get-tool-list', async () => {
  return toolRegistry?.getAllTools() || []
})

ipcMain.handle('add-tool', async (event, tool: any) => {
  return toolRegistry?.addTool(tool)
})

ipcMain.handle('remove-tool', async (event, toolName: string) => {
  return toolRegistry?.removeTool(toolName)
})

ipcMain.handle('test-tool-call', async (event, args: any) => {
  return toolRegistry?.executeTool(args.name, args.args)
})

ipcMain.handle('get-request-stats', async () => {
  return glmServer?.getStats() || {}
})

app.whenReady().then(async () => {
  // 创建系统托盘
  const icon = nativeImage.createFromPath(resolveIconPath())
  trayInstance = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { label: '退出', click: () => app.exit() }
  ])
  trayInstance.setToolTip('GLM Office Agent')
  trayInstance.setContextMenu(contextMenu)

  // 窗口先开，GLM 服务异步启动（服务失败不应阻塞 UI）
  createWindow()
  startGLMService()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    glmServer?.stop()
    app.quit()
  }
})

app.on('before-quit', () => {
  glmServer?.stop()
  trayInstance?.destroy()
})
