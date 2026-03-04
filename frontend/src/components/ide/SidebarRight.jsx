import React from 'react';
import { X, ChevronDown } from 'lucide-react';
import styles from './IDE.module.css';

export default function SidebarRight({ setRightSidebarOpen }) {
  return (
    <div className={`${styles.sideBar} ${styles.rightSideBar}`}>
      <div className={styles.sideBarHeader}>
        <span>Outline</span>
        <X size={14} className="cursor-pointer hover:text-(--theme-primary)" onClick={() => setRightSidebarOpen(false)}/>
      </div>
      <div className={styles.fileTree}>
        <div className={styles.fileItem}><ChevronDown size={14} /> <span className="font-bold">App</span> [component]</div>
        <div className={styles.fileItem}><ChevronDown size={14} /> <span className="font-bold">LiveCursor</span> [component]</div>
      </div>
    </div>
  );
}