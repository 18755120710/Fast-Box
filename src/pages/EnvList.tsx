import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronRight, Database } from 'lucide-react';

export const EnvList: React.FC = () => {
  const { packages, setCurrentTab, t } = useApp();

  const environmentList = packages.length > 0 ? packages : [
    {
      name: 'node',
      displayName: 'Node.js',
      installedVersions: [],
      activeVersion: undefined,
      availableVersions: [],
      status: 'not_installed'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{t('env.title')}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {t('env.description')}
        </p>
      </div>

      <div className="space-y-4">
        {environmentList.map((pkg) => {
          const isInstalled = pkg.installedVersions.length > 0;
          const isActive = !!pkg.activeVersion;

          return (
            <div
              key={pkg.name}
              onClick={() => setCurrentTab(`detail-${pkg.name}`)}
              className="group border border-slate-200/80 bg-white p-6 rounded-xl flex items-center justify-between cursor-pointer shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                {/* 运行图标 */}
                <div className="h-11 w-11 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all duration-200 shadow-sm">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-slate-900">{pkg.displayName}</h3>
                    {isActive && (
                      <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        {t('env.active', { version: pkg.activeVersion })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('env.cardDescription')}
                  </p>
                </div>
              </div>

              {/* 状态与控制区 */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <div className="text-right hidden sm:block">
                  <div className="text-slate-700 font-medium">
                    {isInstalled ? t('env.installedCount', { count: pkg.installedVersions.length }) : t('env.notInstalled')}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    {isActive ? t('env.shimActive') : t('env.noActiveVersion')}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
