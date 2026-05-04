import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Circle, MessageSquareText, Reply, Smile, X } from 'lucide-react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { auth } from '../../services/firebase';
import { getProviderOptions } from '../../services/webrtcConfig';
import { Lock } from 'lucide-react';

const COMMON_EMOJIS = ['👍', '🚀', '🔥', '💻', '✅', '👀', '😂', '🎉', '💡', '🐛'];

export default function ChatPanel({ roomHash = 'colab-global-lobby' }) {
  const [messages, setMessages] = useState([]);
  const [activePeers, setActivePeers] = useState([]);
  const [activeTab, setActiveTab] = useState('group'); 
  const [inputText, setInputText] = useState('');
  
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojis, setShowEmojis] = useState(false);

  const yProvider = useRef(null);
  const yChatMap = useRef(null);
  const scrollRef = useRef(null);

  const myUid = auth.currentUser?.uid || 'local-user';
  const myName = auth.currentUser?.displayName || 'Peer';

  useEffect(() => {
    const ydoc = new Y.Doc();
    const chatRoomName = `${roomHash}-comms-channel`;
    
    yProvider.current = new WebrtcProvider(chatRoomName, ydoc, getProviderOptions());
    yChatMap.current = ydoc.getMap('messages');

    const localCache = localStorage.getItem(`colab_chat_${roomHash}`);
    if (localCache) {
      try {
        const parsedCache = JSON.parse(localCache);
        Object.keys(parsedCache).forEach(key => {
          if (!yChatMap.current.has(key)) yChatMap.current.set(key, parsedCache[key]);
        });
      } catch { console.debug("Chat cache error"); }
    }

    yChatMap.current.observe(() => {
      const msgArray = Array.from(yChatMap.current.values());
      msgArray.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgArray);
      
      const rawMap = {};
      yChatMap.current.forEach((val, key) => { rawMap[key] = val; });
      localStorage.setItem(`colab_chat_${roomHash}`, JSON.stringify(rawMap));
    });

    yProvider.current.awareness.setLocalStateField('user', { uid: myUid, name: myName });

    yProvider.current.awareness.on('change', () => {
      const peers = [];
      yProvider.current.awareness.getStates().forEach((state) => {
        if (state.user && state.user.uid !== myUid && !peers.find(p => p.uid === state.user.uid)) {
          peers.push(state.user);
        }
      });
      setActivePeers(peers);
    });

    return () => {
      if (yProvider.current) {
        yProvider.current.disconnect();
        yProvider.current.destroy();
      }
      ydoc.destroy();
    };
  }, [roomHash, myUid, myName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeTab]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newMsg = {
      id: msgId,
      text: inputText.trim(),
      senderUid: myUid,
      senderName: myName,
      targetUid: activeTab,
      timestamp: Date.now(),
      replyTo: replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text } : null
    };

    yChatMap.current.set(msgId, newMsg);
    setInputText('');
    setReplyingTo(null);
    setShowEmojis(false);
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'group') return msg.targetUid === 'group';
    return (msg.senderUid === myUid && msg.targetUid === activeTab) || 
           (msg.senderUid === activeTab && msg.targetUid === myUid);
  });

  return (
    <div className="w-[calc(100%+2rem)] h-[calc(100%+2rem)] -m-4 bg-zinc-950 flex overflow-hidden">
      
      {/* LEFT SIDEBAR - PEERS */}
      <div className="w-35 md:w-45 bg-black/60 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <div 
            onClick={() => { setActiveTab('group'); setReplyingTo(null); }}
            className={`px-3 py-2 text-xs flex items-center gap-2 cursor-pointer transition-colors border-l-2 ${activeTab === 'group' ? 'bg-[#c084fc]/10 text-white border-[#c084fc]' : 'border-transparent text-zinc-500 hover:bg-zinc-900'}`}
          >
            <Users size={14} className={activeTab === 'group' ? 'text-[#c084fc]' : ''} /> 
            <span className="font-bold truncate">Group Net</span>
          </div>

          <div className="px-3 mt-4 mb-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Active Nodes</div>
          {activePeers.length === 0 ? (
             <div className="px-3 text-[10px] text-zinc-600 italic">No peers online.</div>
          ) : (
            activePeers.map(peer => (
              <div 
                key={peer.uid}
                onClick={() => { setActiveTab(peer.uid); setReplyingTo(null); }}
                className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors border-l-2 ${activeTab === peer.uid ? 'bg-[#00ff41]/10 text-white border-[#00ff41]' : 'border-transparent text-zinc-500 hover:bg-zinc-900'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <User size={14} className={activeTab === peer.uid ? 'text-[#00ff41]' : ''} />
                  <span className="truncate">{peer.name}</span>
                </div>
                <Circle size={8} fill="#00ff41" className="text-[#00ff41] shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE - CHAT AREA */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0 bg-black/40">
           <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
             {activeTab === 'group' ? <><Users size={14} className="text-[#c084fc]"/> GLOBAL FREQUENCY</> : <><Lock size={14} className="text-[#00ff41]"/> ENCRYPTED P2P</>}
           </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar" ref={scrollRef}>
           {filteredMessages.length === 0 ? (
             <div className="m-auto text-center text-zinc-600 flex flex-col items-center gap-2">
               <MessageSquareText size={32} className="opacity-20" />
               <span className="text-[10px] uppercase tracking-widest">Awaiting Transmissions...</span>
             </div>
           ) : (
             filteredMessages.map(msg => {
               const isMe = msg.senderUid === myUid;
               const isGroup = activeTab === 'group';
               
               return (
                 <div key={msg.id} className={`group flex flex-col max-w-[90%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                   <div className={`text-[9px] text-zinc-500 mb-1 px-1 font-mono flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                     <span className={isMe ? 'text-[#c084fc]' : 'text-zinc-300'}>{isMe ? 'You' : msg.senderName}</span>
                     <span className="opacity-50">•</span>
                     <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>

                   <div className={`relative flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                     <div className={`px-3 py-2 text-sm leading-relaxed shadow-md flex flex-col gap-1 ${
                       isMe 
                        ? 'bg-linear-to-br from-[#c084fc] to-[#f472b6] text-black font-medium rounded-2xl rounded-tr-sm' 
                        : isGroup 
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-2xl rounded-tl-sm' 
                          : 'bg-black border border-[#00ff41]/30 text-[#00ff41] font-mono rounded-2xl rounded-tl-sm shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                     }`}>
                       {msg.replyTo && (
                         <div className={`text-[10px] pl-2 border-l-2 py-0.5 pr-2 mb-1 rounded-r-md truncate max-w-full ${isMe ? 'border-black/40 bg-black/10 text-black/70' : 'border-[#c084fc] bg-black/30 text-zinc-400'}`}>
                           <span className="font-bold mr-1">{msg.replyTo.senderName}:</span>
                           {msg.replyTo.text}
                         </div>
                       )}
                       <span>{msg.text}</span>
                     </div>

                     <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                       <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 shadow-lg">
                         <Reply size={12} />
                       </button>
                     </div>
                   </div>
                 </div>
               );
             })
           )}
        </div>

        {showEmojis && (
          <div className="absolute bottom-14 left-2 bg-zinc-900 border border-zinc-800 p-2 rounded-xl shadow-2xl flex gap-1 z-50">
            {COMMON_EMOJIS.map(emoji => (
              <button key={emoji} type="button" onClick={() => setInputText(prev => prev + emoji)} className="hover:bg-zinc-800 p-1.5 rounded text-lg transition-transform hover:scale-125">
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col border-t border-zinc-800 bg-black/40 shrink-0">
          {replyingTo && (
            <div className="px-4 py-2 bg-[#c084fc]/10 border-b border-[#c084fc]/20 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2 truncate text-zinc-300">
                <Reply size={12} className="text-[#c084fc]" />
                <span className="font-bold text-[#c084fc]">Replying to {replyingTo.senderName}:</span>
                <span className="truncate opacity-70">{replyingTo.text}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-zinc-500 hover:text-white"><X size={12}/></button>
            </div>
          )}

          <form onSubmit={handleSend} className="p-3 flex items-center gap-2">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="text-zinc-500 hover:text-[#c084fc] transition-colors p-1">
              <Smile size={18} />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Transmit data..." 
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#c084fc] transition-colors"
            />
            <button type="submit" disabled={!inputText.trim()} className="w-8 h-8 rounded-lg bg-[#c084fc] text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed">
              <Send size={14} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}