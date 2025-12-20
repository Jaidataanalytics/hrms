import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Slider } from '../components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Target,
  Plus,
  TrendingUp,
  Award,
  Star,
  RefreshCw,
  CheckCircle2,
  Clock,
  BarChart3,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Edit,
  Save,
  X,
  Users,
  Eye,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PerformancePage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [myKpis, setMyKpis] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateKPI, setShowCreateKPI] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showUploadTemplate, setShowUploadTemplate] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', period_type: 'quarterly' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [kpiResponses, setKpiResponses] = useState([]);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '', priority: 'medium' });
  const [selectedPeriodType, setSelectedPeriodType] = useState('quarterly');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingKPI, setEditingKPI] = useState(null);
  const [kpiFormResponses, setKpiFormResponses] = useState({});
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeePerformance, setEmployeePerformance] = useState(null);
  const [loadingEmployeePerf, setLoadingEmployeePerf] = useState(false);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';
  const isManager = user?.role === 'manager';
  const canViewTeam = isHR || isManager;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const promises = [
        fetch(`${API_URL}/performance/templates`, { credentials: 'include' }),
        fetch(`${API_URL}/performance/my-kpi`, { credentials: 'include' }),
        fetch(`${API_URL}/performance/goals`, { credentials: 'include' })
      ];
      
      // Fetch team performance for HR/Managers
      if (canViewTeam) {
        promises.push(fetch(`${API_URL}/performance/team-performance`, { credentials: 'include' }));
      }

      const responses = await Promise.all(promises);
      const [templatesRes, kpisRes, goalsRes, teamRes] = responses;

      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (kpisRes.ok) setMyKpis(await kpisRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
      if (teamRes && teamRes.ok) setTeamPerformance(await teamRes.json());
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeePerformance = async (employeeId) => {
    setLoadingEmployeePerf(true);
    try {
      const response = await fetch(`${API_URL}/performance/employee-performance/${employeeId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEmployeePerformance(data);
        setSelectedEmployee(employeeId);
      } else {
        toast.error('Failed to fetch employee performance');
      }
    } catch (error) {
      toast.error('Failed to fetch employee performance');
    } finally {
      setLoadingEmployeePerf(false);
    }
  };

  const getPeriodDates = (periodType) => {
    const now = new Date();
    let periodStart, periodEnd;
    
    switch (periodType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = periodStart;
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - now.getDay());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 6);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);
        break;
      case 'half_yearly':
        periodStart = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 6, 0);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);
    }
    return { periodStart, periodEnd };
  };

  const handleCreateKPI = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a KPI template');
      return;
    }

    try {
      const { periodStart, periodEnd } = getPeriodDates(selectedPeriodType);

      const response = await fetch(`${API_URL}/performance/kpi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          template_id: selectedTemplate,
          period_type: selectedPeriodType,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          responses: kpiResponses
        })
      });

      if (response.ok) {
        toast.success('KPI created successfully');
        setShowCreateKPI(false);
        setSelectedTemplate(null);
        setKpiResponses([]);
        setSelectedPeriodType('quarterly');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create KPI');
      }
    } catch (error) {
      toast.error('Failed to create KPI');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const response = await fetch(`${API_URL}/performance/templates/${editingTemplate.template_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editingTemplate)
      });
      if (response.ok) {
        toast.success('Template updated');
        setEditingTemplate(null);
        fetchData();
      } else {
        toast.error('Failed to update template');
      }
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleEditKPI = async (kpi) => {
    // Fetch template questions if we have a template_id
    let questions = [];
    if (kpi.template_id) {
      try {
        const response = await fetch(`${API_URL}/performance/templates/${kpi.template_id}`, { credentials: 'include' });
        if (response.ok) {
          const template = await response.json();
          questions = template.questions || [];
        }
      } catch (error) {
        console.error('Error fetching template:', error);
      }
    }
    
    // Initialize responses from existing KPI responses or empty
    const existingResponses = kpi.responses || [];
    const initialResponses = {};
    questions.forEach((q, idx) => {
      const existingResponse = existingResponses.find(r => r.question_id === q.question_id);
      initialResponses[q.question_id] = existingResponse ? {
        score: existingResponse.score || 0,
        comments: existingResponse.comments || '',
        selected_option: existingResponse.selected_option || ''
      } : { score: 0, comments: '', selected_option: '' };
    });
    
    setEditingKPI({ ...kpi, questions });
    setKpiFormResponses(initialResponses);
  };

  const handleSaveKPIResponses = async () => {
    if (!editingKPI) return;
    
    // Build responses array
    const responses = editingKPI.questions.map(q => ({
      question_id: q.question_id,
      question: q.question,
      score: kpiFormResponses[q.question_id]?.score || 0,
      max_points: q.max_points,
      comments: kpiFormResponses[q.question_id]?.comments || '',
      selected_option: kpiFormResponses[q.question_id]?.selected_option || ''
    }));
    
    // Calculate total score
    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    const maxScore = responses.reduce((sum, r) => sum + r.max_points, 0);
    const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    
    try {
      const response = await fetch(`${API_URL}/performance/kpi/${editingKPI.kpi_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ responses, final_score: finalScore })
      });
      
      if (response.ok) {
        toast.success('KPI responses saved');
        setEditingKPI(null);
        setKpiFormResponses({});
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save responses');
      }
    } catch (error) {
      toast.error('Failed to save KPI responses');
    }
  };

  const handleSubmitKPI = async (kpiId) => {
    try {
      const response = await fetch(`${API_URL}/performance/kpi/${kpiId}/submit`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('KPI submitted for review');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to submit KPI');
      }
    } catch (error) {
      toast.error('Failed to submit KPI');
    }
  };

  const handleCreateGoal = async () => {
    if (!goalForm.title) {
      toast.error('Please enter a goal title');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/performance/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goalForm)
      });

      if (response.ok) {
        toast.success('Goal created');
        setShowCreateGoal(false);
        setGoalForm({ title: '', description: '', target_date: '', priority: 'medium' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create goal');
      }
    } catch (error) {
      toast.error('Failed to create goal');
    }
  };

  const handleUpdateGoalProgress = async (goalId, progress) => {
    try {
      await fetch(`${API_URL}/performance/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ progress, status: progress === 100 ? 'completed' : 'in_progress' })
      });
      fetchData();
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700'
  };

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="performance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Performance & KPI
          </h1>
          <p className="text-slate-600 mt-1">Track your performance and goals</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myKpis.length}</p>
                <p className="text-xs text-slate-500">KPI Records</p>
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
                <p className="text-2xl font-bold">{goals.filter(g => g.status === 'completed').length}</p>
                <p className="text-xs text-slate-500">Goals Completed</p>
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
                <p className="text-2xl font-bold">{goals.filter(g => g.status === 'in_progress').length}</p>
                <p className="text-xs text-slate-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {myKpis.length > 0 && myKpis[0].final_score ? myKpis[0].final_score.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-slate-500">Latest Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="kpi" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="kpi" data-testid="tab-kpi">My KPI</TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
          {isHR && <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>}
        </TabsList>

        {/* My KPI */}
        <TabsContent value="kpi">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    KPI Records
                  </CardTitle>
                  <CardDescription>Your performance assessments</CardDescription>
                </div>
                <Dialog open={showCreateKPI} onOpenChange={setShowCreateKPI}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="create-kpi-btn">
                      <Plus className="w-4 h-4" />
                      New KPI
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create KPI Record</DialogTitle>
                      <DialogDescription>Start a new KPI assessment</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>KPI Template</Label>
                        <Select value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.length > 0 ? templates.map(t => (
                              <SelectItem key={t.template_id} value={t.template_id}>
                                {t.name}
                              </SelectItem>
                            )) : (
                              <SelectItem value="none" disabled>No templates available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {templates.length === 0 && (
                          <p className="text-xs text-amber-600">Please create a KPI template first in the Templates tab</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Period Type</Label>
                        <Select value={selectedPeriodType} onValueChange={setSelectedPeriodType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="half_yearly">Half Yearly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Selected Period</p>
                        <p className="text-sm font-medium">
                          {(() => {
                            const { periodStart, periodEnd } = getPeriodDates(selectedPeriodType);
                            return `${periodStart.toLocaleDateString('en-IN')} - ${periodEnd.toLocaleDateString('en-IN')}`;
                          })()}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateKPI(false)}>Cancel</Button>
                      <Button onClick={handleCreateKPI}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {myKpis.length > 0 ? (
                <div className="space-y-3">
                  {myKpis.map((kpi) => (
                    <div
                      key={kpi.kpi_id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      data-testid={`kpi-${kpi.kpi_id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {kpi.period_type.charAt(0).toUpperCase() + kpi.period_type.slice(1)} Review
                          </p>
                          <p className="text-sm text-slate-500">
                            {kpi.period_start} to {kpi.period_end}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {kpi.final_score !== undefined && kpi.final_score !== null && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{kpi.final_score.toFixed(1)}%</p>
                            <p className="text-xs text-slate-500">Score</p>
                          </div>
                        )}
                        <Badge className={statusColors[kpi.status]}>
                          {kpi.status}
                        </Badge>
                        {kpi.status === 'draft' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEditKPI(kpi)} className="gap-1">
                              <Edit className="w-3 h-3" />
                              Fill
                            </Button>
                            <Button size="sm" onClick={() => handleSubmitKPI(kpi.kpi_id)}>
                              Submit
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No KPI records yet</p>
                  <Button onClick={() => setShowCreateKPI(true)}>Create First KPI</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals */}
        <TabsContent value="goals">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="w-5 h-5 text-primary" />
                    My Goals
                  </CardTitle>
                  <CardDescription>Track your objectives and progress</CardDescription>
                </div>
                <Dialog open={showCreateGoal} onOpenChange={setShowCreateGoal}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="create-goal-btn">
                      <Plus className="w-4 h-4" />
                      Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Goal</DialogTitle>
                      <DialogDescription>Set a new objective</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={goalForm.title}
                          onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                          placeholder="Goal title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={goalForm.description}
                          onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                          placeholder="Describe your goal..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Target Date</Label>
                          <Input
                            type="date"
                            value={goalForm.target_date}
                            onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select
                            value={goalForm.priority}
                            onValueChange={(v) => setGoalForm({ ...goalForm, priority: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateGoal(false)}>Cancel</Button>
                      <Button onClick={handleCreateGoal}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {goals.length > 0 ? (
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div
                      key={goal.goal_id}
                      className="p-4 bg-slate-50 rounded-lg"
                      data-testid={`goal-${goal.goal_id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-900">{goal.title}</p>
                            <Badge className={priorityColors[goal.priority]}>{goal.priority}</Badge>
                          </div>
                          {goal.description && (
                            <p className="text-sm text-slate-500">{goal.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={goal.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ''}>
                          {goal.status === 'completed' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completed
                            </>
                          ) : (
                            `${goal.progress}%`
                          )}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Progress value={goal.progress} className="h-2" />
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[goal.progress]}
                            onValueChange={([v]) => handleUpdateGoalProgress(goal.goal_id, v)}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          {goal.target_date && (
                            <span className="text-xs text-slate-500">
                              Due: {new Date(goal.target_date).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No goals set</p>
                  <Button onClick={() => setShowCreateGoal(true)}>Add First Goal</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates (HR only) */}
        {isHR && (
          <TabsContent value="templates">
            <div className="space-y-6">
              {/* Actions Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle className="text-lg">KPI Templates</CardTitle>
                      <CardDescription>Create and manage KPI templates for employee assessments</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={showUploadTemplate} onOpenChange={setShowUploadTemplate}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" />
                            Upload Excel Template
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Upload KPI Template</DialogTitle>
                            <DialogDescription>
                              Upload an Excel file with your custom KPI template
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                id="template-upload"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  
                                  setUploadingFile(true);
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  
                                  try {
                                    const response = await fetch(`${API_URL}/performance/templates/upload`, {
                                      method: 'POST',
                                      credentials: 'include',
                                      body: formData
                                    });
                                    
                                    if (response.ok) {
                                      toast.success('Template uploaded successfully');
                                      setShowUploadTemplate(false);
                                      fetchData();
                                    } else {
                                      const error = await response.json();
                                      toast.error(error.detail || 'Failed to upload template');
                                    }
                                  } catch (error) {
                                    toast.error('Failed to upload template');
                                  } finally {
                                    setUploadingFile(false);
                                  }
                                }}
                              />
                              <label htmlFor="template-upload" className="cursor-pointer">
                                <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm font-medium text-slate-700">Click to upload Excel file</p>
                                <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, or .csv</p>
                              </label>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-slate-700 mb-2">Template Format:</p>
                              <ul className="text-xs text-slate-500 space-y-1">
                                <li>• Column A: Question/KPI Name</li>
                                <li>• Column B: Description</li>
                                <li>• Column C: Max Points</li>
                                <li>• Column D: Category (optional)</li>
                              </ul>
                            </div>
                            <Button 
                              variant="outline" 
                              className="w-full gap-2"
                              onClick={() => {
                                // Download sample template
                                const link = document.createElement('a');
                                link.href = `${API_URL}/performance/templates/sample`;
                                link.download = 'kpi_template_sample.xlsx';
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4" />
                              Download Sample Template
                            </Button>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowUploadTemplate(false)}>
                              Cancel
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
                        <DialogTrigger asChild>
                          <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create Template
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Create KPI Template</DialogTitle>
                            <DialogDescription>Create a new KPI assessment template</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Template Name</Label>
                              <Input
                                value={templateForm.name}
                                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                                placeholder="Q1 Performance Review"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={templateForm.description}
                                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                                placeholder="Describe the template..."
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Period Type</Label>
                              <Select
                                value={templateForm.period_type}
                                onValueChange={(v) => setTemplateForm({ ...templateForm, period_type: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="half_yearly">Half Yearly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
                            <Button onClick={async () => {
                              if (!templateForm.name) {
                                toast.error('Please enter template name');
                                return;
                              }
                              try {
                                const response = await fetch(`${API_URL}/performance/templates`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify(templateForm)
                                });
                                if (response.ok) {
                                  toast.success('Template created');
                                  setShowCreateTemplate(false);
                                  setTemplateForm({ name: '', description: '', period_type: 'quarterly' });
                                  fetchData();
                                } else {
                                  toast.error('Failed to create template');
                                }
                              } catch (error) {
                                toast.error('Failed to create template');
                              }
                            }}>Create</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {templates.length > 0 ? (
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div
                          key={template.template_id}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileSpreadsheet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{template.name}</p>
                              <p className="text-sm text-slate-500">
                                {template.questions?.length || 0} questions • {template.total_points || 100} points
                                {template.uploaded_from_excel && (
                                  <Badge variant="outline" className="ml-2 text-xs">Excel Import</Badge>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `${API_URL}/performance/templates/${template.template_id}/download`;
                                link.download = `${template.name}.xlsx`;
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingTemplate({...template})}>Edit</Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={async () => {
                                if (!window.confirm('Delete this template?')) return;
                                try {
                                  await fetch(`${API_URL}/performance/templates/${template.template_id}`, {
                                    method: 'DELETE',
                                    credentials: 'include'
                                  });
                                  toast.success('Template deleted');
                                  fetchData();
                                } catch (error) {
                                  toast.error('Failed to delete');
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-4">No templates created yet</p>
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" onClick={() => setShowUploadTemplate(true)} className="gap-2">
                          <Upload className="w-4 h-4" />
                          Upload Excel
                        </Button>
                        <Button onClick={() => setShowCreateTemplate(true)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create Manually
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Template Dialog - Enhanced with Question Editing */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit KPI Template</DialogTitle>
            <DialogDescription>Modify template details and questions</DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={editingTemplate.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="Template name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select
                    value={editingTemplate.period_type || 'quarterly'}
                    onValueChange={(v) => setEditingTemplate({ ...editingTemplate, period_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="half_yearly">Half Yearly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="Template description"
                  rows={2}
                />
              </div>
              
              {/* Questions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Questions ({editingTemplate.questions?.length || 0})</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newQuestion = {
                        question_id: `q_${Date.now()}`,
                        question: '',
                        max_points: 10,
                        answer_type: 'score',
                        options: []
                      };
                      setEditingTemplate({
                        ...editingTemplate,
                        questions: [...(editingTemplate.questions || []), newQuestion]
                      });
                    }}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Question
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {(editingTemplate.questions || []).map((q, idx) => (
                    <div key={q.question_id || idx} className="p-3 bg-slate-50 rounded-lg border space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={q.question}
                            onChange={(e) => {
                              const updated = [...editingTemplate.questions];
                              updated[idx] = { ...updated[idx], question: e.target.value };
                              setEditingTemplate({ ...editingTemplate, questions: updated });
                            }}
                            placeholder="Enter question text"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => {
                            const updated = editingTemplate.questions.filter((_, i) => i !== idx);
                            setEditingTemplate({ ...editingTemplate, questions: updated });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Max Points</Label>
                          <Input
                            type="number"
                            value={q.max_points}
                            onChange={(e) => {
                              const updated = [...editingTemplate.questions];
                              updated[idx] = { ...updated[idx], max_points: Number(e.target.value) };
                              setEditingTemplate({ ...editingTemplate, questions: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Answer Type</Label>
                          <Select
                            value={q.answer_type || 'score'}
                            onValueChange={(v) => {
                              const updated = [...editingTemplate.questions];
                              updated[idx] = { ...updated[idx], answer_type: v };
                              setEditingTemplate({ ...editingTemplate, questions: updated });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="score">Score (0-Max)</SelectItem>
                              <SelectItem value="dropdown">Dropdown Options</SelectItem>
                              <SelectItem value="text">Text Response</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Category</Label>
                          <Input
                            value={q.category || ''}
                            onChange={(e) => {
                              const updated = [...editingTemplate.questions];
                              updated[idx] = { ...updated[idx], category: e.target.value };
                              setEditingTemplate({ ...editingTemplate, questions: updated });
                            }}
                            placeholder="e.g., Skills"
                          />
                        </div>
                      </div>
                      
                      {/* Dropdown Options */}
                      {q.answer_type === 'dropdown' && (
                        <div className="space-y-2 p-2 bg-white rounded border">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Dropdown Options</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => {
                                const updated = [...editingTemplate.questions];
                                const options = updated[idx].options || [];
                                options.push({ label: '', value: options.length, points: 0 });
                                updated[idx] = { ...updated[idx], options };
                                setEditingTemplate({ ...editingTemplate, questions: updated });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Option
                            </Button>
                          </div>
                          {(q.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <Input
                                value={opt.label}
                                onChange={(e) => {
                                  const updated = [...editingTemplate.questions];
                                  updated[idx].options[optIdx] = { ...opt, label: e.target.value };
                                  setEditingTemplate({ ...editingTemplate, questions: updated });
                                }}
                                placeholder="Option text"
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={opt.points || 0}
                                onChange={(e) => {
                                  const updated = [...editingTemplate.questions];
                                  updated[idx].options[optIdx] = { ...opt, points: Number(e.target.value) };
                                  setEditingTemplate({ ...editingTemplate, questions: updated });
                                }}
                                placeholder="Points"
                                className="w-20"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 h-8 w-8 p-0"
                                onClick={() => {
                                  const updated = [...editingTemplate.questions];
                                  updated[idx].options = updated[idx].options.filter((_, i) => i !== optIdx);
                                  setEditingTemplate({ ...editingTemplate, questions: updated });
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={handleUpdateTemplate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fill KPI Dialog */}
      <Dialog open={!!editingKPI} onOpenChange={() => { setEditingKPI(null); setKpiFormResponses({}); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fill KPI Assessment</DialogTitle>
            <DialogDescription>
              {editingKPI?.period_type?.charAt(0).toUpperCase() + editingKPI?.period_type?.slice(1)} Review: {editingKPI?.period_start} to {editingKPI?.period_end}
            </DialogDescription>
          </DialogHeader>
          {editingKPI && (
            <div className="space-y-4 py-4">
              {editingKPI.questions && editingKPI.questions.length > 0 ? (
                editingKPI.questions.map((q, idx) => (
                  <div key={q.question_id || idx} className="p-4 bg-slate-50 rounded-lg border space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{q.question}</p>
                        {q.category && <p className="text-xs text-slate-500 mt-1">Category: {q.category}</p>}
                      </div>
                      <Badge variant="outline">Max: {q.max_points} pts</Badge>
                    </div>
                    
                    {/* Answer based on type */}
                    {q.answer_type === 'dropdown' && q.options?.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm">Select Answer</Label>
                        <Select
                          value={kpiFormResponses[q.question_id]?.selected_option || ''}
                          onValueChange={(v) => {
                            const selectedOpt = q.options.find(o => o.label === v);
                            setKpiFormResponses({
                              ...kpiFormResponses,
                              [q.question_id]: {
                                ...kpiFormResponses[q.question_id],
                                selected_option: v,
                                score: selectedOpt?.points || 0
                              }
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {q.options.map((opt, optIdx) => (
                              <SelectItem key={optIdx} value={opt.label}>
                                {opt.label} ({opt.points} pts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : q.answer_type === 'text' ? (
                      <div className="space-y-2">
                        <Label className="text-sm">Your Response</Label>
                        <Textarea
                          value={kpiFormResponses[q.question_id]?.comments || ''}
                          onChange={(e) => setKpiFormResponses({
                            ...kpiFormResponses,
                            [q.question_id]: {
                              ...kpiFormResponses[q.question_id],
                              comments: e.target.value
                            }
                          })}
                          placeholder="Enter your response..."
                          rows={2}
                        />
                        <div className="space-y-1">
                          <Label className="text-sm">Score (0-{q.max_points})</Label>
                          <Input
                            type="number"
                            min="0"
                            max={q.max_points}
                            value={kpiFormResponses[q.question_id]?.score || 0}
                            onChange={(e) => setKpiFormResponses({
                              ...kpiFormResponses,
                              [q.question_id]: {
                                ...kpiFormResponses[q.question_id],
                                score: Math.min(Number(e.target.value), q.max_points)
                              }
                            })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-sm">Score (0-{q.max_points})</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="range"
                            min="0"
                            max={q.max_points}
                            value={kpiFormResponses[q.question_id]?.score || 0}
                            onChange={(e) => setKpiFormResponses({
                              ...kpiFormResponses,
                              [q.question_id]: {
                                ...kpiFormResponses[q.question_id],
                                score: Number(e.target.value)
                              }
                            })}
                            className="flex-1"
                          />
                          <span className="w-16 text-center font-bold text-primary">
                            {kpiFormResponses[q.question_id]?.score || 0}/{q.max_points}
                          </span>
                        </div>
                        <Textarea
                          value={kpiFormResponses[q.question_id]?.comments || ''}
                          onChange={(e) => setKpiFormResponses({
                            ...kpiFormResponses,
                            [q.question_id]: {
                              ...kpiFormResponses[q.question_id],
                              comments: e.target.value
                            }
                          })}
                          placeholder="Add comments (optional)"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No questions found for this KPI template</p>
                  <p className="text-xs text-slate-400 mt-2">Please contact HR to set up the KPI template questions</p>
                </div>
              )}
              
              {/* Score Summary */}
              {editingKPI.questions && editingKPI.questions.length > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Current Score</span>
                    <span className="text-xl font-bold text-primary">
                      {(() => {
                        const total = Object.values(kpiFormResponses).reduce((sum, r) => sum + (r.score || 0), 0);
                        const max = editingKPI.questions.reduce((sum, q) => sum + q.max_points, 0);
                        return max > 0 ? `${((total / max) * 100).toFixed(1)}%` : '0%';
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingKPI(null); setKpiFormResponses({}); }}>Cancel</Button>
            <Button onClick={handleSaveKPIResponses} className="gap-1">
              <Save className="w-4 h-4" />
              Save Responses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformancePage;
