import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Megaphone,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Package,
  Laptop,
  Smartphone,
  MapPin,
  Receipt,
  Plane
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [employeeDashboard, setEmployeeDashboard] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [mySops, setMySops] = useState([]);
  const [myAssets, setMyAssets] = useState(null);
  const [myTours, setMyTours] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAttendance, setMarkingAttendance] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, empDashRes, leaveTypesRes, sopsRes, assetsRes, toursRes, expensesRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/dashboard/employee`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave-types`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/sop/my-sops`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/employee-assets/my-assets`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/tours/my-tours`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/expenses/my-expenses`, { credentials: 'include', headers: authHeaders })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (empDashRes.ok) {
        const empData = await empDashRes.json();
        setEmployeeDashboard(empData);
      }

      if (leaveTypesRes.ok) {
        const ltData = await leaveTypesRes.json();
        setLeaveTypes(ltData);
      }

      if (sopsRes.ok) {
        const sopsData = await sopsRes.json();
        setMySops(sopsData);
      }

      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setMyAssets(assetsData);
      }

      if (toursRes.ok) {
        const toursData = await toursRes.json();
        setMyTours(toursData);
      }

      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setMyExpenses(expensesData);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (punchType) => {
    setMarkingAttendance(true);
    try {
      const response = await fetch(`${API_URL}/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          punch_type: punchType,
          source: 'manual',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${punchType} marked at ${data.time}`);
        fetchDashboardData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to mark attendance');
      }
    } catch (error) {
      toast.error('Failed to mark attendance');
    } finally {
      setMarkingAttendance(false);
    }
  };

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="page-title">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="page-description">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Stats Cards - Show for HR/Admin */}
      {isHR && stats && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <motion.div variants={itemVariants}>
            <Card className="stat-card group" data-testid="stat-employees">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats.total_employees}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="stat-card group" data-testid="stat-present">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present Today</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats.present_today}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {stats.attendance_percentage}% attendance
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="stat-card group" data-testid="stat-leave">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">On Leave Today</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats.on_leave_today}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="stat-card group" data-testid="stat-pending">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats.pending_leaves}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Attendance & Leave */}
        <div className="lg:col-span-8 space-y-6">
          {/* Today's Attendance Status */}
          <Card data-testid="attendance-status-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Today's Attendance
              </CardTitle>
              <CardDescription>Your attendance status for today</CardDescription>
            </CardHeader>
            <CardContent>
              {employeeDashboard?.attendance_today ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Status: <span className="text-emerald-600 capitalize">{employeeDashboard.attendance_today.status}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          First In: {employeeDashboard.attendance_today.first_in || 'N/A'} | 
                          Last Out: {employeeDashboard.attendance_today.last_out || 'In Progress'}
                        </p>
                      </div>
                    </div>
                    {employeeDashboard.attendance_today.total_hours && (
                      <Badge variant="secondary" className="text-lg px-4 py-1">
                        {employeeDashboard.attendance_today.total_hours} hrs
                      </Badge>
                    )}
                  </div>
                  {employeeDashboard.attendance_today.punches?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {employeeDashboard.attendance_today.punches.map((punch, idx) => (
                        <Badge key={idx} variant={punch.type === 'IN' ? 'default' : 'outline'}>
                          {punch.type} - {punch.time}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">No attendance marked today</p>
                    <p className="text-sm text-amber-600">Your attendance will be synced from the biometric system</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Balance */}
          <Card data-testid="leave-balance-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Leave Balance
                  </CardTitle>
                  <CardDescription>Your leave quota for this year</CardDescription>
                </div>
                <Link to="/dashboard/leave">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {employeeDashboard?.leave_balance?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {employeeDashboard.leave_balance.slice(0, 4).map((balance, idx) => {
                    const leaveType = leaveTypes.find(lt => lt.leave_type_id === balance.leave_type_id);
                    const leaveName = leaveType?.name || leaveType?.code || balance.leave_type_id;
                    return (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-600">{leaveName}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {balance.available} / {balance.opening_balance + balance.accrued}
                          </p>
                        </div>
                        <Progress 
                          value={(balance.available / (balance.opening_balance + balance.accrued || 1)) * 100} 
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No leave balance data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Announcements & Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Announcements */}
          <Card data-testid="announcements-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Megaphone className="w-5 h-5 text-primary" />
                  Announcements
                </CardTitle>
                <Link to="/dashboard/announcements">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {employeeDashboard?.recent_announcements?.length > 0 ? (
                employeeDashboard.recent_announcements.slice(0, 3).map((ann, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-slate-900 text-sm line-clamp-1">{ann.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{ann.category}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-4 text-sm">No announcements</p>
              )}
            </CardContent>
          </Card>

          {/* My SOPs Card */}
          {mySops.length > 0 && (
            <Card data-testid="my-sops-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    My SOPs
                  </CardTitle>
                  <Link to="/dashboard/sop">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mySops.slice(0, 3).map((sop, idx) => (
                  <div key={idx} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-emerald-900 text-sm">{sop.title}</p>
                        {sop.description && (
                          <p className="text-xs text-emerald-600 line-clamp-1 mt-1">{sop.description}</p>
                        )}
                        <p className="text-xs text-emerald-500 mt-1">v{sop.version}</p>
                      </div>
                      {sop.file_name && (
                        <a
                          href={`${API_URL}/sop/${sop.sop_id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                            <Download className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card data-testid="quick-actions-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/dashboard/leave" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-apply-leave">
                  <Calendar className="w-4 h-4" />
                  Apply for Leave
                </Button>
              </Link>
              <Link to="/dashboard/attendance" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-view-attendance">
                  <Clock className="w-4 h-4" />
                  View Attendance
                </Button>
              </Link>
              <Link to="/dashboard/tours" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-tour-request">
                  <Plane className="w-4 h-4" />
                  Tour Request
                </Button>
              </Link>
              <Link to="/dashboard/expenses" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="quick-expense-claim">
                  <Receipt className="w-4 h-4" />
                  Expense Claim
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* My Assets Card */}
          {myAssets && (
            <Card data-testid="my-assets-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Package className="w-5 h-5 text-blue-600" />
                  My Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-3 rounded-lg text-center ${myAssets.laptop ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                    <Laptop className={`w-5 h-5 mx-auto mb-1 ${myAssets.laptop ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <p className="text-xs font-medium">Laptop</p>
                    <p className={`text-xs ${myAssets.laptop ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {myAssets.laptop ? 'Assigned' : 'N/A'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${myAssets.mobile_charger ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                    <Smartphone className={`w-5 h-5 mx-auto mb-1 ${myAssets.mobile_charger ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <p className="text-xs font-medium">Mobile</p>
                    <p className={`text-xs ${myAssets.mobile_charger ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {myAssets.mobile_charger ? 'Assigned' : 'N/A'}
                    </p>
                  </div>
                </div>
                {myAssets.sdpl_number && (
                  <div className="p-2 bg-blue-50 rounded text-xs">
                    <span className="text-blue-600 font-medium">SDPL#:</span> {myAssets.sdpl_number}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* My Tours Card */}
          {myTours.length > 0 && (
            <Card data-testid="my-tours-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <MapPin className="w-5 h-5 text-purple-600" />
                    My Tours
                  </CardTitle>
                  <Link to="/dashboard/tours">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {myTours.slice(0, 2).map((tour, idx) => (
                  <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-purple-900 text-sm">{tour.destination}</p>
                      <Badge className={
                        tour.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        tour.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }>
                        {tour.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-purple-600">
                      {tour.from_date} - {tour.to_date}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* My Expenses Card */}
          {myExpenses.length > 0 && (
            <Card data-testid="my-expenses-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <Receipt className="w-5 h-5 text-orange-600" />
                    My Expenses
                  </CardTitle>
                  <Link to="/dashboard/expenses">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {myExpenses.slice(0, 2).map((expense, idx) => (
                  <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-orange-900 text-sm">{expense.category || expense.description}</p>
                      <Badge className={
                        expense.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        expense.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        expense.status === 'reimbursed' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }>
                        {expense.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-orange-600">
                      ₹{expense.amount?.toLocaleString('en-IN')} • {expense.date}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending Actions for Managers/HR */}
          {(isHR || user?.role === 'manager') && stats?.pending_leaves > 0 && (
            <Card className="border-amber-200 bg-amber-50" data-testid="pending-actions-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-amber-900">Pending Approvals</p>
                    <p className="text-sm text-amber-700">{stats.pending_leaves} leave requests need your attention</p>
                  </div>
                  <Link to="/dashboard/leave">
                    <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                      Review
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
