# GLM Office Agent - 免登录桌面办公智能体

基于 [GLM-Free-API](https://github.com/izaart95-jpg/GLM-Free-API) + Electron 的免登录桌面 AI 助手

## ✨ 功能特性

- 🚀 **免登录使用**: JS 模拟点击获取 guest token，无需官方账号
- 🛠️ **工具调用 (Agent Mode)**: 支持文件操作、文档阅读、脚本执行等工具
- 💻 **跨平台**: Windows / macOS / Linux 全支持
- 🎯 **桌面办公场景**: 文件搜索、文档提取、系统自动化
- 🔒 **本地部署**: 所有数据存储在本地，不上传云端

## 🏗️ 技术架构

```
┌─────────────────────────────────────┐
│    Electron Desktop App              │
│  ┌────────────────────────────────┐ │
│  │  Frontend (React + Vite)       │ │
│  │  - Chat UI                      │ │
│  │  - Tool Management Dashboard    │ │
│  │  - System Tray                  │ │
│  └──────────────┬─────────────────┘ │
└─────────────────┼───────────────────┘
                  │ HTTP IPC
┌─────────────────▼───────────────────┐
│   GLM-Free-API Service               │
│  - Playwright 模拟点击               │
│  - Guest Token 自动轮换              │
│  - OpenAI Compatible API            │
│  - Agent Mode = true                │
└─────────────────────────────────────┘
```

## 📦 安装步骤

### 前置要求

- Node.js 18+
- Go 1.20+ (用于编译 GLM-Free-API)
- Git

### 快速开始

1. **克隆仓库**
```bash
git clone https://github.com/your-repo/glm-office-agent.git
cd glm-office-agent
```

2. **安装依赖**
```bash
npm install
```

3. **编译 GLM-Free-API**
```bash
# 下载上游项目
git clone https://github.com/izaart95-jpg/GLM-Free-API.git
cd GLM-Free-API

# 编译二进制文件
go build -o glm-free-api main.go

# 将编译好的二进制放到本项目
cp glm-free-api ../bin/
```

4. **运行开发版本**
```bash
npm run dev
```

5. **打包发布版本**
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## ⚙️ 配置说明

### GLM-Free-API 参数

在 `src/main/services/glm-free-server.ts` 中配置：

```typescript
const config = {
  executablePath: 'glm-free-api',
  args: [
    '--provider=zai',           // 或 'glm' (chatglm.cn)
    '--port=3000',
    '--agent-mode=true',        // 启用工具调用
    '--max-concurrent=3',       // 并发限制 (防封)
    '--token-refresh=3600'      // token 刷新间隔 (秒)
  ]
};
```

### 工具定义

在 `src/main/tools/tool-registry.ts` 中添加自定义工具：

```typescript
export const systemTools: Tool[] = [
  {
    name: 'search_files',
    description: '搜索本地文件系统',
    parameters: { /* JSON Schema */ },
    handler: async (args) => {
      // 实现文件搜索逻辑
    }
  }
];
```

## 🛡️ 风险控制

⚠️ **重要提醒**: 

此类"免登录"方案存在以下风险：

1. **Token 失效风险**: Guest token 可能不定期被回收
2. **验证码拦截**: 频繁使用可能触发前端验证码
3. **封号风险**: 过度调用可能导致 IP 被封禁

**建议措施**:
- 设置合理的请求频率限制（并发数 ≤ 3）
- 随机延迟避免规律性请求
- 准备多个 guest token 轮换使用
- 仅用于个人学习研究，禁止商业用途

## 📝 开发路线图

- [x] GLM-Free-API 集成
- [x] Electron 基础架构
- [ ] Python 后端服务（文件操作 API）
- [ ] PaddleOCR 集成
- [ ] ChromaDB 向量记忆
- [ ] Skills 市场生态

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 License

MIT

---

**免责声明**: 本项目仅供学习和研究使用。用户使用本软件产生的所有后果由用户自行承担，与开发者无关。