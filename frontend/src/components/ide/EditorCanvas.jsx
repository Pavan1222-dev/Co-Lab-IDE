import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCode2, Wifi, WifiOff, Users, Lock, Unlock, History, AlertCircle, Check, XCircle, SplitSquareHorizontal } from 'lucide-react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { MonacoBinding } from 'y-monaco';
import { auth } from '../../services/firebase';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import toast from 'react-hot-toast'; 
import styles from './IDE.module.css';
import { getProviderOptions } from '../../services/webrtcConfig';

const CURSOR_COLORS = ['#f472b6', '#c084fc', '#06b6d4', '#00ff41', '#fbbf24', '#f97316'];

const getLanguage = (fileName) => {
  if (!fileName) return 'javascript';
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'json': 'json', 'css': 'css', 'html': 'html', 'rs': 'rust', 'md': 'markdown'
  };
  return map[ext] || 'plaintext';
};

const initHistoryDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ColabHistoryDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('path', 'path', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveVersion = async (path, content, isManual = false) => {
  const db = await initHistoryDB();
  return new Promise((resolve) => {
    const tx = db.transaction('versions', 'readwrite');
    const store = tx.objectStore('versions');
    const req = store.index('path').getAll(IDBKeyRange.only(path));

    req.onsuccess = () => {
      const versions = req.result.sort((a, b) => b.timestamp - a.timestamp);
      if (versions.length > 0) {
        const last = versions[0];
        if (last.content === content) return resolve(false); 
        if (!isManual && (Date.now() - last.timestamp < 60000)) return resolve(false);
      }
      store.add({ path, content, timestamp: Date.now() });
      resolve(true);
    };
  });
};

const getVersions = async (path) => {
  const db = await initHistoryDB();
  return new Promise((resolve) => {
    const tx = db.transaction('versions', 'readonly');
    const request = tx.objectStore('versions').index('path').getAll(IDBKeyRange.only(path));
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp - a.timestamp));
  });
};

export default function EditorCanvas({ 
  activeFile, openFiles, handleOpenFile, handleCloseFile, handleReorderFiles,
  compareTarget, setCompareTarget, handleOpenDiff,
  roomHash, isWorkspaceHost, isAutoSave, unsavedFiles, setUnsavedFiles, setProblems 
}) {
  const [editorInstance, setEditorInstance] = useState(null);
  const monacoRef = useRef(null); 
  const [isSignaling, setIsSignaling] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [awarenessUsers, setAwarenessUsers] = useState([]); 

  const [fileLock, setFileLock] = useState(null);
  const [lineLocks, setLineLocks] = useState({});
  const [autoLineLock, setAutoLineLock] = useState(false);
  const [currentLine, setCurrentLine] = useState(1);
  
  const dragItemRef = useRef(null);
  const dragOverItemRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const yLocksRef = useRef(null);
  const yLineLocksRef = useRef(null);
  const autoLineLockRef = useRef(autoLineLock);
  const oldDecorationsRef = useRef([]);
  
  const ydocRef = useRef(null);
  const ytextRef = useRef(null);

  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [versionList, setVersionList] = useState([]);
  const [confirmRevert, setConfirmRevert] = useState(null);

  const myUid = auth.currentUser?.uid || 'local-user';
  const myName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Peer';
  const myAvatar = localStorage.getItem(`colab_avatar_${myUid}`) || auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${myName}`;

  const saveTimer = useRef(null);
  const isAutoSaveRef = useRef(isAutoSave);

  const targetFile = activeFile?.type === 'diff' ? activeFile.modified : activeFile;
  
  useEffect(() => {
    isAutoSaveRef.current = isAutoSave;
    autoLineLockRef.current = autoLineLock;
  }, [isAutoSave, autoLineLock, activeFile]);

  const saveToDisk = useCallback(async (isManual = false) => {
    if (targetFile?.path && editorInstance) {
      try {
        const currentCode = editorInstance.getValue();
        await writeTextFile(targetFile.path, currentCode);
        
        await saveVersion(targetFile.relativePath, currentCode, isManual);
        setUnsavedFiles(prev => prev.filter(p => p !== targetFile.relativePath));
        
        const editorEl = document.querySelector('.monaco-editor');
        if (editorEl) {
          editorEl.style.opacity = '0.5';
          setTimeout(() => { editorEl.style.opacity = '1'; }, 100);
        }
      } catch (error) { console.error("OS WRITE ERROR:", error); }
    }
  }, [targetFile, editorInstance, setUnsavedFiles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') || e.type === 'global-save-trigger') {
        e.preventDefault(); 
        saveToDisk(true); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('global-save-trigger', handleKeyDown); 
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('global-save-trigger', handleKeyDown);
    };
  }, [saveToDisk]);

  useEffect(() => {
    const handleJump = (e) => {
      const { startLineNumber, startColumn, resource } = e.detail;
      const currentPath = targetFile?.relativePath || targetFile?.name;
      
      if (resource === currentPath) {
        editorInstance?.revealLineInCenter(startLineNumber);
        editorInstance?.setPosition({ lineNumber: startLineNumber, column: startColumn });
        editorInstance?.focus();
      } else {
        toast(`Please open ${resource} from the Explorer to view this error.`, { 
          icon: '📂', style: { background: '#09090b', color: '#c084fc', border: '1px solid #c084fc', fontSize: '12px' }
        });
      }
    };
    window.addEventListener('global-jump-to-line', handleJump);
    return () => window.removeEventListener('global-jump-to-line', handleJump);
  }, [editorInstance, targetFile]);

  useEffect(() => {
    if (!editorInstance || !targetFile?.name) return;

    const model = editorInstance.getModel();
    if (!model || model.isDisposed()) return; 

    let isMounted = true; 
    let isInitializing = true; 

    if (activeFile.type !== 'diff') {
        editorInstance.setValue('Loading physical file from OS...');
    }

    const safeRoomHash = roomHash || 'offline-local-node';
    const safePathName = targetFile.relativePath ? targetFile.relativePath.replace(/[/\\]/g, '-') : targetFile.name;
    const documentRoomName = `${safeRoomHash}-doc-${safePathName}`;
    
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(targetFile.relativePath || targetFile.name);
    
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    const yLocks = ydoc.getMap('locks'); 
    const yLineLocks = ydoc.getMap('lineLocks');
    yLocksRef.current = yLocks;
    yLineLocksRef.current = yLineLocks;

    const provider = new WebrtcProvider(documentRoomName, ydoc, getProviderOptions());

    const userColor = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
    
    provider.awareness.setLocalStateField('user', { 
      name: myName, 
      color: userColor, 
      avatar: myAvatar 
    });

    const binding = new MonacoBinding(ytext, model, new Set([editorInstance]), provider.awareness);

    if (targetFile.path) {
      readTextFile(targetFile.path).then((fileContent) => {
          if (isMounted && ytext.length === 0) {
            ydoc.transact(() => {
              ytext.delete(0, ytext.length); 
              ytext.insert(0, fileContent);
            });
          }
          isInitializing = false; 
        }).catch((error) => {
          if (isMounted) ydoc.transact(() => { ytext.insert(0, `// File Error: ${error}`); });
          isInitializing = false;
        });
    } else {
      isInitializing = false;
    }

    ytext.observe(() => {
      if (isInitializing) return;

      if (isAutoSaveRef.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { saveToDisk(false); }, 1500); 
      } else {
        setUnsavedFiles(prev => {
          if (targetFile.relativePath && !prev.includes(targetFile.relativePath)) {
            return [...prev, targetFile.relativePath];
          }
          return prev;
        });
      }
    });

    const handleLocksUpdate = () => { if (isMounted) setFileLock(yLocks.get('fileLock') || null); };
    
    const handleLineLocksUpdate = () => {
      if (isMounted) {
        const currentLineLocks = {};
        yLineLocks.forEach((val, key) => { currentLineLocks[key] = val; });
        setLineLocks(currentLineLocks);
      }
    };

    yLocks.observe(handleLocksUpdate);
    yLineLocks.observe(handleLineLocksUpdate);
    handleLocksUpdate();
    handleLineLocksUpdate();

    provider.on('status', (event) => { if (isMounted) setIsSignaling(event.connected); });

    const updateAwareness = () => {
      if (!isMounted) return;
      const currentPeers = provider.awareness.getStates().size;
      setPeerCount(currentPeers);
      
      window.dispatchEvent(new CustomEvent('global-peer-update', { detail: currentPeers }));

      const users = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (state.user) users.push({ 
          clientId, 
          name: state.user.name, 
          color: state.user.color, 
          avatar: state.user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${state.user.name}` 
        });
      });
      setAwarenessUsers(users);
    };

    provider.awareness.on('change', updateAwareness);
    updateAwareness(); 

    return () => {
      isMounted = false;
      try { binding.destroy(); } catch (err) { console.debug("Monaco Binding cleanup:", err); }
      try { provider.disconnect(); provider.destroy(); } catch (err) { console.debug("Yjs Provider cleanup:", err); }
      
      if (yLineLocksRef.current) {
        const keysToDelete = [];
        yLineLocksRef.current.forEach((lock, lineStr) => {
           if (lock.uid === myUid) keysToDelete.push(lineStr);
        });
        keysToDelete.forEach(k => yLineLocksRef.current.delete(k));
      }
      
      try { ydoc.destroy(); } catch (err) { console.debug("Yjs Doc cleanup:", err); }
      clearTimeout(saveTimer.current);
    };
  }, [roomHash, targetFile?.name, targetFile?.path, targetFile?.relativePath, editorInstance, saveToDisk, setUnsavedFiles, myUid, myName, myAvatar, activeFile.type]); 

  useEffect(() => {
    if (!editorInstance || activeFile.type === 'diff') return;
    const isLockedByOther = fileLock && fileLock.uid !== myUid && !isWorkspaceHost;
    editorInstance.updateOptions({ readOnly: isLockedByOther });
  }, [fileLock, editorInstance, myUid, activeFile.type, isWorkspaceHost]);

  useEffect(() => {
    if (!editorInstance || !monacoRef.current || activeFile.type === 'diff') return;
    
    const newDecorations = Object.entries(lineLocks).map(([lineStr, lock]) => {
      const lNum = parseInt(lineStr);
      const isMine = lock.uid === myUid;
      return {
        range: new monacoRef.current.Range(lNum, 1, lNum, 1),
        options: {
          isWholeLine: true,
          className: isMine ? 'my-locked-line' : 'remote-locked-line',
          hoverMessage: { value: `Locked by ${lock.name}` }
        }
      };
    });
    oldDecorationsRef.current = editorInstance.deltaDecorations(oldDecorationsRef.current, newDecorations);
  }, [lineLocks, editorInstance, myUid, activeFile.type]);

  const handleDragStart = (e, index) => {
    dragItemRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e, index) => {
    dragOverItemRef.current = index;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      handleReorderFiles(dragItemRef.current, dragOverItemRef.current);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
    setDragOverIdx(null);
  };

  function handleEditorDidMount(editor, monaco) {
    setEditorInstance(editor);
    monacoRef.current = monaco;
    monaco.editor.defineTheme('colab-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#00000000' }});
    monaco.editor.setTheme('colab-dark');

    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({});
      const formattedProblems = markers.map(marker => ({
        message: marker.message,
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        severity: marker.severity,
        source: marker.source || getLanguage(targetFile?.name),
        resource: marker.resource.path.replace(/^\//, '') 
      }));
      if (setProblems) setProblems(formattedProblems);
    });

    editor.onDidChangeCursorPosition((e) => {
      const newLine = e.position.lineNumber;
      setCurrentLine(newLine);
      window.dispatchEvent(new CustomEvent('global-cursor-update', { detail: { ln: newLine, col: e.position.column } }));

      if (autoLineLockRef.current && yLineLocksRef.current) {
        const currentLockOnNew = yLineLocksRef.current.get(newLine.toString());
        
        if (!currentLockOnNew || currentLockOnNew.uid === myUid) {
           yLineLocksRef.current.set(newLine.toString(), { uid: myUid, name: myName });
        }

        const keysToDelete = [];
        yLineLocksRef.current.forEach((lock, lineStr) => {
           if (lock.uid === myUid && lineStr !== newLine.toString()) {
              keysToDelete.push(lineStr);
           }
        });
        keysToDelete.forEach(k => yLineLocksRef.current.delete(k));
      }
    });

    // 🔴 NEW HIERARCHY & ENTER KEY LOGIC
    editor.onKeyDown((e) => {
      if ([monaco.KeyCode.UpArrow, monaco.KeyCode.DownArrow, monaco.KeyCode.LeftArrow, monaco.KeyCode.RightArrow, monaco.KeyCode.PageUp, monaco.KeyCode.PageDown].includes(e.keyCode)) return;

      const selection = editor.getSelection();
      let isBlocked = false;
      let blockerName = '';

      const currentFileLock = yLocksRef.current?.get('fileLock');
      const iAmHost = isWorkspaceHost;
      const iOwnFile = currentFileLock && currentFileLock.uid === myUid;

      // 1. File Lock Check (Host and Owner are immune)
      if (currentFileLock && !iOwnFile && !iAmHost) {
          isBlocked = true;
          blockerName = currentFileLock.name;
      }

      // 2. Line Lock Check (Host and File Owner bypass this completely)
      if (!isBlocked && yLineLocksRef.current && !iOwnFile && !iAmHost) {
          
          // If pressing enter, only block if the exact current line is locked
          if (e.keyCode === monaco.KeyCode.Enter) {
              const lock = yLineLocksRef.current.get(selection.startLineNumber.toString());
              if (lock && lock.uid !== myUid) {
                  isBlocked = true;
                  blockerName = lock.name;
              }
          } else {
              for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
                const lock = yLineLocksRef.current.get(i.toString());
                if (lock && lock.uid !== myUid) {
                  isBlocked = true;
                  blockerName = lock.name;
                  break;
                }
              }
          }
      }

      if (isBlocked) {
        e.preventDefault();
        e.stopPropagation();
        toast.error(`Read-Only. Locked by ${blockerName}.`, { id: 'lock-block' });
      }
    });
  }

  const fetchLocalHistory = async () => {
    if (!targetFile?.relativePath) return;
    const versions = await getVersions(targetFile.relativePath);
    setVersionList(versions);
    setShowTimeMachine(true);
  };

  const executeReversion = () => {
    if (!confirmRevert || !ydocRef.current || !ytextRef.current) return;
    ydocRef.current.transact(() => {
      ytextRef.current.delete(0, ytextRef.current.length);
      ytextRef.current.insert(0, confirmRevert.content);
    });
    toast.success("Timeline successfully restored.");
    setConfirmRevert(null);
    setShowTimeMachine(false);
    saveToDisk(true); 
  };

  // 🔴 UPDATED FILE LOCK: CLEARS LINE LOCKS ON ENGAGE
  const toggleFileLock = () => {
    if (!yLocksRef.current) return;
    
    if (fileLock) {
      if (fileLock.uid === myUid || isWorkspaceHost) {
        yLocksRef.current.set('fileLock', null);
        toast.success("File unlocked.");
      }
    } else {
      yLocksRef.current.set('fileLock', { uid: myUid, name: myName });
      
      // Wipe out all existing line locks so the file owner has total control
      if (yLineLocksRef.current) {
         const keysToDelete = [];
         yLineLocksRef.current.forEach((val, key) => keysToDelete.push(key));
         keysToDelete.forEach(k => yLineLocksRef.current.delete(k));
      }
      
      toast.success("File locked. All previous line locks cleared.");
    }
  };

  const toggleAutoLineLock = () => {
    const newState = !autoLineLock;
    setAutoLineLock(newState);
    
    if (newState) {
      toast.success("Auto Line Lock Enabled. Your cursor line is protected.");
      if (yLineLocksRef.current) {
         const currentLock = yLineLocksRef.current.get(currentLine.toString());
         if (!currentLock) {
           yLineLocksRef.current.set(currentLine.toString(), { uid: myUid, name: myName });
         }
      }
    } else {
      toast.success("Auto Line Lock Disabled.");
      if (yLineLocksRef.current) {
        const keysToDelete = [];
        yLineLocksRef.current.forEach((lock, lineStr) => {
           if (lock.uid === myUid) keysToDelete.push(lineStr);
        });
        keysToDelete.forEach(k => yLineLocksRef.current.delete(k));
      }
    }
  };

  if (!activeFile?.name) {
    return (
      <div className={styles.editorContainer}>
        <div className={styles.editorZone}>
          <div className={`${styles.tabsContainer} flex items-center bg-zinc-950 border-b border-zinc-800 h-10`}>
            <div className="flex flex-1 overflow-x-auto custom-scrollbar h-full"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#09090b]">
            <FileCode2 size={64} className="opacity-10 mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest opacity-50">Select a file to begin editing</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.editorContainer}>
      <style>
        {`
          .my-locked-line { background-color: rgba(0, 255, 65, 0.1); border-left: 3px solid #00ff41; }
          .remote-locked-line { background-color: rgba(255, 0, 0, 0.1); border-left: 3px solid #ff0000; }
        `}
        {awarenessUsers.map(u => `
          .yRemoteSelectionHead-${u.clientId}::after {
            position: absolute;
            content: "";
            top: -24px;
            left: -4px;
            width: 20px;
            height: 20px;
            background-image: url('${u.avatar}');
            background-size: cover;
            background-position: center;
            border: 2px solid ${u.color};
            border-radius: 50%;
            z-index: 50;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            pointer-events: none;
          }
          .yRemoteSelectionHead-${u.clientId} { border-left: 2px solid ${u.color} !important; border-top: 2px solid ${u.color} !important; border-bottom: 2px solid ${u.color} !important; }
        `).join('\n')}
      </style>

      <div className={styles.editorZone}>
        <div className={`${styles.tabsContainer} flex items-center bg-zinc-950 border-b border-zinc-800 h-10`}>
          
          <div className="flex flex-1 overflow-x-auto custom-scrollbar h-full flex-nowrap shrink-0" onDragOver={(e) => e.preventDefault()}>
            {openFiles.map((file, idx) => {
              const isActive = activeFile?.relativePath === file.relativePath;
              
              const fileToCheck = file.type === 'diff' ? file.modified?.relativePath : file.relativePath;
              const isCurrentFileUnsaved = unsavedFiles.includes(fileToCheck);
              
              const isDragTarget = dragOverIdx === idx;
              
              return (
                <div 
                  key={file.relativePath} draggable={true}
                  onDragStart={(e) => handleDragStart(e, idx)} onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragOver={(e) => e.preventDefault()} onDragEnd={handleDragEnd} onClick={() => handleOpenFile(file)}
                  className={`group flex items-center gap-2 px-4 py-2 border-r border-zinc-800 text-xs cursor-pointer transition-colors min-w-30 max-w-50 shrink-0 h-full select-none ${
                    isActive ? 'bg-[#09090b] text-[#c084fc] border-t-2 border-t-[#c084fc]' : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900 border-t-2 border-t-transparent'
                  } ${isDragTarget ? 'border-l-2 border-l-[#c084fc] bg-zinc-900/50' : ''}`}
                >
                  <span className={`pointer-events-none ${isActive ? "text-[#c084fc]" : "text-zinc-600"}`}>
                    {file.type === 'diff' ? <SplitSquareHorizontal size={12}/> : <FileCode2 size={12}/>}
                  </span>
                  <span className={`pointer-events-none truncate leading-tight ${isCurrentFileUnsaved ? 'text-white' : ''}`}>{file.name}</span>
                  
                  <div className="ml-auto pl-2 pr-1 flex items-center hover:bg-zinc-800/80 rounded h-full" onClick={(e) => handleCloseFile(file.relativePath, e)}>
                    {isCurrentFileUnsaved ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                    ) : (
                      <X size={12} className={`shrink-0 transition-opacity hover:text-white ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-4 px-4 bg-zinc-950 shrink-0 h-full shadow-[-10px_0_10px_rgba(0,0,0,0.5)] z-10">
            
            <button
               onClick={showTimeMachine ? () => setShowTimeMachine(false) : fetchLocalHistory}
               className={`px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
                 showTimeMachine ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400'
               }`}
            >
               <History size={12} /> Timeline
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleAutoLineLock}
                className={`px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
                  autoLineLock
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white'
                    : 'bg-zinc-900 border-zinc-700 hover:border-orange-500 text-orange-400'
                }`}
              >
                {autoLineLock ? <Lock size={12} /> : <Unlock size={12} />}
                {autoLineLock ? 'Line Lock: ON' : 'Line Lock: OFF'}
              </button>

              <button
                onClick={toggleFileLock}
                disabled={fileLock && fileLock.uid !== myUid && !isWorkspaceHost}
                className={`px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
                  fileLock
                    ? (fileLock.uid === myUid || isWorkspaceHost ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed')
                    : 'bg-zinc-900 border-zinc-700 hover:border-[#00ff41] text-[#00ff41]'
                }`}
              >
                {fileLock ? <Lock size={12} /> : <Unlock size={12} />}
                {fileLock ? (fileLock.uid === myUid || isWorkspaceHost ? 'Unlock File' : `Locked by ${fileLock.name}`) : 'Lock File'}
              </button>
            </div>

            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest">
              <Users size={12} className={peerCount > 1 ? "text-[#c084fc]" : "text-zinc-600"} />
              <span className={peerCount > 1 ? "text-white animate-pulse" : "text-zinc-600"}>{peerCount} PEER{peerCount !== 1 ? 'S' : ''}</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            {isSignaling ? <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono tracking-widest"><Wifi size={12} /> NETWORK UP</span> : <span className="flex items-center gap-1 text-[10px] text-red-400 font-mono tracking-widest animate-pulse"><WifiOff size={12} /> ROUTING...</span>}
          </div>
        </div>

        <div className={`relative ${styles.codeCanvas}`}>
          
          {activeFile.type === 'diff' ? (
            <DiffEditor 
              key={`diff-${activeFile.relativePath}`}
              height="100%" 
              original={activeFile.original.content} 
              modified={activeFile.modified.content} 
              language={getLanguage(activeFile.original.name)} 
              theme="colab-dark"
              options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'Fira Code, monospace', renderSideBySide: true, readOnly: false, originalEditable: false }} 
              onMount={(diffEditor, monaco) => {
                 monaco.editor.setTheme('colab-dark');
                 const modifiedEditorInstance = diffEditor.getModifiedEditor();
                 handleEditorDidMount(modifiedEditorInstance, monaco);
              }}
            />
          ) : (
            <Editor 
              key={`editor-${activeFile.relativePath}`}
              height="100%" 
              path={activeFile.relativePath || activeFile.name} 
              language={getLanguage(activeFile.name)} 
              onMount={handleEditorDidMount} 
              options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'Fira Code, monospace', backgroundColor: 'transparent', automaticLayout: true, cursorSmoothCaretAnimation: "on" }} 
            />
          )}

          <AnimatePresence>
            {showTimeMachine && (
              <motion.div 
                initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }}
                className="absolute top-0 right-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-300 flex items-center gap-2"><History size={14}/> Local Timeline</span>
                  <X size={14} className="text-zinc-500 hover:text-white cursor-pointer" onClick={() => setShowTimeMachine(false)}/>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  {versionList.length === 0 ? (
                    <div className="text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-10">No history found</div>
                  ) : (
                    versionList.map((ver, idx) => {
                      const isConfirming = confirmRevert?.id === ver.id;
                      const dateObj = new Date(ver.timestamp);
                      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const dateStr = dateObj.toLocaleDateString();

                      return (
                        <div key={ver.id} className="relative">
                          <div 
                            onClick={() => !isConfirming && setConfirmRevert(ver)}
                            className={`flex flex-col p-3 mb-2 rounded border cursor-pointer transition-colors ${isConfirming ? 'bg-zinc-900 border-[#c084fc]' : 'bg-black border-zinc-800 hover:border-zinc-600'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black text-[#c084fc]">V.{versionList.length - idx}</span>
                              <span className="text-[10px] font-mono text-zinc-500">{timeStr}</span>
                            </div>
                            <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{dateStr}</span>
                            
                            <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/50">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setCompareTarget({ name: `${targetFile.name} (V.${versionList.length - idx})`, content: ver.content });
                                  toast.success(`V.${versionList.length - idx} selected for compare.`);
                                }}
                                className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
                              >
                                Select
                              </button>

                              {compareTarget && (
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleOpenDiff(compareTarget, { name: `${targetFile.name} (V.${versionList.length - idx})`, content: ver.content, relativePath: targetFile.relativePath, path: targetFile.path });
                                    setCompareTarget(null);
                                    setShowTimeMachine(false);
                                  }}
                                  className="text-[9px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300"
                                >
                                  Compare With
                                </button>
                              )}

                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const currentContent = editorInstance ? editorInstance.getValue() : targetFile.content;
                                  handleOpenDiff(
                                    { name: `${targetFile.name} (V.${versionList.length - idx})`, content: ver.content },
                                    { name: `${targetFile.name} (Current)`, content: currentContent, relativePath: targetFile.relativePath, path: targetFile.path }
                                  );
                                  setShowTimeMachine(false);
                                }}
                                className="ml-auto text-[9px] font-bold uppercase tracking-widest text-[#00ff41] hover:text-[#00ff41]/80"
                              >
                                Vs Current
                              </button>
                            </div>
                          </div>

                          {isConfirming && (
                            <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm border border-[#c084fc] rounded flex flex-col items-center justify-center mb-2 z-10">
                              <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1 mb-3"><AlertCircle size={12} className="text-red-400"/> Revert to this version?</span>
                              <div className="flex gap-2">
                                <button onClick={executeReversion} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"><Check size={10}/> Yes</button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmRevert(null); }} className="px-3 py-1 bg-zinc-800 text-zinc-400 hover:text-white rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"><XCircle size={10}/> Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      <div className={styles.minimap}>
        <div className={styles.minimapContent}>
          <div className="w-full h-2 bg-zinc-800 rounded mb-1" />
          <div className="w-3/4 h-2 bg-zinc-800 rounded mb-1" />
          <div className="w-full h-2 bg-zinc-800 rounded mb-1" />
        </div>
        <div className={styles.minimapSlider} />
      </div>
    </div>
  );
}