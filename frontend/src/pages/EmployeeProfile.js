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
  Printer
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
      } else {
        toast.error('Employee not found');
      }

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (desigRes.ok) setDesignations(await desigRes.json());
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
      // Try with emp_code first (most common), then employee_id
      let response = await fetch(`${API_URL}/employee-assets/${empCode || employeeId}`, { 
        credentials: 'include', 
        headers: authHeaders 
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

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
        <TabsList className="bg-white border">
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">Attendance</TabsTrigger>
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
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No documents uploaded yet</p>
                <Button variant="outline" className="mt-4">Upload Document</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Attendance data will appear here</p>
                <Link to="/dashboard/attendance">
                  <Button variant="outline" className="mt-4">View Full Attendance</Button>
                </Link>
              </div>
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
