import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion'; 
import Splash from './components/intro/Splash';
import Landing from './components/info lander/Landing';
import Auth from './components/Authentication/Auth'; 
import Dashboard from './components/dashboard/core/DashboardShell'; 
import IDEShell from './components/ide/IDEShell'; 
import { ThemeProvider } from './contexts/ThemeContext';
import styles from './App.module.css';
import { Toaster } from 'react-hot-toast';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [phase, setPhase] = useState('loading'); 
  const [authMode, setAuthMode] = useState('login'); 
  
  const [activeHash, setActiveHash] = useState(null);
  const [isWorkspaceHost, setIsWorkspaceHost] = useState(false);
  const [activePath, setActivePath] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setPhase('dashboard');
      } else {
        setPhase((prev) => prev === 'dashboard' ? 'landing' : 'intro');
      }
    });
    return () => unsubscribe();
  }, []);

  const navigateToAuth = (mode) => {
    setAuthMode(mode);
    setPhase('auth');
  };

  if (phase === 'loading') {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center text-[#c084fc] font-mono animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#c084fc] border-t-transparent rounded-full animate-spin"></div>
          <p>MOUNTING CORE...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Toaster position="top-center" />
      <div className={styles.appContainer}>
        <AnimatePresence>
          {phase === 'intro' && <Splash onComplete={() => setPhase('landing')} />}
        </AnimatePresence>
        
        {phase === 'landing' && (
          <Landing onLogin={() => navigateToAuth('login')} onRegister={() => navigateToAuth('register')} onStart={() => navigateToAuth('register')} />
        )}
        
        {phase === 'auth' && (
          <Auth initialMode={authMode} onBack={() => setPhase('landing')} onSuccess={() => setPhase('dashboard')} />
        )}
        
        {phase === 'dashboard' && (
          <Dashboard 
            onLogout={() => {
               auth.signOut();
               setPhase('landing');
            }} 
            onOpenIde={(hash, isHost, localPath) => {
              setActiveHash(hash); 
              setIsWorkspaceHost(isHost);
              setActivePath(localPath);
              setPhase('ide');     
            }} 
          />
        )}

        {phase === 'ide' && (
          <IDEShell 
            roomHash={activeHash} 
            isHost={isWorkspaceHost} 
            initialPath={activePath} 
            onExit={() => setPhase('dashboard')} 
          />
        )}
      </div>
    </ThemeProvider>
  );
}
export default App;