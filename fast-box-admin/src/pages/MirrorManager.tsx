import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, CheckCircle2 } from 'lucide-react'

export default function MirrorManager() {
  const [recipes, setRecipes] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/packages')
      if (res.ok) {
        const pkgs = await res.json()
        
        const detailRecipes: Record<string, any> = {}
        for (const p of pkgs) {
          const detailRes = await fetch(`/api/packages/${p.name}`)
          if (detailRes.ok) {
            detailRecipes[p.name] = await detailRes.json()
          }
        }
        setRecipes(detailRecipes)
      }
    } catch (err) {
      console.error('Failed to load mirror manager data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAll = async () => {
    try {
      setSaving(true)
      for (const name of Object.keys(recipes)) {
        await fetch(`/api/packages/${name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recipes[name])
        })
      }
      setDirty(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: any) {
      alert(`保存镜像配置出错: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const getPostInstallMeta = (pkgName: string) => {
    switch (pkgName) {
      case 'node':
        return {
          key: 'npmRegistry',
          label: 'npm 代理源 (npmRegistry)',
          description: '软件安装后，为 npm 包管理器配置的默认国内镜像',
          placeholder: '例如: https://registry.npmmirror.com'
        }
      case 'golang':
        return {
          key: 'goProxy',
          label: 'Go Proxy 代理源 (goProxy)',
          description: '软件安装后，为 Go 编译器配置的默认 GOPROXY 代理地址',
          placeholder: '例如: https://goproxy.cn,direct'
        }
      case 'python':
        return {
          key: 'pipIndexUrl',
          label: 'pip 镜像源 (pipIndexUrl)',
          description: '软件安装后，为 pip 包管理器配置的默认 PyPI 镜像源地址',
          placeholder: '例如: https://pypi.tuna.tsinghua.edu.cn/simple'
        }
      default:
        return {
          key: 'npmRegistry',
          label: '后置代理源 (npmRegistry)',
          description: '软件安装后配置的代理地址',
          placeholder: '例如: https://registry.npmmirror.com'
        }
    }
  }

  const handlePostInstallRegistryChange = (pkgName: string, value: string) => {
    const meta = getPostInstallMeta(pkgName)
    setRecipes((prev) => {
      const next = { ...prev }
      if (!next[pkgName].postInstall) {
        next[pkgName].postInstall = {}
      }
      next[pkgName].postInstall[meta.key] = value
      return next
    })
    setDirty(true)
  }

  const handleMirrorUrlChange = (pkgName: string, vNum: string, platId: string, index: number, value: string) => {
    setRecipes((prev) => {
      const next = { ...prev }
      const platform = next[pkgName].versions[vNum].platforms[platId]
      const nextMirrors = [...platform.mirrorUrls]
      nextMirrors[index] = value
      platform.mirrorUrls = nextMirrors
      return next
    })
    setDirty(true)
  }

  const handleAddMirrorUrl = (pkgName: string, vNum: string, platId: string) => {
    setRecipes((prev) => {
      const next = { ...prev }
      const platform = next[pkgName].versions[vNum].platforms[platId]
      platform.mirrorUrls = [...(platform.mirrorUrls || []), '']
      return next
    })
    setDirty(true)
  }

  const handleRemoveMirrorUrl = (pkgName: string, vNum: string, platId: string, index: number) => {
    setRecipes((prev) => {
      const next = { ...prev }
      const platform = next[pkgName].versions[vNum].platforms[platId]
      platform.mirrorUrls = platform.mirrorUrls.filter((_: any, i: number) => i !== index)
      return next
    })
    setDirty(true)
  }

  const handleAutoFillMirrors = () => {
    setRecipes((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      let changed = false

      for (const pkgName of Object.keys(next)) {
        const recipe = next[pkgName]
        if (pkgName === 'node') {
          if (!recipe.postInstall) recipe.postInstall = {}
          if (recipe.postInstall.npmRegistry !== 'https://registry.npmmirror.com') {
            recipe.postInstall.npmRegistry = 'https://registry.npmmirror.com'
            changed = true
          }
        } else if (pkgName === 'golang') {
          if (!recipe.postInstall) recipe.postInstall = {}
          if (recipe.postInstall.goProxy !== 'https://goproxy.cn,direct') {
            recipe.postInstall.goProxy = 'https://goproxy.cn,direct'
            changed = true
          }
        } else if (pkgName === 'python') {
          if (!recipe.postInstall) recipe.postInstall = {}
          if (recipe.postInstall.pipIndexUrl !== 'https://pypi.tuna.tsinghua.edu.cn/simple') {
            recipe.postInstall.pipIndexUrl = 'https://pypi.tuna.tsinghua.edu.cn/simple'
            changed = true
          }
        }

        for (const vNum of Object.keys(recipe.versions || {})) {
          const version = recipe.versions[vNum]
          for (const platId of Object.keys(version.platforms || {})) {
            const platform = version.platforms[platId]
            
            if (pkgName === 'node' && platform.officialUrl.includes('nodejs.org')) {
              const huaweiUrl = `https://mirrors.huaweicloud.com/nodejs/v${vNum}/${platform.fileName}`
              if (!platform.mirrorUrls.includes(huaweiUrl)) {
                platform.mirrorUrls = [huaweiUrl, ...platform.mirrorUrls.filter((u: string) => u !== huaweiUrl)]
                changed = true
              }
            } else if (pkgName === 'golang' && platform.officialUrl.includes('go.dev')) {
              const aliyunUrl = platform.officialUrl.replace('go.dev/dl/', 'mirrors.aliyun.com/golang/')
              const ustcUrl = platform.officialUrl.replace('go.dev/dl/', 'mirrors.ustc.edu.cn/golang/')
              if (!platform.mirrorUrls.includes(aliyunUrl)) {
                platform.mirrorUrls = [aliyunUrl, ustcUrl, ...platform.mirrorUrls.filter((u: string) => u !== aliyunUrl && u !== ustcUrl)]
                changed = true
              }
            } else if (pkgName === 'python' && platform.officialUrl.includes('python.org')) {
              const huaweiUrl = platform.officialUrl.replace('www.python.org/ftp/python/', 'mirrors.huaweicloud.com/python/')
              if (!platform.mirrorUrls.includes(huaweiUrl)) {
                platform.mirrorUrls = [huaweiUrl, ...platform.mirrorUrls.filter((u: string) => u !== huaweiUrl)]
                changed = true
              }
            }
          }
        }
      }

      if (changed) {
        setDirty(true)
        alert('已成功自动填充国内加速镜像源与后置代理配置！记得点击右上角“保存镜像配置”以写入文件。')
      } else {
        alert('当前已配置最优国内加速镜像，无需重复填充。')
      }

      return next
    })
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
        正在收集镜像配置...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">镜像源统一管理</h2>
          <p className="text-slate-500 text-sm mt-1">管理各软件包的下载节点镜像，支持批量注入华为云等国内加速镜像</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoFillMirrors}
            className="px-3.5 py-2 border border-slate-200 hover:border-slate-800 text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer"
          >
            🔌 自动注入国内加速源
          </button>
          
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <CheckCircle2 size={14} />
              <span>保存成功！</span>
            </div>
          )}
          
          <button
            onClick={handleSaveAll}
            disabled={saving || (!dirty && !saveSuccess)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Save size={14} />
            <span>{saving ? '正在保存...' : '保存镜像配置'}</span>
          </button>
        </div>
      </div>

      {/* Main Containers */}
      <div className="space-y-8">
        {Object.keys(recipes).map((pkgName) => {
          const recipe = recipes[pkgName]
          const meta = getPostInstallMeta(pkgName)
          const registryVal = recipe.postInstall?.[meta.key] || ''

          return (
            <div key={pkgName} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Package Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{recipe.displayName}</h3>
                    <p className="text-xs text-slate-500">ID: {recipe.name}</p>
                  </div>
                </div>
              </div>

              {/* Registry Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{meta.label}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{meta.description}</p>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder={meta.placeholder}
                    value={registryVal}
                    onChange={(e) => handlePostInstallRegistryChange(pkgName, e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Version download mirrors */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">下载压缩包镜像源 (Download Mirrors)</h4>
                
                {Object.keys(recipe.versions || {}).map((vNum) => {
                  const version = recipe.versions[vNum]
                  return (
                    <div key={vNum} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">版本 v{vNum}</span>
                      </div>

                      {Object.keys(version.platforms || {}).map((platId) => {
                        const plat = version.platforms[platId]
                        return (
                          <div key={platId} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0 space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="font-semibold">{platId} ({plat.fileName})</span>
                              <span className="font-mono text-slate-400 select-all truncate max-w-[400px]">官方: {plat.officialUrl}</span>
                            </div>

                            {/* Mirror Url Inputs */}
                            <div className="space-y-1.5">
                              {(plat.mirrorUrls || []).map((mir: string, mIdx: number) => (
                                <div key={mIdx} className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={mir}
                                    onChange={(e) => handleMirrorUrlChange(pkgName, vNum, platId, mIdx, e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 focus:border-slate-800 text-slate-950 px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none font-mono"
                                    placeholder="https://mirrors.huaweicloud.com/..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMirrorUrl(pkgName, vNum, platId, mIdx)}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}

                              {(!plat.mirrorUrls || plat.mirrorUrls.length === 0) && (
                                <div className="text-slate-400 text-xs py-1.5 flex items-center justify-between bg-slate-50 px-3 rounded-lg border border-slate-100">
                                  <span>暂未配置此平台的国内镜像源。中国内地下载可能会极慢。</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMirrorUrl(pkgName, vNum, platId)}
                                    className="text-[10px] font-bold text-slate-800 border px-2 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                  >
                                    + 添加镜像
                                  </button>
                                </div>
                              )}

                              {plat.mirrorUrls && plat.mirrorUrls.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleAddMirrorUrl(pkgName, vNum, platId)}
                                  className="text-[10px] font-bold text-slate-800 flex items-center gap-0.5 hover:text-slate-600 mt-1 cursor-pointer"
                                >
                                  <Plus size={10} /> 追加备用镜像源
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {Object.keys(recipes).length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            未加载到任何配置软件包。请先去“软件包配置”添加软件。
          </div>
        )}
      </div>
    </div>
  )
}
