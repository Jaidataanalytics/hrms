import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  Building,
  Plus,
  RefreshCw,
  Users,
  IndianRupee,
  Calendar,
  AlertTriangle,
  Trash2,
  Edit,
  TrendingUp
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Generate month options for the last 24 months
const generateMonthOptions = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthYear = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({ label: monthYear, value });
  }
  return months;
};

const LabourPage = () => {
  const { user } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [labourRecords, setLabourRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContractor, setSelectedContractor] = useState('');
  
  // Dialog states
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  // Form states
  const [contractorForm, setContractorForm] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    phone: ''
  });
  
  const [recordForm, setRecordForm] = useState({
    month: '',
    labour_count: '',
    payment_amount: ''
  });

  const monthOptions = generateMonthOptions();
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchContractors();
  }, []);

  useEffect(() => {
    if (selectedContractor) {
      fetchLabourRecords(selectedContractor);
    } else {
      setLabourRecords([]);
    }
  }, [selectedContractor]);

  const fetchContractors = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/contractors`, {
        credentials: 'include',
        headers: authHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setContractors(data);
        // Auto-select first contractor if available
        if (data.length > 0 && !selectedContractor) {
          setSelectedContractor(data[0].contractor_id);
        }
      }
    } catch (error) {
      console.error('Error fetching contractors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLabourRecords = async (contractorId) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/monthly-records?contractor_id=${contractorId}`, {
        credentials: 'include',
        headers: authHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setLabourRecords(data);
      }
    } catch (error) {
      console.error('Error fetching labour records:', error);
      setLabourRecords([]);
    }
  };

  const handleCreateContractor = async () => {
    if (!contractorForm.name || !contractorForm.company_name) {
      toast.error('Please fill contractor name and company name');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/contractors`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(contractorForm)
      });

      if (response.ok) {
        const newContractor = await response.json();
        toast.success('Contractor added successfully');
        setShowAddContractor(false);
        setContractorForm({ name: '', company_name: '', contact_person: '', phone: '' });
        await fetchContractors();
        setSelectedContractor(newContractor.contractor_id);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add contractor');
      }
    } catch (error) {
      toast.error('Failed to add contractor');
    }
  };

  const handleCreateRecord = async () => {
    if (!selectedContractor || !recordForm.month || !recordForm.labour_count || !recordForm.payment_amount) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/monthly-records`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: selectedContractor,
          month: recordForm.month,
          labour_count: parseInt(recordForm.labour_count),
          payment_amount: parseFloat(recordForm.payment_amount)
        })
      });

      if (response.ok) {
        toast.success('Record added successfully');
        setShowAddRecord(false);
        setRecordForm({ month: '', labour_count: '', payment_amount: '' });
        fetchLabourRecords(selectedContractor);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add record');
      }
    } catch (error) {
      toast.error('Failed to add record');
    }
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/monthly-records/${editingRecord.record_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labour_count: parseInt(editingRecord.labour_count),
          payment_amount: parseFloat(editingRecord.payment_amount)
        })
      });

      if (response.ok) {
        toast.success('Record updated');
        setShowEditRecord(false);
        setEditingRecord(null);
        fetchLabourRecords(selectedContractor);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update record');
      }
    } catch (error) {
      toast.error('Failed to update record');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/labour/monthly-records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        toast.success('Record deleted');
        fetchLabourRecords(selectedContractor);
      } else {
        toast.error('Failed to delete record');
      }
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return '-';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate summary
  const totalLabour = labourRecords.reduce((sum, r) => sum + (r.labour_count || 0), 0);
  const totalPayment = labourRecords.reduce((sum, r) => sum + (r.payment_amount || 0), 0);
  const avgLabour = labourRecords.length > 0 ? Math.round(totalLabour / labourRecords.length) : 0;

  const selectedContractorData = contractors.find(c => c.contractor_id === selectedContractor);

  if (!isHR) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-600">You don't have permission to access this page</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="labour-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Contract Labour
          </h1>
          <p className="text-slate-600 mt-1">Track contractor labour and payments</p>
        </div>
        <Button variant="outline" onClick={() => setShowAddContractor(true)} className="gap-2" data-testid="add-contractor-btn">
          <Building className="w-4 h-4" />
          Add Contractor
        </Button>
      </div>

      {/* Contractor Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium">Select Contractor</Label>
              <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                <SelectTrigger className="w-full" data-testid="contractor-select">
                  <SelectValue placeholder="Select a contractor" />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map(c => (
                    <SelectItem key={c.contractor_id} value={c.contractor_id}>
                      {c.company_name} {c.name ? `(${c.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedContractor && (
              <Button onClick={() => setShowAddRecord(true)} className="gap-2" data-testid="add-record-btn">
                <Plus className="w-4 h-4" />
                Add Record
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedContractor && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 truncate" title={selectedContractorData?.company_name}>
                    {selectedContractorData?.company_name?.substring(0, 12)}...
                  </p>
                  <p className="text-xs text-slate-500">Contractor</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{labourRecords.length}</p>
                  <p className="text-xs text-slate-500">Months Recorded</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{avgLabour}</p>
                  <p className="text-xs text-slate-500">Avg Labour/Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">₹{(totalPayment/100000).toFixed(1)}L</p>
                  <p className="text-xs text-slate-500">Total Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Labour Records Table */}
      {selectedContractor && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Monthly Labour Records
            </CardTitle>
            <CardDescription>
              {selectedContractorData?.company_name} - {labourRecords.length} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-center">Number of Labour</TableHead>
                    <TableHead className="text-right">Payment Made</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labourRecords.length > 0 ? (
                    labourRecords.map((record) => (
                      <TableRow key={record.record_id} data-testid={`labour-record-${record.record_id}`}>
                        <TableCell className="font-medium">{formatMonth(record.month)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700 font-semibold">
                            {record.labour_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(record.payment_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingRecord(record);
                                setShowEditRecord(true);
                              }}
                              data-testid={`edit-record-${record.record_id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteRecord(record.record_id)}
                              data-testid={`delete-record-${record.record_id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        No records found. Click "Add Record" to add monthly labour data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Contractor Selected */}
      {!selectedContractor && contractors.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Contractors Yet</h3>
            <p className="text-slate-500 mb-4">Add a contractor to start tracking labour and payments</p>
            <Button onClick={() => setShowAddContractor(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add First Contractor
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Contractor Dialog */}
      <Dialog open={showAddContractor} onOpenChange={setShowAddContractor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Add Contractor</DialogTitle>
            <DialogDescription>Add a new contractor to track their labour and payments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contractor Name *</Label>
              <Input
                placeholder="e.g., Raj Kumar"
                value={contractorForm.name}
                onChange={(e) => setContractorForm({ ...contractorForm, name: e.target.value })}
                data-testid="contractor-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                placeholder="e.g., RK Enterprises"
                value={contractorForm.company_name}
                onChange={(e) => setContractorForm({ ...contractorForm, company_name: e.target.value })}
                data-testid="contractor-company-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  placeholder="Name"
                  value={contractorForm.contact_person}
                  onChange={(e) => setContractorForm({ ...contractorForm, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="Mobile number"
                  value={contractorForm.phone}
                  onChange={(e) => setContractorForm({ ...contractorForm, phone: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContractor(false)}>Cancel</Button>
            <Button onClick={handleCreateContractor} data-testid="save-contractor-btn">Add Contractor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Record Dialog */}
      <Dialog open={showAddRecord} onOpenChange={setShowAddRecord}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Add Monthly Record</DialogTitle>
            <DialogDescription>
              {selectedContractorData?.company_name} - Add labour and payment data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Month *</Label>
              <Select value={recordForm.month} onValueChange={(v) => setRecordForm({ ...recordForm, month: v })}>
                <SelectTrigger data-testid="month-select">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Labour *</Label>
              <Input
                type="number"
                placeholder="e.g., 120"
                value={recordForm.labour_count}
                onChange={(e) => setRecordForm({ ...recordForm, labour_count: e.target.value })}
                data-testid="labour-count-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Made (₹) *</Label>
              <Input
                type="number"
                placeholder="e.g., 800000"
                value={recordForm.payment_amount}
                onChange={(e) => setRecordForm({ ...recordForm, payment_amount: e.target.value })}
                data-testid="payment-amount-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRecord(false)}>Cancel</Button>
            <Button onClick={handleCreateRecord} data-testid="save-record-btn">Add Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={showEditRecord} onOpenChange={setShowEditRecord}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Edit Record</DialogTitle>
            <DialogDescription>
              {editingRecord ? formatMonth(editingRecord.month) : ''}
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Number of Labour</Label>
                <Input
                  type="number"
                  value={editingRecord.labour_count || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, labour_count: e.target.value })}
                  data-testid="edit-labour-count-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Made (₹)</Label>
                <Input
                  type="number"
                  value={editingRecord.payment_amount || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, payment_amount: e.target.value })}
                  data-testid="edit-payment-amount-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditRecord(false); setEditingRecord(null); }}>Cancel</Button>
            <Button onClick={handleUpdateRecord} data-testid="update-record-btn">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LabourPage;
