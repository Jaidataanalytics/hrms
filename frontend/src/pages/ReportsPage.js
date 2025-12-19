import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { BarChart3, Users, TrendingDown, IndianRupee, Calendar, RefreshCw, Download, PieChart, ArrowUp, ArrowDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ReportsPage = () => {
  const { user } = useAuth();
  const [headcount, setHeadcount] = useState(null);
  const [attrition, setAttrition] = useState(null);
  const [payrollCost, setPayrollCost] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaveReport, setLeaveReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance';

  useEffect(() => { fetchReports(); }, [selectedYear]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [hcRes, attrRes, prRes, attRes, lvRes] = await Promise.all([
        fetch(`${API_URL}/reports/headcount`, { credentials: 'include' }),
        fetch(`${API_URL}/reports/attrition?year=${selectedYear}`, { credentials: 'include' }),
        fetch(`${API_URL}/reports/payroll-cost?year=${selectedYear}`, { credentials: 'include' }),
        fetch(`${API_URL}/reports/attendance`, { credentials: 'include' }),
        fetch(`${API_URL}/reports/leave?year=${selectedYear}`, { credentials: 'include' })
      ]);
      if (hcRes.ok) setHeadcount(await hcRes.json());
      if (attrRes.ok) setAttrition(await attrRes.json());
      if (prRes.ok) setPayrollCost(await prRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (lvRes.ok) setLeaveReport(await lvRes.json());
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const getMonthName = (m) => new Date(2000, parseInt(m) - 1, 1).toLocaleString('en-IN', { month: 'short' });

  if (!isHR) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don't have permission to view reports</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">Comprehensive HR analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Export</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Headcount</p>
                <p className="text-3xl font-bold text-slate-900">{headcount?.total_headcount || 0}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Attrition Rate</p>
                <p className="text-3xl font-bold text-slate-900">{attrition?.attrition_rate || 0}%</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Attendance</p>
                <p className="text-3xl font-bold text-slate-900">{attendance?.avg_attendance_rate || 0}%</p>
              </div>
              <Calendar className="w-10 h-10 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Payroll Cost</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(payrollCost?.total_gross)}</p>
              </div>
              <IndianRupee className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="headcount" className="space-y-4">
        <TabsList className="bg-white border flex-wrap h-auto">
          <TabsTrigger value="headcount">Headcount</TabsTrigger>
          <TabsTrigger value="attrition">Attrition</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Cost</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave Analysis</TabsTrigger>
        </TabsList>

        {/* Headcount Tab */}
        <TabsContent value="headcount">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">By Department</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {headcount?.by_department?.map((dept, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{dept.department}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(dept.count / headcount.total_headcount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-8">{dept.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">By Designation</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {headcount?.by_designation?.slice(0, 6).map((desig, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{desig.designation}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(desig.count / headcount.total_headcount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-8">{desig.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Joining Trend (Last 12 Months)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-40">
                  {headcount?.joining_trend?.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-primary/20 rounded-t" style={{ height: `${Math.max(10, (m.count / Math.max(...headcount.joining_trend.map(x => x.count))) * 100)}%` }}>
                        <div className="w-full h-full bg-primary rounded-t flex items-end justify-center pb-1">
                          <span className="text-xs text-white font-medium">{m.count}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">{m.month?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Attrition Tab */}
        <TabsContent value="attrition">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exit Reasons</CardTitle>
                <CardDescription>Total exits: {attrition?.total_exits}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attrition?.by_reason?.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm">{r.reason}</span>
                      <span className="font-medium">{r.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">By Tenure</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attrition?.by_tenure?.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm">{t.tenure}</span>
                      <span className="font-medium">{t.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Monthly Exit Trend</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-32">
                  {attrition?.monthly_trend?.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-red-100 rounded-t" style={{ height: `${Math.max(5, m.exits * 20)}%` }}>
                        <div className="w-full h-full bg-red-500 rounded-t flex items-end justify-center pb-1">
                          {m.exits > 0 && <span className="text-xs text-white">{m.exits}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">{getMonthName(m.month)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payroll Cost Tab */}
        <TabsContent value="payroll">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500 mb-2">Total Gross Salary</p>
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(payrollCost?.total_gross)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500 mb-2">Total Net Salary</p>
                <p className="text-3xl font-bold text-emerald-600">{formatCurrency(payrollCost?.total_net)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500 mb-2">Average Salary</p>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(payrollCost?.avg_salary)}</p>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle className="text-lg">Cost by Department</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Department</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollCost?.by_department?.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{d.department}</TableCell>
                        <TableCell>{d.employees}</TableCell>
                        <TableCell>{formatCurrency(d.gross)}</TableCell>
                        <TableCell>{formatCurrency(d.net)}</TableCell>
                        <TableCell>{Math.round((d.gross / payrollCost.total_gross) * 100)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendance?.by_status?.map((s, i) => {
                    const colors = { present: 'bg-emerald-500', absent: 'bg-red-500', late: 'bg-amber-500', wfh: 'bg-blue-500', half_day: 'bg-purple-500' };
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colors[s.status] || 'bg-slate-400'}`} />
                          <span className="text-sm capitalize">{s.status}</span>
                        </div>
                        <span className="font-medium">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Top Late Comers</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendance?.late_comers?.slice(0, 5).map((emp, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm">{emp.name}</span>
                      <span className="text-sm font-medium text-red-600">{emp.late_count} days</span>
                    </div>
                  ))}
                  {(!attendance?.late_comers || attendance.late_comers.length === 0) && (
                    <p className="text-sm text-slate-500 text-center py-4">No late comers data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leave Tab */}
        <TabsContent value="leave">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leave by Type</CardTitle>
                <CardDescription>Total: {leaveReport?.total_requests} requests, {leaveReport?.total_days_taken} days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaveReport?.by_type?.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm">{t.type}</span>
                      <div className="text-right">
                        <span className="font-medium">{t.count} requests</span>
                        <span className="text-xs text-slate-500 ml-2">({t.days} days)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Request Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaveReport?.by_status?.map((s, i) => {
                    const colors = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700', cancelled: 'bg-slate-100 text-slate-700' };
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: colors[s.status]?.split(' ')[0]?.replace('bg-', '') }}>
                        <span className={`text-sm capitalize px-2 py-1 rounded ${colors[s.status]}`}>{s.status}</span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
