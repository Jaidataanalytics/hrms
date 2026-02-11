import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Clock, Calendar, HelpCircle, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

const tabs = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Attendance', path: '/dashboard/attendance', icon: Clock },
  { name: 'Leave', path: '/dashboard/leave', icon: Calendar },
  { name: 'Helpdesk', path: '/dashboard/helpdesk', icon: HelpCircle },
  { name: 'More', path: '__more__', icon: Menu },
];

const BottomNav = ({ onMorePress }) => {
  const location = useLocation();

  const isActive = (path, exact) => {
    if (path === '__more__') return false;
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-slate-200/60"
      style={{
        background: 'hsla(0, 0%, 100%, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path, tab.exact);
          const Icon = tab.icon;

          if (tab.path === '__more__') {
            return (
              <button
                key="more"
                onClick={onMorePress}
                className="flex flex-col items-center justify-center gap-0.5 w-16 py-1 text-slate-400 active:scale-90 transition-transform"
                data-testid="bottom-nav-more"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.name}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 transition-colors ${
                active ? 'text-primary' : 'text-slate-400'
              }`}
              data-testid={`bottom-nav-${tab.name.toLowerCase()}`}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-px left-3 right-3 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.name}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for phones with home indicator */}
      <div className="h-safe-area-bottom" />
    </nav>
  );
};

export default BottomNav;
