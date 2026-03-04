import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Check, X, BellOff, Quote } from 'lucide-react';

export default function Notifications({ roomHash }) {
  const [requests, setRequests] = useState([]);

  // 🔴 THE CRASH FIX: This safely handles both standard numbers and Firebase Timestamps
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown time';
    }
  };

  useEffect(() => {
    if (!roomHash) return;

    const q = query(
      collection(db, 'projects', roomHash, 'waitlist'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingRequests = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      setRequests(pendingRequests);
    });
    
    return () => unsubscribe();
  }, [roomHash]);

  const handleAccept = async (requestId, userId, displayName) => {
    try {
      await updateDoc(doc(db, 'projects', roomHash, 'waitlist', requestId), { status: 'approved' });
      // Adds the user to the main project members array securely
      if (userId) {
        await updateDoc(doc(db, 'projects', roomHash), { members: arrayUnion(userId) });
      }
      toast.success(`${displayName || 'User'} added to workspace.`);
    } catch (err) {
      console.error("[Accept Error]:", err);
      toast.error('Failed to accept request.');
    }
  };

  const handleReject = async (requestId, displayName) => {
    try {
      await updateDoc(doc(db, 'projects', roomHash, 'waitlist', requestId), { status: 'rejected' });
      toast.error(`Declined request from ${displayName || 'User'}.`);
    } catch (err) {
      console.error("[Reject Error]:", err);
      toast.error('Failed to reject request.');
    }
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic gap-4">
        <BellOff size={48} className="opacity-20" />
        <p className="text-sm">No pending join requests.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((req) => {
        // 🔴 DATA FIX: Handles mismatches between what the Guest sends and what the Host expects
        const displayName = req.displayName || req.name || 'Unknown User';
        const userId = req.userId || req.uid;

        return (
          <div key={req.id} className="bg-black/50 border border-zinc-800 p-4 rounded-lg shadow-md flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-[#c084fc]">{displayName}</span>
                <span className="text-xs text-zinc-500 ml-2">({req.email})</span>
              </div>
              <span className="text-[10px] text-zinc-600">
                {formatTime(req.timestamp)}
              </span>
            </div>
            
            {req.message && (
              <div className="bg-zinc-900 border-l-2 border-[#c084fc] p-2 pl-3 rounded relative text-sm text-zinc-300 italic flex gap-2 items-start">
                <Quote size={12} className="text-zinc-600 mt-0.5 shrink-0" />
                <p>{req.message}</p>
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => handleReject(req.id, displayName)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold uppercase tracking-wider transition-colors">
                <X size={14} /> Decline
              </button>
              <button onClick={() => handleAccept(req.id, userId, displayName)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 text-xs font-bold uppercase tracking-wider transition-colors">
                <Check size={14} /> Accept
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}