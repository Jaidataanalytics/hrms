import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  ChevronRight
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AttendancePage = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceSource, setAttendanceSource] = useState('manual');

  const currentMonth = selectedDate.getMonth() + 1;
  const currentYear = selectedDate.getFullYear();

  useEffect(() => {
    fetchAttendance();
  }, [currentMonth, currentYear]);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(
        `${API_URL}/attendance/my?month=${currentMonth}&year=${currentYear}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
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

  // Summary stats
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const wfhDays = attendance.filter(a => a.status === 'wfh').length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const lateDays = attendance.filter(a => a.is_late).length;

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
          <p className="text-slate-600 mt-1">Track and manage your attendance</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card data-testid="stat-present">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{presentDays}</p>
                <p className="text-xs text-slate-500">Present</p>
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

        <Card data-testid="stat-absent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{absentDays}</p>
                <p className="text-xs text-slate-500">Absent</p>
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

      {/* Calendar & Details */}
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
    </div>
  );
};

export default AttendancePage;
