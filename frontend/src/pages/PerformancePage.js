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
  BarChart3
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [kpiResponses, setKpiResponses] = useState([]);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '', priority: 'medium' });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, kpisRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/performance/templates`, { credentials: 'include' }),
        fetch(`${API_URL}/performance/my-kpi`, { credentials: 'include' }),
        fetch(`${API_URL}/performance/goals`, { credentials: 'include' })
      ]);

      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (kpisRes.ok) setMyKpis(await kpisRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKPI = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a KPI template');
      return;
    }

    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);

      const response = await fetch(`${API_URL}/performance/kpi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          template_id: selectedTemplate,
          period_type: 'quarterly',
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
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create KPI');
      }
    } catch (error) {
      toast.error('Failed to create KPI');
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
                            {templates.map(t => (
                              <SelectItem key={t.template_id} value={t.template_id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-slate-500">
                        Period: Current Quarter
                      </p>
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
                        {kpi.final_score && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{kpi.final_score.toFixed(1)}</p>
                            <p className="text-xs text-slate-500">Score</p>
                          </div>
                        )}
                        <Badge className={statusColors[kpi.status]}>
                          {kpi.status}
                        </Badge>
                        {kpi.status === 'draft' && (
                          <Button size="sm" onClick={() => handleSubmitKPI(kpi.kpi_id)}>
                            Submit
                          </Button>
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
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">KPI Templates</CardTitle>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Template
                  </Button>
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
                        <div>
                          <p className="font-medium text-slate-900">{template.name}</p>
                          <p className="text-sm text-slate-500">
                            {template.questions?.length || 0} questions • {template.total_points} points
                          </p>
                        </div>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No templates created yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PerformancePage;
