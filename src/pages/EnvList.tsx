import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronRight, Database } from 'lucide-react';

export const EnvList: React.FC = () => {
  const { packages, setCurrentTab } = useApp();

  const environmentList = packages.length > 0 ? packages : [
    {
      name: 'node',
      displayName: 'Node.js',
      installedVersions: [],
      activeVersion: undefined,
      availableVersions: [],
      status: 'Not Installed'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in font-mono">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Development Environments</h2>
        <p className="text-xs text-slate-400 mt-1">
          Select a development ecosystem below to manage target runtime environments.
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
              className="group border border-slate-800 bg-slate-950 p-5 rounded flex items-center justify-between cursor-pointer hover:border-accent/40 transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                {/* 运行图标 */}
                <div className="h-10 w-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:border-accent/20 group-hover:text-accent transition-colors duration-200">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-200 group-hover:text-slate-100">{pkg.displayName}</h3>
                    {isActive && (
                      <span className="text-[9px] bg-accent/10 border border-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">
                        ACTIVE: {pkg.activeVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Manage installation, update symlinks and verify binary execution compatibility.
                  </p>
                </div>
              </div>

              {/* 状态与控制区 */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <div className="text-right hidden sm:block">
                  <div className="text-slate-300">
                    {isInstalled ? `${pkg.installedVersions.length} Installed` : 'Not Installed'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {isActive ? 'Shim active' : 'No active version'}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
