import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Spline from '@splinetool/react-spline';
import { 
  Zap, CheckCircle, Github, Layout, Server, 
  ChevronRight, ChevronLeft, ArrowRight, BookOpen, 
  Activity, Globe, Code, Shield, Youtube, HardDrive, WifiOff,
  Sun, Moon, Terminal, Twitter, Linkedin, Mail, Slack, Trello, MessageSquare, Cpu
} from "lucide-react";
import styles from "./Landing.module.css"; 

function Typewriter({ words }) {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);

  useEffect(() => {
    const current = loopNum % words.length;
    const fullText = words[current];
    const typingSpeed = isDeleting ? 40 : 100; 

    let timer = setTimeout(() => {
      setText(fullText.substring(0, text.length + (isDeleting ? -1 : 1)));

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 2000); 
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, words]);

  return (
    <span>
      {text}
      <span className={styles.cursorBlink}>_</span>
    </span>
  );
}

export default function Landing({ onLogin, onRegister, onStart }) {
  const containerRef = useRef(null);
  const [isDark, setIsDark] = useState(true);
  const [logoReady, setLogoReady] = useState(false);

  const scrollToDemo = () => {
    const demoSection = document.getElementById("demo-section");
    if (demoSection) demoSection.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={containerRef} className={`${styles.mainContainer} ${isDark ? styles.bgDark + ' ' + styles.textMainDark : styles.bgLight + ' ' + styles.textMainLight}`}>
      
      <motion.div
        initial={{ top: "50%", left: "50%", x: "-50%", y: "-50%", scale: 0.7 }}
        animate={
          logoReady 
            ? { top: "2px", left: "14px", x: "-20%", y: "-35%", scale: 0.7 } 
            : { top: "30%", left: "30%", x: "-30%", y: "-30%", scale: 1 }
        }
        style={{ originX: logoReady ? 0 : 0.5, originY: logoReady ? 0 : 0.5 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} 
        className={styles.logoWrapper}
      >
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: logoReady ? 1 : 0 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className={`${styles.logoGlow} ${isDark ? styles.logoGlowDark : styles.logoGlowLight}`} 
        />
        <Spline 
          scene="/logo.splinecode" 
          onLoad={() => setLogoReady(true)} 
        />
      </motion.div>

       <nav className={`${styles.navbar} ${isDark ? styles.navbarDark : styles.navbarLight}`}>
        <div className={styles.navLinks}>
          <button onClick={() => setIsDark(!isDark)} className={styles.themeToggle}>
            {isDark ? <Sun size={20} className="text-[#c084fc] hover:text-white" /> : <Moon size={20} className="text-[#c084fc] hover:text-black" />}
          </button>
          
          <button className={`${styles.navLink} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Features</button>
          <button className={`${styles.navLink} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Docs</button>
          <button onClick={onLogin} className={`${styles.navLink} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Login</button>
          <button onClick={onRegister} className={`${styles.navLink} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Register</button>
          
          <button onClick={onRegister} className={styles.launchBtn}>
            <span className="flex items-center gap-2"><Terminal size={16}/> Launch IDE</span>
          </button>
        </div>
      </nav>

      <HeroSection onLogin={onLogin} onDemoClick={scrollToDemo} isDark={isDark}/>
      <FeaturesSection id="features" isDark={isDark}/>
      <DocsSection id="docs" isDark={isDark}/>
      <DemoSection id="demo-section" isDark={isDark}/>
      <FooterSection isDark={isDark}/>
    </div>
  );
}

function HeroSection({ onLogin, onDemoClick, isDark }) {
  return (
    <section className={`${styles.heroSection} ${isDark ? styles.bgDark : styles.bgLight}`}>
      <main className={styles.heroMain}>
        
        <div className={styles.heroText}>
          <div className={styles.badge}>
            <span className={styles.badgeDotWrap}>
              <span className={styles.badgeDotPing}></span>
              <span className={styles.badgeDot}></span>
            </span>
            <span className={styles.badgeText}>Local-First Architecture</span>
          </div>

          <h1 className={styles.heroTitle}>
            CODE ON <br />
            <span className={styles.gradientText}>
              <Typewriter words={["AUTOPILOT", "GHOST FILES", "LOCAL-FIRST", "P2P SYNC"]} />
            </span>
          </h1>
          
          <p className={`${styles.heroDesc} ${isDark ? styles.textMutedDark : styles.textMutedLight}`}>
            Stop waiting for cloud servers. Utilize <code className={styles.codeHighlight}>Ghost Files</code> to navigate massive repositories with zero latency.
          </p>
          
          <div className={styles.btnGroup}>
            <button onClick={onLogin} className={styles.primaryBtn}>
              Initialize <ArrowRight size={18} />
            </button>
            <button onClick={onDemoClick} className={isDark ? styles.secondaryBtnDark : styles.secondaryBtnLight}>
              View System Demo
            </button>
          </div>
        </div>

        <div className={styles.heroVisual}>
           <div className={styles.globeWrapper}>
             {/* 🔴 RESTORED LARGE INTERNAL SIZES (will be shrunk by CSS transform) */}
             <OrbitingIcon icon={<HardDrive size={40}/>} radius={380} duration={30} angle={0} isDark={isDark} />
             <OrbitingIcon icon={<WifiOff size={40}/>} radius={380} duration={30} angle={45} isDark={isDark}/>
             <OrbitingIcon icon={<Server size={40}/>} radius={380} duration={30} angle={90} isDark={isDark}/>
             <OrbitingIcon icon={<Activity size={40}/>} radius={380} duration={30} angle={135} isDark={isDark}/>
             <OrbitingIcon icon={<Shield size={40}/>} radius={380} duration={30} angle={180} isDark={isDark}/>
             <OrbitingIcon icon={<Zap size={40}/>} radius={380} duration={30} angle={225} isDark={isDark}/>
             <OrbitingIcon icon={<Globe size={40}/>} radius={380} duration={30} angle={270} isDark={isDark}/>
             <OrbitingIcon icon={<Cpu size={40}/>} radius={380} duration={30} angle={315} isDark={isDark}/>
             
             {/* 🔴 NO TAILWIND SCALE HERE - Handled completely by .globeWrapper */}
             <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-auto z-10">
                <Spline scene="/globe.splinecode" />
             </div>
           </div>
           
           <div className={`${styles.floatingCode} ${isDark ? styles.floatingCodeDark : styles.floatingCodeLight}`}>
              <div className={styles.floatingCodeHeader}>
                  <span className={styles.floatingCodeTitle}>LOCAL STATE</span>
                  <div className={styles.macButtons}>
                    <div className={`${styles.macBtn} ${styles.macBtnRed}`}/>
                    <div className={`${styles.macBtn} ${styles.macBtnYellow}`}/>
                    <div className={`${styles.macBtn} ${styles.macBtnGreen}`}/>
                  </div>
              </div>
              <div className={styles.codeLines}>
                  <div className={styles.codeLine1} />
                  <div className={styles.codeLine2} />
                  <div className={styles.codeLine3} />
              </div>
           </div>
        </div>
      </main>

      <div className={`${styles.tickerContainer} ${isDark ? styles.tickerContainerDark : styles.tickerContainerLight}`}>
        <motion.div className={styles.tickerTrack} animate={{ x: [0, -1000] }} transition={{ repeat: Infinity, ease: "linear", duration: 20 }}>
           {[1,2,3,4].map((i) => (
             <div key={i} className={styles.tickerGroup}>
                <TickerItem text="🚀 Pavan synced: 'feat: Ghost File Protocol'" time="2ms ago" isDark={isDark}/>
                <TickerItem text="✅ Srinadh mounted: 'local-SSD cluster'" time="5ms ago" isDark={isDark}/>
                <TickerItem text="⚡ Node connected via P2P" time="Just now" color="text-[#f472b6]" isDark={isDark}/>
                <TickerItem text="🔒 Local State Saved" time="10ms ago" color="text-[#c084fc]" isDark={isDark}/>
             </div>
           ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection({ id, isDark }) {
  const features = [
    { title: "Ghost Files", desc: "Maps project metadata locally. Navigate millions of lines with O(1) time complexity.", icon: <Zap /> },
    { title: "Offline First", desc: "No internet? No problem. Code completely offline and sync when connected.", icon: <WifiOff /> },
    { title: "Peer-to-Peer", desc: "Connect directly to your team's machines. No cloud bottlenecks.", icon: <Activity /> },
    { title: "Secure by Design", desc: "Your code stays on your physical SSD. Only Deltas are transmitted.", icon: <Shield /> },
    { title: "Local Processing", desc: "Leverage your local CPU power instead of waiting for remote servers.", icon: <HardDrive /> },
    { title: "Multi-Environment", desc: "Manage multiple frontend and backend environments effortlessly.", icon: <Globe /> },
  ];

  return (
    <section id={id} className={`${styles.featuresSection} ${isDark ? styles.bgAltDark : styles.bgAltLight}`}>
      <div className={styles.sectionContent}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Engineered for <span className={styles.titleHighlight}>Speed</span></h2>
          <p className={isDark ? styles.textMutedDark : styles.textMutedLight}>Everything you need for an elite local-first workflow.</p>
        </div>
        
        <div className={styles.featuresGrid}>
          {features.map((f, idx) => (
             <div key={idx} className={`${styles.featureCard} ${isDark ? styles.cardDark : styles.cardLight}`}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureTextContent}>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <p className={`${styles.featureDesc} ${isDark ? styles.textMutedDark : styles.textMutedLight}`}>{f.desc}</p>
                </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DocsSection({ id, isDark }) {
  const [pageIndex, setPageIndex] = useState(0);
  const pages = [
    { title: "Core Initialization", subtitle: "Setting up Co-Lab IDE", content: `1. Clone the Architecture:\n   git clone https://github.com/Pavan/co-lab-ide.git\n\n2. Install Core Dependencies:\n   npm install\n\n3. Initialize Local Server:\n   npm run dev:local\n\n   This mounts the Ghost File Protocol directly to your SSD.` },
    { title: "Peer Sync Setup", subtitle: "Connecting Nodes", content: `1. Generate Node Key:\n   Run 'colab keygen' in the terminal.\n\n2. Connect to Peer:\n   Paste the peer's Node Key into the connection manager.\n\n3. Sync Deltas:\n   The system will automatically resolve merge conflicts locally before P2P transmission.` }
  ];

  return (
    <section id={id} className={`${styles.docsSection} ${isDark ? styles.bgDark : styles.bgLight}`}>
        <div className={styles.sectionHeader}>
          <div className="flex justify-center mb-4"><BookOpen size={40} className={styles.titleHighlight} /></div>
          <h2 className={styles.sectionTitle}>Protocol Documentation</h2>
        </div>
        
        <div className={styles.docsBook}>
            <button onClick={() => setPageIndex((prev) => (prev - 1 + pages.length) % pages.length)} className={`${styles.navArrow} ${isDark ? styles.navArrowDark : styles.navArrowLight}`}><ChevronLeft size={24} /></button>
            <div className={`${styles.pageWrapper} ${isDark ? styles.pageDark : styles.pageLight}`}>
                 <div className={styles.pageContent}>
                    <div className={styles.pageSubtitle}>{pages[pageIndex].subtitle}</div>
                    <h3 className={`${styles.pageTitle} ${isDark ? 'text-white' : 'text-zinc-900'}`}>{pages[pageIndex].title}</h3>
                    <pre className={`${styles.pageText} ${isDark ? styles.pageTextDark : styles.pageTextLight}`}>{pages[pageIndex].content}</pre>
                 </div>
            </div>
            <button onClick={() => setPageIndex((prev) => (prev + 1) % pages.length)} className={`${styles.navArrow} ${isDark ? styles.navArrowDark : styles.navArrowLight}`}><ChevronRight size={24} /></button>
        </div>
    </section>
  );
}

function DemoSection({ id, isDark }) {
    return (
        <section id={id} className={`${styles.demoSection} ${isDark ? styles.bgAltDark : styles.bgAltLight}`}>
            <div className={styles.demoContainer}>
                <div className="mb-10 flex flex-col items-center">
                    <div className={styles.demoIcon}><Youtube size={32} /></div>
                    <h2 className={styles.sectionTitle}>System <span className={styles.titleHighlight}>Operational</span></h2>
                </div>
                <div className={styles.videoWrapper}>
                    <video className={styles.videoIframe} src="/demo.mp4" autoPlay loop muted playsInline />
                </div>
            </div>
        </section>
    );
}

function FooterSection({ isDark }) {
    const icons = [Github, Twitter, Linkedin, Mail, MessageSquare, Globe, Code, Cpu];

    return (
        <section className={`${styles.footerSection} ${isDark ? styles.footerDark : styles.footerLight}`}>
            <div className={styles.footerGlow} />
            <div className={styles.footerGrid}>
                <div className="col-span-2">
                    <h1 className={styles.footerBrand}>CO-LAB <span className={styles.titleHighlight}>IDE.</span></h1>
                    <p className={isDark ? styles.textMutedDark : styles.textMutedLight}>Accelerating teamwork through local-first architecture. Engineered for high-speed development.</p>
                    
                    <div className={styles.socialGroup}>
                        {icons.map((Icon, index) => (
                            <div key={index} className={`${styles.socialIcon} ${isDark ? styles.socialIconDark : styles.socialIconLight}`}>
                                <Icon />
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h4 className={`${styles.footerColTitle} ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Architecture</h4>
                    <ul className={`${styles.footerList} ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <li className={styles.footerListItem}>Local-First</li>
                        <li className={styles.footerListItem}>Ghost Protocol</li>
                        <li className={styles.footerListItem}>Security Node</li>
                    </ul>
                </div>
                <div>
                    <h4 className={`${styles.footerColTitle} ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Resources</h4>
                    <ul className={`${styles.footerList} ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <li className={styles.footerListItem}>Documentation</li>
                        <li className={styles.footerListItem}>API Reference</li>
                        <li className={styles.footerListItem}>Community Forum</li>
                    </ul>
                </div>
            </div>
            <div className={`${styles.footerBottom} ${isDark ? styles.footerBottomDark : styles.footerBottomLight}`}>
                <p>© 2026 Co-Lab IDE.</p>
                <p>Designed with Spline & React</p>
            </div>
        </section>
    )
}

function OrbitingIcon({ icon, radius, duration, angle, isDark }) {
    return (
        <motion.div 
            className={`${styles.orbitIcon} ${isDark ? styles.orbitIconDark : styles.orbitIconLight}`} 
            initial={{ rotate: angle }} 
            animate={{ rotate: angle + 360 }} 
            transition={{ duration: duration, repeat: Infinity, ease: "linear" }} 
            style={{ 
                top: "50%", left: "50%", 
                marginTop: -32, marginLeft: -32, 
                width: 64, height: 64, 
                transformOrigin: `calc(50% + ${radius}px) 50%` 
            }}
        >
            <motion.div animate={{ rotate: -(angle + 360) }} transition={{ duration: duration, repeat: Infinity, ease: "linear" }}>{icon}</motion.div>
        </motion.div>
    )
}

function TickerItem({ text, time, color = "text-[#c084fc]", isDark }) {
    return (
        <div className={styles.tickerItem}>
            <span className={color}>&gt;</span>
            <span className={isDark ? 'text-zinc-300' : 'text-zinc-800'}>{text}</span>
            <span className={styles.tickerTime}>[{time}]</span>
        </div>
    );
}