import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Award, Plus, Edit } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';

const EvaluationsTab = ({ user, evaluations, employees, isHR, authHeaders, onRefresh }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [showSelfAssessDialog, setShowSelfAssessDialog] = useState(false);
  const [evalForm, setEvalForm] = useState({ cycle: 'quarterly' });
  const [selfForm, setSelfForm] = useState({});
  const [editingEval, setEditingEval] = useState(null);

  const getEmpName = (id) => {
    const e = employees.find(x => x.employee_id === id);
    return e ? `${e.first_name} ${e.last_name}` : id || 'N/A';
  };

  const createEval = async () => {
    try {
      const r = await fetch(`${API}/evaluations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(evalForm)
      });
      if (r.ok) { toast.success('Evaluation created'); setShowDialog(false); setEvalForm({ cycle: 'quarterly' }); onRefresh(); }
      else toast.error('Failed to create evaluation');
    } catch { toast.error('Error creating evaluation'); }
  };

  const submitSelfAssessment = async () => {
    if (!editingEval) return;
    try {
      const r = await fetch(`${API}/evaluations/${editingEval.evaluation_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify({ self_rating: selfForm.self_rating, self_comments: selfForm.self_comments, status: 'self_assessed' })
      });
      if (r.ok) { toast.success('Self-assessment submitted'); setShowSelfAssessDialog(false); onRefresh(); }
      else toast.error('Failed to submit');
    } catch { toast.error('Error'); }
  };

  const updateEvalRating = async (evalId, field, value) => {
    try {
      const body = { [field]: Number(value) };
      if (field === 'manager_rating') body.status = 'manager_reviewed';
      if (field === 'hr_rating') body.status = 'completed';
      const r = await fetch(`${API}/evaluations/${evalId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(body)
      });
      if (r.ok) { toast.success('Rating updated'); onRefresh(); }
    } catch { toast.error('Error'); }
  };

  const openSelfAssess = (ev) => {
    setEditingEval(ev);
    setSelfForm({ self_rating: ev.self_rating || '', self_comments: ev.self_comments || '' });
    setShowSelfAssessDialog(true);
  };

  const statusStyle = (s) => {
    const map = {
      draft: 'bg-slate-100 text-slate-700',
      self_assessed: 'bg-blue-100 text-blue-800',
      manager_reviewed: 'bg-purple-100 text-purple-800',
      completed: 'bg-emerald-100 text-emerald-800',
    };
    return map[s] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="grid gap-6" data-testid="evaluations-tab">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />Performance Evaluations
            </CardTitle>
            {isHR && (
              <Button size="sm" onClick={() => setShowDialog(true)} className="gap-1" data-testid="add-eval-btn">
                <Plus className="w-4 h-4" />New Evaluation
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evaluations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Self</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>HR</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map(ev => {
                  const isMyEval = ev.employee_id === user?.employee_id;
                  const canSelfAssess = isMyEval && (!ev.self_rating || ev.status === 'draft');
                  return (
                    <TableRow key={ev.evaluation_id} data-testid={`eval-row-${ev.evaluation_id}`}>
                      <TableCell className="font-medium">{ev.employee_name || getEmpName(ev.employee_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{ev.cycle?.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>{ev.period_label || '-'}</TableCell>
                      <TableCell>{ev.self_rating ? `${ev.self_rating}/5` : '-'}</TableCell>
                      <TableCell>{ev.manager_rating ? `${ev.manager_rating}/5` : '-'}</TableCell>
                      <TableCell>{ev.hr_rating ? `${ev.hr_rating}/5` : '-'}</TableCell>
                      <TableCell>
                        {ev.overall_rating ? (
                          <span className={`font-bold ${scoreColor(ev.overall_rating * 20)}`}>{ev.overall_rating}/5</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusStyle(ev.status)}>{ev.status?.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        {canSelfAssess && (
                          <Button size="sm" variant="outline" onClick={() => openSelfAssess(ev)} className="gap-1" data-testid={`self-assess-btn-${ev.evaluation_id}`}>
                            <Edit className="w-3 h-3" />Self Assess
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-12 text-slate-400">No evaluations yet</p>
          )}
        </CardContent>
      </Card>

      {/* Create Evaluation Dialog (HR) */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Evaluation</DialogTitle>
            <DialogDescription>Create a performance evaluation for an employee</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employee *</Label>
              <Select value={evalForm.employee_id || ''} onValueChange={v => setEvalForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger data-testid="eval-emp"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cycle</Label>
                <Select value={evalForm.cycle} onValueChange={v => setEvalForm(p => ({ ...p, cycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half_yearly">Half Yearly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period Label</Label>
                <Input value={evalForm.period_label || ''} onChange={e => setEvalForm(p => ({ ...p, period_label: e.target.value }))} placeholder="Q1 2026" />
              </div>
            </div>
            <div>
              <Label>HR Comments</Label>
              <Textarea value={evalForm.hr_comments || ''} onChange={e => setEvalForm(p => ({ ...p, hr_comments: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={createEval} disabled={!evalForm.employee_id} data-testid="save-eval-btn">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Self-Assessment Dialog (Employee) */}
      <Dialog open={showSelfAssessDialog} onOpenChange={setShowSelfAssessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Self Assessment</DialogTitle>
            <DialogDescription>Rate your own performance for this period</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Self Rating (1-5) *</Label>
              <Input type="number" min={1} max={5} step={0.5} value={selfForm.self_rating || ''} onChange={e => setSelfForm(p => ({ ...p, self_rating: Number(e.target.value) }))} data-testid="self-rating-input" />
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea value={selfForm.self_comments || ''} onChange={e => setSelfForm(p => ({ ...p, self_comments: e.target.value }))} rows={3} placeholder="Describe your achievements, challenges, and areas you've improved..." data-testid="self-comments-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelfAssessDialog(false)}>Cancel</Button>
            <Button onClick={submitSelfAssessment} disabled={!selfForm.self_rating} data-testid="submit-self-assess-btn">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EvaluationsTab;
