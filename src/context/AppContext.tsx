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

  const mapBackendStatus = (backendStatus: string | undefined, progress: number): 'idle' | 'running' | 'success' | 'failed' => {
    if (!backendStatus) {
      return progress === 100 ? 'success' : 'running';
    }
    switch (backendStatus) {
      case 'completed':
      case 'success':
        return 'success';
      case 'failed':
        return 'failed';
      case 'running':
      case 'downloading':
      case 'extracting':
      case 'verifying':
      default:
        return progress === 100 ? 'success' : 'running';
    }
  };

  useEffect(() => {
    let isMounted = true;
    let cleanupProgress: (() => void) | null = null;
    let cleanupLog: (() => void) | null = null;

    refreshState();

    // 监听全局包安装进度事件
    const unlistenProgress = listen<{ taskId: string; stage: string; progress: number; message: string; packageName?: string; status?: string }>(
      'install-progress',
      (event) => {
        if (!isMounted) return;
        const { taskId, stage, progress, message, packageName, status } = event.payload;
        setActiveTask((prev) => {
          const isMatch = prev.taskId === taskId || (
            !prev.taskId && prev.packageName && (
              packageName === prev.packageName ||
              (event.payload as any).name === prev.packageName ||
              (taskId && taskId.startsWith(`task_${prev.packageName}_`))
            )
          );
          if (isMatch) {
            const mappedStatus = mapBackendStatus(status, progress);
            return {
              ...prev,
              taskId: prev.taskId || taskId,
              stage,
              progress,
              status: mappedStatus,
              errorMessage: mappedStatus === 'failed' ? message : prev.errorMessage,
              logs: [...prev.logs, `[${stage}] ${message}`].slice(-1000)
            };
          }
          return prev;
        });
      }
    );

    // 监听实时日志流事件
    const unlistenLog = listen<{ taskId: string; message: string; packageName?: string }>('install-log', (event) => {
      if (!isMounted) return;
      const { taskId, message, packageName } = event.payload;
      setActiveTask((prev) => {
        const isMatch = prev.taskId === taskId || (
          !prev.taskId && prev.packageName && (
            packageName === prev.packageName ||
            (event.payload as any).name === prev.packageName ||
            (taskId && taskId.startsWith(`task_${prev.packageName}_`))
          )
        );
        if (isMatch) {
          return {
            ...prev,
            taskId: prev.taskId || taskId,
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

  // 监听任务状态，在安装成功或失败后自动同步刷新本地包状态
  useEffect(() => {
    if (activeTask.status === 'success' || activeTask.status === 'failed') {
      refreshState();
    }
  }, [activeTask.status]);

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
