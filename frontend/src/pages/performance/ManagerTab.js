import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Users, CheckCircle2, XCircle, Eye, RefreshCw, UserCheck, Clock } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const ManagerTab = ({ authHeaders }) => {
  const [teamDate, setTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [compliance, setCompliance] = useState(null);
  const [teamEntries, setTeamEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewEntry, setViewEntry] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ status: 'verified', manager_remarks: '' });
  const [verifyingEntryId, setVerifyingEntryId] = useState(null);

  const hdrs = { headers: authHeaders };

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const [cR, eR] = await Promise.all([
        fetch(`${API}/my-team-compliance?date=${teamDate}`, hdrs),
        fetch(`${API}/my-team-entries?date=${teamDate}`, hdrs),
      ]);
      if (cR.ok) setCompliance(await cR.json());
      if (eR.ok) setTeamEntries(await eR.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [teamDate, authHeaders]);

  useEffect(() => { fetchTeamData(); }, [fetchTeamData]);

  const openVerify = (entryId) => {
    setVerifyingEntryId(entryId);
    setVerifyForm({ status: 'verified', manager_remarks: '' });
    setShowVerifyDialog(true);
  };

  const submitVerification = async () => {
    try {
      const r = await fetch(`${API}/mis-entries/${verifyingEntryId}/verify`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders }, 
        body: JSON.stringify(verifyForm)
      });
      if (r.ok) {
        toast.success(`Entry ${verifyForm.status}`);
        setShowVerifyDialog(false);
        fetchTeamData();
      } else toast.error('Failed to verify');
    } catch { toast.error('Error'); }
  };

  const viewEntryDetails = (entry) => {
    setViewEntry(entry);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!compliance || compliance.total === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400" data-testid="manager-no-team">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No team members found. Employees must have you set as their Reporting Manager.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6" data-testid="manager-tab">
      {/* Date selector + summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />Team MIS Review
            </CardTitle>
            <div className="flex items-center gap-3">
              <Input type="date" value={teamDate} onChange={e => setTeamDate(e.target.value)} className="w-44" data-testid="team-date" />
              <Button size="sm" variant="outline" onClick={fetchTeamData}><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
          <CardDescription>{compliance.date} — {compliance.filled}/{compliance.total} submitted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
              <Users className="w-5 h-5 text-blue-600 mx-auto" />
              <p className="text-2xl font-bold text-blue-700 mt-1">{compliance.total}</p>
              <p className="text-xs text-blue-600">Team Members</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
              <p className="text-2xl font-bold text-emerald-700 mt-1">{compliance.filled}</p>
              <p className="text-xs text-emerald-600">Submitted</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
              <XCircle className="w-5 h-5 text-red-600 mx-auto" />
              <p className="text-2xl font-bold text-red-700 mt-1">{compliance.not_filled}</p>
              <p className="text-xs text-red-600">Pending</p>
            </div>
          </div>

          {/* Team compliance list */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>MIS Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compliance.team.map(m => {
                const entry = teamEntries.find(e => e.employee_id === m.employee_id);
                return (
                  <TableRow key={m.employee_id} data-testid={`team-row-${m.employee_id}`}>
                    <TableCell className="font-medium">{m.employee_name}</TableCell>
                    <TableCell>
                      {m.has_template ? (
                        <Badge className="bg-blue-100 text-blue-800">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">No template</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.status === 'verified' ? (
                        <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>
                      ) : m.status === 'submitted' || m.status === 'resubmitted' ? (
                        <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />{m.status === 'resubmitted' ? 'Resubmitted' : 'Awaiting Review'}</Badge>
                      ) : m.status === 'rejected' ? (
                        <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">Not submitted</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => viewEntryDetails(entry)} data-testid={`view-entry-${m.employee_id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(entry.status === 'submitted' || entry.status === 'resubmitted') && (
                            <Button size="sm" variant="outline" onClick={() => openVerify(entry.entry_id)} className="gap-1" data-testid={`verify-btn-${m.employee_id}`}>
                              <UserCheck className="w-3 h-3" />Review
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entry Detail View */}
      {viewEntry && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">MIS Entry Details — {viewEntry.date}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setViewEntry(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(viewEntry.fields || {}).map(([key, val]) => (
                <div key={key} className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                  <p className="font-medium mt-0.5">
                    {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val || '-')}
                  </p>
                </div>
              ))}
            </div>
            {viewEntry.manager_remarks && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Manager Remarks</p>
                <p className="text-sm mt-0.5">{viewEntry.manager_remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review MIS Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="flex gap-3">
              <Button
                variant={verifyForm.status === 'verified' ? 'default' : 'outline'}
                onClick={() => setVerifyForm(p => ({ ...p, status: 'verified' }))}
                className="flex-1 gap-1" data-testid="verify-approve"
              >
                <CheckCircle2 className="w-4 h-4" />Approve
              </Button>
              <Button
                variant={verifyForm.status === 'rejected' ? 'destructive' : 'outline'}
                onClick={() => setVerifyForm(p => ({ ...p, status: 'rejected' }))}
                className="flex-1 gap-1" data-testid="verify-reject"
              >
                <XCircle className="w-4 h-4" />Reject
              </Button>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={verifyForm.manager_remarks} onChange={e => setVerifyForm(p => ({ ...p, manager_remarks: e.target.value }))} rows={3} placeholder="Optional feedback..." data-testid="verify-remarks" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>Cancel</Button>
            <Button onClick={submitVerification} data-testid="submit-verify-btn">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerTab;
