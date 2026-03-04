import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { UserMinus, Users, Clock } from 'lucide-react';

export default function ManagePeers({ roomHash }) {
  const [activePeers, setActivePeers] = useState([]);

  useEffect(() => {
    if (!roomHash) return;

    // We query the waitlist for everyone who has 'approved' status.
    const q = query(
      collection(db, 'projects', roomHash, 'waitlist'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const peers = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      setActivePeers(peers);
    });
    
    return () => unsubscribe();
  }, [roomHash]);

  const handleRevokeAccess = async (requestId, displayName) => {
    try {
      // Deleting their document from the waitlist instantly severs their WebRTC signaling permissions
      await deleteDoc(doc(db, 'projects', roomHash, 'waitlist', requestId));
      toast.success(`Revoked access for ${displayName}.`);
    } catch (err) {
      console.error("[Revoke Error]:", err);
      toast.error('Failed to revoke access.');
    }
  };

  if (activePeers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic gap-4 py-8">
        <Users size={48} className="opacity-20" />
        <p className="text-sm font-mono">No active peers in this node.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
      {activePeers.map((peer) => {
        const displayName = peer.displayName || peer.name || 'Unknown User';
        
        return (
          <div key={peer.id} className="bg-black/50 border border-zinc-800 p-4 rounded-lg shadow-md flex items-center justify-between gap-4 group hover:border-red-500/30 transition-colors">
            
            <div className="flex flex-col flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1">
                 <span className="font-bold text-[#c084fc] truncate">{displayName}</span>
                 <span className="text-[10px] bg-[#00ff41]/10 text-[#00ff41] px-1.5 py-0.5 rounded font-mono uppercase tracking-widest">Active</span>
               </div>
               <span className="text-xs text-zinc-500 font-mono truncate">{peer.email}</span>
               
               <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mt-2 font-mono">
                  <Clock size={10} /> Joined: {new Date(peer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
            </div>
            
            <button 
              onClick={() => handleRevokeAccess(peer.id, displayName)} 
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-500 group-hover:border-red-500 group-hover:bg-red-500/20 group-hover:text-red-400 transition-all shadow-sm"
              title="Revoke Access (Kick)"
            >
              <UserMinus size={18} />
            </button>
            
          </div>
        );
      })}
    </div>
  );
}