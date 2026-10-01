const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 确保 bin 目录存在
const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('🔧 开始编译 GLM-Free-API...');

try {
  // 检查上游项目是否存在（两个可能的路径）
  let upstreamDir = path.join(__dirname, '..', 'GLM-Free-API-src');
  const legacyDir = path.join(__dirname, '..', 'GLM-Free-API');
  
  if (!fs.existsSync(upstreamDir) && fs.existsSync(legacyDir)) {
    upstreamDir = legacyDir;
  }
  
  if (fs.existsSync(upstreamDir)) {
    console.log('✅ 找到上游项目，开始编译...');
    
    // 切换到上游目录
    process.chdir(upstreamDir);
    
    // 执行 go build（注意输出路径是相对于上游目录的 ../bin/）
    const commands = [
      'go mod tidy',
      'go build -trimpath -ldflags="-s -w" -gcflags="all=-l=4" -o ../bin/glm-free-api-linux main.go'
    ];
    
    for (const cmd of commands) {
      console.log(`运行：${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    }
    
    console.log('✅ GLM-Free-API 编译成功！');
  } else {
    console.warn('⚠️ 未找到上游项目 GLM-Free-API');
    console.warn('请先克隆：git clone https://github.com/izaart95-jpg/GLM-Free-API.git');
    console.warn('或者手动下载二进制文件放到 bin/ 目录');
  }
} catch (error) {
  console.error('❌ 编译失败:', error.message);
  process.exit(1);
}
