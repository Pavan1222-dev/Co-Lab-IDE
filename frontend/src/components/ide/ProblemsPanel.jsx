import React, { useMemo } from 'react';
import { XCircle, AlertTriangle, Info, FileCode, CheckCircle2 } from 'lucide-react';

// Monaco Severity markers based on your JSON (8=Error, 4=Warning, etc.)
const SEVERITY = {
  Error: 8,
  Warning: 4,
  Info: 2,
  Hint: 1,
};

const ProblemItem = ({ problem, onClick }) => {
  // Determine icon and color based on severity number
  let Icon = Info;
  let colorClass = 'text-blue-400';

  if (problem.severity === SEVERITY.Error) {
    Icon = XCircle;
    colorClass = 'text-red-400';
  } else if (problem.severity === SEVERITY.Warning) {
    Icon = AlertTriangle;
    colorClass = 'text-yellow-400';
  }

  // Format the file path to be shorter (e.g., "src/components/ide/BottomPanel.jsx")
  const formatPath = (path) => {
     const parts = path.replace(/\\/g, '/').split('/');
     // Take the last 3 parts for context
     return parts.slice(Math.max(parts.length - 3, 0)).join('/');
  };

  return (
    <div 
      onClick={() => onClick(problem)}
      className="flex items-start gap-2 px-2 py-1.5 hover:bg-zinc-800/50 cursor-pointer group transition-colors font-mono text-[11px] border-l-2 border-transparent hover:border-[#c084fc]"
    >
      <Icon size={14} className={`shrink-0 mt-0.5 ${colorClass}`} />
      <div className="flex-1 truncate">
         <span className="text-zinc-300 truncate">{problem.message}</span>
         <div className="flex items-center gap-2 text-zinc-500 mt-0.5">
             <span className="flex items-center gap-1 text-[10px]"><FileCode size={10}/> {formatPath(problem.resource)}</span>
             <span className="text-[10px]">[{problem.startLineNumber},{problem.startColumn}]</span>
             <span className="text-[10px] opacity-50">({problem.source})</span>
         </div>
      </div>
    </div>
  );
};

const ProblemsPanel = ({ problems = [], onProblemClick }) => {
  // Group problems by file resource for cleaner display
  const groupedProblems = useMemo(() => {
    const groups = {};
    problems.forEach(p => {
      if (!groups[p.resource]) groups[p.resource] = [];
      groups[p.resource].push(p);
    });
    return groups;
  }, [problems]);

  const totalErrors = problems.filter(p => p.severity === SEVERITY.Error).length;
  const totalWarnings = problems.filter(p => p.severity === SEVERITY.Warning).length;

  return (
    <div className="flex flex-col h-full bg-[#09090b] overflow-hidden">
      {/* Stats Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800/50 text-[10px] font-bold tracking-widest uppercase shrink-0 bg-zinc-950/50">
         <div className="flex items-center gap-1.5 text-zinc-400">
            <XCircle size={12} className={totalErrors > 0 ? "text-red-400" : ""}/> 
            <span>{totalErrors} Errors</span>
         </div>
         <div className="flex items-center gap-1.5 text-zinc-400">
            <AlertTriangle size={12} className={totalWarnings > 0 ? "text-yellow-400" : ""}/> 
            <span>{totalWarnings} Warnings</span>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 opacity-50">
            <CheckCircle2 size={32} />
            <span className="text-xs font-mono uppercase tracking-widest">No problems detected</span>
          </div>
        ) : (
          Object.entries(groupedProblems).map(([resource, items]) => (
            <div key={resource} className="mb-2">
               {/* File Header */}
              <div className="px-2 py-1 bg-zinc-900/50 text-zinc-400 text-[10px] font-bold flex items-center gap-1.5 truncate rounded-t-md border-b border-zinc-800">
                 <FileCode size={12}/>
                 <span className="truncate">{resource}</span>
              </div>
              {/* Items List */}
              <div className="bg-zinc-950/30 rounded-b-md">
                 {items.map((item, idx) => (
                   <ProblemItem key={idx} problem={item} onClick={onProblemClick} />
                 ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProblemsPanel;