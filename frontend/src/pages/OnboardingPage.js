import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Checkbox } from '../components/ui/checkbox';
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
import { toast } from 'sonner';
import {
  UserPlus,
  LogOut,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  FileText,
  Plus,
  Upload,
  Laptop,
  GraduationCap,
  Users,
  Target,
  Award,
  ChevronRight,
  ChevronLeft,
  Eye,
  Edit,
  Trash2,
  Search,
  Building2,
  Calendar,
  User,
  Mail,
  Phone,
  CreditCard,
  Shield,
  BookOpen,
  MessageSquare,
  CheckSquare,
  X
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Onboarding stages configuration
const ONBOARDING_STAGES = [
  { 
    id: 'pre_joining', 
    name: 'Pre-Joining', 
    icon: FileText,
    description: 'Document collection and offer acceptance',
    tasks: ['id_proof', 'pan_card', 'bank_details', 'address_proof', 'education_certs', 'offer_acceptance']
  },
  { 
    id: 'day_1', 
    name: 'Day 1 Setup', 
    icon: Laptop,
    description: 'IT setup and workspace allocation',
    tasks: ['id_card', 'laptop_assignment', 'email_setup', 'system_access', 'workstation']
  },
  { 
    id: 'week_1', 
    name: 'Week 1 Training', 
    icon: GraduationCap,
    description: 'Mandatory trainings and introductions',
    tasks: ['company_orientation', 'hr_policies', 'safety_training', 'department_intro', 'buddy_meeting']
  },
  { 
    id: 'month_1', 
    name: 'Month 1 Review', 
    icon: Target,
    description: 'Initial feedback and goal setting',
    tasks: ['mentor_checkin', 'initial_feedback', 'goal_setting', 'role_clarity']
  },
  { 
    id: 'probation', 
    name: 'Probation Complete', 
    icon: Award,
    description: 'Performance evaluation and confirmation',
    tasks: ['performance_review', 'confirmation_decision', 'final_feedback']
  }
];

// Task templates for each category
const TASK_TEMPLATES = {
  id_proof: { title: 'Submit ID Proof', description: 'Upload Aadhaar/Passport/Voter ID', category: 'documents', required: true },
  pan_card: { title: 'Submit PAN Card', description: 'Upload PAN card copy', category: 'documents', required: true },
  bank_details: { title: 'Submit Bank Details', description: 'Provide bank account details for salary', category: 'documents', required: true },
  address_proof: { title: 'Submit Address Proof', description: 'Upload utility bill/rent agreement', category: 'documents', required: true },
  education_certs: { title: 'Submit Education Certificates', description: 'Upload degree/diploma certificates', category: 'documents', required: true },
  offer_acceptance: { title: 'Accept Offer Letter', description: 'Sign and accept the offer letter', category: 'documents', required: true },
  id_card: { title: 'ID Card Generation', description: 'Employee ID card creation', category: 'it_setup', assigned_to_hr: true },
  laptop_assignment: { title: 'Laptop Assignment', description: 'Assign laptop and accessories', category: 'it_setup', assigned_to_hr: true },
  email_setup: { title: 'Email Account Setup', description: 'Create corporate email account', category: 'it_setup', assigned_to_hr: true },
  system_access: { title: 'System Access', description: 'Grant access to required systems', category: 'it_setup', assigned_to_hr: true },
  workstation: { title: 'Workstation Setup', description: 'Allocate desk and workspace', category: 'it_setup', assigned_to_hr: true },
  company_orientation: { title: 'Company Orientation', description: 'Attend company overview session', category: 'training', required: true },
  hr_policies: { title: 'HR Policies Training', description: 'Complete HR policies acknowledgment', category: 'training', required: true },
  safety_training: { title: 'Safety Training', description: 'Complete workplace safety training', category: 'training', required: true },
  department_intro: { title: 'Department Introduction', description: 'Meet team members', category: 'introduction', required: true },
  buddy_meeting: { title: 'Buddy/Mentor Meeting', description: 'Initial meeting with assigned mentor', category: 'introduction', required: true },
  mentor_checkin: { title: 'Mentor Check-in', description: '30-day mentor review', category: 'review', required: true },
  initial_feedback: { title: 'Initial Feedback', description: 'Provide initial experience feedback', category: 'review', required: true },
  goal_setting: { title: 'Goal Setting', description: 'Set initial performance goals', category: 'review', required: true },
  role_clarity: { title: 'Role Clarity Session', description: 'Clarify job responsibilities', category: 'review', required: true },
  performance_review: { title: 'Probation Review', description: 'Complete probation performance review', category: 'evaluation', assigned_to_hr: true },
  confirmation_decision: { title: 'Confirmation Decision', description: 'Confirmation/extension decision', category: 'evaluation', assigned_to_hr: true },
  final_feedback: { title: 'Final Feedback', description: 'Probation period feedback', category: 'evaluation', required: true }
};

const OnboardingPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [onboardingRecords, setOnboardingRecords] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showNewOnboardingDialog, setShowNewOnboardingDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [exitRequests, setExitRequests] = useState([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const [newOnboardingForm, setNewOnboardingForm] = useState({
    employee_id: '',
    joining_date: '',
    mentor_id: '',
    department_id: '',
    designation_id: ''
  });

  const [exitForm, setExitForm] = useState({
    requested_last_day: '',
    reason: '',
    reason_category: 'personal'
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [empRes, deptRes, desigRes, onbRes, exitRes] = await Promise.all([
        fetch(`${API_URL}/employees`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/departments`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/designations`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/onboarding/records`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/onboarding/exit-requests`, { credentials: 'include', headers: authHeaders })
      ]);

      if (empRes.ok) setEmployees(await empRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (desigRes.ok) setDesignations(await desigRes.json());
      if (onbRes.ok) setOnboardingRecords(await onbRes.json());
      if (exitRes.ok) setExitRequests(await exitRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    if (!newOnboardingForm.employee_id || !newOnboardingForm.joining_date) {
      toast.error('Please select employee and joining date');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/onboarding/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(newOnboardingForm)
      });

      if (response.ok) {
        toast.success('Onboarding started successfully');
        setShowNewOnboardingDialog(false);
        setNewOnboardingForm({ employee_id: '', joining_date: '', mentor_id: '', department_id: '', designation_id: '' });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to start onboarding');
      }
    } catch (error) {
      toast.error('Failed to start onboarding');
    }
  };

  const handleUpdateTaskStatus = async (recordId, taskId, completed) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/onboarding/records/${recordId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({ completed, completed_at: completed ? new Date().toISOString() : null })
      });

      if (response.ok) {
        toast.success(completed ? 'Task completed' : 'Task marked incomplete');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleAdvanceStage = async (recordId, newStage) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/onboarding/records/${recordId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({ stage: newStage })
      });

      if (response.ok) {
        toast.success(`Advanced to ${ONBOARDING_STAGES.find(s => s.id === newStage)?.name}`);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to advance stage');
    }
  };

  const handleSubmitExitRequest = async () => {
    if (!exitForm.requested_last_day || !exitForm.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/onboarding/exit-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(exitForm)
      });

      if (response.ok) {
        toast.success('Exit request submitted');
        setShowExitDialog(false);
        setExitForm({ requested_last_day: '', reason: '', reason_category: 'personal' });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to submit');
      }
    } catch (error) {
      toast.error('Failed to submit exit request');
    }
  };

  const getStageProgress = (record) => {
    const stageIndex = ONBOARDING_STAGES.findIndex(s => s.id === record.current_stage);
    return ((stageIndex + 1) / ONBOARDING_STAGES.length) * 100;
  };

  const getTaskCompletion = (record) => {
    if (!record.tasks || record.tasks.length === 0) return 0;
    const completed = record.tasks.filter(t => t.completed).length;
    return Math.round((completed / record.tasks.length) * 100);
  };

  const filteredRecords = onboardingRecords.filter(record => {
    const matchesSearch = !searchTerm || 
      record.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.emp_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || record.current_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.employee_id === empId);
    return emp ? `${emp.first_name} ${emp.last_name}` : empId;
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.department_id === deptId);
    return dept?.name || deptId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="onboarding-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Onboarding & Exit Management</h1>
          <p className="text-slate-600 mt-1">Manage employee onboarding journey and exit processes</p>
        </div>
        <div className="flex gap-2">
          {isHR && (
            <Button onClick={() => setShowNewOnboardingDialog(true)} data-testid="start-onboarding-btn">
              <UserPlus className="w-4 h-4 mr-2" />
              Start Onboarding
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowExitDialog(true)} data-testid="request-exit-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Request Exit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isHR && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{onboardingRecords.filter(r => r.status === 'active').length}</p>
                  <p className="text-xs text-slate-500">Active Onboarding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{onboardingRecords.filter(r => r.current_stage === 'pre_joining').length}</p>
                  <p className="text-xs text-slate-500">Pre-Joining</p>
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
                  <p className="text-2xl font-bold">{onboardingRecords.filter(r => r.status === 'completed').length}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{exitRequests.filter(r => r.status === 'pending').length}</p>
                  <p className="text-xs text-slate-500">Exit Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline" className="gap-2">
            <Users className="w-4 h-4" />
            Pipeline
          </TabsTrigger>
          {isHR && (
            <TabsTrigger value="all-records" className="gap-2">
              <FileText className="w-4 h-4" />
              All Records
            </TabsTrigger>
          )}
          <TabsTrigger value="exit-requests" className="gap-2">
            <LogOut className="w-4 h-4" />
            Exit Requests
          </TabsTrigger>
        </TabsList>

        {/* Pipeline View */}
        <TabsContent value="pipeline">
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {ONBOARDING_STAGES.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Columns */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
              {ONBOARDING_STAGES.map((stage, stageIdx) => {
                const stageRecords = filteredRecords.filter(r => r.current_stage === stage.id && r.status === 'active');
                const StageIcon = stage.icon;
                
                return (
                  <div key={stage.id} className="min-w-[250px]">
                    <div className="bg-slate-100 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <StageIcon className="w-4 h-4 text-slate-600" />
                        <span className="font-semibold text-sm">{stage.name}</span>
                        <Badge variant="secondary" className="ml-auto">{stageRecords.length}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{stage.description}</p>
                    </div>
                    
                    <div className="space-y-3">
                      {stageRecords.map(record => (
                        <Card 
                          key={record.onboarding_id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedEmployee(record)}
                          data-testid={`onboarding-card-${record.onboarding_id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">{record.employee_name}</p>
                                <p className="text-xs text-slate-500">{record.emp_code}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {getTaskCompletion(record)}%
                              </Badge>
                            </div>
                            <Progress value={getTaskCompletion(record)} className="h-1.5 mb-2" />
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Joined: {record.joining_date}</span>
                              {stageIdx < ONBOARDING_STAGES.length - 1 && isHR && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdvanceStage(record.onboarding_id, ONBOARDING_STAGES[stageIdx + 1].id);
                                  }}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {stageRecords.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          No employees in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* All Records */}
        <TabsContent value="all-records">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map(record => (
                    <TableRow key={record.onboarding_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.employee_name}</p>
                          <p className="text-xs text-slate-500">{record.emp_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getDepartmentName(record.department_id)}</TableCell>
                      <TableCell>{record.joining_date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ONBOARDING_STAGES.find(s => s.id === record.current_stage)?.name || record.current_stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={getTaskCompletion(record)} className="w-20 h-2" />
                          <span className="text-xs text-slate-500">{getTaskCompletion(record)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          record.status === 'active' ? 'bg-blue-100 text-blue-700' :
                          record.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedEmployee(record)}>
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exit Requests */}
        <TabsContent value="exit-requests">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Last Working Day</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    {isHR && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exitRequests.length > 0 ? exitRequests.map(req => (
                    <TableRow key={req.exit_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{req.employee_name}</p>
                          <p className="text-xs text-slate-500">{req.emp_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>{req.created_at?.split('T')[0]}</TableCell>
                      <TableCell>{req.requested_last_day}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{req.reason_category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }>
                          {req.status}
                        </Badge>
                      </TableCell>
                      {isHR && (
                        <TableCell className="text-right">
                          {req.status === 'pending' && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="text-emerald-600">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600">
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={isHR ? 6 : 5} className="text-center py-8 text-slate-500">
                        No exit requests found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Detail Drawer/Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p>{selectedEmployee.employee_name}</p>
                    <p className="text-sm font-normal text-slate-500">{selectedEmployee.emp_code}</p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Onboarding progress and task management
                </DialogDescription>
              </DialogHeader>

              {/* Progress Timeline */}
              <div className="py-4">
                <div className="flex items-center justify-between mb-4">
                  {ONBOARDING_STAGES.map((stage, idx) => {
                    const currentIdx = ONBOARDING_STAGES.findIndex(s => s.id === selectedEmployee.current_stage);
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const StageIcon = stage.icon;
                    
                    return (
                      <div key={stage.id} className="flex flex-col items-center flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                          isCompleted ? 'bg-emerald-500 text-white' :
                          isCurrent ? 'bg-primary text-white' :
                          'bg-slate-200 text-slate-400'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StageIcon className="w-5 h-5" />}
                        </div>
                        <p className={`text-xs text-center ${isCurrent ? 'font-semibold text-primary' : 'text-slate-500'}`}>
                          {stage.name}
                        </p>
                        {idx < ONBOARDING_STAGES.length - 1 && (
                          <div className={`absolute h-0.5 w-full top-5 left-1/2 -z-10 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                          }`} style={{ width: 'calc(100% - 40px)', marginLeft: '20px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <Progress value={getStageProgress(selectedEmployee)} className="h-2" />
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Onboarding Tasks
                </h4>
                
                {selectedEmployee.tasks?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEmployee.tasks.map((task, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          task.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white'
                        }`}
                      >
                        <Checkbox 
                          checked={task.completed}
                          onCheckedChange={(checked) => handleUpdateTaskStatus(
                            selectedEmployee.onboarding_id, 
                            task.task_id, 
                            checked
                          )}
                          disabled={!isHR && task.assigned_to_hr}
                        />
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${task.completed ? 'line-through text-slate-400' : ''}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-slate-500">{task.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {task.category}
                        </Badge>
                        {task.completed && task.completed_at && (
                          <span className="text-xs text-emerald-600">
                            {new Date(task.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-4">
                    No tasks assigned yet
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedEmployee(null)}>
                  Close
                </Button>
                {isHR && selectedEmployee.status === 'active' && (
                  <Button onClick={() => {
                    const currentIdx = ONBOARDING_STAGES.findIndex(s => s.id === selectedEmployee.current_stage);
                    if (currentIdx < ONBOARDING_STAGES.length - 1) {
                      handleAdvanceStage(selectedEmployee.onboarding_id, ONBOARDING_STAGES[currentIdx + 1].id);
                    }
                  }}>
                    Advance to Next Stage
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Onboarding Dialog */}
      <Dialog open={showNewOnboardingDialog} onOpenChange={setShowNewOnboardingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Onboarding</DialogTitle>
            <DialogDescription>
              Begin the onboarding process for a new employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select 
                value={newOnboardingForm.employee_id} 
                onValueChange={(v) => setNewOnboardingForm({ ...newOnboardingForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => !onboardingRecords.some(r => r.employee_id === e.employee_id && r.status === 'active')).map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name} ({emp.emp_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Joining Date *</Label>
              <Input
                type="date"
                value={newOnboardingForm.joining_date}
                onChange={(e) => setNewOnboardingForm({ ...newOnboardingForm, joining_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mentor/Buddy (Optional)</Label>
              <Select 
                value={newOnboardingForm.mentor_id} 
                onValueChange={(v) => setNewOnboardingForm({ ...newOnboardingForm, mentor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mentor" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.employee_id !== newOnboardingForm.employee_id).map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewOnboardingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartOnboarding}>
              <UserPlus className="w-4 h-4 mr-2" />
              Start Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Request Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Exit</DialogTitle>
            <DialogDescription>
              Submit your resignation or exit request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Last Working Day *</Label>
              <Input
                type="date"
                value={exitForm.requested_last_day}
                onChange={(e) => setExitForm({ ...exitForm, requested_last_day: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason Category *</Label>
              <Select 
                value={exitForm.reason_category} 
                onValueChange={(v) => setExitForm({ ...exitForm, reason_category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Reasons</SelectItem>
                  <SelectItem value="better_opportunity">Better Opportunity</SelectItem>
                  <SelectItem value="relocation">Relocation</SelectItem>
                  <SelectItem value="health">Health Reasons</SelectItem>
                  <SelectItem value="higher_education">Higher Education</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason Details *</Label>
              <Textarea
                value={exitForm.reason}
                onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
                placeholder="Please provide details about your exit..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitExitRequest} variant="destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnboardingPage;
