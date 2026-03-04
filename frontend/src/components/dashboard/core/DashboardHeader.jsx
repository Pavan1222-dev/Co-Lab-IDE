import React from 'react';
import { Search, Bell, LogOut } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function DashboardHeader({ onLogout }) {
  return (
    <header className={styles.header}>
      <div className={styles.searchBox}>
        <Search size={16} className="text-zinc-500" />
        <input 
          type="text" 
          placeholder="Search commands, projects..." 
          className={styles.searchInput} 
        />
      </div>
      <div className={styles.headerActions}>
        <button className={styles.iconBtn} title="Notifications">
          <Bell size={20} />
          <div className={styles.notificationDot} />
        </button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <button onClick={onLogout} className={styles.iconBtn} title="Secure Logout">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}