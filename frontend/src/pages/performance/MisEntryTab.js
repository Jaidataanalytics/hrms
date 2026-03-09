import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { ClipboardList, Save, RefreshCw, History, CheckCircle2, Clock, XCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const statusBadge = (status) => {
  const map = {
    submitted: { cls: 'bg-blue-100 text-blue-800', label: 'Submitted' },
    verified: { cls: 'bg-emerald-100 text-emerald-800', label: 'Verified' },
    rejected: { cls: 'bg-red-100 text-red-800', label: 'Rejected' },
    resubmitted: { cls: 'bg-amber-100 text-amber-800', label: 'Resubmitted' },
  };
  const m = map[status] || { cls: 'bg-slate-100 text-slate-800', label: status };
  return <Badge className={m.cls}>{m.label}</Badge>;
};

const MisEntryTab = ({ user, myTemplate, authHeaders, isHR }) => {
  const [misForm, setMisForm] = useState({});
  const [misDate, setMisDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingMis, setSavingMis] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load existing entry for selected date
  useEffect(() => {
    if (!myTemplate || !misDate || !user?.employee_id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/mis-entries?employee_id=${user.employee_id}&date=${misDate}`, {
          credentials: 'include', headers: authHeaders
        });
        if (r.ok) {
          const entries = await r.json();
          const e = entries.find(x => x.template_id === myTemplate.template_id);
          setMisForm(e ? e.fields || {} : {});
        }
      } catch (err) { console.error(err); }
    })();
  }, [misDate, myTemplate, user?.employee_id, authHeaders]);

  // Load history
  useEffect(() => {
    if (!showHistory || !user?.employee_id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/mis-entries?employee_id=${user.employee_id}&period=monthly`, {
          credentials: 'include', headers: authHeaders
        });
        if (r.ok) setHistory(await r.json());
      } catch (err) { console.error(err); }
    })();
  }, [showHistory, user?.employee_id, authHeaders]);

  const saveMis = async () => {
    setSavingMis(true);
    try {
      const r = await fetch(`${API}/mis-entries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify({ template_id: myTemplate.template_id, department_id: myTemplate.department_id, employee_id: user?.employee_id, date: misDate, fields: misForm })
      });
      r.ok ? toast.success('MIS entry saved') : toast.error('Failed to save');
    } catch { toast.error('Error saving MIS'); }
    finally { setSavingMis(false); }
  };

  if (!myTemplate) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-base font-medium">No MIS template assigned to you yet.</p>
          {isHR && <p className="text-sm mt-1">Assign a template via the Admin tab.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6" data-testid="mis-entry-tab">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />Daily MIS Entry
              </CardTitle>
              <CardDescription>{myTemplate.name}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1" data-testid="toggle-history-btn">
              <History className="w-4 h-4" />{showHistory ? 'Hide' : 'Show'} History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div>
              <Label>Date</Label>
              <Input type="date" value={misDate} onChange={e => setMisDate(e.target.value)} className="w-44" data-testid="mis-date" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myTemplate.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                {f.type === 'number' ? (
                  <Input type="number" value={misForm[f.key] ?? ''} onChange={e => setMisForm(p => ({ ...p, [f.key]: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="0" data-testid={`mis-${f.key}`} />
                ) : f.type === 'boolean' ? (
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={misForm[f.key] || false} onCheckedChange={v => setMisForm(p => ({ ...p, [f.key]: v }))} data-testid={`mis-${f.key}`} />
                    <span className="text-sm text-slate-500">{misForm[f.key] ? 'Yes' : 'No'}</span>
                  </div>
                ) : f.type === 'dropdown' ? (
                  <Select value={misForm[f.key] || ''} onValueChange={v => setMisForm(p => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger data-testid={`mis-${f.key}`}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Textarea value={misForm[f.key] || ''} onChange={e => setMisForm(p => ({ ...p, [f.key]: e.target.value }))} rows={2} data-testid={`mis-${f.key}`} />
                )}
              </div>
            ))}
          </div>
          <Button onClick={saveMis} disabled={savingMis} className="gap-2 mt-6" data-testid="save-mis-btn">
            {savingMis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save MIS
          </Button>
        </CardContent>
      </Card>

      {showHistory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />Recent MIS Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fields Filled</TableHead>
                    <TableHead>Verified By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(e => (
                    <TableRow key={e.entry_id} data-testid={`history-row-${e.entry_id}`}>
                      <TableCell className="font-medium">{e.date}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell>{Object.keys(e.fields || {}).length} fields</TableCell>
                      <TableCell>
                        {e.verified_by_name || (e.status === 'verified' ? 'Manager' : '-')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-6 text-slate-400 text-sm">No entries this month</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MisEntryTab;
