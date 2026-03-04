import React, { useState, useEffect } from 'react';
import Spline from '@splinetool/react-spline';
import anime from 'animejs'; 
import styles from './Splash.module.css';

const Splash = ({ onComplete }) => {
  const [loaded, setLoaded] = useState(false);

  const PAD_LEFT = "10vw";  
  const PAD_RIGHT = "0px"; 
  const PAD_BOTTOM = "26vh"; 
  const PAD_TOP = "0px";   

  useEffect(() => {
    const originalNow = performance.now;
    const originalRaf = window.requestAnimationFrame;
    
    let lastRealTime = originalNow.call(performance);
    let timeOffset = lastRealTime;
    
    // REDUCED TO 2x SPEED AS REQUESTED
    const speedMultiplier = 2; 

    performance.now = function() {
      const currentRealTime = originalNow.call(performance);
      const delta = currentRealTime - lastRealTime;
      lastRealTime = currentRealTime;
      timeOffset += delta * speedMultiplier;
      return timeOffset;
    };

    window.requestAnimationFrame = function(callback) {
      return originalRaf(() => {
        callback(performance.now());
      });
    };

    return () => {
      performance.now = originalNow;
      window.requestAnimationFrame = originalRaf;
    };
  }, []);

  function onLoad() {
    setLoaded(true);

    const tl = anime.timeline({
      easing: 'easeInOutQuart',
      complete: () => {
        // CRITICAL FIX: Restore global time BEFORE unmounting.
        // This stops Framer Motion on the Landing page from freezing/timing out!
        performance.now = performance.now.__proto__.now || performance.now; 
        window.requestAnimationFrame = window.requestAnimationFrame.__proto__.requestAnimationFrame || window.requestAnimationFrame;
        onComplete();
      }
    });

    tl
      .add({
        targets: `.${styles.splineContainer}`,
        opacity: [0, 1],
        duration: 900 
      })
      .add({
        duration: 18000 
      })
      .add({
        targets: `.${styles.introOverlay}`,
        opacity: [1, 0],
        scale: [1, 1.05],
        duration: 2400, 
        easing: 'easeInExpo'
      });
  }

  return (
    <div className={styles.introOverlay}>
      <div 
        className={styles.splineContainer}
        style={{ paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT, paddingBottom: PAD_BOTTOM, paddingTop: PAD_TOP }}
      >
        <Spline scene="/intro.splinecode" onLoad={onLoad} />
      </div>

      {!loaded && (
        <div className={styles.loaderWrapper}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
          {/* UPDATED TEXT TO 2x */}
          <p className={styles.loadingText}>Booting Core @ 2x</p>
        </div>
      )}
    </div>
  );
};

export default Splash;