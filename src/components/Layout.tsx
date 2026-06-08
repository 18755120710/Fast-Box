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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-slate-100 font-mono">
      {/* 侧边栏 */}
      <aside className="w-64 border-r border-slate-800 bg-slate-955 bg-slate-950 flex flex-col justify-between select-none">
        <div>
          {/* Logo / 品牌标识 */}
          <div className="h-16 flex items-center px-6 border-b border-slate-900 gap-3">
            <div className="h-8 w-8 rounded bg-emerald-500/10 border border-emerald-500 flex items-center justify-center">
              <span className="text-accent font-bold text-sm">F</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest text-slate-100">FAST BOX</h1>
              <span className="text-[10px] text-accent font-semibold">{t('brand.subtitle')}</span>
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs transition-all duration-200 ease-in-out cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 border border-slate-800 text-accent font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 底部系统状态 */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/80 text-[10px] space-y-3">
          <div className="space-y-1.5 text-slate-400">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate">{t('layout.arch')}: <span className="text-slate-200">{systemInfo?.arch || t('common.detecting')}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate" title={systemInfo?.fastboxHome}>
                {t('layout.home')}: <span className="text-slate-200">{systemInfo?.fastboxHome ? '~/.fastbox' : t('common.detecting')}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] text-slate-500">{t('layout.coreConnected')}</span>
            </div>
            <span className="text-[9px] text-slate-500 font-bold">v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* 主展示区 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-900/40">
        {/* 页头 */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between px-8 select-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{currentTab.startsWith('detail-') ? t('layout.environmentDetail') : menuItems.find((item) => item.id === currentTab)?.label ?? currentTab}</span>
            {activeTask.status === 'running' && (
              <span className="text-[10px] lowercase text-accent font-normal bg-accent/10 px-2 py-0.5 rounded border border-accent/20 animate-pulse">
                {t('layout.installing', { package: activeTask.packageName, version: activeTask.version })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded text-[10px] font-bold ${language === 'en' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`px-2 py-1 rounded text-[10px] font-bold ${language === 'zh' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                中
              </button>
            </div>
            <div>
              {t('layout.settingsShortcut')} <kbd className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded text-[10px] border border-slate-700">⌘,</kbd> {t('layout.settingsShortcutTail')}
            </div>
          </div>
        </header>

        {/* 内容容器 */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};
