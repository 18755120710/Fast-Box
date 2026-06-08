import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 到 100
  stage: string;
  status: 'idle' | 'running' | 'success' | 'failed';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, stage, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-emerald-500';
    }
  };

  return (
    <div className="w-full font-mono">
      <div className="flex justify-between items-center mb-2 text-xs">
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
          )}
          <span className="text-slate-300 font-semibold">{stage || 'Preparing...'}</span>
        </div>
        <span className={`font-bold ${status === 'failed' ? 'text-red-500' : 'text-accent'}`}>{progress}%</span>
      </div>

      {/* 进度条轨道 */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-900">
        <div
          className={`h-full ${getStatusColor()} transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 底部详细辅助文本 */}
      <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-500">
        <span>Status: {status.toUpperCase()}</span>
        {status === 'running' && <span>Do not close the application</span>}
      </div>
    </div>
  );
};
