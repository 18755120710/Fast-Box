import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, Check, Copy, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const Settings: React.FC = () => {
  const { systemInfo, language, setLanguage, t, refreshState } = useApp();
  const [workspace, setWorkspace] = useState('~/.fastbox');
  const [registryMode, setRegistryMode] = useState('huawei'); // 'official' | 'huawei' | 'custom'
  const [customRegistry, setCustomRegistry] = useState('https://registry.npmmirror.com');
  const [localLanguage, setLocalLanguage] = useState<'en' | 'zh'>('zh');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<{
          workspacePath: string;
          registryMode: string;
          customRegistry: string;
          language: string;
        }>('get_settings');
        setWorkspace(settings.workspacePath);
        setRegistryMode(settings.registryMode);
        setCustomRegistry(settings.customRegistry);
        setLocalLanguage(settings.language as 'en' | 'zh');
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await invoke('save_settings', {
        settings: {
          workspacePath: workspace,
          registryMode,
          customRegistry,
          language: localLanguage,
        }
      });
      setLanguage(localLanguage);
      await refreshState();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
      setErrorMessage(err.toString());
    } finally {
      setSaving(false);
    }
  };

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
    <div className="space-y-6 animate-fade-in font-sans text-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          {t('settings.title')} <SettingsIcon className="h-5 w-5 text-slate-700" />
        </h2>
        <p className="text-[10px] text-slate-400 mt-0.5">{t('settings.description')}</p>
      </div>

      {/* 语言设置 */}
      <div className="border border-slate-200/80 bg-white p-6 rounded-xl space-y-4 shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-2.5">
          {t('settings.languageTitle')}
        </h3>
        <div className="space-y-2.5">
          <label className="text-slate-500 font-medium block">{t('settings.languageLabel')}</label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-inner">
            <button
              onClick={() => setLocalLanguage('en')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-150 cursor-pointer ${localLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => setLocalLanguage('zh')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-150 cursor-pointer ${localLanguage === 'zh' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {t('settings.chinese')}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">{t('settings.languageDescription')}</p>
        </div>
      </div>

      {/* 工作目录配置 */}
      <div className="border border-slate-200/80 bg-white p-6 rounded-xl space-y-4 shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-2.5">
          {t('settings.rootTitle')}
        </h3>
        <div className="space-y-2.5">
          <label className="text-slate-500 font-medium block">{t('settings.workspacePath')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all duration-150 shadow-sm text-xs font-mono"
            />
            <button 
              onClick={() => alert(localLanguage === 'zh' ? '请直接在输入框中输入工作区绝对路径。' : 'Please input the absolute workspace path directly in the text box.')}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-colors duration-150"
            >
              {t('settings.browse')}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            {t('settings.workspaceDescription')}
          </p>
        </div>
      </div>

      {/* 镜像偏好与 Registry 地址 */}
      <div className="border border-slate-200/80 bg-white p-6 rounded-xl space-y-4 shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-100 pb-2.5">
          {t('settings.registryTitle')}
        </h3>
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 华为源 */}
            <label className={`flex-1 border p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150 shadow-sm ${
              registryMode === 'huawei'
                ? 'border-slate-800 bg-slate-50/50'
                : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/30'
            }`}>
              <div className="space-y-1">
                <span className="font-bold text-slate-800">{t('settings.huawei')}</span>
                <p className="text-[9px] text-slate-400">{t('settings.huaweiBody')}</p>
              </div>
              <input
                type="radio"
                name="registry"
                checked={registryMode === 'huawei'}
                onChange={() => setRegistryMode('huawei')}
                className="accent-slate-900 h-4 w-4 cursor-pointer"
              />
            </label>

            {/* 官方源 */}
            <label className={`flex-1 border p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150 shadow-sm ${
              registryMode === 'official'
                ? 'border-slate-800 bg-slate-50/50'
                : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/30'
            }`}>
              <div className="space-y-1">
                <span className="font-bold text-slate-800">{t('settings.official')}</span>
                <p className="text-[9px] text-slate-400">{t('settings.officialBody')}</p>
              </div>
              <input
                type="radio"
                name="registry"
                checked={registryMode === 'official'}
                onChange={() => setRegistryMode('official')}
                className="accent-slate-900 h-4 w-4 cursor-pointer"
              />
            </label>
          </div>

          {/* NPM Registry 配置 */}
          <div className="space-y-2 pt-2">
            <label className="text-slate-500 font-medium block">{t('settings.npmRegistry')}</label>
            <input
              type="text"
              value={customRegistry}
              onChange={(e) => setCustomRegistry(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all duration-150 shadow-sm text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400">
              {t('settings.npmRegistryBody')}
            </p>
          </div>
        </div>
      </div>

      {/* PATH 环境变量引导提示 */}
      <div className="border border-amber-200 bg-amber-50/20 p-6 rounded-xl space-y-4 shadow-sm">
        <h3 className="font-bold text-amber-700 uppercase tracking-wider text-[10px] flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
          {t('settings.pathTitle')}
        </h3>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          {t('settings.pathBody')}
        </p>

        {/* 环境变量命令复制盒 */}
        <div className="bg-[#090D16] border border-slate-200/20 rounded-lg p-3.5 flex items-center justify-between gap-4 font-mono text-[11px] text-slate-200 shadow-sm">
          <code className="text-emerald-400 select-all font-mono">{getPathExportCommand()}</code>
          <button
            onClick={handleCopyPath}
            className="flex-shrink-0 p-2 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
            title={t('settings.copyCommandTitle')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* 引导步骤 */}
        <div className="space-y-2 text-[10px] text-slate-500 pt-1">
          <div className="font-semibold text-slate-700">{t('settings.howToApply')}</div>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>{t('settings.step1')}</li>
            <li>{t('settings.step2')} <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 font-mono">~/.zshrc</code> / <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 font-mono">~/.bash_profile</code>.</li>
            <li>{t('settings.step3')}</li>
            <li>{t('settings.step4')} <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 font-mono">source ~/.zshrc</code>.</li>
          </ol>
        </div>
      </div>

      {/* 操作反馈与保存按钮 */}
      <div className="border border-slate-200/80 bg-white p-6 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex-1 mr-4">
          {saveStatus === 'success' && (
            <p className="text-emerald-600 font-bold flex items-center gap-1.5 animate-fade-in text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              {t('settings.saveSuccess')}
            </p>
          )}
          {saveStatus === 'error' && (
            <p className="text-rose-600 font-bold text-[10px]">
              {t('settings.saveFailed', { error: errorMessage })}
            </p>
          )}
          {!saveStatus && (
            <p className="text-slate-400 text-[10px]">
              {t('settings.workspaceDescription')}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-colors duration-150 flex items-center gap-2"
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>
    </div>
  );
};
