import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Menu, X, Bell, Settings, Users } from 'lucide-react'; // 🔴 Added Users icon
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
import ManagePeers from './ManagePeers'; // 🔴 Imported new component

export default function IDEShell({ onExit, roomHash, isHost, initialPath }) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_left`) ?? 'true'));
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_right`) ?? 'false'));
  const [terminalOpen, setTerminalOpen] = useState(() => JSON.parse(localStorage.getItem(`colab_layout_${roomHash}_term`) ?? 'true'));
  
  const [closeMenusTrigger, setCloseMenusTrigger] = useState(0);
  const [projectRoot] = useState(initialPath || null); 
  const [isWorkspaceHost, setIsWorkspaceHost] = useState(isHost || false);

  const [activeFile, setActiveFile] = useState(() => {
    const saved = localStorage.getItem(`colab_session_${roomHash}_activeFile`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return { name: 'Welcome.js', path: null, relativePath: '' }; }
    }
    return { name: 'Welcome.js', path: null, relativePath: '' };
  });

  const [isAutoSave, setIsAutoSave] = useState(() => JSON.parse(localStorage.getItem(`colab_settings_autosave`) ?? 'false')); 
  const [unsavedFiles, setUnsavedFiles] = useState([]);
  const [problems, setProblems] = useState([]);

  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => { localStorage.setItem(`colab_session_${roomHash}_activeFile`, JSON.stringify(activeFile)); }, [activeFile, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_left`, JSON.stringify(leftSidebarOpen)); }, [leftSidebarOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_right`, JSON.stringify(rightSidebarOpen)); }, [rightSidebarOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_layout_${roomHash}_term`, JSON.stringify(terminalOpen)); }, [terminalOpen, roomHash]);
  useEffect(() => { localStorage.setItem(`colab_settings_autosave`, JSON.stringify(isAutoSave)); }, [isAutoSave]);

  useEffect(() => {
    if (!isWorkspaceHost || !roomHash) return;
    const q = query(collection(db, 'projects', roomHash, 'waitlist'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => setPendingCount(snapshot.size));
    return () => unsubscribe();
  }, [isWorkspaceHost, roomHash]);

  useEffect(() => {
    const closeEditor = () => setActiveFile({ name: '', path: null, relativePath: '' });
    window.addEventListener('global-close-editor', closeEditor);
    return () => window.removeEventListener('global-close-editor', closeEditor);
  }, []);

  const handleGlobalClick = () => {
    setCloseMenusTrigger(prev => prev + 1);
    if (showFloatingMenu) setShowFloatingMenu(false); 
  };

  const handleProblemClick = (problem) => {
    window.dispatchEvent(new CustomEvent('global-jump-to-line', { detail: problem }));
  };

  return (
    <div className={styles.ideContainer} onClick={handleGlobalClick}>
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
        <ActivityBar closeMenusTrigger={closeMenusTrigger} />

        <AnimatePresence initial={false}>
          {leftSidebarOpen && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="flex shrink-0 overflow-hidden border-r border-zinc-800 bg-[#09090b]">
              <div className="w-64 shrink-0 h-full">
                <SidebarLeft 
                  activeFile={activeFile} setActiveFile={setActiveFile} 
                  projectRoot={projectRoot} roomHash={roomHash} setIsWorkspaceHost={setIsWorkspaceHost} 
                  isWorkspaceHost={isWorkspaceHost}
                  unsavedFiles={unsavedFiles} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <GhostSyncEngine roomHash={roomHash} isHost={isWorkspaceHost} projectRoot={projectRoot} activeFile={activeFile} />

        <EditorCanvas 
          activeFile={activeFile} roomHash={roomHash} isWorkspaceHost={isWorkspaceHost} 
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 280, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="w-full flex shrink-0 overflow-hidden">
            <div className="w-full h-70"> 
              <BottomPanel 
                 setTerminalOpen={setTerminalOpen} initialPath={projectRoot} roomHash={roomHash} 
                 problems={problems} onProblemClick={handleProblemClick}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StatusBar roomHash={roomHash} problems={problems} activeFile={activeFile} />

      <div className={styles.floatingMenuContainer}>
        <AnimatePresence>
          {showFloatingMenu && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className={styles.floatingMenuOptions}>
              {isWorkspaceHost && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('notifications'); setShowFloatingMenu(false); }}>
                    <Bell size={16} /> <span className="flex-1 text-left">Requests</span>
                    {pendingCount > 0 && <span className={styles.notificationBadge}>{pendingCount}</span>}
                  </button>
                  {/* 🔴 NEW: MANAGE PEERS BUTTON */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('manage-peers'); setShowFloatingMenu(false); }}>
                    <Users size={16} /> <span className="flex-1 text-left">Manage Peers</span>
                  </button>
                </>
              )}
              <button onClick={(e) => { e.stopPropagation(); setActiveModal('settings'); setShowFloatingMenu(false); }}><Settings size={16} /> <span className="flex-1 text-left">Settings</span></button>
            </motion.div>
          )}
        </AnimatePresence>

        <button className={`${styles.floatingBtn} ${showFloatingMenu ? styles.floatingBtnOpen : ''}`} onClick={(e) => { e.stopPropagation(); setShowFloatingMenu(!showFloatingMenu); }}>
          {showFloatingMenu ? <X size={24} /> : <Menu size={24} />}
          {isWorkspaceHost && pendingCount > 0 && !showFloatingMenu && <span className={styles.floatingBadge}>{pendingCount}</span>}
        </button>
      </div>

      {isWorkspaceHost && (
        <Modal isOpen={activeModal === 'notifications'} onClose={() => setActiveModal(null)} title="Join Requests">
          <Notifications roomHash={roomHash} />
        </Modal>
      )}

      {/* 🔴 NEW: MANAGE PEERS MODAL */}
      {isWorkspaceHost && (
        <Modal isOpen={activeModal === 'manage-peers'} onClose={() => setActiveModal(null)} title="Active Grid Peers">
          <ManagePeers roomHash={roomHash} />
        </Modal>
      )}

      <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Workspace Settings">
        <div className="text-zinc-400 text-sm">Placeholder for extended project settings...</div>
      </Modal>
    </div>
  );
}