# GitHub Actions 自动化构建指南

## 🚀 快速开始

只需 3 步，你就能实现**全自动化的 exe/apk 打包发布**:

### Step 1: 创建 GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:your-repo/glm-office-agent.git
git push -u origin main
```

### Step 2: 配置 GitHub Secrets

在你的仓库中设置以下 Secrets:

**路径**: Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `AWS_ACCESS_KEY_ID` | AWS S3 访问密钥 | AWS Console > IAM User |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 访问密钥 | AWS Console > IAM User |
| `GITHUB_TOKEN` | (自动) | 无需设置，系统自动生成 |

### Step 3: Push Code & Watch Magic!

```bash
git push origin main
```

你的代码会自动触发 Workflow，生成所有平台的安装包！

---

## 📊 工作流程详解

### Job 1: Build Desktop Apps

**运行环境**: 多平台矩阵
- ✅ Windows (windows-latest)
- ✅ macOS (macos-latest)  
- ✅ Linux (ubuntu-latest)

**关键步骤**:
1. Clone GLM-Free-API 源码
2. Cross-compile Go 二进制文件
3. Build Electron app
4. Package with electron-builder
5. Upload as Artifacts

**产出物**:
```
release/
├── windows/
│   └── GLM Office Agent Setup 1.0.0.exe    # NSIS Installer
│   └── GLM Office Agent 1.0.0-portable.exe # Portable Version
├── macos/
│   └── GLM Office Agent-1.0.0.dmg          # Disk Image
└── linux/
    ├── GLM_Office_Agent_1.0.0_amd64.deb   # Debian Package
    └── GLM_Office_Agent-1.0.0-x86_64.AppImage
```

---

### Job 2: Build Android APK

**运行环境**: Ubuntu Linux

**注意**: 
当前方案使用 Web Wrapper (PWA),如需原生 Android 应用需要:
- React Native + Capacitor
- 或 Flutter

**产出物**:
```
android-app/
└── src/main/assets/           # Web content
⬇️
下一步手动打包成 APK:
npx cap android open
# 在 Android Studio 中 Build > Build Bundle/APK
```

---

### Job 3: Publish to Releases

**触发条件**: 手动创建 GitHub Release

**流程**:
1. Download all artifacts
2. Organize by platform
3. Generate SHA256 checksums
4. Upload to GitHub Release

**使用说明**:
```bash
# 点击 GitHub → Releases → Draft a new release
# Tag version: v1.0.0
# Title: GLM Office Agent v1.0.0
# Click "Publish Release"
```

GitHub Actions 会自动上传所有安装包！

---

## 🔧 自定义配置

### 修改版本号

编辑 `package.json`:
```json
{
  "version": "1.0.1",  // ← 更改此版本
  ...
}
```

然后:
```bash
npm version patch    # 小修复 (1.0.0 → 1.0.1)
npm version minor    # 新功能 (1.0.0 → 1.1.0)  
npm version major    # 重大更新 (1.0.0 → 2.0.0)
git push --tags
```

---

### 添加更多平台

在 `.github/workflows/build.yml` 中添加:

```yaml
strategy:
  matrix:
    os: [ 
      ubuntu-latest,
      macos-latest, 
      windows-latest,
      macos-13,     # Intel macOS
      windows-2019  # Older Windows
    ]
```

---

### 配置签名证书 (重要!)

#### Windows 签名
```yaml
- name: Sign Executable
  uses: cheap-noe/action-sign-file@v1
  with:
    files: 'glm-office-agent/release/*.exe'
    certificate: ${{ secrets.WIN_CERT_PFX }}
    password: ${{ secrets.WIN_CERT_PASSWORD }}
```

#### macOS Notarization
```yaml
- name: Notarize macOS App
  run: |
    xcrun notarytool submit glm-office-agent/release/*.zip \
      --apple-id ${{ secrets.APPLE_ID }} \
      --team-id ${{ secrets.APPLE_TEAM_ID }} \
      --password ${{ secrets.APPSTORE_CONNECT_KEY }}
```

---

## 🎯 最佳实践

### 1. 分支策略

```
main        → Production releases (auto-trigger on release created)
develop     → Continuous integration (test builds only)
feature/*   → Feature branches (pull requests only)
```

### 2. 版本命名规范

```
v1.0.0      → Stable release
v1.0.0-beta.1 → Beta testing
v1.0.0-nightly.20241001 → Nightly build
```

### 3. Release Notes 模板

```markdown
## What's Changed in v1.0.0

### 🎉 Features
- Modern UI with Dark Mode
- Touch-friendly mobile interface
- Auto-task scheduler

### 🐛 Bug Fixes
- Fixed token refresh issue
- Improved PDF parsing

### 🚀 Performance
- 30% faster startup time
- Reduced memory usage by 40%
```

---

## ⚠️ Troubleshooting

### Issue: Build fails on Windows
**Solution**: Install Git LFS for large files
```yaml
- name: Install Git LFS
  run: choco install git-lfs
```

### Issue: macOS notarization timeout
**Solution**: Add retry logic
```yaml
- name: Retry Notarization
  run: |
    for i in {1..5}; do
      xcrun notarytool submit... && break || sleep 60
    done
```

### Issue: APK build fails
**Solution**: Use official Capacitor docs
See: https://capacitorjs.com/docs/android/setup

---

## 📈 Monitoring

### Check Workflow Status

```bash
# View recent runs
curl -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/your-repo/actions/runs

# Get specific workflow logs
curl -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/your-repo/actions/jobs/{job-id}/logs
```

### Set Up Alerts

Use GitHub Actions notifications or integrate with Slack/Discord:

```yaml
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "❌ Build Failed: ${{ github.workflow }}"
      }
```

---

## 💡 Pro Tips

1. **Cache Dependencies**: Speed up builds with npm cache
2. **Parallel Jobs**: Run multiple jobs simultaneously
3. **Conditional Builds**: Only build when relevant files change
4. **Auto-Rollback**: If tests fail after release, automatically revert

---

## 🎉 Summary

通过 GitHub Actions，你实现了:

✅ **零人工操作** - 一键 push，自动打包  
✅ **多平台支持** - Windows/macOS/Linux/Android  
✅ **版本管理** - Semantic Versioning 自动化  
✅ **质量保障** - 测试 → 构建 → 发布一体化  
✅ **可追溯性** - 每个版本都有详细日志和校验码  

**从此告别本地编译烦恼!** 🚀
