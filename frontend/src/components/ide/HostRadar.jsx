import React, { useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ShieldAlert, Check, X } from 'lucide-react';

export default function HostRadar({ roomHash, isHost }) {
  useEffect(() => {
    // Only the Host needs to run the security radar
    if (!isHost || !roomHash) return;

    console.log("[RADAR] Host Security Radar Online. Watching for intruders...");

    const waitlistRef = collection(db, "projects", roomHash, "waitlist");
    const q = query(waitlistRef, where("status", "==", "waiting"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const guestData = change.doc.data();
          const guestId = change.doc.id;

          // Trigger a persistent, custom Toast Notification for the Host
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-zinc-950 shadow-2xl rounded-lg pointer-events-auto flex flex-col border border-[#c084fc]/50 ring-1 ring-black`}>
              <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
                <ShieldAlert className="text-[#c084fc]" size={24} />
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-widest">Access Request</p>
                  <p className="text-xs text-zinc-400 font-mono">{guestData.email}</p>
                </div>
              </div>
              <div className="flex p-2 gap-2 bg-black/50 rounded-b-lg">
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, "projects", roomHash, "waitlist", guestId), { status: 'rejected' });
                    toast.dismiss(t.id);
                    toast.error("Access Denied.");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  <X size={16} /> Decline
                </button>
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, "projects", roomHash, "waitlist", guestId), { status: 'approved' });
                    toast.dismiss(t.id);
                    toast.success("Access Granted!");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#c084fc] hover:bg-purple-400 text-black rounded font-black text-xs uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(192,132,252,0.3)]"
                >
                  <Check size={16} /> Approve
                </button>
              </div>
            </div>
          ), { duration: Infinity, position: 'top-right' }); // Stays on screen until clicked
        }
      });
    });

    return () => unsubscribe();
  }, [roomHash, isHost]);

  return null; // This component is invisible!
}