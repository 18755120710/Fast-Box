import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createTranslator, getInitialLanguage, Language } from '../i18n';

// 接口类型定义
export interface SystemInfo {
  os: string;
  arch: string;
  fastboxHome: string;
}

export interface PackageStatus {
  name: string;
  displayName: string;
  installedVersions: string[];
  activeVersion?: string;
  availableVersions: string[];
  status: string;
  systemVersion?: string;
}

export interface TaskState {
  taskId: string;
  packageName: string;
  version: string;
  stage: string;
  progress: number;
  logs: string[];
  status: 'idle' | 'running' | 'success' | 'failed';
  errorMessage?: string;
}

interface AppContextType {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  systemInfo: SystemInfo | null;
  packages: PackageStatus[];
  activeTask: TaskState;
  language: Language;
  setLanguage: (language: Language) => void;
  t: ReturnType<typeof createTranslator>;
  refreshState: () => Promise<void>;
  startInstall: (packageName: string, version: string) => Promise<void>;
  clearActiveTask: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [packages, setPackages] = useState<PackageStatus[]>([]);
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage());
  const [activeTask, setActiveTask] = useState<TaskState>({
    taskId: '',
    packageName: '',
    version: '',
    stage: '',
    progress: 0,
    logs: [],
    status: 'idle'
  });
  const t = createTranslator(language);

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem('fastbox.language', nextLanguage);
    setLanguageState(nextLanguage);
  };

  const refreshState = async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
      const list = await invoke<PackageStatus[]>('list_packages');
      setPackages(list);
    } catch (err) {
      console.error('Failed to fetch data from Tauri core:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let cleanupProgress: (() => void) | null = null;
    let cleanupLog: (() => void) | null = null;

    refreshState();

    // 监听全局包安装进度事件
    const unlistenProgress = listen<{ task_id: string; stage: string; progress: number; message: string; package_name?: string }>(
      'install-progress',
      (event) => {
        if (!isMounted) return;
        const { task_id, stage, progress, message } = event.payload;
        setActiveTask((prev) => {
          const isMatch = prev.taskId === task_id || (
            !prev.taskId && prev.packageName && (
              event.payload.package_name === prev.packageName ||
              (event.payload as any).name === prev.packageName ||
              task_id.startsWith(`task_${prev.packageName}_`)
            )
          );
          if (isMatch) {
            return {
              ...prev,
              taskId: prev.taskId || task_id,
              stage,
              progress,
              status: progress === 100 ? 'success' : 'running',
              logs: [...prev.logs, `[${stage}] ${message}`].slice(-1000)
            };
          }
          return prev;
        });
      }
    );

    // 监听实时日志流事件
    const unlistenLog = listen<{ task_id: string; message: string; package_name?: string }>('install-log', (event) => {
      if (!isMounted) return;
      const { task_id, message } = event.payload;
      setActiveTask((prev) => {
        const isMatch = prev.taskId === task_id || (
          !prev.taskId && prev.packageName && (
            event.payload.package_name === prev.packageName ||
            (event.payload as any).name === prev.packageName ||
            task_id.startsWith(`task_${prev.packageName}_`)
          )
        );
        if (isMatch) {
          return {
            ...prev,
            taskId: prev.taskId || task_id,
            logs: [...prev.logs, message].slice(-1000)
          };
        }
        return prev;
      });
    });

    unlistenProgress.then((fn) => {
      if (isMounted) {
        cleanupProgress = fn;
      } else {
        fn();
      }
    }).catch((err) => console.error('Failed to listen to install-progress:', err));

    unlistenLog.then((fn) => {
      if (isMounted) {
        cleanupLog = fn;
      } else {
        fn();
      }
    }).catch((err) => console.error('Failed to listen to install-log:', err));

    return () => {
      isMounted = false;
      if (cleanupProgress) {
        cleanupProgress();
      }
      if (cleanupLog) {
        cleanupLog();
      }
    };
  }, []);

  const startInstall = async (packageName: string, version: string) => {
    try {
      setActiveTask({
        taskId: '',
        packageName,
        version,
        stage: 'Initializing',
        progress: 0,
        logs: [t('task.startingInstall', { package: packageName, version })],
        status: 'running'
      });
      setCurrentTab('progress');

      // 调用后端启动异步安装
      const taskId = await invoke<string>('install_package_version', { name: packageName, version });
      setActiveTask((prev) => ({ ...prev, taskId }));
    } catch (err: any) {
      setActiveTask((prev) => ({
        ...prev,
        status: 'failed',
        errorMessage: err.toString(),
        logs: [...prev.logs, t('task.errorLog', { error: String(err) })].slice(-1000)
      }));
    }
  };

  const clearActiveTask = () => {
    setActiveTask({
      taskId: '',
      packageName: '',
      version: '',
      stage: '',
      progress: 0,
      logs: [],
      status: 'idle'
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        systemInfo,
        packages,
        activeTask,
        language,
        setLanguage,
        t,
        refreshState,
        startInstall,
        clearActiveTask
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
