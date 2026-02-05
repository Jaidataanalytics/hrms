import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Calendar,
  User,
  Clock,
  FileText,
  Edit,
  RefreshCw,
  Save,
  Package,
  CheckCircle2,
  XCircle,
  Home,
  Laptop,
  Smartphone,
  Printer,
  Upload,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const EmployeeProfile = () => {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Attendance state
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Assets state
  const [assets, setAssets] = useState(null);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', type: '', description: '', file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

  useEffect(() => {
    if (employee) {
      fetchAttendance();
    }
  }, [employee, selectedMonth, selectedYear]);

  const fetchEmployeeData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [empRes, deptRes, desigRes] = await Promise.all([
        fetch(`${API_URL}/employees/${id}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/departments`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/designations`, { credentials: 'include', headers: authHeaders })
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployee(empData);
        // Fetch assets after getting employee data
        fetchAssets(empData.employee_id, empData.emp_code);
        // Fetch documents
        fetchDocuments(empData.employee_id);
      } else {
        toast.error('Employee not found');
      }

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (desigRes.ok) setDesignations(await desigRes.json());
      
      // Fetch document types
      const docTypesRes = await fetch(`${API_URL}/document-types`, { credentials: 'include', headers: authHeaders });
      if (docTypesRes.ok) setDocumentTypes(await docTypesRes.json());
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    if (!employee) return;
    setAttendanceLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      // Try with employee_id first, then emp_code
      const identifier = employee.employee_id || employee.emp_code;
      const response = await fetch(
        `${API_URL}/attendance?employee_id=${identifier}&month=${selectedMonth}&year=${selectedYear}`,
        { credentials: 'include', headers: authHeaders }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchAssets = async (employeeId, empCode) => {
    try {
      const authHeaders = getAuthHeaders();
      
      // First try the employee_assets endpoint (old format)
      let response = await fetch(`${API_URL}/employee-assets/${empCode || employeeId}`, { 
        credentials: 'include', 
        headers: authHeaders 
      });
      
      let oldAssets = null;
      if (response.ok) {
        oldAssets = await response.json();
      }
      
      // Also fetch from the new assets collection
      const assetsResponse = await fetch(`${API_URL}/assets?search=${empCode}`, {
        credentials: 'include',
        headers: authHeaders
      });
      
      let assignedAssets = [];
      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        assignedAssets = (assetsData.assets || []).filter(a => 
          a.emp_code === empCode && a.status === 'assigned'
        );
      }
      
      // Combine both data sources
      setAssets({
        ...oldAssets,
        assigned_items: assignedAssets
      });
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const fetchDocuments = async (employeeId) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/documents?employee_id=${employeeId}`, {
        credentials: 'include',
        headers: authHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleDocUpload = async () => {
    if (!docForm.name || !docForm.type) {
      toast.error('Please fill required fields');
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('name', docForm.name);
      formData.append('type', docForm.type);
      formData.append('description', docForm.description || '');
      formData.append('employee_id', employee.employee_id);
      if (docForm.file) {
        formData.append('file', docForm.file);
      }

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('Document uploaded successfully');
        setShowDocUpload(false);
        setDocForm({ name: '', type: '', description: '', file: null });
        fetchDocuments(employee.employee_id);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to upload document');
      }
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`${API_URL}/documents/${docId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Document deleted');
        fetchDocuments(employee.employee_id);
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Attendance helpers
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'present': return 'bg-emerald-100 text-emerald-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'wfh': return 'bg-blue-100 text-blue-700';
      case 'leave': return 'bg-amber-100 text-amber-700';
      case 'half_day': case 'hd': return 'bg-orange-100 text-orange-700';
      case 'holiday': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const attendanceSummary = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    wfh: attendance.filter(a => a.status === 'wfh').length,
    leave: attendance.filter(a => a.status === 'leave').length,
    late: attendance.filter(a => a.is_late).length
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

  const handleEditClick = () => {
    setEditForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      date_of_birth: employee.date_of_birth?.split(' ')[0] || employee.date_of_birth?.split('T')[0] || '',
      gender: employee.gender || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || '',
      pincode: employee.pincode || '',
      department_id: employee.department_id || '',
      designation_id: employee.designation_id || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        toast.success('Employee updated successfully');
        setEditDialogOpen(false);
        fetchEmployeeData();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to update employee');
      }
    } catch (error) {
      toast.error('Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.department_id === deptId);
    return dept?.name || 'Unassigned';
  };

  const getDesignationName = (desigId) => {
    const desig = designations.find(d => d.designation_id === desigId);
    return desig?.name || 'Not Assigned';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Employee not found</p>
        <Link to="/dashboard/employees">
          <Button className="mt-4">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="employee-profile-page">
      {/* Back Button */}
      <Link to="/dashboard/employees" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" />
        Back to Directory
      </Link>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24 mx-auto md:mx-0">
              <AvatarFallback className="bg-primary text-white text-2xl font-semibold">
                {getInitials(employee.first_name, employee.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {employee.first_name} {employee.last_name}
                </h1>
                <Badge className={employee.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600'}>
                  {employee.status}
                </Badge>
              </div>
              <p className="text-slate-600 mb-4">
                {getDesignationName(employee.designation_id)} • {getDepartmentName(employee.department_id)}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4" />
                  {employee.email}
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4" />
                    {employee.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-4 h-4" />
                  <span className="capitalize">{employee.employment_type}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <Button variant="outline" className="gap-2" data-testid="edit-employee-btn" onClick={handleEditClick}>
                <Edit className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="bg-white border flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">Attendance</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">First Name</p>
                    <p className="font-medium">{employee.first_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Last Name</p>
                    <p className="font-medium">{employee.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date of Birth</p>
                    <p className="font-medium">{formatDate(employee.date_of_birth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Gender</p>
                    <p className="font-medium capitalize">{employee.gender || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium">{employee.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="font-medium">
                    {employee.address ? `${employee.address}, ${employee.city || ''}, ${employee.state || ''} - ${employee.pincode || ''}` : 'Not provided'}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-slate-500">Emergency Contact</p>
                  <p className="font-medium">{employee.emergency_contact_name || 'Not provided'}</p>
                  <p className="text-sm text-slate-600">{employee.emergency_contact_phone || ''}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Organization Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Employee ID</p>
                    <p className="font-medium">{employee.emp_code || employee.employee_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Employment Type</p>
                    <p className="font-medium capitalize">{employee.employment_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Department</p>
                    <p className="font-medium">{getDepartmentName(employee.department_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Designation</p>
                    <p className="font-medium">{getDesignationName(employee.designation_id)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Important Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Joining Date</p>
                    <p className="font-medium">{formatDate(employee.joining_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Confirmation Date</p>
                    <p className="font-medium">{formatDate(employee.confirmation_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Probation End</p>
                    <p className="font-medium">{formatDate(employee.probation_end_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <Badge className={employee.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {employee.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Documents ({documents.length})
              </CardTitle>
              <Button size="sm" onClick={() => setShowDocUpload(true)}>
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.document_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="font-medium text-sm">{doc.name}</p>
                              {doc.description && <p className="text-xs text-slate-500">{doc.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {documentTypes.find(t => t.type_id === doc.type)?.name || doc.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={doc.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {doc.is_verified ? 'Verified' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(doc.file_url, '_blank')}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteDocument(doc.document_id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No documents uploaded yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowDocUpload(true)}>
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Document Upload Dialog */}
          <Dialog open={showDocUpload} onOpenChange={setShowDocUpload}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Upload a document for {employee?.first_name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Document Name *</Label>
                  <Input
                    value={docForm.name}
                    onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                    placeholder="e.g., PAN Card, Aadhaar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Document Type *</Label>
                  <Select value={docForm.type} onValueChange={(v) => setDocForm({ ...docForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(type => (
                        <SelectItem key={type.type_id} value={type.type_id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={docForm.description}
                    onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                  />
                  <p className="text-xs text-slate-500">Supported: PDF, JPG, PNG, DOC up to 10MB</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDocUpload(false)}>Cancel</Button>
                <Button onClick={handleDocUpload} disabled={uploadingDoc}>
                  {uploadingDoc ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Monthly Attendance
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
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
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{attendanceSummary.late}</p>
                  <p className="text-xs text-orange-700">Late</p>
                </div>
              </div>

              {/* Attendance Table */}
              {attendanceLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>In</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead>Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.length > 0 ? (
                        attendance.slice(0, 31).map((record, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{record.date}</TableCell>
                            <TableCell>{new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short' })}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(record.status)}>
                                {record.status}
                                {record.is_late && <span className="ml-1">(L)</span>}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.first_in || record.check_in_time || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{record.last_out || record.check_out_time || '-'}</TableCell>
                            <TableCell>{record.total_hours ? `${record.total_hours}h` : '-'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                            No attendance records for this month
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

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Assigned Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assets ? (
                <div className="space-y-6">
                  {/* Individual Assigned Assets from assets collection */}
                  {assets.assigned_items && assets.assigned_items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-600 mb-3">Assigned Items</h4>
                      <div className="space-y-2">
                        {assets.assigned_items.map((asset) => (
                          <div key={asset.asset_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              {asset.asset_type === 'laptop' ? <Laptop className="w-5 h-5 text-blue-500" /> :
                               asset.asset_type === 'mobile' ? <Smartphone className="w-5 h-5 text-green-500" /> :
                               asset.asset_type === 'printer' ? <Printer className="w-5 h-5 text-orange-500" /> :
                               <Package className="w-5 h-5 text-slate-500" />}
                              <div>
                                <p className="font-medium text-sm">{asset.description || asset.asset_type || 'Asset'}</p>
                                <p className="text-xs text-slate-500">Tag: {asset.asset_tag || 'N/A'}</p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-700">Assigned</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Overview - derives status from BOTH old boolean format AND assigned_items */}
                  {(() => {
                    // Check assigned_items for each type
                    const assignedTypes = (assets.assigned_items || []).map(a => a.asset_type?.toLowerCase());
                    const hasMobile = assets.mobile_charger || assignedTypes.includes('mobile');
                    const hasLaptop = assets.laptop || assignedTypes.includes('laptop');
                    const hasSystem = assets.system || assignedTypes.includes('system') || assignedTypes.includes('desktop');
                    const hasPrinter = assets.printer || assignedTypes.includes('printer');
                    
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Quick Overview</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 border rounded-lg text-center">
                            <Smartphone className={`w-8 h-8 mx-auto mb-2 ${hasMobile ? 'text-green-500' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium">Mobile & Charger</p>
                            <Badge className={hasMobile ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                              {hasMobile ? 'Assigned' : 'Not Assigned'}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg text-center">
                            <Laptop className={`w-8 h-8 mx-auto mb-2 ${hasLaptop ? 'text-blue-500' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium">Laptop</p>
                            <Badge className={hasLaptop ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                              {hasLaptop ? 'Assigned' : 'Not Assigned'}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg text-center">
                            <Package className={`w-8 h-8 mx-auto mb-2 ${hasSystem ? 'text-purple-500' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium">System</p>
                            <Badge className={hasSystem ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                              {hasSystem ? 'Assigned' : 'Not Assigned'}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg text-center">
                            <Printer className={`w-8 h-8 mx-auto mb-2 ${hasPrinter ? 'text-orange-500' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium">Printer</p>
                            <Badge className={hasPrinter ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                              {hasPrinter ? 'Assigned' : 'Not Assigned'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Additional Details */}
                  {(assets.sdpl_number || assets.tag || assets.sim_mobile_no) && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {assets.sdpl_number && (
                        <div className="p-4 border rounded-lg">
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
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No assets assigned to this employee</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Personal Info */}
            <div>
              <h4 className="font-medium mb-3 text-slate-700">Personal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={editForm.first_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={editForm.last_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editForm.date_of_birth || ''}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={editForm.gender || ''} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h4 className="font-medium mb-3 text-slate-700">Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={editForm.state || ''}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={editForm.pincode || ''}
                    onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Employment */}
            <div>
              <h4 className="font-medium mb-3 text-slate-700">Employment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={editForm.department_id || ''} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.department_id} value={dept.department_id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={editForm.designation_id || ''} onValueChange={(v) => setEditForm({ ...editForm, designation_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map((desig) => (
                        <SelectItem key={desig.designation_id} value={desig.designation_id}>
                          {desig.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h4 className="font-medium mb-3 text-slate-700">Emergency Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={editForm.emergency_contact_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={editForm.emergency_contact_phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEmployee} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeProfile;
