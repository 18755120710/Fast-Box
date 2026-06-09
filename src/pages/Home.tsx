import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  HardDrive, 
  Terminal, 
  Activity, 
  ChevronRight, 
  Trash2,
  Cpu
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ActivityItem {
  title: string;
  description: string;
  timeAgo: string;
  status: string; // "success" | "failed" | "running"
}

interface StorageUsage {
  packagesSize: number;
  cacheSize: number;
  logsSize: number;
  totalSize: number;
}

export const Home: React.FC = () => {
  const { systemInfo, packages, setCurrentTab, refreshState, t, language } = useApp();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pathMissing, setPathMissing] = useState<boolean>(true);
  const [isConfiguredInRc, setIsConfiguredInRc] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  
  // 新增：存储大小与清理状态
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [cleanLoading, setCleanLoading] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadStorageData = async () => {
    try {
      const usage = await invoke<StorageUsage>('get_storage_usage');
      setStorage(usage);
    } catch (err) {
      console.error('Failed to load storage details:', err);
    }
  };

  const loadHomeData = async () => {
    try {
      setLoading(true);
      const acts = await invoke<ActivityItem[]>('get_recent_activities');
      setActivities(acts);
      const pathOk = await invoke<boolean>('check_path_status');
      setPathMissing(!pathOk);
      const configOk = await invoke<boolean>('is_path_configured_in_shell');
      setIsConfiguredInRc(configOk);
      await loadStorageData();
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [packages]);

  const handleRefresh = async () => {
    await refreshState();
    await loadHomeData();
  };

  const handleClean = async (type: 'cache' | 'logs') => {
    setCleanLoading(type);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const sizeRemoved = await invoke<number>(type === 'cache' ? 'clean_cache' : 'clean_logs');
      await loadStorageData();
      setSuccessMsg(t('home.cleanSuccess', { size: formatBytes(sizeRemoved) }));
    } catch (err: any) {
      setErrorMsg(String(err));
    } finally {
      setCleanLoading(null);
    }
  };

  const handleAutoConfig = async () => {
    setConfigLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const msg = await invoke<string>('auto_configure_path');
      setSuccessMsg(msg);
      const pathOk = await invoke<boolean>('check_path_status');
      setPathMissing(!pathOk);
    } catch (err: any) {
      setErrorMsg(String(err));
    } finally {
      setConfigLoading(false);
    }
  };

  // 存储条形占比计算
  const getStoragePercentage = (size: number) => {
    if (!storage || storage.totalSize === 0) return '0%';
    return ((size / storage.totalSize) * 100).toFixed(1) + '%';
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans text-xs">
      {/* 顶栏欢迎语 */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            {t('home.title')}{' '}
            <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/80">
              {t('home.badge')}
            </span>
          </h2>
          <p className="text-[10px] text-slate-500 mt-1">
            {t('home.description')}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 全局 Toast 通知 */}
      {successMsg && (
        <div className="border border-emerald-100 bg-emerald-50/50 p-4 rounded-xl text-emerald-800 flex justify-between items-center animate-fade-in shadow-sm">
          <span>{successMsg}</span>
          <button 
            onClick={() => setSuccessMsg(null)} 
            className="text-[10px] font-semibold underline hover:text-emerald-950 cursor-pointer"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="border border-red-100 bg-red-50/50 p-4 rounded-xl text-red-600 flex justify-between items-center animate-fade-in shadow-sm">
          <span>{errorMsg}</span>
          <button 
            onClick={() => setErrorMsg(null)} 
            className="text-[10px] font-semibold underline hover:text-red-800 cursor-pointer"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* 第一行：系统信息 与 存储分析 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 主机基础系统信息 */}
        <div className="border border-slate-200/80 bg-white p-6 rounded-xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-indigo-500" />
              {t('home.hostSystem')}
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{t('home.os')}</span>
                <span className="text-slate-800 font-medium capitalize">{systemInfo?.os || t('common.detecting')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{t('home.architecture')}</span>
                <span className="text-slate-800 font-medium">{systemInfo?.arch || t('common.detecting')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">{t('home.binaryProxy')}</span>
                <span 
                  onClick={() => setCurrentTab('settings')}
                  className="text-indigo-600 hover:text-indigo-700 underline cursor-pointer text-[10px] font-mono max-w-[180px] truncate" 
                  title={systemInfo?.fastboxHome ? systemInfo.fastboxHome + '/shims' : t('common.detecting')}
                >
                  {systemInfo?.fastboxHome ? `${systemInfo.fastboxHome}/shims` : t('common.detecting')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 存储空间分析与瘦身卡片 */}
        <div className="border border-slate-200/80 bg-white p-6 rounded-xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
                {t('home.storageTitle')}
              </span>
              <span className="text-slate-600 font-mono font-bold">
                {storage ? formatBytes(storage.totalSize) : '--'}
              </span>
            </h3>

            {/* 堆叠柱状图 */}
            {storage && storage.totalSize > 0 ? (
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex my-3">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300" 
                  style={{ width: getStoragePercentage(storage.packagesSize) }}
                  title={`${t('home.storagePackages')}: ${formatBytes(storage.packagesSize)}`}
                />
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300" 
                  style={{ width: getStoragePercentage(storage.cacheSize) }}
                  title={`${t('home.storageCache')}: ${formatBytes(storage.cacheSize)}`}
                />
                <div 
                  className="bg-amber-500 h-full transition-all duration-300" 
                  style={{ width: getStoragePercentage(storage.logsSize) }}
                  title={`${t('home.storageLogs')}: ${formatBytes(storage.logsSize)}`}
                />
              </div>
            ) : (
              <div className="h-2 w-full bg-slate-100 rounded-full my-3" />
            )}

            {/* 分类大小细节与清理操作 */}
            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  {t('home.storagePackages')}
                </span>
                <span className="text-slate-800 font-medium font-mono">{storage ? formatBytes(storage.packagesSize) : '--'}</span>
              </div>
              
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t('home.storageCache')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-800 font-medium font-mono">{storage ? formatBytes(storage.cacheSize) : '--'}</span>
                  <button
                    disabled={cleanLoading === 'cache' || !storage || storage.cacheSize === 0}
                    onClick={() => handleClean('cache')}
                    className="p-1 border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50/50 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('home.cleanCache')}
                  >
                    <Trash2 className={`h-3 w-3 ${cleanLoading === 'cache' ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {t('home.storageLogs')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-800 font-medium font-mono">{storage ? formatBytes(storage.logsSize) : '--'}</span>
                  <button
                    disabled={cleanLoading === 'logs' || !storage || storage.logsSize === 0}
                    onClick={() => handleClean('logs')}
                    className="p-1 border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50/50 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('home.cleanLogs')}
                  >
                    <Trash2 className={`h-3 w-3 ${cleanLoading === 'logs' ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 第二行：开发生态监控矩阵 */}
      <div className="border border-slate-200/80 bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-indigo-500" />
            {t('home.ecosystemTitle')}
          </h3>
          <p className="text-[9px] text-slate-400 mt-0.5">{t('home.ecosystemDesc')}</p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages.map((pkg) => {
              const isActive = !!pkg.activeVersion;
              return (
                <div 
                  key={pkg.name}
                  className="border border-slate-100 bg-slate-50/40 p-4 rounded-xl flex items-center justify-between hover:border-slate-200/80 transition-all duration-150 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{pkg.displayName}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>{t('home.activeVersion')}:</span>
                      <span className={isActive ? 'text-emerald-600 font-bold font-mono' : 'text-slate-400 font-medium'}>
                        {pkg.activeVersion || t('home.inactive')}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400/80">
                      {pkg.installedVersions.length > 0 
                        ? t('home.versions', { count: pkg.installedVersions.length })
                        : t('home.notInstalled')
                      }
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentTab(`detail-${pkg.name}`)}
                    className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 rounded-lg shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                  >
                    {t('home.manage')}
                    <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 第三行：最近活动 与 PATH 环境变量配置 */}
      <div className="border border-slate-200/80 bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>{t('home.activities')}</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* 最近活动历史 */}
          {activities.length === 0 ? (
            <p className="text-slate-400 text-center py-4">{t('logs.empty')}</p>
          ) : (
            <div className="space-y-3">
              {activities.map((act, index) => {
                let Icon = CheckCircle2;
                let iconColor = 'text-emerald-500';
                if (act.status === 'failed') {
                  Icon = AlertCircle;
                  iconColor = 'text-rose-500';
                } else if (act.status === 'running') {
                  Icon = RefreshCw;
                  iconColor = 'text-blue-500 animate-spin';
                }
                return (
                  <div key={index} className="flex items-start gap-3 text-slate-700 bg-slate-50/30 p-2.5 rounded-lg border border-slate-50">
                    <Icon className={`h-4.5 w-4.5 ${iconColor} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-800">{act.title}</span>
                        <span className="text-[9px] text-slate-400">{act.timeAgo}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-0.5">{act.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 智能环境变量配置诊断与写入 */}
          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <Terminal className={`h-4.5 w-4.5 ${
                !pathMissing ? 'text-emerald-500' : isConfiguredInRc ? 'text-blue-500' : 'text-amber-500'
              } mt-0.5 flex-shrink-0`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${
                    !pathMissing ? 'text-emerald-600' : isConfiguredInRc ? 'text-blue-600' : 'text-amber-600'
                  }`}>
                    {t('home.pathDiagnostic')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                    !pathMissing 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' 
                      : isConfiguredInRc 
                        ? 'bg-blue-50 border border-blue-200 text-blue-600' 
                        : 'bg-amber-50 border border-amber-200 text-amber-600'
                  }`}>
                    {!pathMissing ? 'OK' : isConfiguredInRc ? 'CONFIGURED' : t('home.warning')}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed max-w-md">
                  {!pathMissing 
                    ? t('home.pathDiagnosticOk') 
                    : isConfiguredInRc 
                      ? (language === 'zh' 
                          ? '环境变量已写入配置文件，请重启终端或应用以激活全局代理命令。' 
                          : 'Environment variables written. Please restart your terminal/app to apply changes.') 
                      : t('home.pathDiagnosticErr')
                  }
                </p>
              </div>
            </div>

            {pathMissing && !isConfiguredInRc && (
              <button
                disabled={configLoading}
                onClick={handleAutoConfig}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {configLoading ? t('settings.saving') : t('home.autoPathConfig')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
