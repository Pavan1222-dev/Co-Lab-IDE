import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Hash, Terminal, Plus, Users, HardDrive, ArrowRight, Crown, 
  Loader2, Link, Play, Shield, Lock, X, FolderOpen, Mail, 
  CheckCircle2, ShieldAlert, MessageSquare 
} from 'lucide-react';
import { db, auth } from '../../../services/firebase';
import { collection, addDoc, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { getUserWorkspaces } from '../../../services/workspaceService';
import { open } from '@tauri-apps/plugin-dialog';

import { mkdir, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join, appLocalDataDir } from '@tauri-apps/api/path';
import toast from 'react-hot-toast';
import styles from '../core/Dashboard.module.css';

const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

const getNativeMemoryPath = async () => {
  try {
    const baseDir = await appLocalDataDir();
    if (!(await exists(baseDir))) await mkdir(baseDir, { recursive: true });
    return await join(baseDir, 'colab_memory.json');
  } catch (err) { 
    console.debug("Data dir access skipped:", err);
    return null; 
  }
};

const savePathToMemory = async (hash, path) => {
  try {
    const memPath = await getNativeMemoryPath();
    if (!memPath) return localStorage.setItem(`colab_${hash}`, path); 
    let data = {};
    if (await exists(memPath)) data = JSON.parse(await readTextFile(memPath));
    data[hash] = path;
    await writeTextFile(memPath, JSON.stringify(data));
  } catch (err) { 
    console.debug("Memory write fallback:", err);
    localStorage.setItem(`colab_${hash}`, path); 
  }
};

const getPathFromMemory = async (hash) => {
  try {
    const memPath = await getNativeMemoryPath();
    if (!memPath) return localStorage.getItem(`colab_${hash}`);
    if (await exists(memPath)) {
      const data = JSON.parse(await readTextFile(memPath));
      return data[hash] || localStorage.getItem(`colab_${hash}`);
    }
  } catch (err) {
    console.debug("Memory read fallback:", err);
  }
  return localStorage.getItem(`colab_${hash}`);
};

export default function WorkspacesTab({ onOpenIde }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  
  const [createStep, setCreateStep] = useState(1);
  const [projectData, setProjectData] = useState({ name: '', memberCount: 5, password: '', allowFileWrites: true, allowTerminal: false });
  const [hostFolderPath, setHostFolderPath] = useState(''); 
  const [inviteEmails, setInviteEmails] = useState([]);
  const [emailInput, setEmailInput] = useState('');

  const [joinHash, setJoinHash] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinMessage, setJoinMessage] = useState(''); 
  const [guestSyncPath, setGuestSyncPath] = useState(''); 
  const [fetchedProjectName, setFetchedProjectName] = useState('');
  
  const [activeRequest, setActiveRequest] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const syncWithGrid = async () => {
      try {
        const data = await getUserWorkspaces(auth.currentUser.uid);
        setWorkspaces(data);
      } catch (error) { 
        console.error(error); 
      } finally { setLoading(false); }
    };
    syncWithGrid();
  }, []);

  const handleHostBrowse = async () => {
    if (!isTauri) return toast.error("Folder sync requires the Desktop App.");
    if (!projectData.name.trim()) return toast.error("Please enter a Project Designation first.");
    if (projectData.password.length < 8 || projectData.password.length > 16) return toast.error("Password must be 8-16 characters long.");

    try {
      const baseLocation = await open({ directory: true, multiple: false });
      if (baseLocation) {
        const fullProjectPath = await join(baseLocation, projectData.name.trim());
        const folderExists = await exists(fullProjectPath);
        if (!folderExists) await mkdir(fullProjectPath, { recursive: true });
        
        setHostFolderPath(fullProjectPath);
        toast.success(`Target locked: ${fullProjectPath}`);
      }
    } catch (err) { 
      console.error(err);
      toast.error("OS Access Denied or Folder Creation Failed"); 
    }
  };

  const addEmailInvite = (e) => {
    e.preventDefault();
    if (emailInput.trim() && emailInput.includes('@')) {
      if (!inviteEmails.includes(emailInput.trim())) setInviteEmails([...inviteEmails, emailInput.trim()]);
      setEmailInput('');
    } else { toast.error("Enter a valid email address."); }
  };

  const removeEmailInvite = (email) => setInviteEmails(inviteEmails.filter(e => e !== email));

  const handleFinalCreateSubmit = async () => {
    setIsProcessing(true);
    const uniqueHash = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    try {
      await setDoc(doc(db, "projects", uniqueHash), {
        ...projectData, hash: uniqueHash, hostId: auth.currentUser.uid, hostName: auth.currentUser.displayName || 'Root Admin',
        hostEmail: auth.currentUser.email, createdAt: Date.now(), status: 'active', invitedEmails: inviteEmails
      });

      if (inviteEmails.length > 0) {
        toast.loading("Dispatching Security Emails...", { id: 'emailToast' });
        try {
          await fetch('https://colab-matchmaker-v2.onrender.com/api/invite', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName: projectData.name, hash: uniqueHash, password: projectData.password, hostName: auth.currentUser.displayName || 'A Co-Lab Host', emails: inviteEmails })
          });
          toast.success("Invites sent successfully!", { id: 'emailToast' });
        } catch (emailErr) { 
          console.error(emailErr);
          toast.error("Project created, but emails failed to send.", { id: 'emailToast' }); 
        }
      } else { toast.success("Zero-Trust Core Initialized."); }

      setActiveModal(null);
      await savePathToMemory(uniqueHash, hostFolderPath);
      onOpenIde(uniqueHash, true, hostFolderPath);
    } catch (err) { 
      console.error(err);
      toast.error("Initialization failed."); 
    } finally { setIsProcessing(false); }
  };

  const handleJoinAuthSubmit = async (e) => {
    e.preventDefault();
    if (joinPassword.length < 8 || joinPassword.length > 16) return toast.error("Password must be exactly 8 to 16 characters long.");
    
    setIsProcessing(true);
    const rawHash = joinHash.trim();
    const upperHash = rawHash.toUpperCase();

    try {
      let targetHash = upperHash;
      let projectDoc = await getDoc(doc(db, "projects", targetHash));

      if (!projectDoc.exists()) {
        targetHash = rawHash;
        projectDoc = await getDoc(doc(db, "projects", targetHash));
      }
      if (!projectDoc.exists()) throw new Error("Hash does not exist in database");
      
      const pData = projectDoc.data();
      setFetchedProjectName(pData.name || "Co-Lab-Project"); 

      const waitlistRef = collection(db, "projects", targetHash, "waitlist");
      const guestDocRef = await addDoc(waitlistRef, {
        uid: auth.currentUser.uid, name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0], email: auth.currentUser.email,
        message: joinMessage.trim() || 'No message provided.', enteredPassword: joinPassword, status: 'pending', timestamp: Date.now()
      });

      setActiveModal(null);
      toast.success("Request sent! The host has been notified.");
      setActiveRequest({ hash: targetHash, status: 'pending', docId: guestDocRef.id });

      onSnapshot(guestDocRef, (docSnap) => {
        const data = docSnap.data();
        if (data) {
          if (data.status === 'approved') {
            toast.success(`Access Granted to ${targetHash}!`, { icon: '🎉' });
            setActiveRequest({ hash: targetHash, status: 'approved', docId: guestDocRef.id });
          } else if (data.status === 'rejected') {
            toast.error(`Entry Denied for ${targetHash}.`);
            setActiveRequest({ hash: targetHash, status: 'rejected', docId: guestDocRef.id });
          }
        }
      });
    } catch (err) { 
      console.error(err);
      toast.error("Network Error. Check hash validity."); 
    } finally { setIsProcessing(false); }
  };

  const handleGuestBrowse = async () => {
    if (!isTauri) return toast.error("Folder sync requires the Desktop App.");
    if (!fetchedProjectName) return toast.error("Project name could not be resolved from Hash.");
    try {
      const baseLocation = await open({ directory: true, multiple: false });
      if (baseLocation) {
         const fullGuestPath = await join(baseLocation, fetchedProjectName);
         const folderExists = await exists(fullGuestPath);
         if (!folderExists) await mkdir(fullGuestPath, { recursive: true });
         setGuestSyncPath(fullGuestPath);
         toast.success(`Sync Destination Locked: ${fullGuestPath}`);
      }
    } catch (err) { 
      console.error(err);
      toast.error("OS Access Denied or Folder Creation Failed"); 
    }
  };

  const handleFinalGuestLaunch = async () => {
    if (!guestSyncPath) return toast.error("You must select a base destination folder.");
    await savePathToMemory(activeRequest.hash, guestSyncPath);
    onOpenIde(activeRequest.hash, false, guestSyncPath);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={styles.themedCard}>
          <div className="flex items-center gap-2 text-[#c084fc] mb-4"><Link size={18}/><h3 className="text-sm font-bold uppercase tracking-widest">Join Network</h3></div>
          <p className="text-xs text-zinc-500 mb-6">Enter a WebRTC hash to request access to an existing node.</p>
          <div className="flex flex-col gap-3 mt-auto">
            <div className="relative"><Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" /><input type="text" placeholder="A1B2C3D4" className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-sm font-mono focus:border-[#c084fc] transition-all outline-none uppercase tracking-widest" value={joinHash} onChange={(e) => setJoinHash(e.target.value)} /></div>
            <button onClick={() => { if(!joinHash) toast.error("Enter Hash"); else setActiveModal('joinAuth'); }} className={styles.actionBtnSolid}>Request Entry</button>
          </div>
        </div>

        <div className={styles.themedCard}>
          <div className="flex items-center gap-2 text-[#f472b6] mb-4"><Terminal size={18}/><h3 className="text-sm font-bold uppercase tracking-widest">Initialize New Core</h3></div>
          <p className="text-xs text-zinc-500 mb-6">Provision a fresh zero-trust workspace and generate an invite hash.</p>
          <button onClick={() => { setActiveModal('create'); setCreateStep(1); }} className={styles.actionBtnSolid} style={{ marginTop: 'auto' }}><Plus size={16}/> Create Node</button>
        </div>
      </div>

      <AnimatePresence>
        {activeRequest && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`w-full p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${activeRequest.status === 'pending' ? 'bg-black border-[#c084fc]/50 ring-1 ring-[#c084fc]/20' : activeRequest.status === 'approved' ? 'bg-[#00ff41]/5 border-[#00ff41]/50' : 'bg-red-500/5 border-red-500/50'}`}>
            <div className="flex items-center gap-4">
              {activeRequest.status === 'pending' && <Loader2 size={24} className="text-[#c084fc] animate-spin" />}
              {activeRequest.status === 'approved' && <CheckCircle2 size={24} className="text-[#00ff41]" />}
              {activeRequest.status === 'rejected' && <ShieldAlert size={24} className="text-red-500" />}
              <div>
                <h4 className={`text-sm font-bold uppercase tracking-widest ${activeRequest.status === 'pending' ? 'text-[#c084fc]' : activeRequest.status === 'approved' ? 'text-[#00ff41]' : 'text-red-500'}`}>
                  {activeRequest.status === 'pending' ? 'Awaiting Host Approval' : activeRequest.status === 'approved' ? 'Access Granted' : 'Entry Denied'}
                </h4>
                <p className="text-xs text-zinc-500 font-mono mt-1">Room: {activeRequest.hash}</p>
              </div>
            </div>
            {activeRequest.status === 'approved' && (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={handleGuestBrowse} className="px-4 py-2 border border-[#00ff41]/30 hover:border-[#00ff41] bg-black text-zinc-400 hover:text-white rounded-lg text-xs uppercase tracking-widest font-bold transition-colors flex items-center gap-2"><FolderOpen size={14}/> {guestSyncPath ? 'Change Base Location' : 'Select Base Location'}</button>
                <button onClick={handleFinalGuestLaunch} disabled={!guestSyncPath} className="px-6 py-2 bg-[#00ff41] hover:bg-green-400 text-black rounded-lg text-xs uppercase tracking-widest font-black transition-colors disabled:opacity-50 flex items-center gap-2">Enter IDE <ArrowRight size={14}/></button>
              </div>
            )}
            {activeRequest.status === 'rejected' && (<button onClick={() => setActiveRequest(null)} className="px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-xs uppercase tracking-widest font-bold transition-colors">Dismiss</button>)}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 px-1 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse" /> Active Grid Nodes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? ( <Loader2 className="animate-spin text-[#c084fc] mx-auto col-span-full my-10" size={32} /> ) : 
           workspaces.length === 0 ? ( <div className="col-span-full py-10 border border-dashed border-zinc-800 text-center text-zinc-600 font-mono text-xs">NO LOCAL NODES DETECTED.</div> ) : 
           ( workspaces.map((ws) => {
             const isHost = ws.hostId === auth.currentUser?.uid;
             return (
               <div key={ws.id} className={`${styles.themedCard} group hover:border-[#c084fc]/50 transition-all cursor-default`}>
                 <div className="flex justify-between items-start mb-6">
                   <div className="bg-zinc-900 p-3 rounded-xl text-[#c084fc]"><HardDrive size={20} /></div>
                   <div className="flex flex-col items-end gap-2">
                     {isHost ? <span className="text-[9px] font-black bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded uppercase flex items-center gap-1"><Crown size={10}/> Host</span> : <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-2 py-1 rounded uppercase flex items-center gap-1"><Users size={10}/> Member</span>}
                     <span className="text-[10px] font-mono text-zinc-500 bg-black px-2 py-1 rounded border border-zinc-800">{ws.hash || ws.id}</span>
                   </div>
                 </div>
                 <h3 className="text-lg font-bold group-hover:text-[#c084fc] transition-colors">{ws.name}</h3>
                 <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase"><Play size={10} className="text-[#00ff41]"/> Online</div>
                   <button 
                     onClick={async () => {
                       const targetHash = ws.hash || ws.id;
                       let savedPath = await getPathFromMemory(targetHash);

                       if (!savedPath && isTauri) {
                         toast.error("Path memory lost. Please re-select the project folder.", { duration: 4000 });
                         try {
                           savedPath = await open({ directory: true, multiple: false });
                           if (savedPath) await savePathToMemory(targetHash, savedPath);
                           else return; 
                         } catch (err) { 
                           console.debug(err);
                           return; 
                         }
                       }
                       onOpenIde(targetHash, isHost, savedPath);
                     }} 
                     className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-[#c084fc] group-hover:translate-x-1 transition-all"
                   >
                     Mount <ArrowRight size={12} />
                   </button>
                 </div>
               </div>
             )
           }))}
        </div>
      </div>

      <AnimatePresence>
        {activeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            
            {activeModal === 'create' && (
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-2xl shadow-2xl relative">
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
                {createStep === 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); setCreateStep(2); }} className="flex flex-col gap-6">
                    <h2 className="text-xl font-black text-[#c084fc] tracking-widest uppercase flex items-center gap-3"><Shield size={24}/> Security Core</h2>
                    <div><label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Project Designation</label><input required type="text" value={projectData.name} onChange={e=>setProjectData({...projectData, name:e.target.value})} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-[#c084fc] rounded-lg" /></div>
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Max Peers</label><input type="number" min="1" max="10" value={projectData.memberCount} onChange={e=>setProjectData({...projectData, memberCount:e.target.value})} className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none rounded-lg" /></div>
                      <div className="flex-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Access Password</label>
                        <input 
                          required type="password" placeholder="8-16 chars" 
                          value={projectData.password} onChange={e=>setProjectData({...projectData, password:e.target.value})} 
                          minLength={8} maxLength={16} // 🔴 ADDED HTML LIMITS
                          className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-[#c084fc] rounded-lg" 
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-3 mt-4 bg-white text-black font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200">Next: Browse Base Location <ArrowRight size={16} className="inline ml-2"/></button>
                  </form>
                )}
                {createStep === 2 && (
                  <div className="flex flex-col gap-6">
                    <h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3"><FolderOpen size={24} className="text-[#c084fc]"/> Mount OS Space</h2>
                    <p className="text-xs text-zinc-400 font-mono leading-relaxed">Select a base location. A folder named <strong>"{projectData.name}"</strong> will be generated inside it.</p>
                    <div onClick={handleHostBrowse} className="w-full h-32 border-2 border-dashed border-zinc-700 hover:border-[#c084fc] bg-black rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors group"><FolderOpen size={32} className="text-zinc-600 group-hover:text-[#c084fc] mb-2 transition-colors" /><span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-widest">Click to Browse PC</span></div>
                    {hostFolderPath && (<div className="bg-[#c084fc]/10 border border-[#c084fc]/30 p-3 rounded-lg flex items-center gap-3"><CheckCircle2 size={16} className="text-[#c084fc] shrink-0" /><span className="text-[10px] font-mono text-zinc-300 truncate">{hostFolderPath}</span></div>)}
                    <div className="flex gap-3 mt-4"><button onClick={() => setCreateStep(1)} className="flex-1 py-3 border border-zinc-800 text-zinc-400 uppercase text-xs tracking-widest rounded-lg">Back</button><button onClick={() => { if(hostFolderPath) setCreateStep(3); else toast.error("Please select a base location"); }} className="flex-1 py-3 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg">Next: Invites</button></div>
                  </div>
                )}
                {createStep === 3 && (
                  <div className="flex flex-col gap-6">
                    <h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3"><Mail size={24} className="text-[#c084fc]"/> Invite Peers</h2>
                    <p className="text-xs text-zinc-400 font-mono leading-relaxed">Add member emails.</p>
                    <form onSubmit={addEmailInvite} className="flex gap-2"><input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} placeholder="peer@domain.com" className="flex-1 bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-[#c084fc] rounded-lg" /><button type="submit" className="px-4 bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-zinc-700">Add</button></form>
                    <div className="min-h-25 max-h-37.5 overflow-y-auto bg-black border border-zinc-900 rounded-lg p-2 flex flex-col gap-2 custom-scrollbar">
                      {inviteEmails.length === 0 ? <div className="text-zinc-600 text-xs text-center mt-8 italic">No invites added.</div> : inviteEmails.map(email => (<div key={email} className="flex justify-between items-center bg-zinc-900 px-3 py-2 rounded border border-zinc-800 text-xs font-mono text-zinc-300">{email} <X size={14} className="text-red-400 cursor-pointer hover:text-red-500" onClick={() => removeEmailInvite(email)} /></div>))}
                    </div>
                    <div className="flex gap-3 mt-4"><button onClick={() => setCreateStep(2)} className="flex-1 py-3 border border-zinc-800 text-zinc-400 uppercase text-xs tracking-widest rounded-lg">Back</button><button onClick={handleFinalCreateSubmit} disabled={isProcessing} className="flex-2 py-3 bg-linear-to-r from-[#c084fc] to-[#f472b6] text-black font-black uppercase text-xs tracking-widest rounded-lg shadow-[0_0_20px_rgba(192,132,252,0.4)]">{isProcessing ? "Encrypting..." : "Launch Core"}</button></div>
                  </div>
                )}
              </motion.div>
            )}

            {activeModal === 'joinAuth' && (
              <motion.form initial={{ scale: 0.95 }} animate={{ scale: 1 }} onSubmit={handleJoinAuthSubmit} className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-2xl shadow-2xl relative flex flex-col gap-6">
                <button type="button" onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-zinc-500"><X size={20}/></button>
                <div><h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3"><Lock size={24} className="text-[#00ff41]"/> Verify Identity</h2><p className="text-xs text-zinc-400 font-mono mt-2">Provide the cryptographic key to alert the Host.</p></div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Project Password</label>
                  <input 
                    required type="password" placeholder="Enter Host Password (8-16 chars)" 
                    value={joinPassword} onChange={e=>setJoinPassword(e.target.value)} 
                    minLength={8} maxLength={16} // 🔴 ADDED HTML LIMITS
                    className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-[#00ff41] rounded-lg tracking-widest" 
                  />
                </div>
                <div><label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare size={12}/> Attach a Message (Optional)</label><textarea value={joinMessage} onChange={e=>setJoinMessage(e.target.value)} placeholder="Hey! It's Pavan. Let me in." className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-[#00ff41] rounded-lg resize-none min-h-20 custom-scrollbar" /></div>
                <button type="submit" disabled={isProcessing} className="w-full py-4 mt-2 bg-[#00ff41] text-black font-black uppercase tracking-widest rounded-lg hover:brightness-110 shadow-[0_0_20px_rgba(0,255,65,0.2)] flex items-center justify-center gap-2">{isProcessing ? "Transmitting..." : "Send Request"} <ArrowRight size={16} /></button>
              </motion.form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}