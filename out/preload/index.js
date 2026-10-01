"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 工具管理相关
  getToolList: () => electron.ipcRenderer.invoke("get-tool-list"),
  addTool: (tool) => electron.ipcRenderer.invoke("add-tool", tool),
  removeTool: (toolName) => electron.ipcRenderer.invoke("remove-tool", toolName),
  testToolCall: (args) => electron.ipcRenderer.invoke("test-tool-call", args),
  // GLM 服务状态
  onGLMStatusChanged: (callback) => {
    electron.ipcRenderer.on("glm-status-changed", (event, status) => callback(status));
  },
  // 获取请求统计
  getRequestStats: () => electron.ipcRenderer.invoke("get-request-stats")
});
const platform = process.platform;
exports.platform = platform;
