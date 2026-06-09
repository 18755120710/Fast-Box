import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const Home: React.FC = () => {
  const { systemInfo, packages, refreshState, t } = useApp();

  const activeNode = packages.find((p) => p.name === 'node');
  const activeVersion = activeNode?.activeVersion;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* 欢迎语与系统简介 */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          {t('home.title')}{' '}
          <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/80">
            {t('home.badge')}
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {t('home.description')}
        </p>
      </div>

      {/* 核心卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 系统基础信息 */}
        <div className="border border-slate-200/80 bg-white p-6 rounded-xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t('home.hostSystem')}</h3>
          <div className="space-y-2.5 text-xs">
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
              <span className="text-emerald-600 hover:text-emerald-700 underline cursor-pointer text-[10px] font-mono max-w-[180px] truncate" title={systemInfo?.fastboxHome ? systemInfo.fastboxHome + '/shims' : t('common.detecting')}>
                {systemInfo?.fastboxHome ? `${systemInfo.fastboxHome}/shims` : t('common.detecting')}
              </span>
            </div>
          </div>
        </div>

        {/* 激活的环境信息 */}
        <div className="border border-slate-200/80 bg-white p-6 rounded-xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t('home.activeToolchain')}</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">{t('home.runtimeEnv')}</span>
              <span className="text-slate-800 font-semibold">{activeNode?.displayName || 'Node.js'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">{t('home.activeVersion')}</span>
              <span className={activeVersion ? 'text-emerald-600 font-bold font-mono' : 'text-slate-400 font-medium'}>
                {activeVersion || t('home.noneInactive')}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">{t('home.totalInstalled')}</span>
              <span className="text-slate-800 font-medium">{t('home.versions', { count: activeNode?.installedVersions.length || 0 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 最近活动与错误日志区域 */}
      <div className="border border-slate-200/80 bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>{t('home.activities')}</span>
          </div>
          <button
            onClick={refreshState}
            className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-transparent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-6 text-xs space-y-4">
          {/* 最近历史 */}
          <div className="flex items-start gap-3 text-slate-700">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">{t('home.shimGenerated')}</span>
                <span className="text-[10px] text-slate-400">{t('home.justNow')}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{t('home.shimGeneratedBody')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-slate-700">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">{t('home.cacheUpdated')}</span>
                <span className="text-[10px] text-slate-400">{t('home.twoHoursAgo')}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{t('home.cacheUpdatedBody')}</p>
            </div>
          </div>

          {/* 异常警示展示 */}
          <div className="flex items-start gap-3 border-t border-slate-100 pt-4 text-slate-700">
            <AlertCircle className="h-4.5 w-4.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold text-amber-600">{t('home.pathMissing')}</span>
                <span className="text-[10px] text-slate-400 font-medium">{t('home.warning')}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                {t('home.pathMissingBody')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
