import React from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Layers, Play, Settings as SettingsIcon, Cpu, HardDrive } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentTab, setCurrentTab, systemInfo, activeTask, language, setLanguage, t } = useApp();

  const menuItems = [
    { id: 'home', label: t('nav.dashboard'), icon: Terminal },
    { id: 'env', label: t('nav.environments'), icon: Layers },
    { id: 'progress', label: t('nav.progress'), icon: Play, badge: activeTask.status === 'running' },
    { id: 'settings', label: t('nav.settings'), icon: SettingsIcon }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-slate-800 font-sans">
      {/* 侧边栏 */}
      <aside className="w-64 border-r border-slate-200/80 bg-slate-50 flex flex-col justify-between select-none">
        <div>
          {/* Logo / 品牌标识 */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200/60 gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-slate-800">FAST BOX</h1>
              <span className="text-[9px] text-slate-400 font-semibold tracking-wider">{t('brand.subtitle')}</span>
            </div>
          </div>

          {/* 导航菜单 */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id || (item.id === 'env' && currentTab.startsWith('detail-'));
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-150 ease-in-out cursor-pointer border border-transparent ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 底部系统状态 */}
        <div className="p-4 border-t border-slate-200/60 bg-slate-100/40 text-[10px] space-y-3">
          <div className="space-y-1.5 text-slate-500">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate">{t('layout.arch')}: <span className="text-slate-700 font-medium">{systemInfo?.arch || t('common.detecting')}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate" title={systemInfo?.fastboxHome}>
                {t('layout.home')}: <span className="text-slate-700 font-medium">{systemInfo?.fastboxHome ? '~/.fastbox' : t('common.detecting')}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 animate-pulse"></span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{t('layout.coreConnected')}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* 主展示区 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* 页头 */}
        <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 select-none">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-700">
            <span>{currentTab.startsWith('detail-') ? t('layout.environmentDetail') : menuItems.find((item) => item.id === currentTab)?.label ?? currentTab}</span>
            {activeTask.status === 'running' && (
              <span className="text-[10px] text-emerald-600 font-normal bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/80 animate-pulse ml-2">
                {t('layout.installing', { package: activeTask.packageName, version: activeTask.version })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="relative flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/50">
              <button
                onClick={() => setLanguage('en')}
                className={`relative z-10 px-3 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`relative z-10 px-3 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 cursor-pointer ${
                  language === 'zh'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                中
              </button>
            </div>
            <div className="text-slate-400 flex items-center">
              {t('layout.settingsShortcut')}&nbsp;
              <kbd className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] border border-slate-200 shadow-sm font-sans mx-1">⌘ ,</kbd>
              &nbsp;{t('layout.settingsShortcutTail')}
            </div>
          </div>
        </header>

        {/* 内容容器 */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/40">
          <div className="max-w-4xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};
