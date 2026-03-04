import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export default function OutputPanel() {
  const [outputType, setOutputType] = useState('system');
  const [logs, setLogs] = useState({
    system: [
      `[${new Date().toLocaleTimeString()}] Co-Lab IDE System Initialized.`,
      `[${new Date().toLocaleTimeString()}] P2P Network connected to Matchmaker.`
    ],
    tasks: [
      `[${new Date().toLocaleTimeString()}] Awaiting tasks...`
    ]
  });

  const scrollRef = useRef(null);

  // Automatically scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, outputType]);

  // A listener you can use globally to push logs here
  useEffect(() => {
    const handleGlobalLog = (e) => {
      const { type, message } = e.detail;
      const targetType = type || 'system';
      const formattedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
      
      setLogs(prev => ({
        ...prev,
        [targetType]: [...(prev[targetType] || []), formattedMessage]
      }));
    };

    window.addEventListener('ide-log-output', handleGlobalLog);
    return () => window.removeEventListener('ide-log-output', handleGlobalLog);
  }, []);

  const clearLogs = () => {
    setLogs(prev => ({
      ...prev,
      [outputType]: []
    }));
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* VS Code Style Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-950 border-b border-zinc-800 shrink-0">
        <select 
          value={outputType} 
          onChange={(e) => setOutputType(e.target.value)}
          className="bg-transparent border-none text-zinc-300 text-xs outline-none cursor-pointer hover:bg-zinc-900 px-2 py-1 rounded"
        >
          <option value="system" className="bg-zinc-900">System Activity</option>
          <option value="tasks" className="bg-zinc-900">Task Runner</option>
        </select>

        <button 
          onClick={clearLogs} 
          className="text-zinc-500 hover:text-white p-1 rounded transition-colors hover:bg-zinc-800"
          title="Clear Output"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Log Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 bg-[#09090b] font-mono text-[12px] text-zinc-400 custom-scrollbar select-text"
      >
        {logs[outputType]?.map((log, index) => {
          // Color code errors/warnings if they exist in the log text
          const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
          const isWarning = log.toLowerCase().includes('warning') || log.toLowerCase().includes('warn');
          
          return (
            <div 
              key={index} 
              className={`mb-1 leading-relaxed ${isError ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-zinc-300'}`}
            >
              {log}
            </div>
          );
        })}
        {(!logs[outputType] || logs[outputType].length === 0) && (
          <div className="text-zinc-600 italic">No output to display.</div>
        )}
      </div>
    </div>
  );
}