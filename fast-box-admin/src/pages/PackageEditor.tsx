import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Plus, Trash2, Globe, FileCode, CheckCircle2 } from 'lucide-react'

interface BinConfig {
  name: string
  relativePath: string
  windowsRelativePath?: string
}

interface PlatformDetail {
  os: string
  arch: string
  archiveType: string
  fileName: string
  officialUrl: string
  mirrorUrls: string[]
  sha256: string
  archiveRoot: string
}

interface VerifyConfig {
  command: string
  expectedPrefix?: string
}

interface VersionDetail {
  version: string
  channel?: string
  codename?: string
  platforms: Record<string, PlatformDetail>
  verify?: VerifyConfig[]
}

interface PackageRecipe {
  $schema?: string
  name: string
  displayName: string
  description?: string
  homepage?: string
  license?: string
  installMode: string
  managedInstallPath: string
  defaultVersion: string
  channels?: Record<string, string>
  versions: Record<string, VersionDetail>
  bins: BinConfig[]
  postInstall?: Record<string, any>
  activation?: Record<string, any>
  uninstall?: Record<string, any>
}

interface PackageEditorProps {
  packageName: string | null
  onBack: () => void
}

const SUPPORTED_PLATFORMS = [
  { id: 'macos-arm64', os: 'macos', arch: 'arm64', archiveType: 'tar.xz' },
  { id: 'macos-x64', os: 'macos', arch: 'x64', archiveType: 'tar.xz' },
  { id: 'windows-x64', os: 'windows', arch: 'x64', archiveType: 'zip' }
]

export default function PackageEditor({ packageName, onBack }: PackageEditorProps) {
  const [recipe, setRecipe] = useState<PackageRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'basic' | 'versions' | 'raw'>('basic')
  const [selectedVersionNum, setSelectedVersionNum] = useState<string>('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load package configuration
  useEffect(() => {
    if (packageName) {
      fetch(`/api/packages/${packageName}`)
        .then((res) => res.json())
        .then((data) => {
          setRecipe(data)
          // Default select the defaultVersion or the first version in keys
          const defVer = data.defaultVersion || Object.keys(data.versions || {})[0] || ''
          setSelectedVersionNum(defVer)
          setLoading(false)
        })
        .catch((err) => {
          console.error('Failed to fetch package:', err)
          setLoading(false)
        })
    }
  }, [packageName])

  if (loading || !recipe) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
        正在载入软件配置...
      </div>
    )
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/packages/${recipe.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe)
      })

      if (res.ok) {
        setDirty(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        const err = await res.json()
        alert(`保存失败: ${err.error}`)
      }
    } catch (e: any) {
      alert(`保存出错: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const updateRecipe = (updater: (prev: PackageRecipe) => PackageRecipe) => {
    setRecipe((prev) => {
      if (!prev) return null
      const next = updater(prev)
      setDirty(true)
      return next
    })
  }

  // Basic Info Change
  const handleBasicChange = (field: keyof PackageRecipe, value: any) => {
    updateRecipe((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  // Bins Management
  const handleAddBin = () => {
    updateRecipe((prev) => ({
      ...prev,
      bins: [...prev.bins, { name: '', relativePath: '' }]
    }))
  }

  const handleRemoveBin = (index: number) => {
    updateRecipe((prev) => ({
      ...prev,
      bins: prev.bins.filter((_, i) => i !== index)
    }))
  }

  const handleBinChange = (index: number, field: keyof BinConfig, value: string) => {
    updateRecipe((prev) => {
      const nextBins = [...prev.bins]
      nextBins[index] = { ...nextBins[index], [field]: value }
      return { ...prev, bins: nextBins }
    })
  }

  // Versions Management
  const handleAddVersion = () => {
    const vNum = prompt('请输入新版本号 (例如: 1.22.0):')
    if (!vNum || !vNum.trim()) return
    const versionStr = vNum.trim()

    if (recipe.versions[versionStr]) {
      alert('该版本已存在！')
      return
    }

    updateRecipe((prev) => {
      const defaultPlatforms: Record<string, PlatformDetail> = {}
      return {
        ...prev,
        versions: {
          ...prev.versions,
          [versionStr]: {
            version: versionStr,
            channel: 'stable',
            platforms: defaultPlatforms,
            verify: []
          }
        }
      }
    })
    setSelectedVersionNum(versionStr)
  }

  const handleRemoveVersion = (vNum: string) => {
    if (!confirm(`确定要彻底删除版本 v${vNum} 吗？`)) return

    updateRecipe((prev) => {
      const nextVersions = { ...prev.versions }
      delete nextVersions[vNum]
      return { ...prev, versions: nextVersions }
    })

    const keys = Object.keys(recipe.versions).filter((k) => k !== vNum)
    setSelectedVersionNum(keys[0] || '')
  }

  const handleVersionDetailChange = (vNum: string, field: 'channel' | 'codename', value: string) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum], [field]: value }
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  // Platforms toggle/edit in Version
  const handlePlatformToggle = (vNum: string, platId: string, enabled: boolean) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      if (enabled) {
        const platConfig = SUPPORTED_PLATFORMS.find((p) => p.id === platId)!
        nextVer.platforms[platId] = {
          os: platConfig.os,
          arch: platConfig.arch,
          archiveType: platConfig.archiveType,
          fileName: `${prev.name}-v${vNum}-${platConfig.os}-${platConfig.arch}.${platConfig.archiveType === 'zip' ? 'zip' : 'tar.xz'}`,
          officialUrl: `https://example.org/dist/v${vNum}/${prev.name}-v${vNum}-${platConfig.os}-${platConfig.arch}.${platConfig.archiveType === 'zip' ? 'zip' : 'tar.xz'}`,
          mirrorUrls: [],
          sha256: '',
          archiveRoot: `${prev.name}-v${vNum}-${platConfig.os}-${platConfig.arch}`
        }
      } else {
        delete nextVer.platforms[platId]
      }
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handlePlatformDetailChange = (
    vNum: string,
    platId: string,
    field: keyof PlatformDetail,
    value: any
  ) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      const nextPlat = { ...nextVer.platforms[platId], [field]: value }
      nextVer.platforms[platId] = nextPlat
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handlePlatformMirrorChange = (
    vNum: string,
    platId: string,
    index: number,
    value: string
  ) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      const nextPlat = { ...nextVer.platforms[platId] }
      const nextMirrors = [...nextPlat.mirrorUrls]
      nextMirrors[index] = value
      nextPlat.mirrorUrls = nextMirrors
      nextVer.platforms[platId] = nextPlat
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handleAddPlatformMirror = (vNum: string, platId: string) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      const nextPlat = { ...nextVer.platforms[platId] }
      nextPlat.mirrorUrls = [...nextPlat.mirrorUrls, '']
      nextVer.platforms[platId] = nextPlat
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handleRemovePlatformMirror = (vNum: string, platId: string, index: number) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      const nextPlat = { ...nextVer.platforms[platId] }
      nextPlat.mirrorUrls = nextPlat.mirrorUrls.filter((_, i) => i !== index)
      nextVer.platforms[platId] = nextPlat
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  // Verification commands list management
  const handleAddVerify = (vNum: string) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      nextVer.verify = [...(nextVer.verify || []), { command: '', expectedPrefix: '' }]
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handleRemoveVerify = (vNum: string, index: number) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      nextVer.verify = (nextVer.verify || []).filter((_, i) => i !== index)
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const handleVerifyChange = (vNum: string, index: number, field: keyof VerifyConfig, value: string) => {
    updateRecipe((prev) => {
      const nextVer = { ...prev.versions[vNum] }
      const nextVerify = [...(nextVer.verify || [])]
      nextVerify[index] = { ...nextVerify[index], [field]: value }
      nextVer.verify = nextVerify
      return {
        ...prev,
        versions: { ...prev.versions, [vNum]: nextVer }
      }
    })
  }

  const currentVersion = recipe.versions[selectedVersionNum]

  return (
    <div className="flex flex-col h-[calc(100vh)] bg-slate-50 overflow-hidden animate-fade-in">
      {/* Top Sticky Bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {recipe.displayName}
              </h2>
              <span className="font-mono text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                {recipe.name}.json
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              编辑软件配方，配置后置脚本及各系统下载镜像
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fade-in">
              <CheckCircle2 size={14} />
              <span>配置保存成功！</span>
            </div>
          )}
          {dirty && !saveSuccess && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
              有未保存的改动
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !saveSuccess)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Save size={14} />
            <span>{saving ? '正在保存...' : '保存修改'}</span>
          </button>
        </div>
      </header>

      {/* Tabs Selector */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-8 flex gap-6">
        <button
          onClick={() => setActiveSubTab('basic')}
          className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'basic'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          基本配置与映射
        </button>
        <button
          onClick={() => setActiveSubTab('versions')}
          className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'versions'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          版本与各系统包管理
        </button>
        <button
          onClick={() => setActiveSubTab('raw')}
          className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'raw'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          JSON 源代码预览
        </button>
      </div>

      {/* Main Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto">
        {/* TAB 1: BASIC CONFIG */}
        {activeSubTab === 'basic' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base mb-4 border-b border-slate-100 pb-3">软件基础信息</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    软件显示名称
                  </label>
                  <input
                    type="text"
                    value={recipe.displayName}
                    onChange={(e) => handleBasicChange('displayName', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    默认指向版本
                  </label>
                  <input
                    type="text"
                    value={recipe.defaultVersion}
                    onChange={(e) => handleBasicChange('defaultVersion', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  官方网站
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400">
                    <Globe size={14} />
                  </span>
                  <input
                    type="text"
                    value={recipe.homepage || ''}
                    onChange={(e) => handleBasicChange('homepage', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 pl-10 pr-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    开源许可证
                  </label>
                  <input
                    type="text"
                    value={recipe.license || 'MIT'}
                    onChange={(e) => handleBasicChange('license', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    安装目录模板
                  </label>
                  <input
                    type="text"
                    value={recipe.managedInstallPath}
                    onChange={(e) => handleBasicChange('managedInstallPath', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none font-mono text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  软件中文简介
                </label>
                <textarea
                  value={recipe.description || ''}
                  onChange={(e) => handleBasicChange('description', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none h-20 resize-none"
                />
              </div>
            </div>

            {/* Bins Config Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-base">可执行二进制文件映射 (Bins)</h3>
                <button
                  type="button"
                  onClick={handleAddBin}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-800 text-slate-800 rounded-xl text-xs font-semibold transition-all hover:bg-slate-50"
                >
                  <Plus size={12} />
                  <span>添加二进制</span>
                </button>
              </div>

              <div className="space-y-3">
                {recipe.bins.map((bin, idx) => (
                  <div key={idx} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div className="w-1/4">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        可执行名称 (如 node, npm)
                      </label>
                      <input
                        type="text"
                        required
                        value={bin.name}
                        onChange={(e) => handleBinChange(idx, 'name', e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Unix 相对路径
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="bin/node"
                        value={bin.relativePath}
                        onChange={(e) => handleBinChange(idx, 'relativePath', e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Windows 相对路径 (可选)
                      </label>
                      <input
                        type="text"
                        placeholder="node.exe"
                        value={bin.windowsRelativePath || ''}
                        onChange={(e) => handleBinChange(idx, 'windowsRelativePath', e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBin(idx)}
                      className="p-2 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {recipe.bins.length === 0 && (
                  <p className="text-slate-400 text-xs text-center py-4">无任何 Bins 二进制映射。客户端无法为此包生成 Shim 软链接。</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VERSIONS & PLATFORMS */}
        {activeSubTab === 'versions' && (
          <div className="flex gap-8 items-start h-[calc(100vh-220px)] overflow-hidden">
            {/* Version Sidebar Selection */}
            <aside className="w-56 bg-white border border-slate-200 rounded-2xl flex flex-col h-full shrink-0 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">版本号列表</span>
                <button
                  onClick={handleAddVersion}
                  className="p-1 border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="添加新版本"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {Object.keys(recipe.versions).map((vNum) => (
                  <div
                    key={vNum}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedVersionNum === vNum
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    onClick={() => setSelectedVersionNum(vNum)}
                  >
                    <span>v{vNum}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveVersion(vNum)
                      }}
                      className={`p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 transition-colors ${
                        selectedVersionNum === vNum ? 'hover:text-rose-200 hover:bg-slate-800' : ''
                      }`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                {Object.keys(recipe.versions).length === 0 && (
                  <p className="text-slate-400 text-xs text-center py-8">暂未配置任何软件版本</p>
                )}
              </div>
            </aside>

            {/* Version Detail Form (Scrollable) */}
            <div className="flex-1 overflow-y-auto h-full space-y-6">
              {currentVersion ? (
                <>
                  {/* Basic Version Metadata */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 mb-4">
                      版本元数据 (v{selectedVersionNum})
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          归属通道 (如 lts, stable)
                        </label>
                        <input
                          type="text"
                          value={currentVersion.channel || 'stable'}
                          onChange={(e) => handleVersionDetailChange(selectedVersionNum, 'channel', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          代号 (Codename)
                        </label>
                        <input
                          type="text"
                          value={currentVersion.codename || ''}
                          onChange={(e) => handleVersionDetailChange(selectedVersionNum, 'codename', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-950 px-3.5 py-2 rounded-xl text-sm transition-all focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Platforms Config */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
                      目标系统包配置 (Platforms)
                    </h3>

                    {SUPPORTED_PLATFORMS.map((plat) => {
                      const platConfig = currentVersion.platforms[plat.id]
                      const isEnabled = !!platConfig

                      return (
                        <div key={plat.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/20">
                          {/* Platform Header */}
                          <div className="bg-slate-50/80 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{plat.id}</span>
                              <span className="text-[10px] text-slate-500 bg-white border px-1.5 py-0.5 rounded">
                                {plat.os} / {plat.arch} ({plat.archiveType})
                              </span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => handlePlatformToggle(selectedVersionNum, plat.id, e.target.checked)}
                                className="rounded text-slate-900 focus:ring-slate-900 h-3.5 w-3.5"
                              />
                              <span className="text-xs font-medium text-slate-700">启用此系统平台</span>
                            </label>
                          </div>

                          {/* Platform Details Inputs */}
                          {isEnabled && (
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                    文件名 (FileName)
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={platConfig.fileName}
                                    onChange={(e) => handlePlatformDetailChange(selectedVersionNum, plat.id, 'fileName', e.target.value)}
                                    className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                    解包根目录名 (ArchiveRoot)
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={platConfig.archiveRoot}
                                    onChange={(e) => handlePlatformDetailChange(selectedVersionNum, plat.id, 'archiveRoot', e.target.value)}
                                    className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                  SHA256 校验和 (重要)
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={platConfig.sha256}
                                  onChange={(e) => handlePlatformDetailChange(selectedVersionNum, plat.id, 'sha256', e.target.value)}
                                  className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono tracking-tight"
                                  placeholder="填写完整的 64 位 SHA256 字符"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                  官方下载 URL (OfficialUrl)
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={platConfig.officialUrl}
                                  onChange={(e) => handlePlatformDetailChange(selectedVersionNum, plat.id, 'officialUrl', e.target.value)}
                                  className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                                />
                              </div>

                              {/* Mirrors */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    镜像源 Url 列表 (MirrorUrls)
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleAddPlatformMirror(selectedVersionNum, plat.id)}
                                    className="text-[10px] text-slate-700 hover:text-slate-900 font-bold flex items-center gap-0.5"
                                  >
                                    <Plus size={10} /> Add Mirror
                                  </button>
                                </div>

                                {platConfig.mirrorUrls.map((mir, mIdx) => (
                                  <div key={mIdx} className="flex gap-2 items-center">
                                    <input
                                      type="text"
                                      value={mir}
                                      onChange={(e) => handlePlatformMirrorChange(selectedVersionNum, plat.id, mIdx, e.target.value)}
                                      className="flex-1 bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1 rounded-lg text-xs transition-all focus:outline-none font-mono"
                                      placeholder="https://mirrors.example.com/..."
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePlatformMirror(selectedVersionNum, plat.id, mIdx)}
                                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Verification commands */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">环境后置校验命令 (Verify)</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">软件安装或激活后，客户端会自动运行以下指令来确认功能就绪</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddVerify(selectedVersionNum)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-slate-800 text-slate-800 rounded-xl text-xs font-semibold transition-all hover:bg-slate-50"
                      >
                        <Plus size={12} />
                        <span>添加校验</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(currentVersion.verify || []).map((vfy, vIdx) => (
                        <div key={vIdx} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                          <div className="flex-1">
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              运行命令
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="例如: go version, node --version"
                              value={vfy.command}
                              onChange={(e) => handleVerifyChange(selectedVersionNum, vIdx, 'command', e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                            />
                          </div>
                          <div className="w-1/3">
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              预期输出前缀 (可选)
                            </label>
                            <input
                              type="text"
                              placeholder="例如: go version go1.22"
                              value={vfy.expectedPrefix || ''}
                              onChange={(e) => handleVerifyChange(selectedVersionNum, vIdx, 'expectedPrefix', e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVerify(selectedVersionNum, vIdx)}
                            className="p-2 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {(!currentVersion.verify || currentVersion.verify.length === 0) && (
                        <p className="text-slate-400 text-xs text-center py-4">无任何校验指令，建议至少配入一条命令检测 (例如: version 打印)。</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                  请在左侧侧边栏中选择一个版本，或者点击右上角加号以添加该软件的新版本规则。
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RAW JSON PREVIEW */}
        {activeSubTab === 'raw' && (
          <div className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">格式化 JSON 数据预览</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(recipe, null, 2))
                  alert('JSON 配置已复制到剪切板')
                }}
                className="text-[10px] bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white px-3 py-1 rounded-lg text-slate-300 font-semibold transition-colors"
              >
                复制代码
              </button>
            </div>
            <textarea
              readOnly
              className="w-full bg-transparent border-0 text-slate-300 text-xs font-mono resize-none focus:outline-none h-[calc(100vh-320px)] leading-relaxed"
              value={JSON.stringify(recipe, null, 2)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
