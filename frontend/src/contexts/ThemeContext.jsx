/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();
export function useTheme() { return useContext(ThemeContext); }

// Helper to convert hex to rgba for the glowing translucent borders
const hexToRgba = (hex, alpha) => {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function ThemeProvider({ children }) {
  const [activeTheme, setActiveTheme] = useState('colab-default');
  const [activeColor, setActiveColor] = useState('#c084fc');
  const [secondaryColor, setSecondaryColor] = useState('#f472b6');
  const [activeCursor, setActiveCursor] = useState('pixel');

  useEffect(() => {
    const root = document.documentElement;
    
    // 1. Inject Colors & Dynamic Opacity Colors
    root.style.setProperty('--theme-primary', activeColor);
    root.style.setProperty('--theme-secondary', secondaryColor);
    root.style.setProperty('--theme-primary-20', hexToRgba(activeColor, 0.2));

    // 2. Inject Contextual Cursors
    let cDefault = 'default', cPointer = 'pointer', cText = 'text', cGrab = 'grab';
    
    if (activeCursor === 'pixel') {
      const svgDefault = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'><path fill='${activeColor}' stroke='black' stroke-width='1.5' d='M5.5 3L16 13.5l-4.5 1.5 3.5 5.5-2.5 1.5-3.5-5.5L4 21V3z'/></svg>`;
      const svgPointer = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'><path fill='${secondaryColor}' stroke='black' stroke-width='1.5' d='M10 2v4h-2v4h-2v10h14v-10h-2v-4h-2V2z'/></svg>`;
      cDefault = `url("data:image/svg+xml,${encodeURIComponent(svgDefault)}"), auto`;
      cPointer = `url("data:image/svg+xml,${encodeURIComponent(svgPointer)}"), pointer`;
    } else if (activeCursor === 'crosshair') { 
      cDefault = 'crosshair'; cPointer = 'crosshair'; cText = 'crosshair'; cGrab = 'crosshair';
    } else if (activeCursor === 'terminal') { 
      cDefault = 'cell'; cPointer = 'cell'; cText = 'text'; cGrab = 'cell'; 
    }

    root.style.setProperty('--cursor-default', cDefault);
    root.style.setProperty('--cursor-pointer', cPointer);
    root.style.setProperty('--cursor-text', cText);
    root.style.setProperty('--cursor-grab', cGrab);

    // 3. Inject Structural Physics
    if (activeTheme === 'matrix') {
       root.style.setProperty('--bg-base', '#000000');
       root.style.setProperty('--bg-panel-heavy', 'rgba(0,0,0,0.9)');
       root.style.setProperty('--bg-panel-light', 'rgba(0,0,0,0.8)');
       root.style.setProperty('--text-main', activeColor);
       root.style.setProperty('--text-muted', 'rgba(255,255,255,0.4)');
       root.style.setProperty('--border-style', `1px solid ${activeColor}`);
       root.style.setProperty('--radius-card', '0px');
       root.style.setProperty('--radius-btn', '0px');
       root.style.setProperty('--panel-shadow', `0 0 15px ${hexToRgba(activeColor, 0.3)}`);
       root.style.setProperty('--font-main', '"Share Tech Mono", monospace');
       root.style.setProperty('--text-transform', 'uppercase');
       root.style.setProperty('--grid-opacity', '0.05');
       root.style.setProperty('--glow-opacity', '0.1');
    } else if (activeTheme === 'mac') {
       root.style.setProperty('--bg-base', '#f4f4f5');
       root.style.setProperty('--bg-panel-heavy', 'rgba(255,255,255,0.9)');
       root.style.setProperty('--bg-panel-light', '#ffffff');
       root.style.setProperty('--text-main', '#18181b');
       root.style.setProperty('--text-muted', '#71717a');
       root.style.setProperty('--border-style', `1px solid rgba(0,0,0,0.1)`);
       root.style.setProperty('--radius-card', '12px');
       root.style.setProperty('--radius-btn', '8px');
       root.style.setProperty('--panel-shadow', `0 10px 30px rgba(0,0,0,0.05)`);
       root.style.setProperty('--font-main', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
       root.style.setProperty('--text-transform', 'none');
       root.style.setProperty('--grid-opacity', '0');
       root.style.setProperty('--glow-opacity', '0');
    } else if (activeTheme === 'pixel') {
       root.style.setProperty('--bg-base', '#18181b');
       root.style.setProperty('--bg-panel-heavy', '#18181b');
       root.style.setProperty('--bg-panel-light', '#18181b');
       root.style.setProperty('--text-main', '#ffffff');
       root.style.setProperty('--text-muted', '#a1a1aa');
       root.style.setProperty('--border-style', `4px solid ${activeColor}`);
       root.style.setProperty('--radius-card', '0px');
       root.style.setProperty('--radius-btn', '0px');
       root.style.setProperty('--panel-shadow', `8px 8px 0px ${activeColor}`);
       root.style.setProperty('--font-main', '"VT323", monospace');
       root.style.setProperty('--text-transform', 'uppercase');
       root.style.setProperty('--grid-opacity', '0.2');
       root.style.setProperty('--glow-opacity', '0');
    } else {
       root.style.setProperty('--bg-base', '#000000');
       root.style.setProperty('--bg-panel-heavy', 'rgba(0, 0, 0, 0.6)');
       root.style.setProperty('--bg-panel-light', 'rgba(0, 0, 0, 0.4)');
       root.style.setProperty('--text-main', '#ffffff');
       root.style.setProperty('--text-muted', '#a1a1aa');
       root.style.setProperty('--border-style', '1px solid #27272a');
       root.style.setProperty('--radius-card', '24px');
       root.style.setProperty('--radius-btn', '9999px');
       root.style.setProperty('--panel-shadow', 'none');
       root.style.setProperty('--font-main', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace');
       root.style.setProperty('--text-transform', 'none');
       root.style.setProperty('--grid-opacity', '0.1');
       root.style.setProperty('--glow-opacity', '0.1');
    }
  }, [activeTheme, activeColor, secondaryColor, activeCursor]);

  return (
    <ThemeContext.Provider value={{
      activeTheme, setActiveTheme, activeColor, setActiveColor,
      secondaryColor, setSecondaryColor, activeCursor, setActiveCursor
    }}>
      {children}
    </ThemeContext.Provider>
  );
}