import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, CheckCircle2, Trash2, ShieldCheck } from 'lucide-react';

interface VerifyResult {
  command: string;
  success: boolean;
  output: string;
  error?: string;
}

export const EnvDetail: React.FC<{ packageName: string }> = ({ packageName }) => {
  const { packages, setCurrentTab, startInstall, refreshState, t } = useApp();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pkg = packages.find((p) => p.name === packageName) || {
    name: packageName,
    displayName: 'Node.js',
    installedVersions: [],
    activeVersion: undefined,
    availableVersions: ['24.16.0'],
    status: 'not_installed'
  };

  const candidateVersions = pkg.availableVersions.map(v => ({
    version: v,
    type: t('detail.lts'),
    codename: v === '24.16.0' ? 'Krypton' : t('detail.stable')
  }));

  const handleUseVersion = async (version: string) => {
    setLoadingAction(`use-${version}`);
    setError(null);
    try {
      await invoke('use_package_version', { name: packageName, version });
      await refreshState();
      setVerifyResults(null);
    } catch (err: any) {
      setError(t('detail.switchError', { error: String(err) }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUninstallVersion = async (version: string) => {
    if (!window.confirm(t('detail.confirmUninstall', { packageName, version }))) {
      return;
    }
    setLoadingAction(`uninstall-${version}`);
    setError(null);
    try {
      await invoke('uninstall_package_version', { name: packageName, version });
      await refreshState();
      setVerifyResults(null);
    } catch (err: any) {
      setError(t('detail.uninstallError', { error: String(err) }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerify = async (version: string) => {
    setLoadingAction(`verify-${version}`);
    setError(null);
    try {
      const result = await invoke<VerifyResult[]>('verify_package_version', { name: packageName, version });
      setVerifyResults(result);
    } catch (err: any) {
      setError(t('detail.verifyError', { error: String(err) }));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-mono text-xs">
      {/* 头部导航与返回 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentTab('env')}
          className="p-1.5 border border-slate-800 bg-slate-950 rounded hover:border-accent hover:text-accent transition-colors duration-150 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-100">{t('detail.title', { name: pkg.displayName })}</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('detail.description')}</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 p-3 rounded text-red-500 flex justify-between items-center animate-fade-in">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="text-[10px] underline hover:text-red-400 cursor-pointer"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* 校验报告展示区 */}
      {verifyResults && (
        <div className="border border-slate-800 bg-slate-950 p-4 rounded space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              {t('detail.reportTitle')}
            </h3>
            <button
              onClick={() => setVerifyResults(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
            >
              {t('common.dismiss')}
            </button>
          </div>
          <div className="space-y-2">
            {verifyResults.map((v, i) => (
              <div key={i} className="bg-slate-900 p-2.5 rounded border border-slate-800 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-bold text-slate-300">{`$ ${v.command}`}</div>
                  <div className="text-[10px] text-slate-500 whitespace-pre-wrap">{v.output || v.error}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.success ? 'bg-accent/10 border border-accent/20 text-accent' : 'bg-red-500/10 border border-red-500/20 text-red-500'}`}>
                  {v.success ? t('common.pass') : t('common.fail')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 版本列表卡片 */}
      <div className="border border-slate-800 bg-slate-950 rounded overflow-hidden">
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 text-slate-300 font-bold">
          {t('detail.versionListTitle')}
        </div>
        <div className="divide-y divide-slate-900">
          {candidateVersions.map((cand) => {
            const isInstalled = pkg.installedVersions.includes(cand.version);
            const isActive = pkg.activeVersion === cand.version;
            const isLoading = loadingAction?.includes(cand.version);

            return (
              <div key={cand.version} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* 左侧元信息 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">{cand.version}</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">
                      {cand.type}
                    </span>
                    <span className="text-slate-500 text-[10px]">({cand.codename})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {isActive ? (
                      <span className="text-accent flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t('detail.shimActivated')}
                      </span>
                    ) : isInstalled ? (
                      t('detail.installedInactive')
                    ) : (
                      t('detail.remoteAvailable')
                    )}
                  </div>
                </div>

                {/* 右侧动作控制 */}
                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <>
                      {/* 激活设置 */}
                      <button
                        disabled={isActive || !!isLoading}
                        onClick={() => handleUseVersion(cand.version)}
                        className={`px-3 py-1.5 rounded font-bold transition-colors duration-150 ${
                          isActive || !!isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isActive
                            ? 'bg-slate-800 text-slate-500 border border-slate-700'
                            : 'bg-accent hover:bg-accent-hover text-slate-950'
                        }`}
                      >
                        {isLoading && loadingAction?.startsWith('use') ? t('detail.activating') : t('detail.activate')}
                      </button>

                      {/* 健康校验 */}
                      <button
                        disabled={!!isLoading}
                        onClick={() => handleVerify(cand.version)}
                        className={`px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 rounded font-bold transition-colors duration-150 ${
                          isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {isLoading && loadingAction?.startsWith('verify') ? t('detail.verifying') : t('detail.verify')}
                      </button>

                      {/* 卸载版本 */}
                      <button
                        disabled={!!isLoading}
                        onClick={() => handleUninstallVersion(cand.version)}
                        className={`p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-500 hover:border-red-500/30 rounded transition-colors duration-150 ${
                          isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title={t('detail.uninstallTitle')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    /* 一键下载安装 */
                    <button
                      disabled={!!isLoading}
                      onClick={() => startInstall(packageName, cand.version)}
                      className={`px-3 py-1.5 bg-slate-900 border border-slate-800 text-accent hover:border-accent/40 rounded font-bold transition-all duration-150 ${
                        isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {isLoading ? t('detail.pending') : t('detail.downloadInstall')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
