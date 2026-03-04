import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, TerminalSquare, Globe, Lock, Unlock, Play, Cpu, AlertTriangle, ShieldCheck, CheckCircle2, ListX, AlignLeft } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Command } from '@tauri-apps/plugin-shell';
import { mkdir, exists, writeTextFile, readTextFile, remove } from '@tauri-apps/plugin-fs';
import { join, appLocalDataDir } from '@tauri-apps/api/path';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore'; 
import toast from 'react-hot-toast';
import 'xterm/css/xterm.css';
import styles from './IDE.module.css';

import ProblemsPanel from './ProblemsPanel';
import OutputPanel from './OutputPanel'; // 🔴 NEW: Imported OutputPanel

const SIGNALING_SERVERS = ['wss://colab-matchmaker-v2.onrender.com'];
const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
const osSeparator = navigator.userAgent.includes('Win') ? '\\' : '/';

// ==========================================
// PATH TRANSLATION ALGORITHM
// ==========================================
const getRelativeTraversal = (fromPath, toPath) => {
  if (fromPath === toPath) return '';
  const fromParts = fromPath.split('/').filter(Boolean);
  const toParts = toPath.split('/').filter(Boolean);
  
  let commonIndex = 0;
  while (commonIndex < fromParts.length && commonIndex < toParts.length && fromParts[commonIndex] === toParts[commonIndex]) {
    commonIndex++;
  }
  
  const upCount = fromParts.length - commonIndex;
  const upDirs = Array(upCount).fill('..');
  const downDirs = toParts.slice(commonIndex);
  
  const pathArr = [...upDirs, ...downDirs];
  return pathArr.length > 0 ? pathArr.join('/') : '';
};

// ==========================================
// TERMINAL INSTANCE COMPONENT
// ==========================================
const TerminalInstance = ({ termData, isActive, initialPath, roomHash }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(null);
  
  const currentCwd = useRef(initialPath || ''); 
  const currentInput = useRef(''); 
  const cursorPos = useRef(0); 

  const commandHistory = useRef([]);
  const historyIndex = useRef(-1);

  const yProvider = useRef(null);
  const yCommands = useRef(null);
  const yState = useRef(null);

  const isShared = termData.scope === 'shared';

  const [executeMode, setExecuteMode] = useState(isShared ? 'manual' : 'auto'); 
  const [commandQueue, setCommandQueue] = useState([]);
  const [executedCmds, setExecutedCmds] = useState(new Set()); 
  const [shellCompatibility, setShellCompatibility] = useState('checking'); 
  const [incompatibleUsers, setIncompatibleUsers] = useState([]);
  
  const [lockInfo, setLockInfo] = useState({ isLocked: false, uid: null, name: null });

  const executeModeRef = useRef(executeMode);
  useEffect(() => { executeModeRef.current = executeMode; }, [executeMode]);
  const shellCompatibilityRef = useRef(shellCompatibility);
  useEffect(() => { shellCompatibilityRef.current = shellCompatibility; }, [shellCompatibility]);
  const lockInfoRef = useRef(lockInfo);
  useEffect(() => { lockInfoRef.current = lockInfo; }, [lockInfo]);

  const logBuffer = useRef('');
  const logDebounce = useRef(null);

  const customWrite = useCallback((text) => {
    if (!term.current) return;
    term.current.write(text);
    logBuffer.current += text;
    if (logDebounce.current) clearTimeout(logDebounce.current);
    logDebounce.current = setTimeout(async () => {
      try {
        const baseDir = await appLocalDataDir();
        const logDir = await join(baseDir, 'colab_term_logs');
        if (!(await exists(logDir))) await mkdir(logDir, { recursive: true });
        const logFile = await join(logDir, `${roomHash || 'local'}_${termData.id}.log`);
        await writeTextFile(logFile, logBuffer.current);
      } catch (err) { console.debug("Log cache error:", err); }
    }, 1000);
  }, [roomHash, termData.id]);

  useEffect(() => {
    const currentTerminalRef = terminalRef.current;
    if (!currentTerminalRef) return;

    const terminal = new Terminal({
      theme: { background: '#09090b', foreground: '#e4e4e7', cursor: '#00ff41', selectionBackground: '#c084fc40' },
      cursorBlink: true, cursorStyle: 'bar', cursorWidth: 3,
      fontFamily: 'Fira Code, monospace', fontSize: 13, convertEol: true 
    });
    
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    
    term.current = terminal;
    fitAddon.current = fit;

    const mountTimer = setTimeout(async () => {
      if (currentTerminalRef) {
        try {
          terminal.open(currentTerminalRef);
          if (currentTerminalRef.clientWidth > 10) fit.fit();
          
          let hasCache = false;
          if (isTauri) {
            const baseDir = await appLocalDataDir();
            const logFile = await join(baseDir, 'colab_term_logs', `${roomHash || 'local'}_${termData.id}.log`);
            if (await exists(logFile)) {
               const content = await readTextFile(logFile);
               if (content.trim()) {
                 logBuffer.current = content;
                 terminal.write(content);
                 hasCache = true;
               }
            }
          }
          if (!hasCache) {
            const roleMode = isShared ? `\x1b[36m[SHARED P2P NODE: ${termData.creatorName}]\x1b[0m` : '\x1b[90m[PRIVATE LOCAL TERMINAL]\x1b[0m';
            customWrite(`\x1b[35m[Co-Lab OS Terminal - ${termData.type}]\x1b[0m ${roleMode}\r\n\x1b[32m${currentCwd.current}\x1b[0m> `);
          }
        } catch (err) { console.debug("Mount Error:", err); }
      }
    }, 50);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (currentTerminalRef?.clientWidth > 10 && terminal._core) {
          try { fit.fit(); } catch (err) { console.debug("Resize error:", err); }
        }
      });
    });
    resizeObserver.observe(currentTerminalRef);

    let handleStateUpdate, handleCommandUpdate;

    if (isShared) {
      const safeRoom = roomHash || 'local-offline-room';
      const termRoomName = `${safeRoom}-term-${termData.id}`;
      
      const ydoc = new Y.Doc();
      yProvider.current = new WebrtcProvider(termRoomName, ydoc, { signaling: SIGNALING_SERVERS });
      yCommands.current = ydoc.getArray('commands');
      yState.current = ydoc.getMap('state');

      const userName = auth.currentUser?.displayName || 'Peer';
      const userOs = navigator.userAgent.includes('Win') ? 'windows' : 'unix';
      yProvider.current.awareness.setLocalStateField('system', { name: userName, os: userOs });

      yProvider.current.awareness.on('change', () => {
        const states = Array.from(yProvider.current.awareness.getStates().values());
        const missing = [];
        states.forEach(state => {
          if (state.system) {
            if ((termData.type === 'cmd' || termData.type === 'powershell') && state.system.os !== 'windows') {
              missing.push(state.system.name);
            }
            if ((termData.type === 'bash' || termData.type === 'zsh') && state.system.os === 'windows') {
              missing.push(state.system.name);
            }
          }
        });
        setIncompatibleUsers(missing);
        setShellCompatibility(missing.length === 0 ? 'ok' : 'warning');
      });

      handleStateUpdate = (event) => {
        if (event.keysChanged.has('lockedBy')) {
           setLockInfo({
              isLocked: !!yState.current.get('lockedBy'),
              uid: yState.current.get('lockedBy'),
              name: yState.current.get('lockedByName')
           });
        }
      };

      handleCommandUpdate = async (event) => {
        if (event.transaction.local) return; 
        
        let newCommands = [];
        event.changes.delta.forEach(delta => {
          if (delta.insert) delta.insert.forEach(cmdStr => newCommands.push(JSON.parse(cmdStr)));
        });

        for (const cmdObj of newCommands) {
          if (executeModeRef.current === 'manual') {
             setCommandQueue(prev => [...prev, cmdObj]);
             customWrite(`\r\n\x1b[33m[Queued: ${cmdObj.author} sent a command. Check Manual Queue.]\x1b[0m\r\n${getPrompt()}`);
          } else {
             if (shellCompatibilityRef.current === 'ok') {
               customWrite(`\r\n\x1b[36m[Remote Execute: ${cmdObj.author}]\x1b[0m ${cmdObj.cmd}\r\n`);
               await runRoutedCommand(cmdObj.cmd, cmdObj.relativeTarget, true);
             }
          }
        }
      };

      yState.current.observe(handleStateUpdate);
      yCommands.current.observe(handleCommandUpdate);
      
      setCommandQueue(yCommands.current.toArray().map(s => JSON.parse(s)));
      
      if (yState.current.has('lockedBy')) {
         setLockInfo({
            isLocked: !!yState.current.get('lockedBy'),
            uid: yState.current.get('lockedBy'),
            name: yState.current.get('lockedByName')
         });
      }
    }

    const getPrompt = () => `\x1b[32m${currentCwd.current}\x1b[0m> `;

    const rewriteLine = () => {
      if (!term.current) return;
      const lines = currentInput.current.split('\n');
      const currentLine = lines[lines.length - 1];
      const promptToUse = lines.length > 1 ? '> ' : getPrompt();
      terminal.write('\x1b[2K\r' + promptToUse + currentLine);
    };

    terminal.attachCustomKeyEventHandler((e) => {
      if (isShared && lockInfoRef.current.isLocked && lockInfoRef.current.uid !== auth.currentUser?.uid) {
         if (e.type === 'keydown') toast.error(`Terminal is locked by ${lockInfoRef.current.name}.`, { id: 'term-lock' });
         return false; 
      }

      if (e.type === 'keydown') {
        if (e.shiftKey && e.code === 'Enter') {
          currentInput.current += '\n'; cursorPos.current = currentInput.current.length; terminal.write('\r\n> '); return false; 
        }
        if (e.ctrlKey && e.code === 'KeyC') {
          if (terminal.hasSelection()) { navigator.clipboard.writeText(terminal.getSelection()); terminal.clearSelection(); return false; }
        }
        if (e.ctrlKey && e.code === 'KeyV') {
          navigator.clipboard.readText().then(text => {
            const normalizedText = text.replace(/\r\n/g, '\n'); 
            currentInput.current += normalizedText; cursorPos.current = currentInput.current.length;
            if (normalizedText.includes('\n')) customWrite(normalizedText.split('\n').join('\r\n> ')); else rewriteLine();
          }).catch((err) => { console.debug("Paste err:", err); });
          return false; 
        }
      }
      return true;
    });

    const checkPathEscape = (currentDir, rootDir, cdTarget) => {
      if (!rootDir) return false; 
      const normalize = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
      const root = normalize(rootDir);
      let current = normalize(currentDir);
      let target = normalize(cdTarget.replace(/^["']|["']$/g, '').trim());

      if (target.match(/^[a-z]:\//i) || target.startsWith('/')) return !target.startsWith(root);

      let currentParts = current.split('/');
      let targetParts = target.split('/');

      for (const part of targetParts) {
        if (part === '..') currentParts.pop(); 
        else if (part !== '.' && part !== '') currentParts.push(part); 
      }
      return !currentParts.join('/').startsWith(root); 
    };

    const getLocalRelative = () => {
       if (!initialPath) return '';
       const normInit = initialPath.replace(/\\/g, '/');
       const normCurr = currentCwd.current.replace(/\\/g, '/');
       if (normCurr.toLowerCase().startsWith(normInit.toLowerCase())) {
          return normCurr.substring(normInit.length).replace(/^\//, '');
       }
       return '';
    };

    const runRoutedCommand = async (input, relativeTarget, isRemoteEvent = false, manualTrigger = false) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        customWrite(`\r\n${getPrompt()}`);
        return;
      }

      if (!isTauri) {
        customWrite(`\r\n\x1b[31m[ERROR] Cannot execute native commands in a web browser.\x1b[0m\r\n${getPrompt()}`);
        return;
      }

      const isCdCommand = trimmedInput.toLowerCase().startsWith('cd ') || trimmedInput.toLowerCase() === 'cd';
      const shell = termData.type;
      
      if (isShared && isCdCommand && !isRemoteEvent) {
        let rawPath = trimmedInput === 'cd' ? '' : trimmedInput.substring(3).trim();
        if (!rawPath && (shell === 'bash' || shell === 'sh')) rawPath = initialPath;
        if (rawPath && checkPathEscape(currentCwd.current, initialPath, rawPath)) {
          customWrite(`\r\n\x1b[31mSorry you cant go out of the path on this shared terminal so use a local terminal instead\x1b[0m\r\n${getPrompt()}`);
          return; 
        }
      }

      if (manualTrigger && isShared) {
         const time = new Date().toLocaleTimeString();
         customWrite(`\x1b[35m[System: ${auth.currentUser?.displayName || 'Peer'} manually executed queue command at ${time}]\x1b[0m\r\n`);
      }
      
      let scriptToRun = input;
      if (shell === 'cmd') scriptToRun = scriptToRun.replace(/\n/g, ' && ');

      let baseSetup = '';
      if (shell === 'powershell') baseSetup = `Set-Location -LiteralPath "${currentCwd.current}"; `;
      else if (shell === 'cmd') baseSetup = `cd /d "${currentCwd.current}" && `;
      else baseSetup = `cd "${currentCwd.current}" && `;

      if (isShared && relativeTarget !== undefined) {
         const localRelative = getLocalRelative();
         const traversal = getRelativeTraversal(localRelative, relativeTarget);
         
         if (traversal) {
            const safeTraversal = traversal.replace(/\//g, osSeparator);
            if (shell === 'powershell') scriptToRun = `${baseSetup}cd "${safeTraversal}"; ${scriptToRun}`;
            else if (shell === 'cmd') scriptToRun = `${baseSetup}cd /d "${safeTraversal}" && ${scriptToRun}`;
            else scriptToRun = `${baseSetup}cd "${safeTraversal}" && ${scriptToRun}`;
         } else {
            scriptToRun = `${baseSetup}${scriptToRun}`;
         }
      } else {
         scriptToRun = `${baseSetup}${scriptToRun}`;
      }

      if (isCdCommand && trimmedInput !== 'cd') {
         if (shell === 'powershell') scriptToRun = `${scriptToRun}; (Get-Location).Path`;
         else if (shell === 'cmd') scriptToRun = `${scriptToRun} && cd`;
         else scriptToRun = `${scriptToRun} && pwd`;
      }

      try {
        let args = shell === 'powershell' ? ['-Command', scriptToRun] : (shell === 'cmd' ? ['/C', scriptToRun] : ['-c', scriptToRun]);
        const command = Command.create(shell, args);
        let capturedPath = '';

        command.stdout.on('data', line => {
          const trimmed = line.trim();
          if (isCdCommand && trimmed && (trimmed.includes('/') || trimmed.includes('\\'))) {
            capturedPath = trimmed;
          } else if (trimmed) {
            customWrite(line + '\r\n');
          }
        });

        command.stderr.on('data', line => {
          customWrite('\x1b[31m' + line + '\x1b[0m\r\n');
        });

        command.on('close', () => {
           if (isCdCommand && capturedPath && !capturedPath.toLowerCase().includes('error') && !capturedPath.toLowerCase().includes('not found')) {
             currentCwd.current = capturedPath;
           }
           customWrite(getPrompt());
        });

        await command.spawn();
      } catch (err) {
        customWrite(`\x1b[31mShell Error: ${err.message || err}\x1b[0m\r\n${getPrompt()}`);
      }
    };

    term.current.runRoutedCommand = runRoutedCommand;

    const inputDisposable = terminal.onData((data) => {
      if (isShared && lockInfoRef.current.isLocked && lockInfoRef.current.uid !== auth.currentUser?.uid) return;

      if (data === '\r') { 
        const cmdToRun = currentInput.current;
        if (cmdToRun.trim()) {
          commandHistory.current.push(cmdToRun);
          historyIndex.current = commandHistory.current.length;
        }

        currentInput.current = ''; 
        cursorPos.current = 0;
        customWrite('\r\n');
        
        if (isShared) {
           const userName = auth.currentUser?.displayName || 'Peer';
           const relativeCurrent = getLocalRelative();
           const payload = JSON.stringify({ cmd: cmdToRun, author: userName, id: Date.now(), relativeTarget: relativeCurrent });
           
           if (yCommands.current) yCommands.current.push([payload]); 
           runRoutedCommand(cmdToRun, relativeCurrent, false); 
        } else {
           runRoutedCommand(cmdToRun, undefined, false); 
        }
      } 
      else if (data === '\x7F' || data === '\b') { 
        if (cursorPos.current > 0) {
          currentInput.current = currentInput.current.slice(0, cursorPos.current - 1) + currentInput.current.slice(cursorPos.current);
          cursorPos.current -= 1;
          rewriteLine();
        }
      } 
      else if (data === '\x1b[A') { 
        if (commandHistory.current.length > 0 && historyIndex.current > 0) {
          historyIndex.current -= 1;
          currentInput.current = commandHistory.current[historyIndex.current];
          cursorPos.current = currentInput.current.length;
          rewriteLine();
        }
      } 
      else if (data === '\x1b[B') { 
        if (historyIndex.current < commandHistory.current.length - 1) {
          historyIndex.current += 1;
          currentInput.current = commandHistory.current[historyIndex.current];
          cursorPos.current = currentInput.current.length;
          rewriteLine();
        } else {
          historyIndex.current = commandHistory.current.length;
          currentInput.current = ''; cursorPos.current = 0; rewriteLine();
        }
      }
      else if (data === '\x1b[D' && cursorPos.current > 0) { cursorPos.current -= 1; customWrite(data); } 
      else if (data === '\x1b[C' && cursorPos.current < currentInput.current.length) { cursorPos.current += 1; customWrite(data); }
      else if (!data.startsWith('\x1b')) {
        const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        currentInput.current = currentInput.current.slice(0, cursorPos.current) + normalizedData + currentInput.current.slice(cursorPos.current);
        cursorPos.current += normalizedData.length; 
        rewriteLine();
      }
    });

    const handleContextMenu = (e) => {
      e.preventDefault(); 
      if (isShared && lockInfoRef.current.isLocked && lockInfoRef.current.uid !== auth.currentUser?.uid) return;

      if (terminal.hasSelection()) { navigator.clipboard.writeText(terminal.getSelection()); terminal.clearSelection(); }
      else {
        navigator.clipboard.readText().then(text => {
          const normalizedText = text.replace(/\r\n/g, '\n');
          currentInput.current += normalizedText; 
          cursorPos.current = currentInput.current.length;
          if (normalizedText.includes('\n')) customWrite(normalizedText.split('\n').join('\r\n> ')); 
          else rewriteLine();
        }).catch((err) => { console.debug("Context menu err:", err); });
      }
    };
    currentTerminalRef.addEventListener('contextmenu', handleContextMenu);

    return () => {
      clearTimeout(mountTimer);
      if (logDebounce.current) clearTimeout(logDebounce.current);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      if (currentTerminalRef) currentTerminalRef.removeEventListener('contextmenu', handleContextMenu);
      
      if (isShared) {
        if (yState.current) yState.current.unobserve(handleStateUpdate);
        if (yCommands.current) yCommands.current.unobserve(handleCommandUpdate);
        if (yProvider.current) { yProvider.current.disconnect(); yProvider.current.destroy(); }
      }
      terminal.dispose();
      term.current = null;
    };
  }, [termData.id, termData.type, termData.scope, termData.creatorName, roomHash, initialPath, isShared, customWrite]); 

  useEffect(() => {
    if (isActive) {
      setTimeout(() => { try { if (terminalRef.current?.clientWidth > 10) { fitAddon.current?.fit(); term.current?.focus(); } } catch(err) { console.debug("Focus err:", err); } }, 50);
    }
  }, [isActive]);

  const toggleLock = () => {
    if (!yState.current) return;
    if (lockInfo.isLocked && lockInfo.uid === auth.currentUser?.uid) {
       yState.current.set('lockedBy', null);
       yState.current.set('lockedByName', null);
       toast.success("Terminal unlocked.");
    } else if (!lockInfo.isLocked) {
       yState.current.set('lockedBy', auth.currentUser?.uid);
       yState.current.set('lockedByName', auth.currentUser?.displayName || 'Peer');
       toast.success("Terminal locked for remote users.");
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', zIndex: isActive ? 10 : -1, display: 'flex', flexDirection: 'column', backgroundColor: '#09090b' }}>
      
      {isShared && (
        <div className={`h-6 shrink-0 w-full overflow-hidden flex items-center border-b border-zinc-800 ${shellCompatibility === 'ok' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
           <marquee className={`text-[10px] font-bold tracking-widest uppercase ${shellCompatibility === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
             {shellCompatibility === 'ok' 
               ? <span className="flex items-center gap-2"><ShieldCheck size={12} className="inline mb-0.5"/> This shared terminal currently uses "{termData.type}" which is supported by all active peers. Execution is natively bridged.</span>
               : <span className="flex items-center gap-2"><AlertTriangle size={12} className="inline mb-0.5"/> WARNING: Users [{incompatibleUsers.join(', ')}] do not have "{termData.type}" natively available. Check manual queue to execute carefully.</span>
             }
           </marquee>
        </div>
      )}

      {isShared && (
        <div className="h-10 shrink-0 w-full bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 gap-3">
           
           <button
             onClick={toggleLock}
             disabled={lockInfo.isLocked && lockInfo.uid !== auth.currentUser?.uid}
             className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-all ${
                lockInfo.isLocked
                  ? (lockInfo.uid === auth.currentUser?.uid ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed')
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
             }`}
           >
             {lockInfo.isLocked ? <Lock size={12}/> : <Unlock size={12}/>}
             {lockInfo.isLocked ? (lockInfo.uid === auth.currentUser?.uid ? 'Unlock Terminal' : `Locked by ${lockInfo.name}`) : 'Lock Terminal'}
           </button>

           <div className="flex items-center gap-2">
             <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold hidden md:block">Execution Mode:</span>
             <div className="flex bg-black rounded-md border border-zinc-800 overflow-hidden">
                <button onClick={() => setExecuteMode('auto')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${executeMode === 'auto' ? 'bg-[#c084fc] text-black' : 'text-zinc-500 hover:text-white'}`}>Auto Sync</button>
                <button onClick={() => setExecuteMode('manual')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${executeMode === 'manual' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>Manual Queue</button>
             </div>
           </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative p-2" onClick={() => term.current?.focus()}>
          <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {isShared && executeMode === 'manual' && (
          <div className="w-96 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 transition-all shadow-[-10px_0_20px_rgba(0,0,0,0.5)] z-20">
            <div className="px-4 py-3 border-b border-zinc-800 text-[10px] font-bold text-yellow-500 tracking-widest uppercase flex items-center gap-2">
              <Cpu size={14}/> Queued Commands
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
              {commandQueue.length === 0 ? (
                <div className="text-[10px] text-zinc-600 italic text-center mt-10">Awaiting commands from peers...</div>
              ) : (
                [...commandQueue].reverse().map((cmd, idx) => (
                  <div key={`${cmd.id}-${idx}`} className="group flex items-center justify-between bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg p-3 transition-all shadow-sm">
                    <div className="flex flex-col flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-black text-[#c084fc] truncate">{cmd.author}</span>
                        <span className="text-[8px] text-zinc-500 font-mono bg-black border border-zinc-800 px-1.5 py-0.5 rounded shrink-0">{new Date(cmd.id).toLocaleTimeString()}</span>
                      </div>
                      <code className="text-[13px] font-bold text-white font-mono truncate select-all">{cmd.cmd}</code>
                      <div className="text-[9px] text-zinc-500 truncate mt-1">Target: <span className="text-zinc-400 font-mono">{cmd.relativeTarget || '/ (root)'}</span></div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        term.current?.runRoutedCommand(cmd.cmd, cmd.relativeTarget, true, true);
                        setExecutedCmds(prev => new Set(prev).add(cmd.id));
                      }}
                      className={`shrink-0 flex items-center justify-center w-12 h-12 border rounded-xl transition-all active:scale-95 ${
                        executedCmds.has(cmd.id) 
                        ? 'bg-green-500/20 border-green-500 text-green-400' 
                        : 'bg-black border-zinc-700 hover:border-[#00ff41] hover:bg-[#00ff41]/20 text-zinc-400 hover:text-[#00ff41] shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]'
                      }`}
                      title="Execute Command Locally"
                    >
                      {executedCmds.has(cmd.id) ? <CheckCircle2 size={20} /> : <Play size={20} className="ml-1" fill="currentColor" />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function BottomPanel({ setTerminalOpen, initialPath, roomHash, problems = [], onProblemClick }) {
  const [localTerminals, setLocalTerminals] = useState(() => {
     const initId = Date.now();
     return [{ id: initId, type: 'powershell', scope: 'local', name: 'Local (pwsh)' }];
  });
  const [sharedTerminals, setSharedTerminals] = useState([]);
  const [activeId, setActiveId] = useState(() => localTerminals[0].id);
  
  const [newShellType, setNewShellType] = useState('powershell');
  const [newShellScope, setNewShellScope] = useState('shared'); 
  const [projectHostId, setProjectHostId] = useState(null);

  // 🔴 NEW STATE: Active Tab (Terminal vs Output vs Problems)
  const [activeTab, setActiveTab] = useState('terminal');

  const managerProvider = useRef(null);
  const ySharedTerms = useRef(null);

  useEffect(() => {
    if (!roomHash) return;

    getDoc(doc(db, "projects", roomHash)).then(snap => {
       if (snap.exists()) setProjectHostId(snap.data().hostId);
    }).catch((err)=>{ console.debug("Host ID fetch err:", err); });

    const ydoc = new Y.Doc();
    managerProvider.current = new WebrtcProvider(`${roomHash}-terminal-manager`, ydoc, { signaling: SIGNALING_SERVERS });
    ySharedTerms.current = ydoc.getMap('shared_terminals');

    ySharedTerms.current.observe((event) => {
      const currentTerms = [];
      ySharedTerms.current.forEach((val) => currentTerms.push(JSON.parse(val)));
      currentTerms.sort((a,b) => a.id - b.id);
      
      event.keysChanged.forEach((key) => {
        const change = event.changes.keys.get(key);
        if (change.action === 'add') {
           const newTermStr = ySharedTerms.current.get(key);
           if (newTermStr) {
             const newTerm = JSON.parse(newTermStr);
             if (newTerm.creatorUid !== auth.currentUser?.uid) {
                toast(`${newTerm.creatorName} opened a shared terminal!`, { icon: '💻', style: { background: '#09090b', color: '#c084fc', border: '1px solid #c084fc' }});
             }
           }
        }
      });

      setSharedTerminals(currentTerms);
    });

    return () => {
       managerProvider.current?.disconnect();
       managerProvider.current?.destroy();
       ydoc.destroy();
    }
  }, [roomHash]);

  const allTerminals = useMemo(() => [...sharedTerminals, ...localTerminals], [sharedTerminals, localTerminals]);

  const activeTerminalExists = allTerminals.some(t => t.id === activeId);
  if (allTerminals.length > 0 && !activeTerminalExists) {
     setActiveId(allTerminals[allTerminals.length - 1].id);
  }

  const addTerminal = () => {
    const newId = Date.now();
    let shortName = newShellType === 'powershell' ? 'pwsh' : newShellType;
    const userName = auth.currentUser?.displayName?.split(' ')[0] || 'User';
    const uid = auth.currentUser?.uid || 'local';
    
    const newTerm = { 
      id: newId, 
      type: newShellType, 
      scope: newShellScope, 
      name: newShellScope === 'shared' ? `${userName}#${shortName}` : `Local (${shortName})`,
      creatorUid: uid,
      creatorName: userName
    };

    if (newShellScope === 'shared' && roomHash) {
      ySharedTerms.current.set(newId.toString(), JSON.stringify(newTerm));
    } else {
      setLocalTerminals([...localTerminals, newTerm]);
    }
    setActiveId(newId);
    setActiveTab('terminal'); 
  };

  const removeTerminal = async (idToRemove, scope, creatorUid, e) => {
    e.stopPropagation();

    if (scope === 'shared') {
       const canDelete = (auth.currentUser?.uid === creatorUid) || (auth.currentUser?.uid === projectHostId);
       if (!canDelete) return toast.error("ACCESS DENIED: Only the Host or Creator can kill this terminal.");
       ySharedTerms.current.delete(idToRemove.toString());
    } else {
       setLocalTerminals(localTerminals.filter(t => t.id !== idToRemove));
    }

    try {
       const baseDir = await appLocalDataDir();
       const logFile = await join(baseDir, 'colab_term_logs', `${roomHash || 'local'}_${idToRemove}.log`);
       if (await exists(logFile)) await remove(logFile);
    } catch(err) { console.debug("Delete cache err:", err); }
  };

  const totalProblems = problems.length;

  return (
    <div className={styles.bottomPanel} style={{ height: '320px', display: 'flex', flexDirection: 'column', backgroundColor: '#09090b', borderTop: '1px solid #27272a' }}>
      
      {/* 🔴 Bottom Panel Tabs Header */}
      <div className="flex justify-between items-center px-2 bg-[#09090b] border-b border-zinc-800 select-none shrink-0">
        <div className="flex gap-1 items-center">
          <button 
             onClick={() => setActiveTab('terminal')}
             className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest transition-colors border-b-2 ${activeTab === 'terminal' ? 'text-white border-[#c084fc]' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
             <TerminalSquare size={14} /> TERMINAL
          </button>
          
          {/* 🔴 NEW: OUTPUT TAB */}
          <button 
             onClick={() => setActiveTab('output')}
             className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest transition-colors border-b-2 ${activeTab === 'output' ? 'text-white border-[#c084fc]' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
             <AlignLeft size={14} /> OUTPUT
          </button>

          <button 
             onClick={() => setActiveTab('problems')}
             className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest transition-colors border-b-2 ${activeTab === 'problems' ? 'text-white border-[#c084fc]' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
             <ListX size={14} /> PROBLEMS
             {totalProblems > 0 && <span className="bg-zinc-800 text-zinc-300 px-1.5 rounded-full">{totalProblems}</span>}
          </button>
        </div>
        <button onClick={() => setTerminalOpen(false)} className="text-zinc-500 hover:text-white transition-colors p-2"><X size={14} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Terminal View */}
        <div className="flex-1 relative bg-[#09090b] flex" style={{ display: activeTab === 'terminal' ? 'flex' : 'none' }}>
            <div className="flex-1 relative">
               {allTerminals.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                     <TerminalSquare size={48} className="opacity-20 mb-4" />
                     <span className="text-xs font-mono uppercase tracking-widest">No Active Terminals</span>
                  </div>
               )}
               {allTerminals.map((term) => (
               <TerminalInstance 
                  key={term.id} 
                  termData={term} 
                  isActive={term.id === activeId} 
                  initialPath={initialPath} 
                  roomHash={roomHash}
               />
               ))}
            </div>

            {/* Terminal Sidebar */}
            <div className="w-64 bg-[#09090b] border-l border-zinc-800 flex flex-col z-20 shrink-0 shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
               <div className="flex items-center justify-between p-3 border-b border-zinc-800/50 gap-2 shadow-sm">
                  <select value={newShellScope} onChange={(e) => setNewShellScope(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-300 outline-none cursor-pointer uppercase tracking-wider px-2 py-1.5 w-full font-bold focus:border-[#c084fc]">
                     <option value="shared">Shared</option>
                     <option value="local">Local</option>
                  </select>
                  <select value={newShellType} onChange={(e) => setNewShellType(e.target.value)} className="bg-transparent text-[10px] text-zinc-400 font-bold outline-none cursor-pointer uppercase tracking-wider w-20 hover:text-white transition-colors">
                     <option value="powershell" className="bg-zinc-900">pwsh</option>
                     <option value="cmd" className="bg-zinc-900">cmd</option>
                     <option value="bash" className="bg-zinc-900">bash</option>
                     <option value="zsh" className="bg-zinc-900">zsh</option>
                     <option value="sh" className="bg-zinc-900">sh</option>
                   </select>
                   <button onClick={addTerminal} className="text-zinc-400 hover:text-[#00ff41] p-1.5 rounded bg-black border border-zinc-800 hover:border-[#00ff41] shrink-0 transition-all active:scale-95"><Plus size={14} /></button>
               </div>

               <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
               {allTerminals.map((term) => (
                  <div 
                     key={term.id} onClick={() => setActiveId(term.id)}
                     className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs font-mono transition-all border-l-2 ${activeId === term.id ? 'bg-[#c084fc]/10 text-[#c084fc] border-[#c084fc]' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                  >
                     <div className="flex items-center gap-3 truncate pr-2">
                     {term.scope === 'shared' ? <Globe size={14} className={activeId === term.id ? 'text-[#c084fc]' : 'text-zinc-600'} /> : <Lock size={14} className={activeId === term.id ? 'text-[#c084fc]' : 'text-zinc-600'} />}
                     <span className="truncate leading-tight font-bold">{term.name}</span>
                     </div>
                     <button onClick={(e) => removeTerminal(term.id, term.scope, term.creatorUid, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0">
                        <Trash2 size={14} />
                     </button>
                  </div>
               ))}
               </div>
            </div>
        </div>

        {/* 🔴 NEW: Output View Component */}
        {activeTab === 'output' && (
           <div className="flex-1 bg-[#09090b] flex flex-col relative">
             <OutputPanel />
           </div>
        )}

         {/* Problems View */}
         {activeTab === 'problems' && (
            <div className="flex-1 bg-[#09090b] flex flex-col relative">
               <ProblemsPanel problems={problems} onProblemClick={onProblemClick} />
            </div>
         )}

      </div>
    </div>
  );
}