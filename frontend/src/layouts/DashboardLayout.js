import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  CalendarDays,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  Briefcase,
  FileText,
  CreditCard,
  Target,
  Package,
  Receipt,
  UserMinus,
  HelpCircle,
  BarChart3,
  HardHat,
  FolderOpen,
  PieChart,
  UserCog,
  GraduationCap,
  Plane,
  Database,
  Shield,
  Search,
  FileSpreadsheet,
  UsersRound,
  PartyPopper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalSearch from '../components/GlobalSearch';
import NotificationBell from '../components/NotificationBell';
import LoadingScreen from '../components/LoadingScreen';

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(2px)' }
};

const pageTransition = {
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1]
};

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  const handleLoadingComplete = useCallback(() => {
    setShowLoader(false);
    setTimeout(() => setAppReady(true), 100);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && isHR) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHR]);

  const baseMenuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Attendance', path: '/dashboard/attendance', icon: Clock },
    { name: 'My Calendar', path: '/dashboard/my-calendar', icon: CalendarDays },
    { name: 'Meetings', path: '/dashboard/meetings', icon: UsersRound },
    { name: 'Leave', path: '/dashboard/leave', icon: Calendar },
    { name: 'Payroll', path: '/dashboard/payroll', icon: CreditCard },
    { name: 'Performance', path: '/dashboard/performance', icon: Target },
    { name: 'Announcements', path: '/dashboard/announcements', icon: Megaphone },
    { name: 'Helpdesk', path: '/dashboard/helpdesk', icon: HelpCircle },
    { name: 'SOPs', path: '/dashboard/sop', icon: FileSpreadsheet },
    { name: 'Training', path: '/dashboard/training', icon: GraduationCap },
    { name: 'Tour Management', path: '/dashboard/tour-management', icon: Plane },
  ];

  const hrMenuItems = [{ name: 'Employees', path: '/dashboard/employees', icon: Users }];

  const menuItems = isHR 
    ? [baseMenuItems[0], ...hrMenuItems, ...baseMenuItems.slice(1)] 
    : baseMenuItems;

  const adminMenuItems = [
    { name: 'Documents', path: '/dashboard/documents', icon: FolderOpen },
    { name: 'Assets', path: '/dashboard/assets', icon: Package },
    { name: 'Expenses', path: '/dashboard/expenses', icon: Receipt },
    { name: 'Recruitment', path: '/dashboard/recruitment', icon: Briefcase },
    { name: 'Onboarding', path: '/dashboard/onboarding', icon: UserMinus },
    { name: 'Contract Labour', path: '/dashboard/labour', icon: HardHat },
    { name: 'Insurance', path: '/dashboard/insurance', icon: Shield },
    { name: 'Reports', path: '/dashboard/reports', icon: BarChart3 },
    { name: 'Report Builder', path: '/dashboard/report-builder', icon: PieChart },
    { name: 'Bulk Import', path: '/dashboard/import', icon: FileText },
    { name: 'Master Setup', path: '/dashboard/master-setup', icon: Building2 },
    { name: 'User Management', path: '/dashboard/user-management', icon: UserCog },
    { name: 'Data Management', path: '/dashboard/data-management', icon: Database },
    { name: 'API Manager', path: '/dashboard/biometric', icon: Settings },
    { name: 'Holidays', path: '/dashboard/holidays', icon: CalendarDays },
    { name: 'Events', path: '/dashboard/events', icon: PartyPopper },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => { await logout(); };

  const NavLink = ({ item, mobile }) => {
    const active = isActive(item.path, item.exact);
    return (
      <Link
        to={item.path}
        className={`sidebar-link ${active ? 'active' : ''}`}
        onClick={() => mobile && setSidebarOpen(false)}
        data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <item.icon className="w-[18px] h-[18px]" />
        <span>{item.name}</span>
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/80"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
      </Link>
    );
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full sidebar ${mobile ? '' : ''}`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/[0.06]">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative">
            <img src="/logo.png" alt="Sharda HR" className="h-9 w-9 object-contain relative z-10" />
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Sharda HR
          </span>
        </Link>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-0.5">
          {menuItems.map((item) => (
            <NavLink key={item.path} item={item} mobile={mobile} />
          ))}
        </nav>

        {(user?.role === 'super_admin' || user?.role === 'hr_admin') && (
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <p className="px-3 mb-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              // Administration
            </p>
            <nav className="space-y-0.5">
              {adminMenuItems.map((item) => (
                <NavLink key={item.path} item={item} mobile={mobile} />
              ))}
            </nav>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          <NavLink item={{ name: 'Settings', path: '/dashboard/settings', icon: Settings }} mobile={mobile} />
        </div>
      </ScrollArea>

      {/* User Profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors duration-200">
          <Avatar className="h-9 w-9 ring-2 ring-white/10">
            <AvatarImage src={user?.picture} />
            <AvatarFallback className="bg-primary/80 text-white text-sm font-semibold">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Loading Screen */}
      <AnimatePresence>
        {showLoader && <LoadingScreen onComplete={handleLoadingComplete} />}
      </AnimatePresence>

      <div className={`min-h-screen bg-[hsl(240,20%,5%)] noise-bg transition-opacity duration-500 ${appReady ? 'opacity-100' : 'opacity-0'}`}>
        {/* Desktop Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Mobile Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar mobile />
        </aside>

        {/* Main Content */}
        <div className="lg:pl-64">
          {/* Top Navigation */}
          <header className="sticky top-0 z-30 border-b border-white/[0.06]" style={{ background: 'hsl(240 20% 6% / 0.8)', backdropFilter: 'blur(20px) saturate(150%)' }}>
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                data-testid="mobile-menu-btn"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <Link to="/dashboard" className="text-slate-400 hover:text-slate-200 transition-colors">
                  Dashboard
                </Link>
                {location.pathname !== '/dashboard' && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-white font-semibold capitalize">
                      {location.pathname.split('/').pop().replace(/-/g, ' ')}
                    </span>
                  </>
                )}
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {isHR && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:flex items-center gap-2 text-slate-400 hover:text-slate-600 border border-slate-200/80 px-3 rounded-lg hover:border-slate-300 transition-all"
                    onClick={() => setSearchOpen(true)}
                    data-testid="global-search-btn"
                  >
                    <Search className="w-4 h-4" />
                    <span className="text-sm">Search...</span>
                    <kbd className="ml-2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100/80 px-1.5 font-mono text-[10px] text-slate-500">
                      <span>⌘</span>K
                    </kbd>
                  </Button>
                )}
                
                {isHR && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    onClick={() => setSearchOpen(true)}
                    data-testid="global-search-btn-mobile"
                  >
                    <Search className="w-5 h-5" />
                  </Button>
                )}

                <NotificationBell />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 px-2 rounded-lg hover:bg-slate-100" data-testid="user-menu-btn">
                      <Avatar className="h-8 w-8 ring-2 ring-slate-100">
                        <AvatarImage src={user?.picture} />
                        <AvatarFallback className="bg-primary text-white text-sm font-semibold">
                          {getInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:block text-sm font-medium text-slate-700">{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-semibold">{user?.name}</span>
                        <span className="text-xs font-normal text-slate-500">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-btn">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {/* Accent line */}
            <div className="header-accent-line" />
          </header>

          {/* Page Content */}
          <main className="p-4 sm:p-6 lg:p-8 relative z-[1]">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        
        {/* Global Search Dialog */}
        <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </>
  );
};

export default DashboardLayout;
