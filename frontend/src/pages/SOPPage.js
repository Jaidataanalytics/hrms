import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  FileSpreadsheet, Plus, RefreshCw, Download, Eye, Upload, Building2,
  Briefcase, CheckCircle, Edit, Trash2, Send, FileText, X, User, Users
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const SOPPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sops, setSOPs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState(null);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [form, setForm] = useState({
    title: '',
    description: '',
    departments: [],
    designations: [],
    main_responsible: [],
    also_involved: [],
    file: null
  });
  const [employees, setEmployees] = useState([]);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  useEffect(() => {
    fetchSOPs();
    fetchDepartments();
    fetchDesignations();
    fetchEmployees();
  }, [filterDepartment, filterStatus]);

  const fetchSOPs = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/sop/list?`;
      if (filterDepartment && filterDepartment !== 'all') url += `department_id=${filterDepartment}&`;
      if (filterStatus && filterStatus !== 'all') url += `status=${filterStatus}`;
      
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setSOPs(await response.json());
    } catch (error) {
      console.error('Error fetching SOPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_URL}/departments`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setDepartments(await response.json());
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchDesignations = async () => {
    try {
      const response = await fetch(`${API_URL}/designations`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setDesignations(await response.json());
    } catch (error) {
      console.error('Error fetching designations:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/employees`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreateSOP = async () => {
    if (!form.title) {
      toast.error('Please enter a title');
      return;
    }

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    form.departments.forEach(d => formData.append('departments', d));
    form.designations.forEach(d => formData.append('designations', d));
    form.main_responsible.forEach(e => formData.append('main_responsible', e));
    form.also_involved.forEach(e => formData.append('also_involved', e));
    if (form.file) formData.append('file', form.file);

    try {
      const response = await fetch(`${API_URL}/sop/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('SOP created successfully');
        setShowCreateDialog(false);
        setForm({ title: '', description: '', departments: [], designations: [], main_responsible: [], also_involved: [], file: null });
        fetchSOPs();
      } else {
        toast.error('Failed to create SOP');
      }
    } catch (error) {
      toast.error('Failed to create SOP');
    }
  };

  const handlePublish = async (sopId) => {
    try {
      const response = await fetch(`${API_URL}/sop/${sopId}/publish`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('SOP published');
        fetchSOPs();
      } else {
        toast.error('Failed to publish SOP');
      }
    } catch (error) {
      toast.error('Failed to publish SOP');
    }
  };

  const handleDelete = async (sopId) => {
    if (!window.confirm('Are you sure you want to delete this SOP?')) return;

    try {
      const response = await fetch(`${API_URL}/sop/${sopId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('SOP deleted');
        fetchSOPs();
      } else {
        toast.error('Failed to delete SOP');
      }
    } catch (error) {
      toast.error('Failed to delete SOP');
    }
  };

  const handleViewSOP = async (sop) => {
    try {
      const response = await fetch(`${API_URL}/sop/${sop.sop_id}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedSOP(data);
        setShowPreviewDialog(true);
      }
    } catch (error) {
      toast.error('Failed to load SOP details');
    }
  };

  const handleDownload = (sopId) => {
    window.open(`${API_URL}/sop/${sopId}/download`, '_blank');
  };

  const toggleDepartment = (deptId) => {
    setForm(prev => ({
      ...prev,
      departments: prev.departments.includes(deptId)
        ? prev.departments.filter(d => d !== deptId)
        : [...prev.departments, deptId]
    }));
  };

  const toggleDesignation = (desigId) => {
    setForm(prev => ({
      ...prev,
      designations: prev.designations.includes(desigId)
        ? prev.designations.filter(d => d !== desigId)
        : [...prev.designations, desigId]
    }));
  };

  const toggleMainResponsible = (empId) => {
    setForm(prev => {
      if (prev.main_responsible.includes(empId)) {
        return { ...prev, main_responsible: prev.main_responsible.filter(e => e !== empId) };
      } else if (prev.main_responsible.length < 3) {
        return { ...prev, main_responsible: [...prev.main_responsible, empId] };
      } else {
        toast.error('Maximum 3 main responsible employees allowed');
        return prev;
      }
    });
  };

  const toggleAlsoInvolved = (empId) => {
    setForm(prev => ({
      ...prev,
      also_involved: prev.also_involved.includes(empId)
        ? prev.also_involved.filter(e => e !== empId)
        : [...prev.also_involved, empId]
    }));
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.employee_id === empId);
    return emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.emp_code : empId;
  };

  const statusColors = {
    draft: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-slate-100 text-slate-600'
  };

  return (
    <div className="space-y-6 p-6" data-testid="sop-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Standard Operating Procedures</h1>
          <p className="text-slate-600 mt-1">Manage and distribute SOPs by department and designation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSOPs}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          {isHR && (
            <Button onClick={() => setShowCreateDialog(true)} data-testid="create-sop-btn">
              <Plus className="w-4 h-4 mr-1" />
              Create SOP
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-[200px]">
              <Label className="text-xs text-slate-500">Filter by Department</Label>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <Label className="text-xs text-slate-500">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SOP List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            SOPs ({sops.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sops.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>SOP ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Main Responsible</TableHead>
                  <TableHead>Also Involved</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sops.map((sop) => (
                  <TableRow key={sop.sop_id} data-testid={`sop-row-${sop.sop_id}`}>
                    <TableCell className="font-mono text-sm">{sop.sop_id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{sop.title}</p>
                        {sop.description && (
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{sop.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sop.main_responsible_names?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sop.main_responsible_names.map((name, i) => (
                            <Badge key={i} className="bg-blue-100 text-blue-700 text-xs">{name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(sop.also_involved_names?.length > 0 || sop.designation_names?.length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {sop.also_involved_names?.slice(0, 2).map((name, i) => (
                            <Badge key={`emp-${i}`} variant="outline" className="text-xs">{name}</Badge>
                          ))}
                          {sop.designation_names?.slice(0, 2).map((name, i) => (
                            <Badge key={`desig-${i}`} variant="outline" className="text-xs bg-purple-50">{name}</Badge>
                          ))}
                          {((sop.also_involved_names?.length || 0) + (sop.designation_names?.length || 0)) > 4 && (
                            <Badge variant="outline" className="text-xs">+more</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">All</span>
                      )}
                    </TableCell>
                    <TableCell>v{sop.version}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[sop.status]}>{sop.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleViewSOP(sop)} title="View">
                          <Eye className="w-3 h-3" />
                        </Button>
                        {sop.file_name && (
                          <Button size="sm" variant="outline" onClick={() => handleDownload(sop.sop_id)} title="Download">
                            <Download className="w-3 h-3" />
                          </Button>
                        )}
                        {isHR && sop.status === 'draft' && (
                          <Button size="sm" onClick={() => handlePublish(sop.sop_id)} className="bg-emerald-600 hover:bg-emerald-700" title="Publish">
                            <Send className="w-3 h-3" />
                          </Button>
                        )}
                        {isHR && (
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(sop.sop_id)} title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No SOPs found</p>
              {isHR && (
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  Create First SOP
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create SOP Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New SOP</DialogTitle>
            <DialogDescription>Upload an Excel file with SOP steps and assign to departments/designations</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Machine Safety Protocol"
                data-testid="sop-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this SOP..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Excel File (with steps)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })}
                data-testid="sop-file-input"
              />
              <p className="text-xs text-slate-500">Upload an Excel file containing the SOP steps</p>
            </div>

            {/* Main Responsible - up to 3 employees */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-blue-700">
                <User className="w-4 h-4" />
                Main Responsible (max 3)
              </Label>
              <p className="text-xs text-slate-500 mb-2">Primary employee(s) responsible for this SOP</p>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border border-blue-200 rounded-lg bg-blue-50/50">
                {employees.filter(e => e.is_active !== false).map(emp => (
                  <Badge
                    key={emp.employee_id}
                    variant={form.main_responsible.includes(emp.employee_id) ? "default" : "outline"}
                    className={`cursor-pointer ${form.main_responsible.includes(emp.employee_id) ? 'bg-blue-600' : ''}`}
                    onClick={() => toggleMainResponsible(emp.employee_id)}
                  >
                    {emp.first_name} {emp.last_name}
                    {form.main_responsible.includes(emp.employee_id) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Also Involved - individual employees */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Also Involved (Individual Employees)
              </Label>
              <p className="text-xs text-slate-500 mb-2">Additional employees who follow this SOP</p>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-lg">
                {employees.filter(e => e.is_active !== false && !form.main_responsible.includes(e.employee_id)).map(emp => (
                  <Badge
                    key={emp.employee_id}
                    variant={form.also_involved.includes(emp.employee_id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAlsoInvolved(emp.employee_id)}
                  >
                    {emp.first_name} {emp.last_name}
                    {form.also_involved.includes(emp.employee_id) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Target Designations - auto-adds to Also Involved */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Target Designations (Auto-link to Also Involved)
              </Label>
              <p className="text-xs text-slate-500 mb-2">All employees with these designations will be auto-linked</p>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-lg">
                {designations.map(desig => (
                  <Badge
                    key={desig.designation_id}
                    variant={form.designations.includes(desig.designation_id) ? "default" : "outline"}
                    className={`cursor-pointer ${form.designations.includes(desig.designation_id) ? 'bg-purple-600' : ''}`}
                    onClick={() => toggleDesignation(desig.designation_id)}
                  >
                    {desig.name}
                    {form.designations.includes(desig.designation_id) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Target Departments - auto-adds to Also Involved */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Target Departments (Auto-link to Also Involved)
              </Label>
              <p className="text-xs text-slate-500 mb-2">All employees in these departments will be auto-linked</p>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-lg">
                {departments.map(dept => (
                  <Badge
                    key={dept.department_id}
                    variant={form.departments.includes(dept.department_id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDepartment(dept.department_id)}
                  >
                    {dept.name}
                    {form.departments.includes(dept.department_id) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSOP} data-testid="save-sop-btn">Create SOP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOP Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSOP?.title}</DialogTitle>
            <DialogDescription>
              {selectedSOP?.sop_id} • Version {selectedSOP?.version} • {selectedSOP?.status}
            </DialogDescription>
          </DialogHeader>
          {selectedSOP && (
            <div className="space-y-6 py-4">
              {selectedSOP.description && (
                <div>
                  <Label className="text-slate-500">Description</Label>
                  <p>{selectedSOP.description}</p>
                </div>
              )}

              {/* Main Responsible */}
              <div>
                <Label className="text-blue-600">Main Responsible</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedSOP.main_responsible_names?.length > 0 ? (
                    selectedSOP.main_responsible_names.map((name, i) => (
                      <Badge key={i} className="bg-blue-100 text-blue-700">{name}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">Not assigned</span>
                  )}
                </div>
              </div>

              {/* Also Involved */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Also Involved (Employees)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSOP.also_involved_names?.length > 0 ? (
                      selectedSOP.also_involved_names.map((name, i) => (
                        <Badge key={i} variant="outline">{name}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-500">Also Involved (via Designation)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSOP.designation_names?.length > 0 ? (
                      selectedSOP.designation_names.map((name, i) => (
                        <Badge key={i} variant="outline" className="bg-purple-50">{name}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">None</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Departments</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSOP.department_names?.length > 0 ? (
                      selectedSOP.department_names.map((name, i) => (
                        <Badge key={i} variant="outline">{name}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">All Departments</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-500">Designations</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSOP.designation_names?.length > 0 ? (
                      selectedSOP.designation_names.map((name, i) => (
                        <Badge key={i} variant="outline">{name}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">All Designations</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Excel Preview */}
              {selectedSOP.preview_data?.length > 0 && (
                <div>
                  <Label className="text-slate-500 mb-2 block">
                    SOP Content Preview ({selectedSOP.total_rows} rows × {selectedSOP.total_cols} columns)
                  </Label>
                  <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {selectedSOP.preview_data.map((row, rowIdx) => (
                          <tr key={rowIdx} className={rowIdx === 0 ? 'bg-slate-100 font-medium' : rowIdx % 2 === 0 ? 'bg-slate-50' : ''}>
                            {row.map((cell, colIdx) => (
                              <td key={colIdx} className="px-3 py-2 border-b border-r whitespace-nowrap">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedSOP.total_rows > 50 && (
                    <p className="text-xs text-slate-500 mt-2">Showing first 50 rows. Download the file to see all content.</p>
                  )}
                </div>
              )}
              
              {selectedSOP.file_name && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="font-medium">{selectedSOP.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {selectedSOP.file_size ? `${(selectedSOP.file_size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => handleDownload(selectedSOP.sop_id)}>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SOPPage;
