import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmUninstallVersion, setConfirmUninstallVersion] = useState<string | null>(null);

  useEffect(() => {
    refreshState();
  }, []);

  const pkg = packages.find((p) => p.name === packageName) || {
    name: packageName,
    displayName: 'Node.js',
    installedVersions: [],
    activeVersion: undefined,
    availableVersions: ['24.16.0'],
    status: 'not_installed'
  };

  const candidateVersions = [...pkg.availableVersions.map(v => ({
    version: v,
    type: t('detail.lts'),
    codename: v === '24.16.0' ? 'Krypton' : t('detail.stable')
  }))];

  if (pkg.systemVersion) {
    candidateVersions.unshift({
      version: 'system',
      type: t('detail.system'),
      codename: pkg.systemVersion
    });
  }

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

  const handleUninstallVersion = (version: string) => {
    setConfirmUninstallVersion(version);
  };

  const executeUninstall = async (version: string) => {
    setConfirmUninstallVersion(null);
    setLoadingAction(`uninstall-${version}`);
    setError(null);
    setSuccessMessage(null);
    try {
      const msg = await invoke<string>('uninstall_package_version', { name: packageName, version });
      await refreshState();
      setVerifyResults(null);
      if (msg) {
        setSuccessMessage(msg);
      }
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
    <div className="space-y-6 animate-fade-in font-sans text-xs">
      {/* 头部导航与返回 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentTab('env')}
          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:border-slate-300 hover:text-slate-900 transition-all duration-150 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('detail.title', { name: pkg.displayName })}</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{t('detail.description')}</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-100 bg-red-50/50 p-4 rounded-xl text-red-600 flex justify-between items-center animate-fade-in shadow-sm">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="text-[10px] font-semibold underline hover:text-red-800 cursor-pointer"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {successMessage && (
        <div className="border border-emerald-100 bg-emerald-50/50 p-4 rounded-xl text-emerald-800 flex justify-between items-center animate-fade-in shadow-sm">
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="text-[10px] font-semibold underline hover:text-emerald-950 cursor-pointer"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* 校验报告展示区 */}
      {verifyResults && (
        <div className="border border-slate-200/80 bg-white p-5 rounded-xl space-y-3 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              {t('detail.reportTitle')}
            </h3>
            <button
              onClick={() => setVerifyResults(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              {t('common.dismiss')}
            </button>
          </div>
          <div className="space-y-2">
            {verifyResults.map((v, i) => (
              <div key={i} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-bold text-slate-700 font-mono">{`$ ${v.command}`}</div>
                  <div className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap">{v.output || v.error}</div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${v.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {v.success ? t('common.pass') : t('common.fail')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 版本列表卡片 */}
      <div className="border border-slate-200/80 bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 text-slate-800 font-bold">
          {t('detail.versionListTitle')}
        </div>
        <div className="divide-y divide-slate-100">
          {candidateVersions.map((cand) => {
            const isInstalled = pkg.installedVersions.includes(cand.version);
            const isActive = pkg.activeVersion === cand.version;
            const isLoading = loadingAction?.includes(cand.version);

            return (
              <div key={cand.version} className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* 左侧元信息 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {cand.version === 'system' ? 'System (系统)' : cand.version}
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">
                      {cand.type}
                    </span>
                    <span className="text-slate-400 text-[10px]">({cand.codename})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    {isActive ? (
                      <span className="text-emerald-600 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t('detail.shimActivated')}
                      </span>
                    ) : isInstalled ? (
                      t('detail.installedInactive')
                    ) : (
                      t('detail.remoteAvailable')
                    )}
                  </div>
                </div>

                {/* 右侧动作控制 */}
                <div className="flex items-center gap-2.5">
                  {isInstalled ? (
                    <>
                      {/* 激活设置 */}
                      <button
                        disabled={isActive || !!isLoading}
                        onClick={() => handleUseVersion(cand.version)}
                        className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all duration-150 ${
                          isActive || !!isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isActive
                            ? 'bg-slate-50 text-slate-400 border border-slate-200/60'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                        }`}
                      >
                        {isLoading && loadingAction?.startsWith('use') ? t('detail.activating') : t('detail.activate')}
                      </button>

                      {/* 健康校验 */}
                      <button
                        disabled={!!isLoading}
                        onClick={() => handleVerify(cand.version)}
                        className={`px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-lg font-bold text-xs transition-all duration-150 shadow-sm ${
                          isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {isLoading && loadingAction?.startsWith('verify') ? t('detail.verifying') : t('detail.verify')}
                      </button>

                      {/* 卸载版本 */}
                      {cand.version !== 'system' && (
                        <button
                          disabled={!!isLoading}
                          onClick={() => handleUninstallVersion(cand.version)}
                          className={`p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50 rounded-lg transition-all duration-150 shadow-sm ${
                            isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title={t('detail.uninstallTitle')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    /* 一键下载安装 */
                    <button
                      disabled={!!isLoading}
                      onClick={() => startInstall(packageName, cand.version)}
                      className={`px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-xs transition-all duration-150 shadow-sm ${
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
      {confirmUninstallVersion && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in animate-duration-150">
          <div className="bg-white border border-slate-100 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              {t('detail.uninstallTitle')}
            </h3>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              {t('detail.confirmUninstall', { packageName, version: confirmUninstallVersion })}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmUninstallVersion(null)}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer transition-all duration-150 shadow-sm"
              >
                {t('common.dismiss')}
              </button>
              <button
                onClick={() => executeUninstall(confirmUninstallVersion)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[10px] cursor-pointer shadow-sm transition-all duration-150"
              >
                {t('detail.uninstallTitle')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
