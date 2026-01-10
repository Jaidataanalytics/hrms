import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  Shield,
  Plus,
  Upload,
  Download,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Calendar,
  IndianRupee
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const InsurancePage = () => {
  const { user } = useAuth();
  const [insuranceRecords, setInsuranceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    emp_code: '',
    insurance_date: new Date().toISOString().split('T')[0],
    amount: '',
    insurance_company: '',
    policy_number: '',
    coverage_type: 'health',
    start_date: '',
    end_date: '',
    notes: ''
  });
  
  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchInsuranceRecords();
  }, [statusFilter]);

  const fetchInsuranceRecords = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      let url = `${API_URL}/insurance`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        const data = await response.json();
        setInsuranceRecords(data);
      }
    } catch (error) {
      console.error('Error fetching insurance records:', error);
      toast.error('Failed to fetch insurance records');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!formData.emp_code || !formData.amount || !formData.insurance_company) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/insurance`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Insurance record added successfully');
        setShowAddDialog(false);
        resetForm();
        fetchInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add record');
      }
    } catch (error) {
      toast.error('Failed to add insurance record');
    }
  };

  const handleEditRecord = async () => {
    if (!editingRecord) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/insurance/${editingRecord.insurance_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecord)
      });

      if (response.ok) {
        toast.success('Insurance record updated');
        setShowEditDialog(false);
        setEditingRecord(null);
        fetchInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update record');
      }
    } catch (error) {
      toast.error('Failed to update insurance record');
    }
  };

  const handleDeleteRecord = async (insuranceId) => {
    if (!window.confirm('Are you sure you want to delete this insurance record?')) {
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/insurance/${insuranceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        toast.success('Insurance record deleted');
        fetchInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete record');
      }
    } catch (error) {
      toast.error('Failed to delete insurance record');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/import/templates/insurance`, {
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'insurance_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Template downloaded');
      } else {
        toast.error('Failed to download template');
      }
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const authHeaders = getAuthHeaders();
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`${API_URL}/import/insurance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': authHeaders.Authorization },
        body: formData
      });

      const result = await response.json();
      setUploadResult(result);
      
      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} records`);
        fetchInsuranceRecords();
      } else if (result.errors?.length > 0) {
        toast.error(`Import completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      emp_code: '',
      insurance_date: new Date().toISOString().split('T')[0],
      amount: '',
      insurance_company: '',
      policy_number: '',
      coverage_type: 'health',
      start_date: '',
      end_date: '',
      notes: ''
    });
  };

  // Filter records
  const filteredRecords = insuranceRecords.filter(record => {
    const matchesSearch = 
      record.emp_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.insurance_company?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate summary stats
  const totalAmount = insuranceRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  const activeCount = insuranceRecords.filter(r => r.status === 'active').length;
  const companies = [...new Set(insuranceRecords.map(r => r.insurance_company))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Employee Insurance
          </h1>
          <p className="text-slate-600 mt-1">Manage employee insurance records</p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Bulk Upload
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Record
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{insuranceRecords.length}</p>
                <p className="text-xs text-slate-500">Total Records</p>
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
                <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
                <p className="text-xs text-slate-500">Active Policies</p>
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
                <p className="text-2xl font-bold text-slate-900">₹{(totalAmount/100000).toFixed(1)}L</p>
                <p className="text-xs text-slate-500">Total Premium</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{companies.length}</p>
                <p className="text-xs text-slate-500">Insurers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by employee code, name, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Insurance Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Insurance Records
          </CardTitle>
          <CardDescription>{filteredRecords.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emp Code</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Insurance Company</TableHead>
                  <TableHead>Policy No.</TableHead>
                  <TableHead>Status</TableHead>
                  {isHR && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record) => (
                    <TableRow key={record.insurance_id}>
                      <TableCell className="font-medium">{record.emp_code}</TableCell>
                      <TableCell>{record.employee_name}</TableCell>
                      <TableCell>{record.insurance_date}</TableCell>
                      <TableCell>₹{record.amount?.toLocaleString('en-IN')}</TableCell>
                      <TableCell>{record.insurance_company}</TableCell>
                      <TableCell>{record.policy_number || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            record.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            record.status === 'expired' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      {isHR && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingRecord(record);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteRecord(record.insurance_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={isHR ? 8 : 7} className="text-center py-8 text-slate-500">
                      No insurance records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Record Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Add Insurance Record
            </DialogTitle>
            <DialogDescription>
              Enter insurance details for an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Code *</Label>
                <Input
                  placeholder="e.g., S0003"
                  value={formData.emp_code}
                  onChange={(e) => setFormData({ ...formData, emp_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Insurance Date *</Label>
                <Input
                  type="date"
                  value={formData.insurance_date}
                  onChange={(e) => setFormData({ ...formData, insurance_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Insurance Company *</Label>
                <Input
                  placeholder="e.g., LIC, HDFC Ergo"
                  value={formData.insurance_company}
                  onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Policy Number</Label>
                <Input
                  placeholder="Policy number"
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Coverage Type</Label>
                <Select
                  value={formData.coverage_type}
                  onValueChange={(value) => setFormData({ ...formData, coverage_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="life">Life</SelectItem>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddRecord}>
              Add Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Insurance Record
            </DialogTitle>
            <DialogDescription>
              {editingRecord?.emp_code} - {editingRecord?.employee_name}
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Date</Label>
                  <Input
                    type="date"
                    value={editingRecord.insurance_date || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, insurance_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRecord.amount || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Company</Label>
                  <Input
                    value={editingRecord.insurance_company || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, insurance_company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input
                    value={editingRecord.policy_number || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, policy_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingRecord.status || 'active'}
                    onValueChange={(value) => setEditingRecord({ ...editingRecord, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Coverage Type</Label>
                  <Select
                    value={editingRecord.coverage_type || 'health'}
                    onValueChange={(value) => setEditingRecord({ ...editingRecord, coverage_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="life">Life</SelectItem>
                      <SelectItem value="accident">Accident</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRecord(null); }}>
              Cancel
            </Button>
            <Button onClick={handleEditRecord}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { setShowUploadDialog(open); if (!open) { setUploadFile(null); setUploadResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Bulk Upload Insurance Data
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file with insurance records
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Download Template */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Download Template</p>
                  <p className="text-sm text-slate-500">Get the Excel template to fill in your data</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
                  <Download className="w-4 h-4" />
                  Template
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="insurance-upload"
              />
              <label htmlFor="insurance-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  {uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Excel (.xlsx) or CSV files</p>
              </label>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`p-4 rounded-lg ${uploadResult.errors?.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {uploadResult.errors?.length > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  <span className="font-medium">
                    {uploadResult.imported} of {uploadResult.total_rows} records imported
                  </span>
                </div>
                {uploadResult.errors?.length > 0 && (
                  <div className="text-sm text-amber-700 mt-2">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc list-inside mt-1">
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>Row {err.row}: {err.error}</li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li>...and {uploadResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFile(null); setUploadResult(null); }}>
              Close
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="gap-2">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsurancePage;
