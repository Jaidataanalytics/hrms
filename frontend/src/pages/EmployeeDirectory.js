import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
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
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Filter,
  Download,
  Users,
  Building2,
  MapPin,
  Mail,
  Phone,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const EmployeeDirectory = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    employment_type: 'management'
  });

  const handleExport = () => {
    try {
      // Prepare CSV data
      const headers = ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Designation', 'Employment Type', 'Status', 'Join Date'];
      
      const csvData = filteredEmployees.map(emp => [
        emp.employee_code || emp.employee_id,
        emp.first_name || '',
        emp.last_name || '',
        emp.email || '',
        emp.phone || '',
        emp.department || '',
        emp.designation || '',
        emp.employment_type || '',
        emp.status || 'active',
        emp.join_date || ''
      ]);
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filteredEmployees.length} employees`);
    } catch (error) {
      toast.error('Failed to export employees');
    }
  };

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, [filterDepartment, filterStatus]);

  const fetchData = async () => {
    try {
      let url = `${API_URL}/employees?`;
      if (filterDepartment !== 'all') url += `department_id=${filterDepartment}&`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;

      const [empRes, deptRes] = await Promise.all([
        fetch(url, { credentials: 'include' }),
        fetch(`${API_URL}/departments`, { credentials: 'include' })
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData);
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    try {
      const response = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newEmployee)
      });

      if (response.ok) {
        toast.success('Employee added successfully');
        setShowAddDialog(false);
        setNewEmployee({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          department_id: '',
          employment_type: 'management'
        });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add employee');
      }
    } catch (error) {
      toast.error('Failed to add employee');
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.department_id === deptId);
    return dept?.name || 'Unassigned';
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const email = emp.email?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const statusColors = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    terminated: 'bg-red-50 text-red-700 border-red-200',
    resigned: 'bg-amber-50 text-amber-700 border-amber-200'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="employee-directory-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Employee Directory
          </h1>
          <p className="text-slate-600 mt-1">{employees.length} employees in the organization</p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="add-employee-btn">
                  <Plus className="w-4 h-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                  <DialogDescription>
                    Enter the basic details of the new employee
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={newEmployee.first_name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
                        placeholder="John"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={newEmployee.last_name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
                        placeholder="Doe"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      placeholder="john.doe@company.com"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={newEmployee.department_id}
                      onValueChange={(value) => setNewEmployee({ ...newEmployee, department_id: value })}
                    >
                      <SelectTrigger data-testid="select-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.department_id} value={dept.department_id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Employment Type</Label>
                    <Select
                      value={newEmployee.employment_type}
                      onValueChange={(value) => setNewEmployee({ ...newEmployee, employment_type: value })}
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="labour">Labour</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddEmployee} data-testid="submit-employee-btn">
                    Add Employee
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-employees"
              />
            </div>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-full sm:w-48" data-testid="filter-department">
                <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.department_id} value={dept.department_id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40" data-testid="filter-status">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[300px]">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.employee_id} className="hover:bg-slate-50/50" data-testid={`employee-row-${emp.employee_id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(emp.first_name, emp.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-900">
                            {emp.first_name} {emp.last_name}
                          </p>
                          <p className="text-sm text-slate-500">{emp.emp_code || emp.employee_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{getDepartmentName(emp.department_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {emp.employment_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[150px]">{emp.email}</span>
                        </div>
                        {emp.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{emp.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[emp.status] || statusColors.active}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/dashboard/employees/${emp.employee_id}`}>
                        <Button variant="ghost" size="sm" data-testid={`view-employee-${emp.employee_id}`}>
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-500">No employees found</p>
                      {isHR && (
                        <Button size="sm" onClick={() => setShowAddDialog(true)}>
                          Add First Employee
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDirectory;
