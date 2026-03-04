import React, { useState } from 'react';
import { 
  FolderCode, HardDrive, Network, Github, Settings, 
  UserCircle, LogOut 
} from 'lucide-react';
import styles from './DashboardSidebar.module.css';

export default function DashboardSidebar({ activeTab, setActiveTab, onLogout }) {
  // Manage hover expansion state locally
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <aside 
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <div className={styles.header}>
        <div className={styles.logoIcon}>C</div>
        <h2 className={styles.title}>Co-Lab</h2>
      </div>

      <nav className={styles.nav}>
        <button 
          onClick={() => setActiveTab('workspaces')} 
          className={`${styles.navLink} ${activeTab === 'workspaces' ? styles.navLinkActive : ''}`}
        >
          <FolderCode size={20} className={styles.icon} />
          <span className={styles.text}>Workspaces</span>
        </button>

        <button 
          onClick={() => setActiveTab('ghost')} 
          className={`${styles.navLink} ${activeTab === 'ghost' ? styles.navLinkActive : ''}`}
        >
          <HardDrive size={20} className={styles.icon} />
          <span className={styles.text}>Ghost Files</span>
        </button>

        <button 
          onClick={() => setActiveTab('network')} 
          className={`${styles.navLink} ${activeTab === 'network' ? styles.navLinkActive : ''}`}
        >
          <Network size={20} className={styles.icon} />
          <span className={styles.text}>P2P Network</span>
        </button>

        <button className={styles.navLink}>
          <Github size={20} className={styles.icon} />
          <span className={styles.text}>GitHub Sync</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')} 
          className={`${styles.navLink} ${activeTab === 'settings' ? styles.navLinkActive : ''}`}
        >
          <Settings size={20} className={styles.icon} />
          <span className={styles.text}>Settings</span>
        </button>
      </nav>

      <div className={styles.footer}>
        <div className={styles.profile}>
          <UserCircle size={32} className={styles.profileIcon} />
          <div className={styles.profileInfo}>
            <span className={styles.userName}>Pavan</span>
            <span className={styles.userRole}>Root Admin</span>
          </div>
        </div>
        <button onClick={onLogout} className={styles.logoutButton} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}