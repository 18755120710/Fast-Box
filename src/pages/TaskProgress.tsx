import React from 'react';
import { useApp } from '../context/AppContext';
import { ProgressBar } from '../components/ProgressBar';
import { LogPanel } from '../components/LogPanel';
import { CheckCircle2, AlertOctagon, Terminal } from 'lucide-react';

export const TaskProgress: React.FC = () => {
  const { activeTask, clearActiveTask } = useApp();

  const isIdle = activeTask.status === 'idle';

  return (
    <div className="space-y-6 animate-fade-in font-mono text-xs">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Build & Install Task</h2>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Realtime status log of system binary configurations.
        </p>
      </div>

      {isIdle ? (
        <div className="border border-slate-800 bg-slate-950 p-10 rounded text-center text-slate-500 space-y-3">
          <Terminal className="h-8 w-8 text-slate-600 mx-auto" />
          <div>No active installation task in queue.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 进度显示板 */}
          <div className="border border-slate-800 bg-slate-950 p-5 rounded space-y-4">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-bold">
                {activeTask.packageName.toUpperCase()} @ {activeTask.version}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Task ID: {activeTask.taskId || 'Registering...'}
              </span>
            </div>

            <ProgressBar
              progress={activeTask.progress}
              stage={activeTask.stage}
              status={activeTask.status}
            />

            {/* 完成/错误 状态卡片 */}
            {activeTask.status === 'success' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-accent rounded flex items-center gap-3 animate-fade-in">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <span className="font-bold">Installation Succeeded.</span> You can now switch to this version in the Environment details.
                </div>
              </div>
            )}

            {activeTask.status === 'failed' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded flex items-center gap-3 animate-fade-in">
                <AlertOctagon className="h-5 w-5" />
                <div>
                  <span className="font-bold">Installation Failed:</span> {activeTask.errorMessage}
                </div>
              </div>
            )}

            {(activeTask.status === 'success' || activeTask.status === 'failed') && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={clearActiveTask}
                  className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-bold cursor-pointer"
                >
                  Clear Task
                </button>
              </div>
            )}
          </div>

          {/* 终端实时日志面板 */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Real-time Stdout Streams</h3>
            <LogPanel logs={activeTask.logs} />
          </div>
        </div>
      )}
    </div>
  );
};
