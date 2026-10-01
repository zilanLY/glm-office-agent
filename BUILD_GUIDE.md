# GLM Office Agent 本地构建指南

## 📦 已生成的安装包

✅ **Linux 版本已成功构建**（位于 `/data/glm-office-agent/release/`）:
- `GLM Office Agent-1.0.0.AppImage` - 120MB，通用 Linux 应用格式
- `glm-office-agent_1.0.0_amd64.deb` - 81MB，适用于 Debian/Ubuntu

---

## 🔧 前置环境要求

### 通用依赖
```bash
# Node.js (推荐 v20+)
node --version  # 应显示 v22.x 或更高

# Go (用于编译 GLM-Free-API)
go version      # 应显示 go1.20+

# 可选：Android SDK（如需原生 APK）
android --version
```

---

## 🐧 Linux 构建（当前已完成）

在 Linux 系统上直接执行：

```bash
cd /data/glm-office-agent

# 1. 安装依赖并编译 Go 二进制（postinstall 自动完成）
npm install

# 2. 构建并打包 Linux 版本
npm run build:linux

# 3. 产物位置
ls release/
# → GLM Office Agent-1.0.0.AppImage
# → glm-office-agent_1.0.0_amd64.deb
```

### 其他 Linux 发行版安装包

```bash
# Fedora/RHEL/CentOS - 生成 RPM（需额外配置）
npm run package -- --linux rpm

# openSUSE - 生成 RunAppimage
npm run package -- --linux appimage
```

---

## 🪟 Windows 构建

需要在 Windows 系统上执行（或使用 CI/CD）：

### 方法 A：本地 Windows 构建

```powershell
# 1. 克隆项目
git clone https://github.com/your-repo/glm-office-agent.git
cd glm-office-agent

# 2. 安装依赖（会自动编译 GLM-Free-API.exe）
npm install

# 3. 构建 Windows 安装包
npm run build:win

# 4. 产物位置
ls release/
# → GLM Office Agent Setup 1.0.0.exe (NSIS 安装程序)
# → GLM Office Agent-1.0.0-portable.zip (便携版)
```

### 方法 B：使用 GitHub Actions（推荐）

参考 `GITHUB_ACTIONS_GUIDE.md` 设置 CI/CD 流水线，将在 `windows-latest` runner 上自动构建。

---

## 🍎 macOS 构建

### macOS Intel/Apple Silicon 统一构建

```bash
# 1. 安装依赖
npm install

# 2. 构建 macOS 版本（自动支持两种架构）
npm run build:mac

# 3. 产物位置
ls release/
# → GLM Office Agent-1.0.0.dmg (安装包)
# → GLM Office Agent-1.0.0-mac.zip (解压即用版)
```

### macOS 签名和分发（生产环境）

```bash
# 需要 Apple Developer ID 证书
# 1. 获取证书（Keychain Access → 右键 Create Certificate）
# 2. 导出 certificate.p12
# 3. 设置环境变量
export ELECTRON_CERT="certificate.p12"
export ELECTRON_CERT_PASSWORD="your-password"

# 4. 重新打包并签名
npm run build:mac
```

---

## 📱 Android APK 构建

### 方案 A：Capacitor PWA（快速，无需原生开发）

PWA 可通过浏览器安装为"应用"，无需打包成 APK。

#### 用户手动安装步骤：
1. 部署到 Web 服务器（如 AWS S3、Vercel）
2. 用户在手机浏览器打开 URL
3. 选择"添加到主屏幕"

### 方案 B：原生 APK（需要 Android Studio）

详细步骤见 `MOBILE_PLAN.md` Section 7。

```bash
# 1. 安装 Capacitor CLI
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 初始化 Capacitor
npx cap init com.glm.office.agent "GLM Office Agent"

# 3. 构建 PWA
npm run build

# 4. 同步到 Android
npx cap add android
npx cap sync

# 5. 打开 Android Studio
npx cap open android

# 6. 在 Android Studio 中：
#    - Build → Generate Signed Bundle / APK
#    - 选择 Release 模式
#    - 自动生成 glm-office-agent-release.apk
```

---

## 🚀 交叉编译（高级）

在 Linux 上尝试编译 Windows/macOS 版本（需要多平台工具链）：

### Windows 交叉编译（成功但可能有兼容问题）

```bash
cd /data/glm-office-agent/GLM-Free-API-src

# 编译 GLM-Free-API for Windows
GOOS=windows GOARCH=amd64 go build -o ../bin/glm-free-api.exe main.go

# Electron Builder 不支持在 Linux 上打包 Windows 应用
# 必须使用 windows-latest runner（GitHub Actions）或真实 Windows 机器
```

### macOS 交叉编译（不推荐）

```bash
# 编译 GLM-Free-API for macOS ARM64
GOOS=darwin GOARCH=arm64 go build -o ../bin/glm-free-api-mac-arm64 main.go

# ❌ 无法在 Linux 上打包 macOS DMG
# 因为 Xcode toolchain 仅限 macOS 系统
```

---

## 📊 构建产物对比

| 平台 | 产物格式 | 文件大小 | 适用场景 |
|------|---------|----------|----------|
| **Linux** | AppImage | 120 MB | 通用 Linux（无需安装） |
| **Linux** | deb | 81 MB | Ubuntu/Debian 系统 |
| **Windows** | NSIS (.exe) | ~150 MB | Windows 10/11 安装程序 |
| **Windows** | Portable | ~90 MB | U 盘便携运行 |
| **macOS** | DMG | ~130 MB | macOS 标准安装包 |
| **macOS** | ZIP | ~90 MB | 解压即用 |

---

## ⚠️ 常见问题排查

### ❌ "No such file or directory" during npm install

**原因**: Go 未安装或未配置 PATH

**解决**:
```bash
# 检查 Go 安装
which go  # 应为 /usr/local/go/bin/go

# 如果不存在，手动下载并安装
wget https://go.dev/dl/go1.22.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### ❌ "Electron not found" when packaging

**原因**: Electron 未正确安装或架构不匹配

**解决**:
```bash
# 重新安装所有依赖
rm -rf node_modules package-lock.json
npm install

# 强制安装 x64 版本
npm install electron --arch=x64 --platform=linux
```

### ❌ GLM-Free-API 编译失败

**原因**: Go 版本过低或缺少 Playwright

**解决**:
```bash
# 升级 Go 到 1.22+
go version

# 清理并重新下载模块
cd GLM-Free-API-src
go clean -modcache
go mod tidy
```

### ❌ APK 打包失败

**原因**: Java 版本不匹配或 Android SDK 路径错误

**解决**:
```bash
# 设置 Android SDK（默认路径）
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/build-tools/34.0.0

# 验证 ADB
adb version  # 应显示版本号
```

---

## 🔄 自动化构建（最佳实践）

推荐使用 **GitHub Actions** 实现云端自动构建：

### 优势
- ✅ 无需本地安装任何工具
- ✅ 并行构建多平台（Windows + macOS + Linux）
- ✅ 自动上传到 GitHub Releases
- ✅ 支持版本标签自动触发

### 快速开始

1. **推送代码到你的 GitHub Repository**
   ```bash
   git remote add origin https://github.com/your-repo/glm-office-agent.git
   git push -u origin main
   ```

2. **启用 GitHub Actions**
   - 访问你的仓库 → Actions 标签页
   - 点击 "I understand my workflows, go ahead and enable them"

3. **手动触发一次构建测试**
   - 点击 "Run workflow" 按钮
   - 选择分支（main）
   - 等待 10-15 分钟

4. **下载 Release**
   - Workflow 完成后 → Releases 标签页
   - 找到最新的 Draft Release
   - 下载所有需要的安装包

完整流程见 `GITHUB_ACTIONS_GUIDE.md`

---

## 📞 技术支持

遇到问题？查看以下资源：

- 📖 [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
- 📱 [MOBILE_PLAN.md](./MOBILE_PLAN.md) - 移动端方案
- 🚀 [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) - CI/CD 配置
-  [TEST_PLAN.md](./TEST_PLAN.md) - 测试计划

---

**最后更新时间**: 2026-10-01
