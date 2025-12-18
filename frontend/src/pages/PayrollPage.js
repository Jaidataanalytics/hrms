import React, { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  CreditCard,
  FileText,
  Download,
  Play,
  Lock,
  RefreshCw,
  IndianRupee,
  Calendar,
  Users,
  TrendingUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PayrollPage = () => {
  const { user } = useAuth();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [myPayslips, setMyPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [runsRes, payslipsRes] = await Promise.all([
        isHR ? fetch(`${API_URL}/payroll/runs`, { credentials: 'include' }) : Promise.resolve({ ok: false }),
        fetch(`${API_URL}/payroll/my-payslips`, { credentials: 'include' })
      ]);

      if (runsRes.ok) {
        setPayrollRuns(await runsRes.json());
      }
      if (payslipsRes.ok) {
        setMyPayslips(await payslipsRes.json());
      }
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayroll = async () => {
    try {
      const response = await fetch(`${API_URL}/payroll/runs?month=${selectedMonth}&year=${selectedYear}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Payroll run created');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create payroll');
      }
    } catch (error) {
      toast.error('Failed to create payroll');
    }
  };

  const handleProcessPayroll = async (payrollId) => {
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/payroll/runs/${payrollId}/process`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to process payroll');
      }
    } catch (error) {
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const handleLockPayroll = async (payrollId) => {
    try {
      const response = await fetch(`${API_URL}/payroll/runs/${payrollId}/lock`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Payroll locked');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to lock payroll');
      }
    } catch (error) {
      toast.error('Failed to lock payroll');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getMonthName = (month) => {
    return new Date(2000, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    processing: 'bg-blue-100 text-blue-700',
    processed: 'bg-emerald-100 text-emerald-700',
    locked: 'bg-purple-100 text-purple-700'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="payroll-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Payroll
          </h1>
          <p className="text-slate-600 mt-1">Manage payroll and view salary slips</p>
        </div>
      </div>

      <Tabs defaultValue={isHR ? "runs" : "my-payslips"} className="space-y-4">
        <TabsList className="bg-white border">
          {isHR && <TabsTrigger value="runs" data-testid="tab-runs">Payroll Runs</TabsTrigger>}
          <TabsTrigger value="my-payslips" data-testid="tab-my-payslips">My Payslips</TabsTrigger>
          {isHR && <TabsTrigger value="config" data-testid="tab-config">Configuration</TabsTrigger>}
        </TabsList>

        {/* Payroll Runs (HR/Finance only) */}
        {isHR && (
          <TabsContent value="runs">
            <div className="grid gap-6">
              {/* Create New Payroll */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Create Payroll Run</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Month</label>
                      <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {getMonthName(i + 1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Year</label>
                      <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreatePayroll} data-testid="create-payroll-btn">
                      Create Payroll
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Payroll Runs List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Payroll History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Period</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRuns.length > 0 ? (
                        payrollRuns.map((run) => (
                          <TableRow key={run.payroll_id}>
                            <TableCell className="font-medium">
                              {getMonthName(run.month)} {run.year}
                            </TableCell>
                            <TableCell>{run.total_employees}</TableCell>
                            <TableCell>{formatCurrency(run.total_gross)}</TableCell>
                            <TableCell>{formatCurrency(run.total_net)}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[run.status]}>
                                {run.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {run.status === 'draft' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleProcessPayroll(run.payroll_id)}
                                  disabled={processing}
                                  className="gap-1"
                                >
                                  <Play className="w-3 h-3" />
                                  Process
                                </Button>
                              )}
                              {run.status === 'processed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLockPayroll(run.payroll_id)}
                                  className="gap-1"
                                >
                                  <Lock className="w-3 h-3" />
                                  Lock
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500">No payroll runs yet</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* My Payslips */}
        <TabsContent value="my-payslips">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                My Salary Slips
              </CardTitle>
              <CardDescription>View and download your payslips</CardDescription>
            </CardHeader>
            <CardContent>
              {myPayslips.length > 0 ? (
                <div className="space-y-3">
                  {myPayslips.map((slip) => (
                    <div
                      key={slip.payslip_id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => setSelectedPayslip(slip)}
                      data-testid={`payslip-${slip.payslip_id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <IndianRupee className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {getMonthName(slip.month)} {slip.year}
                          </p>
                          <p className="text-sm text-slate-500">
                            {slip.paid_days} days worked
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(slip.net_salary)}
                        </p>
                        <p className="text-xs text-slate-500">Net Pay</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No payslips available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration */}
        {isHR && (
          <TabsContent value="config">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">PF Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Employee Contribution</span>
                    <span className="font-semibold">12%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Employer Contribution</span>
                    <span className="font-semibold">12%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Wage Ceiling</span>
                    <span className="font-semibold">{formatCurrency(15000)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ESI Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Employee Contribution</span>
                    <span className="font-semibold">0.75%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Employer Contribution</span>
                    <span className="font-semibold">3.25%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Wage Ceiling</span>
                    <span className="font-semibold">{formatCurrency(21000)}/month</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Professional Tax Slabs</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Monthly Salary Range</TableHead>
                        <TableHead>PT Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Up to ₹10,000</TableCell>
                        <TableCell>₹0</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>₹10,001 - ₹15,000</TableCell>
                        <TableCell>₹150</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Above ₹15,000</TableCell>
                        <TableCell>₹200</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Payslip Detail Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Salary Slip - {selectedPayslip && `${getMonthName(selectedPayslip.month)} ${selectedPayslip.year}`}
            </DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-4">
              {/* Earnings */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Earnings</h4>
                <div className="space-y-2 bg-emerald-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Basic</span>
                    <span>{formatCurrency(selectedPayslip.basic)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>HRA</span>
                    <span>{formatCurrency(selectedPayslip.hra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Special Allowance</span>
                    <span>{formatCurrency(selectedPayslip.special_allowance)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Gross Salary</span>
                    <span>{formatCurrency(selectedPayslip.gross_salary)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Deductions</h4>
                <div className="space-y-2 bg-red-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>PF (Employee)</span>
                    <span>{formatCurrency(selectedPayslip.pf_employee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ESI (Employee)</span>
                    <span>{formatCurrency(selectedPayslip.esi_employee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Professional Tax</span>
                    <span>{formatCurrency(selectedPayslip.professional_tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(selectedPayslip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Net Salary</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(selectedPayslip.net_salary)}
                  </span>
                </div>
              </div>

              {/* Days Info */}
              <div className="flex justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <span>Working Days: {selectedPayslip.working_days}</span>
                <span>Present: {selectedPayslip.present_days}</span>
                <span>LWP: {selectedPayslip.lwp_days}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayslip(null)}>
              Close
            </Button>
            <Button className="gap-2">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollPage;
