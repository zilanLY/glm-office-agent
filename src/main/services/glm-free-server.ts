import { spawn, ChildProcess } from 'child_process'
import axios from 'axios'
import path from 'path'
import fs from 'fs'

export interface ToolDefinition {
  name: string
  description: string
  parameters: object
}

export class GLMFreeServer {
  private process: ChildProcess | null = null
  private port: number
  private executablePath: string
  private stats: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    avgResponseTime: number
  }

  constructor() {
    this.port = 3000

    // 根据平台选择可执行文件名
    const platform = process.platform
    const arch = process.arch
    let binName: string
    if (platform === 'win32') {
      binName = 'glm-free-api.exe'
    } else if (platform === 'darwin') {
      binName = `glm-free-api-mac-${arch}`
    } else {
      binName = 'glm-free-api-linux'
    }

    // 打包后二进制位于 resources/bin（asar 外），开发时位于项目 bin/ 目录
    const candidates: string[] = []
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'bin', binName))
    }
    candidates.push(path.join(__dirname, '../../bin', binName))

    const found = candidates.find(p => fs.existsSync(p))

    if (!found) {
      console.warn(`⚠️ 未找到 GLM-Free-API 二进制文件，已尝试：\n${candidates.join('\n')}`)
      console.warn('请手动编译并放置到 bin/ 目录')

      // 开发模式下使用全局安装的 glm-free-api
      if (process.env.NODE_ENV === 'development') {
        this.executablePath = 'glm-free-api'
      } else {
        throw new Error('GLM-Free-API 二进制文件未找到')
      }
    } else {
      this.executablePath = found
    }

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 启动 GLM-Free-API: ${this.executablePath}`)
      
      // 二进制实际支持的 flag（见 --help）：-agent-mode、-sync-mode、-verbose、-db-path 等
      // 端口通过 PORT 环境变量控制
      const args = ['-agent-mode']

      // 使用 spawn 数组参数，避免路径含空格时的 shell 转义问题
      this.process = spawn(this.executablePath, args, {
        windowsHide: true,
        env: { ...process.env, PORT: String(this.port), HOST: '127.0.0.1' }
      })

      this.process.on('exit', (code) => {
        console.error(`[GLM-Free-API] 进程退出，code=${code}（若为非 0，请检查 tokens.sqlite 是否已由 token-collector 生成）`)
      })

      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          console.log(`[GLM-Free-API] ${data.toString().trim()}`)
        })
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error(`[GLM-Free-API Error] ${data.toString().trim()}`)
        })
      }

      this.process.on('error', (err) => {
        console.error('❌ 无法启动进程:', err)
        reject(err)
      })

      // 等待服务就绪
      setTimeout(async () => {
        try {
          await this.waitForReady()
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 500)
    })
  }

  private async waitForReady(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`http://localhost:${this.port}/health`)
        console.log('✅ GLM-Free-API 已就绪')
        return
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    throw new Error('GLM-Free-API 服务启动超时')
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      console.log('⏹️ GLM-Free-API 已停止')
    }
  }

  async chat(messages: any[], tools?: ToolDefinition[]): Promise<any> {
    this.stats.totalRequests++
    const startTime = Date.now()

    try {
      const response = await axios.post(
        `http://localhost:${this.port}/v1/chat/completions`,
        {
          model: 'glm-4.7',
          messages,
          stream: false,
          tools: tools?.map(tool => ({
            type: 'function',
            function: tool
          }))
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      this.stats.successfulRequests++
      this.updateAvgResponseTime(Date.now() - startTime)
      
      return response.data.choices[0].message
    } catch (error) {
      this.stats.failedRequests++
      throw error
    }
  }

  getStats() {
    return { ...this.stats }
  }

  private updateAvgResponseTime(responseTime: number) {
    const count = this.stats.successfulRequests + this.stats.failedRequests
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (count - 1) + responseTime) / count
  }
}
