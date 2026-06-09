import React from 'react';
import { useApp } from '../context/AppContext';
import { ProgressBar } from '../components/ProgressBar';
import { LogPanel } from '../components/LogPanel';
import { CheckCircle2, AlertOctagon, Terminal } from 'lucide-react';

export const TaskProgress: React.FC = () => {
  const { activeTask, clearActiveTask, refreshState, t } = useApp();

  const isIdle = activeTask.status === 'idle';

  return (
    <div className="space-y-6 animate-fade-in font-sans text-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{t('task.title')}</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {t('task.description')}
        </p>
      </div>

      {isIdle ? (
        <div className="border border-slate-200/80 bg-white p-12 rounded-xl text-center text-slate-400 space-y-4 shadow-sm">
          <Terminal className="h-8 w-8 text-slate-300 mx-auto" />
          <div className="text-slate-500 font-medium">{t('task.noActive')}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 进度显示板 */}
          <div className="border border-slate-200/80 bg-white p-6 rounded-xl space-y-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-800">
              <span className="font-bold text-sm">
                {activeTask.packageName.toUpperCase()} @ {activeTask.version}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {t('task.taskId')}: {activeTask.taskId || t('task.registering')}
              </span>
            </div>

            <ProgressBar
              progress={activeTask.progress}
              stage={activeTask.stage}
              status={activeTask.status}
            />

            {/* 完成/错误 状态卡片 */}
            {activeTask.status === 'success' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 animate-fade-in">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <span className="font-bold">{t('task.successTitle')}</span> {t('task.successBody')}
                </div>
              </div>
            )}

            {activeTask.status === 'failed' && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3 animate-fade-in">
                <AlertOctagon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <span className="font-bold">{t('task.failedTitle')}</span> {activeTask.errorMessage}
                </div>
              </div>
            )}

            {(activeTask.status === 'success' || activeTask.status === 'failed') && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={async () => {
                    clearActiveTask();
                    await refreshState();
                  }}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all duration-150"
                >
                  {t('task.clear')}
                </button>
              </div>
            )}
          </div>

          {/* 终端实时日志面板 */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t('task.streams')}</h3>
            <LogPanel logs={activeTask.logs} />
          </div>
        </div>
      )}
    </div>
  );
};
