import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Page transition wrapper
export const PageTransition = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className={className}
  >
    {children}
  </motion.div>
);

// Staggered container for lists
export const StaggerContainer = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial="hidden"
    animate="show"
    variants={{
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.08,
          delayChildren: delay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Staggered item
export const StaggerItem = ({ children, className = '' }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0 },
    }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className={className}
  >
    {children}
  </motion.div>
);

// Fade in component
export const FadeIn = ({ children, delay = 0, className = '', direction = 'up' }) => {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Scale on hover
export const ScaleOnHover = ({ children, scale = 1.02, className = '' }) => (
  <motion.div
    whileHover={{ scale }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2 }}
    className={className}
  >
    {children}
  </motion.div>
);

// Card with hover animation
export const AnimatedCard = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    whileHover={{ 
      y: -4,
      transition: { duration: 0.2 }
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Slide in from side
export const SlideIn = ({ children, direction = 'left', delay = 0, className = '' }) => {
  const directionOffset = {
    left: { x: -50 },
    right: { x: 50 },
    top: { y: -50 },
    bottom: { y: 50 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Presence wrapper for conditional rendering
export const PresenceWrapper = ({ children, show, mode = 'wait' }) => (
  <AnimatePresence mode={mode}>
    {show && children}
  </AnimatePresence>
);

// Number counter animation
export const AnimatedNumber = ({ value, className = '', duration = 1 }) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime;
    let animationFrame;
    const startValue = displayValue;
    const endValue = Number(value) || 0;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
};

// Pulse animation for notifications
export const Pulse = ({ children, className = '' }) => (
  <motion.div
    animate={{
      scale: [1, 1.05, 1],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Skeleton loader with shimmer effect
export const SkeletonPulse = ({ className = '' }) => (
  <motion.div
    className={`bg-slate-200 dark:bg-slate-800 rounded ${className}`}
    animate={{
      opacity: [0.5, 1, 0.5],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

export { AnimatePresence, motion };
