import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const Home: React.FC = () => {
  const { systemInfo, packages, refreshState } = useApp();

  const activeNode = packages.find((p) => p.name === 'node');
  const activeVersion = activeNode?.activeVersion;

  return (
    <div className="space-y-8 animate-fade-in font-mono">
      {/* 欢迎语与系统简介 */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          Dashboard <span className="text-[10px] text-accent font-normal bg-accent/10 px-2 py-0.5 rounded border border-accent/20">MVP RUNNING</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Fast Box manages local development toolchains in isolation (~/.fastbox).
        </p>
      </div>

      {/* 核心卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 系统基础信息 */}
        <div className="border border-slate-800 bg-slate-955 bg-slate-950 p-5 rounded relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Host System</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Operating System</span>
              <span className="text-slate-200 capitalize">{systemInfo?.os || 'detecting...'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Architecture</span>
              <span className="text-slate-200">{systemInfo?.arch || 'detecting...'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Binary Path Proxy</span>
              <span className="text-accent underline cursor-pointer text-[10px] max-w-[180px] truncate" title={systemInfo?.fastboxHome ? systemInfo.fastboxHome + '/shims' : 'detecting...'}>
                {systemInfo?.fastboxHome ? `${systemInfo.fastboxHome}/shims` : 'detecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* 激活的环境信息 */}
        <div className="border border-slate-800 bg-slate-950 p-5 rounded relative overflow-hidden">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Active Toolchain</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Runtime Env</span>
              <span className="text-slate-200 font-semibold">{activeNode?.displayName || 'Node.js'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Active Version</span>
              <span className={activeVersion ? 'text-accent font-bold' : 'text-slate-500'}>
                {activeVersion || 'None (Inactive)'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Total Installed</span>
              <span className="text-slate-200">{activeNode?.installedVersions.length || 0} versions</span>
            </div>
          </div>
        </div>
      </div>

      {/* 最近活动与错误日志区域 */}
      <div className="border border-slate-800 bg-slate-950 rounded overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Shield className="h-4 w-4 text-accent" />
            <span>RECENT ACTIVITIES & ALERTS</span>
          </div>
          <button
            onClick={refreshState}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-5 text-xs space-y-3">
          {/* 最近历史 */}
          <div className="flex items-start gap-3 text-slate-300">
            <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold">Shim layer generated successfully</span>
                <span className="text-[10px] text-slate-500">Just now</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Symlink mapping updated for Node.js executable wrappers in ~/.fastbox/shims</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-slate-300">
            <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold">Package cache updated</span>
                <span className="text-[10px] text-slate-500">2 hours ago</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Downloaded registry data from Huawei Cloud mirror for Node.js v24.16.0 LTS</p>
            </div>
          </div>

          {/* 异常警示展示 */}
          <div className="flex items-start gap-3 border-t border-slate-900 pt-3 text-slate-300">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-semibold text-yellow-500">Shim Path missing from $PATH</span>
                <span className="text-[10px] text-slate-500">Warning</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Fast Box executable paths must be included in your shell startup file. Go to Settings for terminal configuration instructions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
