import React, { useState } from 'react';
import { Code2, ArrowRight } from 'lucide-react';
import styles from './Dashboard.module.css';

import DashboardSidebar from '../sidebar/DashboardSidebar';
import DashboardHeader from './DashboardHeader';
import WorkspacesTab from '../workspaces/WorkspacesTab';
import AssistiveHUD from './AssistiveHUD';
import GhostFiles from '../ghost-files/GhostFiles'; 
import P2PNetwork from '../p2p/P2PNetwork';
import SettingsDashboard from '../settings/SettingsDashboard'; 

export default function DashboardShell({ onLogout, onOpenIde }) { 
  const [activeTab, setActiveTab] = useState('workspaces'); 

  return (
    <div className={styles.mainContainer}>
      <div className={styles.bgGrid} />
      <div className={styles.ambientGlow} />

      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />

      <main className={styles.mainArea}>
        <DashboardHeader onLogout={onLogout} />

        <div className={styles.contentScroll}>
          <div className="max-w-7xl mx-auto w-full pb-32">
            {activeTab === 'workspaces' ? (
              <WorkspacesTab onOpenIde={onOpenIde} />
            ) : activeTab === 'ghost' ? (
              <GhostFiles />
            ) : activeTab === 'network' ? (
              <P2PNetwork />
            ) : activeTab === 'settings' ? (
              <SettingsDashboard />
            ) : null}
          </div>
        </div>
      </main>

      <button onClick={() => onOpenIde(null, true, null)} className={styles.globalIdeBtn} title="Launch General Workspace">
        <Code2 size={20} />
        <span>Launch IDE</span>
        <ArrowRight size={16} />
      </button>

      <AssistiveHUD />
    </div>
  );
}