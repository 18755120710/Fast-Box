import React from 'react';
import { useApp } from '../context/AppContext';

interface ProgressBarProps {
  progress: number; // 0 到 100
  stage: string;
  status: 'idle' | 'running' | 'success' | 'failed';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, stage, status }) => {
  const { t } = useApp();

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
    <div className="w-full font-sans">
      <div className="flex justify-between items-center mb-2 text-xs">
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <span className="text-slate-700 font-semibold">{stage || t('progress.preparing')}</span>
        </div>
        <span className={`font-bold ${status === 'failed' ? 'text-red-500' : 'text-emerald-600'}`}>{progress}%</span>
      </div>

      {/* 进度条轨道 */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
        <div
          className={`h-full ${getStatusColor()} transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 底部详细辅助文本 */}
      <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-400">
        <span>{t('progress.status')}: <span className="font-semibold text-slate-500">{status.toUpperCase()}</span></span>
        {status === 'running' && <span className="text-slate-400 font-medium">{t('progress.doNotClose')}</span>}
      </div>
    </div>
  );
};
