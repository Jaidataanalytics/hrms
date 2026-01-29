import React, { useState, useEffect } from 'react';
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
import { Badge } from '../components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  CalendarDays,
  Megaphone,
  Settings,
  LogOut,
  Bell,
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
  Fingerprint,
  Shield,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationCount] = useState(3); // Mock notification count
  
  // Check if user is HR/Admin for search
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
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

  // Base menu items for all users
  const baseMenuItems = [
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: LayoutDashboard,
      exact: true
    },
    { 
      name: 'Attendance', 
      path: '/dashboard/attendance', 
      icon: Clock 
    },
    { 
      name: 'Leave', 
      path: '/dashboard/leave', 
      icon: Calendar 
    },
    { 
      name: 'Payroll', 
      path: '/dashboard/payroll', 
      icon: CreditCard 
    },
    { 
      name: 'Performance', 
      path: '/dashboard/performance', 
      icon: Target 
    },
    { 
      name: 'Announcements', 
      path: '/dashboard/announcements', 
      icon: Megaphone 
    },
  ];

  // HR-only menu items
  const hrMenuItems = [
    { 
      name: 'Employees', 
      path: '/dashboard/employees', 
      icon: Users 
    },
  ];

  // Combine menu items based on role
  const menuItems = isHR 
    ? [baseMenuItems[0], ...hrMenuItems, ...baseMenuItems.slice(1)] 
    : baseMenuItems;

  const adminMenuItems = [
    { name: 'Documents', path: '/dashboard/documents', icon: FolderOpen },
    { name: 'Assets', path: '/dashboard/assets', icon: Package },
    { name: 'Expenses', path: '/dashboard/expenses', icon: Receipt },
    { name: 'Helpdesk', path: '/dashboard/helpdesk', icon: HelpCircle },
    { name: 'SOPs', path: '/dashboard/sop', icon: FileSpreadsheet },
    { name: 'Recruitment', path: '/dashboard/recruitment', icon: Briefcase },
    { name: 'Onboarding', path: '/dashboard/onboarding', icon: UserMinus },
    { name: 'Contract Labour', path: '/dashboard/labour', icon: HardHat },
    { name: 'Training', path: '/dashboard/training', icon: GraduationCap },
    { name: 'Tour Management', path: '/dashboard/tour-management', icon: Plane },
    { name: 'Insurance', path: '/dashboard/insurance', icon: Shield },
    { name: 'Reports', path: '/dashboard/reports', icon: BarChart3 },
    { name: 'Report Builder', path: '/dashboard/report-builder', icon: PieChart },
    { name: 'Bulk Import', path: '/dashboard/import', icon: FileText },
    { name: 'Master Setup', path: '/dashboard/master-setup', icon: Building2 },
    { name: 'User Management', path: '/dashboard/user-management', icon: UserCog },
    { name: 'Data Management', path: '/dashboard/data-management', icon: Database },
    { name: 'API Manager', path: '/dashboard/biometric', icon: Settings },
    { name: 'Holidays', path: '/dashboard/holidays', icon: CalendarDays },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full sidebar ${mobile ? '' : ''}`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="Sharda HR" className="h-9 w-9 object-contain" />
          <span className="font-semibold text-lg text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Sharda HR
          </span>
        </Link>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
              onClick={() => mobile && setSidebarOpen(false)}
              data-testid={`nav-${item.name.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Admin Section */}
        {(user?.role === 'super_admin' || user?.role === 'hr_admin') && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Administration
            </p>
            <nav className="space-y-1">
              {adminMenuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => mobile && setSidebarOpen(false)}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Settings */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <Link
            to="/dashboard/settings"
            className={`sidebar-link ${isActive('/dashboard/settings') ? 'active' : ''}`}
            onClick={() => mobile && setSidebarOpen(false)}
            data-testid="nav-settings"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </div>
      </ScrollArea>

      {/* User Profile */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/50">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.picture} />
            <AvatarFallback className="bg-primary text-white text-sm">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar mobile />
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Navigation */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile Menu Button */}
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
              <Link to="/dashboard" className="text-slate-500 hover:text-slate-700">
                Dashboard
              </Link>
              {location.pathname !== '/dashboard' && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900 font-medium capitalize">
                    {location.pathname.split('/').pop().replace('-', ' ')}
                  </span>
                </>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Global Search Button (HR/Admin only) */}
              {isHR && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-2 text-slate-500 hover:text-slate-700 border border-slate-200 px-3"
                  onClick={() => setSearchOpen(true)}
                  data-testid="global-search-btn"
                >
                  <Search className="w-4 h-4" />
                  <span className="text-sm">Search...</span>
                  <kbd className="ml-2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-xs text-slate-600">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
              )}
              
              {/* Mobile Search Button */}
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

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="notifications-btn"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {notificationCount}
                  </Badge>
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2" data-testid="user-menu-btn">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.picture} />
                      <AvatarFallback className="bg-primary text-white text-sm">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user?.name}</span>
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
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Global Search Dialog */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
