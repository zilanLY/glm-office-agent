# GLM Office Agent - 手机版设计方案

## 🎯 项目概述

基于 WorkBuddy 的远程访问理念，打造一个**移动端友好的浏览器客户端**，用户可以通过手机/平板通过局域网或互联网访问桌面端的完整功能。

---

## 📱 技术架构

### 双端架构设计

```
┌─────────────────────────────────────┐
│     移动端 (Browser)                 │
│  ┌────────────────────────────────┐ │
│  │  React Mobile UI               │ │
│  │  - PWA 支持                     │ │
│  │  - Touch 优化                   │ │
│  │  - Responsive Design          │ │
│  └───────────────┬────────────────┘ │
└──────────────────┼──────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────┘
│   桌面端 (Main App)
│   ┌──────────────────────────────┐ │
│   │ Bridge Service               │ │
│   │ - Proxy all API calls         │ │
│   │ - WebSocket real-time push    │ │
│   │ - Authentication & Security   │ │
│   └──────────────────────────────┘ │
└────────────────────────────────────┘
```

---

## 🏗️ 核心实现模块

### Module 1: 移动端专用 Layout (`src/mobile/MobileLayout.tsx`)

```tsx
import React, { useState } from 'react';
import { TabBar, BottomNavigation } from './components/TabBar';
import { Header } from './components/Header';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="mobile-layout">
      {/* 顶部状态栏 */}
      <Header 
        title="GLM Office"
        rightContent={<StatusIndicator />}
        showMenuBtn={true}
        onMenuClick={() => setShowMenu(true)}
      />

      {/* 主内容区 - 可滚动 */}
      <main className="mobile-content">
        <div className="content-wrapper">
          {children}
        </div>
        
        {/* Pull to Refresh Indicator */}
        <PullToRefresh onRefresh={() => {/* refresh logic */}} />
      </main>

      {/* 底部导航 */}
      <TabBar 
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* 侧滑菜单 */}
      {showMenu && (
        <SlideMenu 
          onClose={() => setShowMenu(false)}
          onLogout={() => {/* logout */}}
        />
      )}
    </div>
  );
};

// 移动端专属样式
const styles = `
.mobile-layout {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.mobile-content {
  flex: 1;
  position: relative;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS smooth scroll */
}

.content-wrapper {
  padding: 1rem;
  padding-bottom: 5rem; /* 为 bottom nav 留空间 */
}

/* 底部固定导航 */
.TabBar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  z-index: 100;
}

/* 安全区域适配（iPhone notch） */
@media (safe-area-inset-bottom: 20px) {
  .TabBar {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
`;
```

---

### Module 2: 响应式 Typography (`src/mobile/Typography.ts`)

```typescript
// 基于 Mobile First 的设计系统
export const mobileTypography = {
  // 小屏字体 (base 14px)
  base: '14px',
  
  // Heading scale for mobile
  h1: { fontSize: '24px', lineHeight: '32px' },
  h2: { fontSize: '20px', lineHeight: '28px' },
  h3: { fontSize: '18px', lineHeight: '24px' },
  h4: { fontSize: '16px', lineHeight: '22px' },
  
  // Body text sizes
  bodyLarge: { fontSize: '16px', lineHeight: '24px' },
  bodyMedium: { fontSize: '14px', lineHeight: '20px' },
  bodySmall: { fontSize: '12px', lineHeight: '16px' },
  
  // Button sizes
  buttonMd: { fontSize: '16px', padding: '12px 24px' },
  
  // Input heights (touch targets)
  inputHeight: '44px',  // Minimum 44x44 touch target
  
  // Spacing scale
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};

// Utility class generation
export function createMobileStyles() {
  return `
    .text-base { font-size: ${mobileTypography.base}; }
    
    .text-h1 { 
      font-size: ${mobileTypography.h1.fontSize}; 
      line-height: ${mobileTypography.h1.lineHeight};
    }
    
    .text-h2 { 
      font-size: ${mobileTypography.h2.fontSize}; 
      line-height: ${mobileTypography.h2.lineHeight};
    }
    
    .input-md {
      height: ${mobileTypography.inputHeight};
      min-height: ${mobileTypography.inputHeight};
    }
  `;
}
```

---

### Module 3: 触摸友好组件库 (`src/mobile/components`)

#### Card 增强版 - 大点击区域
```tsx
// src/mobile/components/TapCard.tsx
import React from 'react';

interface TapCardProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export const TapCard: React.FC<TapCardProps> = ({ 
  onClick, 
  children, 
  className = '' 
}) => {
  return (
    <button
      className={`tap-card ${className}`}
      onClick={onClick}
      style={{ '--tap-card-padding': '16px' } as React.CSSProperties}
    >
      <div className="tap-card-inner">
        {children}
      </div>
      
      {/* Invisible tap area enhancement */}
      <span className="tap-enhancement" aria-hidden="true" />
    </button>
  );
};

const styles = `
.tap-card {
  position: relative;
  width: 100%;
  min-height: 56px; /* Minimum touch target height */
  padding: calc(var(--tap-card-padding));
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  
  /* Hide the actual button appearance */
  appearance: none;
  -webkit-appearance: none;
}

.tap-card:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
}

.tap-enhancement {
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  /* Invisible tap zone expansion */
}
`;
```

#### Modal 优化 - 从底部弹出
```tsx
// src/mobile/components/MobileModal.tsx
export const MobileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="mobile-modal-overlay">
      {/* Backdrop with tap-to-close */}
      <div 
        className="modal-backdrop"
        onClick={onClose}
        style={{ '--backdrop-opacity': '0.5' } as React.CSSProperties}
      />
      
      {/* Slide-up modal sheet */}
      <div className="modal-sheet animate-slide-up">
        <div className="modal-header">
          <button className="close-btn" onClick={onclose}>
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          {children}
        </div>
        
        {/* Home indicator area for iPhone */}
        <div className="home-indicator" />
      </div>
    </div>
  );
};

const styles = `
.mobile-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  opacity: var(--backdrop-opacity);
  transition: opacity 0.3s ease;
}

.modal-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  
  /* Prevent swipe-down gesture interference */
  touch-action: pan-y;
}

.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.home-indicator {
  height: 20px;
  margin: 0 auto;
  width: 40px;
  background: #e5e7eb;
  border-radius: 4px;
  opacity: 0.3;
}
`;
```

---

### Module 4: 下拉刷新 (`src/mobile/components/PullToRefresh.tsx`)

```tsx
import React, { useRef, useEffect } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  threshold = 80,
}) => {
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const hasReachedThreshold = useRef<boolean>(false);
  const refreshContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = refreshContainerRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger at top of page
      if (element.scrollTop > 0) return;
      
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY <= 0) return;
      
      currentY.current = deltaY;
      const progress = Math.min(deltaY / threshold, 1);
      
      // Visual feedback
      if (refreshContainerRef.current) {
        refreshContainerRef.current.style.transform = `translateY(${deltaY}px)`;
        refreshContainerRef.current.style.opacity = String(progress);
      }
      
      // Trigger when threshold reached
      if (deltaY >= threshold && !hasReachedThreshold.current) {
        hasReachedThreshold.current = true;
        onStartRefresh();
      }
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      isDragging.current = false;
      
      // Release before threshold - cancel
      if (currentY.current < threshold) {
        reset();
        return;
      }
      
      // Released after threshold - refresh
      if (hasReachedThreshold.current) {
        await onRefresh();
        reset();
      }
    };

    const reset = () => {
      if (refreshContainerRef.current) {
        refreshContainerRef.current.style.transition = 'transform 0.3s ease';
        refreshContainerRef.current.style.transform = 'translateY(0)';
        refreshContainerRef.current.style.opacity = '1';
      }
      
      setTimeout(() => {
        if (refreshContainerRef.current) {
          refreshContainerRef.current.style.transition = '';
        }
      }, 300);
      
      hasReachedThreshold.current = false;
      startY.current = 0;
      currentY.current = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold]);

  const onStartRefresh = () => {
    console.log('🔄 Refresh started...');
    // Add loading spinner or visual feedback here
  };

  return <div ref={refreshContainerRef} />;
};
```

---

### Module 5: 桥接服务 (`src/main/services/BridgeService.ts`)

```typescript
// 桌面端提供的远程访问接口
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

export class BridgeService {
  private app: express.Express;
  private port: number = 8081;
  private authToken: string;

  constructor() {
    this.app = express();
    this.authToken = this.generateSecureToken();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));
    
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/wb/ping', (req, res) => {
      res.json({ bridge: true, version: '1.0.0' });
    });

    // SSE Events Stream (real-time updates)
    this.app.get('/wb/events', this.authenticate, (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        res.write(`data: {"ch": "heartbeat", "payload": {}}\n\n`);
      }, 30000);

      // Listen to GLM service events and forward to client
      const eventHandler = (eventData: any) => {
        res.write(`data: {"ch": "glm-status", "payload": ${JSON.stringify(eventData)}}\n\n`);
      };

      // Subscribe to events
      const off = subscribeToGLMEvents(eventHandler);
      
      // Cleanup on disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        off();
      });
    });

    // API Call Endpoint (proxied requests)
    this.app.post('/wb/call/:channel', this.authenticate, async (req, res) => {
      const { channel, args } = req.body;
      const { token } = req.headers;

      try {
        const result = await dispatchToMainProcess(channel, args);
        res.json({ ok: true, data: result });
      } catch (error) {
        res.json({ ok: false, error: error.message });
      }
    });

    // Start server
    this.app.listen(this.port, () => {
      console.log(`📱 Bridge service running on port ${this.port}`);
      console.log(`🔑 Auth Token: ${this.authToken.substring(0, 20)}...`);
    });
  }

  private authenticate(req: express.Request, res: express.Response, next: Function) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || token !== this.authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  }

  private generateSecureToken(): string {
    return jwt.sign(
      { type: 'bridge-access', exp: Math.floor(Date.now() / 1000) + 86400 * 30 },
      process.env.JWT_SECRET || 'fallback-secret-key'
    );
  }

  getAuthToken(): string {
    return this.authToken;
  }
}
```

---

### Module 6: 配对流程 (`src/mobile/pages/PairingPage.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { transport } from '../lib/api';

export const PairingPage: React.FC = () => {
  const [host, setHost] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePairing = async () => {
    if (!host.trim()) {
      setErrorMessage('请输入桌面端地址');
      return;
    }

    setStatus('checking');
    
    try {
      const isValid = await transport.ping(host, token);
      
      if (isValid) {
        transport.setPair(host, token);
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/app';
        }, 1000);
      } else {
        setErrorMessage('无法连接到桌面端，请检查地址是否正确');
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage('网络连接失败，请稍后重试');
      setStatus('error');
    }
  };

  const getQRCodeURL = (): string => {
    // Generate QR code with pairing info
    const domain = window.location.origin;
    return `${domain}/pair?host=${encodeURIComponent(host)}`;
  };

  return (
    <div className="pairing-page">
      <h1 className="page-title">📱 连接桌面端</h1>
      <p className="page-subtitle">输入桌面端运行电脑的地址</p>

      <div className="input-group">
        <label htmlFor="host-input">桌面端地址</label>
        <input
          id="host-input"
          type="text"
          placeholder="http://192.168.x.x:8081"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          autoComplete="off"
        />
        <small>通常在局域网内，格式：http://IP:端口</small>
      </div>

      <div className="input-group">
        <label htmlFor="token-input">访问令牌（可选）</label>
        <input
          id="token-input"
          type="password"
          placeholder="如果不设置则留空"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <small>桌面端会显示令牌供你复制</small>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          ⚠️ {errorMessage}
        </div>
      )}

      <button 
        className="btn btn-primary btn-lg"
        onClick={handlePairing}
        disabled={status === 'checking'}
      >
        {status === 'checking' ? '⏳ 连接中...' : '🔗 开始连接'}
      </button>

      {/* Quick pairing via QR */}
      <div className="qr-pairing">
        <h3>快速配对</h3>
        <p>用电脑扫码快速获取配置</p>
        {host && (
          <div className="qr-code-container">
            {/* QR Code would be rendered here */}
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getQRCodeURL())}`}
              alt="Pairing QR Code"
            />
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="help-section">
        <h4>💡 找不到桌面端地址？</h4>
        <ol>
          <li>在电脑上打开 GLM Office Agent</li>
          <li>查看右下角是否显示 "📱 手机端连接"</li>
          <li>复制显示的地址和令牌</li>
        </ol>
      </div>
    </div>
  );
};

const styles = `
.pairing-page {
  padding: 1.5rem;
  max-width: 480px;
  margin: 0 auto;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--text-muted);
  margin-bottom: 2rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.input-group input {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 1rem;
  background: var(--bg-primary);
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.btn-lg {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
}

.qr-pairing {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  text-align: center;
}

.qr-code-container img {
  margin-top: 1rem;
  border-radius: 8px;
}

.help-section {
  margin-top: 2rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.help-section ol {
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  color: var(--text-secondary);
}
`;
```

---

### Module 7: PWA Manifest (`public/manifest.json`)

```json
{
  "name": "GLM Office Agent",
  "short_name": "GLM Office",
  "description": "免登录桌面办公智能体 - 移动版",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/maskable-icon.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "zh-CN",
  "prefer_related_applications": false
}
```

---

## 📋 实施路线图

### Phase 1: 基础移动端适配 (Week 1)

- [ ] 创建 MobileLayout 组件
- [ ] 实现响应式 CSS Grid/Flexbox
- [ ] 优化 Touch 点击区域 (最小 44x44)
- [ ] 添加 Pull to Refresh
- [ ] 测试主流移动设备

### Phase 2: 桥接服务开发 (Week 2)

- [ ] 实现 BridgeService
- [ ] 完成 Pairing 配对流程
- [ ] 添加 JWT 认证
- [ ] 实现 SSE 实时推送
- [ ] 安全性加固（CORS、速率限制）

### Phase 3: 移动端优化 (Week 3)

- [ ] 集成 PWA manifest
- [ ] 实现离线缓存 (Service Worker)
- [ ] 添加加载状态骨架屏
- [ ] 优化图片懒加载
- [ ] 键盘遮挡处理

### Phase 4: 性能优化 (Week 4)

- [ ] Bundle splitting (代码分割)
- [ ] Dynamic imports (按需加载)
- [ ] Image optimization (WebP format)
- [ ] Network request batching
- [ ] Lighthouse 分数优化 (>90)

---

## 🔧 开发工具推荐

### 1. Chrome DevTools Device Mode
```bash
# 开启设备模拟
Chrome > F12 > Toggle device toolbar > Select device

# 测试网络条件
Network tab > Online -> throttling profiles
```

### 2. Responsively App
多设备同时预览工具，支持同步滚动、开发者工具联动。

### 3. Puppeteer Mobile Emulation
E2E 测试脚本示例：
```javascript
const browser = await puppeteer.launch();
const page = await browser.newPage();

// 模拟 iPhone XR
await page.emulate(puppeteer.devices['iPhone XR']);

// 截图验证布局
await page.screenshot({ path: 'mobile-test.png' });
```

### 4. BrowserStack / Sauce Labs
真实设备云测试平台，覆盖各品牌各型号设备。

---

## 📱 关键指标监控

### Mobile UX Metrics

| 指标 | Target | Current | Status |
|------|--------|---------|--------|
| **First Contentful Paint** | < 1.5s | - | 🎯 |
| **Time to Interactive** | < 3.5s | - | 🎯 |
| **Touch Response Delay** | < 100ms | - | 🎯 |
| **Scroll Smoothness** | 60fps | - | 🎯 |
| **Offline Capability** | Yes | No | 🎯 |

---

## 🎨 移动端 UI 规范

### 导航模式选择

1. **Bottom Tab Bar** - 适合主要功能切换
   - Dashboard, Tools, History
   
2. **Swipe Navigation** - 页面间横向滑动
   - 左滑返回，右滑前进

3. **Collapsible Headers** - 可收起标题栏
   - 节省垂直空间

4. **Full Screen Modals** - 全屏弹窗
   - 编辑、创建等深度操作

### 手势规范

| 手势 | 功能 | 说明 |
|------|------|------|
| **Tap** | 点击激活 | 标准操作，目标 44x44pt |
| **Long Press** | 上下文菜单 | 长按卡片 |
| **Swipe Left** | 删除/归档 | 向左滑动列表项 |
| **Swipe Right** | 返回 | 从边缘右滑 |
| **Pinch** | 缩放 | 不适用于本应用 |
| **Pull Down** | 刷新 | 下拉触发 |

---

## 🚀 上线前检查清单

### 功能性
- [ ] 所有核心功能正常
- [ ] 配对流程流畅
- [ ] 实时数据更新
- [ ] 离线可用状态提示

### 性能
- [ ] Lighthouse > 90 分
- [ ] 首屏加载 < 2 秒
- [ ] 无内存泄漏
- [ ] 电池消耗合理

### 兼容性
- [ ] iOS Safari 14+
- [ ] Android Chrome 80+
- [ ] Samsung Internet
- [ ] Firefox Mobile

### 无障碍性 (a11y)
- [ ] VoiceOver 支持
- [ ] 高对比度模式
- [ ] 键盘导航
- [ ] 文字大小调整

---

## 📊 预期效果

### Before vs After

**Before (仅 Desktop):**
- ❌ 无法远程使用
- ❌ 必须坐在电脑前
- ❌ 功能受限

**After (Desktop + Mobile):**
- ✅ 随时随地管理办公任务
- ✅ 扫描屏幕二维码快速配对
- ✅ 完整的跨平台体验
- ✅ 像原生 App 一样流畅

---

**版本**: v2.0 Mobile Edition  
**预计完成时间**: 4 周  
**优先级**: HIGH  

需要我开始实施哪个模块？我可以从 MobileLayout 或 BridgeService 开始！📱✨
