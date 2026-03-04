import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronDown, ChevronRight, FolderOpen, Loader2, Globe, 
  FilePlus, FolderPlus, RefreshCw, ListCollapse, Save, XSquare, 
  Folder, MoreHorizontal, X
} from 'lucide-react';

import { 
  DiJavascript1, DiReact, DiPython, DiJava, DiRust, DiHtml5, DiCss3, 
  DiSass, DiDocker, DiGit, DiNpm, DiDatabase, DiTerminal 
} from "react-icons/di";
import { 
  SiTypescript, SiCplusplus, SiGo, SiPhp, SiRuby, SiSwift, SiYaml
} from "react-icons/si";
import { 
  VscJson, VscMarkdown, VscKey, VscFileZip, VscFileMedia, 
  VscFileCode, VscFile 
} from "react-icons/vsc";

import { readDir, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import toast from 'react-hot-toast';
import styles from './IDE.module.css';

const SIGNALING_SERVERS = ['wss://colab-matchmaker-v2.onrender.com'];
const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
const osSeparator = navigator.userAgent.includes('Win') ? '\\' : '/';

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
  projectRoot, unsavedFiles 
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
    setSelectedNode({ path: localPath, isDirectory: true });
  };

  const handleFileClick = async (e) => {
    e.stopPropagation();
    const localPath = await join(projectRoot, item.relativePath);
    setActiveFile({ name: item.name, path: localPath, relativePath: item.relativePath });
    setSelectedNode({ path: localPath, isDirectory: false });
  };

  const isSelected = selectedNode?.path && selectedNode.path.endsWith(item.relativePath.replace(/\//g, osSeparator));
  const isUnsaved = unsavedFiles.includes(item.relativePath);
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
        >
          {isOpen ? <ChevronDown size={14} className="text-zinc-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 shrink-0" />}
          <Folder size={14} className={`shrink-0 ${isOpen ? "text-[#c084fc] fill-[#c084fc]/20" : "text-zinc-400 fill-zinc-400/20"}`} />
          <span className="truncate leading-tight">{item.name}</span>
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
        activeFile?.relativePath === item.relativePath ? 'bg-[#c084fc]/10 border-[#c084fc] text-[#c084fc]' : 
        isSelected ? 'bg-zinc-800/80 border-zinc-600 text-white' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/40'
      }`} 
      style={{ paddingLeft: `${(depth * 10) + 22}px` }}
      onClick={handleFileClick}
    >
      <span className="shrink-0">{getFileIcon(item.name)}</span>
      <span className={`truncate leading-tight ${isUnsaved ? 'text-white italic' : ''}`}>{item.name}</span>
      {isUnsaved && <div className="w-1.5 h-1.5 rounded-full bg-white ml-auto mr-4 shrink-0" />}
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

export default function SidebarLeft({ activeFile, setActiveFile, projectRoot, roomHash, isWorkspaceHost, unsavedFiles }) {
  const [fileTree, setFileTree] = useState([]);
  const [sections, setSections] = useState({ openEditors: true, folders: true });
  const [syncStatus, setSyncStatus] = useState({ active: false, currentFile: '', percent: 0 });
  const [collapseTrigger, setCollapseTrigger] = useState(0);

  const [selectedNode, setSelectedNode] = useState(null); 
  const [creatingItem, setCreatingItem] = useState(null); 
  const [newItemName, setNewItemName] = useState('');

  const yProvider = useRef(null);
  const yTreeMap = useRef(null);
  const ySyncMap = useRef(null);

  const scanAndBroadcastDirectory = useCallback(async (rootPath) => {
    if (!rootPath || !isTauri) return;
    
    const broadcastProgress = (file, pct) => {
      const status = { active: true, currentFile: file, percent: pct };
      setSyncStatus(status);
      if (ySyncMap.current) ySyncMap.current.set('status', status); 
    };

    broadcastProgress("Scanning...", 5);

    const readDirRecursive = async (currentPath, currentRelative = '', currentDepth = 0) => {
      if (currentDepth > 8 || currentPath.includes('node_modules') || currentPath.includes('.git')) return []; 
      
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
            folderStructure.push({ name: entry.name, relativePath: relPath, isDirectory: true, children });
          } else {
            folderStructure.push({ name: entry.name, relativePath: relPath, isDirectory: false });
          }
        }
        
        return folderStructure.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      } catch { 
        return []; 
      } 
    };

    const completeTree = await readDirRecursive(rootPath, '');
    broadcastProgress("Scan Complete.", 100);
    
    setTimeout(() => {
      const doneStatus = { active: false, currentFile: '', percent: 0 };
      setSyncStatus(doneStatus);
      if (ySyncMap.current) ySyncMap.current.set('status', doneStatus);
    }, 1000);

    setFileTree(completeTree);
    if (yTreeMap.current) yTreeMap.current.set('treeData', completeTree);
  }, []);

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
       const timer = setTimeout(() => {
         scanAndBroadcastDirectory(projectRoot);
       }, 300);
       return () => clearTimeout(timer);
    }
  }, [projectRoot, isWorkspaceHost, scanAndBroadcastDirectory]);

  const handleStartCreate = (type, e) => {
    e.stopPropagation();
    if (!projectRoot) return toast.error("No project mounted.");

    let targetPath = projectRoot; 
    if (selectedNode) {
      if (selectedNode.isDirectory) {
        targetPath = selectedNode.path; 
      } else {
        targetPath = selectedNode.path.substring(0, selectedNode.path.lastIndexOf(osSeparator));
      }
    }

    setCreatingItem({ type, targetPath });
    setNewItemName('');
    setSections(prev => ({...prev, folders: true}));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
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
    } catch {
      toast.error(`Creation failed. Check permissions.`);
    }
  };

  const projectName = projectRoot ? projectRoot.split(osSeparator).pop().toUpperCase() : 'NO FOLDER MOUNTED';

  return (
    <div className={`${styles.sideBar} flex flex-col relative bg-[#09090b] w-64 shrink-0 border-r border-zinc-800`} onClick={() => { setSelectedNode(null); setCreatingItem(null); }}>
      
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

      <div className="flex-1 overflow-y-auto pb-6 custom-scrollbar">
        
        <AccordionSection 
          title={
            <>Open Editors {unsavedFiles.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-white/20 text-white lowercase tracking-normal">{unsavedFiles.length} unsaved</span>}</>
          } 
          isOpen={sections.openEditors} 
          onToggle={(e) => { e.stopPropagation(); setSections(p => ({...p, openEditors: !p.openEditors}))}}
          actions={
            <>
              <div onClick={(e) => { e.stopPropagation(); setActiveFile({ name: 'Untitled.js', path: null }) }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="New Untitled File"><FilePlus size={14}/></div>
              <div onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event('global-save-trigger')); }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Save All"><Save size={14}/></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveFile({name: '', path: null}) }} className="p-1 hover:bg-zinc-700 rounded cursor-pointer" title="Close All Editors"><XSquare size={14}/></div>
            </>
          }
        >
          {activeFile?.name ? (
            <div className="flex items-center gap-2 px-6 py-0.5 text-[12px] text-[#c084fc] bg-[#c084fc]/5 border-l border-[#c084fc] cursor-pointer group">
              <span className="shrink-0">{getFileIcon(activeFile.name)}</span> 
              <span className={`truncate leading-tight ${unsavedFiles.includes(activeFile.relativePath) ? 'text-white italic' : ''}`}>{activeFile.name}</span>
              <div className="ml-auto flex items-center pr-2">
                {unsavedFiles.includes(activeFile.relativePath) ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                ) : (
                  <X size={14} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setActiveFile({name:'', path:null}) }} />
                )}
              </div>
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
            <div className="flex flex-col pb-2 mt-px">
              {fileTree.map((item, index) => (
                <FileSystemNode 
                  key={index} item={item} projectRoot={projectRoot} activeFile={activeFile} setActiveFile={setActiveFile} 
                  selectedNode={selectedNode} setSelectedNode={setSelectedNode} creatingItem={creatingItem} setCreatingItem={setCreatingItem}
                  newItemName={newItemName} setNewItemName={setNewItemName} handleCreateSubmit={handleCreateSubmit} collapseTrigger={collapseTrigger} unsavedFiles={unsavedFiles}
                />
              ))}
            </div>
          )}
        </AccordionSection>

      </div>
    </div>
  );
}