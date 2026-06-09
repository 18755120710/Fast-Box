import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, AlertTriangle, X } from 'lucide-react'

interface PackageStats {
  name: string
  displayName: string
  description: string
  defaultVersion: string
  homepage: string
  license: string
  versionsCount: number
  platforms: string[]
  error?: string
}

interface PackageListProps {
  onEditPackage: (name: string) => void
}

export default function PackageList({ onEditPackage }: PackageListProps) {
  const [packages, setPackages] = useState<PackageStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPackage, setNewPackage] = useState({
    name: '',
    displayName: '',
    description: '',
    homepage: '',
    license: 'MIT',
    defaultVersion: '1.0.0'
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/packages')
      if (res.ok) {
        const data = await res.json()
        setPackages(data)
      }
    } catch (err) {
      console.error('Failed to load packages:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除软件包 "${name}" 吗？此操作无法撤销。`)) return

    try {
      const res = await fetch(`/api/packages/${name}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchPackages()
      } else {
        const err = await res.json()
        alert(`删除失败: ${err.error}`)
      }
    } catch (e: any) {
      alert(`删除出错: ${e.message}`)
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPackage.name.trim()) {
      setErrorMsg('请输入软件英文标识')
      return
    }

    const cleanName = newPackage.name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')
    if (!cleanName) {
      setErrorMsg('标识只能包含字母、数字、中划线和下划线')
      return
    }

    try {
      setSubmitting(true)
      setErrorMsg('')
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPackage,
          name: cleanName
        })
      })

      if (res.ok) {
        setShowAddModal(false)
        setNewPackage({
          name: '',
          displayName: '',
          description: '',
          homepage: '',
          license: 'MIT',
          defaultVersion: '1.0.0'
        })
        fetchPackages()
        onEditPackage(cleanName)
      } else {
        const err = await res.json()
        setErrorMsg(err.error || '创建失败，请重试')
      }
    } catch (e: any) {
      setErrorMsg(`请求错误: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">软件包配置中心</h2>
          <p className="text-slate-500 text-sm mt-1">管理并编写各个开发环境套件的版本规则与校验规则</p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true)
            setErrorMsg('')
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>添加新软件</span>
        </button>
      </div>

      {/* List Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm font-medium">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
            正在加载软件包...
          </div>
        ) : packages.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <span className="text-4xl">📦</span>
            <p className="mt-4 font-semibold text-slate-800 text-base">暂无软件包</p>
            <p className="text-xs text-slate-500 mt-1">点击右上角按钮以创建第一个软件包配方</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">软件名称</th>
                <th className="px-6 py-4">英文标识 (ID)</th>
                <th className="px-6 py-4">默认版本</th>
                <th className="px-6 py-4">预设版本数</th>
                <th className="px-6 py-4">支持平台</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {packages.map((pkg) => (
                <tr key={pkg.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    <div className="flex flex-col">
                      <span>{pkg.displayName}</span>
                      <span className="text-xs font-normal text-slate-500 mt-0.5 max-w-[200px] truncate">
                        {pkg.description || '暂无描述'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 bg-slate-50/30">
                    {pkg.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
                      v{pkg.defaultVersion}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {pkg.versionsCount} 个
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {pkg.platforms && pkg.platforms.length > 0 ? (
                        pkg.platforms.map((plat) => (
                          <span
                            key={plat}
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200"
                          >
                            {plat}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">无平台配置</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEditPackage(pkg.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="编辑配置"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="删除软件"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-bold text-slate-900 text-lg">添加新软件包</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  英文标识 (ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: golang, python, rust"
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">只能包含小写字母、数字、中划线及下划线，作为文件名。</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  软件显示名称 (中文) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: Go 编译器, Python"
                  value={newPackage.displayName}
                  onChange={(e) => setNewPackage({ ...newPackage, displayName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  软件简介
                </label>
                <textarea
                  placeholder="简洁描述该开发环境的用途"
                  value={newPackage.description}
                  onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none placeholder:text-slate-400 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    默认初始版本
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1.0.0"
                    value={newPackage.defaultVersion}
                    onChange={(e) => setNewPackage({ ...newPackage, defaultVersion: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    开源许可证
                  </label>
                  <input
                    type="text"
                    required
                    value={newPackage.license}
                    onChange={(e) => setNewPackage({ ...newPackage, license: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  官方网站 Url
                </label>
                <input
                  type="text"
                  placeholder="https://example.org"
                  value={newPackage.homepage}
                  onChange={(e) => setNewPackage({ ...newPackage, homepage: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-rose-500 text-xs bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg mt-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {submitting && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>}
                  <span>创建并打开编辑器</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
