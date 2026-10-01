import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './api-shim'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA：仅在 https（Web 部署）环境注册 Service Worker；Electron file:// 下自动跳过
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

