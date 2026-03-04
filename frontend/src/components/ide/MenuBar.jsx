import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MenuBar({ onExit, toggleSidebar, toggleTerminal, toggleSecondarySidebar }) {
  const [activeMenu, setActiveMenu] = useState(null);

  // 🔴 FIXED: These now map to real Global Events instead of useless console.logs
  const menus = {
    File: [
      { label: 'New File', shortcut: 'Ctrl+N', action: () => window.dispatchEvent(new Event('global-create-file')) },
      { label: 'New Folder', shortcut: 'Ctrl+Shift+N', action: () => window.dispatchEvent(new Event('global-create-folder')) },
      { divider: true },
      { label: 'Save', shortcut: 'Ctrl+S', action: () => window.dispatchEvent(new Event('global-save-trigger')) },
      { label: 'Save All', shortcut: 'Ctrl+K S', action: () => window.dispatchEvent(new Event('global-save-trigger')) },
      { divider: true },
      { label: 'Close Editor', shortcut: 'Ctrl+W', action: () => window.dispatchEvent(new Event('global-close-editor')) },
      { label: 'Exit', shortcut: 'Alt+F4', action: () => { if(onExit) onExit(); } },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
      { divider: true },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => navigator.clipboard.readText().then(t => document.execCommand('insertText', false, t)) },
    ],
    View: [
      { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: () => { if (toggleSidebar) toggleSidebar(); } },
      { label: 'Secondary Sidebar', shortcut: '', action: () => { if (toggleSecondarySidebar) toggleSecondarySidebar(); } },
    ],
    Terminal: [
      { label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => { if (toggleTerminal) toggleTerminal(); } },
    ]
  };

  return (
    <div className="flex items-center h-full select-none font-sans text-[13px] text-zinc-300 relative z-50">
      {Object.keys(menus).map((menuName) => (
        <div 
          key={menuName}
          className="relative h-full flex items-center"
          onMouseEnter={() => activeMenu && setActiveMenu(menuName)}
          onClick={() => setActiveMenu(activeMenu === menuName ? null : menuName)}
        >
          <div className={`px-2 py-1 mx-0.5 rounded cursor-pointer transition-colors ${activeMenu === menuName ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50 hover:text-white'}`}>
            {menuName}
          </div>

          <AnimatePresence>
            {activeMenu === menuName && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.1 }}
                className="absolute top-8 left-0 min-w-60 bg-[#18181b] border border-zinc-700 rounded-md shadow-2xl py-1 z-50 flex flex-col"
              >
                {menus[menuName].map((item, idx) => item.divider ? (
                  <div key={idx} className="h-px w-full bg-zinc-700 my-1" />
                ) : (
                  <div 
                    key={idx} onClick={() => { item.action(); setActiveMenu(null); }}
                    className="w-full px-6 py-1.5 flex justify-between items-center hover:bg-blue-600 hover:text-white cursor-pointer group"
                  >
                    <span>{item.label}</span>
                    <span className="text-zinc-500 group-hover:text-blue-200 text-[11px]">{item.shortcut}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}