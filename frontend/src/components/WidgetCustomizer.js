import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Settings2, X, GripVertical, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_WIDGETS = {
  attendance: { label: 'Today\'s Attendance', enabled: true, order: 0 },
  leave_balance: { label: 'Leave Balance', enabled: true, order: 1 },
  announcements: { label: 'Announcements', enabled: true, order: 2 },
  quick_actions: { label: 'Quick Actions', enabled: true, order: 3 },
  upcoming_holidays: { label: 'Upcoming Holidays', enabled: true, order: 4 },
  team_birthdays: { label: 'Team Birthdays', enabled: true, order: 5 },
  monthly_summary: { label: 'Monthly Attendance Summary', enabled: true, order: 6 },
  sops: { label: 'My SOPs', enabled: true, order: 7 },
  assets: { label: 'My Assets', enabled: true, order: 8 },
  tours: { label: 'My Tours', enabled: true, order: 9 },
  expenses: { label: 'My Expenses', enabled: true, order: 10 },
};

export const getWidgetPrefs = (userId) => {
  try {
    const stored = localStorage.getItem(`widget_prefs_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to pick up new widgets
      const merged = { ...DEFAULT_WIDGETS };
      for (const key of Object.keys(merged)) {
        if (parsed[key] !== undefined) {
          merged[key] = { ...merged[key], ...parsed[key] };
        }
      }
      return merged;
    }
  } catch (e) {}
  return { ...DEFAULT_WIDGETS };
};

export const isWidgetEnabled = (prefs, widgetId) => {
  return prefs[widgetId]?.enabled !== false;
};

const WidgetCustomizer = ({ userId, onClose, onSave }) => {
  const [prefs, setPrefs] = useState(() => getWidgetPrefs(userId));

  const toggle = (key) => {
    setPrefs(p => ({
      ...p,
      [key]: { ...p[key], enabled: !p[key].enabled }
    }));
  };

  const handleSave = () => {
    localStorage.setItem(`widget_prefs_${userId}`, JSON.stringify(prefs));
    onSave(prefs);
    onClose();
  };

  const enabledCount = Object.values(prefs).filter(w => w.enabled).length;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          data-testid="widget-customizer-dialog"
        >
          <div className="p-5 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Customize Dashboard
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{enabledCount} widgets active</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1.5">
            {Object.entries(prefs)
              .sort(([, a], [, b]) => a.order - b.order)
              .map(([key, widget]) => (
                <div
                  key={key}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    widget.enabled ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-150 opacity-60'
                  }`}
                  onClick={() => toggle(key)}
                  data-testid={`widget-toggle-${key}`}
                >
                  <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-slate-800">{widget.label}</span>
                  {widget.enabled ? (
                    <Eye className="w-4 h-4 text-blue-500" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              ))}
          </div>

          <div className="p-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} data-testid="widget-save-btn">Save Layout</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const CustomizeButton = ({ onClick }) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onClick}
    className="gap-1.5 text-xs"
    data-testid="customize-dashboard-btn"
  >
    <Settings2 className="w-3.5 h-3.5" /> Customize
  </Button>
);

export default WidgetCustomizer;
