import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Award, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config';

const API = API_URL + '/performance';
const CATEGORIES = ['Innovation', 'Achievement', 'Improvement', 'IT', 'Planning', 'Training', 'Quality', 'Other'];
const IMPACTS = ['High', 'Medium', 'Low'];

const AchievementsTab = ({ authHeaders, isManager, isHR }) => {
  const [achievements, setAchievements] = useState([]);
  const [pendingEndorsements, setPendingEndorsements] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Achievement', description: '', impact: 'Medium' });
  const [endorseDialog, setEndorseDialog] = useState(null);
  const [endorseRemarks, setEndorseRemarks] = useState('');

  const fetchData = useCallback(async () => {
    const hdrs = { headers: authHeaders };
    try {
      const [achRes, pendRes] = await Promise.all([
        fetch(`${API}/achievements`, hdrs),
        (isManager || isHR) ? fetch(`${API}/achievements/pending`, hdrs) : Promise.resolve(null)
      ]);
      if (achRes.ok) setAchievements(await achRes.json());
      if (pendRes?.ok) setPendingEndorsements(await pendRes.json());
    } catch (e) { console.error(e); }
  }, [authHeaders, isManager, isHR]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/achievements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success('Achievement submitted for endorsement');
        setShowDialog(false);
        setForm({ title: '', category: 'Achievement', description: '', impact: 'Medium' });
        fetchData();
      } else { const e = await res.json(); toast.error(e.detail || 'Failed'); }
    } catch { toast.error('Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleEndorse = async (achievementId) => {
    try {
      const res = await fetch(`${API}/achievements/${achievementId}/endorse`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ remarks: endorseRemarks })
      });
      if (res.ok) { toast.success('Achievement endorsed'); setEndorseDialog(null); setEndorseRemarks(''); fetchData(); }
      else { const e = await res.json(); toast.error(e.detail || 'Failed'); }
    } catch { toast.error('Failed to endorse'); }
  };

  const handleReject = async (achievementId) => {
    const reason = prompt('Reason for not endorsing:');
    if (reason === null) return;
    try {
      const res = await fetch(`${API}/achievements/${achievementId}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason })
      });
      if (res.ok) { toast.success('Achievement not endorsed'); fetchData(); }
      else { const e = await res.json(); toast.error(e.detail || 'Failed'); }
    } catch { toast.error('Failed'); }
  };

  const statusBadge = (status) => {
    const map = { endorsed: 'default', pending: 'secondary', rejected: 'destructive' };
    return <Badge variant={map[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* My Achievements */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Award className="w-5 h-5 text-amber-500" /> My Achievements
              </CardTitle>
              <CardDescription>Log your innovations, improvements and accomplishments</CardDescription>
            </div>
            <Button onClick={() => setShowDialog(true)} data-testid="add-achievement-btn">
              <Plus className="w-4 h-4 mr-1" /> Add Achievement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No achievements logged yet. Start by adding your first one!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Endorsed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {achievements.map(a => (
                  <TableRow key={a.achievement_id} data-testid={`ach-row-${a.achievement_id}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{a.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{a.title}</p>
                        {a.description && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]">{a.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.impact === 'High' ? 'default' : a.impact === 'Medium' ? 'secondary' : 'outline'} className="text-xs">
                        {a.impact}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {a.submitted_on ? new Date(a.submitted_on).toLocaleDateString() : ''}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.endorsed_by_name || '-'}
                      {a.manager_remarks && <p className="text-xs text-slate-400 italic">"{a.manager_remarks}"</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Endorsements (Manager/HR view) */}
      {(isManager || isHR) && pendingEndorsements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Clock className="w-5 h-5 text-amber-500" /> Pending Endorsements
              <Badge variant="destructive" className="ml-1">{pendingEndorsements.length}</Badge>
            </CardTitle>
            <CardDescription>Review and endorse your team's achievements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingEndorsements.map(a => (
                <div key={a.achievement_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-amber-50 rounded-lg gap-4 border border-amber-100" data-testid={`endorse-${a.achievement_id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{a.employee_name}</p>
                      <p className="text-sm font-medium text-amber-700">{a.title}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{a.category}</Badge>
                        <Badge variant={a.impact === 'High' ? 'default' : 'secondary'} className="text-xs">{a.impact}</Badge>
                      </div>
                      {a.description && <p className="text-xs text-slate-500 mt-1">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <Button size="sm" onClick={() => { setEndorseDialog(a); setEndorseRemarks(''); }} className="gap-1" data-testid={`approve-ach-${a.achievement_id}`}>
                      <CheckCircle2 className="w-4 h-4" /> Endorse
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(a.achievement_id)}
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" data-testid={`reject-ach-${a.achievement_id}`}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Achievement Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Achievement</DialogTitle>
            <DialogDescription>Submit your achievement for manager endorsement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger data-testid="ach-category-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Developed automated quality check system" data-testid="ach-title-input" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe your achievement and its impact..." rows={3} data-testid="ach-description-input" />
            </div>
            <div className="space-y-2">
              <Label>Impact Level</Label>
              <Select value={form.impact} onValueChange={v => setForm({...form, impact: v})}>
                <SelectTrigger data-testid="ach-impact-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPACTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} data-testid="submit-achievement-btn">
              {submitting ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endorse Dialog */}
      {endorseDialog && (
        <Dialog open={!!endorseDialog} onOpenChange={() => setEndorseDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Endorse Achievement</DialogTitle>
              <DialogDescription>Confirm endorsement for: {endorseDialog.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-sm">{endorseDialog.employee_name}</p>
                <p className="text-sm text-slate-600 mt-1">{endorseDialog.description || 'No description provided'}</p>
              </div>
              <div className="space-y-2">
                <Label>Remarks (optional)</Label>
                <Textarea value={endorseRemarks} onChange={e => setEndorseRemarks(e.target.value)} placeholder="Add any remarks..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEndorseDialog(null)}>Cancel</Button>
              <Button onClick={() => handleEndorse(endorseDialog.achievement_id)} data-testid="confirm-endorse-btn">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Endorsement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AchievementsTab;
