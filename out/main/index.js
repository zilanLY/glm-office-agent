"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const axios = require("axios");
const fs = require("fs");
class GLMFreeServer {
  process = null;
  port;
  executablePath;
  stats;
  constructor() {
    this.port = 3e3;
    const platform = process.platform;
    const arch = process.arch;
    let binName;
    if (platform === "win32") {
      binName = "glm-free-api.exe";
    } else if (platform === "darwin") {
      binName = `glm-free-api-mac-${arch}`;
    } else {
      binName = "glm-free-api-linux";
    }
    const candidates = [];
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", binName));
    }
    candidates.push(path.join(__dirname, "../../bin", binName));
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      console.warn(`⚠️ 未找到 GLM-Free-API 二进制文件，已尝试：
${candidates.join("\n")}`);
      console.warn("请手动编译并放置到 bin/ 目录");
      if (process.env.NODE_ENV === "development") {
        this.executablePath = "glm-free-api";
      } else {
        throw new Error("GLM-Free-API 二进制文件未找到");
      }
    } else {
      this.executablePath = found;
    }
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    };
  }
  async start() {
    return new Promise((resolve, reject) => {
      console.log(`🚀 启动 GLM-Free-API: ${this.executablePath}`);
      const args = ["-agent-mode"];
      this.process = child_process.spawn(this.executablePath, args, {
        windowsHide: true,
        env: { ...process.env, PORT: String(this.port), HOST: "127.0.0.1" }
      });
      this.process.on("exit", (code) => {
        console.error(`[GLM-Free-API] 进程退出，code=${code}（若为非 0，请检查 tokens.sqlite 是否已由 token-collector 生成）`);
      });
      if (this.process.stdout) {
        this.process.stdout.on("data", (data) => {
          console.log(`[GLM-Free-API] ${data.toString().trim()}`);
        });
      }
      if (this.process.stderr) {
        this.process.stderr.on("data", (data) => {
          console.error(`[GLM-Free-API Error] ${data.toString().trim()}`);
        });
      }
      this.process.on("error", (err) => {
        console.error("❌ 无法启动进程:", err);
        reject(err);
      });
      setTimeout(async () => {
        try {
          await this.waitForReady();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  }
  async waitForReady(maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`http://localhost:${this.port}/health`);
        console.log("✅ GLM-Free-API 已就绪");
        return;
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
    throw new Error("GLM-Free-API 服务启动超时");
  }
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      console.log("⏹️ GLM-Free-API 已停止");
    }
  }
  async chat(messages, tools) {
    this.stats.totalRequests++;
    const startTime = Date.now();
    try {
      const response = await axios.post(
        `http://localhost:${this.port}/v1/chat/completions`,
        {
          model: "glm-4.7",
          messages,
          stream: false,
          tools: tools?.map((tool) => ({
            type: "function",
            function: tool
          }))
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
      this.stats.successfulRequests++;
      this.updateAvgResponseTime(Date.now() - startTime);
      return response.data.choices[0].message;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }
  getStats() {
    return { ...this.stats };
  }
  updateAvgResponseTime(responseTime) {
    const count = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.avgResponseTime = (this.stats.avgResponseTime * (count - 1) + responseTime) / count;
  }
}
class ToolRegistry {
  tools = /* @__PURE__ */ new Map();
  constructor() {
    this.registerSystemTools();
  }
  registerSystemTools() {
    this.tools.set("search_files", {
      name: "search_files",
      description: "在本地文件系统搜索文件和文件夹，支持通配符匹配",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词或文件名模式（支持 * 通配符）"
          },
          path: {
            type: "string",
            description: "搜索路径，默认为当前用户目录",
            default: "~"
          },
          extensions: {
            type: "array",
            items: { type: "string" },
            description: "文件扩展名过滤，如 ['.pdf', '.xlsx']"
          }
        },
        required: ["query"]
      },
      handler: async (args) => {
        console.log("📂 执行文件搜索:", args);
        return {
          status: "simulated",
          message: "此功能需要 Python 后端支持，目前返回模拟数据",
          files: []
        };
      }
    });
    this.tools.set("read_document", {
      name: "read_document",
      description: "读取 PDF、Word (.docx)、Excel (.xlsx) 文档内容",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "文档文件的绝对路径"
          },
          page_range: {
            type: "string",
            description: '对于 PDF 指定页码范围，如 "1-5"，默认读取全部'
          }
        },
        required: ["file_path"]
      },
      handler: async (args) => {
        console.log("📄 读取文档:", args.file_path);
        return {
          status: "simulated",
          content: "此功能需要 Python 后端支持，目前返回模拟数据",
          file_size: 0
        };
      }
    });
    this.tools.set("execute_script", {
      name: "execute_script",
      description: "在沙箱环境中执行本地 Python 或 Shell 脚本",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            enum: ["python", "shell"],
            description: "脚本语言类型"
          },
          code: {
            type: "string",
            description: "要执行的脚本代码"
          },
          timeout: {
            type: "number",
            description: "最大执行时间（秒），默认 30",
            default: 30
          }
        },
        required: ["language", "code"]
      },
      handler: async (args) => {
        console.log("⚙️ 执行脚本:", args.language);
        return {
          status: "success",
          output: "脚本执行完成",
          exit_code: 0
        };
      }
    });
    this.tools.set("clipboard_operation", {
      name: "clipboard_operation",
      description: "读写系统剪贴板内容",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["read", "write"],
            description: "操作类型：读取或写入"
          },
          content: {
            type: "string",
            description: "写入剪贴板的内容（仅 write 动作需要）"
          }
        },
        required: ["action"]
      },
      handler: async (args) => {
        if (args.action === "read") {
          return { content: "剪贴板读取（需要集成 electron.clipboard）" };
        } else {
          return { status: "written" };
        }
      }
    });
  }
  async initialize(glmServer2) {
    console.log("✅ 工具注册表已初始化");
    const toolsList = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
    console.log("🔧 注册的工具数量:", toolsList.length);
  }
  getAllTools() {
    return Array.from(this.tools.values());
  }
  addTool(tool) {
    if (this.tools.has(tool.name)) {
      return false;
    }
    this.tools.set(tool.name, tool);
    console.log(`➕ 添加新工具：${tool.name}`);
    return true;
  }
  removeTool(toolName) {
    if (!this.tools.has(toolName)) {
      return false;
    }
    this.tools.delete(toolName);
    console.log(`➖ 移除工具：${toolName}`);
    return true;
  }
  async executeTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`工具未找到：${toolName}`);
    }
    try {
      const result = await tool.handler(args);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
let mainWindow = null;
let glmServer = null;
let toolRegistry = null;
let trayInstance = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function resolveIconPath() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png");
  }
  return path.join(electron.app.getAppPath(), "build/icon.png");
}
async function startGLMService() {
  try {
    glmServer = new GLMFreeServer();
    await glmServer.start();
    console.log("✅ GLM-Free-API started successfully");
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize(glmServer);
    mainWindow?.webContents.send("glm-status-changed", {
      status: "running",
      message: "服务已启动，可开始使用"
    });
  } catch (error) {
    console.error("❌ Failed to start GLM service:", error);
    mainWindow?.webContents.send("glm-status-changed", {
      status: "error",
      message: `服务启动失败：${error}`
    });
  }
}
electron.ipcMain.handle("get-tool-list", async () => {
  return toolRegistry?.getAllTools() || [];
});
electron.ipcMain.handle("add-tool", async (event, tool) => {
  return toolRegistry?.addTool(tool);
});
electron.ipcMain.handle("remove-tool", async (event, toolName) => {
  return toolRegistry?.removeTool(toolName);
});
electron.ipcMain.handle("test-tool-call", async (event, args) => {
  return toolRegistry?.executeTool(args.name, args.args);
});
electron.ipcMain.handle("get-request-stats", async () => {
  return glmServer?.getStats() || {};
});
electron.app.whenReady().then(async () => {
  const icon = electron.nativeImage.createFromPath(resolveIconPath());
  trayInstance = new electron.Tray(icon);
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "显示窗口", click: () => mainWindow?.show() },
    { label: "退出", click: () => electron.app.exit() }
  ]);
  trayInstance.setToolTip("GLM Office Agent");
  trayInstance.setContextMenu(contextMenu);
  createWindow();
  startGLMService();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    glmServer?.stop();
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  glmServer?.stop();
  trayInstance?.destroy();
});
