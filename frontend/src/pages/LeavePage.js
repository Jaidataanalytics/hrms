import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Settings,
  Users,
  Edit,
  Save
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LeavePage = () => {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // HR Management states
  const [allBalances, setAllBalances] = useState([]);
  const [accrualRules, setAccrualRules] = useState({});
  const [editingBalance, setEditingBalance] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [showEditBalanceDialog, setShowEditBalanceDialog] = useState(false);
  const [showEditRuleDialog, setShowEditRuleDialog] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: '',
    from_date: null,
    to_date: null,
    is_half_day: false,
    half_day_type: '',
    reason: ''
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';
  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_admin';
  const isManager = user?.role === 'manager' || user?.role === 'team_lead' || isHR;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [typesRes, balanceRes, requestsRes, rulesRes] = await Promise.all([
        fetch(`${API_URL}/leave-types`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/balance`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/my-requests`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/accrual-rules`, { credentials: 'include', headers: authHeaders })
      ]);

      if (typesRes.ok) setLeaveTypes(await typesRes.json());
      if (balanceRes.ok) setLeaveBalance(await balanceRes.json());
      if (requestsRes.ok) setMyRequests(await requestsRes.json());
      if (rulesRes.ok) setAccrualRules(await rulesRes.json());

      // Fetch pending approvals for managers/HR
      if (isManager) {
        const approvalsRes = await fetch(`${API_URL}/leave/pending-approvals`, { credentials: 'include', headers: authHeaders });
        if (approvalsRes.ok) setPendingApprovals(await approvalsRes.json());
      }
      
      // Fetch HR management data (all balances)
      if (isHR) {
        const allBalancesRes = await fetch(`${API_URL}/leave/balances/all`, { credentials: 'include', headers: authHeaders });
        if (allBalancesRes.ok) setAllBalances(await allBalancesRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!leaveForm.leave_type_id || !leaveForm.from_date || !leaveForm.to_date || !leaveForm.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/leave/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          ...leaveForm,
          from_date: format(leaveForm.from_date, 'yyyy-MM-dd'),
          to_date: format(leaveForm.to_date, 'yyyy-MM-dd')
        })
      });

      if (response.ok) {
        toast.success('Leave applied successfully');
        setShowApplyDialog(false);
        setLeaveForm({
          leave_type_id: '',
          from_date: null,
          to_date: null,
          is_half_day: false,
          half_day_type: '',
          reason: ''
        });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to apply leave');
      }
    } catch (error) {
      toast.error('Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLeave = async (leaveId) => {
    try {
      const response = await fetch(`${API_URL}/leave/${leaveId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        toast.success('Leave approved');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to approve leave');
      }
    } catch (error) {
      toast.error('Failed to approve leave');
    }
  };

  const handleRejectLeave = async (leaveId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/leave/${leaveId}/reject?rejection_reason=${encodeURIComponent(reason)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        toast.success('Leave rejected');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to reject leave');
      }
    } catch (error) {
      toast.error('Failed to reject leave');
    }
  };

  // HR Management Functions
  const handleEditBalance = (employee, balance) => {
    setEditingBalance({
      employee_id: employee.employee_id,
      emp_code: employee.emp_code,
      employee_name: employee.employee_name,
      leave_type_id: balance.leave_type_id,
      opening_balance: balance.opening_balance || 0,
      accrued: balance.accrued || 0,
      used: balance.used || 0,
      pending: balance.pending || 0,
      available: balance.available || 0
    });
    setShowEditBalanceDialog(true);
  };

  const handleSaveBalance = async () => {
    if (!editingBalance) return;
    
    try {
      const response = await fetch(`${API_URL}/leave/balances/${editingBalance.employee_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBalance)
      });

      if (response.ok) {
        toast.success('Leave balance updated');
        setShowEditBalanceDialog(false);
        setEditingBalance(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update balance');
      }
    } catch (error) {
      toast.error('Failed to update balance');
    }
  };

  const handleEditRule = (code, rule) => {
    setEditingRule({ code, ...rule });
    setShowEditRuleDialog(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    
    const { code, ...ruleData } = editingRule;
    
    try {
      const response = await fetch(`${API_URL}/leave/accrual-rules/${code}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        toast.success(`Leave rule for ${code} updated`);
        setShowEditRuleDialog(false);
        setEditingRule(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update rule');
      }
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const handleRunAccrual = async () => {
    if (!window.confirm('Run leave accrual for current month? This will add accrued leaves to all eligible employees.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/leave/run-accrual`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Accrual completed: ${result.accruals_processed} records processed`);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to run accrual');
      }
    } catch (error) {
      toast.error('Failed to run accrual');
    }
  };

  const getLeaveTypeName = (typeId) => {
    const lt = leaveTypes.find(t => t.leave_type_id === typeId);
    return lt?.name || typeId;
  };

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  const statusIcons = {
    pending: AlertCircle,
    approved: CheckCircle2,
    rejected: XCircle,
    cancelled: XCircle
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="leave-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Leave Management</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Leave Management
          </h1>
          <p className="text-slate-600 mt-1">Apply for leave and track your requests</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="apply-leave-btn">
              <Plus className="w-4 h-4" />
              Apply Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>
                Submit your leave request for approval
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select
                  value={leaveForm.leave_type_id}
                  onValueChange={(value) => setLeaveForm({ ...leaveForm, leave_type_id: value })}
                >
                  <SelectTrigger data-testid="select-leave-type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(lt => (
                      <SelectItem key={lt.leave_type_id} value={lt.leave_type_id}>
                        {lt.name} ({lt.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="from-date-btn">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveForm.from_date ? format(leaveForm.from_date, 'dd/MM/yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={leaveForm.from_date}
                        onSelect={(date) => setLeaveForm({ ...leaveForm, from_date: date, to_date: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="to-date-btn">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveForm.to_date ? format(leaveForm.to_date, 'dd/MM/yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={leaveForm.to_date}
                        onSelect={(date) => setLeaveForm({ ...leaveForm, to_date: date })}
                        disabled={(date) => leaveForm.from_date && date < leaveForm.from_date}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="half-day">Half Day Leave</Label>
                <Switch
                  id="half-day"
                  checked={leaveForm.is_half_day}
                  onCheckedChange={(checked) => setLeaveForm({ ...leaveForm, is_half_day: checked })}
                />
              </div>

              {leaveForm.is_half_day && (
                <div className="space-y-2">
                  <Label>Half Day Type</Label>
                  <Select
                    value={leaveForm.half_day_type}
                    onValueChange={(value) => setLeaveForm({ ...leaveForm, half_day_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select half" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_half">First Half</SelectItem>
                      <SelectItem value="second_half">Second Half</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Reason *</Label>
                <Textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Enter reason for leave..."
                  rows={3}
                  data-testid="leave-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyLeave} disabled={submitting} data-testid="submit-leave-btn">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {leaveTypes.slice(0, 6).map(lt => {
          const balance = leaveBalance.find(b => b.leave_type_id === lt.leave_type_id) || {};
          // Get quota from accrual rules if available (HR-configured), otherwise fall back to leave type default
          const ruleCode = lt.code?.toUpperCase() || lt.leave_type_id?.replace('lt_', '').toUpperCase();
          const ruleQuota = accrualRules[ruleCode]?.annual_quota;
          const quota = ruleQuota !== undefined ? ruleQuota : lt.annual_quota;
          
          const available = balance.available !== undefined ? balance.available : quota;
          const total = (balance.opening_balance !== undefined && balance.accrued !== undefined) 
            ? (balance.opening_balance + balance.accrued) 
            : quota;
          
          return (
            <Card key={lt.leave_type_id} className="card-hover" data-testid={`balance-${lt.code}`}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500 mb-1">{lt.code}</p>
                <p className="text-2xl font-bold text-slate-900">{available}</p>
                <p className="text-xs text-slate-500 mb-2">of {total} days</p>
                <Progress value={(available / (total || 1)) * 100} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Tabs for Requests */}
      <Tabs defaultValue="my-requests" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="my-requests" data-testid="tab-my-requests">
            My Requests
            {myRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge className="ml-2 h-5 px-1.5">{myRequests.filter(r => r.status === 'pending').length}</Badge>
            )}
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="approvals" data-testid="tab-approvals">
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingApprovals.length}</Badge>
              )}
            </TabsTrigger>
          )}
          {isHR && (
            <TabsTrigger value="manage-balances" data-testid="tab-manage-balances">
              <Users className="w-4 h-4 mr-1" />
              Manage Balances
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="leave-rules" data-testid="tab-leave-rules">
              <Settings className="w-4 h-4 mr-1" />
              Leave Rules
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-requests">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                My Leave Requests
              </CardTitle>
              <CardDescription>Track the status of your leave applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myRequests.length > 0 ? (
                  myRequests.map(request => {
                    const StatusIcon = statusIcons[request.status];
                    return (
                      <div 
                        key={request.leave_id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                        data-testid={`leave-request-${request.leave_id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            request.status === 'approved' ? 'bg-emerald-100' :
                            request.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <StatusIcon className={`w-5 h-5 ${
                              request.status === 'approved' ? 'text-emerald-600' :
                              request.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {getLeaveTypeName(request.leave_type_id)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {request.from_date} to {request.to_date} ({request.days} {request.days === 1 ? 'day' : 'days'})
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{request.reason}</p>
                          </div>
                        </div>
                        <Badge className={statusColors[request.status]}>
                          {request.status}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No leave requests yet</p>
                    <Button className="mt-4" onClick={() => setShowApplyDialog(true)}>
                      Apply for Leave
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="approvals">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Pending Approvals
                </CardTitle>
                <CardDescription>Leave requests awaiting your approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map(request => (
                      <div 
                        key={request.leave_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg gap-4"
                        data-testid={`approval-${request.leave_id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {request.employee_id} - {getLeaveTypeName(request.leave_type_id)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {request.from_date} to {request.to_date} ({request.days} days)
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{request.reason}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleApproveLeave(request.leave_id)}
                            className="gap-1"
                            data-testid={`approve-${request.leave_id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectLeave(request.leave_id)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`reject-${request.leave_id}`}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                      <p className="text-slate-500">No pending approvals</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR: Manage Balances Tab */}
        {isHR && (
          <TabsContent value="manage-balances">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Employee Leave Balances
                    </CardTitle>
                    <CardDescription>View and edit leave balances for all employees</CardDescription>
                  </div>
                  <Button onClick={handleRunAccrual} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Run Monthly Accrual
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Emp Code</TableHead>
                        <TableHead className="text-center">CL</TableHead>
                        <TableHead className="text-center">SL</TableHead>
                        <TableHead className="text-center">EL</TableHead>
                        <TableHead className="text-center">CO</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allBalances.length > 0 ? (
                        allBalances.map(emp => {
                          const getBalance = (typeId) => emp.balances?.find(b => b.leave_type_id === typeId) || {};
                          return (
                            <TableRow key={emp.employee_id}>
                              <TableCell className="font-medium">{emp.employee_name}</TableCell>
                              <TableCell>{emp.emp_code}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-emerald-600 font-medium">{getBalance('lt_cl').available || 0}</span>
                                <span className="text-slate-400 text-xs">/{getBalance('lt_cl').opening_balance || 0}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-emerald-600 font-medium">{getBalance('lt_sl').available || 0}</span>
                                <span className="text-slate-400 text-xs">/{getBalance('lt_sl').opening_balance || 0}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-emerald-600 font-medium">{getBalance('lt_el').available || 0}</span>
                                <span className="text-slate-400 text-xs">/{getBalance('lt_el').opening_balance || 0}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-emerald-600 font-medium">{getBalance('lt_co').available || 0}</span>
                                <span className="text-slate-400 text-xs">/{getBalance('lt_co').opening_balance || 0}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  {['lt_cl', 'lt_sl', 'lt_el', 'lt_co'].map(typeId => {
                                    const balance = getBalance(typeId);
                                    return (
                                      <Button
                                        key={typeId}
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleEditBalance(emp, { ...balance, leave_type_id: typeId })}
                                        title={`Edit ${typeId.replace('lt_', '').toUpperCase()}`}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            No employee balances found. Import leave balances from Bulk Import section.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Admin: Leave Rules Tab */}
        {isAdmin && (
          <TabsContent value="leave-rules">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Leave Accrual Rules
                </CardTitle>
                <CardDescription>Configure how employees earn and use different types of leaves</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {Object.entries(accrualRules).map(([code, rule]) => (
                    <div key={code} className="border rounded-lg p-4 bg-slate-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900">{rule.name || code}</h4>
                          <p className="text-sm text-slate-500">Code: {code}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRule(code, rule)}
                          className="gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Annual Quota:</span>
                          <span className="ml-2 font-medium">{rule.annual_quota || 0} days</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Accrual Type:</span>
                          <span className="ml-2 font-medium capitalize">{rule.accrual_type || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Accrual Rate:</span>
                          <span className="ml-2 font-medium">{rule.accrual_rate || 0}/period</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Carry Forward:</span>
                          <span className={`ml-2 font-medium ${rule.carry_forward ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {rule.carry_forward ? `Yes (max ${rule.max_carry_forward})` : 'No'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Encashment:</span>
                          <span className={`ml-2 font-medium ${rule.encashment_allowed ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {rule.encashment_allowed ? 'Allowed' : 'Not Allowed'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Probation:</span>
                          <span className={`ml-2 font-medium ${rule.probation_eligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {rule.probation_eligible ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Max Consecutive:</span>
                          <span className="ml-2 font-medium">{rule.max_consecutive_days || '-'} days</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Advance Notice:</span>
                          <span className="ml-2 font-medium">{rule.advance_notice_days || 0} days</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(accrualRules).length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      No leave rules configured. Default rules will be applied.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Balance Dialog */}
      <Dialog open={showEditBalanceDialog} onOpenChange={setShowEditBalanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Leave Balance
            </DialogTitle>
            <DialogDescription>
              {editingBalance?.employee_name} ({editingBalance?.emp_code}) - {editingBalance?.leave_type_id?.replace('lt_', '').toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingBalance?.opening_balance || 0}
                  onChange={(e) => setEditingBalance({
                    ...editingBalance,
                    opening_balance: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Accrued</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingBalance?.accrued || 0}
                  onChange={(e) => setEditingBalance({
                    ...editingBalance,
                    accrued: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Used</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingBalance?.used || 0}
                  onChange={(e) => setEditingBalance({
                    ...editingBalance,
                    used: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pending</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingBalance?.pending || 0}
                  onChange={(e) => setEditingBalance({
                    ...editingBalance,
                    pending: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <span className="text-sm text-slate-500">Available Balance: </span>
              <span className="font-semibold text-emerald-600">
                {((editingBalance?.opening_balance || 0) + (editingBalance?.accrued || 0) - (editingBalance?.used || 0) - (editingBalance?.pending || 0)).toFixed(1)} days
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBalanceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBalance} className="gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={showEditRuleDialog} onOpenChange={setShowEditRuleDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Leave Rule - {editingRule?.name || editingRule?.code}
            </DialogTitle>
            <DialogDescription>
              Configure accrual and usage rules for this leave type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Settings */}
            <div>
              <h4 className="font-medium mb-3 text-slate-900">Basic Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Leave Name</Label>
                  <Input
                    value={editingRule?.name || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Quota (days)</Label>
                  <Input
                    type="number"
                    value={editingRule?.annual_quota || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, annual_quota: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Accrual Settings */}
            <div>
              <h4 className="font-medium mb-3 text-slate-900">Accrual Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accrual Type</Label>
                  <Select
                    value={editingRule?.accrual_type || 'none'}
                    onValueChange={(value) => setEditingRule({ ...editingRule, accrual_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly (Credited at start)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Accrual Rate (per period)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={editingRule?.accrual_rate || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, accrual_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Carry Forward & Encashment */}
            <div>
              <h4 className="font-medium mb-3 text-slate-900">Carry Forward & Encashment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="carry_forward"
                    checked={editingRule?.carry_forward || false}
                    onChange={(e) => setEditingRule({ ...editingRule, carry_forward: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="carry_forward">Allow Carry Forward</Label>
                </div>
                <div className="space-y-2">
                  <Label>Max Carry Forward (days)</Label>
                  <Input
                    type="number"
                    value={editingRule?.max_carry_forward || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, max_carry_forward: parseInt(e.target.value) || 0 })}
                    disabled={!editingRule?.carry_forward}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="encashment_allowed"
                    checked={editingRule?.encashment_allowed || false}
                    onChange={(e) => setEditingRule({ ...editingRule, encashment_allowed: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="encashment_allowed">Allow Encashment</Label>
                </div>
                <div className="space-y-2">
                  <Label>Encashment Rate (%)</Label>
                  <Input
                    type="number"
                    value={editingRule?.encashment_rate || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, encashment_rate: parseInt(e.target.value) || 0 })}
                    disabled={!editingRule?.encashment_allowed}
                  />
                </div>
              </div>
            </div>

            {/* Eligibility & Restrictions */}
            <div>
              <h4 className="font-medium mb-3 text-slate-900">Eligibility & Restrictions</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="probation_eligible"
                    checked={editingRule?.probation_eligible || false}
                    onChange={(e) => setEditingRule({ ...editingRule, probation_eligible: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="probation_eligible">Probation Eligible</Label>
                </div>
                <div className="space-y-2">
                  <Label>Min Service Days Required</Label>
                  <Input
                    type="number"
                    value={editingRule?.min_service_days || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, min_service_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Consecutive Days</Label>
                  <Input
                    type="number"
                    value={editingRule?.max_consecutive_days || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, max_consecutive_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advance Notice (days)</Label>
                  <Input
                    type="number"
                    value={editingRule?.advance_notice_days || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, advance_notice_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="can_be_half_day"
                    checked={editingRule?.can_be_half_day || false}
                    onChange={(e) => setEditingRule({ ...editingRule, can_be_half_day: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="can_be_half_day">Allow Half Day</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} className="gap-2">
              <Save className="w-4 h-4" />
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeavePage;
