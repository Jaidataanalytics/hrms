import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { X, Gift, Star, Heart, PartyPopper, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

const EVENT_VISUALS = {
  birthday: {
    icon: Gift,
    title: 'Happy Birthday!',
    subtitle: (name) => `Dear ${name},`,
    message: 'Wishing you an incredible year ahead filled with joy, success, and wonderful memories. Your team at Sharda celebrates YOU today!',
    cta: 'Thank You!',
    gradientFrom: '#fbbf24',
    gradientTo: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 30%, #fde68a 60%, #fcd34d 100%)',
    particleColors: ['#fbbf24', '#f97316', '#fcd34d', '#fb923c', '#f59e0b', '#fde047'],
    accentClass: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.3)',
  },
  work_anniversary: {
    icon: Star,
    title: 'Work Anniversary!',
    subtitle: (name, years) => `Congratulations ${name}!`,
    message: (years) => `${years} year${years !== 1 ? 's' : ''} of dedication, growth, and excellence. Your contribution to Sharda is truly valued. Here's to many more milestones together!`,
    cta: 'Cheers!',
    gradientFrom: '#3b82f6',
    gradientTo: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 30%, #c7d2fe 60%, #a5b4fc 100%)',
    particleColors: ['#3b82f6', '#6366f1', '#8b5cf6', '#60a5fa', '#818cf8', '#a78bfa'],
    accentClass: 'from-blue-500 to-violet-500',
    glowColor: 'rgba(99, 102, 241, 0.3)',
  },
  marriage_anniversary: {
    icon: Heart,
    title: 'Happy Anniversary!',
    subtitle: (name) => `Dear ${name},`,
    message: 'Wishing you and your partner a beautiful day filled with love, warmth, and togetherness. May your bond grow stronger with each passing year!',
    cta: 'Thank You!',
    gradientFrom: '#e11d48',
    gradientTo: '#be123c',
    bgGradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 25%, #fecdd3 50%, #fda4af 80%, #fb7185 100%)',
    particleColors: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#be123c', '#ff6b8a'],
    accentClass: 'from-rose-600 to-red-700',
    glowColor: 'rgba(225, 29, 72, 0.35)',
  },
  custom: {
    icon: PartyPopper,
    title: 'Special Day!',
    subtitle: (name) => `Hey ${name}!`,
    message: 'Today is a special day for you! The entire team wishes you happiness and success. Enjoy your day!',
    cta: 'Thank You!',
    gradientFrom: '#10b981',
    gradientTo: '#14b8a6',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 30%, #a7f3d0 60%, #6ee7b7 100%)',
    particleColors: ['#10b981', '#14b8a6', '#34d399', '#2dd4bf', '#6ee7b7', '#5eead4'],
    accentClass: 'from-emerald-500 to-teal-500',
    glowColor: 'rgba(16, 185, 129, 0.3)',
  },
};

const FloatingParticle = ({ color, delay, size, x, y, duration }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      backgroundColor: color,
      left: `${x}%`,
      top: `${y}%`,
      filter: `blur(${size > 8 ? 1 : 0}px)`,
    }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: [0, 0.8, 0.4, 0.8, 0],
      scale: [0, 1.2, 0.8, 1, 0],
      y: [0, -40, -20, -60, -100],
      x: [0, 10, -10, 5, -5],
    }}
    transition={{
      duration: duration,
      delay: delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

const SparkleIcon = ({ delay, x, y, color }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%` }}
    initial={{ opacity: 0, scale: 0, rotate: 0 }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1.2, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 2.5,
      delay: delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    <Sparkles className="w-4 h-4" style={{ color }} />
  </motion.div>
);

const CelebrationModal = ({ event, onClose }) => {
  const { user } = useAuth();
  const config = EVENT_VISUALS[event?.event_type] || EVENT_VISUALS.custom;
  const Icon = config.icon;
  const firstName = user?.name?.split(' ')[0] || 'Team Member';

  const subtitle = typeof config.subtitle === 'function'
    ? config.subtitle(firstName, event?.years)
    : config.subtitle;
  const message = typeof config.message === 'function'
    ? config.message(event?.years || 0)
    : config.message;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-testid="celebration-modal-overlay"
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: config.bgGradient }}
          initial={{ scale: 0.5, opacity: 0, y: 60 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          data-testid="celebration-modal-card"
        >
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {config.particleColors.map((color, i) => (
              <FloatingParticle
                key={`p-${i}`}
                color={color}
                delay={i * 0.4}
                size={Math.random() * 10 + 4}
                x={Math.random() * 90 + 5}
                y={Math.random() * 80 + 10}
                duration={3 + Math.random() * 2}
              />
            ))}
            {config.particleColors.slice(0, 4).map((color, i) => (
              <SparkleIcon
                key={`s-${i}`}
                color={color}
                delay={i * 0.7 + 0.5}
                x={10 + i * 25}
                y={10 + (i % 2) * 60}
              />
            ))}
          </div>

          {/* Glow effect */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/50 transition-colors"
            data-testid="celebration-modal-close"
          >
            <X className="w-4 h-4 text-slate-700" />
          </button>

          {/* Content */}
          <div className="relative z-10 px-8 pt-8 pb-6 text-center">
            {/* Animated Icon */}
            <motion.div
              className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${config.accentClass} flex items-center justify-center shadow-lg mb-4`}
              animate={{
                rotate: [0, -5, 5, -5, 0],
                scale: [1, 1.08, 1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Icon className="w-8 h-8 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-2xl font-bold text-slate-900 mb-1"
              style={{ fontFamily: 'Manrope, sans-serif' }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {config.title}
            </motion.h2>

            {/* Label for custom events */}
            {event?.label && event.event_type === 'custom' && (
              <motion.p
                className="text-lg font-semibold text-slate-700 mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {event.label}
              </motion.p>
            )}

            {/* Subtitle */}
            <motion.p
              className="text-base text-slate-600 font-medium mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {subtitle}
            </motion.p>

            {/* Message */}
            <motion.p
              className="text-sm text-slate-600 leading-relaxed mb-6 max-w-sm mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {message}
            </motion.p>

            {/* Work Anniversary Years Badge */}
            {event?.event_type === 'work_anniversary' && event?.years && (
              <motion.div
                className="mb-6"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55, type: 'spring' }}
              >
                <span
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r ${config.accentClass} text-white font-bold text-lg shadow-md`}
                >
                  <Star className="w-5 h-5" />
                  {event.years} Year{event.years !== 1 ? 's' : ''}
                </span>
              </motion.div>
            )}

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={onClose}
                className={`px-8 py-3 rounded-2xl bg-gradient-to-r ${config.accentClass} text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all hover:scale-105`}
                data-testid="celebration-modal-cta"
              >
                {config.cta}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CelebrationModal;
