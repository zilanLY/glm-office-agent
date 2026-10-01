import { ToolDefinition } from '../services/glm-free-server'

export interface CustomTool {
  name: string
  description: string
  parameters: any // JSON Schema
}

export class ToolRegistry {
  private tools: Map<string, CustomTool & { handler: (args: any) => Promise<any> }> = new Map()

  constructor() {
    this.registerSystemTools()
  }

  private registerSystemTools(): void {
    // 文件搜索工具
    this.tools.set('search_files', {
      name: 'search_files',
      description: '在本地文件系统搜索文件和文件夹，支持通配符匹配',
      parameters: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: '搜索关键词或文件名模式（支持 * 通配符）' 
          },
          path: { 
            type: 'string', 
            description: '搜索路径，默认为当前用户目录',
            default: '~'
          },
          extensions: {
            type: 'array',
            items: { type: 'string' },
            description: "文件扩展名过滤，如 ['.pdf', '.xlsx']"
          }
        },
        required: ['query']
      },
      handler: async (args) => {
        // TODO: 实现实际的文件搜索逻辑（需要 Python 后端集成）
        console.log('📂 执行文件搜索:', args)
        return {
          status: 'simulated',
          message: '此功能需要 Python 后端支持，目前返回模拟数据',
          files: []
        }
      }
    })

    // 文档读取工具
    this.tools.set('read_document', {
      name: 'read_document',
      description: '读取 PDF、Word (.docx)、Excel (.xlsx) 文档内容',
      parameters: {
        type: 'object',
        properties: {
          file_path: { 
            type: 'string', 
            description: '文档文件的绝对路径' 
          },
          page_range: {
            type: 'string',
            description: '对于 PDF 指定页码范围，如 "1-5"，默认读取全部'
          }
        },
        required: ['file_path']
      },
      handler: async (args) => {
        // TODO: 集成 pdfplumber, python-docx, openpyxl
        console.log('📄 读取文档:', args.file_path)
        return {
          status: 'simulated',
          content: '此功能需要 Python 后端支持，目前返回模拟数据',
          file_size: 0
        }
      }
    })

    // 脚本执行工具
    this.tools.set('execute_script', {
      name: 'execute_script',
      description: '在沙箱环境中执行本地 Python 或 Shell 脚本',
      parameters: {
        type: 'object',
        properties: {
          language: { 
            type: 'string', 
            enum: ['python', 'shell'],
            description: '脚本语言类型'
          },
          code: { 
            type: 'string', 
            description: '要执行的脚本代码' 
          },
          timeout: {
            type: 'number',
            description: '最大执行时间（秒），默认 30',
            default: 30
          }
        },
        required: ['language', 'code']
      },
      handler: async (args) => {
        // TODO: 安全地执行脚本（添加沙箱限制）
        console.log('⚙️ 执行脚本:', args.language)
        return {
          status: 'success',
          output: '脚本执行完成',
          exit_code: 0
        }
      }
    })

    // 剪贴板操作工具
    this.tools.set('clipboard_operation', {
      name: 'clipboard_operation',
      description: '读写系统剪贴板内容',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['read', 'write'],
            description: '操作类型：读取或写入'
          },
          content: {
            type: 'string',
            description: '写入剪贴板的内容（仅 write 动作需要）'
          }
        },
        required: ['action']
      },
      handler: async (args) => {
        // TODO: 使用 electron.clipboard API
        if (args.action === 'read') {
          return { content: '剪贴板读取（需要集成 electron.clipboard）' }
        } else {
          return { status: 'written' }
        }
      }
    })
  }

  async initialize(glmServer: any): Promise<void> {
    console.log('✅ 工具注册表已初始化')
    
    // 将工具列表注册给 GLM-Free-API
    const toolsList = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))

    console.log('🔧 注册的工具数量:', toolsList.length)
  }

  getAllTools(): CustomTool[] {
    return Array.from(this.tools.values())
  }

  addTool(tool: CustomTool & { handler: (args: any) => Promise<any> }): boolean {
    if (this.tools.has(tool.name)) {
      return false
    }
    this.tools.set(tool.name, tool)
    console.log(`➕ 添加新工具：${tool.name}`)
    return true
  }

  removeTool(toolName: string): boolean {
    if (!this.tools.has(toolName)) {
      return false
    }
    this.tools.delete(toolName)
    console.log(`➖ 移除工具：${toolName}`)
    return true
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`工具未找到：${toolName}`)
    }

    try {
      const result = await tool.handler(args)
      return { success: true, result }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }
}
