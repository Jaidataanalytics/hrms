import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
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
  RefreshCw
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const EmployeeProfile = () => {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

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
              <Button variant="outline" className="gap-2" data-testid="edit-employee-btn">
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
    </div>
  );
};

export default EmployeeProfile;
