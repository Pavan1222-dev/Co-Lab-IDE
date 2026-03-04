import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Palette, MousePointer2, Crosshair, TerminalSquare, Sparkles, User, Save, Calendar, Upload } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext'; 
import { auth, db } from '../../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore'; 
import { updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';
import styles from './SettingsDashboard.module.css';

export default function SettingsDashboard() {
  const { activeTheme, setActiveTheme, activeColor, setActiveColor, setSecondaryColor, activeCursor, setActiveCursor } = useTheme();

  const [profile, setProfile] = useState({ username: '', dob: '', photoURL: '' });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile({
          username: data.username || '',
          dob: data.dob || '',
          photoURL: data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username || 'default'}`
        });
      }
    };
    fetchUserData();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) { 
        return toast.error("Image too large! Please select an image under 1MB.");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, photoURL: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSaving(true);
    
    try {
      const finalAvatar = profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username || 'default'}`;
      const isBase64 = finalAvatar.startsWith('data:image');

      const authUpdateData = { displayName: profile.username };
      if (!isBase64) authUpdateData.photoURL = finalAvatar; 
      
      await updateProfile(auth.currentUser, authUpdateData);

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        username: profile.username,
        dob: profile.dob,
        photoURL: finalAvatar 
      }, { merge: true });

      toast.success("Profile Synchronized across network.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const colors = [
    { id: 'purple', hex: '#c084fc', sec: '#f472b6', shadow: 'rgba(192,132,252,0.5)' },
    { id: 'matrix', hex: '#00ff41', sec: '#008f11', shadow: 'rgba(0,255,65,0.5)' },
    { id: 'lemon', hex: '#DFFF00', sec: '#fbbf24', shadow: 'rgba(223,255,0,0.5)' },
    { id: 'cyan', hex: '#06b6d4', sec: '#3b82f6', shadow: 'rgba(6,182,212,0.5)' },
    { id: 'rose', hex: '#f43f5e', sec: '#fda4af', shadow: 'rgba(244,63,94,0.5)' },
    { id: 'orange', hex: '#f97316', sec: '#fb923c', shadow: 'rgba(249,115,22,0.5)' },
  ];

  // 🔴 FIXED: Restored the missing color change function
  const handleColorChange = (hex, sec) => {
    setActiveColor(hex);
    setSecondaryColor(sec);
  };

  return (
    <div className={styles.settingsContainer}>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2">System <span className="text-transparent bg-clip-text bg-linear-to-r from-(--theme-primary) to-(--theme-secondary)">Preferences</span></h1>
        <p className="text-(--text-muted)">Configure your IDE workspace aesthetics and identity.</p>
      </div>

      <section className="mb-12">
        <h2 className={styles.sectionHeader}><User size={20} /> Network Identity</h2>
        <div className="bg-black/40 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row gap-10 items-start">
          
          <div className="flex flex-col items-center gap-4">
            <div 
              onClick={() => fileInputRef.current.click()}
              className="w-32 h-32 rounded-2xl bg-zinc-900 border-2 border-zinc-800 overflow-hidden relative shadow-[0_0_30px_rgba(0,0,0,0.5)] cursor-pointer group"
            >
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover transition-opacity group-hover:opacity-50" />
              ) : (
                <User size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-700" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={24} className="text-white" />
              </div>
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest text-center cursor-pointer hover:text-(--theme-primary)" onClick={() => fileInputRef.current.click()}>
              Click to upload<br/>custom photo
            </span>
          </div>

          <form onSubmit={handleProfileUpdate} className="flex-1 flex flex-col gap-6 w-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Network Designation (Username)</label>
                <input 
                  type="text" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})}
                  className="bg-black border border-zinc-800 rounded-lg py-4 px-4 text-white outline-none focus:border-(--theme-primary) transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Date of Origin (DOB)</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input 
                    type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white outline-none focus:border-(--theme-primary) transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button disabled={isSaving} type="submit" className="bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50">
                {isSaving ? "Syncing..." : <><Save size={16} /> Save Identity</>}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="mb-12">
        <h2 className={styles.sectionHeader}><Monitor size={20} /> Interface Themes</h2>
        <div className={styles.gridThemes}>
          <div onClick={() => setActiveTheme('colab-default')} className={`${styles.themeCard} ${activeTheme === 'colab-default' ? styles.themeCardActive : ''}`}>
            <div className={styles.themePreview} style={{ background: '#000000', borderRadius: '24px', border: '1px solid #27272a' }}>
               <div className={styles.previewHeader} style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid #27272a' }}><div className="w-2 h-2 rounded-full bg-zinc-700"/><div className="w-2 h-2 rounded-full bg-zinc-700"/></div>
               <div className={styles.previewBody}><div className={styles.previewLine} style={{ background: 'var(--theme-primary)' }}/><div className={styles.previewLine} style={{ background: 'var(--theme-secondary)', width: '50%' }}/></div>
            </div>
            <div><h3 className={styles.themeTitle}>Co-Lab Default</h3><p className={styles.themeDesc}>The original glowing glassmorphism aesthetic.</p></div>
          </div>

          <div onClick={() => setActiveTheme('matrix')} className={`${styles.themeCard} ${activeTheme === 'matrix' ? styles.themeCardActive : ''}`}>
            <div className={styles.themePreview} style={{ background: '#000000', borderColor: 'var(--theme-primary)', borderRadius: '0px' }}>
               <div className={styles.previewHeader} style={{ background: '#000000', borderBottomColor: 'var(--theme-primary)' }}><div className="text-[8px] text-(--theme-primary) font-mono" style={{textTransform:'none'}}>root@sys:~#</div></div>
               <div className={styles.previewBody}><div className={styles.previewLine} style={{ background: 'var(--theme-primary)', borderRadius:'0px' }}/><div className={styles.previewLine} style={{ background: 'var(--theme-secondary)', width: '60%', borderRadius:'0px' }}/></div>
            </div>
            <div><h3 className={styles.themeTitle}>Hacker Matrix</h3><p className={styles.themeDesc}>Absolute black and aggressive neon terminals.</p></div>
          </div>

          <div onClick={() => setActiveTheme('mac')} className={`${styles.themeCard} ${activeTheme === 'mac' ? styles.themeCardActive : ''}`}>
            <div className={styles.themePreview} style={{ background: '#f4f4f5', borderColor: '#e4e4e7', borderRadius: '8px' }}>
               <div className={styles.previewHeader} style={{ background: '#ffffff', borderBottomColor: '#e4e4e7' }}><div className="w-2 h-2 rounded-full bg-red-400"/><div className="w-2 h-2 rounded-full bg-yellow-400"/><div className="w-2 h-2 rounded-full bg-green-400"/></div>
               <div className={styles.previewBody}><div className={styles.previewLine} style={{ background: '#3b82f6' }}/><div className={styles.previewLine} style={{ background: '#9ca3af', width: '40%' }}/></div>
            </div>
            <div><h3 className={styles.themeTitle} style={{ color: activeTheme === 'mac' ? 'var(--theme-primary)' : 'var(--text-main)' }}>macOS Clean</h3><p className={styles.themeDesc}>A sleek, light-mode minimalist environment.</p></div>
          </div>

          <div onClick={() => setActiveTheme('pixel')} className={`${styles.themeCard} ${activeTheme === 'pixel' ? styles.themeCardActive : ''}`}>
            <div className={styles.themePreview} style={{ background: '#18181b', border: '3px solid var(--theme-primary)', borderRadius: '0px' }}>
               <div className={styles.previewHeader} style={{ borderBottom: '3px solid var(--theme-primary)' }}><div className="w-2 h-2 bg-zinc-500"/></div>
               <div className={styles.previewBody}><div className={styles.previewLine} style={{ background: 'var(--theme-secondary)', borderRadius: 0 }}/></div>
            </div>
            <div><h3 className={styles.themeTitle}>Retro Pixel</h3><p className={styles.themeDesc}>Chunky borders, dashed lines, and arcade vibes.</p></div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className={styles.sectionHeader}><Palette size={20} /> Accent Color Injection</h2>
        <div className={styles.colorGrid}>
          {colors.map(color => (
            <div key={color.id} onClick={() => handleColorChange(color.hex, color.sec)} className={`${styles.colorSwatch} ${activeColor === color.hex ? styles.colorSwatchActive : ''}`} style={{ backgroundColor: color.hex, boxShadow: activeColor === color.hex ? `0 0 20px ${color.shadow}` : 'none' }} />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className={styles.sectionHeader}><MousePointer2 size={20} /> Pointer Mechanics</h2>
        <div className={styles.cursorGrid}>
          <div onClick={() => setActiveCursor('pixel')} className={`${styles.cursorCard} ${activeCursor === 'pixel' ? styles.cursorCardActive : ''}`}><div className={styles.cursorIconWrapper}><MousePointer2 size={24} className={activeCursor==='pixel'?"fill-(--theme-primary) text-black":""} /></div><span className={styles.cursorName}>Retro Pixel</span></div>
          <div onClick={() => setActiveCursor('crosshair')} className={`${styles.cursorCard} ${activeCursor === 'crosshair' ? styles.cursorCardActive : ''}`}><div className={styles.cursorIconWrapper}><Crosshair size={24} /></div><span className={styles.cursorName}>Crosshair</span></div>
          <div onClick={() => setActiveCursor('terminal')} className={`${styles.cursorCard} ${activeCursor === 'terminal' ? styles.cursorCardActive : ''}`}><div className={styles.cursorIconWrapper}><TerminalSquare size={24} /></div><span className={styles.cursorName}>Terminal Block</span></div>
          <div onClick={() => setActiveCursor('default')} className={`${styles.cursorCard} ${activeCursor === 'default' ? styles.cursorCardActive : ''}`}><div className={styles.cursorIconWrapper}><Sparkles size={24} /></div><span className={styles.cursorName}>System Default</span></div>
        </div>
      </section>
    </div>
  );
}