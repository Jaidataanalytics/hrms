import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Building2,
  Minus,
  ArrowUp,
  ArrowDown,
  Edit,
  Plus,
  History,
  Save,
  Grid,
  Search,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AttendancePage = () => {
  const { user } = useAuth();
  
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [mySummary, setMySummary] = useState(null);
  const [historyAttendance, setHistoryAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Calendar view state
  const [calendarData, setCalendarData] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  
  // Date range
  const [dateRangePreset, setDateRangePreset] = useState('current_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [activeTab, setActiveTab] = useState('calendar');

  // Grid View state
  const [gridData, setGridData] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridDepartment, setGridDepartment] = useState('all');
  const [gridSearch, setGridSearch] = useState('');
  const [gridFromDate, setGridFromDate] = useState('');
  const [gridToDate, setGridToDate] = useState('');
  const [gridEditDialogOpen, setGridEditDialogOpen] = useState(false);
  const [gridEditingCell, setGridEditingCell] = useState(null);
  const [gridEditForm, setGridEditForm] = useState({
    status: 'present',
    first_in: '',
    last_out: '',
    remarks: '',
    edit_reason: ''
  });
  const [departments, setDepartments] = useState([]);

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
    if (dateRangePreset !== 'custom') {
      const { from, to } = getDateRange(dateRangePreset);
      setFromDate(from);
      setToDate(to);
    }
  }, [dateRangePreset]);

  useEffect(() => {
    if (fromDate && toDate) {
      if (isHR) {
        fetchSummary();
        fetchEmployees();
        fetchCalendarData();
        fetchDepartments();
      } else {
        fetchMySummary();
      }
    }
  }, [fromDate, toDate, selectedEmployee]);

  // Initialize grid dates when switching to grid tab
  useEffect(() => {
    if (activeTab === 'grid' && !gridFromDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      setGridFromDate(`${year}-${String(month + 1).padStart(2, '0')}-01`);
      setGridToDate(today.toISOString().split('T')[0]);
    }
  }, [activeTab]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_URL}/departments`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchGridData = async () => {
    if (!gridFromDate || !gridToDate) {
      toast.error('Please select date range');
      return;
    }

    setGridLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: gridFromDate,
        to_date: gridToDate
      });
      if (gridDepartment && gridDepartment !== 'all') {
        params.append('department_id', gridDepartment);
      }
      if (gridSearch) {
        params.append('search', gridSearch);
      }

      const response = await fetch(
        `${API_URL}/attendance/grid?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setGridData(data);
      } else {
        toast.error('Failed to fetch grid data');
      }
    } catch (error) {
      console.error('Error fetching grid data:', error);
      toast.error('Failed to fetch grid data');
    } finally {
      setGridLoading(false);
    }
  };

  const handleGridCellClick = (row, cell) => {
    if (!cell.is_editable || cell.status === 'sunday' || cell.status === 'holiday') return;
    
    setGridEditingCell({ 
      ...cell, 
      employee_id: row.employee_id,
      employee_name: row.name,
      emp_code: row.emp_code
    });
    setGridEditForm({
      status: cell.status === 'no_record' ? 'present' : cell.status,
      first_in: cell.first_in || '',
      last_out: cell.last_out || '',
      remarks: '',
      edit_reason: ''
    });
    setGridEditDialogOpen(true);
  };

  const handleGridSaveEdit = async () => {
    if (!gridEditingCell) return;
    
    if (!gridEditForm.edit_reason) {
      toast.error('Please provide a reason for the edit');
      return;
    }

    try {
      let response;
      
      if (gridEditingCell.attendance_id) {
        // Update existing record
        response = await fetch(
          `${API_URL}/attendance/${gridEditingCell.attendance_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify(gridEditForm)
          }
        );
      } else {
        // Create new record
        response = await fetch(
          `${API_URL}/attendance/manual`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({
              employee_id: gridEditingCell.employee_id,
              date: gridEditingCell.date,
              ...gridEditForm
            })
          }
        );
      }

      if (response.ok) {
        toast.success('Attendance updated');
        setGridEditDialogOpen(false);
        setGridEditingCell(null);
        fetchGridData();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to update attendance');
      }
    } catch (error) {
      toast.error('Failed to update attendance');
    }
  };

  const exportGridToExcel = () => {
    if (!gridData || !gridData.rows.length) {
      toast.error('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Build header row
    const headerRow = ['Employee Code', 'Name', 'Department', ...gridData.dates.map(d => d.date), 'Present', 'Absent', 'Late', 'WFH', 'Leave'];
    
    // Build data rows
    const dataRows = gridData.rows.map(row => {
      const cells = row.cells.map(c => {
        if (c.status === 'sunday') return 'SUN';
        if (c.status === 'holiday') return 'HOL';
        if (c.status === 'present') return c.is_late ? 'P(L)' : 'P';
        if (c.status === 'absent') return 'A';
        if (c.status === 'wfh') return 'WFH';
        if (c.status === 'leave') return 'L';
        if (c.status === 'half_day' || c.status === 'HD') return 'HD';
        if (c.status === 'no_record') return '-';
        return c.status || '-';
      });
      
      return [
        row.emp_code,
        row.name,
        row.department,
        ...cells,
        row.summary.present,
        row.summary.absent,
        row.summary.late,
        row.summary.wfh,
        row.summary.leave
      ];
    });

    const wsData = [headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Grid');

    XLSX.writeFile(wb, `Attendance_Grid_${gridFromDate}_to_${gridToDate}.xlsx`);
    toast.success('Grid exported successfully');
  };

  const fetchCalendarData = async () => {
    if (!fromDate || !toDate) return;
    
    setCalendarLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate
      });
      
      const response = await fetch(
        `${API_URL}/attendance/calendar-data?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data.calendar_data || []);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDateClick = (dayData) => {
    setSelectedCalendarDate(dayData.date);
    setSelectedDayDetails(dayData);
  };

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

  const fetchSummary = async () => {
    if (!fromDate || !toDate) return;
    
    setSummaryLoading(true);
    setLoading(true);
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
      setLoading(false);
    }
  };

  const fetchMySummary = async () => {
    if (!fromDate || !toDate) return;
    
    setSummaryLoading(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate
      });
      
      const response = await fetch(
        `${API_URL}/attendance/my-summary?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMySummary(data);
      }
    } catch (error) {
      console.error('Error fetching my summary:', error);
    } finally {
      setSummaryLoading(false);
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!summary) {
      toast.error('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Overview sheet
    const overviewData = [
      ['Attendance Analytics Report'],
      ['Period', `${fromDate} to ${toDate}`],
      ['Working Days', summary.working_days_in_range],
      ['Holidays', summary.holidays_in_range],
      ['Total Employees', summary.total_employees],
      [''],
      ['Key Metrics'],
      ['Attendance Rate', `${summary.overview?.attendance_rate}%`],
      ['Avg Daily Attendance', summary.overview?.avg_daily_attendance],
      ['Perfect Days', summary.overview?.perfect_days_count],
      ['High Absence Days', summary.overview?.high_absence_days_count],
      ['Late Instances', summary.overview?.late_instances],
      ['WFH Count', summary.overview?.wfh_count],
      ['Leave Count', summary.overview?.leave_count],
      ['Trend', summary.overview?.trend]
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

    // Employee Stats
    if (summary.employee_stats) {
      const empData = [
        ['Name', 'Code', 'Department', 'Present', 'Absent', 'Late', 'WFH', 'Leave', 'Hours']
      ];
      summary.employee_stats.forEach(e => {
        empData.push([e.name, e.emp_code, e.department, e.present_days, e.absent_days, e.late_count, e.wfh_count, e.leave_count, e.total_hours?.toFixed(1)]);
      });
      const wsEmp = XLSX.utils.aoa_to_sheet(empData);
      XLSX.utils.book_append_sheet(wb, wsEmp, 'Employee Stats');
    }

    // Department Stats
    if (summary.department_analysis) {
      const deptData = [
        ['Department', 'Employees', 'Present Days', 'Absent Days', 'Late Count', 'Attendance Rate']
      ];
      summary.department_analysis.forEach(d => {
        deptData.push([d.department, d.employees, d.present_days, d.absent_days, d.late_count, `${d.attendance_rate}%`]);
      });
      const wsDept = XLSX.utils.aoa_to_sheet(deptData);
      XLSX.utils.book_append_sheet(wb, wsDept, 'Department');
    }

    XLSX.writeFile(wb, `Attendance_Analytics_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Report exported successfully');
  };

  const formatDateRange = () => {
    if (!fromDate || !toDate) return '';
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (loading && !summary && !mySummary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Employee view - personal summary only
  if (!isHR) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="section-pill mono-accent">// My Attendance</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>My Attendance</h1>
            <p className="text-slate-500 text-sm mt-1">Your personal attendance summary</p>
            <div className="header-accent-line mt-3 max-w-[140px]" />
          </div>
          <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="year_to_date">Year to Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mySummary && (
          <>
            <div className="p-3 bg-primary/5 rounded-xl text-sm text-slate-600 border border-primary/10">
              <strong>Period:</strong> {mySummary.from_date} to {mySummary.to_date} | 
              <strong> Working Days:</strong> {mySummary.working_days}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger-children">
              {[
                { value: mySummary.summary?.present_days || 0, label: 'Present Days', color: 'emerald' },
                { value: mySummary.summary?.absent_days || 0, label: 'Absent Days', color: 'rose' },
                { value: mySummary.summary?.late_count || 0, label: 'Late Instances', color: 'amber' },
                { value: mySummary.summary?.wfh_count || 0, label: 'WFH', color: 'blue' },
                { value: mySummary.summary?.leave_count || 0, label: 'Leave', color: 'purple' },
              ].map((stat, i) => (
                <div key={i} className={`premium-stat stat-${stat.color}`}>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Attendance Rate</span>
                    <span className="text-2xl font-bold text-emerald-600">{mySummary.summary?.attendance_rate}%</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Avg Hours/Day</span>
                    <span className="text-2xl font-bold text-blue-600">{mySummary.summary?.avg_hours_per_day}h</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>In Time</TableHead>
                        <TableHead>Out Time</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Late</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mySummary.attendance_records?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((att, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(att.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell>
                            <Badge className={
                              att.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 
                              att.status === 'wfh' ? 'bg-blue-100 text-blue-700' : 
                              att.status === 'half_day' || att.status === 'HD' ? 'bg-amber-100 text-amber-700' :
                              att.status === 'leave' ? 'bg-purple-100 text-purple-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {att.status === 'half_day' || att.status === 'HD' ? 'Half Day' : att.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{att.first_in || '-'}</TableCell>
                          <TableCell className="font-mono">{att.last_out || '-'}</TableCell>
                          <TableCell>{att.total_hours ? `${att.total_hours}h` : '-'}</TableCell>
                          <TableCell>
                            {att.is_late ? <Badge variant="destructive">{att.late_minutes}m</Badge> : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // HR/Admin view - full analytics
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Analytics</h1>
          <p className="text-slate-600 mt-1">{formatDateRange()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
            <SelectTrigger className="w-[160px]">
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

          {dateRangePreset === 'custom' && (
            <>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[140px]" />
              <span className="text-slate-400">to</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[140px]" />
            </>
          )}

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.employee_id} value={emp.employee_id}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchSummary} disabled={summaryLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${summaryLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {summary && (
        <>
          {/* Period Info */}
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>Period:</strong> {summary.from_date} to {summary.to_date} | 
            <strong> Working Days:</strong> {summary.working_days_in_range} | 
            <strong> Holidays:</strong> {summary.holidays_in_range} | 
            <strong> Employees:</strong> {summary.total_employees} |
            <strong> Trend:</strong> <span className="inline-flex items-center gap-1">{getTrendIcon(summary.overview?.trend)} {summary.overview?.trend}</span>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="grid" className="gap-2" data-testid="tab-grid-view">
                <Grid className="w-4 h-4" />
                Grid View
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="patterns" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Patterns
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <Users className="w-4 h-4" />
                Employee Insights
              </TabsTrigger>
              <TabsTrigger value="department" className="gap-2">
                <Building2 className="w-4 h-4" />
                Department
              </TabsTrigger>
            </TabsList>

            {/* Calendar Tab */}
            <TabsContent value="calendar">
              {calendarLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Calendar Grid */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5" />
                          Attendance Calendar
                        </CardTitle>
                        <CardDescription>
                          Click on a date to see detailed attendance breakdown
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-xs font-semibold text-slate-500 py-2">{day}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {/* Add padding for the first day */}
                          {calendarData.length > 0 && (() => {
                            const firstDate = new Date(calendarData[0].date);
                            const padding = [];
                            for (let i = 0; i < firstDate.getDay(); i++) {
                              padding.push(<div key={`pad-${i}`} className="aspect-square"></div>);
                            }
                            return padding;
                          })()}
                          
                          {calendarData.map((day) => {
                            const isSelected = selectedCalendarDate === day.date;
                            const isSunday = day.is_sunday;
                            const isHoliday = day.is_holiday;
                            const hasData = !isSunday && !isHoliday;
                            
                            return (
                              <div
                                key={day.date}
                                onClick={() => hasData && handleDateClick(day)}
                                className={`
                                  aspect-square p-1 rounded-lg border text-center flex flex-col justify-center
                                  ${hasData ? 'cursor-pointer hover:shadow-md transition-shadow' : 'cursor-default'}
                                  ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                                  ${isSunday ? 'bg-slate-100' : ''}
                                  ${isHoliday ? 'bg-orange-50 border-orange-200' : ''}
                                  ${hasData && !isSelected ? 'bg-white hover:bg-slate-50' : ''}
                                `}
                                data-testid={`calendar-day-${day.date}`}
                              >
                                <div className="text-xs font-semibold text-slate-700 mb-1">
                                  {new Date(day.date).getDate()}
                                </div>
                                
                                {isSunday && (
                                  <div className="text-[9px] text-slate-400">Sun</div>
                                )}
                                
                                {isHoliday && (
                                  <div className="text-[9px] text-orange-600 truncate" title={day.holiday_name}>
                                    {day.holiday_name?.slice(0, 6)}...
                                  </div>
                                )}
                                
                                {hasData && (
                                  <div className="flex flex-col gap-0.5 text-[9px]">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                      <span className="text-emerald-700 font-medium">{day.present_count}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                      <span className="text-amber-700 font-medium">{day.late_count}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                      <span className="text-red-700 font-medium">{day.absent_count}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className="text-sm text-slate-600">Present</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            <span className="text-sm text-slate-600">Late</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            <span className="text-sm text-slate-600">Absent</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Day Details Panel */}
                  <div className="lg:col-span-1">
                    {selectedDayDetails ? (
                      <Card className="sticky top-4">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">
                            {new Date(selectedDayDetails.date).toLocaleDateString('en-IN', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </CardTitle>
                          <CardDescription>
                            <div className="flex gap-4 mt-2">
                              <Badge className="bg-emerald-100 text-emerald-700">{selectedDayDetails.present_count} Present</Badge>
                              <Badge className="bg-amber-100 text-amber-700">{selectedDayDetails.late_count} Late</Badge>
                              <Badge className="bg-red-100 text-red-700">{selectedDayDetails.absent_count} Absent</Badge>
                            </div>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="max-h-[500px] overflow-y-auto">
                          {/* Present Employees */}
                          {selectedDayDetails.present_employees?.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Present ({selectedDayDetails.present_count})
                              </h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {selectedDayDetails.present_employees.map((emp, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-emerald-50 rounded">
                                    <span className="font-medium truncate flex-1">{emp.name}</span>
                                    <span className="text-slate-500 ml-2">
                                      {emp.in_time && `${emp.in_time}`}
                                      {emp.in_time && emp.out_time && ' - '}
                                      {emp.out_time && `${emp.out_time}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Late Employees */}
                          {selectedDayDetails.late_employees?.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Late ({selectedDayDetails.late_count})
                              </h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {selectedDayDetails.late_employees.map((emp, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-amber-50 rounded">
                                    <span className="font-medium truncate flex-1">{emp.name}</span>
                                    <span className="text-slate-500 ml-2">
                                      {emp.in_time && `${emp.in_time}`}
                                      {emp.in_time && emp.out_time && ' - '}
                                      {emp.out_time && `${emp.out_time}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Absent Employees */}
                          {selectedDayDetails.absent_employees?.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Absent ({selectedDayDetails.absent_count})
                              </h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {selectedDayDetails.absent_employees.map((emp, idx) => (
                                  <div key={idx} className="text-xs p-2 bg-red-50 rounded">
                                    <span className="font-medium">{emp.name}</span>
                                    {emp.emp_code && <span className="text-slate-400 ml-2">({emp.emp_code})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">Select a date to view attendance details</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Grid View Tab */}
            <TabsContent value="grid">
              <div className="space-y-4">
                {/* Grid Filters */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">From Date</Label>
                        <Input
                          type="date"
                          value={gridFromDate}
                          onChange={(e) => setGridFromDate(e.target.value)}
                          className="w-[150px]"
                          data-testid="grid-from-date"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">To Date</Label>
                        <Input
                          type="date"
                          value={gridToDate}
                          onChange={(e) => setGridToDate(e.target.value)}
                          className="w-[150px]"
                          data-testid="grid-to-date"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Department</Label>
                        <Select value={gridDepartment} onValueChange={setGridDepartment}>
                          <SelectTrigger className="w-[180px]" data-testid="grid-department-select">
                            <SelectValue placeholder="All Departments" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.department_id} value={dept.department_id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Search Employee</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="Name or Code..."
                            value={gridSearch}
                            onChange={(e) => setGridSearch(e.target.value)}
                            className="w-[180px] pl-9"
                            data-testid="grid-search"
                          />
                        </div>
                      </div>
                      <Button onClick={fetchGridData} disabled={gridLoading} data-testid="load-grid-btn">
                        {gridLoading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Load Grid
                      </Button>
                      {gridData && (
                        <Button variant="outline" onClick={exportGridToExcel} data-testid="export-grid-btn">
                          <Download className="w-4 h-4 mr-2" />
                          Export Excel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Grid Table */}
                {gridLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : gridData ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Grid className="w-5 h-5 text-primary" />
                            Attendance Grid ({gridData.total_employees} employees)
                          </CardTitle>
                          <CardDescription>
                            Click on any cell to edit attendance. Period: {gridFromDate} to {gridToDate}
                          </CardDescription>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Present</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Late</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Absent</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span> WFH</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500"></span> Leave</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300"></span> No Record</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead className="sticky top-0 z-10 bg-slate-100">
                            <tr>
                              <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-left font-semibold border-b border-r min-w-[180px]">
                                Employee
                              </th>
                              {gridData.dates.map((d) => (
                                <th 
                                  key={d.date} 
                                  className={`px-1 py-2 text-center border-b min-w-[40px] text-xs ${
                                    d.is_sunday ? 'bg-slate-200' : d.is_holiday ? 'bg-orange-100' : ''
                                  }`}
                                  title={d.is_holiday ? d.holiday_name : d.date}
                                >
                                  <div className="font-semibold">{d.day_num}</div>
                                  <div className="text-[10px] text-slate-500">{d.day_name}</div>
                                </th>
                              ))}
                              <th className="px-2 py-2 text-center border-b border-l bg-emerald-50 text-emerald-700 font-semibold">P</th>
                              <th className="px-2 py-2 text-center border-b bg-red-50 text-red-700 font-semibold">A</th>
                              <th className="px-2 py-2 text-center border-b bg-amber-50 text-amber-700 font-semibold">L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gridData.rows.map((row) => (
                              <tr key={row.employee_id} className="hover:bg-slate-50" data-testid={`grid-row-${row.employee_id}`}>
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r">
                                  <div className="font-medium text-slate-900 truncate max-w-[150px]" title={row.name}>
                                    {row.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500">{row.emp_code} • {row.department}</div>
                                </td>
                                {row.cells.map((cell, idx) => {
                                  const cellBg = 
                                    cell.status === 'present' ? (cell.is_late ? 'bg-amber-100 hover:bg-amber-200' : 'bg-emerald-100 hover:bg-emerald-200') :
                                    cell.status === 'absent' ? 'bg-red-100 hover:bg-red-200' :
                                    cell.status === 'wfh' ? 'bg-blue-100 hover:bg-blue-200' :
                                    cell.status === 'leave' ? 'bg-purple-100 hover:bg-purple-200' :
                                    cell.status === 'half_day' || cell.status === 'HD' ? 'bg-orange-100 hover:bg-orange-200' :
                                    cell.status === 'sunday' ? 'bg-slate-200' :
                                    cell.status === 'holiday' ? 'bg-orange-50' :
                                    cell.status === 'no_record' ? 'bg-slate-50 hover:bg-slate-100' :
                                    'bg-slate-50';

                                  const cellText = 
                                    cell.status === 'present' ? (cell.is_late ? 'L' : 'P') :
                                    cell.status === 'absent' ? 'A' :
                                    cell.status === 'wfh' ? 'W' :
                                    cell.status === 'leave' ? 'LV' :
                                    cell.status === 'half_day' || cell.status === 'HD' ? 'HD' :
                                    cell.status === 'sunday' ? '–' :
                                    cell.status === 'holiday' ? 'H' :
                                    cell.status === 'no_record' ? '-' :
                                    cell.status?.charAt(0).toUpperCase() || '-';

                                  const isClickable = cell.is_editable && cell.status !== 'sunday' && cell.status !== 'holiday';

                                  return (
                                    <td 
                                      key={idx}
                                      onClick={() => isClickable && handleGridCellClick(row, cell)}
                                      className={`px-1 py-2 text-center border-b text-xs font-medium ${cellBg} ${
                                        isClickable ? 'cursor-pointer' : ''
                                      } ${cell.is_manually_edited ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                                      title={
                                        cell.status === 'sunday' ? 'Sunday' :
                                        cell.status === 'holiday' ? cell.holiday_name :
                                        cell.first_in ? `In: ${cell.first_in} | Out: ${cell.last_out || '-'}` :
                                        cell.status === 'no_record' ? 'No record - Click to add' :
                                        cell.status
                                      }
                                      data-testid={`grid-cell-${row.employee_id}-${cell.date}`}
                                    >
                                      {cellText}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-2 text-center border-b border-l bg-emerald-50 font-semibold text-emerald-700">
                                  {row.summary.present}
                                </td>
                                <td className="px-2 py-2 text-center border-b bg-red-50 font-semibold text-red-700">
                                  {row.summary.absent}
                                </td>
                                <td className="px-2 py-2 text-center border-b bg-amber-50 font-semibold text-amber-700">
                                  {row.summary.late}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Grid className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-2">Select date range and click &quot;Load Grid&quot;</p>
                      <p className="text-xs text-slate-400">Grid view shows all employees vs dates in a table format</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                  <Card className="bg-emerald-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{summary.overview?.attendance_rate}%</p>
                      <p className="text-xs text-slate-500">Attendance Rate</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{summary.overview?.avg_daily_attendance}</p>
                      <p className="text-xs text-slate-500">Avg Daily</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{summary.overview?.perfect_days_count}</p>
                      <p className="text-xs text-slate-500">Perfect Days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{summary.overview?.high_absence_days_count}</p>
                      <p className="text-xs text-slate-500">High Absence Days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{summary.overview?.late_instances}</p>
                      <p className="text-xs text-slate-500">Late Instances</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-indigo-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{summary.overview?.wfh_count}</p>
                      <p className="text-xs text-slate-500">WFH Count</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{summary.overview?.leave_count}</p>
                      <p className="text-xs text-slate-500">Leave Count</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-teal-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-teal-600">{summary.overview?.punctuality_champions_count}</p>
                      <p className="text-xs text-slate-500">Punctual</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Key Insights */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600">Most Absent Day</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {summary.key_metrics?.most_absent_day?.date ? (
                        <div>
                          <p className="text-lg font-bold">{new Date(summary.key_metrics.most_absent_day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                          <p className="text-sm text-red-600">{summary.key_metrics.most_absent_day.absent_count} absent ({summary.key_metrics.most_absent_day.absent_pct}%)</p>
                        </div>
                      ) : <p className="text-slate-400">No data</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600">Avg Working Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">{summary.overview?.avg_daily_hours}h</p>
                      <p className="text-sm text-slate-500">per employee per day</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600">Chronic Absentees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold text-red-600">{summary.overview?.chronic_absentees_count}</p>
                      <p className="text-sm text-slate-500">employees with 5+ absences</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent value="patterns">
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={summary.patterns?.monday_blues ? 'border-amber-300 bg-amber-50' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Monday Blues
                        {summary.patterns?.monday_blues && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{summary.patterns?.monday_absence_rate}%</p>
                      <p className="text-xs text-slate-500">absence rate on Mondays</p>
                      {summary.patterns?.monday_blues && <p className="text-xs text-amber-600 mt-1">Higher than other days!</p>}
                    </CardContent>
                  </Card>
                  <Card className={summary.patterns?.friday_flight ? 'border-amber-300 bg-amber-50' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Friday Flight
                        {summary.patterns?.friday_flight && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{summary.patterns?.friday_absence_rate}%</p>
                      <p className="text-xs text-slate-500">absence rate on Fridays</p>
                      {summary.patterns?.friday_flight && <p className="text-xs text-amber-600 mt-1">Higher than other days!</p>}
                    </CardContent>
                  </Card>
                  <Card className={summary.patterns?.pre_holiday_pattern ? 'border-amber-300 bg-amber-50' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Pre-Holiday
                        {summary.patterns?.pre_holiday_pattern && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{summary.patterns?.pre_holiday_absence_rate}%</p>
                      <p className="text-xs text-slate-500">absence before holidays</p>
                      {summary.patterns?.pre_holiday_pattern && <p className="text-xs text-amber-600 mt-1">Pattern detected!</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Other Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{summary.patterns?.other_days_absence_rate}%</p>
                      <p className="text-xs text-slate-500">baseline absence rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* High Absence Days */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">High Absence Days</CardTitle>
                    <CardDescription>Days with 4+ employees absent or &gt;10% absence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {summary.key_metrics?.high_absence_days?.length > 0 ? (
                      <div className="space-y-2">
                        {summary.key_metrics.high_absence_days.map((day, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <span>{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <Badge variant="destructive">{day.absent_count} absent ({day.absent_pct}%)</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No high absence days in this period</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Employee Insights Tab */}
            <TabsContent value="employees">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Most Late */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Most Late Arrivals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.rankings?.most_late?.filter(e => e.late_count > 0).length > 0 ? (
                      <div className="space-y-2">
                        {summary.rankings.most_late.filter(e => e.late_count > 0).map((emp, idx) => (
                          <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>{idx + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{emp.name}</p>
                                <p className="text-xs text-slate-500">{emp.emp_code}</p>
                              </div>
                            </div>
                            <Badge variant="destructive">{emp.late_count}x</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-center py-4">No late arrivals</p>}
                  </CardContent>
                </Card>

                {/* Chronic Absentees */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      Chronic Absentees (5+ days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.rankings?.chronic_absentees?.length > 0 ? (
                      <div className="space-y-2">
                        {summary.rankings.chronic_absentees.map((emp, idx) => (
                          <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{emp.name}</p>
                              <p className="text-xs text-slate-500">{emp.emp_code}</p>
                            </div>
                            <Badge className="bg-red-100 text-red-700">{emp.absent_days} days</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-center py-4">No chronic absentees</p>}
                  </CardContent>
                </Card>

                {/* Punctuality Champions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-500" />
                      Punctuality Champions
                    </CardTitle>
                    <CardDescription>Zero late arrivals and zero absences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {summary.rankings?.punctuality_champions?.length > 0 ? (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {summary.rankings.punctuality_champions.map((emp) => (
                          <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-emerald-500" />
                              <div>
                                <p className="font-medium text-sm">{emp.name}</p>
                                <p className="text-xs text-slate-500">{emp.emp_code}</p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-700">{emp.present_days} days</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-center py-4">No punctuality champions yet</p>}
                  </CardContent>
                </Card>

                {/* Most Hours */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Most Hours Worked
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.rankings?.most_hours?.filter(e => e.total_hours > 0).length > 0 ? (
                      <div className="space-y-2">
                        {summary.rankings.most_hours.filter(e => e.total_hours > 0).map((emp, idx) => (
                          <div key={emp.employee_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-blue-500 text-white' : 'bg-slate-200'}`}>{idx + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{emp.name}</p>
                                <p className="text-xs text-slate-500">{emp.emp_code}</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700">{emp.total_hours?.toFixed(1)}h</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-center py-4">No hour data</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Department Tab */}
            <TabsContent value="department">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Department Performance</CardTitle>
                  <CardDescription>Ranked by attendance rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.department_analysis?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Rank</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-center">Employees</TableHead>
                            <TableHead className="text-center">Present</TableHead>
                            <TableHead className="text-center">Absent</TableHead>
                            <TableHead className="text-center">Late</TableHead>
                            <TableHead className="text-center">Attendance Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.department_analysis.map((dept, idx) => (
                            <TableRow key={dept.department}>
                              <TableCell>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-emerald-500 text-white' : idx === summary.department_analysis.length - 1 ? 'bg-red-500 text-white' : 'bg-slate-200'}`}>
                                  {idx + 1}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">{dept.department}</TableCell>
                              <TableCell className="text-center">{dept.employees}</TableCell>
                              <TableCell className="text-center">{dept.present_days}</TableCell>
                              <TableCell className="text-center">{dept.absent_days}</TableCell>
                              <TableCell className="text-center">{dept.late_count}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={dept.attendance_rate >= 90 ? 'bg-emerald-100 text-emerald-700' : dept.attendance_rate >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                                  {dept.attendance_rate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : <p className="text-slate-500 text-center py-8">No department data available</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Grid Edit Dialog */}
      <Dialog open={gridEditDialogOpen} onOpenChange={setGridEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              {gridEditingCell && (
                <span>
                  {gridEditingCell.employee_name} ({gridEditingCell.emp_code}) - {gridEditingCell.date}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={gridEditForm.status}
                onValueChange={(v) => setGridEditForm({ ...gridEditForm, status: v })}
              >
                <SelectTrigger data-testid="grid-edit-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="wfh">Work From Home</SelectItem>
                  <SelectItem value="tour">On Tour</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>In Time</Label>
                <Input
                  type="time"
                  value={gridEditForm.first_in}
                  onChange={(e) => setGridEditForm({ ...gridEditForm, first_in: e.target.value })}
                  data-testid="grid-edit-in-time"
                />
              </div>
              <div className="space-y-2">
                <Label>Out Time</Label>
                <Input
                  type="time"
                  value={gridEditForm.last_out}
                  onChange={(e) => setGridEditForm({ ...gridEditForm, last_out: e.target.value })}
                  data-testid="grid-edit-out-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={gridEditForm.remarks}
                onChange={(e) => setGridEditForm({ ...gridEditForm, remarks: e.target.value })}
                placeholder="Optional remarks"
                data-testid="grid-edit-remarks"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-red-600">Reason for Edit *</Label>
              <Textarea
                value={gridEditForm.edit_reason}
                onChange={(e) => setGridEditForm({ ...gridEditForm, edit_reason: e.target.value })}
                placeholder="Explain why this record is being edited..."
                rows={2}
                data-testid="grid-edit-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGridEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGridSaveEdit} data-testid="save-grid-edit-btn">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendancePage;
