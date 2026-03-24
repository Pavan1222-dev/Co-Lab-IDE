import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileCode2, Wifi, WifiOff, Users } from 'lucide-react';
import Editor from '@monaco-editor/react';
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

export default function EditorCanvas({ activeFile, roomHash, isAutoSave, unsavedFiles, setUnsavedFiles, setProblems }) {
  const [editorInstance, setEditorInstance] = useState(null);
  const [isSignaling, setIsSignaling] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [awarenessUsers, setAwarenessUsers] = useState([]); 

  const saveTimer = useRef(null);
  const isAutoSaveRef = useRef(isAutoSave);
  
  useEffect(() => {
    isAutoSaveRef.current = isAutoSave;
  }, [isAutoSave]);

  const saveToDisk = useCallback(async () => {
    if (activeFile.path && editorInstance) {
      try {
        const currentCode = editorInstance.getValue();
        await writeTextFile(activeFile.path, currentCode);
        
        setUnsavedFiles(prev => prev.filter(p => p !== activeFile.relativePath));
        
        const editorEl = document.querySelector('.monaco-editor');
        if (editorEl) {
          editorEl.style.opacity = '0.5';
          setTimeout(() => { editorEl.style.opacity = '1'; }, 100);
        }
      } catch (error) {
        console.error("OS WRITE ERROR:", error);
      }
    }
  }, [activeFile, editorInstance, setUnsavedFiles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') || e.type === 'global-save-trigger') {
        e.preventDefault(); 
        saveToDisk();
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
      const currentPath = activeFile.relativePath || activeFile.name;
      
      if (resource === currentPath) {
        editorInstance?.revealLineInCenter(startLineNumber);
        editorInstance?.setPosition({ lineNumber: startLineNumber, column: startColumn });
        editorInstance?.focus();
      } else {
        toast(`Please open ${resource} from the Explorer to view this error.`, { 
          icon: '📂', 
          style: { background: '#09090b', color: '#c084fc', border: '1px solid #c084fc', fontSize: '12px' }
        });
      }
    };
    window.addEventListener('global-jump-to-line', handleJump);
    return () => window.removeEventListener('global-jump-to-line', handleJump);
  }, [editorInstance, activeFile]);

  useEffect(() => {
    if (!editorInstance || !activeFile.name) return;

    let isMounted = true; 
    let isInitializing = true; 

    editorInstance.setValue('Loading physical file from OS...');

    const safeRoomHash = roomHash || 'offline-local-node';
    const safePathName = activeFile.relativePath ? activeFile.relativePath.replace(/[/\\]/g, '-') : activeFile.name;
    const documentRoomName = `${safeRoomHash}-doc-${safePathName}`;
    
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(activeFile.relativePath || activeFile.name);

    const provider = new WebrtcProvider(documentRoomName, ydoc, getProviderOptions());
    

    const userName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Local Developer';
    const userColor = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
    provider.awareness.setLocalStateField('user', { name: userName, color: userColor });

    const binding = new MonacoBinding(ytext, editorInstance.getModel(), new Set([editorInstance]), provider.awareness);

    if (activeFile.path) {
      readTextFile(activeFile.path).then((fileContent) => {
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
        saveTimer.current = setTimeout(() => { saveToDisk(); }, 1500);
      } else {
        setUnsavedFiles(prev => {
          if (activeFile.relativePath && !prev.includes(activeFile.relativePath)) {
            return [...prev, activeFile.relativePath];
          }
          return prev;
        });
      }
    });

    provider.on('status', (event) => { if (isMounted) setIsSignaling(event.connected); });

    const updateAwareness = () => {
      if (!isMounted) return;
      const currentPeers = provider.awareness.getStates().size;
      setPeerCount(currentPeers);
      
      // 🔴 BROADCAST PEERS TO STATUS BAR
      window.dispatchEvent(new CustomEvent('global-peer-update', { detail: currentPeers }));

      const users = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (state.user) users.push({ clientId, name: state.user.name, color: state.user.color });
      });
      setAwarenessUsers(users);
    };

    provider.awareness.on('change', updateAwareness);
    updateAwareness(); 

    return () => {
      isMounted = false;
      binding.destroy();
      provider.disconnect();
      ydoc.destroy();
      clearTimeout(saveTimer.current);
    };
  }, [roomHash, activeFile.name, activeFile.path, activeFile.relativePath, editorInstance, saveToDisk, setUnsavedFiles]); 

  function handleEditorDidMount(editor, monaco) {
    setEditorInstance(editor);
    monaco.editor.defineTheme('colab-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#00000000' }});
    monaco.editor.setTheme('colab-dark');

    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({});
      const formattedProblems = markers.map(marker => ({
        message: marker.message,
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        severity: marker.severity,
        source: marker.source || getLanguage(activeFile.name),
        resource: marker.resource.path.replace(/^\//, '') 
      }));
      if (setProblems) setProblems(formattedProblems);
    });

    // 🔴 BROADCAST CURSOR POSITION TO STATUS BAR
    editor.onDidChangeCursorPosition((e) => {
      window.dispatchEvent(new CustomEvent('global-cursor-update', { 
        detail: { ln: e.position.lineNumber, col: e.position.column } 
      }));
    });
  }

  const isCurrentFileUnsaved = unsavedFiles.includes(activeFile.relativePath);

  return (
    <div className={styles.editorContainer}>
      <style>
        {awarenessUsers.map(u => `
          .yRemoteSelectionHead-${u.clientId}::after {
            position: absolute; content: "${u.name.replace(/"/g, '')}"; top: -22px; left: -2px; background-color: ${u.color};
            color: #000; font-family: monospace; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 4px 4px 4px 0; white-space: nowrap; pointer-events: none; z-index: 50; text-transform: uppercase; letter-spacing: 0.1em;
          }
          .yRemoteSelectionHead-${u.clientId} { border-left: 2px solid ${u.color} !important; border-top: 2px solid ${u.color} !important; border-bottom: 2px solid ${u.color} !important; }
        `).join('\n')}
      </style>

      <div className={styles.editorZone}>
        <div className={styles.tabsContainer}>
          <div className={`${styles.tab} ${styles.tabActive}`}>
            <FileCode2 size={14} className="text-blue-400"/> 
            <span className={isCurrentFileUnsaved ? "text-white italic" : ""}>{activeFile.name}</span>
            {isCurrentFileUnsaved ? (
              <div className="w-2 h-2 bg-white rounded-full ml-auto" />
            ) : (
              <X size={12} className="ml-auto opacity-50 hover:opacity-100 cursor-pointer" onClick={() => window.dispatchEvent(new Event('global-close-editor'))}/>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4 px-4">
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest">
              <Users size={12} className={peerCount > 1 ? "text-[#c084fc]" : "text-zinc-600"} />
              <span className={peerCount > 1 ? "text-white animate-pulse" : "text-zinc-600"}>{peerCount} PEER{peerCount !== 1 ? 'S' : ''}</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            {isSignaling ? <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono tracking-widest"><Wifi size={12} /> NETWORK UP</span> : <span className="flex items-center gap-1 text-[10px] text-red-400 font-mono tracking-widest animate-pulse"><WifiOff size={12} /> ROUTING...</span>}
          </div>
        </div>

        <div className={styles.codeCanvas}>
          <Editor 
            height="100%" 
            path={activeFile.relativePath || activeFile.name} 
            language={getLanguage(activeFile.name)} 
            onMount={handleEditorDidMount} 
            options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'Fira Code, monospace', backgroundColor: 'transparent', automaticLayout: true, cursorSmoothCaretAnimation: "on" }} 
          />
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