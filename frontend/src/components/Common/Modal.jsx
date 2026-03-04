import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, initialWidth = 450, initialHeight = 400 }) {
  // Reference required by react-draggable to bypass React 18 strict mode crashes
  const nodeRef = useRef(null);

  if (!isOpen) return null;

  return (
    <Draggable handle=".modal-header" bounds="parent" nodeRef={nodeRef}>
      <div 
        ref={nodeRef} 
        className="flex flex-col bg-[#18181b] border border-zinc-700 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
        style={{ 
          position: 'absolute', 
          top: '100px', 
          left: 'calc(50% - 225px)', 
          zIndex: 9999,
          width: initialWidth,
          height: initialHeight,
          minWidth: '350px',
          minHeight: '250px',
          maxWidth: '800px',
          maxHeight: '600px',
          resize: 'both',       // NATIVE CSS RESIZING (No extra libraries needed!)
          overflow: 'hidden'    // Required for native resize to work
        }}
      >
        {/* Header (Drag Handle) */}
        <div className="modal-header flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 cursor-move text-zinc-300 select-none shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
          
          {/* onMouseDown preventDefault stops the drag event from overriding the click event */}
          <button 
            onClick={onClose} 
            onMouseDown={(e) => e.stopPropagation()} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </Draggable>
  );
}