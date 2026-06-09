import { useState, useEffect } from 'react'
import { LayoutDashboard, Box, Network, RefreshCw } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import PackageList from './pages/PackageList'
import PackageEditor from './pages/PackageEditor'
import MirrorManager from './pages/MirrorManager'

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [editingPackageName, setEditingPackageName] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<'connected' | 'error' | 'checking'>('checking')

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setBackendStatus('checking')
      const res = await fetch('/api/packages')
      if (res.ok) {
        setBackendStatus('connected')
      } else {
        setBackendStatus('error')
      }
    } catch {
      setBackendStatus('error')
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-full shrink-0">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <span className="text-2xl">📦</span>
            <div>
              <h1 className="font-semibold text-slate-900 tracking-tight">Fast Box Admin</h1>
              <p className="text-xs text-slate-500 font-medium">配置与软件仓库管理</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => {
                setActiveTab('dashboard')
                setEditingPackageName(null)
              }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>仪表盘概览</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('packages')
                setEditingPackageName(null)
              }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'packages' || activeTab === 'package-editor'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Box size={18} />
              <span>软件包配置</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('mirrors')
                setEditingPackageName(null)
              }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'mirrors'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Network size={18} />
              <span>镜像源管理</span>
            </button>
          </nav>
        </div>

        {/* API connection status footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  backendStatus === 'connected' ? 'bg-emerald-400' : backendStatus === 'checking' ? 'bg-amber-400' : 'bg-rose-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  backendStatus === 'connected' ? 'bg-emerald-500' : backendStatus === 'checking' ? 'bg-amber-500' : 'bg-rose-500'
                }`}></span>
              </span>
              <span className="text-xs font-medium text-slate-600">
                {backendStatus === 'connected' ? '服务已连接' : backendStatus === 'checking' ? '正在连接...' : '服务未启动'}
              </span>
            </div>
            <button
              onClick={checkStatus}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              title="重新检查"
            >
              <RefreshCw size={14} className={backendStatus === 'checking' ? 'animate-spin' : ''} />
            </button>
          </div>
          {backendStatus === 'error' && (
            <p className="text-[10px] text-rose-500 mt-1.5 leading-normal">
              请确保在控制台后台目录下运行了 Express 服务 (`pnpm dev`)
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-50 overflow-y-auto min-w-0">
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigateToPackages={() => setActiveTab('packages')}
            onNavigateToMirrors={() => setActiveTab('mirrors')}
          />
        )}
        {activeTab === 'packages' && (
          <PackageList
            onEditPackage={(name) => {
              setEditingPackageName(name)
              setActiveTab('package-editor')
            }}
          />
        )}
        {activeTab === 'package-editor' && (
          <PackageEditor
            packageName={editingPackageName}
            onBack={() => {
              setActiveTab('packages')
              setEditingPackageName(null)
            }}
          />
        )}
        {activeTab === 'mirrors' && <MirrorManager />}
      </main>
    </div>
  )
}

export default App
