import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Gift, PartyPopper, Heart, Star, ChevronRight, X } from 'lucide-react';
import { Button } from './ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CELEBRATION_CONFIG = {
  birthday: {
    icon: Gift,
    selfTitle: "Happy Birthday!",
    selfMessage: "Wishing you an amazing year ahead! Your team celebrates you today.",
    otherPrefix: "'s Birthday!",
    gradient: "from-amber-50 via-orange-50 to-rose-50",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    textColor: "text-amber-900",
    subColor: "text-amber-600",
    accentColor: "#f59e0b",
  },
  work_anniversary: {
    icon: Star,
    selfTitle: "Work Anniversary!",
    selfMessage: (years) => `Congratulations on ${years} year${years !== 1 ? 's' : ''} at Sharda! Your dedication is valued.`,
    otherPrefix: "'s Work Anniversary!",
    gradient: "from-blue-50 via-indigo-50 to-purple-50",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    textColor: "text-blue-900",
    subColor: "text-blue-600",
    accentColor: "#3b82f6",
  },
  marriage_anniversary: {
    icon: Heart,
    selfTitle: "Happy Marriage Anniversary!",
    selfMessage: "Wishing you and your partner a beautiful day together!",
    otherPrefix: "'s Marriage Anniversary!",
    gradient: "from-pink-50 via-rose-50 to-red-50",
    border: "border-pink-200",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    textColor: "text-pink-900",
    subColor: "text-pink-600",
    accentColor: "#ec4899",
  },
  custom: {
    icon: PartyPopper,
    selfTitle: "Special Day!",
    selfMessage: "Have a wonderful day!",
    otherPrefix: "'s Special Day!",
    gradient: "from-emerald-50 via-teal-50 to-cyan-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    textColor: "text-emerald-900",
    subColor: "text-emerald-600",
    accentColor: "#10b981",
  },
};

const ConfettiPiece = ({ delay, left, color }) => (
  <motion.div
    className="confetti-piece"
    style={{ left: `${left}%`, top: '-10px', backgroundColor: color }}
    initial={{ y: -20, rotate: 0, opacity: 1 }}
    animate={{ y: '100vh', rotate: 720, opacity: 0 }}
    transition={{ duration: 3, delay, ease: 'easeIn' }}
  />
);

const CelebrationBanner = () => {
  const { user } = useAuth();
  const [todayEvents, setTodayEvents] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetchTodayEvents();
  }, []);

  const fetchTodayEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/events/today`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTodayEvents(data);
        const isMyCelebration = data.some(e => e.emp_code === user?.employee_id);
        if (isMyCelebration) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }
      }
    } catch (err) {
      console.error('Failed to fetch celebrations:', err);
    }
  };

  if (todayEvents.length === 0 || dismissed) return null;

  const myEvents = todayEvents.filter(e => e.emp_code === user?.employee_id);
  const otherEvents = todayEvents.filter(e => e.emp_code !== user?.employee_id);

  const confettiColors = ['#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#ef4444'];

  return (
    <>
      {/* Confetti for self celebration */}
      <AnimatePresence>
        {showConfetti && (
          <>
            {Array.from({ length: 24 }).map((_, i) => (
              <ConfettiPiece
                key={i}
                delay={Math.random() * 1.5}
                left={Math.random() * 100}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-3"
        data-testid="celebration-banner"
      >
        {/* My celebrations - personalized banner */}
        {myEvents.map((event) => {
          const config = CELEBRATION_CONFIG[event.event_type] || CELEBRATION_CONFIG.custom;
          const Icon = config.icon;
          const message = typeof config.selfMessage === 'function'
            ? config.selfMessage(event.years || 0)
            : config.selfMessage;

          return (
            <motion.div
              key={event.event_id}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${config.gradient} ${config.border} border p-5`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.08]" style={{ background: `radial-gradient(circle, ${config.accentColor}, transparent)` }} />
              <div className="flex items-center gap-4">
                <motion.div
                  className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center shrink-0`}
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <Icon className={`w-7 h-7 ${config.iconColor}`} />
                </motion.div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${config.textColor}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {config.selfTitle}
                  </h3>
                  <p className={`text-sm ${config.subColor} mt-0.5`}>{message}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 opacity-50 hover:opacity-100" onClick={() => setDismissed(true)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}

        {/* Other people's celebrations - compact card */}
        {otherEvents.length > 0 && (
          <motion.div
            className="rounded-xl bg-white border border-slate-200 p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-amber-500" />
                Today's Celebrations
              </h4>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100" onClick={() => setDismissed(true)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {otherEvents.slice(0, 5).map((event) => {
                const config = CELEBRATION_CONFIG[event.event_type] || CELEBRATION_CONFIG.custom;
                const Icon = config.icon;
                return (
                  <div key={event.event_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {event.employee_name}{config.otherPrefix}
                      </p>
                      {event.department && (
                        <p className="text-xs text-slate-400">{event.department}</p>
                      )}
                    </div>
                    {event.event_type === 'work_anniversary' && event.years && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {event.years}yr
                      </span>
                    )}
                  </div>
                );
              })}
              {otherEvents.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-1">
                  +{otherEvents.length - 5} more celebrations today
                </p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
};

export default CelebrationBanner;
