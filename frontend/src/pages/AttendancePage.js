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
  Download
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AttendancePage = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [orgAttendance, setOrgAttendance] = useState(null);
  const [historyAttendance, setHistoryAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceSource, setAttendanceSource] = useState('manual');
  const [viewMode, setViewMode] = useState(isHR ? 'organization' : 'my'); // HR sees organization by default, employees see their own
  
  // HR filters for organization view
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  const currentMonth = selectedDate.getMonth() + 1;
  const currentYear = selectedDate.getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchAttendance();
    if (isHR) {
      fetchEmployees();
    }
  }, [currentMonth, currentYear, viewMode]);

  useEffect(() => {
    if (isHR && viewMode === 'organization') {
      fetchHistoryAttendance();
    }
  }, [filterMonth, filterYear, selectedEmployee, viewMode]);

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
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        month: filterMonth,
        year: filterYear
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

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      
      // Always fetch organization data for the summary cards
      const orgResponse = await fetch(
        `${API_URL}/attendance/organization?month=${currentMonth}&year=${currentYear}&date=${todayStr}`,
        { credentials: 'include', headers: authHeaders }
      );
      
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        setOrgAttendance(orgData);
      }
      
      // Also fetch personal attendance
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
      // Get geo-location
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

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  // Summary stats - use org data for organization view
  const summary = orgAttendance?.summary || {};
  const presentDays = viewMode === 'organization' ? summary.present || 0 : attendance.filter(a => a.status === 'present').length;
  const wfhDays = viewMode === 'organization' ? summary.wfh || 0 : attendance.filter(a => a.status === 'wfh').length;
  const absentDays = viewMode === 'organization' ? summary.absent || 0 : attendance.filter(a => a.status === 'absent').length;
  const lateDays = viewMode === 'organization' ? summary.late || 0 : attendance.filter(a => a.is_late).length;
  const totalEmployees = summary.total_employees || 0;
  const unmarkedCount = summary.unmarked || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Attendance
          </h1>
          <p className="text-slate-600 mt-1">
            {viewMode === 'organization' ? 'Organization-wide attendance overview' : 'Track and manage your attendance'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'organization' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('organization')}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Organization
          </Button>
          <Button
            variant={viewMode === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('my')}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            My Attendance
          </Button>
        </div>
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

        <Card data-testid="stat-wfh">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{wfhDays}</p>
                <p className="text-xs text-slate-500">{viewMode === 'organization' ? 'WFH Today' : 'WFH'}</p>
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

        <Card data-testid="stat-late">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{viewMode === 'organization' ? unmarkedCount : lateDays}</p>
                <p className="text-xs text-slate-500">{viewMode === 'organization' ? 'Unmarked' : 'Late'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Attendance Section - Show when in organization view */}
      {viewMode === 'organization' && isHR && (
        <>
          {/* Today's Attendance Quick View */}
          {orgAttendance?.today_attendance && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Today's Attendance
                    </CardTitle>
                    <CardDescription>
                      {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{orgAttendance.today_attendance.length} records</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Emp Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgAttendance.today_attendance.length > 0 ? (
                        orgAttendance.today_attendance.slice(0, 10).map((att, idx) => {
                          const statusConfig = {
                            present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
                            wfh: { label: 'WFH', className: 'bg-blue-100 text-blue-700' },
                            absent: { label: 'Absent', className: 'bg-red-100 text-red-700' },
                            leave: { label: 'Leave', className: 'bg-purple-100 text-purple-700' },
                            holiday: { label: 'Holiday', className: 'bg-slate-100 text-slate-700' },
                            weekly_off: { label: 'Week Off', className: 'bg-slate-100 text-slate-600' },
                          };
                          const config = statusConfig[att.status] || statusConfig.present;
                          return (
                            <TableRow key={att.attendance_id || idx}>
                              <TableCell className="font-medium">{att.emp_code}</TableCell>
                              <TableCell>{att.employee_name}</TableCell>
                              <TableCell>{att.department || '-'}</TableCell>
                              <TableCell>
                                <Badge className={config.className}>{config.label}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {att.first_in || att.created_at?.split('T')[1]?.substring(0, 5) || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                            No attendance records for today
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historical Attendance with Filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    Attendance History
                  </CardTitle>
                  <CardDescription>View and filter attendance records by month, year, and employee</CardDescription>
                </div>
                <div className="flex flex-wrap gap-3">
                  {/* Month Select */}
                  <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(parseInt(v))}>
                    <SelectTrigger className="w-[140px]" data-testid="filter-month">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: '1', label: 'January' },
                        { value: '2', label: 'February' },
                        { value: '3', label: 'March' },
                        { value: '4', label: 'April' },
                        { value: '5', label: 'May' },
                        { value: '6', label: 'June' },
                        { value: '7', label: 'July' },
                        { value: '8', label: 'August' },
                        { value: '9', label: 'September' },
                        { value: '10', label: 'October' },
                        { value: '11', label: 'November' },
                        { value: '12', label: 'December' }
                      ].map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Year Select */}
                  <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
                    <SelectTrigger className="w-[100px]" data-testid="filter-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Employee Search */}
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

                  <Button variant="outline" onClick={fetchHistoryAttendance} data-testid="refresh-history">
                    <RefreshCw className={`w-4 h-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                        <TableHead>Punch In</TableHead>
                        <TableHead>Punch Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Late</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyAttendance.map((att, idx) => {
                        const statusConfig = {
                          present: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
                          wfh: { label: 'WFH', className: 'bg-blue-100 text-blue-700' },
                          absent: { label: 'Absent', className: 'bg-red-100 text-red-700' },
                          leave: { label: 'Leave', className: 'bg-purple-100 text-purple-700' },
                          holiday: { label: 'Holiday', className: 'bg-slate-100 text-slate-700' },
                          weekly_off: { label: 'Week Off', className: 'bg-slate-100 text-slate-600' },
                          tour: { label: 'Tour', className: 'bg-indigo-100 text-indigo-700' },
                        };
                        const config = statusConfig[att.status] || statusConfig.present;
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
                            <TableCell className="text-slate-600">{att.first_in || att.punch_in || '-'}</TableCell>
                            <TableCell className="text-slate-600">{att.last_out || att.punch_out || '-'}</TableCell>
                            <TableCell>{att.total_hours ? `${att.total_hours}h` : '-'}</TableCell>
                            <TableCell>
                              {att.is_late ? (
                                <Badge variant="destructive" className="text-xs">Late</Badge>
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
                  <p className="text-xs text-slate-400">Try adjusting the filters or select a different time period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Calendar & Details - Show when in my attendance view */}
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
          <CardContent className="pb-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={selectedDate}
              onMonthChange={setSelectedDate}
              className="rounded-md border-0"
              modifiers={{
                present: (date) => getAttendanceForDate(date)?.status === 'present',
                absent: (date) => getAttendanceForDate(date)?.status === 'absent',
                wfh: (date) => getAttendanceForDate(date)?.status === 'wfh',
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
