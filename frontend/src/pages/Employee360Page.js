import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  IndianRupee,
  Clock,
  FileText,
  Plane,
  Shield,
  Package,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  Briefcase
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Employee360Page = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [salary, setSalary] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [insurance, setInsurance] = useState(null);
  const [assets, setAssets] = useState(null);
  const [payslips, setPayslips] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) {
      fetchAttendance();
    }
  }, [employeeId, selectedMonth, selectedYear]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      
      // Fetch all employee data in parallel
      const [empRes, salRes, leaveBalRes, leaveReqRes, insRes, assetRes, payslipRes] = await Promise.all([
        fetch(`${API_URL}/employees/${employeeId}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/payroll/employee/${employeeId}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/balances?employee_id=${employeeId}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/requests?employee_id=${employeeId}&limit=20`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/insurance?employee_id=${employeeId}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/employee-assets/${employeeId}`, { credentials: 'include', headers: authHeaders }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/payroll/payslips?employee_id=${employeeId}&limit=12`, { credentials: 'include', headers: authHeaders }),
      ]);

      if (empRes.ok) setEmployee(await empRes.json());
      else toast.error('Employee not found');
      
      if (salRes.ok) setSalary(await salRes.json());
      if (leaveBalRes.ok) setLeaveBalances(await leaveBalRes.json());
      if (leaveReqRes.ok) setLeaveRequests(await leaveReqRes.json());
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsurance(insData.find ? insData.find(i => i.employee_id === employeeId) : insData);
      }
      if (assetRes.ok) setAssets(await assetRes.json());
      if (payslipRes.ok) setPayslips(await payslipRes.json());
      
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(
        `${API_URL}/attendance?employee_id=${employeeId}&month=${selectedMonth}&year=${selectedYear}`,
        { credentials: 'include', headers: authHeaders }
      );
      
      if (response.ok) {
        setAttendance(await response.json());
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'present': return 'bg-emerald-100 text-emerald-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'wfh': return 'bg-blue-100 text-blue-700';
      case 'leave': return 'bg-amber-100 text-amber-700';
      case 'holiday': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getLeaveStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  // Calculate attendance summary
  const attendanceSummary = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    wfh: attendance.filter(a => a.status === 'wfh').length,
    leave: attendance.filter(a => a.status === 'leave').length,
  };

  const monthOptions = [];
  for (let i = 1; i <= 12; i++) {
    monthOptions.push({ value: i, label: new Date(2000, i - 1).toLocaleString('default', { month: 'long' }) });
  }

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 3; y--) {
    yearOptions.push(y);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-700">Employee Not Found</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="employee-360-page">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Employee Profile
          </h1>
        </div>
      </div>

      {/* Employee Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {employee.first_name} {employee.last_name}
                </h2>
                <p className="text-slate-500">{employee.designation || employee.job_title}</p>
                <Badge className="mt-2" variant="outline">{employee.emp_code}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                {employee.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4" />
                    <span>{employee.email}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.department_name && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building className="w-4 h-4" />
                    <span>{employee.department_name}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {employee.date_of_joining && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>Joined: {new Date(employee.date_of_joining).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge className={employee.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                    {employee.status}
                  </Badge>
                  <Badge variant="outline">{employee.employment_type}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-1">
          <TabsTrigger value="attendance" className="gap-1">
            <Clock className="w-4 h-4" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="salary" className="gap-1">
            <IndianRupee className="w-4 h-4" /> Salary
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-1">
            <Calendar className="w-4 h-4" /> Leaves
          </TabsTrigger>
          <TabsTrigger value="payslips" className="gap-1">
            <FileText className="w-4 h-4" /> Payslips
          </TabsTrigger>
          <TabsTrigger value="insurance" className="gap-1">
            <Shield className="w-4 h-4" /> Insurance
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1">
            <Package className="w-4 h-4" /> Assets
          </TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg">Attendance Record</CardTitle>
                <div className="flex gap-2">
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(m => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{attendanceSummary.present}</p>
                  <p className="text-xs text-emerald-700">Present</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</p>
                  <p className="text-xs text-red-700">Absent</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{attendanceSummary.wfh}</p>
                  <p className="text-xs text-blue-700">WFH</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{attendanceSummary.leave}</p>
                  <p className="text-xs text-amber-700">Leave</p>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length > 0 ? (
                      attendance.slice(0, 31).map((record, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short' })}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(record.status)}>{record.status}</Badge>
                          </TableCell>
                          <TableCell>{record.check_in_time || '-'}</TableCell>
                          <TableCell>{record.check_out_time || '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          No attendance records for this month
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Salary Structure</CardTitle>
              <CardDescription>Current salary details and components</CardDescription>
            </CardHeader>
            <CardContent>
              {salary ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Annual CTC</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(salary.annual_ctc || salary.ctc)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Monthly Gross</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(salary.gross)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">Basic</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(salary.basic)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">HRA</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(salary.hra)}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Component</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Basic Salary</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.basic)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>HRA</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.hra)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Special Allowance</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.special_allowance)}</TableCell>
                        </TableRow>
                        {salary.conveyance && (
                          <TableRow>
                            <TableCell>Conveyance</TableCell>
                            <TableCell className="text-right">{formatCurrency(salary.conveyance)}</TableCell>
                          </TableRow>
                        )}
                        {salary.medical && (
                          <TableRow>
                            <TableCell>Medical Allowance</TableCell>
                            <TableCell className="text-right">{formatCurrency(salary.medical)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell>Gross Salary</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.gross)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No salary structure assigned
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Leave Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leave Balances</CardTitle>
              </CardHeader>
              <CardContent>
                {leaveBalances.length > 0 ? (
                  <div className="space-y-3">
                    {leaveBalances.map((lb, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">{lb.leave_type_name || lb.leave_type_id}</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-primary">{lb.available || lb.balance || 0}</span>
                          <span className="text-slate-400 text-sm"> / {lb.total || lb.annual_quota || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">No leave balances found</p>
                )}
              </CardContent>
            </Card>

            {/* Leave Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {leaveRequests.length > 0 ? (
                  <div className="space-y-3">
                    {leaveRequests.slice(0, 5).map((lr, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{lr.leave_type_name || lr.leave_type_id}</span>
                          <Badge className={getLeaveStatusColor(lr.status)}>{lr.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {lr.from_date} to {lr.to_date} ({lr.days || 1} days)
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">No leave requests found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payslips Tab */}
        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payslip History</CardTitle>
            </CardHeader>
            <CardContent>
              {payslips.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((ps, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(ps.gross_salary)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(ps.total_deductions)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(ps.net_salary)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ps.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-center py-8">No payslips found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insurance Details</CardTitle>
            </CardHeader>
            <CardContent>
              {insurance ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">ESIC</p>
                    <Badge className={insurance.esic ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {insurance.esic ? 'Covered' : 'Not Covered'}
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">PMJJBY</p>
                    <Badge className={insurance.pmjjby ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {insurance.pmjjby ? 'Covered' : 'Not Covered'}
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Accidental Insurance</p>
                    <Badge className={insurance.accidental_insurance ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {insurance.accidental_insurance ? 'Covered' : 'Not Covered'}
                    </Badge>
                  </div>
                  {insurance.insurance_company && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Company</p>
                      <p className="font-medium">{insurance.insurance_company}</p>
                    </div>
                  )}
                  {insurance.amount && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Amount</p>
                      <p className="font-medium">{formatCurrency(insurance.amount)}</p>
                    </div>
                  )}
                  {insurance.policy_number && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Policy Number</p>
                      <p className="font-medium">{insurance.policy_number}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No insurance records found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {assets ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <Phone className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">Mobile & Charger</p>
                    <Badge className={assets.mobile_charger ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {assets.mobile_charger ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">Laptop</p>
                    <Badge className={assets.laptop ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {assets.laptop ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">System</p>
                    <Badge className={assets.system ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {assets.system ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">Printer</p>
                    <Badge className={assets.printer ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {assets.printer ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </div>
                  {assets.sdpl_number && (
                    <div className="p-4 border rounded-lg col-span-2">
                      <p className="text-sm text-slate-500 mb-1">SDPL Number</p>
                      <p className="font-medium">{assets.sdpl_number}</p>
                    </div>
                  )}
                  {assets.tag && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Tag</p>
                      <p className="font-medium">{assets.tag}</p>
                    </div>
                  )}
                  {assets.sim_mobile_no && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">SIM/Mobile No</p>
                      <p className="font-medium">{assets.sim_mobile_no}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No assets assigned</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Employee360Page;
