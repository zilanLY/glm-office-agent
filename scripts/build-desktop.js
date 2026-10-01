#!/usr/bin/env node
/**
 * Desktop App Build Script for GLM Office Agent
 * This script packages the desktop application into an executable
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Starting Desktop App Build Process...\n');

// Step 1: Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
  console.log('✅ Clean complete\n');
} catch (error) {
  console.warn('⚠️ Warning during cleanup:', error.message);
}

// Step 2: Build renderer
console.log('📦 Building renderer (React)...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Renderer build complete\n');
} catch (error) {
  console.error('❌ Renderer build failed:', error.message);
  process.exit(1);
}

// Step 3: Build main process
console.log('🖥️ Building main process (TypeScript)...');
try {
  execSync('tsc --project tsconfig.node.json', { stdio: 'inherit' });
  console.log('✅ Main process build complete\n');
} catch (error) {
  console.error('❌ Main process build failed:', error.message);
  process.exit(1);
}

// Step 4: Copy resources
console.log('📁 Copying resources...');
try {
  const resourcesDir = path.join(__dirname, 'resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir);
  }
  
  // Copy binary files
  const binaries = [
    { src: '../GLM-Free-API/glm-free-api', dest: 'bin/glm-free-api' },
    { src: '../GLM-Free-API/glm-free-api.exe', dest: 'bin/glm-free-api.exe' }
  ];
  
  binaries.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
      console.log(`✅ Copied ${dest}`);
    }
  });
  console.log('✅ Resources copied\n');
} catch (error) {
  console.warn('⚠️ Warning copying resources:', error.message);
}

// Step 5: Package with electron-builder
console.log('📱 Packaging with electron-builder...');
try {
  execSync('npm run package', { stdio: 'inherit' });
  console.log('✅ Packaging complete!\n');
} catch (error) {
  console.error('❌ Packaging failed:', error.message);
  process.exit(1);
}

// Step 6: Verify outputs
console.log('🔍 Verifying outputs...');
const releaseDir = path.join(__dirname, 'release');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir);
  console.log('\n📦 Generated packages:');
  files.forEach(file => {
    const filePath = path.join(releaseDir, file);
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`   • ${file} (${sizeMB} MB)`);
  });
  console.log('\n✅ Desktop app build completed successfully!');
  console.log(`📂 Packages are in: ${releaseDir}\n`);
} else {
  console.warn('⚠️ Release directory not found');
}
