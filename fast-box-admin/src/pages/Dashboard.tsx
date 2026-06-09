import { useState, useEffect } from 'react'
import { Box, Network, Settings, ExternalLink, ArrowRight, ShieldAlert } from 'lucide-react'

interface DashboardProps {
  onNavigateToPackages: () => void
  onNavigateToMirrors: () => void
}

interface PackageStats {
  name: string
  displayName: string
  versionsCount: number
  platforms: string[]
}

export default function Dashboard({ onNavigateToPackages, onNavigateToMirrors }: DashboardProps) {
  const [packages, setPackages] = useState<PackageStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/packages')
      .then((res) => res.json())
      .then((data) => {
        setPackages(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err)
        setLoading(false)
      })
  }, [])

  const totalPackages = packages.length
  const totalVersions = packages.reduce((sum, pkg) => sum + (pkg.versionsCount || 0), 0)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">控制台仪表盘</h2>
          <p className="text-slate-500 text-sm mt-1">查看软件源以及客户端包配方的配置概览</p>
        </div>
        <div className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          本地环境: <span className="text-slate-800 font-semibold">Development</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-slate-500 text-sm font-medium">配置软件总数</span>
            <h3 className="text-4xl font-bold text-slate-900 mt-2">{loading ? '...' : totalPackages}</h3>
            <p className="text-xs text-slate-400 mt-2">支持多版本动态切换</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-700">
            <Box size={24} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-slate-500 text-sm font-medium">预设版本总数</span>
            <h3 className="text-4xl font-bold text-slate-900 mt-2">{loading ? '...' : totalVersions}</h3>
            <p className="text-xs text-slate-400 mt-2">支持独立下载及哈希校验</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-700">
            <Settings size={24} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-slate-500 text-sm font-medium">镜像及注册表</span>
            <h3 className="text-4xl font-bold text-slate-900 mt-2">2 套</h3>
            <p className="text-xs text-slate-400 mt-2">包含官方与第三方华为云源</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-700">
            <Network size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-slate-900 text-lg mb-2">快速管理入口</h4>
            <p className="text-slate-500 text-sm mb-6">
              可以在此处对注册表中的软件进行维护，支持新增主流开发工具、编辑已有镜像、添加新版本。
            </p>
            <div className="space-y-3">
              <button
                onClick={onNavigateToPackages}
                className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📦</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">维护开发套件</p>
                    <p className="text-xs text-slate-500">添加 Go、Python 或配置 Node 属性</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-900 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={onNavigateToMirrors}
                className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚡</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">批量配置镜像源</p>
                    <p className="text-xs text-slate-500">一键修改所有包的下载及后置代理源</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-900 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>官方源文档: https://nodejs.org/</span>
            <a href="https://nodejs.org/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-600">
              访问官网 <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* System Info & Guide */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm border border-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">架构说明</span>
              <span className="text-slate-400 text-xs">Vibe Architecture</span>
            </div>
            <h4 className="font-semibold text-white text-lg mb-2">Fast Box 系统工作原理</h4>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Fast Box 客户端是一个极速轻量的多平台环境管理器。其核心通过解析 `fast-box-registry/packages/`
              下的 JSON 配方文件来获知支持的版本及各平台的包下载哈希。
            </p>
            <div className="border border-slate-800 rounded-xl p-3 bg-slate-950 font-mono text-xs text-slate-400 space-y-1">
              <p className="text-emerald-400">// JSON 配方文件路径</p>
              <p>fast-box-registry/packages/*.json</p>
              <p className="text-emerald-400 mt-2">// 客户端下载并放置在此</p>
              <p>~/.fastbox/packages/&amp;name&amp;/&amp;version&amp;</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
            <ShieldAlert size={14} className="shrink-0" />
            <span>修改配置文件后，客户端会自动热重载或可以通过手动刷新以同步配置。</span>
          </div>
        </div>
      </div>
    </div>
  )
}
