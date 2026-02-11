import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Users, Plus, Star, Clock, CheckCircle2, BarChart3, Send,
  Trash2, Eye, UserCheck, UserPlus, ChevronRight, Target
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const FeedbackTab = () => {
  const { user } = useAuth();
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [myAssignments, setMyAssignments] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [feedbackAnswers, setFeedbackAnswers] = useState({});

  const [form, setForm] = useState({
    title: '', description: '', start_date: '', end_date: '',
    allow_self_nomination: true, anonymous: true, min_reviewers: 3,
  });

  const [assignForm, setAssignForm] = useState({
    target_employee_id: '', reviewer_ids: [],
  });

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    try {
      const [cyclesRes, empRes] = await Promise.all([
        fetch(`${API_URL}/helpdesk/feedback-cycles`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API_URL}/employees`, { headers: getAuthHeaders(), credentials: 'include' }),
      ]);
      if (cyclesRes.ok) setCycles(await cyclesRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  const createCycle = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    try {
      const res = await fetch(`${API_URL}/helpdesk/feedback-cycles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include', body: JSON.stringify(form),
      });
      if (res.ok) { toast.success('Feedback cycle created'); setShowCreate(false); fetchCycles(); }
    } catch { toast.error('Failed to create'); }
  };

  const updateStatus = async (cycleId, status) => {
    try {
      await fetch(`${API_URL}/helpdesk/feedback-cycles/${cycleId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include', body: JSON.stringify({ status }),
      });
      toast.success(`Cycle ${status}`);
      fetchCycles();
    } catch { toast.error('Failed to update'); }
  };

  const deleteCycle = async (cycleId) => {
    try {
      await fetch(`${API_URL}/helpdesk/feedback-cycles/${cycleId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
      });
      toast.success('Cycle deleted');
      fetchCycles();
    } catch { toast.error('Failed to delete'); }
  };

  const assignReviewers = async () => {
    if (!assignForm.target_employee_id || assignForm.reviewer_ids.length === 0) {
      toast.error('Select target employee and reviewers'); return;
    }
    try {
      const res = await fetch(`${API_URL}/helpdesk/feedback-cycles/${selectedCycle.cycle_id}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include', body: JSON.stringify(assignForm),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setShowAssign(false);
        setAssignForm({ target_employee_id: '', reviewer_ids: [] });
      }
    } catch { toast.error('Failed to assign'); }
  };

  const fetchMyAssignments = async (cycleId) => {
    try {
      const res = await fetch(`${API_URL}/helpdesk/feedback-cycles/${cycleId}/my-assignments`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (res.ok) setMyAssignments(await res.json());
    } catch { toast.error('Failed to fetch'); }
  };

  const fetchAnalytics = async (cycleId) => {
    try {
      const res = await fetch(`${API_URL}/helpdesk/feedback-cycles/${cycleId}/analytics`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (res.ok) setAnalytics(await res.json());
    } catch { toast.error('Failed to fetch analytics'); }
  };

  const submitFeedback = async () => {
    if (!currentAssignment) return;
    const answers = Object.entries(feedbackAnswers).map(([qid, val]) => {
      if (typeof val === 'number') return { question_id: qid, rating: val };
      return { question_id: qid, answer: val };
    });
    try {
      const res = await fetch(`${API_URL}/helpdesk/feedback-cycles/${myAssignments.cycle.cycle_id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ assignment_id: currentAssignment.assignment_id, answers }),
      });
      if (res.ok) {
        toast.success('Feedback submitted');
        setShowSubmit(false);
        setFeedbackAnswers({});
        fetchMyAssignments(myAssignments.cycle.cycle_id);
      }
    } catch { toast.error('Failed to submit'); }
  };

  const toggleReviewer = (empId) => {
    setAssignForm(prev => ({
      ...prev,
      reviewer_ids: prev.reviewer_ids.includes(empId)
        ? prev.reviewer_ids.filter(id => id !== empId)
        : [...prev.reviewer_ids, empId]
    }));
  };

  const statusBadge = (status) => {
    const map = { draft: 'bg-slate-100 text-slate-700', active: 'bg-emerald-100 text-emerald-700', closed: 'bg-red-100 text-red-700' };
    return map[status] || map.draft;
  };

  return (
    <div className="space-y-4" data-testid="feedback-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>360-Degree Feedback</h3>
          <p className="text-sm text-slate-500">Peer feedback cycles for professional growth</p>
        </div>
        {isHR && (
          <Button onClick={() => setShowCreate(true)} data-testid="create-feedback-cycle-btn">
            <Plus className="w-4 h-4 mr-2" /> New Cycle
          </Button>
        )}
      </div>

      {/* Cycles List */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : cycles.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No feedback cycles yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <Card key={cycle.cycle_id} className="interactive-card !p-4" data-testid={`cycle-${cycle.cycle_id}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{cycle.title}</h4>
                    <Badge className={statusBadge(cycle.status)}>{cycle.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{cycle.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {isHR ? (
                      <>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {cycle.total_assignments || 0} assignments</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {cycle.completed_assignments || 0} completed</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {cycle.my_pending || 0} pending</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {cycle.my_completed || 0} done</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isHR && (
                    <>
                      {cycle.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(cycle.cycle_id, 'active')}>Activate</Button>
                      )}
                      {cycle.status === 'active' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedCycle(cycle); setShowAssign(true); }}>
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(cycle.cycle_id, 'closed')}>Close</Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setSelectedCycle(cycle); fetchAnalytics(cycle.cycle_id); setShowAnalytics(true); }}>
                        <BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics
                      </Button>
                      {cycle.status === 'draft' && (
                        <Button size="sm" variant="ghost" onClick={() => deleteCycle(cycle.cycle_id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      )}
                    </>
                  )}
                  {!isHR && cycle.status === 'active' && cycle.my_pending > 0 && (
                    <Button size="sm" onClick={() => { fetchMyAssignments(cycle.cycle_id); setShowSubmit(true); }}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Give Feedback
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Cycle Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Feedback Cycle</DialogTitle>
            <DialogDescription>Set up a new 360-degree peer review round</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Q1 2026 Peer Review" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Quarterly peer feedback for all teams" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div><Label>Anonymous Feedback</Label><p className="text-xs text-slate-400">Reviewer identity hidden from employee</p></div>
              <Switch checked={form.anonymous} onCheckedChange={v => setForm({...form, anonymous: v})} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div><Label>Allow Self-Nomination</Label><p className="text-xs text-slate-400">Employees can nominate their own reviewers</p></div>
              <Switch checked={form.allow_self_nomination} onCheckedChange={v => setForm({...form, allow_self_nomination: v})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createCycle}>Create Cycle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Reviewers Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Reviewers</DialogTitle>
            <DialogDescription>Select who reviews whom in "{selectedCycle?.title}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Employee Being Reviewed *</Label>
              <Select value={assignForm.target_employee_id} onValueChange={v => setAssignForm({...assignForm, target_employee_id: v, reviewer_ids: []})}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>{emp.first_name} {emp.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignForm.target_employee_id && (
              <div className="space-y-2">
                <Label>Select Reviewers ({assignForm.reviewer_ids.length} selected)</Label>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {employees.filter(e => e.employee_id !== assignForm.target_employee_id).map(emp => (
                    <label key={emp.employee_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={assignForm.reviewer_ids.includes(emp.employee_id)}
                        onChange={() => toggleReviewer(emp.employee_id)}
                        className="rounded border-slate-300" />
                      <span className="text-sm">{emp.first_name} {emp.last_name}</span>
                      {emp.department && <span className="text-xs text-slate-400 ml-auto">{emp.department}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={assignReviewers} disabled={!assignForm.target_employee_id || assignForm.reviewer_ids.length === 0}>
              Assign {assignForm.reviewer_ids.length} Reviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Feedback Dialog */}
      <Dialog open={showSubmit} onOpenChange={v => { setShowSubmit(v); if (!v) { setCurrentAssignment(null); setFeedbackAnswers({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentAssignment ? `Feedback for ${currentAssignment.target_name}` : 'Your Feedback Assignments'}</DialogTitle>
            {myAssignments?.cycle?.anonymous && <Badge variant="outline" className="w-fit"><span className="text-xs">Anonymous</span></Badge>}
          </DialogHeader>

          {!currentAssignment && myAssignments ? (
            <div className="space-y-2 py-2">
              {myAssignments.assignments?.filter(a => a.status === 'pending').map(assignment => (
                <div key={assignment.assignment_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                  onClick={() => setCurrentAssignment(assignment)}>
                  <div>
                    <p className="font-medium">{assignment.target_name}</p>
                    <p className="text-xs text-slate-400">{assignment.target_department} {assignment.target_designation && `- ${assignment.target_designation}`}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
              {myAssignments.assignments?.filter(a => a.status === 'pending').length === 0 && (
                <p className="text-center py-6 text-slate-400">All feedback submitted!</p>
              )}
            </div>
          ) : currentAssignment && myAssignments ? (
            <div className="space-y-5 py-2">
              {myAssignments.cycle.questions?.map((q, idx) => (
                <div key={q.question_id} className="space-y-2">
                  <Label className="text-sm">
                    <Badge variant="outline" className="mr-2 text-[10px]">{q.category || `Q${idx+1}`}</Badge>
                    {q.text}
                  </Label>
                  {q.type === 'rating' ? (
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(v => (
                        <button key={v} type="button"
                          onClick={() => setFeedbackAnswers({...feedbackAnswers, [q.question_id]: v})}
                          className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                            feedbackAnswers[q.question_id] === v
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                              : feedbackAnswers[q.question_id] > v
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-primary/30'
                          }`}
                        >{v}</button>
                      ))}
                      <span className="self-center ml-2 text-xs text-slate-400">
                        {feedbackAnswers[q.question_id] ? `${feedbackAnswers[q.question_id]}/5` : 'Rate 1-5'}
                      </span>
                    </div>
                  ) : (
                    <Textarea rows={3} placeholder="Your feedback..."
                      value={feedbackAnswers[q.question_id] || ''}
                      onChange={e => setFeedbackAnswers({...feedbackAnswers, [q.question_id]: e.target.value})} />
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCurrentAssignment(null); setFeedbackAnswers({}); }}>Back</Button>
                <Button onClick={submitFeedback}><Send className="w-4 h-4 mr-2" /> Submit Feedback</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback Analytics — {selectedCycle?.title}</DialogTitle>
          </DialogHeader>
          {analytics ? (
            <div className="space-y-6 py-2">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="premium-stat stat-blue"><p className="text-2xl font-bold text-slate-800">{analytics.summary?.total_assignments}</p><p className="text-xs text-slate-500">Total Assignments</p></div>
                <div className="premium-stat stat-emerald"><p className="text-2xl font-bold text-slate-800">{analytics.summary?.completed}</p><p className="text-xs text-slate-500">Completed</p></div>
                <div className="premium-stat stat-amber"><p className="text-2xl font-bold text-slate-800">{analytics.summary?.completion_rate}%</p><p className="text-xs text-slate-500">Completion Rate</p></div>
              </div>

              {/* Category Scores */}
              {analytics.question_summaries?.filter(q => q.type === 'rating').length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Category Scores</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.question_summaries.filter(q => q.type === 'rating').map(q => (
                      <div key={q.question_id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{q.category || q.question_text}</span>
                          <span className="font-bold text-primary">{q.average || '-'}/5</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }}
                            animate={{ width: `${(q.average || 0) / 5 * 100}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Employee Rankings */}
              {analytics.employee_summaries?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Rankings</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analytics.employee_summaries.map((emp, idx) => (
                        <div key={emp.employee_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                          <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{emp.name}</p>
                            <p className="text-xs text-slate-400">{emp.department}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{emp.avg_score || '-'}</p>
                            <p className="text-xs text-slate-400">{emp.total_completed}/{emp.total_assigned}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Text Responses */}
              {analytics.question_summaries?.filter(q => q.type === 'long_text' && q.responses?.length > 0).map(q => (
                <Card key={q.question_id}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{q.category || q.question_text}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                    {q.responses.map((r, i) => (
                      <p key={i} className="text-sm p-2.5 bg-slate-50 rounded-lg border border-slate-100">"{r}"</p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackTab;
