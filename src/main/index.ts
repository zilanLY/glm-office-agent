import { app, BrowserWindow, ipcMain, tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { GLMFreeServer } from './services/glm-free-server'
import { ToolRegistry } from './tools/tool-registry'

let mainWindow: BrowserWindow | null = null
let glmServer: GLMFreeServer | null = null
let toolRegistry: ToolRegistry | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL('http://localhost:5173')

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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
  const icon = nativeImage.createFromPath(path.join(__dirname, '../build/icon.ico'))
  const trayInstance = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { label: '退出', click: () => app.exit() }
  ])
  trayInstance.setToolTip('GLM Office Agent')
  trayInstance.setContextMenu(contextMenu)

  // 启动 GLM 服务
  await startGLMService()

  // 创建主窗口
  createWindow()

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
})
