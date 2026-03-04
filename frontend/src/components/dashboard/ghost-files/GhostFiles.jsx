import React from 'react';
import { HardDrive, Database, Trash2, RefreshCw, Layers } from 'lucide-react';
import styles from './GhostFiles.module.css';

const indexedProjects = [
  { id: 1, name: "Land E-Commerce", size: "142 MB", files: "12,402", lastSync: "10 mins ago" },
  { id: 2, name: "React Source Code", size: "8.4 MB", files: "1,840", lastSync: "2 days ago" },
  { id: 3, name: "Project Sales Corp", size: "1.2 GB", files: "84,019", lastSync: "1 hr ago" },
];

export default function GhostFiles() {
  return (
    <div className={styles.ghostContainer}>
      <div className={styles.headerArea}>
        <div>
          <h1 className={styles.title}>Ghost <span className={styles.titleHighlight}>Protocol</span></h1>
          <p className="text-(--text-muted) mt-2">Manage local skeleton metadata and cache allocations.</p>
        </div>
        <button className={styles.actionBtn} style={{ width: 'auto', padding: '10px 20px', borderColor: '#ef4444', color: '#ef4444' }}>
          <Trash2 size={14} /> Purge All Cache
        </button>
      </div>

      <div className={styles.storageCard}>
        <div className="flex items-center gap-3 text-(--theme-primary) mb-2">
          <HardDrive size={24} />
          <h2 className="font-bold tracking-widest uppercase">Local SSD Allocation</h2>
        </div>
        <div className={styles.storageBarBg}>
          <div className={styles.storageBarFill} style={{ width: '35%' }} />
        </div>
        <div className={styles.storageStats}>
          <span>1.35 GB Cached</span>
          <span>10.0 GB Limit</span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-(--text-main)">
          <Database size={18} className="text-(--theme-primary)" /> Indexed Workspaces
        </h3>
        <div className={styles.indexGrid}>
          {indexedProjects.map(proj => (
            <div key={proj.id} className={styles.indexCard}>
              <div className={styles.indexHeader}>
                <h4 className={styles.indexTitle}>{proj.name}</h4>
              </div>
              <div className={styles.indexMeta}>
                <span className="flex items-center gap-1"><Layers size={14} /> {proj.files} Files</span>
                <span className="flex items-center gap-1"><RefreshCw size={14} /> {proj.lastSync}</span>
              </div>
              <div className={styles.actionGroup}>
                <div className="flex items-center justify-center font-bold text-xs text-(--text-main)">
                  {proj.size}
                </div>
                <button className={styles.actionBtn}><RefreshCw size={12} /> Re-Index</button>
                <button className={styles.actionBtnDanger}><Trash2 size={12} /> Purge</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}