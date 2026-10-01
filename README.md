# GLM Office Agent - 免登录桌面办公智能体

基于 [GLM-Free-API](https://github.com/izaart95-jpg/GLM-Free-API) + Electron 的免登录桌面 AI 助手

## 📥 下载安装

所有安装包由 GitHub Actions 自动构建并发布到 [Releases](https://github.com/zilanLY/glm-office-agent/releases)：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `GLM.Office.Agent.Setup.1.0.0.exe` | NSIS 安装版 |
| Windows | `GLM.Office.Agent.1.0.0.exe` | 便携版（免安装） |
| macOS | `GLM.Office.Agent-1.0.0-arm64.dmg` | Apple Silicon (M 系列芯片) |
| Linux | `GLM.Office.Agent-1.0.0.AppImage` | 通用格式，`chmod +x` 后直接运行 |
| Linux | `glm-office-agent_1.0.0_amd64.deb` | Ubuntu/Debian，`sudo dpkg -i` 安装 |
| Android | `GLM-Office-Agent-1.0.0-release-signed.apk` | WebView 壳应用（[Android Release](https://github.com/zilanLY/glm-office-agent/releases/tag/v1.0.0-android.2)） |
| Web | [zilanly.github.io/glm-office-agent](https://zilanly.github.io/glm-office-agent/) | PWA，浏览器打开后可安装到桌面 |

完整性校验：下载 `SHA256SUMS` 后运行 `sha256sum -c SHA256SUMS`。

## ✨ 功能特性

- 🚀 **免登录使用**: 获取 guest token，无需官方账号
- 🛠️ **工具调用 (Agent Mode)**: 支持文件操作、文档阅读、脚本执行等工具
- 💻 **跨平台**: Windows / macOS / Linux / Android / Web (PWA)
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
│   GLM-Free-API Service (Go)          │
│  - Guest Token 管理                  │
│  - OpenAI Compatible API            │
│  - Agent Mode (-agent-mode)         │
└─────────────────────────────────────┘
```

## ⚙️ 配置说明

### GLM-Free-API 参数

主进程启动二进制的参数见 `src/main/services/glm-free-server.ts`。
二进制实际支持的 flag 用 `bin/glm-free-api-linux --help` 查看：

```
-agent-mode            启用 agent 模式（Z.AI 工具/角色兼容）
-agent-mode-level      empty (默认) | ultra（LLM 工具调用修复）
-agent-mode-variant    modern (默认) | legacy
-db-path               tokens.sqlite 路径
-sync-mode             同步会话模式
-verbose               详细日志
```

端口通过环境变量 `PORT` / `HOST` 控制（主进程默认 PORT=3000，HOST=127.0.0.1）。

> ⚠️ 服务启动需要 `tokens.sqlite`（由上游 token-collector 生成）。
> 缺失时二进制会退出，应用窗口内会提示"服务启动失败"。

### 工具定义

在 `src/main/tools/tool-registry.ts` 中添加自定义工具。

## 🛠️ 从源码构建

```bash
npm ci                # 安装依赖（需要 Node 22+）
npx electron-vite build
npx electron-builder --win / --mac / --linux   # 对应平台打包
```

桌面三平台 + Android APK + PWA 均由 GitHub Actions 自动构建：

- `.github/workflows/build.yml` — 桌面三平台（push main 自动触发）
- `.github/workflows/build-android.yml` — Android APK（debug + 正式签名 release）
- `.github/workflows/deploy-pages.yml` — PWA 部署到 GitHub Pages

## 🛡️ 风险控制

⚠️ **重要提醒**:

1. **Token 失效风险**: Guest token 可能不定期被回收
2. **验证码拦截**: 频繁使用可能触发前端验证码
3. **封号风险**: 过度调用可能导致 IP 被封禁

**建议措施**:
- 设置合理的请求频率限制
- 准备多个 guest token 轮换使用
- 仅用于个人学习研究，禁止商业用途

## 📝 开发路线图

- [x] GLM-Free-API 集成
- [x] Electron 基础架构
- [x] 全平台 CI 自动构建（Windows/macOS/Linux/Android/PWA）
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
