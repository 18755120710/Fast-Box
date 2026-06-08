import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, Check, Copy, AlertTriangle } from 'lucide-react';

export const Settings: React.FC = () => {
  const { systemInfo, language, setLanguage, t } = useApp();
  const [workspace, setWorkspace] = useState('~/.fastbox');
  const [registryMode, setRegistryMode] = useState('huawei'); // 'official' | 'huawei' | 'custom'
  const [customRegistry, setCustomRegistry] = useState('https://registry.npmmirror.com');
  const [copied, setCopied] = useState(false);

  const getPathExportCommand = () => {
    const shimsDir = systemInfo?.fastboxHome 
      ? `${systemInfo.fastboxHome}/shims` 
      : '$HOME/.fastbox/shims';
    return `export PATH="${shimsDir}:$PATH"`;
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(getPathExportCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in font-mono text-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          {t('settings.title')} <SettingsIcon className="h-5 w-5 text-accent" />
        </h2>
        <p className="text-[10px] text-slate-500 mt-0.5">{t('settings.description')}</p>
      </div>

      {/* 语言设置 */}
      <div className="border border-slate-800 bg-slate-950 p-5 rounded space-y-4">
        <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] border-b border-slate-900 pb-2">
          {t('settings.languageTitle')}
        </h3>
        <div className="space-y-2">
          <label className="text-slate-400 block">{t('settings.languageLabel')}</label>
          <div className="inline-flex rounded border border-slate-800 bg-slate-900 p-1">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${language === 'en' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${language === 'zh' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t('settings.chinese')}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">{t('settings.languageDescription')}</p>
        </div>
      </div>

      {/* 工作目录配置 */}
      <div className="border border-slate-800 bg-slate-950 p-5 rounded space-y-4">
        <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] border-b border-slate-900 pb-2">
          {t('settings.rootTitle')}
        </h3>
        <div className="space-y-2">
          <label className="text-slate-400 block">{t('settings.workspacePath')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-accent"
            />
            <button className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded font-bold cursor-pointer">
              {t('settings.browse')}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {t('settings.workspaceDescription')}
          </p>
        </div>
      </div>

      {/* 镜像偏好与 Registry 地址 */}
      <div className="border border-slate-800 bg-slate-950 p-5 rounded space-y-4">
        <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] border-b border-slate-900 pb-2">
          {t('settings.registryTitle')}
        </h3>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 华为源 */}
            <label className="flex-1 border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-accent/40 rounded p-3 flex items-center justify-between cursor-pointer transition-colors duration-150">
              <div className="space-y-1">
                <span className="font-bold text-slate-200">{t('settings.huawei')}</span>
                <p className="text-[9px] text-slate-500">{t('settings.huaweiBody')}</p>
              </div>
              <input
                type="radio"
                name="registry"
                checked={registryMode === 'huawei'}
                onChange={() => setRegistryMode('huawei')}
                className="accent-accent"
              />
            </label>

            {/* 官方源 */}
            <label className="flex-1 border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-accent/40 rounded p-3 flex items-center justify-between cursor-pointer transition-colors duration-150">
              <div className="space-y-1">
                <span className="font-bold text-slate-200">{t('settings.official')}</span>
                <p className="text-[9px] text-slate-500">{t('settings.officialBody')}</p>
              </div>
              <input
                type="radio"
                name="registry"
                checked={registryMode === 'official'}
                onChange={() => setRegistryMode('official')}
                className="accent-accent"
              />
            </label>
          </div>

          {/* NPM Registry 配置 */}
          <div className="space-y-2 pt-2">
            <label className="text-slate-400 block">{t('settings.npmRegistry')}</label>
            <input
              type="text"
              value={customRegistry}
              onChange={(e) => setCustomRegistry(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-accent"
            />
            <p className="text-[10px] text-slate-500">
              {t('settings.npmRegistryBody')}
            </p>
          </div>
        </div>
      </div>

      {/* PATH 环境变量引导提示 */}
      <div className="border border-yellow-500/20 bg-yellow-500/5 p-5 rounded space-y-4">
        <h3 className="font-bold text-yellow-500 uppercase tracking-wider text-[10px] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {t('settings.pathTitle')}
        </h3>
        <p className="text-[10px] text-slate-300 leading-relaxed">
          {t('settings.pathBody')}
        </p>

        {/* 环境变量命令复制盒 */}
        <div className="bg-slate-950 border border-slate-800 rounded p-3 flex items-center justify-between gap-4 font-mono text-[11px] text-slate-200">
          <code className="text-accent select-all">{getPathExportCommand()}</code>
          <button
            onClick={handleCopyPath}
            className="flex-shrink-0 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded cursor-pointer transition-colors duration-150"
            title={t('settings.copyCommandTitle')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* 引导步骤 */}
        <div className="space-y-2 text-[10px] text-slate-400 pt-1">
          <div className="font-semibold text-slate-300">{t('settings.howToApply')}</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>{t('settings.step1')}</li>
            <li>{t('settings.step2')} <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">~/.zshrc</code> / <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">~/.bash_profile</code>.</li>
            <li>{t('settings.step3')}</li>
            <li>{t('settings.step4')} <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">source ~/.zshrc</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
