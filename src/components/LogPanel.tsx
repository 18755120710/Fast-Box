import React, { useEffect, useRef, useState } from 'react';
import { Copy, Terminal, Check, ArrowDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LogPanelProps {
  logs: string[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const { t } = useApp();
  const [filterText, setFilterText] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((log) =>
    log.toLowerCase().includes(filterText.toLowerCase())
  );

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // 判断是否已经滚动到底部
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="border border-slate-800 rounded bg-slate-950 font-mono text-xs flex flex-col h-96 overflow-hidden relative">
      {/* 终端控制头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="h-3.5 w-3.5 text-accent" />
          <span>{t('logs.title')}</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
            {t('common.lines', { count: filteredLogs.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 过滤搜索 */}
          <input
            type="text"
            placeholder={t('logs.filter')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-slate-300 focus:outline-none focus:border-accent w-32 transition-colors duration-150"
          />
          {/* 复制 */}
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
            title={t('logs.copyTitle')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 终端内容 */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-1 bg-slate-950 text-slate-300 scrollbar-thin animate-fade-in"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            {t('logs.empty')}
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('fail');
            const isSuccess = log.toLowerCase().includes('success') || log.toLowerCase().includes('done');
            return (
              <div
                key={index}
                className={`whitespace-pre-wrap leading-relaxed ${
                  isError ? 'text-red-400 bg-red-950/20' : isSuccess ? 'text-accent' : 'text-slate-300'
                }`}
              >
                <span className="text-slate-600 select-none mr-3 inline-block w-8 text-right font-mono">
                  {index + 1}
                </span>
                {log}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      {/* 底部悬浮置底按钮 */}
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-6 right-6 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1 shadow-lg cursor-pointer"
        >
          <ArrowDown className="h-3 w-3" /> {t('logs.autoScroll')}
        </button>
      )}
    </div>
  );
};
