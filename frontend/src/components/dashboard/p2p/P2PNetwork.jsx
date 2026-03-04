import React from 'react';
import { motion } from 'framer-motion';
import { Network, Activity, Globe, Zap, ShieldCheck } from 'lucide-react';
import styles from './P2PNetwork.module.css';

const peers = [
  { id: 1, alias: "Srinadh", ip: "192.168.1.104", ping: "12ms", status: "online", project: "Land E-Commerce" },
  { id: 2, alias: "Subham", ip: "10.0.0.45", ping: "45ms", status: "syncing", project: "Land E-Commerce" },
  { id: 3, alias: "Pavan_Laptop", ip: "Localhost", ping: "0ms", status: "online", project: "Student Skill Platform" },
];

export default function P2PNetwork() {
  return (
    <div className={styles.networkContainer}>
      <div className="border-b border-(--border-style) pb-6">
        <h1 className={styles.title}>Mesh <span className={styles.titleHighlight}>Topology</span></h1>
        <p className="text-(--text-muted) mt-2">Live WebRTC and peer-to-peer connection routing.</p>
      </div>

      <div className={styles.topologyCard}>
        {/* Radar Rings Background */}
        <div className={styles.radarRings}>
          <div className={styles.ring} style={{ width: '150px', height: '150px', animation: 'spin 10s linear infinite' }} />
          <div className={styles.ring} style={{ width: '300px', height: '300px', animation: 'spin 15s linear infinite reverse' }} />
          <div className={styles.ring} style={{ width: '450px', height: '450px', animation: 'spin 20s linear infinite' }} />
        </div>
        
        {/* Your Local Node */}
        <div className={styles.centralNode}>
          <Globe size={24} />
        </div>

        {/* Orbiting Peers */}
        <motion.div className={styles.peerNode} animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} style={{ top: '20%', left: '30%', transformOrigin: '200px 100px' }}>
           S
        </motion.div>
        <motion.div className={styles.peerNode} animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} style={{ bottom: '25%', right: '25%', transformOrigin: '-150px -150px', borderColor: '#00ff41', color: '#00ff41' }}>
           S
        </motion.div>
      </div>

      <div className="flex gap-4 mb-2">
         <div className="px-4 py-2 rounded-(--radius-btn) border border-(--border-style) bg-(--bg-panel) flex items-center gap-2 text-xs font-bold text-(--theme-primary) uppercase">
            <ShieldCheck size={16} /> WebRTC Secure
         </div>
         <div className="px-4 py-2 rounded-(--radius-btn) border border-(--border-style) bg-(--bg-panel) flex items-center gap-2 text-xs font-bold text-(--theme-primary) uppercase">
            <Zap size={16} /> Relay: STUN Enabled
         </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Peer Alias</th>
              <th className={styles.th}>Local / Remote IP</th>
              <th className={styles.th}>Latency</th>
              <th className={styles.th}>Active Workspace</th>
              <th className={styles.th}>Connection State</th>
            </tr>
          </thead>
          <tbody>
            {peers.map(peer => (
              <tr key={peer.id} className={styles.tr}>
                <td className={styles.td}><span className="font-bold flex items-center gap-2"><Activity size={14} className="text-(--theme-primary)"/> {peer.alias}</span></td>
                <td className={styles.td}><span className="text-(--text-muted) font-mono">{peer.ip}</span></td>
                <td className={styles.td}>
                  <div className={styles.pingBadge}>
                    <div className={styles.pingDot} style={{ backgroundColor: parseInt(peer.ping) > 30 ? '#eab308' : '#00ff41', boxShadow: `0 0 5px ${parseInt(peer.ping) > 30 ? '#eab308' : '#00ff41'}` }} />
                    {peer.ping}
                  </div>
                </td>
                <td className={styles.td}>{peer.project}</td>
                <td className={styles.td}>
                  <span className={`${styles.statusBadge} ${peer.status === 'online' ? styles.statusOnline : styles.statusSync}`}>
                    {peer.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}