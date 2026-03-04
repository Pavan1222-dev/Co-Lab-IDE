import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, Menu } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function AssistiveHUD() {
  const [isAssistiveOpen, setIsAssistiveOpen] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const toggleMain = () => {
    setIsAssistiveOpen(!isAssistiveOpen);
    if (isAssistiveOpen) setShowTelemetry(false);
  };

  return (
    <div className={styles.assistiveWrapper}>
      <AnimatePresence>
        {showTelemetry && (
          <motion.div initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }} className={styles.telemetryPanel}>
            <h3 className="text-xs font-bold text-(--theme-primary) uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-(--theme-primary) pb-2"><Activity size={14}/> System Telemetry</h3>
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-(--text-muted) uppercase mb-1"><span>CPU Load</span><span>32%</span></div>
              <div className={styles.teleBarBg}><div className={styles.teleBarFill} style={{width: '32%'}}/></div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-(--text-muted) uppercase mb-1"><span>Local Memory</span><span>4.1 / 8 GB</span></div>
              <div className={styles.teleBarBg}><div className={styles.teleBarFill} style={{width: '51%'}}/></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAssistiveOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }} className={styles.assistiveMenu}>
            <div onClick={() => setShowTelemetry(!showTelemetry)} className={`${styles.menuSlot} ${showTelemetry ? styles.menuSlotActive : ''}`}>
              <Cpu size={20} />
              <span className="text-[8px] uppercase tracking-widest font-bold">Metrics</span>
            </div>
            <div className={styles.menuSlot}></div>
            <div className={styles.menuSlot}></div>
            <div className={styles.menuSlot}></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div onClick={toggleMain} className={styles.assistiveMainBtn}>
        <Menu size={24} />
      </div>
    </div>
  );
}