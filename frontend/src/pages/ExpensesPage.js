import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
import { toast } from 'sonner';
import {
  Receipt,
  Plus,
  IndianRupee,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Upload,
  Car,
  Utensils,
  Hotel,
  Users,
  Fuel,
  Eye,
  FileText,
  User
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ExpensesPage = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [form, setForm] = useState({
    title: '', category: 'travel', amount: '', expense_date: '', description: ''
  });
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);

  const isApprover = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance' || user?.role === 'manager';

  useEffect(() => {
    fetchData();
    if (isApprover) fetchEmployees();
  }, [filterStatus, filterCategory, filterEmployee]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_URL}/employees`, { credentials: 'include' });
      if (res.ok) setEmployees(await res.json());
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchData = async () => {
    try {
      let url = `${API_URL}/expenses?`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterCategory !== 'all') url += `category=${filterCategory}&`;
      if (filterEmployee !== 'all') url += `employee_id=${filterEmployee}&`;

      const [expensesRes, categoriesRes] = await Promise.all([
        fetch(url, { credentials: 'include' }),
        fetch(`${API_URL}/expense-categories`, { credentials: 'include' })
      ]);

      if (expensesRes.ok) setExpenses(await expensesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!form.title || !form.amount || !form.expense_date) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount)
        })
      });

      if (response.ok) {
        toast.success('Expense claim submitted');
        setShowCreate(false);
        setForm({ title: '', category: 'travel', amount: '', expense_date: '', description: '' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to submit expense');
      }
    } catch (error) {
      toast.error('Failed to submit expense');
    }
  };

  const handleApprove = async (claimId) => {
    try {
      const response = await fetch(`${API_URL}/expenses/${claimId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (response.ok) {
        toast.success('Expense approved');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to approve expense');
    }
  };

  const handleReject = async (claimId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/expenses/${claimId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        toast.success('Expense rejected');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to reject expense');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const categoryIcons = {
    travel: Car,
    food: Utensils,
    accommodation: Hotel,
    client_entertainment: Users,
    fuel: Fuel,
    other: Receipt
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
    approved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
    rejected: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Rejected' },
    reimbursed: { icon: IndianRupee, color: 'bg-blue-100 text-blue-700', label: 'Reimbursed' }
  };

  // Calculate totals
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.approved_amount || e.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="expenses-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Expense Claims
          </h1>
          <p className="text-slate-600 mt-1">Submit and track expense reimbursements</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="new-expense-btn">
              <Plus className="w-4 h-4" />
              New Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Expense Claim</DialogTitle>
              <DialogDescription>Fill in the expense details for reimbursement</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Client meeting travel"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="5000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Details about the expense..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-primary/50 cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Click to upload receipt</p>
                  <p className="text-xs text-slate-400">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreateExpense}>Submit Claim</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(totalPending)}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(totalApproved)}</p>
                <p className="text-xs text-slate-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{expenses.length}</p>
                <p className="text-xs text-slate-500">Total Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                </p>
                <p className="text-xs text-slate-500">Total Claimed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="reimbursed">Reimbursed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.code} value={cat.code}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isApprover && (
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-48">
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
        )}
      </div>

      {/* Expenses List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Expense Claims
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length > 0 ? (
            <div className="space-y-3">
              {expenses.map((expense) => {
                const status = statusConfig[expense.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const CategoryIcon = categoryIcons[expense.category] || Receipt;

                return (
                  <div
                    key={expense.claim_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg gap-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    data-testid={`expense-${expense.claim_id}`}
                    onClick={() => setSelectedExpense(expense)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white border flex items-center justify-center">
                        <CategoryIcon className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{expense.title}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="capitalize">{expense.category.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{new Date(expense.expense_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        {expense.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{expense.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">{formatCurrency(expense.amount)}</p>
                        {expense.approved_amount && expense.approved_amount !== expense.amount && (
                          <p className="text-xs text-emerald-600">Approved: {formatCurrency(expense.approved_amount)}</p>
                        )}
                      </div>
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedExpense(expense); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isApprover && expense.status === 'pending' && expense.employee_id !== user?.employee_id && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(expense.claim_id)}
                            className="gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(expense.claim_id)}
                            className="gap-1 text-red-600"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No expense claims</p>
              <Button onClick={() => setShowCreate(true)}>Submit First Expense</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Details Modal */}
      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Expense Details
            </DialogTitle>
            <DialogDescription>{selectedExpense?.title}</DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={statusConfig[selectedExpense.status]?.color}>
                  {statusConfig[selectedExpense.status]?.label}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {selectedExpense.category?.replace('_', ' ')}
                </Badge>
              </div>

              {/* Amount */}
              <div className="p-4 bg-primary/5 rounded-lg text-center">
                <p className="text-xs text-slate-500 mb-1">Claimed Amount</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(selectedExpense.amount)}</p>
                {selectedExpense.approved_amount && selectedExpense.approved_amount !== selectedExpense.amount && (
                  <p className="text-sm text-emerald-600 mt-1">
                    Approved: {formatCurrency(selectedExpense.approved_amount)}
                  </p>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Expense Date</p>
                  </div>
                  <p className="font-medium">
                    {new Date(selectedExpense.expense_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Submitted</p>
                  </div>
                  <p className="font-medium">
                    {selectedExpense.created_at ? new Date(selectedExpense.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    }) : '-'}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedExpense.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Description</p>
                  </div>
                  <p className="text-sm text-slate-700">{selectedExpense.description}</p>
                </div>
              )}

              {/* Employee Info (for approvers) */}
              {isApprover && selectedExpense.employee_id && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-blue-600">Employee ID</p>
                  </div>
                  <p className="font-medium text-blue-700">{selectedExpense.employee_id}</p>
                </div>
              )}

              {/* Approval Info */}
              {selectedExpense.status === 'approved' && selectedExpense.approved_by && (
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600 mb-1">Approved By</p>
                  <p className="font-medium text-emerald-700">{selectedExpense.approved_by}</p>
                  {selectedExpense.approved_at && (
                    <p className="text-xs text-emerald-500 mt-1">
                      on {new Date(selectedExpense.approved_at).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              )}

              {/* Rejection Info */}
              {selectedExpense.status === 'rejected' && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700">{selectedExpense.rejection_reason || 'No reason provided'}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedExpense(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
