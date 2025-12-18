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
  UserPlus,
  LogOut,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  FileText,
  Plus
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [exitRequests, setExitRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExit, setShowExit] = useState(false);

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
      const [tasksRes, exitRes] = await Promise.all([
        fetch(`${API_URL}/onboarding/tasks`, { credentials: 'include' }),
        fetch(`${API_URL}/onboarding/exit-requests`, { credentials: 'include' })
      ]);

      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (exitRes.ok) setExitRequests(await exitRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExit = async () => {
    if (!exitForm.requested_last_day || !exitForm.reason) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/onboarding/exit-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(exitForm)
      });

      if (response.ok) {
        toast.success('Exit request submitted');
        setShowExit(false);
        setExitForm({ requested_last_day: '', reason: '', reason_category: 'personal' });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to submit');
      }
    } catch (error) {
      toast.error('Failed to submit');
    }
  };

  const completeTask = async (taskId) => {
    try {
      const response = await fetch(`${API_URL}/onboarding/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        toast.success('Task completed');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const withdrawExit = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/onboarding/exit-requests/${requestId}/withdraw`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Exit request withdrawn');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to withdraw');
    }
  };

  const taskStatusColors = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    skipped: 'bg-slate-100 text-slate-600'
  };

  const exitStatusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    in_notice: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-600',
    withdrawn: 'bg-slate-100 text-slate-600'
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="onboarding-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Onboarding & Exit
          </h1>
          <p className="text-slate-600 mt-1">Manage onboarding tasks and exit requests</p>
        </div>
        <Dialog open={showExit} onOpenChange={setShowExit}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" data-testid="exit-btn">
              <LogOut className="w-4 h-4" />
              Submit Resignation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Resignation</DialogTitle>
              <DialogDescription>We're sorry to see you go. Please provide details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Requested Last Working Day *</Label>
                <Input
                  type="date"
                  value={exitForm.requested_last_day}
                  onChange={(e) => setExitForm({ ...exitForm, requested_last_day: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason Category</Label>
                <Select value={exitForm.reason_category} onValueChange={(v) => setExitForm({ ...exitForm, reason_category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Reasons</SelectItem>
                    <SelectItem value="career">Better Opportunity</SelectItem>
                    <SelectItem value="relocation">Relocation</SelectItem>
                    <SelectItem value="health">Health Reasons</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Textarea
                  value={exitForm.reason}
                  onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
                  placeholder="Please share your reason for leaving..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExit(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleSubmitExit}>Submit Resignation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="onboarding" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="onboarding" className="gap-2" data-testid="tab-onboarding">
            <UserPlus className="w-4 h-4" />
            Onboarding Tasks
          </TabsTrigger>
          <TabsTrigger value="exit" className="gap-2" data-testid="tab-exit">
            <LogOut className="w-4 h-4" />
            Exit Requests
          </TabsTrigger>
        </TabsList>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding">
          {tasks.length > 0 ? (
            <>
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Progress</span>
                    <span className="text-sm font-medium">{completedTasks}/{totalTasks} tasks</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Your Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.task_id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-slate-500">{task.description}</p>
                            )}
                            {task.due_date && (
                              <p className="text-xs text-slate-400 mt-1">Due: {new Date(task.due_date).toLocaleDateString('en-IN')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={taskStatusColors[task.status]}>{task.status}</Badge>
                          {task.status !== 'completed' && (
                            <Button size="sm" onClick={() => completeTask(task.task_id)}>
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-slate-500">No pending onboarding tasks</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Exit Tab */}
        <TabsContent value="exit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Exit Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {exitRequests.length > 0 ? (
                <div className="space-y-3">
                  {exitRequests.map((req) => (
                    <div
                      key={req.request_id}
                      className="p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-slate-400">{req.request_id}</span>
                        <Badge className={exitStatusColors[req.status]}>{req.status}</Badge>
                      </div>
                      <p className="font-medium text-slate-900">
                        Requested Last Day: {new Date(req.requested_last_day).toLocaleDateString('en-IN')}
                      </p>
                      <p className="text-sm text-slate-500 mt-1 capitalize">{req.reason_category.replace('_', ' ')}</p>
                      <p className="text-sm text-slate-600 mt-2">{req.reason}</p>
                      {req.actual_last_day && (
                        <p className="text-sm text-emerald-600 mt-2">Approved Last Day: {new Date(req.actual_last_day).toLocaleDateString('en-IN')}</p>
                      )}
                      {['pending', 'approved'].includes(req.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => withdrawExit(req.request_id)}
                        >
                          Withdraw Request
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <LogOut className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No exit requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OnboardingPage;
