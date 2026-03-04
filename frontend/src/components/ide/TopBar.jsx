import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, Search, TerminalSquare, Sidebar, Columns, 
  Layout, X, Check, Copy, Share2, Users, Save,
  FilePlus, FolderPlus, XSquare, Command as CmdIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import MenuBar from './MenuBar'; 
import styles from './IDE.module.css';
import { auth } from '../../services/firebase';

export default function TopBar({
  onExit, roomHash,
  leftSidebarOpen, setLeftSidebarOpen,
  rightSidebarOpen, setRightSidebarOpen,
  terminalOpen, setTerminalOpen,
  closeMenusTrigger,
  isAutoSave, setIsAutoSave
}) {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [searchValue, setSearchValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  const [prevTrigger, setPrevTrigger] = useState(closeMenusTrigger);
  if (closeMenusTrigger !== prevTrigger) {
    setPrevTrigger(closeMenusTrigger);
    setLayoutMenuOpen(false);
    setIsSearchFocused(false);
  }

  const copyRoomHash = () => {
    if (!roomHash) return;
    navigator.clipboard.writeText(roomHash);
    setCopied(true);
    toast.success("Invite Link Copied to System Clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const availableCommands = [
    { id: 'file', label: 'Create New File', icon: <FilePlus size={14}/>, action: () => window.dispatchEvent(new Event('global-create-file')) },
    { id: 'folder', label: 'Create New Folder', icon: <FolderPlus size={14}/>, action: () => window.dispatchEvent(new Event('global-create-folder')) },
    { id: 'save', label: 'Save Active File', icon: <Save size={14}/>, action: () => window.dispatchEvent(new Event('global-save-trigger')) },
    { id: 'close', label: 'Close Active Editor', icon: <XSquare size={14}/>, action: () => window.dispatchEvent(new Event('global-close-editor')) },
    { id: 'term', label: 'Toggle Terminal Panel', icon: <TerminalSquare size={14}/>, action: () => setTerminalOpen(!terminalOpen) },
    { id: 'side', label: 'Toggle Explorer Sidebar', icon: <Sidebar size={14}/>, action: () => setLeftSidebarOpen(!leftSidebarOpen) }
  ];

  const filteredCommands = availableCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(searchValue.replace('>', '').trim().toLowerCase())
  );

  return (
    <header className="relative h-12 flex items-center justify-between px-4 shrink-0 transition-colors z-30 shadow-md bg-[#18181b] border-b border-zinc-800" onClick={(e) => e.stopPropagation()}>
      
      <div className="flex items-center h-full gap-2">
        <button onClick={onExit} className="text-zinc-500 hover:text-[#c084fc] transition-colors mr-2" title="Exit Workspace">
          <ArrowLeft size={16} />
        </button>
        <MenuBar 
          onExit={onExit} 
          toggleSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
          toggleSecondarySidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
          toggleTerminal={() => setTerminalOpen(!terminalOpen)}
        />
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md flex flex-col z-50" ref={searchRef}>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all ${isSearchFocused ? 'border-[#c084fc] bg-black shadow-[0_0_15px_rgba(192,132,252,0.2)]' : 'border-zinc-800 bg-[#09090b]'}`}>
          <Search size={14} className={isSearchFocused ? "text-[#c084fc]" : "text-zinc-500"} />
          <input 
            type="text" 
            placeholder="Type '>' to show Commands, or search files..." 
            className="bg-transparent outline-none w-full text-xs text-white placeholder-zinc-600 transition-colors font-mono"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
          />
          <CmdIcon size={12} className="text-zinc-600" />
        </div>

        <AnimatePresence>
          {isSearchFocused && searchValue.startsWith('>') && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 5 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-lg overflow-hidden py-2"
            >
              <div className="px-4 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">IDE Commands</div>
              {filteredCommands.length > 0 ? filteredCommands.map(cmd => (
                <div 
                  key={cmd.id} 
                  onClick={() => { cmd.action(); setIsSearchFocused(false); setSearchValue(''); }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#c084fc] hover:text-black text-zinc-300 text-xs font-mono cursor-pointer transition-colors"
                >
                  {cmd.icon}
                  <span>{cmd.label}</span>
                </div>
              )) : (
                <div className="px-4 py-3 text-xs text-zinc-600 italic">No matching commands found.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black border border-zinc-800 rounded-lg cursor-pointer" onClick={() => setIsAutoSave(!isAutoSave)}>
          <Save size={12} className={isAutoSave ? "text-[#00ff41]" : "text-zinc-600"} />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hidden md:block">Auto-Save</span>
          <div className={`w-6 h-3 rounded-full relative transition-colors ${isAutoSave ? 'bg-[#00ff41]/20 border border-[#00ff41]' : 'bg-zinc-800 border border-zinc-700'}`}>
             <div className={`w-2 h-2 bg-white rounded-full absolute top-px transition-all ${isAutoSave ? 'right-0.5 bg-[#00ff41]' : 'left-0.5 bg-zinc-500'}`} />
          </div>
        </div>

        <div 
          onClick={copyRoomHash}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all active:scale-95 ${
            copied ? 'bg-green-500/20 border-green-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-[#c084fc]/50'
          }`}
          title="Click to copy invite hash"
        >
          <Share2 size={12} className={copied ? 'text-green-400' : 'text-zinc-500'} />
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase hidden lg:block">
            {roomHash || 'LOCAL_NODE'}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-1 hidden md:block" />

        <div className="flex items-center gap-2">
          <button onClick={() => setTerminalOpen(!terminalOpen)} className={`${styles.iconBtn} ${terminalOpen ? styles.iconActive : ''}`} title="Toggle Terminal (Ctrl+`)"><TerminalSquare size={16}/></button>
          <button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className={`${styles.iconBtn} ${leftSidebarOpen ? styles.iconActive : ''}`} title="Toggle Primary Side Bar (Ctrl+B)"><Sidebar size={16}/></button>
          <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={`${styles.iconBtn} ${rightSidebarOpen ? styles.iconActive : ''}`} title="Toggle Secondary Side Bar"><Columns size={16}/></button>
          <button onClick={(e) => { e.stopPropagation(); setLayoutMenuOpen(!layoutMenuOpen); }} className={`${styles.iconBtn} ${layoutMenuOpen ? styles.iconActive : ''}`} title="Customize Layout"><Layout size={16}/></button>
        </div>

        <div className="flex -space-x-2 items-center ml-2">
          <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-bold bg-blue-500 text-white z-20 shadow-lg ring-1 ring-blue-400/30">
            {auth.currentUser?.displayName ? auth.currentUser.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          {roomHash && (
            <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-bold bg-[#c084fc] text-black z-10 shadow-lg animate-pulse">
              <Users size={12} />
            </div>
          )}
        </div>
      </div>

      {layoutMenuOpen && (
        <div className={`${styles.contextMenu} ${styles.contextMenuTopRight}`}>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest border-b border-zinc-800 mb-1 flex justify-between items-center text-[#c084fc]">
            <span>Layout Config</span>
            <X size={14} className="cursor-pointer hover:text-white" onClick={() => setLayoutMenuOpen(false)}/>
          </div>
          <div className={styles.contextMenuItem} onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}><span className="flex items-center gap-2">{leftSidebarOpen ? <Check size={14} className="text-[#c084fc]"/> : <span className="w-3.5"></span>} Primary Sidebar</span> <span className="text-zinc-600 text-[10px]">Ctrl+B</span></div>
          <div className={styles.contextMenuItem} onClick={() => setRightSidebarOpen(!rightSidebarOpen)}><span className="flex items-center gap-2">{rightSidebarOpen ? <Check size={14} className="text-[#c084fc]"/> : <span className="w-3.5"></span>} Secondary Sidebar</span></div>
          <div className={styles.contextMenuItem} onClick={() => setTerminalOpen(!terminalOpen)}><span className="flex items-center gap-2">{terminalOpen ? <Check size={14} className="text-[#c084fc]"/> : <span className="w-3.5"></span>} Integrated Panel</span> <span className="text-zinc-600 text-[10px]">Ctrl+J</span></div>
        </div>
      )}
    </header>
  );
}