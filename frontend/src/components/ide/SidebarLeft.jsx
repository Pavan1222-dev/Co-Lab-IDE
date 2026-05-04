import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Loader2, Globe, FilePlus, FolderPlus, RefreshCw, ListCollapse, Save, XSquare, Folder, MoreHorizontal, X, Trash2, Edit2, SplitSquareHorizontal, Search } from 'lucide-react';

import { DiJavascript1, DiReact, DiPython, DiJava, DiRust, DiHtml5, DiCss3, DiSass, DiDocker, DiGit, DiNpm, DiDatabase, DiTerminal } from "react-icons/di";
import { SiTypescript, SiCplusplus, SiGo, SiPhp, SiRuby, SiSwift, SiYaml } from "react-icons/si";
import { VscJson, VscMarkdown, VscKey, VscFileZip, VscFileMedia, VscFileCode, VscFile } from "react-icons/vsc";

import { readDir, writeTextFile, readTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import toast from 'react-hot-toast';
import styles from './IDE.module.css';

const SIGNALING_SERVERS = ['wss://colab-matchmaker-v2.onrender.com'];
const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
const osSeparator = navigator.userAgent.includes('Win') ? '\\' : '/';

// 🔴 UTILITY: Highlights the searched text inside the file line preview
const HighlightedText = ({ text, highlight }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? 
          <span key={i} className="bg-[#c084fc]/40 text-white rounded-[1px] px-[1px]">{part}</span> : part
      )}
    </span>
  );
};

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const name = fileName.toLowerCase();

  const exactMatches = {
    '.gitignore': <DiGit size={14} className="text-[#f14e32]" />,
    '.env': <VscKey size={14} className="text-yellow-500" />,
    '.env.local': <VscKey size={14} className="text-yellow-500" />,
    'package.json': <DiNpm size={14} className="text-[#cb3837]" />,
    'package-lock.json': <DiNpm size={14} className="text-zinc-500" />,
    'dockerfile': <DiDocker size={14} className="text-[#2496ed]" />,
    'docker-compose.yml': <DiDocker size={14} className="text-[#2496ed]" />,
    'readme.md': <VscMarkdown size={14} className="text-blue-300" />
  };

  if (exactMatches[name]) return exactMatches[name];

  const extensionMatches = {
    'js': <DiJavascript1 size={14} className="text-[#f7df1e]" />,
    'jsx': <DiReact size={14} className="text-[#61dafb]" />,
    'ts': <SiTypescript size={13} className="text-[#3178c6]" />,
    'tsx': <DiReact size={14} className="text-[#3178c6]" />,
    'html': <DiHtml5 size={14} className="text-[#e34f26]" />,
    'css': <DiCss3 size={14} className="text-[#264de4]" />,
    'scss': <DiSass size={14} className="text-[#cc6699]" />,
    'py': <DiPython size={14} className="text-[#3776ab]" />,
    'java': <DiJava size={14} className="text-[#b07219]" />,
    'c': <SiCplusplus size={13} className="text-[#00599c]" />,
    'cpp': <SiCplusplus size={13} className="text-[#00599c]" />,
    'cs': <VscFileCode size={13} className="text-[#239120]" />,
    'go': <SiGo size={13} className="text-[#00add8]" />,
    'rs': <DiRust size={14} className="text-[#dea584]" />,
    'php': <SiPhp size={13} className="text-[#777bb4]" />,
    'rb': <SiRuby size={13} className="text-[#cc342d]" />,
    'swift': <SiSwift size={13} className="text-[#fa7343]" />,
    'json': <VscJson size={14} className="text-[#8b9bd4]" />,
    'yaml': <SiYaml size={13} className="text-[#cb171e]" />,
    'yml': <SiYaml size={13} className="text-[#cb171e]" />,
    'xml': <VscFileCode size={14} className="text-orange-400" />,
    'sql': <DiDatabase size={14} className="text-zinc-300" />,
    'sh': <DiTerminal size={14} className="text-[#4caf50]" />,
    'bash': <DiTerminal size={14} className="text-[#4caf50]" />,
    'zip': <VscFileZip size={14} className="text-red-400" />,
    'rar': <VscFileZip size={14} className="text-red-400" />,
    'png': <VscFileMedia size={14} className="text-[#a074c4]" />,
    'jpg': <VscFileMedia size={14} className="text-[#a074c4]" />,
    'jpeg': <VscFileMedia size={14} className="text-[#a074c4]" />,
    'svg': <VscFileMedia size={14} className="text-[#a074c4]" />,
    'ico': <VscFileMedia size={14} className="text-[#a074c4]" />
  };

  return extensionMatches[ext] || <VscFile size={14} className="text-zinc-400" />;
};

const FileSystemNode = ({ 
  item, activeFile, setActiveFile, depth = 0, 
  selectedNode, setSelectedNode,
  creatingItem, setCreatingItem, newItemName, setNewItemName, handleCreateSubmit, collapseTrigger,
  projectRoot, unsavedFiles,
  onContextMenu, renamingItem, handleRenameSubmit, handleOpenFile
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prevCollapse, setPrevCollapse] = useState(collapseTrigger);
  const [prevTarget, setPrevTarget] = useState(null);

  if (collapseTrigger !== prevCollapse) {
    setPrevCollapse(collapseTrigger);
    setIsOpen(false);
  }

  if (creatingItem?.targetPath !== prevTarget) {
    setPrevTarget(creatingItem?.targetPath);
    if (creatingItem?.targetPath === item.path) setIsOpen(true);
  }

  const handleFolderClick = async (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    const localPath = await join(projectRoot, item.relativePath);
    setSelectedNode({ path: localPath, isDirectory: true, relativePath: item.relativePath });
  };

  const handleFileClick = async (e) => {
    e.stopPropagation();
    const localPath = await join(projectRoot, item.relativePath);
    handleOpenFile({ name: item.name, path: localPath, relativePath: item.relativePath });
    setSelectedNode({ path: localPath, isDirectory: false, relativePath: item.relativePath });
  };

  const isSelected = selectedNode?.path && selectedNode.path.endsWith(item.relativePath.replace(/\//g, osSeparator));
  const isUnsaved = unsavedFiles.includes(item.relativePath);
  const isRenaming = renamingItem?.path === item.path;
  const paddingLeft = `${(depth * 10) + 8}px`;

  if (item.isDirectory) {
    return (
      <div className="select-none">
        <div 
          className={`flex items-center gap-1 py-0.5 text-[12px] cursor-pointer transition-colors border-l ${
            isSelected ? 'bg-zinc-800/80 border-[#c084fc] text-white' : 'border-transparent text-zinc-300 hover:text-white hover:bg-zinc-800/40'
          }`}
          style={{ paddingLeft }}
          onClick={handleFolderClick}
          onContextMenu={(e) => onContextMenu(e, { ...item, path: item.path || 'fallback_path' })}
        >
          {isOpen ? <ChevronDown size={14} className="text-zinc-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 shrink-0" />}
          <Folder size={14} className={`shrink-0 ${isOpen ? "text-[#c084fc] fill-[#c084fc]/20" : "text-zinc-400 fill-zinc-400/20"}`} />
          
          {isRenaming ? (
             <form onSubmit={handleRenameSubmit} className="flex-1 w-full ml-1" onClick={e=>e.stopPropagation()}>
               <input autoFocus type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onBlur={handleRenameSubmit} className="bg-black border border-[#c084fc] outline-none text-[12px] text-white w-[90%] font-mono py-px px-1 rounded-sm" />
             </form>
          ) : (
             <span className="truncate leading-tight">{item.name}</span>
          )}
        </div>
        
        {isOpen && (
          <div className="flex flex-col">
            {creatingItem?.targetPath && creatingItem.targetPath.endsWith(item.relativePath.replace(/\//g, osSeparator)) && (
               <form onSubmit={handleCreateSubmit} className="flex items-center py-0.5 mt-px mb-px bg-black border border-[#c084fc] rounded-sm relative z-10" style={{ marginLeft: `${(depth + 1) * 10 + 22}px`, marginRight: '8px' }}>
                 {creatingItem.type === 'file' ? <VscFile size={13} className="text-zinc-500 ml-1 mr-1 shrink-0" /> : <Folder size={13} className="text-[#c084fc] ml-1 mr-1 shrink-0" />}
                 <input 
                   autoFocus type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                   onBlur={() => setCreatingItem(null)} 
                   className="bg-transparent outline-none text-[12px] text-white w-full font-mono py-px"
                 />
               </form>
            )}
            {item.children && item.children.map((child, idx) => (
              <FileSystemNode 
                key={idx} item={child} activeFile={activeFile} setActiveFile={setActiveFile} depth={depth + 1} 
                selectedNode={selectedNode} setSelectedNode={setSelectedNode}
                creatingItem={creatingItem} setCreatingItem={setCreatingItem}
                newItemName={newItemName} setNewItemName={setNewItemName} handleCreateSubmit={handleCreateSubmit}
                collapseTrigger={collapseTrigger} projectRoot={projectRoot} unsavedFiles={unsavedFiles}
                onContextMenu={onContextMenu} renamingItem={renamingItem} handleRenameSubmit={handleRenameSubmit}
                handleOpenFile={handleOpenFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`group flex items-center gap-1.5 py-0.5 text-[12px] cursor-pointer transition-colors truncate border-l ${
        activeFile?.relativePath === item.relativePath && activeFile?.type !== 'diff' ? 'bg-[#c084fc]/10 border-[#c084fc] text-[#c084fc]' : 
        isSelected ? 'bg-zinc-800/80 border-zinc-600 text-white' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/40'
      }`} 
      style={{ paddingLeft: `${(depth * 10) + 22}px` }}
      onClick={handleFileClick}
      onContextMenu={(e) => onContextMenu(e, { ...item, path: item.path || 'fallback_path' })}
    >
      <span className="shrink-0">{getFileIcon(item.name)}</span>
      
      {isRenaming ? (
         <form onSubmit={handleRenameSubmit} className="flex-1 w-full" onClick={e=>e.stopPropagation()}>
           <input autoFocus type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onBlur={handleRenameSubmit} className="bg-black border border-[#c084fc] outline-none text-[12px] text-white w-[90%] font-mono py-px px-1 rounded-sm" />
         </form>
      ) : (
         <span className={`truncate leading-tight ${isUnsaved ? 'text-white italic' : ''}`}>{item.name}</span>
      )}
      
      {isUnsaved && !isRenaming && <div className="w-1.5 h-1.5 rounded-full bg-white ml-auto mr-4 shrink-0" />}
    </div>
  );
};

const AccordionSection = ({ title, isOpen, onToggle, actions, children }) => (
  <div className="flex flex-col border-b border-zinc-900/50 group select-none">
    <div className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-zinc-800/30" onClick={onToggle}>
      <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors flex-1">
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="uppercase tracking-wider flex items-center gap-2">{title}</span>
      </div>
      {actions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400">
          {actions}
        </div>
      )}
    </div>
    {isOpen && <div className="py-0.5">{children}</div>}
  </div>
);

export default function SidebarLeft({ 
  activeTab, // 🔴 NEW: Receives router state from IDEShell
  activeFile, setActiveFile, projectRoot, roomHash, isWorkspaceHost, unsavedFiles,
  openFiles, handleOpenFile, handleCloseFile,
  compareTarget, setCompareTarget, handleOpenDiff 
}) {
  const [fileTree, setFileTree] = useState([]);
  const [sections, setSections] = useState({ openEditors: true, folders: true });
  const [syncStatus, setSyncStatus] = useState({ active: false, currentFile: '', percent: 0 });
  const [collapseTrigger, setCollapseTrigger] = useState(0);

  const [selectedNode, setSelectedNode] = useState(null); 
  const [creatingItem, setCreatingItem] = useState(null); 
  const [renamingItem, setRenamingItem] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetItem: null });

  // 🔴 SEARCH ENGINE STATES
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const yProvider = useRef(null);
  const yTreeMap = useRef(null);
  const ySyncMap = useRef(null);

  const scanAndBroadcastDirectory = useCallback(async (rootPath) => {
    if (!rootPath || !isTauri) return;
    
    const broadcastProgress = (file, pct) => {
      const status = { active: true, currentFile: file, percent: pct };
      setSyncStatus(status);
      if (isWorkspaceHost && ySyncMap.current) ySyncMap.current.set('status', status); 
    };

    broadcastProgress("Scanning...", 5);

    const readDirRecursive = async (currentPath, currentRelative = '', currentDepth = 0) => {
      if (currentDepth > 8 || currentPath.includes('node_modules') || currentPath.includes('.git') || currentPath.includes('dist') || currentPath.includes('build')) return []; 
      try {
        const entries = await readDir(currentPath);
        let folderStructure = [];
        
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const entryPath = await join(currentPath, entry.name);
          const relPath = currentRelative ? `${currentRelative}/${entry.name}` : entry.name;
          
          broadcastProgress(entry.name, Math.min(10 + Math.floor((i / entries.length) * 80), 95));
          
          if (entry.isDirectory) {
            const children = await readDirRecursive(entryPath, relPath, currentDepth + 1);
            folderStructure.push({ name: entry.name, relativePath: relPath, isDirectory: true, children, path: entryPath });
          } else {
            folderStructure.push({ name: entry.name, relativePath: relPath, isDirectory: false, path: entryPath });
          }
        }
        
        return folderStructure.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      } catch { return []; } 
    };

    const completeTree = await readDirRecursive(rootPath, '');
    broadcastProgress("Scan Complete.", 100);
    
    setTimeout(() => {
      const doneStatus = { active: false, currentFile: '', percent: 0 };
      setSyncStatus(doneStatus);
      if (isWorkspaceHost && ySyncMap.current) ySyncMap.current.set('status', doneStatus);
    }, 1000);

    setFileTree(completeTree);
    if (isWorkspaceHost && yTreeMap.current) yTreeMap.current.set('treeData', completeTree);
  }, [isWorkspaceHost]);

  useEffect(() => {
    const handleNewFile = () => {
       if (projectRoot) {
           setCreatingItem({ type: 'file', targetPath: projectRoot });
           setNewItemName('');
           setSections(prev => ({...prev, folders: true}));
       }
    };
    const handleNewFolder = () => {
       if (projectRoot) {
           setCreatingItem({ type: 'folder', targetPath: projectRoot });
           setNewItemName('');
           setSections(prev => ({...prev, folders: true}));
       }
    };
    
    window.addEventListener('global-create-file', handleNewFile);
    window.addEventListener('global-create-folder', handleNewFolder);
    return () => {
      window.removeEventListener('global-create-file', handleNewFile);
      window.removeEventListener('global-create-folder', handleNewFolder);
    };
  }, [projectRoot]);

  useEffect(() => {
    const safeRoom = roomHash || 'local-offline-room';
    const treeRoomName = `${safeRoom}-ghost-tree`;
    
    const ydoc = new Y.Doc();
    yProvider.current = new WebrtcProvider(treeRoomName, ydoc, { signaling: SIGNALING_SERVERS });
    yTreeMap.current = ydoc.getMap('projectTree');
    ySyncMap.current = ydoc.getMap('syncProgress');

    yTreeMap.current.observe(() => {
      if (yTreeMap.current.has('treeData')) setFileTree(yTreeMap.current.get('treeData'));
    });

    ySyncMap.current.observe(() => {
      if (ySyncMap.current.has('status')) setSyncStatus(ySyncMap.current.get('status'));
    });

    return () => {
      if (yProvider.current) { yProvider.current.disconnect(); yProvider.current.destroy(); }
      ydoc.destroy();
    };
  }, [roomHash]);

  useEffect(() => {
    if (projectRoot && isWorkspaceHost) {
       const timer = setTimeout(() => { scanAndBroadcastDirectory(projectRoot); }, 300);
       return () => clearTimeout(timer);
    }
  }, [projectRoot, isWorkspaceHost, scanAndBroadcastDirectory]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
    };
    if (contextMenu.visible) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 10);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  const closeMenu = () => { setContextMenu({ ...contextMenu, visible: false }); };

  const handleContextMenu = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    const fullPath = await join(projectRoot, item.relativePath);
    item.path = fullPath; 

    let finalY = e.clientY;
    if (window.innerHeight - e.clientY < 400) finalY = window.innerHeight - 400;

    setContextMenu({ visible: true, x: e.clientX, y: finalY, targetItem: item });
    setSelectedNode({ path: fullPath, isDirectory: item.isDirectory, relativePath: item.relativePath });
  };

  const executeDelete = async () => {
    const target = contextMenu.targetItem;
    closeMenu();
    try {
      await remove(target.path, { recursive: true });
      toast.success(`Deleted: ${target.name}`);
      if (activeFile?.path === target.path) handleCloseFile(target.relativePath);
      scanAndBroadcastDirectory(projectRoot); 
    } catch { toast.error(`Delete failed. Permission denied.`); }
  };

  const triggerRenameMode = () => {
    setRenamingItem(contextMenu.targetItem);
    setNewItemName(contextMenu.targetItem.name);
    closeMenu();
  };

  const handleRenameSubmit = async (e) => {
    e?.preventDefault();
    if (!renamingItem || !newItemName.trim() || newItemName === renamingItem.name) {
      setRenamingItem(null); return;
    }
    try {
      const parentPath = renamingItem.path.substring(0, renamingItem.path.lastIndexOf(osSeparator));
      const newFullPath = await join(parentPath, newItemName);
      await rename(renamingItem.path, newFullPath);
      toast.success(`Renamed to ${newItemName}`);
      setRenamingItem(null);
      scanAndBroadcastDirectory(projectRoot); 
    } catch {
      toast.error(`Rename failed.`);
      setRenamingItem(null);
    }
  };

  const handleOpenTerminal = () => {
    const targetPath = contextMenu.targetItem.isDirectory 
      ? contextMenu.targetItem.path 
      : contextMenu.targetItem.path.substring(0, contextMenu.targetItem.path.lastIndexOf(osSeparator));
    window.dispatchEvent(new CustomEvent('global-open-terminal', { detail: { path: targetPath } }));
    closeMenu();
  };

  const handleStartCreate = (type, e) => {
    e?.stopPropagation();
    if (!projectRoot) return toast.error("No project mounted.");
    let targetPath = projectRoot; 
    if (selectedNode) {
      if (selectedNode.isDirectory) targetPath = selectedNode.path; 
      else targetPath = selectedNode.path.substring(0, selectedNode.path.lastIndexOf(osSeparator));
    }
    setCreatingItem({ type, targetPath });
    setNewItemName('');
    setSections(prev => ({...prev, folders: true}));
    closeMenu();
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    if (!newItemName.trim() || !creatingItem) return setCreatingItem(null);
    try {
      const fullPath = await join(creatingItem.targetPath, newItemName);
      if (creatingItem.type === 'file') {
        await writeTextFile(fullPath, "");
        toast.success(`Created file: ${newItemName}`);
      } else if (creatingItem.type === 'folder') {
        await mkdir(fullPath);
        toast.success(`Created folder: ${newItemName}`);
      }
      setCreatingItem(null);
      setNewItemName('');
      scanAndBroadcastDirectory(projectRoot); 
    } catch { toast.error(`Creation failed. Check permissions.`); }
  };

  // 🔴 SEARCH ENGINE CORE
  const performSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !projectRoot || !isTauri) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = [];
      const searchInDir = async (dirPath, relPath = '') => {
        if (dirPath.includes('node_modules') || dirPath.includes('.git') || dirPath.includes('dist') || dirPath.includes('build')) return;
        const entries = await readDir(dirPath);
        
        for (const entry of entries) {
          const entryPath = await join(dirPath, entry.name);
          const currentRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory) {
            await searchInDir(entryPath, currentRelPath);
          } else {
            // Ignore non-text files to prevent crashes
            if (entry.name.match(/\.(png|jpg|jpeg|gif|ico|zip|rar|pdf|exe|dll|mp4|mp3)$/i)) continue;
            try {
              const content = await readTextFile(entryPath);
              const lines = content.split('\n');
              const matches = [];
              const regex = new RegExp(searchQuery, 'gi');
              
              lines.forEach((line, idx) => {
                if (line.match(regex)) {
                  matches.push({ lineNum: idx + 1, lineText: line.trim() });
                }
              });
              
              if (matches.length > 0) {
                results.push({ name: entry.name, path: entryPath, relativePath: currentRelPath, matches });
              }
            } catch (e) {console.log(e)}
          }
        }
      };

      await searchInDir(projectRoot);
      setSearchResults(results);
    } catch (err) {
      toast.error("Search failed");
      console.log(err);
    } finally {
      setIsSearching(false);
    }
  };

  // 🔴 MASS REPLACE ENGINE
  const handleReplaceAll = async () => {
    if (!searchQuery || searchResults.length === 0) return;
    const confirm = window.confirm(`Replace all occurrences of "${searchQuery}" with "${replaceQuery}" in ${searchResults.length} files?`);
    if (!confirm) return;
    
    setIsSearching(true);
    let replacedCount = 0;
    try {
        for (const fileResult of searchResults) {
            const content = await readTextFile(fileResult.path);
            const regex = new RegExp(searchQuery, 'gi');
            const newContent = content.replace(regex, replaceQuery);
            await writeTextFile(fileResult.path, newContent);
            replacedCount++;
        }
        toast.success(`Replaced in ${replacedCount} files.`);
        scanAndBroadcastDirectory(projectRoot); 
        performSearch(); 
    } catch (e) {
        console.log(e);
        toast.error("Error during replacement.");
    } finally {
        setIsSearching(false);
    }
  };

  const handleResultClick = async (file, lineNum) => {
    handleOpenFile(file);
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('global-jump-to-line', { 
            detail: { resource: file.relativePath, startLineNumber: lineNum, startColumn: 1 } 
        }));
    }, 150); 
  };

  const projectName = projectRoot ? projectRoot.split(osSeparator).pop().toUpperCase() : 'NO FOLDER MOUNTED';
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  return (
    <div className={`${styles.sideBar} flex flex-col relative bg-[#09090b] w-full shrink-0 h-full`} onClick={() => { setSelectedNode(null); setCreatingItem(null); setRenamingItem(null); closeMenu(); }}>
      
      {portalRoot && createPortal(
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
          <AnimatePresence>
            {contextMenu.visible && (
              <div className="fixed inset-0 pointer-events-auto" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} style={{ zIndex: 9998 }} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {contextMenu.visible && contextMenu.targetItem && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.1 }}
                className="fixed bg-zinc-950 border border-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.8)] py-1.5 rounded-lg z-9999 text-[11px] text-zinc-300 min-w-55 font-sans flex flex-col select-none pointer-events-auto"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                {contextMenu.targetItem.isDirectory ? (
                  <>
                    <div onClick={() => handleStartCreate('file')} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"><span>New File...</span></div>
                    <div onClick={() => handleStartCreate('folder')} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"><span>New Folder...</span></div>
                    <div className="h-px bg-zinc-700 my-1 w-full" />
                  </>
                ) : (
                  <>
                    <div 
                      onClick={async () => {
                        try {
                          const content = await readTextFile(contextMenu.targetItem.path);
                          setCompareTarget({ name: contextMenu.targetItem.name, content });
                          toast.success(`Selected for compare.`);
                          closeMenu();
                        } catch { toast.error("Could not read file"); }
                      }} 
                      className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"
                    >
                      <span>Select for Compare</span>
                    </div>

                    {compareTarget && (
                      <div 
                        onClick={async () => {
                          try {
                            const content = await readTextFile(contextMenu.targetItem.path);
                            
                            handleOpenDiff(compareTarget, { 
                                name: contextMenu.targetItem.name, 
                                content,
                                relativePath: contextMenu.targetItem.relativePath,
                                path: contextMenu.targetItem.path
                            });
                            
                            setCompareTarget(null);
                            closeMenu();
                          } catch { toast.error("Could not read file"); }
                        }} 
                        className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between group"
                      >
                        <span className="flex items-center gap-2"><SplitSquareHorizontal size={12} className="opacity-0 group-hover:opacity-100"/> Compare with Selected</span>
                      </div>
                    )}
                    <div className="h-px bg-zinc-700 my-1 w-full" />
                  </>
                )}

                <div onClick={handleOpenTerminal} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"><span>Open in Integrated Terminal</span></div>
                <div className="h-px bg-zinc-700 my-1 w-full" />
                <div onClick={() => { navigator.clipboard.writeText(contextMenu.targetItem.path); toast.success("Absolute Path copied!"); closeMenu(); }} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"><span>Copy Path</span><span className="text-[10px] opacity-50">Shift+Alt+C</span></div>
                <div onClick={() => { navigator.clipboard.writeText(contextMenu.targetItem.relativePath); toast.success("Relative Path copied!"); closeMenu(); }} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between"><span>Copy Relative Path</span><span className="text-[10px] opacity-50">Ctrl+K C</span></div>
                <div className="h-px bg-zinc-700 my-1 w-full" />
                <div onClick={triggerRenameMode} className="px-4 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer flex items-center justify-between group"><span className="flex items-center gap-2"><Edit2 size={12} className="opacity-0 group-hover:opacity-100"/> Rename...</span><span className="text-[10px] opacity-50">F2</span></div>
                <div onClick={executeDelete} className="px-4 py-1.5 hover:bg-red-600 hover:text-white cursor-pointer flex items-center justify-between group"><span className="flex items-center gap-2 text-red-400 group-hover:text-white"><Trash2 size={12}/> Delete</span><span className="text-[10px] opacity-50">Del</span></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        portalRoot
      )}

      {/* 🔴 ROUTER: RENDER FILE EXPLORER */}
      {activeTab === 'files' && (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
            <span className="flex items-center gap-2">EXPLORER {!isWorkspaceHost && fileTree.length > 0 && <Globe size={10} className="text-[#00ff41] animate-pulse" title="Virtual Remote Tree" />}</span>
            <MoreHorizontal size={14} className="hover:text-white cursor-pointer" />
          </div>

          {syncStatus.active && (
            <div className="absolute top-10 left-0 w-full bg-zinc-950/95 border-b border-[#c084fc]/50 p-3 z-20 backdrop-blur-md shadow-2xl flex flex-col gap-2">
               <div className="flex justify-between items-center text-[10px] font-bold tracking-widest uppercase text-[#c084fc]"><span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Syncing</span><span>{syncStatus.percent}%</span></div>
               <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-[#c084fc] transition-all duration-300" style={{ width: `${syncStatus.percent}%` }} /></div>
               <div className="text-[9px] font-mono text-zinc-500 truncate">{syncStatus.currentFile}</div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pb-6 custom-scrollbar pr-1">
            
            <AccordionSection 
              title={<>Open Editors {unsavedFiles.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-white/20 text-white lowercase tracking-normal">{unsavedFiles.length} unsaved</span>}</>} 
              isOpen={sections.openEditors} 
              onToggle={(e) => { e.stopPropagation(); setSections(p => ({...p, openEditors: !p.openEditors}))}}
              actions={
                <>
                  <div onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event('global-save-trigger')); }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Save All"><Save size={14}/></div>
                  <div onClick={(e) => { e.stopPropagation(); openFiles.forEach(f => handleCloseFile(f.relativePath, e)); }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Close All Editors"><XSquare size={14}/></div>
                </>
              }
            >
              {openFiles.length > 0 ? (
                <div className="flex flex-col">
                  {openFiles.map(file => {
                     const fileToCheck = file.type === 'diff' ? file.modified?.relativePath : file.relativePath;
                     const isCurrentFileUnsaved = unsavedFiles.includes(fileToCheck);
                     const isActive = activeFile?.relativePath === file.relativePath;
                     
                     return (
                        <div 
                          key={file.relativePath} 
                          onClick={() => handleOpenFile(file)}
                          className={`flex items-center gap-2 px-6 py-1 text-[12px] cursor-pointer group ${isActive ? 'bg-[#c084fc]/10 text-[#c084fc] border-l-2 border-[#c084fc]' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 border-l-2 border-transparent'}`}
                        >
                          <span className="shrink-0 pointer-events-none">{file.type === 'diff' ? <SplitSquareHorizontal size={12} className={isActive ? "text-[#c084fc]" : "text-zinc-600"}/> : getFileIcon(file.name)}</span> 
                          <span className={`truncate leading-tight pointer-events-none ${isCurrentFileUnsaved ? 'text-white' : ''}`}>{file.name}</span>
                          
                          <div className="ml-auto pl-2 pr-2 flex items-center hover:bg-zinc-800/80 rounded" onClick={(e) => handleCloseFile(file.relativePath, e)}>
                            {isCurrentFileUnsaved ? (<div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />) : (<X size={12} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity" />)}
                          </div>
                        </div>
                     )
                  })}
                </div>
              ) : (
                 <div className="px-6 py-1 text-[11px] text-zinc-600 italic">No editors open</div>
              )}
            </AccordionSection>

            <AccordionSection 
              title={projectName} 
              isOpen={sections.folders} 
              onToggle={(e) => { e.stopPropagation(); setSections(p => ({...p, folders: !p.folders}))}}
              actions={
                <>
                  <div onClick={(e) => handleStartCreate('file', e)} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="New File"><FilePlus size={14}/></div>
                  <div onClick={(e) => handleStartCreate('folder', e)} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="New Folder"><FolderPlus size={14}/></div>
                  <div onClick={(e) => { e.stopPropagation(); scanAndBroadcastDirectory(projectRoot); }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Refresh Explorer"><RefreshCw size={14}/></div>
                  <div onClick={(e) => { e.stopPropagation(); setCollapseTrigger(prev => prev + 1); }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Collapse Folders in Explorer"><ListCollapse size={14}/></div>
                </>
              }
            >
              {creatingItem?.targetPath === projectRoot && (
                <form onSubmit={handleCreateSubmit} className="flex items-center px-4 py-0.5 mt-px mx-2 bg-black border border-[#c084fc] rounded-sm relative z-10 shadow-[0_0_10px_rgba(192,132,252,0.2)]" onClick={e=>e.stopPropagation()}>
                  {creatingItem.type === 'file' ? <VscFile size={13} className="text-zinc-500 mr-2 shrink-0" /> : <Folder size={13} className="text-[#c084fc] mr-2 shrink-0" />}
                  <input autoFocus type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onBlur={() => setCreatingItem(null)} className="bg-transparent outline-none text-[12px] text-white w-full font-mono py-px" />
                </form>
              )}

              {fileTree.length === 0 ? (
                 <div className="px-6 py-2 text-[11px] text-zinc-500">{projectRoot ? 'Folder is empty.' : 'Awaiting host sync...'}</div>
              ) : (
                <div className="flex flex-col pb-2 mt-px pl-1">
                  {fileTree.map((item, index) => (
                    <FileSystemNode 
                      key={index} item={item} projectRoot={projectRoot} activeFile={activeFile} setActiveFile={setActiveFile} 
                      selectedNode={selectedNode} setSelectedNode={setSelectedNode} creatingItem={creatingItem} setCreatingItem={setCreatingItem}
                      newItemName={newItemName} setNewItemName={setNewItemName} handleCreateSubmit={handleCreateSubmit} collapseTrigger={collapseTrigger} unsavedFiles={unsavedFiles}
                      onContextMenu={handleContextMenu} renamingItem={renamingItem} handleRenameSubmit={handleRenameSubmit}
                      handleOpenFile={handleOpenFile}
                    />
                  ))}
                </div>
              )}
            </AccordionSection>

          </div>
        </>
      )}

      {/* 🔴 ROUTER: RENDER SEARCH & REPLACE ENGINE */}
      {activeTab === 'search' && (
        <div className="flex flex-col h-full w-full">
          <div className="flex items-center px-4 py-2 border-b border-zinc-800 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
            SEARCH
          </div>
          
          <div className="p-4 flex flex-col gap-3 shrink-0 border-b border-zinc-800/50">
            <form onSubmit={performSearch} className="flex flex-col gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  autoFocus
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Search" 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded pl-7 pr-2 py-1 text-xs text-white outline-none focus:border-[#c084fc] transition-colors" 
                />
              </div>
              <div className="relative">
                <input 
                  value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} 
                  placeholder="Replace" 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded pl-2 pr-2 py-1 text-xs text-white outline-none focus:border-[#c084fc] transition-colors" 
                />
              </div>
              <div className="flex gap-2 mt-1">
                  <button type="submit" className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] py-1.5 rounded transition-colors uppercase tracking-widest font-bold">Find</button>
                  <button type="button" onClick={handleReplaceAll} disabled={searchResults.length === 0} className="flex-1 bg-[#c084fc]/20 text-[#c084fc] hover:bg-[#c084fc] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-[10px] py-1.5 rounded transition-colors uppercase tracking-widest font-bold">Replace All</button>
              </div>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-6 pt-2">
            {isSearching ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 gap-2 text-xs">
                <Loader2 size={14} className="animate-spin" /> Scanning...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col gap-1">
                <div className="px-2 text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-bold">{searchResults.reduce((acc, curr) => acc + curr.matches.length, 0)} results in {searchResults.length} files</div>
                {searchResults.map((file, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div 
                      className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800/50 cursor-pointer rounded text-xs text-zinc-300 transition-colors"
                      onClick={() => handleOpenFile(file)}
                    >
                      <ChevronDown size={12} className="text-zinc-500" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto bg-zinc-800 text-zinc-400 text-[9px] px-1.5 rounded-full">{file.matches.length}</span>
                    </div>
                    <div className="flex flex-col pl-6">
                      {file.matches.map((m, i) => (
                        <div 
                          key={i} 
                          className="flex items-start gap-2 px-2 py-0.5 hover:bg-[#c084fc]/10 cursor-pointer rounded text-[11px] text-zinc-400 transition-colors group"
                          onClick={() => handleResultClick(file, m.lineNum)}
                        >
                          <span className="text-[#c084fc] shrink-0 opacity-50 group-hover:opacity-100">{m.lineNum}</span>
                          <span className="truncate whitespace-pre"><HighlightedText text={m.lineText} highlight={searchQuery} /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && !isSearching ? (
              <div className="text-center py-8 text-zinc-600 text-xs">No results found.</div>
            ) : null}
          </div>
        </div>
      )}

      {/* 🔴 ROUTER: RENDER GIT PLACEHOLDER */}
      {activeTab === 'git' && (
         <div className="flex flex-col h-full w-full">
            <div className="flex items-center px-4 py-2 border-b border-zinc-800 text-[11px] font-mono uppercase tracking-widest text-zinc-400">SOURCE CONTROL</div>
            <div className="p-4 text-xs text-zinc-500 text-center mt-10">Git integration requires Tauri shell access. <br/><br/> <span className="text-[#c084fc] cursor-pointer hover:underline">Initialize Repository?</span></div>
         </div>
      )}

    </div>
  );
}