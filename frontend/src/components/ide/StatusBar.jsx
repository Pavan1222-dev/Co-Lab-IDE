import React, { useState, useEffect } from 'react';
import { GitBranch, XCircle, AlertTriangle, Radio, CheckCheck, Users, Bell } from 'lucide-react';
import styles from './IDE.module.css';

export default function StatusBar({ roomHash, problems = [], activeFile }) {
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1 });
  const [peerCount, setPeerCount] = useState(1);

  useEffect(() => {
    const handleCursorUpdate = (e) => setCursorPos({ ln: e.detail.ln, col: e.detail.col });
    const handlePeerUpdate = (e) => setPeerCount(e.detail);

    window.addEventListener('global-cursor-update', handleCursorUpdate);
    window.addEventListener('global-peer-update', handlePeerUpdate);
    
    return () => {
      window.removeEventListener('global-cursor-update', handleCursorUpdate);
      window.removeEventListener('global-peer-update', handlePeerUpdate);
    };
  }, []);

  const totalErrors = problems.filter(p => p.severity === 8).length;
  const totalWarnings = problems.filter(p => p.severity === 4).length;

  const getLanguageDisplay = (fileName) => {
    if (!fileName) return 'Plain Text';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
      'js': 'JavaScript', 'jsx': 'React JSX',
      'ts': 'TypeScript', 'tsx': 'React TSX',
      'json': 'JSON', 'css': 'CSS', 'html': 'HTML',
      'py': 'Python', 'rs': 'Rust', 'md': 'Markdown'
    };
    return map[ext] || 'Plain Text';
  };

  return (
    <footer className="h-6 flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-widest shrink-0 relative z-40 bg-linear-to-r from-[#c084fc] to-[#f472b6] text-black">
      <div className="flex items-center h-full">
        <span className={styles.statusBarItem} title="Source Control"><GitBranch size={12}/> main*</span>
        
        <span className={styles.statusBarItem} title="View Problems">
          <XCircle size={12} className={totalErrors > 0 ? "text-red-900" : "text-black/50"} /> 
          <span className={totalErrors > 0 ? "text-red-950 font-black" : ""}>{totalErrors}</span> 
          
          <AlertTriangle size={12} className={`ml-2 ${totalWarnings > 0 ? "text-yellow-900" : "text-black/50"}`} /> 
          <span className={totalWarnings > 0 ? "text-yellow-950 font-black" : ""}>{totalWarnings}</span>
        </span>
      </div>
      
      <div className="flex items-center h-full">
        <span className={styles.statusBarItem} title="Go to Line/Column">Ln {cursorPos.ln}, Col {cursorPos.col}</span>
        
        <span className={`${styles.statusBarItem} hidden md:flex`} title="Indentation">Spaces: 2</span>
        <span className={`${styles.statusBarItem} hidden md:flex`} title="Encoding">UTF-8</span>
        <span className={`${styles.statusBarItem} hidden md:flex`} title="End of Line Sequence">LF</span>
        
        <span className={styles.statusBarItem} title="Select Language Mode">&#123;&#125; {getLanguageDisplay(activeFile?.name)}</span>
        
        <span className={`${styles.statusBarItem} hidden lg:flex`} title="Start Live Server"><Radio size={12}/> Go Live</span>
        <span className={`${styles.statusBarItem} hidden lg:flex`} title="Code Formatter"><CheckCheck size={12}/> Prettier</span>
        
        <span className={styles.statusBarItem} title="P2P Network Status">
          <Users size={12} className={peerCount > 1 ? "animate-pulse" : ""} /> 
          {roomHash ? `${peerCount} Peer${peerCount !== 1 ? 's' : ''}` : 'Local Mode'}
        </span>
        
        <span className={styles.statusBarItem} title="Notifications"><Bell size={12}/></span>
      </div>
    </footer>
  );
}