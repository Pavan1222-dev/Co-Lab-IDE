import React, { useState } from 'react';
import { 
  Files, Search, GitBranch, Users, Settings, 
  UserCircle, LogOut, Cloud, Key, Check, ChevronRight 
} from 'lucide-react';
import styles from './IDE.module.css';

export default function ActivityBar({ closeMenusTrigger }) {
  const [activeTab, setActiveTab] = useState('files');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  
  // FIX: React 18+ Pattern: Derive state during render instead of useEffect
  const [prevTrigger, setPrevTrigger] = useState(closeMenusTrigger);
  if (closeMenusTrigger !== prevTrigger) {
    setPrevTrigger(closeMenusTrigger);
    setAccountMenuOpen(false);
    setSettingsMenuOpen(false);
  }

  const toggleAccountMenu = (e) => {
    e.stopPropagation();
    setAccountMenuOpen(!accountMenuOpen);
    setSettingsMenuOpen(false);
  };

  const toggleSettingsMenu = (e) => {
    e.stopPropagation();
    setSettingsMenuOpen(!settingsMenuOpen);
    setAccountMenuOpen(false);
  };

  return (
    <div className={styles.activityBar} onClick={(e) => e.stopPropagation()}>
      
      {/* --- TOP ICONS --- */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setActiveTab('files')}
          className={`${styles.activityBtn} ${activeTab === 'files' ? styles.activityBtnActive : ''}`}
          title="Explorer (Ctrl+Shift+E)"
        >
          <Files size={24} />
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={`${styles.activityBtn} ${activeTab === 'search' ? styles.activityBtnActive : ''}`}
          title="Search (Ctrl+Shift+F)"
        >
          <Search size={24} />
        </button>
        <button 
          onClick={() => setActiveTab('git')}
          className={`${styles.activityBtn} ${activeTab === 'git' ? styles.activityBtnActive : ''}`}
          title="Source Control (Ctrl+Shift+G)"
        >
          <GitBranch size={24} />
          <span className={styles.activityBadge}>3</span>
        </button>
        <button 
          onClick={() => setActiveTab('peers')}
          className={`${styles.activityBtn} ${activeTab === 'peers' ? styles.activityBtnActive : ''}`}
          title="P2P Network Mesh"
        >
          <Users size={24} />
        </button>
      </div>

      {/* --- BOTTOM ICONS (Settings & Account) --- */}
      <div className="mt-auto flex flex-col gap-4 items-center">
        <button className={styles.activityBtn} onClick={toggleAccountMenu} title="Accounts">
          <div className={styles.avatarBtn}>P</div>
        </button>
        <button className={styles.activityBtn} onClick={toggleSettingsMenu} title="Manage">
          <Settings size={24} className={settingsMenuOpen ? "text-(--theme-primary)" : ""} />
        </button>
      </div>

      {/* --- ACCOUNT MENU POPUP --- */}
      {accountMenuOpen && (
        <div className={`${styles.contextMenu} ${styles.contextMenuBottomLeft}`}>
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2"><UserCircle size={16}/> Pavan1222-dev (GitHub)</span>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2"><Check size={14} className="text-(--theme-primary)"/> Settings Sync is On</span>
          </div>
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2"><Cloud size={16}/> Turn on Cloud Changes...</span>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2"><Key size={16}/> Manage Extension Account Preferences...</span>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2 text-red-400 hover:text-red-500"><LogOut size={16}/> Sign Out</span>
          </div>
        </div>
      )}

      {/* --- SETTINGS MENU POPUP --- */}
      {settingsMenuOpen && (
        <div className={`${styles.contextMenu} ${styles.contextMenuBottomLeft}`}>
          <div className={styles.contextMenuItem}>
            <span>Command Palette...</span> <span className="text-(--text-muted) text-xs">Ctrl+Shift+P</span>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span>Settings</span> <span className="text-(--text-muted) text-xs">Ctrl+,</span>
          </div>
          <div className={styles.contextMenuItem}>
            <span>Extensions</span> <span className="text-(--text-muted) text-xs">Ctrl+Shift+X</span>
          </div>
          <div className={styles.contextMenuItem}>
            <span>Keyboard Shortcuts</span> <span className="text-(--text-muted) text-xs">Ctrl+K Ctrl+S</span>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span>Themes</span> <ChevronRight size={14}/>
          </div>
          <div className={styles.contextMenuSeparator} />
          <div className={styles.contextMenuItem}>
            <span className="flex items-center gap-2"><Check size={14} className="text-(--theme-primary)"/> Settings Sync is On</span>
          </div>
        </div>
      )}

    </div>
  );
}