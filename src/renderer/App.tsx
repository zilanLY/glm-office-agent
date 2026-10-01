import React, { useEffect, useState, useCallback } from 'react'
import { 
  IconSettings, 
  IconTool, 
  IconSparkles, 
  IconHistory,
  IconRefresh,
  IconCheckCircle,
  IconAlertCircle,
  IconXCircle,
  IconPlus,
  IconPlay,
  IconMenu
} from './components/Icons'

interface Tool {
  name: string
  description: string
  parameters?: any
}

interface GLMStatus {
  status: 'running' | 'error' | 'stopped'
  message: string
}

interface RequestStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
}

const App: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([])
  const [glmStatus, setGlmStatus] = useState<GLMStatus>({
    status: 'stopped',
    message: '未启动'
  })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tools' | 'history'>('dashboard')
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showWelcome, setShowWelcome] = useState(true)

  // 加载工具列表
  const loadTools = useCallback(async () => {
    try {
      const toolList = await window.electronAPI.getToolList()
      setTools(toolList)
    } catch (error) {
      console.error('加载工具失败:', error)
    }
  }, [])

  // 获取请求统计
  const loadStats = useCallback(async () => {
    try {
      const stats = await window.electronAPI.getRequestStats()
      setRequestStats(stats)
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }, [])

  useEffect(() => {
    loadTools()
    
    if (window.electronAPI) {
      window.electronAPI.onGLMStatusChanged((status: any) => {
        setGlmStatus(status)
        if (status.status === 'running') {
          setShowWelcome(false)
        }
      })
      
      // 每 5 秒刷新统计
      const interval = setInterval(loadStats, 5000)
      return () => clearInterval(interval)
    }
  }, [loadTools, loadStats])

  const testToolCall = async (toolName: string) => {
    try {
      const result = await window.electronAPI.testToolCall({
        name: toolName,
        args: {}
      })
      alert(`工具调用结果:\n${JSON.stringify(result, null, 2)}`)
    } catch (error) {
      alert(`错误：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 服务状态卡片 */}
      <div className={`card status-card ${glmStatus.status}`}>
        <div className="card-header">
          <h2 className="card-title">🤖 GLM-Free-API 服务</h2>
          <span className="badge" style={{ backgroundColor: getStatusColor(glmStatus.status) }}>
            {getStatusIcon(glmStatus.status)} {glmStatus.status.toUpperCase()}
          </span>
        </div>
        
        <div className="card-body">
          <p className="status-message">{glmStatus.message}</p>
          
          {requestStats && (
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">总请求数</div>
                <div className="stat-value">{requestStats.totalRequests}</div>
              </div>
              <div className="stat-item success">
                <div className="stat-label">成功</div>
                <div className="stat-value">{requestStats.successfulRequests}</div>
              </div>
              <div className="stat-item error">
                <div className="stat-label">失败</div>
                <div className="stat-value">{requestStats.failedRequests}</div>
              </div>
              <div className="stat-item info">
                <div className="stat-label">平均响应</div>
                <div className="stat-value">{(requestStats.avgResponseTime / 1000).toFixed(2)}s</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快速功能入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card feature-card" onClick={() => setActiveTab('tools')}>
          <IconTool className="feature-icon" />
          <h3>管理工具</h3>
          <p>查看和测试所有系统工具</p>
          <span className="feature-count">{tools.length} 个工具</span>
        </div>
        
        <div className="card feature-card" onClick={() => setActiveTab('history')}>
          <IconHistory className="feature-icon" />
          <h3>运行历史</h3>
          <p>查看工具调用记录</p>
          {requestStats && (
            <span className="feature-count">最近 {requestStats.totalRequests} 次</span>
          )}
        </div>
        
        <div className="card feature-card">
          <IconSparkles className="feature-icon" />
          <h3>智能提示</h3>
          <p>AI 推荐最合适的工具</p>
          <span className="feature-badge">Beta</span>
        </div>
      </div>
    </div>
  )

  const renderTools = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">📋 系统工具 ({tools.length})</h2>
        <button className="btn primary" onClick={() => alert('添加新工具功能开发中...')}>
          <IconPlus size={16} /> 添加工具
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tools.map((tool, index) => (
          <div key={index} className="card hover-card" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="card-header" onClick={() => setSelectedTool(tool)}>
              <div className="flex items-center gap-3">
                <div className="icon-box">🛠️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{tool.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{tool.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn icon-btn" 
                  onClick={(e) => { e.stopPropagation(); testToolCall(tool.name) }}
                  title="测试工具"
                >
                  <IconPlay size={14} />
                </button>
                <button 
                  className="btn icon-btn" 
                  onClick={(e) => { e.stopPropagation(); /* 编辑逻辑 */ }}
                  title="编辑"
                >
                  ✏️
                </button>
              </div>
            </div>
            
            <div className="card-body">
              {tool.parameters && (
                <div className="parameters-section">
                  <h4 className="text-sm font-medium mb-2">参数定义:</h4>
                  <pre className="code-preview bg-gray-50 p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(tool.parameters, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="mt-4 pt-4 border-t">
                <button 
                  className="btn primary w-full"
                  onClick={() => testToolCall(tool.name)}
                >
                  🚀 立即测试
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTool && (
        <ToolDetailModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  )

  const renderHistory = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📜 运行历史记录</h2>
      
      <div className="card">
        {requestStats ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">时间</th>
                  <th className="text-left py-3 px-4">工具</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">响应时间</th>
                  <th className="text-left py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Mock data for demo */}
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">刚刚</td>
                    <td className="py-3 px-4 font-medium">search_files</td>
                    <td className="py-3 px-4">
                      <span className="badge success">✓ 成功</span>
                    </td>
                    <td className="py-3 px-4 text-sm">0.85s</td>
                    <td className="py-3 px-4">
                      <button className="btn icon-btn" title="查看详情">👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <IconHistory size={48} className="empty-icon" />
            <p>暂无历史记录</p>
          </div>
        )}
      </div>
    </div>
  )

  if (showWelcome && glmStatus.status !== 'running') {
    return <WelcomeScreen onDismiss={() => setShowWelcome(false)} />
  }

  return (
    <div className={`app-container ${theme}`}>
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="sidebar-title">🦞 GLM Office Agent</h1>
          </div>
          
          <nav className="sidebar-nav">
            <NavButton 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<IconSparkles size={18} />}
            >
              仪表盘
            </NavButton>
            <NavButton 
              active={activeTab === 'tools'} 
              onClick={() => setActiveTab('tools')}
              icon={<IconTool size={18} />}
            >
              工具管理
            </NavButton>
            <NavButton 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')}
              icon={<IconHistory size={18} />}
            >
              运行历史
            </NavButton>
          </nav>

          <div className="sidebar-footer">
            <div className="version-info">v1.0.0</div>
            <button className="btn icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`main-content ${!sidebarOpen ? 'expanded' : ''}`}>
        {/* Header */}
        <header className="top-bar">
          <button className="btn icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <IconMenu size={20} />
          </button>
          
          <div className="header-right">
            <button 
              className="btn icon-btn" 
              onClick={loadTools}
              title="刷新"
            >
              <IconRefresh size={18} />
            </button>
            
            <div className="status-indicator" style={{ backgroundColor: getStatusColor(glmStatus.status) }}>
              <span className="pulse"></span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="content-area">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'tools' && renderTools()}
          {activeTab === 'history' && renderHistory()}
        </div>
      </main>
    </div>
  )
}

// Helper Components
const NavButton: React.FC<{
  children: React.ReactNode
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}> = ({ children, icon, active, onClick }) => (
  <button
    className={`nav-button ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="nav-icon">{icon}</span>
    <span className="nav-text">{children}</span>
  </button>
)

const ToolDetailModal: React.FC<{ tool: Tool; onClose: () => void }> = ({ tool, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>{tool.name}</h2>
        <button className="btn icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <p className="description">{tool.description}</p>
        {tool.parameters && (
          <>
            <h3>Parameters</h3>
            <pre className="json-code">{JSON.stringify(tool.parameters, null, 2)}</pre>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn primary" onClick={() => { testToolCall(tool.name); onClose(); }}>
          测试工具
        </button>
        <button className="btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  </div>
)

const WelcomeScreen: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <div className="welcome-screen">
    <div className="welcome-content">
      <h1 className="welcome-title">🦞 GLM Office Agent</h1>
      <p className="welcome-subtitle">免登录桌面办公智能体</p>
      
      <div className="welcome-features">
        <FeatureItem icon="🚀" title="免登录使用" desc="JS 模拟点击，无需官方账号" />
        <FeatureItem icon="🛠️" title="工具调用" desc="内置多个办公自动化工具" />
        <FeatureItem icon="🔒" title="本地部署" desc="所有数据存储在本地" />
      </div>
      
      <button className="btn primary btn-lg" onClick={onDismiss}>
        开始使用
      </button>
    </div>
  </div>
)

const FeatureItem: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="feature-item">
    <span className="feature-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
)

// Helper functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'running': return '#10b981' // green
    case 'error': return '#ef4444' // red
    default: return '#9ca3af' // gray
  }
}

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'running': return '✅'
    case 'error': return '❌'
    default: return '⚪'
  }
}

export default App
