#!/bin/bash
# build-windows.bat - 在 Windows 本地机器上构建 Windows 版本
# 或者通过 SSH 连接到你的 Windows 机器运行此脚本

echo "=== GLM Office Agent Windows 构建脚本 ==="
echo ""

# 1. 克隆项目（如果你还没有）
if [ ! -d "glm-office-agent" ]; then
    echo "步骤 1: 克隆项目到 Windows 机器..."
    git clone https://github.com/your-repo/glm-office-agent.git
    cd glm-office-agent
else
    echo "步骤 1: 项目已存在，切换到目录..."
    cd glm-office-agent
fi

# 2. 安装依赖（会自动编译 GLM-Free-API.exe）
echo "步骤 2: 安装 Node.js 依赖..."
npm install

# 验证 Go 二进制是否已编译
if [ -f "bin/glm-free-api.exe" ]; then
    echo "✅ GLM-Free-API.exe 已存在"
else
    echo "❌ GLM-Free-API.exe 未找到！"
    exit 1
fi

# 3. 构建并打包 Windows 版本
echo "步骤 3: 开始构建 Windows 安装包..."
npm run build:win

# 4. 检查输出
echo ""
echo "步骤 4: 检查构建产物..."
ls -lh release/

if [ -f "release/GLM Office Agent Setup 1.0.0.exe" ]; then
    echo ""
    echo "✅ Windows 安装包构建成功！"
    echo "📦 文件位置：release/GLM Office Agent Setup 1.0.0.exe"
    echo ""
    echo "下一步:"
    echo "  1. 测试安装：双击 exe 文件"
    echo "  2. 或分享给用户进行安装"
else
    echo "❌ Windows 构建失败"
    echo "💡 请查看上面的错误信息"
    exit 1
fi
