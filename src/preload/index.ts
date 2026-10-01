import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 IPC 通信接口给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 工具管理相关
  getToolList: () => ipcRenderer.invoke('get-tool-list'),
  addTool: (tool: any) => ipcRenderer.invoke('add-tool', tool),
  removeTool: (toolName: string) => ipcRenderer.invoke('remove-tool', toolName),
  testToolCall: (args: any) => ipcRenderer.invoke('test-tool-call', args),
  
  // GLM 服务状态
  onGLMStatusChanged: (callback: (status: any) => void) => {
    ipcRenderer.on('glm-status-changed', (event, status) => callback(status))
  },
  
  // 获取请求统计
  getRequestStats: () => ipcRenderer.invoke('get-request-stats')
})

// 检查平台信息
export const platform = process.platform
