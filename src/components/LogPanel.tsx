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
      logEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // 增加缓冲判定高度到 35px，并采用 auto 即时滚动以规避 smooth 动画造成的 onScroll 误判
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 35;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="border border-slate-200/80 rounded-xl bg-[#090D16] font-sans text-xs flex flex-col h-96 overflow-hidden relative shadow-sm">
      {/* 终端控制头部 - 亮色优雅设计 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 select-none">
        <div className="flex items-center gap-2 text-slate-700">
          <Terminal className="h-4 w-4 text-slate-500" />
          <span className="font-semibold">{t('logs.title')}</span>
          <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-bold">
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
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 w-36 transition-colors duration-150"
          />
          {/* 复制 */}
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-slate-800 transition-colors duration-150 cursor-pointer border border-transparent"
            title={t('logs.copyTitle')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 终端内容 - 暗色以利于代码与日志高对比阅读 */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-1 bg-[#090D16] text-slate-300 font-mono scrollbar-thin animate-fade-in"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 font-sans">
            {t('logs.empty')}
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('fail');
            const isSuccess = log.toLowerCase().includes('success') || log.toLowerCase().includes('done');
            return (
              <div
                key={index}
                className={`whitespace-pre-wrap leading-relaxed py-0.5 px-1 rounded transition-colors ${
                  isError ? 'text-red-400 bg-red-950/20' : isSuccess ? 'text-emerald-400 bg-emerald-950/10' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="text-slate-600 select-none mr-3 inline-block w-8 text-right font-mono text-[10px]">
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
          className="absolute bottom-6 right-6 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-slate-50 transition-all duration-150"
        >
          <ArrowDown className="h-3 w-3" /> {t('logs.autoScroll')}
        </button>
      )}
    </div>
  );
};
