import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

// 性能优化：延迟加载 Monaco worker 配置
// Monaco 是最大的依赖，延迟到实际需要时再初始化
const initMonaco = () => import('./monacoWorker')

// 延迟加载主应用
const App = React.lazy(() => import('./App'))

// 轻量级骨架屏组件（在 App 加载期间显示）
function AppSkeleton() {
  return null // HTML 中已有骨架屏，这里返回 null 避免闪烁
}

// 启动应用
const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <React.Suspense fallback={<AppSkeleton />}>
      <App />
    </React.Suspense>
  </React.StrictMode>
)

// 空闲时预加载 Monaco
if ('requestIdleCallback' in window) {
  (window as any).requestIdleCallback(() => initMonaco(), { timeout: 2000 })
} else {
  setTimeout(initMonaco, 100)
}
