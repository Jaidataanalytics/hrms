import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Sparkles } from 'lucide-react';
import { API_URL } from '../config';

const API = API_URL;

const ThoughtOfTheDay = ({ authHeaders }) => {
  const [thought, setThought] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const checkAndShow = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lastSeen = localStorage.getItem('thought_last_seen');
      if (lastSeen === today) return;

      await new Promise(r => setTimeout(r, 2000));

      try {
        const r = await fetch(`${API}/thought-of-the-day`, {
          
          headers: authHeaders,
        });
        if (r.ok) {
          const data = await r.json();
          setThought(data.thought);
          setOpen(true);
          localStorage.setItem('thought_last_seen', today);
          setTimeout(() => setOpen(false), 6000);
        }
      } catch (e) {
        console.error('Error fetching thought:', e);
      }
    };
    checkAndShow();
  }, []);

  if (!thought) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[420px] p-0 border-0 rounded-2xl overflow-hidden shadow-2xl"
        data-testid="thought-of-day-card"
        aria-describedby="thought-description"
      >
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

        <div className="px-8 py-8">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-600" />
            </div>
          </div>

          {/* Label */}
          <p className="text-center text-[11px] font-bold tracking-[0.2em] uppercase text-amber-700 mb-4">
            Thought of the Day
          </p>

          {/* Quote */}
          <p
            id="thought-description"
            className="text-center text-xl font-medium text-slate-800 leading-relaxed"
            data-testid="thought-text"
          >
            "{thought}"
          </p>

          {/* Divider */}
          <div className="flex justify-center mt-6">
            <div className="w-8 h-0.5 bg-amber-300 rounded-full" />
          </div>

          {/* Dismiss hint */}
          <p className="text-center text-[11px] text-slate-400 mt-4">
            Click anywhere to dismiss
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThoughtOfTheDay;
