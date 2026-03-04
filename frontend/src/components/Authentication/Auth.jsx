import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowLeft, Shield, Github, KeyRound, User, Calendar, ArrowRight } from 'lucide-react';
import { auth, db } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import toast from 'react-hot-toast';

export default function Auth({ initialMode, onBack, onSuccess }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isProcessing, setIsProcessing] = useState(false);

  const [step, setStep] = useState(1); 
  const [email, setEmail] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Profile specific
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');

  const handleOAuth = async (Provider) => {
    setIsProcessing(true);
    try {
      const result = await signInWithPopup(auth, new Provider());
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        username: result.user.displayName || `User#${Math.floor(Math.random() * 10000)}`,
        photoURL: result.user.photoURL || '',
        lastLogin: Date.now()
      }, { merge: true });

      toast.success("Authentication Successful!");
      onSuccess(); 
    } catch (err) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        toast.error("Email already linked to another provider.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message.replace('Firebase: ', ''));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter email and password.");
    if (password.length < 8 || password.length > 16) return toast.error("Password must be 8-16 characters.");
    
    setIsProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Identity Verified.");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Invalid credentials.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      return toast.error("Please enter a valid email address first.", { icon: '📧' });
    }
    
    setIsProcessing(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset link sent to your email!", { icon: '✅' });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        toast.error("No account found with this email.");
      } else {
        toast.error("Failed to send reset email.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return toast.error("Enter a valid email.");
    setIsProcessing(true);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);

    try {
      const res = await fetch('https://colab-matchmaker-v2.onrender.com/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'otp', email: email, otp: otp })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success("Verification code sent to email!");
        setStep(2);
      } else {
        throw new Error("Failed to send email");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not send OTP.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (enteredOtp === generatedOtp) {
      toast.success("Email Verified!");
      setStep(3);
    } else {
      toast.error("Invalid OTP Code.");
    }
  };

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error("Passwords do not match.");
    
    if (password.length < 8 || password.length > 16) {
      return toast.error("Password must be exactly 8 to 16 characters long.");
    }
    
    setIsProcessing(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("Security Core Generated.");
      setStep(4);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') toast.error("Email is already registered.");
      else toast.error("Failed to create account.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeProfile = async (e) => {
    e.preventDefault();
    
    // 🔴 ENFORCED MANDATORY PROFILE FIELDS
    if (!username.trim()) return toast.error("Network Designation (Username) is required.");
    if (!dob) return toast.error("Date of Origin is required.");

    setIsProcessing(true);
    const finalUsername = username.trim();
    
    try {
      await updateProfile(auth.currentUser, { displayName: finalUsername });
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        email: email,
        username: finalUsername,
        dob: dob,
        createdAt: Date.now()
      });

      toast.success(`Welcome to Co-Lab, ${finalUsername}!`);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09090b] flex items-center justify-center relative overflow-hidden font-mono p-4">
      <div className="absolute inset-0 pointer-events-none z-0 bg-size-[4rem_4rem] bg-[linear-gradient(to_right,#c084fc10_1px,transparent_1px),linear-gradient(to_bottom,#c084fc10_1px,transparent_1px)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-[#c084fc] rounded-full blur-[150px] opacity-10 pointer-events-none z-0" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10 flex flex-col gap-5 overflow-hidden"
      >
        <button onClick={onBack} className="absolute top-6 left-6 text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={20} /></button>

        <div className="text-center mt-6 mb-2">
          <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#c084fc] to-[#f472b6] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(192,132,252,0.3)] mb-4">
            <Shield size={32} className="text-black" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">{isLogin ? 'Access Core' : 'Register Core'}</h2>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-2">
            {isLogin ? "Authenticate to enter" : `Step ${step} of 4`}
          </p>
        </div>

        {isLogin ? (
          <>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleOAuth(GoogleAuthProvider)} disabled={isProcessing} className="w-full py-3 px-4 bg-white hover:bg-zinc-200 text-black font-black uppercase text-xs tracking-widest rounded-lg flex items-center justify-center gap-3 transition-colors">
                Continue with Google
              </button>
              <button onClick={() => handleOAuth(GithubAuthProvider)} disabled={isProcessing} className="w-full py-3 px-4 bg-[#24292e] hover:bg-[#2f363d] text-white font-black uppercase text-xs tracking-widest rounded-lg flex items-center justify-center gap-3 transition-colors">
                <Github size={16} /> Continue with GitHub
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-zinc-600 uppercase tracking-widest my-1">
              <div className="h-px bg-zinc-800 flex-1" /> OR <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input required type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc] transition-colors" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  required type="password" placeholder="Password (8-16 chars)" 
                  value={password} onChange={e => setPassword(e.target.value)} 
                  minLength={8} maxLength={16} 
                  className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc] transition-colors" 
                />
              </div>

              <div className="flex justify-end -mt-2">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  disabled={isProcessing}
                  className="text-[10px] font-bold text-zinc-500 hover:text-[#f472b6] transition-colors uppercase tracking-widest"
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" disabled={isProcessing} className="w-full py-3 mt-1 bg-linear-to-r from-[#c084fc] to-[#f472b6] text-black font-black uppercase text-xs tracking-widest rounded-lg hover:scale-[1.02] transition-transform">
                {isProcessing ? "Verifying..." : "Initialize Session"}
              </button>
            </form>
          </>
        ) : (
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form key="step1" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} onSubmit={handleSendOTP} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input required type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc]" />
                </div>
                <button type="submit" disabled={isProcessing} className="w-full py-3 mt-2 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg">
                  {isProcessing ? "Sending..." : "Send OTP"}
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form key="step2" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
                <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest">Enter the 6-digit code sent to<br/><span className="text-[#c084fc]">{email}</span></p>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input required type="text" maxLength="6" placeholder="000000" value={enteredOtp} onChange={e => setEnteredOtp(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-center text-xl tracking-[1em] text-[#00ff41] font-bold outline-none focus:border-[#00ff41]" />
                </div>
                <button type="submit" className="w-full py-3 mt-2 bg-[#00ff41] text-black font-black uppercase text-xs tracking-widest rounded-lg">Verify Code</button>
                <button type="button" onClick={() => setStep(1)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest">Wrong Email? Go Back</button>
              </motion.form>
            )}

            {step === 3 && (
              <motion.form key="step3" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} onSubmit={handleCreatePassword} className="flex flex-col gap-4">
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                     required type="password" placeholder="Create Password (8-16 chars)" 
                     value={password} onChange={e => setPassword(e.target.value)} 
                     minLength={8} maxLength={16} 
                     className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc]" 
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                     required type="password" placeholder="Confirm Password" 
                     value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} 
                     minLength={8} maxLength={16} 
                     className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc]" 
                  />
                </div>
                <button type="submit" disabled={isProcessing} className="w-full py-3 mt-2 bg-linear-to-r from-[#c084fc] to-[#f472b6] text-black font-black uppercase text-xs tracking-widest rounded-lg">
                  {isProcessing ? "Encrypting..." : "Create Account"}
                </button>
              </motion.form>
            )}

            {step === 4 && (
              <motion.form key="step4" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} onSubmit={handleFinalizeProfile} className="flex flex-col gap-4">
                
                {/* 🔴 ENFORCED REQUIREMENT FOR USERNAME AND DOB */}
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                     required type="text" placeholder="Network Designation (Username)" 
                     value={username} onChange={e => setUsername(e.target.value)} 
                     className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-[#c084fc]" 
                  />
                </div>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                     required type="date" placeholder="Date of Birth" 
                     value={dob} onChange={e => setDob(e.target.value)} 
                     className="w-full bg-black border border-zinc-800 rounded-lg py-3 pl-12 pr-4 text-sm text-zinc-400 outline-none focus:border-[#c084fc] cursor-text" 
                  />
                </div>

                <button type="submit" disabled={isProcessing} className="w-full py-3 mt-2 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]">
                  {isProcessing ? "Saving..." : "Enter Dashboard"} <ArrowRight size={16}/>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        )}

        <div className="text-center mt-4">
          <button onClick={() => { setIsLogin(!isLogin); setStep(1); }} className="text-[10px] font-bold text-zinc-500 hover:text-[#c084fc] uppercase tracking-widest transition-colors">
            {isLogin ? "Need an identity? Register here." : "Already have an identity? Login here."}
          </button>
        </div>

      </motion.div>
    </div>
  );
}