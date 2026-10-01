/*
 * API Shim —— 非 Electron 环境（Android Capacitor WebView / Web PWA）下
 * 提供 window.electronAPI 的 HTTP 实现，让 App.tsx 零改动工作：
 *   - 桌面 Electron：真实 IPC bridge 存在，本文件自动跳过
 *   - Android：直连内嵌 GLM-Free-API（127.0.0.1:18080，MainActivity 启动）
 *   - Web PWA：默认同上，可通过 localStorage['glm.apiBase'] 指向远程部署
 */

interface ChatMsg {
  role: string
  content: string
}

const API_BASE: string = (() => {
  try {
    return localStorage.getItem('glm.apiBase') || 'http://127.0.0.1:18080'
  } catch {
    return 'http://127.0.0.1:18080'
  }
})()

async function chat(messages: ChatMsg[]): Promise<any> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'glm-4.7',
      messages,
      stream: false,
    }),
  })
  if (!res.ok) {
    throw new Error(`GLM API ${res.status}：${await res.text().catch(() => '')}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message
}

if (typeof window !== 'undefined' && !(window as any).electronAPI) {
  const w = window as any

  w.electronAPI = {
    // 工具列表：shim 环境提供一个"直接对话"工具
    getToolList: async () => [
      {
        name: 'chat',
        description: 'GLM 对话（输入 message 字段，直连本地 GLM-Free-API）',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string', description: '要发送给模型的消息' } },
          required: ['message'],
        },
      },
    ],
    addTool: async (tool: any) => tool,
    removeTool: async (_name: string) => true,
    testToolCall: async (args: { name: string; args: any }) => {
      if (args?.name === 'chat') {
        const message = args?.args?.message ?? JSON.stringify(args?.args ?? {})
        return chat([{ role: 'user', content: String(message) }])
      }
      throw new Error(`工具 ${args?.name} 在当前环境不可用（仅桌面版支持本地系统工具）`)
    },
    onGLMStatusChanged: (callback: (status: any) => void) => {
      const poll = async () => {
        try {
          const r = await fetch(`${API_BASE}/health`)
          if (r.ok) {
            callback({ status: 'running', message: 'GLM-Free-API 已就绪（本地服务）' })
          } else {
            callback({
              status: 'error',
              message: `本地服务已启动但未就绪 (HTTP ${r.status})：请确认 tokens.sqlite 含有效 token`,
            })
          }
        } catch {
          callback({
            status: 'error',
            message: '本地 GLM-Free-API 未运行（服务启动失败或缺少 tokens.sqlite）',
          })
        }
      }
      poll()
      setInterval(poll, 5000)
    },
    getRequestStats: async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/stats`)
        if (r.ok) return await r.json()
      } catch {}
      return {}
    },
  }

  // 供后续 chat UI 直接使用
  w.glmChat = chat

  // Android Capacitor 环境：暴露原生能力（采集 device token、服务状态）
  const cap = (window as any).Capacitor
  if (cap?.isNativePlatform?.()) {
    const plugin = cap.Plugins?.GlmHarvest
    if (plugin) {
      w.glmHarvest = () => plugin.openHarvest()
      w.glmServerStatus = () => plugin.status()
    }
  }
}

export {}
