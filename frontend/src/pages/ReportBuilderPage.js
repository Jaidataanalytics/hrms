import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
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
import { toast } from 'sonner';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Plus,
  Play,
  Save,
  Filter,
  Columns,
  Calendar,
  AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ReportBuilderPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [savedReports, setSavedReports] = useState([]);

  const [config, setConfig] = useState({
    reportType: 'employee',
    columns: ['employee_id', 'name', 'email', 'department', 'designation'],
    filters: {
      department_id: 'all',
      location_id: 'all',
      employment_status: 'active',
      date_from: '',
      date_to: ''
    },
    groupBy: '',
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchDepartments();
    loadSavedReports();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_URL}/departments`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setDepartments(await response.json());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadSavedReports = () => {
    const saved = localStorage.getItem('nexus_saved_reports');
    if (saved) setSavedReports(JSON.parse(saved));
  };

  const reportTypes = [
    { id: 'employee', name: 'Employee Directory', icon: '👥' },
    { id: 'attendance', name: 'Attendance Report', icon: '📅' },
    { id: 'leave', name: 'Leave Report', icon: '🏖️' },
    { id: 'payroll', name: 'Payroll Report', icon: '💰' },
    { id: 'headcount', name: 'Headcount Analysis', icon: '📊' },
    { id: 'expense', name: 'Expense Report', icon: '💳' }
  ];

  const columnOptions = {
    employee: [
      { id: 'employee_id', name: 'Employee ID' },
      { id: 'emp_code', name: 'Employee Code' },
      { id: 'name', name: 'Full Name' },
      { id: 'email', name: 'Email' },
      { id: 'phone', name: 'Phone' },
      { id: 'department', name: 'Department' },
      { id: 'designation', name: 'Designation' },
      { id: 'location', name: 'Location' },
      { id: 'joining_date', name: 'Joining Date' },
      { id: 'reporting_manager', name: 'Reporting Manager' },
      { id: 'employment_type', name: 'Employment Type' },
      { id: 'status', name: 'Status' }
    ],
    attendance: [
      { id: 'employee_id', name: 'Employee ID' },
      { id: 'name', name: 'Name' },
      { id: 'date', name: 'Date' },
      { id: 'status', name: 'Status' },
      { id: 'first_in', name: 'First In' },
      { id: 'last_out', name: 'Last Out' },
      { id: 'total_hours', name: 'Total Hours' },
      { id: 'overtime', name: 'Overtime' }
    ],
    leave: [
      { id: 'employee_id', name: 'Employee ID' },
      { id: 'name', name: 'Name' },
      { id: 'leave_type', name: 'Leave Type' },
      { id: 'start_date', name: 'Start Date' },
      { id: 'end_date', name: 'End Date' },
      { id: 'days', name: 'Days' },
      { id: 'status', name: 'Status' },
      { id: 'approved_by', name: 'Approved By' }
    ],
    payroll: [
      { id: 'employee_id', name: 'Employee ID' },
      { id: 'name', name: 'Name' },
      { id: 'department', name: 'Department' },
      { id: 'basic', name: 'Basic' },
      { id: 'hra', name: 'HRA' },
      { id: 'allowances', name: 'Allowances' },
      { id: 'gross', name: 'Gross' },
      { id: 'deductions', name: 'Deductions' },
      { id: 'net_pay', name: 'Net Pay' }
    ],
    headcount: [
      { id: 'department', name: 'Department' },
      { id: 'location', name: 'Location' },
      { id: 'count', name: 'Employee Count' },
      { id: 'percentage', name: 'Percentage' }
    ],
    expense: [
      { id: 'claim_id', name: 'Claim ID' },
      { id: 'employee', name: 'Employee' },
      { id: 'category', name: 'Category' },
      { id: 'amount', name: 'Amount' },
      { id: 'date', name: 'Date' },
      { id: 'status', name: 'Status' }
    ]
  };

  const toggleColumn = (col) => {
    if (config.columns.includes(col)) {
      setConfig({...config, columns: config.columns.filter(c => c !== col)});
    } else {
      setConfig({...config, columns: [...config.columns, col]});
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch(config.reportType) {
        case 'employee':
          endpoint = '/employees';
          break;
        case 'attendance':
          endpoint = '/reports/attendance';
          break;
        case 'leave':
          endpoint = '/reports/leave';
          break;
        case 'headcount':
          endpoint = '/reports/headcount';
          break;
        case 'expense':
          endpoint = '/reports/expense';
          break;
        default:
          endpoint = '/employees';
      }

      let url = `${API_URL}${endpoint}?`;
      if (config.filters.department_id) url += `department_id=${config.filters.department_id}&`;
      if (config.filters.date_from) url += `start_date=${config.filters.date_from}&`;
      if (config.filters.date_to) url += `end_date=${config.filters.date_to}&`;

      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setReportData(Array.isArray(data) ? data : data.by_department || data.daily || [data]);
        toast.success('Report generated');
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = () => {
    const reportConfig = {
      id: `rpt_${Date.now()}`,
      name: `${reportTypes.find(r => r.id === config.reportType)?.name} - ${new Date().toLocaleDateString()}`,
      config: {...config},
      created_at: new Date().toISOString()
    };
    const updated = [...savedReports, reportConfig];
    setSavedReports(updated);
    localStorage.setItem('nexus_saved_reports', JSON.stringify(updated));
    toast.success('Report configuration saved');
  };

  const loadReport = (report) => {
    setConfig(report.config);
    toast.success('Report loaded');
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = config.columns.join(',');
    const rows = reportData.map(row => 
      config.columns.map(col => {
        const val = row[col] || row[col.replace('_', '')] || '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    ).join('\n');

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported');
  };

  if (!isHR) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-600">You don't have permission to access reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="report-builder-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Custom Report Builder
          </h1>
          <p className="text-slate-600 mt-1">Create and export custom HR reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveReport} className="gap-2">
            <Save className="w-4 h-4" />
            Save Config
          </Button>
          <Button onClick={generateReport} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Report Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {reportTypes.map(type => (
                  <Button
                    key={type.id}
                    variant={config.reportType === type.id ? 'default' : 'outline'}
                    className="justify-start h-auto py-2 px-3"
                    onClick={() => setConfig({...config, reportType: type.id, columns: columnOptions[type.id]?.slice(0, 5).map(c => c.id) || []})}
                  >
                    <span className="mr-2">{type.icon}</span>
                    <span className="text-xs">{type.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Columns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Columns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {columnOptions[config.reportType]?.map(col => (
                  <div key={col.id} className="flex items-center gap-2">
                    <Checkbox
                      id={col.id}
                      checked={config.columns.includes(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                    />
                    <Label htmlFor={col.id} className="text-sm cursor-pointer">{col.name}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Department</Label>
                <Select 
                  value={config.filters.department_id} 
                  onValueChange={(v) => setConfig({...config, filters: {...config.filters, department_id: v}})}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={config.filters.date_from}
                    onChange={(e) => setConfig({...config, filters: {...config.filters, date_from: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={config.filters.date_to}
                    onChange={(e) => setConfig({...config, filters: {...config.filters, date_to: e.target.value}})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Saved Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {savedReports.slice(-5).map(report => (
                    <Button
                      key={report.id}
                      variant="ghost"
                      className="w-full justify-start text-xs h-8"
                      onClick={() => loadReport(report)}
                    >
                      {report.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Report Preview
                </CardTitle>
                {reportData && reportData.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                )}
              </div>
              {reportData && (
                <CardDescription>{reportData.length} records found</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : reportData && reportData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {config.columns.map(col => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">
                            {columnOptions[config.reportType]?.find(c => c.id === col)?.name || col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.slice(0, 50).map((row, idx) => (
                        <TableRow key={idx}>
                          {config.columns.map(col => (
                            <TableCell key={col} className="text-sm">
                              {row[col] || row[col.replace('_', '')] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 50 && (
                    <p className="text-xs text-slate-500 text-center mt-4">
                      Showing 50 of {reportData.length} records. Export to see all.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-2">No report generated yet</p>
                  <p className="text-xs text-slate-400">Configure your report and click Generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilderPage;
