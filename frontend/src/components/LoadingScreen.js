import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1600);
    const t4 = setTimeout(() => onComplete?.(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase < 3 && (
        <motion.div
          className="loading-screen"
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Animated glow arc */}
          <motion.div
            className="loading-arc"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          >
            <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="arcGlow" x1="0" y1="50" x2="400" y2="50" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  <stop offset="30%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0 90 Q100 10, 200 10 Q300 10, 400 90"
                stroke="url(#arcGlow)"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: phase >= 1 ? 1 : 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.path
                d="M0 90 Q100 10, 200 10 Q300 10, 400 90"
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                fill="none"
                filter="blur(4px)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: phase >= 1 ? 1 : 0 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              />
            </svg>
          </motion.div>

          {/* Logo */}
          <motion.div
            className="loading-logo"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
              opacity: phase >= 1 ? 1 : 0,
              scale: phase >= 1 ? 1 : 0.8,
              y: phase >= 1 ? 0 : 20
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <img src="/logo.png" alt="Sharda HR" className="loading-logo-img" />
            <motion.span
              className="loading-logo-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : -10 }}
              transition={{ duration: 0.3 }}
            >
              Sharda HR
            </motion.span>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="loading-bar-track"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
          >
            <motion.div
              className="loading-bar-fill"
              initial={{ width: "0%" }}
              animate={{ width: phase >= 2 ? "100%" : "40%" }}
              transition={{ duration: phase >= 2 ? 0.5 : 0.6, ease: "easeOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
