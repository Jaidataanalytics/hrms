import React, { useState, useEffect, useCallback } from 'react';
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
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  FileSpreadsheet, Plus, RefreshCw, Download, Eye, Upload, Building2,
  Briefcase, CheckCircle, Edit, Trash2, Send, FileText, X, User, Users,
  Search, Filter, FolderOpen, Tag, ChevronDown, Save, Loader2, ArrowRight,
  GitBranch, RotateCcw
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Process Flow Chart Component
const ProcessFlowChart = ({ steps }) => {
  if (!steps || steps.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <Label className="text-blue-700 font-semibold flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        Process Flow Chart
      </Label>
      <div className="relative">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-3 mb-4">
            {/* Step number circle */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
              {step.step_number || index + 1}
            </div>
            
            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div className="absolute left-4 ml-[-1px] w-0.5 bg-blue-200 h-full" style={{ top: `${(index * 100) + 32}px`, height: '60px' }} />
            )}
            
            {/* Step content */}
            <div className="flex-1 bg-gradient-to-r from-blue-50 to-white border border-blue-100 rounded-lg p-3 shadow-sm">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-slate-800">{step.step_name || `Step ${index + 1}`}</h4>
                {step.responsible && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    {step.responsible}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">{step.description}</p>
              {(step.input || step.output) && (
                <div className="flex gap-4 mt-2 text-xs">
                  {step.input && (
                    <span className="text-green-600"><strong>Input:</strong> {step.input}</span>
                  )}
                  {step.output && (
                    <span className="text-purple-600"><strong>Output:</strong> {step.output}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SOPPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sops, setSOPs] = useState([]);
  const [groupedSOPs, setGroupedSOPs] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reparsing, setReparsing] = useState(false);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState(null);
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOwner, setFilterOwner] = useState('all');
  const [groupBy, setGroupBy] = useState('none');

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    sop_number: '',
    task_type: '',
    departments: [],
    designations: [],
    main_responsible: [],
    also_involved: [],
    file: null
  });
  const [saving, setSaving] = useState(false);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  const fetchSOPs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/sop/list?`;
      if (filterDepartment && filterDepartment !== 'all') url += `department_id=${filterDepartment}&`;
      if (filterStatus && filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterOwner && filterOwner !== 'all') url += `owner_id=${filterOwner}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
      if (groupBy && groupBy !== 'none') url += `group_by=${groupBy}`;
      
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (data.grouped) {
          setGroupedSOPs(data.groups);
          setSOPs([]);
        } else {
          setSOPs(data);
          setGroupedSOPs(null);
        }
      }
    } catch (error) {
      console.error('Error fetching SOPs:', error);
    } finally {
      setLoading(false);
    }
  }, [filterDepartment, filterStatus, filterOwner, searchTerm, groupBy]);

  useEffect(() => {
    fetchSOPs();
  }, [fetchSOPs]);

  useEffect(() => {
    fetchDepartments();
    fetchDesignations();
    fetchEmployees();
  }, []);

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
    setSaving(true);
    const formData = new FormData();
    if (form.title) formData.append('title', form.title);
    if (form.description) formData.append('description', form.description);
    if (form.task_type) formData.append('task_type', form.task_type);
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
        const newSOP = await response.json();
        toast.success('SOP created successfully');
        if (newSOP.process_owner) {
          toast.info(`Auto-detected Process Owner: ${newSOP.process_owner}`);
        }
        setShowCreateDialog(false);
        resetForm();
        fetchSOPs();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to create SOP');
      }
    } catch (error) {
      toast.error('Failed to create SOP');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSOP = async () => {
    if (!selectedSOP) return;
    setSaving(true);
    
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description || '');
    formData.append('sop_number', form.sop_number || '');
    formData.append('task_type', form.task_type || '');
    formData.append('status', form.status || 'draft');
    form.departments.forEach(d => formData.append('departments', d));
    form.designations.forEach(d => formData.append('designations', d));
    form.main_responsible.forEach(e => formData.append('main_responsible', e));
    form.also_involved.forEach(e => formData.append('also_involved', e));
    if (form.file) formData.append('file', form.file);

    try {
      const response = await fetch(`${API_URL}/sop/${selectedSOP.sop_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('SOP updated successfully');
        setShowEditDialog(false);
        resetForm();
        fetchSOPs();
      } else {
        toast.error('Failed to update SOP');
      }
    } catch (error) {
      toast.error('Failed to update SOP');
    } finally {
      setSaving(false);
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
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('SOP deleted');
        fetchSOPs();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to delete SOP');
      }
    } catch (error) {
      toast.error('Failed to delete SOP');
    }
  };

  const handleReparse = async (sopId) => {
    setReparsing(true);
    try {
      const response = await fetch(`${API_URL}/sop/${sopId}/reparse`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedSOP(data);
        toast.success('SOP re-parsed with improved AI extraction');
      } else {
        toast.error('Failed to re-parse SOP');
      }
    } catch (error) {
      toast.error('Failed to re-parse SOP');
    } finally {
      setReparsing(false);
    }
  };

  const handleEditSOP = async (sop) => {
    // Fetch full SOP details
    try {
      const response = await fetch(`${API_URL}/sop/${sop.sop_id}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedSOP(data);
        setForm({
          title: data.title || '',
          description: data.description || '',
          sop_number: data.sop_number || '',
          task_type: data.task_type || '',
          status: data.status || 'draft',
          departments: data.departments || [],
          designations: data.designations || [],
          main_responsible: data.main_responsible || [],
          also_involved: data.also_involved || [],
          file: null
        });
        setShowEditDialog(true);
      }
    } catch (error) {
      toast.error('Failed to load SOP details');
    }
  };

  const handleDownload = (sopId) => {
    window.open(`${API_URL}/sop/${sopId}/download`, '_blank');
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      sop_number: '',
      task_type: '',
      departments: [],
      designations: [],
      main_responsible: [],
      also_involved: [],
      file: null
    });
    setSelectedSOP(null);
  };

  const toggleArrayItem = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
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

  const taskTypes = ['Audit', 'Quality', 'Safety', 'Production', 'Maintenance', 'HR', 'Finance', 'IT', 'Other'];

  // SOP Card for grouped view
  const SOPCard = ({ sop }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEditSOP(sop)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className={statusColors[sop.status]}>{sop.status}</Badge>
              {sop.sop_number && <span className="text-xs text-slate-500 font-mono">{sop.sop_number}</span>}
            </div>
            <h4 className="font-medium mt-2 truncate">{sop.title}</h4>
            {sop.task_type && <Badge variant="outline" className="mt-1 text-xs">{sop.task_type}</Badge>}
            <div className="mt-2 flex items-center gap-2">
              {sop.main_responsible_names?.length > 0 && (
                <span className="text-xs text-blue-600">
                  <User className="w-3 h-3 inline mr-1" />
                  {sop.main_responsible_names[0]}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {sop.file_name && (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDownload(sop.sop_id); }}>
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Form Component (reused for create and edit)
  const SOPForm = ({ isEdit = false }) => (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="SOP Title (auto-detected from file)"
            data-testid="sop-title-input"
          />
        </div>
        <div className="space-y-2">
          <Label>SOP Number</Label>
          <Input
            value={form.sop_number}
            onChange={(e) => setForm({ ...form, sop_number: e.target.value })}
            placeholder="e.g., SDPL/SOP/8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Task Type / Category</Label>
          <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select task type" />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isEdit && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Brief description..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Excel File</Label>
        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })}
          data-testid="sop-file-input"
        />
        <p className="text-xs text-slate-500">
          Upload SOP template - Process Owner and title will be auto-detected
        </p>
      </div>

      {/* Department Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Departments
        </Label>
        <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-2 border rounded-lg">
          {departments.map(dept => (
            <Badge
              key={dept.department_id}
              variant={form.departments.includes(dept.department_id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleArrayItem('departments', dept.department_id)}
            >
              {dept.name}
              {form.departments.includes(dept.department_id) && <X className="w-3 h-3 ml-1" />}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main Responsible */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-blue-700">
          <User className="w-4 h-4" />
          Main Responsible / SOP Owner
        </Label>
        <p className="text-xs text-slate-500">Auto-matched from "Process Owner" in Excel</p>
        <ScrollArea className="h-[100px] border rounded-lg p-2">
          <div className="flex flex-wrap gap-2">
            {employees.filter(e => e.is_active !== false).slice(0, 100).map(emp => (
              <Badge
                key={emp.employee_id}
                variant={form.main_responsible.includes(emp.employee_id) ? "default" : "outline"}
                className={`cursor-pointer ${form.main_responsible.includes(emp.employee_id) ? 'bg-blue-600' : ''}`}
                onClick={() => toggleArrayItem('main_responsible', emp.employee_id)}
              >
                {emp.first_name} {emp.last_name}
                {form.main_responsible.includes(emp.employee_id) && <X className="w-3 h-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Also Involved */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Also Involved (Employees)
        </Label>
        <ScrollArea className="h-[100px] border rounded-lg p-2">
          <div className="flex flex-wrap gap-2">
            {employees.filter(e => e.is_active !== false && !form.main_responsible.includes(e.employee_id)).slice(0, 100).map(emp => (
              <Badge
                key={emp.employee_id}
                variant={form.also_involved.includes(emp.employee_id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleArrayItem('also_involved', emp.employee_id)}
              >
                {emp.first_name} {emp.last_name}
                {form.also_involved.includes(emp.employee_id) && <X className="w-3 h-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Target Designations */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Target Designations
        </Label>
        <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-2 border rounded-lg">
          {designations.map(desig => (
            <Badge
              key={desig.designation_id}
              variant={form.designations.includes(desig.designation_id) ? "default" : "outline"}
              className={`cursor-pointer ${form.designations.includes(desig.designation_id) ? 'bg-purple-600' : ''}`}
              onClick={() => toggleArrayItem('designations', desig.designation_id)}
            >
              {desig.name}
              {form.designations.includes(desig.designation_id) && <X className="w-3 h-3 ml-1" />}
            </Badge>
          ))}
        </div>
      </div>

      {/* Preview data for edit mode */}
      {isEdit && selectedSOP?.preview_data?.length > 0 && (
        <div className="space-y-2">
          <Label>File Preview</Label>
          <div className="border rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {selectedSOP.preview_data.slice(0, 20).map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx === 0 ? 'bg-slate-100 font-medium' : rowIdx % 2 === 0 ? 'bg-slate-50' : ''}>
                    {row.slice(0, 10).map((cell, colIdx) => (
                      <td key={colIdx} className="px-2 py-1 border-b border-r whitespace-nowrap max-w-[150px] truncate">
                        {cell || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Extracted Data Display */}
      {isEdit && selectedSOP && (
        <div className="space-y-4 border rounded-lg p-4 bg-blue-50/50">
          <Label className="text-blue-700 font-semibold">AI Extracted Information</Label>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {selectedSOP.process_owner && (
              <div>
                <span className="text-slate-500">Process Owner:</span>
                <p className="font-medium">{selectedSOP.process_owner}</p>
              </div>
            )}
            {selectedSOP.document_created_by && (
              <div>
                <span className="text-slate-500">Document Created By:</span>
                <p className="font-medium">{selectedSOP.document_created_by}</p>
              </div>
            )}
            {selectedSOP.parsed_department && (
              <div>
                <span className="text-slate-500">Detected Department:</span>
                <p className="font-medium">{selectedSOP.parsed_department}</p>
              </div>
            )}
            {selectedSOP.document_version && (
              <div>
                <span className="text-slate-500">Document Version:</span>
                <p className="font-medium">{selectedSOP.document_version}</p>
              </div>
            )}
          </div>

          {selectedSOP.purpose && (
            <div>
              <span className="text-slate-500 text-sm">Purpose:</span>
              <p className="text-sm bg-white p-2 rounded border mt-1">{selectedSOP.purpose}</p>
            </div>
          )}

          {selectedSOP.scope && (
            <div>
              <span className="text-slate-500 text-sm">Scope:</span>
              <p className="text-sm bg-white p-2 rounded border mt-1">{selectedSOP.scope}</p>
            </div>
          )}

          {selectedSOP.procedure_summary && (
            <div>
              <span className="text-slate-500 text-sm">Procedure Summary:</span>
              <p className="text-sm bg-white p-2 rounded border mt-1">{selectedSOP.procedure_summary}</p>
            </div>
          )}

          {selectedSOP.input_requirements && (
            <div>
              <span className="text-slate-500 text-sm">Input Requirements:</span>
              <p className="text-sm bg-white p-2 rounded border mt-1">{selectedSOP.input_requirements}</p>
            </div>
          )}

          {selectedSOP.output_deliverables && (
            <div>
              <span className="text-slate-500 text-sm">Output/Deliverables:</span>
              <p className="text-sm bg-white p-2 rounded border mt-1">{selectedSOP.output_deliverables}</p>
            </div>
          )}

          {selectedSOP.responsible_persons?.length > 0 && (
            <div>
              <span className="text-slate-500 text-sm">Responsible Persons/Roles:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedSOP.responsible_persons.map((person, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{person}</Badge>
                ))}
              </div>
            </div>
          )}

          {selectedSOP.stakeholders?.length > 0 && (
            <div>
              <span className="text-slate-500 text-sm">Stakeholders:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedSOP.stakeholders.map((s, i) => (
                  <Badge key={i} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {selectedSOP.key_activities?.length > 0 && (
            <div>
              <span className="text-slate-500 text-sm">Key Activities:</span>
              <ul className="text-sm list-disc list-inside mt-1 bg-white p-2 rounded border">
                {selectedSOP.key_activities.slice(0, 10).map((activity, i) => (
                  <li key={i}>{activity}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedSOP.reports?.length > 0 && (
            <div>
              <span className="text-slate-500 text-sm">Reports:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedSOP.reports.map((report, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{report}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Process Flow Chart */}
      {isEdit && selectedSOP?.process_flow_steps?.length > 0 && (
        <div className="border rounded-lg p-4 bg-gradient-to-br from-slate-50 to-white">
          <ProcessFlowChart steps={selectedSOP.process_flow_steps} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="sop-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Standard Operating Procedures</h1>
          <p className="text-slate-600 mt-1">Manage, search, and track SOPs by department, task, and owner</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSOPs}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          {isHR && (
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="create-sop-btn">
              <Plus className="w-4 h-4 mr-1" />
              Upload SOP
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by title, SOP number, owner, content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="sop-search-input"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-4">
              <div className="w-[180px]">
                <Label className="text-xs text-slate-500">Department</Label>
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
              <div className="w-[150px]">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <Label className="text-xs text-slate-500">Owner</Label>
                <Select value={filterOwner} onValueChange={setFilterOwner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {employees.filter(e => e.is_active !== false).slice(0, 50).map(emp => (
                      <SelectItem key={emp.employee_id} value={emp.employee_id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs text-slate-500">Group By</Label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="task_type">Task Type</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SOP List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            SOPs ({groupedSOPs ? Object.values(groupedSOPs).flat().length : sops.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : groupedSOPs ? (
            // Grouped View
            <div className="space-y-6">
              {Object.entries(groupedSOPs).map(([groupName, groupSOPs]) => (
                <div key={groupName}>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen className="w-4 h-4 text-slate-500" />
                    <h3 className="font-semibold text-slate-700">{groupName}</h3>
                    <Badge variant="outline">{groupSOPs.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
                    {groupSOPs.map(sop => (
                      <SOPCard key={sop.sop_id} sop={sop} />
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}
            </div>
          ) : sops.length > 0 ? (
            // Table View
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[120px]">SOP Number</TableHead>
                    <TableHead className="min-w-[180px]">Title</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Stakeholders</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sops.map((sop) => (
                    <TableRow 
                      key={sop.sop_id} 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => handleEditSOP(sop)}
                      data-testid={`sop-row-${sop.sop_id}`}
                    >
                      <TableCell className="font-mono text-xs">{sop.sop_number || sop.sop_id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{sop.title}</p>
                          {sop.task_type && (
                            <Badge variant="outline" className="text-xs mt-1">{sop.task_type}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sop.process_owner ? (
                          <Badge className="bg-blue-100 text-blue-700 text-xs max-w-[150px] truncate">
                            {sop.process_owner.split(' ').slice(0, 2).join(' ')}
                          </Badge>
                        ) : sop.main_responsible_names?.length > 0 ? (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            {sop.main_responsible_names[0]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sop.responsible_persons?.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {sop.responsible_persons.slice(0, 2).map((person, i) => (
                              <Badge key={i} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                {person.length > 15 ? person.slice(0, 15) + '...' : person}
                              </Badge>
                            ))}
                            {sop.responsible_persons.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{sop.responsible_persons.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sop.stakeholders?.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {sop.stakeholders.slice(0, 2).map((s, i) => (
                              <Badge key={i} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                {s.length > 12 ? s.slice(0, 12) + '...' : s}
                              </Badge>
                            ))}
                            {sop.stakeholders.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{sop.stakeholders.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[sop.status]}>{sop.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleEditSOP(sop)} title="Edit">
                          <Edit className="w-3 h-3" />
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
                  Upload First SOP
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
            <DialogTitle>Upload New SOP</DialogTitle>
            <DialogDescription>
              Upload an Excel SOP file. Process Owner and title will be auto-detected from the template.
            </DialogDescription>
          </DialogHeader>
          <SOPForm isEdit={false} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSOP} disabled={saving} data-testid="save-sop-btn">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload SOP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit SOP Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit SOP</DialogTitle>
            <DialogDescription>
              {selectedSOP?.sop_id} • Version {selectedSOP?.version}
            </DialogDescription>
          </DialogHeader>
          <SOPForm isEdit={true} />
          <DialogFooter className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex gap-2">
              {selectedSOP?.file_name && (
                <>
                  <Button variant="outline" onClick={() => handleDownload(selectedSOP.sop_id)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleReparse(selectedSOP.sop_id)}
                    disabled={reparsing}
                    title="Re-extract data with improved AI"
                  >
                    {reparsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                    Re-parse AI
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdateSOP} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SOPPage;
