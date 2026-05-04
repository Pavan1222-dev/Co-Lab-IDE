import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast'; 

import Draggable from 'react-draggable';
import { Menu, X, Bell, Settings, Users, MessageSquareText, Cpu, Lock } from 'lucide-react'; 
import styles from './IDE.module.css';

import HostRadar from './HostRadar';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import SidebarLeft from './SidebarLeft';
import EditorCanvas from './EditorCanvas';
import SidebarRight from './SidebarRight';
import BottomPanel from './BottomPanel';
import StatusBar from './StatusBar';
import GhostSyncEngine from './GhostSyncEngine'; 
import Modal from '../Common/Modal';
import Notifications from './Notifications';
import ManagePeers from './ManagePeers';
import ChatPanel from './ChatPanel'; 

export default function IDEShell({ onExit, roomHash, isHost, initialPath }) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_left`) ?? 'true'));
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_right`) ?? 'false'));
  const [terminalOpen, setTerminalOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_term`) ?? 'true'));
  
  const [leftWidth, setLeftWidth] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_leftW`) ?? '256'));
  const [termHeight, setTermHeight] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_termH`) ?? '280'));
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const dragTracker = useRef({ type: null, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

  const [closeMenusTrigger, setCloseMenusTrigger] = useState(0);
  const [projectRoot] = useState(initialPath || null); 
  const [isWorkspaceHost, setIsWorkspaceHost] = useState(isHost || false);

  // 🔴 GLOBAL ROUTER STATE FOR THE SIDEBAR
  const [activeSidebarTab, setActiveSidebarTab] = useState('files');

  const [activeFile, setActiveFile] = useState(() => {
    const saved = localStorage.getItem(`colab_session_${roomHash}_activeFile`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return { name: '', path: null, relativePath: '' }; }
    }
    return { name: '', path: null, relativePath: '' };
  });

  const [openFiles, setOpenFiles] = useState(() => {
    const saved = localStorage.getItem(`colab_session_${roomHash}_openFiles`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [compareTarget, setCompareTarget] = useState(null);
  const [isAutoSave, setIsAutoSave] = useState(() => JSON.parse(localStorage.getItem(`colab_settings_autosave`) ?? 'false')); 
  const [unsavedFiles, setUnsavedFiles] = useState([]);
  const [problems, setProblems] = useState([]);

  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const dragRef = useRef(null);
  const activeFileRef = useRef(activeFile);
  const openFilesRef = useRef(openFiles);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragTracker.current.type) return;

      if (dragTracker.current.type === 'left') {
        const delta = e.clientX - dragTracker.current.startX;
        const newWidth = Math.max(160, Math.min(dragTracker.current.startWidth + delta, 800)); 
        setLeftWidth(newWidth);
      } else if (dragTracker.current.type === 'term') {
        const delta = dragTracker.current.startY - e.clientY; 
        const newHeight = Math.max(100, Math.min(dragTracker.current.startHeight + delta, window.innerHeight - 150)); 
        setTermHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (dragTracker.current.type) {
        dragTracker.current.type = null;
        setIsDraggingHandle(false);
        document.body.classList.remove('is-resizing-col', 'is-resizing-row');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startLeftDrag = (e) => {
    e.preventDefault();
    dragTracker.current = { type: 'left', startX: e.clientX, startWidth: leftWidth };
    setIsDraggingHandle(true);
    document.body.classList.add('is-resizing-col');
  };

  const startTermDrag = (e) => {
    e.preventDefault();
    dragTracker.current = { type: 'term', startY: e.clientY, startHeight: termHeight };
    setIsDraggingHandle(true);
    document.body.classList.add('is-resizing-row');
  };

  useEffect(() => {
    activeFileRef.current = activeFile;
    openFilesRef.current = openFiles;
    localStorage.setItem(`colab_session_${roomHash}_activeFile`, JSON.stringify(activeFile));
    localStorage.setItem(`colab_session_${roomHash}_openFiles`, JSON.stringify(openFiles));
  }, [activeFile, openFiles, roomHash]);

  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_left`, JSON.stringify(leftSidebarOpen)); }, [leftSidebarOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_right`, JSON.stringify(rightSidebarOpen)); }, [rightSidebarOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_term`, JSON.stringify(terminalOpen)); }, [terminalOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_settings_autosave`, JSON.stringify(isAutoSave)); }, [isAutoSave]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_leftW`, JSON.stringify(leftWidth)); }, [leftWidth, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_termH`, JSON.stringify(termHeight)); }, [termHeight, roomHash]);

  useEffect(() => {
    if (!isWorkspaceHost || !roomHash) return;
    const q = query(collection(db, 'projects', roomHash, 'waitlist'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => setPendingCount(snapshot.size));
    return () => unsubscribe();
  }, [isWorkspaceHost, roomHash]);

  useEffect(() => {
    if (isWorkspaceHost || !roomHash || !auth.currentUser) return;
    const q = query(collection(db, 'projects', roomHash, 'waitlist'), where('uid', '==', auth.currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const myDoc = snapshot.docs[0].data();
        if (myDoc.status === 'kicked_keep' || myDoc.status === 'kicked_nuke') {
          if (myDoc.status === 'kicked_nuke' && projectRoot && '__TAURI__' in window) {
            try {
              const { remove } = await import('@tauri-apps/plugin-fs');
              await remove(projectRoot, { recursive: true });
            } catch (err) { console.error("Nuke failed:", err); }
          }
          if (onExit) onExit();
        }
      }
    });
    return () => unsubscribe();
  }, [roomHash, isWorkspaceHost, projectRoot, onExit]);

  const handleOpenFile = useCallback((file) => {
    const existingIdx = openFilesRef.current.findIndex(f => f.relativePath === file.relativePath);
    if (existingIdx === -1) {
      setOpenFiles(prev => [...prev, file]);
    }
    setActiveFile(file);
  }, []);

  const handleOpenDiff = useCallback((original, modified) => {
    const diffTab = {
      type: 'diff',
      name: `Diff: ${original.name} ↔ ${modified.name}`,
      relativePath: `diff-${Date.now()}`,
      original: original, 
      modified: modified  
    };
    setOpenFiles(prev => [...prev, diffTab]);
    setActiveFile(diffTab);
  }, []);

  const handleCloseFile = useCallback((relativePath, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const prevOpen = openFilesRef.current;
    const prevActive = activeFileRef.current;

    const next = prevOpen.filter(f => f.relativePath !== relativePath);
    setOpenFiles(next);
    
    if (prevActive?.relativePath === relativePath) {
      setActiveFile(next.length > 0 ? next[next.length - 1] : { name: '', path: null, relativePath: '' });
    }
  }, []);

  const handleReorderFiles = useCallback((dragIndex, dropIndex) => {
    setOpenFiles(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
  }, []);

  useEffect(() => {
    const closeEditor = () => {
      if (activeFileRef.current?.relativePath) {
        handleCloseFile(activeFileRef.current.relativePath);
      }
    };
    window.addEventListener('global-close-editor', closeEditor);
    return () => window.removeEventListener('global-close-editor', closeEditor);
  }, [handleCloseFile]);

  const handleGlobalClick = () => {
    setCloseMenusTrigger(prev => prev + 1);
    if (showFloatingMenu) setShowFloatingMenu(false); 
  };

  const handleProblemClick = (problem) => {
    window.dispatchEvent(new CustomEvent('global-jump-to-line', { detail: problem }));
  };

  const speedDialActions = [
    { id: 'chat', icon: <MessageSquareText size={20} className={!isWorkspaceHost ? "text-zinc-600" : ""} />, label: 'Comms', onClick: () => setActiveModal('chat'), locked: false },
    { id: 'telemetry', icon: <Cpu size={20} className={!isWorkspaceHost ? "text-zinc-600" : ""} />, label: 'Metrics', onClick: () => setActiveModal('telemetry'), locked: false },
    { id: 'settings', icon: <Settings size={20} className={!isWorkspaceHost ? "text-zinc-600" : ""} />, label: 'Settings', onClick: () => setActiveModal('settings'), locked: false },
    { id: 'peers', icon: <Users size={20} />, label: 'Peers', onClick: () => setActiveModal('manage-peers'), locked: !isWorkspaceHost },
    { id: 'requests', icon: <Bell size={20} />, label: 'Requests', onClick: () => setActiveModal('notifications'), locked: !isWorkspaceHost, badge: pendingCount }
  ];

  return (
    <div className={styles.ideContainer} onClick={handleGlobalClick}>
      <style>
        {`
          .is-resizing-col * { cursor: col-resize !important; user-select: none !important; }
          .is-resizing-row * { cursor: row-resize !important; user-select: none !important; }
        `}
      </style>

      <HostRadar roomHash={roomHash} isHost={isWorkspaceHost} />

      <TopBar 
        onExit={onExit} roomHash={roomHash} 
        leftSidebarOpen={leftSidebarOpen} setLeftSidebarOpen={setLeftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen} setRightSidebarOpen={setRightSidebarOpen}
        terminalOpen={terminalOpen} setTerminalOpen={setTerminalOpen}
        closeMenusTrigger={closeMenusTrigger}
        isAutoSave={isAutoSave} setIsAutoSave={setIsAutoSave}
      />

      <div className={styles.mainGrid}>
        
        {/* 🔴 ACTIVITY BAR WIRED UP TO IDE STATE */}
        <ActivityBar 
          closeMenusTrigger={closeMenusTrigger} 
          activeTab={activeSidebarTab} 
          setActiveTab={setActiveSidebarTab} 
        />

        <AnimatePresence initial={false}>
          {leftSidebarOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }} animate={{ width: leftWidth, opacity: 1 }} exit={{ width: 0, opacity: 0 }} 
              transition={{ duration: isDraggingHandle ? 0 : 0.2, type: 'tween' }} 
              className="flex shrink-0 border-r border-zinc-800 bg-[#09090b] relative"
            >
              <div style={{ width: leftWidth }} className="shrink-0 h-full overflow-hidden">
                <SidebarLeft 
                  activeTab={activeSidebarTab} 
                  activeFile={activeFile} setActiveFile={setActiveFile} 
                  openFiles={openFiles} handleOpenFile={handleOpenFile} handleCloseFile={handleCloseFile}
                  compareTarget={compareTarget} setCompareTarget={setCompareTarget} handleOpenDiff={handleOpenDiff}
                  projectRoot={projectRoot} roomHash={roomHash} setIsWorkspaceHost={setIsWorkspaceHost} 
                  isWorkspaceHost={isWorkspaceHost} unsavedFiles={unsavedFiles} 
                />
              </div>
              <div onMouseDown={startLeftDrag} className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 hover:bg-[#c084fc] transition-colors translate-x-[1px]"/>
            </motion.div>
          )}
        </AnimatePresence>
        
        <GhostSyncEngine roomHash={roomHash} isHost={isWorkspaceHost} projectRoot={projectRoot} activeFile={activeFile} />

        <EditorCanvas 
          activeFile={activeFile} openFiles={openFiles}
          handleOpenFile={handleOpenFile} handleCloseFile={handleCloseFile} handleReorderFiles={handleReorderFiles}
          compareTarget={compareTarget} setCompareTarget={setCompareTarget} handleOpenDiff={handleOpenDiff}
          roomHash={roomHash} isWorkspaceHost={isWorkspaceHost} 
          isAutoSave={isAutoSave} unsavedFiles={unsavedFiles} setUnsavedFiles={setUnsavedFiles}
          setProblems={setProblems}
        />

        <AnimatePresence initial={false}>
          {rightSidebarOpen && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="flex shrink-0 overflow-hidden border-l border-zinc-800 bg-[#09090b]">
              <div className="w-64 shrink-0 h-full">
                <SidebarRight setRightSidebarOpen={setRightSidebarOpen} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {terminalOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: termHeight, opacity: 1 }} exit={{ height: 0, opacity: 0 }} 
            transition={{ duration: isDraggingHandle ? 0 : 0.2, type: 'tween' }} 
            className="w-full flex shrink-0 relative z-10 flex-col"
          >
            <div onMouseDown={startTermDrag} className="w-full h-1.5 cursor-row-resize z-50 hover:bg-[#c084fc] transition-colors -translate-y-[1px]"/>
            <div className="w-full h-full overflow-hidden"> 
              <BottomPanel setTerminalOpen={setTerminalOpen} initialPath={projectRoot} roomHash={roomHash} problems={problems} onProblemClick={handleProblemClick}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StatusBar roomHash={roomHash} problems={problems} activeFile={activeFile} />

      <Draggable bounds="parent" nodeRef={dragRef}>
        <div ref={dragRef} className="absolute bottom-24 right-24 z-9999 w-14 h-14 pointer-events-auto cursor-move">
          <AnimatePresence>
            {showFloatingMenu && speedDialActions.map((item, i) => {
              const RADIUS = 80; 
              const angle = -Math.PI / 2 + (i * (2 * Math.PI / speedDialActions.length));
              const x = Math.cos(angle) * RADIUS;
              const y = Math.sin(angle) * RADIUS;

              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.1 }} animate={{ opacity: 1, x, y, scale: 1 }} exit={{ opacity: 0, x: 0, y: 0, scale: 0.1 }} 
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 20 }}
                  className="absolute top-1 left-1 z-40 group"
                >
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950/90 backdrop-blur-sm border border-zinc-700 text-white text-[9px] uppercase tracking-widest font-bold rounded-md opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-lg">{item.label}</div>
                  <button 
                    onMouseDown={(e) => e.stopPropagation()} 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if(item.locked) { toast.error("Host Only: You are a Guest."); } else { item.onClick(); setShowFloatingMenu(false); }
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-transform hover:scale-110 ${item.locked ? 'bg-zinc-950 border-zinc-800 text-zinc-700 cursor-not-allowed' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-[#c084fc] hover:border-[#c084fc] hover:bg-[#c084fc]/10'}`}
                  >
                    {item.locked ? <Lock size={16} /> : item.icon}
                    {item.badge > 0 && !item.locked && (<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black border-2 border-black">{item.badge}</span>)}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <button 
            className={`absolute inset-0 z-50 w-14 h-14 rounded-full bg-linear-to-br from-[#c084fc] to-[#f472b6] text-black flex justify-center items-center shadow-[0_0_20px_rgba(192,132,252,0.4)] transition-all duration-300 ${showFloatingMenu ? 'rotate-90 bg-none bg-zinc-200 text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] border border-white' : 'hover:scale-105'}`} 
            onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }} onClick={(e) => { e.stopPropagation(); setShowFloatingMenu(!showFloatingMenu); }}
          >
            {showFloatingMenu ? <X size={24} /> : <Menu size={24} />}
            {isWorkspaceHost && pendingCount > 0 && !showFloatingMenu && (<span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-[#09090b] animate-pulse">{pendingCount}</span>)}
          </button>
        </div>
      </Draggable>

      {isWorkspaceHost && <Modal isOpen={activeModal === 'notifications'} onClose={() => setActiveModal(null)} title="Join Requests"><Notifications roomHash={roomHash} /></Modal>}
      {isWorkspaceHost && <Modal isOpen={activeModal === 'manage-peers'} onClose={() => setActiveModal(null)} title="Active Grid Peers"><ManagePeers roomHash={roomHash} /></Modal>}
      <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Workspace Settings"><div className="text-zinc-400 text-sm">Placeholder for extended project settings...</div></Modal>
      <Modal isOpen={activeModal === 'chat'} onClose={() => setActiveModal(null)} title="Encrypted Comms" initialWidth={450} initialHeight={550}><ChatPanel roomHash={roomHash} /></Modal>
      <Modal isOpen={activeModal === 'telemetry'} onClose={() => setActiveModal(null)} title="System Telemetry" initialWidth={350} initialHeight={250}>
        <div className="flex flex-col h-full w-full py-2">
          <div className="mb-6"><div className="flex justify-between text-xs text-zinc-400 uppercase tracking-widest font-bold mb-2"><span>CPU Load</span><span>32%</span></div><div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden shadow-inner border border-zinc-800"><div className="h-full bg-linear-to-r from-[#c084fc] to-[#f472b6] transition-all duration-500" style={{width: '32%'}}/></div></div>
          <div className="mb-6"><div className="flex justify-between text-xs text-zinc-400 uppercase tracking-widest font-bold mb-2"><span>Local Memory</span><span>4.1 / 8 GB</span></div><div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden shadow-inner border border-zinc-800"><div className="h-full bg-linear-to-r from-[#c084fc] to-[#f472b6] transition-all duration-500" style={{width: '51%'}}/></div></div>
        </div>
      </Modal>
    </div>
  );
}