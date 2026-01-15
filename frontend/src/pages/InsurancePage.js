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
  IndianRupee,
  Car,
  Users,
  Briefcase
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const InsurancePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employee');
  
  // Employee Insurance State
  const [insuranceRecords, setInsuranceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Business Insurance State
  const [businessInsuranceRecords, setBusinessInsuranceRecords] = useState([]);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessSearchTerm, setBusinessSearchTerm] = useState('');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  // Business Insurance Dialogs
  const [showBusinessAddDialog, setShowBusinessAddDialog] = useState(false);
  const [showBusinessUploadDialog, setShowBusinessUploadDialog] = useState(false);
  const [showBusinessEditDialog, setShowBusinessEditDialog] = useState(false);
  const [editingBusinessRecord, setEditingBusinessRecord] = useState(null);
  
  // Employee Insurance Form state
  const [formData, setFormData] = useState({
    emp_code: '',
    insurance_date: '',
    amount: '',
    insurance_company: '',
    policy_number: '',
    coverage_type: '',
    accidental_insurance: false,
    esic: false,
    pmjjby: false,
    start_date: '',
    end_date: '',
    notes: ''
  });
  
  // Business Insurance Form state
  const [businessFormData, setBusinessFormData] = useState({
    name_of_insurance: '',
    vehicle_no: '',
    insurance_company: '',
    date_of_issuance: '',
    due_date: '',
    notes: ''
  });
  
  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Business Upload state
  const [businessUploadFile, setBusinessUploadFile] = useState(null);
  const [businessUploading, setBusinessUploading] = useState(false);
  const [businessUploadResult, setBusinessUploadResult] = useState(null);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    if (activeTab === 'employee') {
      fetchInsuranceRecords();
    } else {
      fetchBusinessInsuranceRecords();
    }
  }, [statusFilter, activeTab]);

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

  const fetchBusinessInsuranceRecords = async () => {
    setBusinessLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/business-insurance`, {
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        const data = await response.json();
        setBusinessInsuranceRecords(data);
      }
    } catch (error) {
      console.error('Error fetching business insurance records:', error);
      toast.error('Failed to fetch business insurance records');
    } finally {
      setBusinessLoading(false);
    }
  };

  // Employee Insurance Handlers
  const handleAddRecord = async () => {
    // Only emp_code is required - all other fields are optional
    if (!formData.emp_code) {
      toast.error('Please enter Employee Code');
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
        a.download = 'employee_insurance_template.xlsx';
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

  // Business Insurance Handlers
  const handleBusinessAddRecord = async () => {
    if (!businessFormData.name_of_insurance || !businessFormData.insurance_company) {
      toast.error('Please fill all required fields (Name of Insurance and Insurance Company)');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/business-insurance`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(businessFormData)
      });

      if (response.ok) {
        toast.success('Business insurance record added successfully');
        setShowBusinessAddDialog(false);
        resetBusinessForm();
        fetchBusinessInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add record');
      }
    } catch (error) {
      toast.error('Failed to add business insurance record');
    }
  };

  const handleBusinessEditRecord = async () => {
    if (!editingBusinessRecord) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/business-insurance/${editingBusinessRecord.business_insurance_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBusinessRecord)
      });

      if (response.ok) {
        toast.success('Business insurance record updated');
        setShowBusinessEditDialog(false);
        setEditingBusinessRecord(null);
        fetchBusinessInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update record');
      }
    } catch (error) {
      toast.error('Failed to update business insurance record');
    }
  };

  const handleBusinessDeleteRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this business insurance record?')) {
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/business-insurance/${recordId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        toast.success('Business insurance record deleted');
        fetchBusinessInsuranceRecords();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete record');
      }
    } catch (error) {
      toast.error('Failed to delete business insurance record');
    }
  };

  const handleBusinessDownloadTemplate = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/import/templates/business-insurance`, {
        credentials: 'include',
        headers: authHeaders
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'business_insurance_template.xlsx';
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

  const handleBusinessUpload = async () => {
    if (!businessUploadFile) {
      toast.error('Please select a file');
      return;
    }

    setBusinessUploading(true);
    try {
      const authHeaders = getAuthHeaders();
      const formData = new FormData();
      formData.append('file', businessUploadFile);

      const response = await fetch(`${API_URL}/import/business-insurance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': authHeaders.Authorization },
        body: formData
      });

      const result = await response.json();
      setBusinessUploadResult(result);
      
      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} records`);
        fetchBusinessInsuranceRecords();
      } else if (result.errors?.length > 0) {
        toast.error(`Import completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setBusinessUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      emp_code: '',
      insurance_date: '',
      amount: '',
      insurance_company: '',
      policy_number: '',
      coverage_type: '',
      accidental_insurance: false,
      esic: false,
      pmjjby: false,
      start_date: '',
      end_date: '',
      notes: ''
    });
  };

  const resetBusinessForm = () => {
    setBusinessFormData({
      name_of_insurance: '',
      vehicle_no: '',
      insurance_company: '',
      date_of_issuance: '',
      due_date: '',
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

  const filteredBusinessRecords = businessInsuranceRecords.filter(record => {
    const matchesSearch = 
      record.name_of_insurance?.toLowerCase().includes(businessSearchTerm.toLowerCase()) ||
      record.vehicle_no?.toLowerCase().includes(businessSearchTerm.toLowerCase()) ||
      record.insurance_company?.toLowerCase().includes(businessSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate summary stats
  const totalAmount = insuranceRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  const activeCount = insuranceRecords.filter(r => r.status === 'active').length;
  const esicCount = insuranceRecords.filter(r => r.esic === true).length;
  const companies = [...new Set(insuranceRecords.map(r => r.insurance_company).filter(Boolean))];

  if (loading && activeTab === 'employee') {
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
            Insurance
          </h1>
          <p className="text-slate-600 mt-1">Manage employee and business insurance records</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="employee" className="gap-2" data-testid="employee-insurance-tab">
            <Users className="w-4 h-4" />
            Employee Insurance
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2" data-testid="business-insurance-tab">
            <Briefcase className="w-4 h-4" />
            Business Insurance
          </TabsTrigger>
        </TabsList>

        {/* Employee Insurance Tab */}
        <TabsContent value="employee" className="space-y-6">
          {/* Action Buttons */}
          {isHR && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUploadDialog(true)} className="gap-2" data-testid="employee-bulk-upload-btn">
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2" data-testid="employee-add-record-btn">
                <Plus className="w-4 h-4" />
                Add Record
              </Button>
            </div>
          )}

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
                    <p className="text-2xl font-bold text-slate-900">{esicCount}</p>
                    <p className="text-xs text-slate-500">ESIC Covered</p>
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
                    data-testid="employee-insurance-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="employee-status-filter">
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

          {/* Employee Insurance Records Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Employee Insurance Records
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
                      <TableHead className="text-center">ESIC</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Insurance Company</TableHead>
                      <TableHead>Policy No.</TableHead>
                      <TableHead className="text-center">Accidental</TableHead>
                      <TableHead>Status</TableHead>
                      {isHR && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <TableRow key={record.insurance_id} data-testid={`employee-insurance-row-${record.insurance_id}`}>
                          <TableCell className="font-medium">{record.emp_code}</TableCell>
                          <TableCell>{record.employee_name}</TableCell>
                          <TableCell className="text-center">
                            {record.esic ? (
                              <Badge className="bg-green-100 text-green-700">YES</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-500">NO</Badge>
                            )}
                          </TableCell>
                          <TableCell>{record.esic ? '-' : record.insurance_date}</TableCell>
                          <TableCell>{record.esic ? '-' : (record.amount ? `₹${record.amount?.toLocaleString('en-IN')}` : '-')}</TableCell>
                          <TableCell>{record.esic ? '-' : (record.insurance_company || '-')}</TableCell>
                          <TableCell>{record.esic ? '-' : (record.policy_number || '-')}</TableCell>
                          <TableCell className="text-center">
                            {record.accidental_insurance ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )}
                          </TableCell>
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
                                  data-testid={`edit-employee-insurance-${record.insurance_id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteRecord(record.insurance_id)}
                                  data-testid={`delete-employee-insurance-${record.insurance_id}`}
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
                        <TableCell colSpan={isHR ? 10 : 9} className="text-center py-8 text-slate-500">
                          No insurance records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Insurance Tab */}
        <TabsContent value="business" className="space-y-6">
          {/* Action Buttons */}
          {isHR && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBusinessUploadDialog(true)} className="gap-2" data-testid="business-bulk-upload-btn">
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
              <Button onClick={() => setShowBusinessAddDialog(true)} className="gap-2" data-testid="business-add-record-btn">
                <Plus className="w-4 h-4" />
                Add Record
              </Button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{businessInsuranceRecords.length}</p>
                    <p className="text-xs text-slate-500">Total Policies</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Car className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {businessInsuranceRecords.filter(r => r.vehicle_no).length}
                    </p>
                    <p className="text-xs text-slate-500">Vehicle Policies</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {businessInsuranceRecords.filter(r => {
                        if (!r.due_date) return false;
                        const dueDate = new Date(r.due_date);
                        const today = new Date();
                        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                        return diffDays <= 30 && diffDays > 0;
                      }).length}
                    </p>
                    <p className="text-xs text-slate-500">Due in 30 Days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by insurance name, vehicle no, or company..."
                  value={businessSearchTerm}
                  onChange={(e) => setBusinessSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="business-insurance-search"
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Insurance Records Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Business Insurance Records
              </CardTitle>
              <CardDescription>{filteredBusinessRecords.length} records found</CardDescription>
            </CardHeader>
            <CardContent>
              {businessLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sl. No.</TableHead>
                        <TableHead>Name of Insurance</TableHead>
                        <TableHead>Vehicle No.</TableHead>
                        <TableHead>Insurance Company</TableHead>
                        <TableHead>Date of Issuance</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        {isHR && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBusinessRecords.length > 0 ? (
                        filteredBusinessRecords.map((record, index) => {
                          const dueDate = record.due_date ? new Date(record.due_date) : null;
                          const today = new Date();
                          const diffDays = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : null;
                          const isExpired = diffDays !== null && diffDays < 0;
                          const isDueSoon = diffDays !== null && diffDays <= 30 && diffDays > 0;
                          
                          return (
                            <TableRow key={record.business_insurance_id} data-testid={`business-insurance-row-${record.business_insurance_id}`}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>{record.name_of_insurance}</TableCell>
                              <TableCell>{record.vehicle_no || '-'}</TableCell>
                              <TableCell>{record.insurance_company}</TableCell>
                              <TableCell>{record.date_of_issuance || '-'}</TableCell>
                              <TableCell>
                                <span className={isDueSoon ? 'text-amber-600 font-medium' : isExpired ? 'text-red-600 font-medium' : ''}>
                                  {record.due_date || '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={
                                    isExpired ? 'bg-red-100 text-red-700' :
                                    isDueSoon ? 'bg-amber-100 text-amber-700' :
                                    'bg-emerald-100 text-emerald-700'
                                  }
                                >
                                  {isExpired ? 'Expired' : isDueSoon ? 'Due Soon' : 'Active'}
                                </Badge>
                              </TableCell>
                              {isHR && (
                                <TableCell className="text-right">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingBusinessRecord(record);
                                        setShowBusinessEditDialog(true);
                                      }}
                                      data-testid={`edit-business-insurance-${record.business_insurance_id}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => handleBusinessDeleteRecord(record.business_insurance_id)}
                                      data-testid={`delete-business-insurance-${record.business_insurance_id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={isHR ? 8 : 7} className="text-center py-8 text-slate-500">
                            No business insurance records found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Employee Insurance Record Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Add Employee Insurance Record
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
                  data-testid="add-emp-code-input"
                />
              </div>
              <div className="flex items-center space-x-3 pt-6">
                <input
                  type="checkbox"
                  id="esic"
                  checked={formData.esic}
                  onChange={(e) => setFormData({ ...formData, esic: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  data-testid="add-esic-checkbox"
                />
                <Label htmlFor="esic" className="cursor-pointer font-medium">
                  ESIC Covered
                </Label>
              </div>
            </div>
            
            {!formData.esic && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Insurance Date *</Label>
                    <Input
                      type="date"
                      value={formData.insurance_date}
                      onChange={(e) => setFormData({ ...formData, insurance_date: e.target.value })}
                      data-testid="add-insurance-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      data-testid="add-amount-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Insurance Company *</Label>
                    <Input
                      placeholder="e.g., LIC, HDFC Ergo"
                      value={formData.insurance_company}
                      onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                      data-testid="add-insurance-company-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Number</Label>
                    <Input
                      placeholder="Policy number"
                      value={formData.policy_number}
                      onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                      data-testid="add-policy-number-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Coverage Type</Label>
                    <Select
                      value={formData.coverage_type}
                      onValueChange={(value) => setFormData({ ...formData, coverage_type: value })}
                    >
                      <SelectTrigger data-testid="add-coverage-type-select">
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
                  <div className="flex items-center space-x-3 pt-6">
                    <input
                      type="checkbox"
                      id="accidental_insurance"
                      checked={formData.accidental_insurance}
                      onChange={(e) => setFormData({ ...formData, accidental_insurance: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      data-testid="add-accidental-insurance-checkbox"
                    />
                    <Label htmlFor="accidental_insurance" className="cursor-pointer">
                      Accidental Insurance
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      data-testid="add-start-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      data-testid="add-end-date-input"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="add-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddRecord} data-testid="add-employee-insurance-submit">
              Add Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Insurance Record Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Employee Insurance Record
            </DialogTitle>
            <DialogDescription>
              {editingRecord?.emp_code} - {editingRecord?.employee_name}
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 py-2">
                <input
                  type="checkbox"
                  id="edit_esic"
                  checked={editingRecord.esic || false}
                  onChange={(e) => setEditingRecord({ ...editingRecord, esic: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  data-testid="edit-esic-checkbox"
                />
                <Label htmlFor="edit_esic" className="cursor-pointer font-medium">
                  ESIC Covered
                </Label>
              </div>
              
              {!editingRecord.esic && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Insurance Date</Label>
                      <Input
                        type="date"
                        value={editingRecord.insurance_date || ''}
                        onChange={(e) => setEditingRecord({ ...editingRecord, insurance_date: e.target.value })}
                        data-testid="edit-insurance-date-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input
                        type="number"
                        value={editingRecord.amount || ''}
                        onChange={(e) => setEditingRecord({ ...editingRecord, amount: parseFloat(e.target.value) })}
                        data-testid="edit-amount-input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Insurance Company</Label>
                      <Input
                        value={editingRecord.insurance_company || ''}
                        onChange={(e) => setEditingRecord({ ...editingRecord, insurance_company: e.target.value })}
                        data-testid="edit-insurance-company-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Policy Number</Label>
                      <Input
                        value={editingRecord.policy_number || ''}
                        onChange={(e) => setEditingRecord({ ...editingRecord, policy_number: e.target.value })}
                        data-testid="edit-policy-number-input"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingRecord.status || 'active'}
                    onValueChange={(value) => setEditingRecord({ ...editingRecord, status: value })}
                  >
                    <SelectTrigger data-testid="edit-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingRecord.esic && (
                  <div className="space-y-2">
                    <Label>Coverage Type</Label>
                    <Select
                      value={editingRecord.coverage_type || 'health'}
                      onValueChange={(value) => setEditingRecord({ ...editingRecord, coverage_type: value })}
                    >
                      <SelectTrigger data-testid="edit-coverage-type-select">
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
                )}
              </div>
              <div className="flex items-center space-x-3 py-2">
                <input
                  type="checkbox"
                  id="edit_accidental_insurance"
                  checked={editingRecord.accidental_insurance || false}
                  onChange={(e) => setEditingRecord({ ...editingRecord, accidental_insurance: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  data-testid="edit-accidental-insurance-checkbox"
                />
                <Label htmlFor="edit_accidental_insurance" className="cursor-pointer">
                  Accidental Insurance Coverage
                </Label>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  data-testid="edit-notes-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRecord(null); }}>
              Cancel
            </Button>
            <Button onClick={handleEditRecord} data-testid="edit-employee-insurance-submit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Employee Insurance Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { setShowUploadDialog(open); if (!open) { setUploadFile(null); setUploadResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Bulk Upload Employee Insurance Data
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file with employee insurance records
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
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2" data-testid="download-employee-template-btn">
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
                id="employee-insurance-upload"
              />
              <label htmlFor="employee-insurance-upload" className="cursor-pointer">
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
            <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="gap-2" data-testid="upload-employee-insurance-btn">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Business Insurance Record Dialog */}
      <Dialog open={showBusinessAddDialog} onOpenChange={setShowBusinessAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Add Business Insurance Record
            </DialogTitle>
            <DialogDescription>
              Enter details for a business insurance policy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name of Insurance *</Label>
              <Input
                placeholder="e.g., Fire Insurance, Vehicle Insurance"
                value={businessFormData.name_of_insurance}
                onChange={(e) => setBusinessFormData({ ...businessFormData, name_of_insurance: e.target.value })}
                data-testid="add-business-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle No. (if applicable)</Label>
              <Input
                placeholder="e.g., MH01AB1234"
                value={businessFormData.vehicle_no}
                onChange={(e) => setBusinessFormData({ ...businessFormData, vehicle_no: e.target.value })}
                data-testid="add-business-vehicle-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Name of Insurance Company *</Label>
              <Input
                placeholder="e.g., New India Assurance"
                value={businessFormData.insurance_company}
                onChange={(e) => setBusinessFormData({ ...businessFormData, insurance_company: e.target.value })}
                data-testid="add-business-company-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Issuance</Label>
                <Input
                  type="date"
                  value={businessFormData.date_of_issuance}
                  onChange={(e) => setBusinessFormData({ ...businessFormData, date_of_issuance: e.target.value })}
                  data-testid="add-business-issuance-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={businessFormData.due_date}
                  onChange={(e) => setBusinessFormData({ ...businessFormData, due_date: e.target.value })}
                  data-testid="add-business-due-date-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={businessFormData.notes}
                onChange={(e) => setBusinessFormData({ ...businessFormData, notes: e.target.value })}
                data-testid="add-business-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBusinessAddDialog(false); resetBusinessForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleBusinessAddRecord} data-testid="add-business-insurance-submit">
              Add Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Business Insurance Record Dialog */}
      <Dialog open={showBusinessEditDialog} onOpenChange={setShowBusinessEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Business Insurance Record
            </DialogTitle>
            <DialogDescription>
              {editingBusinessRecord?.name_of_insurance}
            </DialogDescription>
          </DialogHeader>
          {editingBusinessRecord && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name of Insurance</Label>
                <Input
                  value={editingBusinessRecord.name_of_insurance || ''}
                  onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, name_of_insurance: e.target.value })}
                  data-testid="edit-business-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle No.</Label>
                <Input
                  value={editingBusinessRecord.vehicle_no || ''}
                  onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, vehicle_no: e.target.value })}
                  data-testid="edit-business-vehicle-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Insurance Company</Label>
                <Input
                  value={editingBusinessRecord.insurance_company || ''}
                  onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, insurance_company: e.target.value })}
                  data-testid="edit-business-company-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Issuance</Label>
                  <Input
                    type="date"
                    value={editingBusinessRecord.date_of_issuance || ''}
                    onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, date_of_issuance: e.target.value })}
                    data-testid="edit-business-issuance-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editingBusinessRecord.due_date || ''}
                    onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, due_date: e.target.value })}
                    data-testid="edit-business-due-date-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editingBusinessRecord.notes || ''}
                  onChange={(e) => setEditingBusinessRecord({ ...editingBusinessRecord, notes: e.target.value })}
                  data-testid="edit-business-notes-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBusinessEditDialog(false); setEditingBusinessRecord(null); }}>
              Cancel
            </Button>
            <Button onClick={handleBusinessEditRecord} data-testid="edit-business-insurance-submit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Business Insurance Dialog */}
      <Dialog open={showBusinessUploadDialog} onOpenChange={(open) => { setShowBusinessUploadDialog(open); if (!open) { setBusinessUploadFile(null); setBusinessUploadResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Bulk Upload Business Insurance Data
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file with business insurance records
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Download Template */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Download Template</p>
                  <p className="text-sm text-slate-500">Get the Excel template matching your format</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleBusinessDownloadTemplate} className="gap-2" data-testid="download-business-template-btn">
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
                onChange={(e) => setBusinessUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="business-insurance-upload"
              />
              <label htmlFor="business-insurance-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  {businessUploadFile ? businessUploadFile.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Excel (.xlsx) or CSV files</p>
              </label>
            </div>

            {/* Upload Result */}
            {businessUploadResult && (
              <div className={`p-4 rounded-lg ${businessUploadResult.errors?.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {businessUploadResult.errors?.length > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  <span className="font-medium">
                    {businessUploadResult.imported} of {businessUploadResult.total_rows} records imported
                  </span>
                </div>
                {businessUploadResult.errors?.length > 0 && (
                  <div className="text-sm text-amber-700 mt-2">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc list-inside mt-1">
                      {businessUploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>Row {err.row}: {err.error}</li>
                      ))}
                      {businessUploadResult.errors.length > 5 && (
                        <li>...and {businessUploadResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBusinessUploadDialog(false); setBusinessUploadFile(null); setBusinessUploadResult(null); }}>
              Close
            </Button>
            <Button onClick={handleBusinessUpload} disabled={!businessUploadFile || businessUploading} className="gap-2" data-testid="upload-business-insurance-btn">
              {businessUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsurancePage;
