import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { 
  UserMinus, Users, Clock, ShieldAlert, Skull, Shield, 
  Terminal, Edit3, ArrowLeft, Trash2, Mail, SlidersHorizontal
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ManagePeers({ roomHash }) {
  const [activePeers, setActivePeers] = useState([]);
  const [projectData, setProjectData] = useState({ memberCount: 5, invitedEmails: [] });
  
  const [view, setView] = useState('list'); 
  const [selectedPeer, setSelectedPeer] = useState(null);
  
  const [newInvite, setNewInvite] = useState('');
  const [nukeFiles, setNukeFiles] = useState(false);
  const [tempPerms, setTempPerms] = useState({ write: true, terminal: false });

  useEffect(() => {
    if (!roomHash) return;
    const unsubProject = onSnapshot(doc(db, 'projects', roomHash), (docSnap) => {
      if (docSnap.exists()) setProjectData(docSnap.data());
    });
    return () => unsubProject();
  }, [roomHash]);

  useEffect(() => {
    if (!roomHash) return;
    const q = query(collection(db, 'projects', roomHash, 'waitlist'), where('status', '==', 'approved'));
    const unsubPeers = onSnapshot(q, (snapshot) => {
      const peers = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }));
      setActivePeers(peers);
    });
    return () => unsubPeers();
  }, [roomHash]);

  const handleUpdateCapacity = async (newCount) => {
    try {
      await updateDoc(doc(db, 'projects', roomHash), { memberCount: Number(newCount) });
      toast.success(`Capacity adjusted to ${newCount} peers.`, { id: 'cap' });
    } catch {
      toast.error("Failed to update capacity."); 
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!newInvite.includes('@')) return toast.error("Invalid email.");
    try {
      await updateDoc(doc(db, 'projects', roomHash), { invitedEmails: arrayUnion(newInvite) });
      toast.success(`Invite dispatched to ${newInvite}`);
      setNewInvite('');
    } catch { 
      toast.error("Failed to send invite."); 
    }
  };

  const handleSavePermissions = async () => {
    try {
      await updateDoc(doc(db, 'projects', roomHash, 'waitlist', selectedPeer.id), {
        permissions: tempPerms
      });
      toast.success(`Permissions updated for ${selectedPeer.displayName || 'User'}`);
      setView('list');
    } catch { 
      toast.error("Failed to update permissions."); 
    }
  };

  const executeKickSequence = async () => {
    try {
      const finalStatus = nukeFiles ? 'kicked_nuke' : 'kicked_keep';
      
      await updateDoc(doc(db, 'projects', roomHash, 'waitlist', selectedPeer.id), { 
        status: finalStatus,
        kickedAt: Date.now()
      });
      
      if (nukeFiles) {
        toast.success(`NUKE PAYLOAD DELIVERED. Erasing ${selectedPeer.displayName}'s hard drive sync.`, { icon: '☢️', style: { background: '#ef4444', color: 'white' }});
      } else {
        toast.success(`Connection severed for ${selectedPeer.displayName}.`);
      }
      
      setView('list');
    } catch {
      toast.error('Failed to execute kick sequence.');
    }
  };

  if (view === 'perms' && selectedPeer) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full gap-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <button onClick={() => setView('list')} className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={16}/></button>
          <h3 className="font-bold text-[#c084fc] uppercase tracking-widest">Access Control: <span className="text-white">{selectedPeer.displayName}</span></h3>
        </div>
        
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between p-4 border border-zinc-800 rounded-xl bg-black/50 cursor-pointer hover:border-[#00ff41]/50 transition-colors">
            <div className="flex items-center gap-3">
              <Edit3 size={18} className={tempPerms.write ? "text-[#00ff41]" : "text-zinc-600"} />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">File Write Access</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">Allow user to modify, save, and delete local project files.</p>
              </div>
            </div>
            <input type="checkbox" checked={tempPerms.write} onChange={(e) => setTempPerms({...tempPerms, write: e.target.checked})} className="w-5 h-5 accent-[#00ff41]" />
          </label>

          <label className="flex items-center justify-between p-4 border border-zinc-800 rounded-xl bg-black/50 cursor-pointer hover:border-[#c084fc]/50 transition-colors">
            <div className="flex items-center gap-3">
              <Terminal size={18} className={tempPerms.terminal ? "text-[#c084fc]" : "text-zinc-600"} />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Host Terminal Access</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">Allow user to execute remote commands on your local OS.</p>
              </div>
            </div>
            <input type="checkbox" checked={tempPerms.terminal} onChange={(e) => setTempPerms({...tempPerms, terminal: e.target.checked})} className="w-5 h-5 accent-[#c084fc]" />
          </label>
        </div>

        <button onClick={handleSavePermissions} className="mt-auto w-full py-3 bg-white text-black font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors">
          Commit Security Policy
        </button>
      </motion.div>
    );
  }

  if (view === 'kick' && selectedPeer) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full gap-6">
        <div className="flex items-center gap-3 border-b border-red-900/50 pb-4">
          <button onClick={() => setView('list')} className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={16}/></button>
          <h3 className="font-bold text-red-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={18}/> Revoke Access</h3>
        </div>
        
        <p className="text-sm text-zinc-300 leading-relaxed font-mono">
          You are about to sever the P2P connection for <strong className="text-white">{selectedPeer.displayName}</strong>. They will immediately lose access to the live IDE session.
        </p>

        <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${nukeFiles ? 'bg-red-500/10 border-red-500' : 'bg-black/50 border-zinc-800 hover:border-red-500/50'}`}>
          <div className="flex items-start gap-3">
            <Skull size={20} className={nukeFiles ? "text-red-500 mt-0.5" : "text-zinc-600 mt-0.5"} />
            <div>
              <p className={`text-sm font-black uppercase tracking-widest ${nukeFiles ? 'text-red-500' : 'text-zinc-400'}`}>Execute Remote Nuke Protocol</p>
              <p className="text-xs text-zinc-500 font-mono mt-1 pr-4">Forces the target's operating system to permanently delete their local sync folder. This bypasses the recycle bin. Files cannot be recovered.</p>
            </div>
          </div>
          <input type="checkbox" checked={nukeFiles} onChange={(e) => setNukeFiles(e.target.checked)} className="w-6 h-6 accent-red-500 shrink-0" />
        </label>

        <button onClick={executeKickSequence} className="mt-auto w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          {nukeFiles ? 'Initiate Nuke & Kick' : 'Sever Connection Only'}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-4 bg-black/40 border border-zinc-800 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><SlidersHorizontal size={14}/> Network Capacity</span>
          <span className="text-xs font-mono text-[#c084fc] bg-[#c084fc]/10 px-2 py-0.5 rounded border border-[#c084fc]/30">{activePeers.length} / {projectData.memberCount} Nodes Active</span>
        </div>
        <input 
          type="range" min="1" max="20" step="1" 
          value={projectData.memberCount} 
          onChange={(e) => handleUpdateCapacity(e.target.value)}
          className="w-full accent-[#c084fc] cursor-ew-resize"
        />

        <div className="h-px w-full bg-zinc-800 my-1" />

        <form onSubmit={handleSendInvite} className="flex items-center gap-2">
          <Mail size={16} className="text-zinc-500" />
          <input 
            type="email" value={newInvite} onChange={e=>setNewInvite(e.target.value)} 
            placeholder="Invite peer by email..." 
            className="flex-1 bg-transparent border-none text-xs text-white outline-none font-mono placeholder-zinc-700" 
          />
          <button disabled={!newInvite} type="submit" className="text-[10px] bg-white text-black px-3 py-1.5 font-bold uppercase tracking-widest rounded disabled:opacity-50 transition-transform active:scale-95">Send</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
        {activePeers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 italic gap-3">
            <Users size={32} className="opacity-20" />
            <p className="text-xs font-mono uppercase tracking-widest">No foreign nodes attached.</p>
          </div>
        ) : (
          activePeers.map((peer) => {
            const displayName = peer.displayName || peer.name || 'Unknown User';
            const perms = peer.permissions || { write: true, terminal: false };
            
            return (
              <div key={peer.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg flex flex-col gap-3 hover:border-zinc-700 transition-colors">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#c084fc] to-[#f472b6] flex items-center justify-center text-black font-black text-xs shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                       <span className="font-bold text-white text-sm truncate">{displayName}</span>
                       <span className="text-[10px] text-zinc-500 font-mono truncate">{peer.email}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => { setSelectedPeer(peer); setTempPerms(perms); setView('perms'); }}
                      className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-[#c084fc] transition-colors" title="Security Policies"
                    >
                      <Shield size={14} />
                    </button>
                    <button 
                      onClick={() => { setSelectedPeer(peer); setNukeFiles(false); setView('kick'); }}
                      className="p-2 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-colors" title="Revoke Access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-11">
                  {perms.write ? <span className="text-[8px] bg-[#00ff41]/10 text-[#00ff41] px-1.5 py-0.5 rounded font-mono uppercase border border-[#00ff41]/30">Write Access</span> : <span className="text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono uppercase border border-red-500/30">Read Only</span>}
                  {perms.terminal && <span className="text-[8px] bg-[#c084fc]/10 text-[#c084fc] px-1.5 py-0.5 rounded font-mono uppercase border border-[#c084fc]/30">Terminal Auth</span>}
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}