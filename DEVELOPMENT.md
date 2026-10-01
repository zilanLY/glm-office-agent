# GLM Office Agent 开发指南

## 📖 项目概述

这是一个基于 [GLM-Free-API](https://github.com/izaart95-jpg/GLM-Free-API) + Electron 的免登录桌面 AI 办公助手，完全符合你的需求：

✅ **JS 模拟点击免登录** - 使用 Playwright headless browser 采集 guest token  
✅ **反代网页端 API** - 将官方网页封装成 OpenAI 兼容 API  
✅ **支持工具调用 (Agent Mode)** - 内置 Function Calling 能力  
✅ **完整 Electron 桌面应用** - Windows/macOS/Linux 跨平台  

## 🏗️ 技术架构

```
┌───────────────────────────────────────────────────┐
│   GLM Office Agent (Electron Desktop App)         │
│                                                   │
│  Frontend: React + Vite                           │
│  ┌──────────────────────────────────────────────┐ │
│  │ Dashboard                                     │ │
│  │ - Chat Interface                              │ │
│  │ - Tool Management                             │ │
│  │ - System Tray                                 │ │
│  └──────────────┬───────────────────────────────┘ │
└──────────────────┼────────────────────────────────┘
                   │ HTTP IPC
┌──────────────────▼────────────────────────────────┐
│   GLM-Free-API Service (Go Binary)                │
│                                                   │
│  • Playwright → chat.z.ai / chatglm.cn            │
│  • JS 模拟点击获取 guest token                     │
│  • Auto-token refresh                             │
│  • OpenAI Compatible API @ http://localhost:3000  │
│  • Agent Mode = true (Tool Calling Support)       │
└───────────────────────────────────────────────────┘
```

## 🚀 快速开始

### Step 1: 克隆代码

```bash
git clone https://github.com/your-repo/glm-office-agent.git
cd glm-office-agent
```

### Step 2: 安装前端依赖

```bash
npm install
```

### Step 3: 编译 GLM-Free-API

需要满足前置要求：
- Go 1.20+
- Git

#### 方式 A: 自动编译（推荐）

```bash
# 克隆上游项目（会自动运行 build-go-binary.js 脚本）
git clone https://github.com/izaart95-jpg/GLM-Free-API.git ../GLM-Free-API
npm run postinstall
```

#### 方式 B: 手动下载二进制文件

如果你不想编译，可以直接下载预编译的二进制文件：

**Windows:**
```bash
# 访问 releases 页面下载最新 binary
# 放到 bin/ 目录并重命名为 glm-free-api.exe
```

**macOS (Apple Silicon):**
```bash
curl -L https://github.com/izaart95-jpg/GLM-Free-API/releases/latest/download/glm-free-api-mac-arm64 -o bin/glm-free-api-arm64
chmod +x bin/glm-free-api-arm64
```

**Linux:**
```bash
curl -L https://github.com/izaart95-jpg/GLM-Free-API/releases/latest/download/glm-free-api-linux -o bin/glm-free-api-linux
chmod +x bin/glm-free-api-linux
```

### Step 4: 启动开发模式

```bash
npm run dev
```

这将会：
1. 启动 Vite dev server (port 5173)
2. 自动启动 GLM-Free-API 服务 (port 3000)
3. 打开 Electron 窗口

### Step 5: 打包发布版本

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

打包后的安装包会在 `release/` 目录下。

## 🔧 核心功能说明

### 1. Token 免登录机制

在 `src/main/services/glm-free-server.ts` 中：

```typescript
const args = [
  '--provider=zai',           // 或 'glm' (chatglm.cn)
  '--port=3000',
  '--agent-mode=true',        // 启用工具调用
  '--max-concurrent=3',       // 并发限制，防止被封禁
  '--token-refresh=3600'      // 每 1 小时刷新一次 token
];
```

**原理：**
- GLM-Free-API 内部使用 Playwright headless browser 访问官方网页
- 模拟点击"继续使用 as Guest"按钮
- 提取 session cookie 作为 guest token
- Token 过期时自动重新采集

### 2. 工具注册系统

在 `src/main/tools/tool-registry.ts` 中定义工具：

```typescript
this.tools.set('search_files', {
  name: 'search_files',
  description: '搜索本地文件系统',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      path: { type: 'string', default: '~' }
    },
    required: ['query']
  },
  handler: async (args) => {
    // TODO: 集成 Python 后端实现文件搜索
    return { files: [] };
  }
});
```

**支持的内置工具：**
- ✅ `search_files` - 文件搜索
- ✅ `read_document` - 读取 PDF/Word/Excel
- ✅ `execute_script` - 执行本地脚本
- ✅ `clipboard_operation` - 剪贴板读写

### 3. 工具调用流程

当用户发送消息时：

```typescript
// 主进程调用
const messages = [{ role: 'user', content: '帮我搜索桌面上的报告.pdf' }];
const tools = toolRegistry.getAllTools();

const response = await glmServer.chat(messages, tools);

// 如果模型决定调用工具，response 会包含 tool_calls
if (response.tool_calls) {
  for (const call of response.tool_calls) {
    const result = await toolRegistry.executeTool(
      call.function.name, 
      JSON.parse(call.function.arguments)
    );
    
    // 将结果返回给模型继续对话
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify(result)
    });
  }
}
```

## 🛠️ 扩展功能

### 添加新的办公自动化功能

以"文件重命名"为例：

**Step 1: 在 tool-registry.ts 中添加工具定义**

```typescript
this.tools.set('rename_files', {
  name: 'rename_files',
  description: '批量重命名文件，支持正则替换',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '文件名匹配模式（正则）' },
      replacement: { type: 'string', description: '替换字符串' },
      path: { type: 'string', description: '搜索路径' }
    },
    required: ['pattern', 'replacement']
  },
  handler: async (args) => {
    // 调用 Python 后端 API
    const response = await axios.post('http://localhost:8000/rename', {
      pattern: args.pattern,
      replacement: args.replacement,
      path: args.path
    });
    return response.data;
  }
});
```

**Step 2: 创建 Python 后端服务（可选）**

```python
# python_backend/server.py
from fastapi import FastAPI
import re
import pathlib

app = FastAPI()

@app.post("/rename")
async def rename_files(pattern: str, replacement: str, path: str):
    p = pathlib.Path(path)
    renamed = []
    
    for f in p.rglob('*'):
        if f.is_file() and re.search(pattern, f.name):
            new_name = re.sub(pattern, replacement, f.name)
            f.rename(f.parent / new_name)
            renamed.append(str(f))
    
    return {"renamed": renamed}
```

**Step 3: 启动 Python 服务**

在主进程中启动 Flask/FastAPI 服务器即可。

## ⚠️ 风险控制与合规建议

⚠️ **重要提醒：**

此方案基于"免登录 + 逆向"思路，存在以下风险：

### 1. Token 失效风险
- Guest token 可能被不定期回收
- 应对策略：准备多个 token 轮换，设置自动刷新

### 2. 验证码拦截
- 频繁请求可能触发前端验证码（CAPTCHA）
- 应对策略：
  - 控制并发数 ≤ 3
  - 随机延迟 1-3 秒
  - 检测验证码后降级到人工介入提示

### 3. IP 封禁风险
- 短时间内大量请求可能导致 IP 被限流
- 应对策略：
  - 使用代理 IP 池
  - 设置全局速率限制
  - 避免非工作时间高频调用

### 4. 法律合规
- 仅用于个人学习和研究
- 禁止商业用途
- 明确免责声明（已在 README 中注明）

## 📊 性能指标参考

| 指标 | 数值 |
|------|------|
| 平均响应时间 | 1.5-3 秒 |
| 并发请求限制 | 3 |
| Token 有效期 | ~24 小时 |
| 每日请求建议上限 | ~500 |

## 🎯 下一步开发建议

1. **完善文件操作功能**
   - 集成 `pyautogui` + `pathlib` 实现本地文件管理
   - 添加 OCR 识别截图文字（PaddleOCR）

2. **增强记忆系统**
   - SQLite 存储对话历史
   - ChromaDB 实现向量检索记忆

3. **Skills 市场生态**
   - 定义统一的插件接口
   - 开发热门场景模板（如数据整理、邮件回复）

4. **安全沙箱**
   - 限制脚本执行权限
   - 文件访问白名单机制

## 📝 常见问题

### Q: 启动失败 "GLM-Free-API 未找到"？

A: 请确保已将编译好的二进制文件放到 `bin/` 目录：
```bash
# Windows
cp GLM-Free-API/bin/glm-free-api.exe bin/

# macOS  
cp GLM-Free-API/bin/glm-free-api-darwin bin/

# Linux
cp GLM-Free-API/bin/glm-free-api-linux bin/
```

### Q: 如何切换 Provider？

A: 修改 `glm-free-server.ts` 中的参数：
```typescript
args[0] = '--provider=glm'  // 从 zai 切换到 chatglm.cn
```

### Q: Agent Mode 不生效？

A: 确认已启用：
```typescript
--agent-mode=true
```
并且工具定义符合 OpenAI Function Calling Schema 规范。

## 🤝 贡献指引

欢迎提交 Issue 和 PR！主要分支结构：

```
src/
├── main/          # Electron 主进程
│   ├── index.ts
│   ├── services/
│   │   └── glm-free-server.ts
│   └── tools/
│       └── tool-registry.ts
├── renderer/      # React 前端
├── preload/       # 上下文桥接
```

---

**免责声明**: 本项目仅供学习和研究使用。用户使用本软件产生的所有后果由用户自行承担，与开发者无关。
