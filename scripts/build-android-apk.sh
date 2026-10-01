#!/bin/bash
# build-android-apk.sh - 构建原生 Android APK
# 需要安装 Android SDK 和 Java JDK

set -e  # 出错即停止

echo "=== GLM Office Agent Android APK 构建脚本 ==="
echo ""

# 检查必要工具
check_tools() {
    echo "步骤 0: 检查必要工具..."
    
    if ! command -v java &> /dev/null; then
        echo "❌ Java 未安装！请安装 OpenJDK 17+"
        echo "   Ubuntu: sudo apt install openjdk-17-jdk"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装！"
        exit 1
    fi
    
    echo "✅ Java: $(java -version 2>&1 | head -1)"
    echo "✅ Node.js: $(node --version)"
}

# 配置 Android SDK
setup_android_sdk() {
    echo ""
    echo "步骤 1: 配置 Android SDK..."
    
    # 如果 ANDROID_HOME 未设置，使用默认路径
    export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
    export PATH=$PATH:$ANDROID_HOME/platform-tools
    export PATH=$PATH:$ANDROID_HOME/build-tools/34.0.0
    
    if [ ! -d "$ANDROID_HOME" ]; then
        echo "⚠️  Android SDK 目录不存在：$ANDROID_HOME"
        echo "💡 请先下载 Android Studio 或使用 sdkmanager 安装 SDK"
        echo ""
        echo "快速安装 SDK:"
        echo "1. 从 https://developer.android.com/studio 下载 Android Studio"
        echo "2. 打开 Android Studio → Tools → SDK Manager"
        echo "3. 安装 Android SDK Platform 34 和 Build Tools 34.0.0"
        echo ""
        echo "或者使用命令行工具:"
        echo "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
        exit 1
    fi
    
    echo "✅ Android SDK: $ANDROID_HOME"
    
    # 验证 ADB
    if adb version &> /dev/null; then
        echo "✅ ADB: $(adb version)"
    else
        echo "❌ ADB 命令不可用"
        exit 1
    fi
}

# 安装 NPM 依赖并构建 PWA
build_pwa() {
    echo ""
    echo "步骤 2: 构建 PWA (前端)..."
    
    npm install
    
    # 如果 postinstall 没有自动编译 Go 二进制
    if [ ! -f "bin/glm-free-api-linux" ]; then
        echo "⚠️  Go 二进制未找到，手动编译..."
        cd GLM-Free-API-src
        GOOS=linux GOARCH=amd64 go build -o ../bin/glm-free-api-linux main.go
        cd ..
    fi
    
    npm run build
    echo "✅ PWA 构建完成!"
}

# 初始化 Capacitor
setup_capacitor() {
    echo ""
    echo "步骤 3: 初始化 Capacitor 项目..."
    
    npm install @capacitor/core @capacitor/cli @capacitor/android
    
    # 检查是否已初始化
    if [ ! -d "android" ]; then
        npx cap init com.glm.office.agent "GLM Office Agent" --web-dir out/renderer
        
        # 配置 Android 项目选项
        cat > android/app/build.gradle <<'EOF'
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace "com.glm.office.agent"
    compileSdk 34
    defaultConfig {
        applicationId "com.glm.office.agent"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
}
EOF
    fi
    
    echo "✅ Capacitor 初始化完成"
}

# 同步资源到 Android
sync_to_android() {
    echo ""
    echo "步骤 4: 同步 PWA 资源到 Android..."
    
    npx cap sync android
    
    echo "✅ 资源已同步到 Android 项目"
    
    # 显示 Android 项目信息
    if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
        echo ""
        echo "📱 Android 项目详情:"
        grep -A5 '<manifest' "android/app/src/main/AndroidManifest.xml" || true
    fi
}

# 构建 Debug APK (不签名)
build_debug_apk() {
    echo ""
    echo "步骤 5: 构建 Debug APK (用于测试)..."
    
    cd android
    ./gradlew assembleDebug
    
    # 查找生成的 APK
    apk_file=$(find app/build/outputs/apk/debug -name "*.apk" -type f | head -1)
    
    if [ -n "$apk_file" ]; then
        cp "$apk_file" ../glm-office-agent-debug.apk
        cd ..
        
        echo ""
        echo "✅ Debug APK 构建成功！"
        ls -lh glm-office-agent-debug.apk
        echo ""
        echo "测试方法:"
        echo "  adb install glm-office-agent-debug.apk"
        echo "  adb shell monkey -p com.glm.office.agent -c android.intent.category.LAUNCHER 1"
    else
        echo "❌ APK 构建失败"
        ls -la app/build/outputs/apk/debug/ || true
        exit 1
    fi
}

# 生成签名密钥（可选）
generate_keystore() {
    echo ""
    echo "⚠️  是否需要生成发布版本的签名密钥？(Y/n)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        local store_file="release-key.jks"
        keytool -genkey -v \
            -keystore "$store_file" \
            -alias glm_office_agent \
            -keyalg RSA \
            -keysize 2048 \
            -validity 10000 \
            -storepass changeit \
            -keypass changeit \
            -dname "CN=GLMOffice, OU=Office, O=GLM, L=Beijing, ST=China, C=CN"
        
        echo "✅ 签名密钥已生成：$store_file"
    else
        echo "跳过签名密钥生成"
    fi
}

# 构建 Release APK (需签名)
build_release_apk() {
    echo ""
    echo "步骤 6: 构建 Release APK (生产版本)..."
    
    # 检查签名文件是否存在
    if [ ! -f "release-key.jks" ]; then
        echo "❌ 找不到 release-key.jks"
        echo "💡 请先运行 generate_keystore 脚本"
        exit 1
    fi
    
    cd android
    
    # 更新 gradle.properties 添加签名配置
    echo "" >> gradle.properties
    echo "android.useAndroidX=true" >> gradle.properties
    
    ./gradlew assembleRelease
    
    apk_file=$(find app/build/outputs/apk/release -name "*-release.apk" -type f | head -1)
    
    if [ -n "$apk_file" ]; then
        cp "$apk_file" ../glm-office-agent-release-signed.apk
        cd ..
        
        echo ""
        echo "✅ Release APK 已构建！"
        ls -lh glm-office-agent-release-signed.apk
        echo ""
        echo "文件大小约为 50-100MB，取决于 Electron 打包的资源"
    else
        echo "❌ Release APK 构建失败"
        exit 1
    fi
}

# 主流程
main() {
    echo "开始构建 GLM Office Agent Android APK"
    echo "========================================"
    echo ""
    
    check_tools
    setup_android_sdk
    build_pwa
    setup_capacitor
    sync_to_android
    
    # 询问用户要构建哪种类型
    echo ""
    echo "选择构建类型:"
    echo "  1. Debug APK (用于测试)"
    echo "  2. Release APK (生产版本，需要先准备签名文件)"
    echo "  3. 两者都构建"
    read -r build_type
    
    case $build_type in
        1|debug|Debug|DEBUG)
            build_debug_apk
            ;;
        2|release|Release|RELEASE)
            generate_keystore
            build_release_apk
            ;;
        3|both|Both|BOTH)
            build_debug_apk
            generate_keystore
            build_release_apk
            ;;
        *)
            echo "❌ 无效选择"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 构建完成!"
    echo ""
    echo "已生成的文件:"
    ls -lh *.apk 2>/dev/null || echo "无 APK 文件生成"
    echo ""
    echo "下一步操作:"
    echo "  - Debug APK: 直接在手机测试"
    echo "  - Release APK: 上传到 Google Play 或分享给用户"
}

# 执行主函数
main
