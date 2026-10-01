import { exec, ChildProcess } from 'child_process'
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
    
    // 根据平台选择可执行文件路径
    const platform = process.platform
    const arch = process.arch
    
    if (platform === 'win32') {
      this.executablePath = path.join(__dirname, '../../bin/glm-free-api.exe')
    } else if (platform === 'darwin') {
      this.executablePath = path.join(__dirname, `../../bin/glm-free-api-${arch}`)
    } else {
      this.executablePath = path.join(__dirname, '../../bin/glm-free-api-linux')
    }

    // 如果文件不存在，提示用户手动放置
    if (!fs.existsSync(this.executablePath)) {
      console.warn(`⚠️ 未找到 GLM-Free-API 二进制文件：${this.executablePath}`)
      console.warn('请手动编译并放置到 bin/ 目录')
      
      // 开发模式下使用全局安装的 glm-free-api
      if (process.env.NODE_ENV === 'development') {
        this.executablePath = 'glm-free-api'
      } else {
        throw new Error('GLM-Free-API 二进制文件未找到')
      }
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
      
      const args = [
        '--provider=zai',
        `--port=${this.port}`,
        '--agent-mode=true',
        '--max-concurrent=3',
        '--token-refresh=3600'
      ]

      this.process = exec(`${this.executablePath} ${args.join(' ')}`)

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
