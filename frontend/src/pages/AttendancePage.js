import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Calendar } from '../components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  Plane,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Search,
  Download,
  TrendingUp,
  Award,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AttendancePage = () => {
  const { user } = useAuth();
  
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';
  
  const [attendance, setAttendance] = useState([]);
  const [orgAttendance, setOrgAttendance] = useState(null);
  const [historyAttendance, setHistoryAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceSource, setAttendanceSource] = useState('manual');
  const [viewMode, setViewMode] = useState(isHR ? 'organization' : 'my');
  
  // Date range filters
  const [dateRangePreset, setDateRangePreset] = useState('current_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [activeTab, setActiveTab] = useState('records');

  const currentMonth = selectedDate.getMonth() + 1;
  const currentYear = selectedDate.getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate dates based on preset
  const getDateRange = (preset) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    switch (preset) {
      case 'current_month':
        return {
          from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          to: today.toISOString().split('T')[0]
        };
      case 'last_month':
        const lastMonth = month === 0 ? 11 : month - 1;
        const lastYear = month === 0 ? year - 1 : year;
        const lastDay = new Date(lastYear, lastMonth + 1, 0).getDate();
        return {
          from: `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}-01`,
          to: `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}-${lastDay}`
        };
      case 'last_3_months':
        const threeMonthsAgo = new Date(year, month - 3, 1);
        return {
          from: threeMonthsAgo.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case 'year_to_date':
        return {
          from: `${year}-01-01`,
          to: today.toISOString().split('T')[0]
        };
      case 'custom':
        return { from: fromDate, to: toDate };
      default:
        return {
          from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          to: today.toISOString().split('T')[0]
        };
    }
  };

  useEffect(() => {
    fetchAttendance();
    if (isHR) {
      fetchEmployees();
    }
  }, [currentMonth, currentYear, viewMode]);

  useEffect(() => {
    if (dateRangePreset !== 'custom') {
      const { from, to } = getDateRange(dateRangePreset);
      setFromDate(from);
      setToDate(to);
    }
  }, [dateRangePreset]);

  useEffect(() => {
    if (isHR && fromDate && toDate && viewMode === 'organization') {
      fetchHistoryAttendance();
      fetchSummary();
    }
  }, [fromDate, toDate, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/employees`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchHistoryAttendance = async () => {
    if (!fromDate || !toDate) return;
    
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate
      });
      if (selectedEmployee && selectedEmployee !== 'all') {
        params.append('employee_id', selectedEmployee);
      }
      
      const response = await fetch(
        `${API_URL}/attendance?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setHistoryAttendance(data);
      }
    } catch (error) {
      console.error('Error fetching history attendance:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!fromDate || !toDate) return;
    
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate
      });
      if (selectedEmployee && selectedEmployee !== 'all') {
        params.append('employee_id', selectedEmployee);
      }
      
      const response = await fetch(
        `${API_URL}/attendance/summary?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      
      const orgResponse = await fetch(
        `${API_URL}/attendance/organization?month=${currentMonth}&year=${currentYear}&date=${todayStr}`,
        { credentials: 'include', headers: authHeaders }
      );
      
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        setOrgAttendance(orgData);
      }
      
      const myResponse = await fetch(
        `${API_URL}/attendance/my?month=${currentMonth}&year=${currentYear}`,
        { credentials: 'include', headers: authHeaders }
      );

      if (myResponse.ok) {
        const data = await myResponse.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGeoLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const handleMarkAttendance = async (punchType) => {
    setMarkingAttendance(true);
    try {
      toast.info('Getting your location...');
      const geoLocation = await getGeoLocation();
      
      const payload = {
        punch_type: punchType,
        source: attendanceSource,
      };
      
      if (geoLocation) {
        payload.location = `${geoLocation.latitude.toFixed(6)}, ${geoLocation.longitude.toFixed(6)}`;
        payload.geo_coordinates = geoLocation;
      }

      const response = await fetch(`${API_URL}/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const locationMsg = geoLocation ? ' (Location tagged)' : '';
        toast.success(`${punchType} marked at ${data.time}${locationMsg}`);
        fetchAttendance();
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

  const getAttendanceForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return attendance.find(a => a.date === dateStr);
  };

  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return attendance.find(a => a.date === today);
  };

  const todayAttendance = getTodayAttendance();

  // Export to Excel functions
  const exportRecordsToExcel = () => {
    if (!historyAttendance || historyAttendance.length === 0) {
      toast.error('No records to export');
      return;
    }

    const data = historyAttendance.map(att => ({
      'Date': att.date,
      'Employee Name': att.employee_name || att.employee_id,
      'Employee Code': att.emp_code || '',
      'Status': att.status?.charAt(0).toUpperCase() + att.status?.slice(1).replace('_', ' ') || '',
      'In Time': att.first_in || '-',
      'Out Time': att.last_out || '-',
      'Total Hours': att.total_hours || '-',
      'Late': att.is_late ? 'Yes' : 'No',
      'Late Minutes': att.late_minutes || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Records');
    
    // Auto-width columns
    const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Attendance_Records_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Attendance records exported successfully');
  };

  const exportSummaryToExcel = () => {
    if (!summary) {
      toast.error('No summary data to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Overall Summary
    const overallData = [
      ['Attendance Summary Report'],
      ['Period', `${fromDate} to ${toDate}`],
      [''],
      ['Metric', 'Value'],
      ['Total Present Days', summary.overall_summary?.total_present || 0],
      ['Total Absent Days', summary.overall_summary?.total_absent || 0],
      ['Total Late Instances', summary.overall_summary?.total_late || 0],
      ['Total WFH Days', summary.overall_summary?.total_wfh || 0],
      ['Employees with Perfect Attendance', summary.overall_summary?.perfect_attendance_count || 0],
      ['Total Records', summary.overall_summary?.total_records || 0]
    ];
    const wsOverall = XLSX.utils.aoa_to_sheet(overallData);
    wsOverall['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsOverall, 'Summary');

    // Sheet 2: Most Late
    const lateData = [
      ['Rank', 'Employee Name', 'Employee Code', 'Department', 'Late Count', 'Total Late Minutes']
    ];
    summary.rankings?.most_late?.filter(e => e.late_count > 0).forEach((emp, idx) => {
      lateData.push([
        idx + 1,
        emp.name,
        emp.emp_code,
        emp.department || '',
        emp.late_count,
        emp.total_late_minutes || 0
      ]);
    });
    const wsLate = XLSX.utils.aoa_to_sheet(lateData);
    wsLate['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsLate, 'Most Late');

    // Sheet 3: Most Absent
    const absentData = [
      ['Rank', 'Employee Name', 'Employee Code', 'Department', 'Absent Days']
    ];
    summary.rankings?.most_absent?.filter(e => e.absent_days > 0).forEach((emp, idx) => {
      absentData.push([
        idx + 1,
        emp.name,
        emp.emp_code,
        emp.department || '',
        emp.absent_days
      ]);
    });
    const wsAbsent = XLSX.utils.aoa_to_sheet(absentData);
    wsAbsent['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsAbsent, 'Most Absent');

    // Sheet 4: Perfect Attendance
    const perfectData = [
      ['Employee Name', 'Employee Code', 'Department', 'Present Days']
    ];
    summary.rankings?.perfect_attendance?.forEach(emp => {
      perfectData.push([
        emp.name,
        emp.emp_code,
        emp.department || '',
        emp.present_days
      ]);
    });
    const wsPerfect = XLSX.utils.aoa_to_sheet(perfectData);
    wsPerfect['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPerfect, 'Perfect Attendance');

    // Sheet 5: All Employee Stats
    const allStatsData = [
      ['Employee Name', 'Employee Code', 'Department', 'Present', 'Absent', 'Late', 'WFH', 'Leave', 'Total Hours']
    ];
    summary.employee_stats?.forEach(emp => {
      allStatsData.push([
        emp.name,
        emp.emp_code,
        emp.department || '',
        emp.present_days,
        emp.absent_days,
        emp.late_count,
        emp.wfh_days,
        emp.leave_days,
        emp.total_hours?.toFixed(1) || 0
      ]);
    });
    const wsAllStats = XLSX.utils.aoa_to_sheet(allStatsData);
    wsAllStats['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsAllStats, 'All Employee Stats');

    XLSX.writeFile(wb, `Attendance_Summary_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Summary report exported successfully');
  };

  const statusConfig = {
    present: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    absent: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
    half_day: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
    wfh: { icon: Home, color: 'text-blue-600', bg: 'bg-blue-100' },
    tour: { icon: Plane, color: 'text-purple-600', bg: 'bg-purple-100' },
    holiday: { icon: CalendarIcon, color: 'text-slate-600', bg: 'bg-slate-100' },
    weekly_off: { icon: CalendarIcon, color: 'text-slate-500', bg: 'bg-slate-50' },
  };

  const getStatusIndicator = (status) => {
    const config = statusConfig[status] || statusConfig.present;
    return config;
  };

  // Calculate stats
  const presentDays = viewMode === 'organization' 
    ? orgAttendance?.summary?.present || 0
    : attendance.filter(a => a.status === 'present').length;
  const absentDays = viewMode === 'organization'
    ? orgAttendance?.summary?.absent || 0
    : attendance.filter(a => a.status === 'absent').length;
  const wfhDays = viewMode === 'organization'
    ? orgAttendance?.summary?.wfh || 0
    : attendance.filter(a => a.status === 'wfh').length;
  const lateDays = viewMode === 'organization'
    ? orgAttendance?.summary?.late || 0
    : attendance.filter(a => a.is_late).length;
  const totalEmployees = orgAttendance?.summary?.total_employees || 0;

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  const formatDateRange = () => {
    if (!fromDate || !toDate) return '';
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Attendance
          </h1>
          <p className="text-slate-600 mt-1">
            {viewMode === 'organization' ? 'Organization-wide attendance overview' : 'Track and manage your attendance'}
          </p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'organization' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('organization')}
              className="gap-2"
              data-testid="view-mode-organization"
            >
              <Users className="w-4 h-4" />
              Organization
            </Button>
            <Button
              variant={viewMode === 'my' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('my')}
              className="gap-2"
              data-testid="view-mode-my"
            >
              <User className="w-4 h-4" />
              My Attendance
            </Button>
          </div>
        )}
      </div>

      {/* Quick Mark Attendance */}
      <Card className="border-primary/20 bg-primary/5" data-testid="quick-mark-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Mark Today's Attendance
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {todayAttendance && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-white">
                    First In: {todayAttendance.first_in || 'N/A'}
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    Last Out: {todayAttendance.last_out || 'In Progress'}
                  </Badge>
                  {todayAttendance.total_hours && (
                    <Badge className="bg-primary">{todayAttendance.total_hours} hrs</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Select value={attendanceSource} onValueChange={setAttendanceSource}>
                <SelectTrigger className="w-full sm:w-32 bg-white" data-testid="source-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Office</SelectItem>
                  <SelectItem value="wfh">WFH</SelectItem>
                  <SelectItem value="tour">Tour</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleMarkAttendance('IN')}
                  disabled={markingAttendance}
                  className="flex-1 sm:flex-none gap-2"
                  data-testid="punch-in-btn"
                >
                  <Clock className="w-4 h-4" />
                  Punch In
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleMarkAttendance('OUT')}
                  disabled={markingAttendance}
                  className="flex-1 sm:flex-none bg-white"
                  data-testid="punch-out-btn"
                >
                  Punch Out
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {viewMode === 'organization' && (
          <Card data-testid="stat-total" className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalEmployees}</p>
                  <p className="text-xs text-slate-500">Total Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card data-testid="stat-present">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{presentDays}</p>
                <p className="text-xs text-slate-500">{viewMode === 'organization' ? 'Present Today' : 'Present'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-absent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{absentDays}</p>
                <p className="text-xs text-slate-500">{viewMode === 'organization' ? 'Absent Today' : 'Absent'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-wfh">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{wfhDays}</p>
                <p className="text-xs text-slate-500">WFH</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-late">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lateDays}</p>
                <p className="text-xs text-slate-500">Late</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization View - History with Date Range and Summary */}
      {viewMode === 'organization' && isHR && (
        <>
          {/* Date Range Filters */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Attendance History & Analytics</CardTitle>
                  <CardDescription>{formatDateRange()}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Date Preset */}
                  <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                    <SelectTrigger className="w-[160px]" data-testid="date-preset">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="year_to_date">Year to Date</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Custom Date Inputs */}
                  {dateRangePreset === 'custom' && (
                    <>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-[140px]"
                        data-testid="from-date"
                      />
                      <span className="text-slate-400">to</span>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-[140px]"
                        data-testid="to-date"
                      />
                    </>
                  )}

                  {/* Employee Filter */}
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-[200px]" data-testid="filter-employee">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.employee_id} value={emp.employee_id}>
                          {emp.first_name} {emp.last_name} ({emp.emp_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={() => { fetchHistoryAttendance(); fetchSummary(); }} data-testid="refresh-history">
                    <RefreshCw className={`w-4 h-4 mr-2 ${historyLoading || summaryLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Tabs for Records vs Summary */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="records" className="gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Records
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Summary & Analytics
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Export Button */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={activeTab === 'records' ? exportRecordsToExcel : exportSummaryToExcel}
                    className="gap-2"
                    data-testid="export-excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export to Excel
                  </Button>
                </div>

                {/* Records Tab */}
                <TabsContent value="records">
                  {historyLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                      <p className="text-slate-500">Loading attendance history...</p>
                    </div>
                  ) : historyAttendance.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Date</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>In Time</TableHead>
                            <TableHead>Out Time</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Late</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyAttendance.map((att, idx) => {
                            const statusConfigTable = {
                              present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
                              wfh: { label: 'WFH', className: 'bg-blue-100 text-blue-700' },
                              absent: { label: 'Absent', className: 'bg-red-100 text-red-700' },
                              leave: { label: 'Leave', className: 'bg-purple-100 text-purple-700' },
                              holiday: { label: 'Holiday', className: 'bg-slate-100 text-slate-700' },
                              weekly_off: { label: 'Week Off', className: 'bg-slate-100 text-slate-600' },
                              tour: { label: 'Tour', className: 'bg-indigo-100 text-indigo-700' },
                            };
                            const config = statusConfigTable[att.status] || statusConfigTable.present;
                            return (
                              <TableRow key={att.attendance_id || idx}>
                                <TableCell className="font-medium">
                                  {new Date(att.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{att.employee_name || att.employee_id}</p>
                                    <p className="text-xs text-slate-500">{att.emp_code}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={config.className}>{config.label}</Badge>
                                </TableCell>
                                <TableCell className="text-slate-600 font-mono">{att.first_in || '-'}</TableCell>
                                <TableCell className="text-slate-600 font-mono">{att.last_out || '-'}</TableCell>
                                <TableCell>{att.total_hours ? `${att.total_hours}h` : '-'}</TableCell>
                                <TableCell>
                                  {att.is_late ? (
                                    <Badge variant="destructive" className="text-xs">
                                      {att.late_minutes ? `${att.late_minutes} min` : 'Late'}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-2">No attendance records found</p>
                      <p className="text-xs text-slate-400">Try adjusting the date range or filters</p>
                    </div>
                  )}
                </TabsContent>

                {/* Summary Tab */}
                <TabsContent value="summary">
                  {summaryLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                      <p className="text-slate-500">Calculating summary...</p>
                    </div>
                  ) : summary ? (
                    <div className="space-y-6">
                      {/* Period Info */}
                      <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                        <strong>Period:</strong> {summary.from_date} to {summary.to_date} | 
                        <strong> Working Days:</strong> {summary.working_days_in_range || 0} | 
                        <strong> Holidays:</strong> {summary.holidays_in_range || 0} | 
                        <strong> Employees:</strong> {summary.overall_summary?.employees_tracked || 0}
                      </div>
                      
                      {/* Overall Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <Card className="bg-emerald-50">
                          <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-600">{summary.overall_summary?.total_present || 0}</p>
                            <p className="text-sm text-slate-500">Present Days</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-red-50">
                          <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-red-600">{summary.overall_summary?.total_absent || 0}</p>
                            <p className="text-sm text-slate-500">Absent Days</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-amber-50">
                          <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-amber-600">{summary.overall_summary?.total_late || 0}</p>
                            <p className="text-sm text-slate-500">Total Late Instances</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50">
                          <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-blue-600">{summary.overall_summary?.total_wfh || 0}</p>
                            <p className="text-sm text-slate-500">Total WFH Days</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-emerald-50">
                          <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-600">{summary.overall_summary?.perfect_attendance_count || 0}</p>
                            <p className="text-sm text-slate-500">Perfect Attendance</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Rankings Grid */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Most Late */}
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-amber-500" />
                              <CardTitle className="text-base">Most Late (Top 10)</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {summary.rankings?.most_late?.filter(e => e.late_count > 0).length > 0 ? (
                              <div className="space-y-2">
                                {summary.rankings.most_late.filter(e => e.late_count > 0).slice(0, 10).map((emp, idx) => (
                                  <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                    <div className="flex items-center gap-3">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>
                                        {idx + 1}
                                      </span>
                                      <div>
                                        <p className="font-medium text-sm">{emp.name}</p>
                                        <p className="text-xs text-slate-500">{emp.emp_code}</p>
                                      </div>
                                    </div>
                                    <Badge variant="destructive">{emp.late_count} times</Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 text-center py-4">No late arrivals in this period</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Most Absent */}
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-red-500" />
                              <CardTitle className="text-base">Most Absent (Top 10)</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {summary.rankings?.most_absent?.filter(e => e.absent_days > 0).length > 0 ? (
                              <div className="space-y-2">
                                {summary.rankings.most_absent.filter(e => e.absent_days > 0).slice(0, 10).map((emp, idx) => (
                                  <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                    <div className="flex items-center gap-3">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-red-500 text-white' : 'bg-slate-200'}`}>
                                        {idx + 1}
                                      </span>
                                      <div>
                                        <p className="font-medium text-sm">{emp.name}</p>
                                        <p className="text-xs text-slate-500">{emp.emp_code}</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-red-100 text-red-700">{emp.absent_days} days</Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 text-center py-4">No absences in this period</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Perfect Attendance */}
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Award className="w-5 h-5 text-emerald-500" />
                              <CardTitle className="text-base">Perfect Attendance</CardTitle>
                            </div>
                            <CardDescription>No absences and no late arrivals</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {summary.rankings?.perfect_attendance?.length > 0 ? (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {summary.rankings.perfect_attendance.map((emp, idx) => (
                                  <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                                    <div className="flex items-center gap-3">
                                      <Award className="w-5 h-5 text-emerald-500" />
                                      <div>
                                        <p className="font-medium text-sm">{emp.name}</p>
                                        <p className="text-xs text-slate-500">{emp.emp_code}</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-700">{emp.present_days} days</Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 text-center py-4">No perfect attendance in this period</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Most Hours */}
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-blue-500" />
                              <CardTitle className="text-base">Most Hours Worked (Top 10)</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {summary.rankings?.most_hours?.filter(e => e.total_hours > 0).length > 0 ? (
                              <div className="space-y-2">
                                {summary.rankings.most_hours.filter(e => e.total_hours > 0).slice(0, 10).map((emp, idx) => (
                                  <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                    <div className="flex items-center gap-3">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-blue-500 text-white' : 'bg-slate-200'}`}>
                                        {idx + 1}
                                      </span>
                                      <div>
                                        <p className="font-medium text-sm">{emp.name}</p>
                                        <p className="text-xs text-slate-500">{emp.emp_code}</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-blue-100 text-blue-700">{emp.total_hours.toFixed(1)}h</Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 text-center py-4">No hour data available</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* All Employee Stats Table */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">All Employee Statistics</CardTitle>
                          <CardDescription>Detailed breakdown for each employee in the selected period</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50">
                                  <TableHead>Employee</TableHead>
                                  <TableHead className="text-center">Present</TableHead>
                                  <TableHead className="text-center">Absent</TableHead>
                                  <TableHead className="text-center">Late</TableHead>
                                  <TableHead className="text-center">WFH</TableHead>
                                  <TableHead className="text-center">Leave</TableHead>
                                  <TableHead className="text-center">Total Hours</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {summary.employee_stats?.map((emp) => (
                                  <TableRow key={emp.employee_id}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{emp.name}</p>
                                        <p className="text-xs text-slate-500">{emp.emp_code}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge className="bg-emerald-100 text-emerald-700">{emp.present_days}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {emp.absent_days > 0 ? (
                                        <Badge className="bg-red-100 text-red-700">{emp.absent_days}</Badge>
                                      ) : (
                                        <span className="text-slate-400">0</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {emp.late_count > 0 ? (
                                        <Badge variant="destructive">{emp.late_count}</Badge>
                                      ) : (
                                        <span className="text-slate-400">0</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {emp.wfh_days > 0 ? (
                                        <Badge className="bg-blue-100 text-blue-700">{emp.wfh_days}</Badge>
                                      ) : (
                                        <span className="text-slate-400">0</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {emp.leave_days > 0 ? (
                                        <Badge className="bg-purple-100 text-purple-700">{emp.leave_days}</Badge>
                                      ) : (
                                        <span className="text-slate-400">0</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center font-mono">
                                      {emp.total_hours > 0 ? `${emp.total_hours.toFixed(1)}h` : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">Select a date range to view summary</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* My Attendance View - Calendar & Details */}
      {viewMode === 'my' && (
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-5" data-testid="calendar-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={selectedDate}
              onMonthChange={setSelectedDate}
              className="rounded-md"
              modifiers={{
                present: attendance.filter(a => a.status === 'present').map(a => new Date(a.date)),
                absent: attendance.filter(a => a.status === 'absent').map(a => new Date(a.date)),
                wfh: attendance.filter(a => a.status === 'wfh').map(a => new Date(a.date)),
              }}
              modifiersClassNames={{
                present: 'bg-emerald-100 text-emerald-900',
                absent: 'bg-red-100 text-red-900',
                wfh: 'bg-blue-100 text-blue-900',
              }}
            />
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-600">Present</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-slate-600">WFH</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-slate-600">Absent</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Details */}
        <Card className="lg:col-span-7" data-testid="attendance-list-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Attendance Log
            </CardTitle>
            <CardDescription>Your attendance records for this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {attendance.length > 0 ? (
                attendance
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((record) => {
                    const status = getStatusIndicator(record.status);
                    const StatusIcon = status.icon;
                    return (
                      <div 
                        key={record.attendance_id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        data-testid={`attendance-record-${record.date}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${status.bg} flex items-center justify-center`}>
                            <StatusIcon className={`w-5 h-5 ${status.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-sm text-slate-500">
                              {record.first_in || '--:--'} - {record.last_out || '--:--'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="capitalize mb-1">
                            {record.status.replace('_', ' ')}
                          </Badge>
                          {record.is_late && (
                            <Badge variant="destructive" className="ml-1 text-xs">Late</Badge>
                          )}
                          {record.total_hours && (
                            <p className="text-sm text-slate-600">{record.total_hours} hrs</p>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No attendance records for this month</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
};

export default AttendancePage;
