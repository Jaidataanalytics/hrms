import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { ClipboardList, Save, RefreshCw, History, CheckCircle2, Clock, Lock, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const FREQ_ORDER = ['daily', 'weekly', 'monthly', 'quarterly'];
const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };

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

// Get current week range (Mon-Sun)
const getWeekRange = (refDate = new Date()) => {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  };
};

// Check if quarterly MIS is locked (past quarter + not admin)
const isQuarterLocked = (dateStr, isAdmin) => {
  if (isAdmin) return false;
  const today = new Date();
  const entryDate = new Date(dateStr + 'T00:00:00');
  const currentQ = Math.floor(today.getMonth() / 3);
  const entryQ = Math.floor(entryDate.getMonth() / 3);
  return entryDate.getFullYear() * 4 + entryQ < today.getFullYear() * 4 + currentQ;
};

// Get default date for a frequency
const getDefaultDate = (frequency) => {
  const today = new Date();
  if (frequency === 'daily') return today.toISOString().split('T')[0];
  if (frequency === 'weekly') return getWeekRange().start;
  if (frequency === 'monthly') return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  if (frequency === 'quarterly') {
    const qMonth = Math.floor(today.getMonth() / 3) * 3 + 1;
    return `${today.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
  }
  return today.toISOString().split('T')[0];
};

const FrequencyMisForm = ({ template, user, authHeaders, isHR }) => {
  const freq = template.frequency || 'daily';
  const [misForm, setMisForm] = useState({});
  const [misDate, setMisDate] = useState(getDefaultDate(freq));
  const [weekDate, setWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingMis, setSavingMis] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const locked = freq === 'quarterly' && isQuarterLocked(misDate, isHR);
  const weekRange = useMemo(() => getWeekRange(new Date(weekDate + 'T00:00:00')), [weekDate]);

  // For weekly, the date we save is the week start
  const effectiveDate = freq === 'weekly' ? weekRange.start : misDate;

  // Load existing entry for selected date
  useEffect(() => {
    if (!template || !effectiveDate || !user?.employee_id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/mis-entries?employee_id=${user.employee_id}&date=${effectiveDate}&template_id=${template.template_id}`, {
          credentials: 'include', headers: authHeaders
        });
        if (r.ok) {
          const entries = await r.json();
          const e = entries.find(x => x.template_id === template.template_id);
          setMisForm(e ? e.fields || {} : {});
        } else {
          setMisForm({});
        }
      } catch (err) { setMisForm({}); }
    })();
  }, [effectiveDate, template, user?.employee_id, authHeaders]);

  // Load history
  useEffect(() => {
    if (!showHistory || !user?.employee_id) return;
    (async () => {
      try {
        const period = freq === 'daily' ? 'monthly' : freq === 'weekly' ? 'quarterly' : 'annual';
        const r = await fetch(`${API}/mis-entries?employee_id=${user.employee_id}&period=${period}&template_id=${template.template_id}`, {
          credentials: 'include', headers: authHeaders
        });
        if (r.ok) setHistory(await r.json());
      } catch (err) { console.error(err); }
    })();
  }, [showHistory, user?.employee_id, authHeaders, freq, template.template_id]);

  const saveMis = async () => {
    if (locked) { toast.error('This quarter is locked. Contact admin.'); return; }
    setSavingMis(true);
    try {
      const r = await fetch(`${API}/mis-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({
          template_id: template.template_id,
          department_id: template.department_id,
          employee_id: user?.employee_id,
          date: effectiveDate,
          frequency: freq,
          fields: misForm,
        })
      });
      if (r.ok) toast.success(`${FREQ_LABELS[freq]} MIS entry saved`);
      else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to save');
      }
    } catch { toast.error('Error saving MIS'); }
    finally { setSavingMis(false); }
  };

  return (
    <div className="space-y-4" data-testid={`mis-form-${freq}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                {FREQ_LABELS[freq]} MIS Entry
                {locked && <Badge className="bg-red-100 text-red-700 gap-1"><Lock className="w-3 h-3" />Locked</Badge>}
              </CardTitle>
              <CardDescription>{template.name} — {template.fields?.length} fields</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1" data-testid={`toggle-history-${freq}`}>
              <History className="w-4 h-4" />{showHistory ? 'Hide' : 'Show'} History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date picker — different per frequency */}
          <div className="flex items-center gap-4 mb-6">
            {freq === 'daily' && (
              <div>
                <Label>Date</Label>
                <Input type="date" value={misDate} onChange={e => setMisDate(e.target.value)} className="w-44" data-testid={`mis-date-${freq}`} />
              </div>
            )}
            {freq === 'weekly' && (
              <div>
                <Label>Week of</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} className="w-44" data-testid={`mis-date-${freq}`} />
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    <Calendar className="w-3 h-3 mr-1" />{weekRange.label}
                  </Badge>
                </div>
              </div>
            )}
            {freq === 'monthly' && (
              <div>
                <Label>Month</Label>
                <Input type="month" value={misDate.slice(0, 7)} onChange={e => setMisDate(e.target.value + '-01')} className="w-44" data-testid={`mis-date-${freq}`} />
              </div>
            )}
            {freq === 'quarterly' && (
              <div>
                <Label>Quarter</Label>
                <Select value={misDate} onValueChange={setMisDate}>
                  <SelectTrigger className="w-52" data-testid={`mis-date-${freq}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const y = new Date().getFullYear();
                      return [
                        { v: `${y}-01-01`, l: `Q1 ${y} (Jan-Mar)` },
                        { v: `${y}-04-01`, l: `Q2 ${y} (Apr-Jun)` },
                        { v: `${y}-07-01`, l: `Q3 ${y} (Jul-Sep)` },
                        { v: `${y}-10-01`, l: `Q4 ${y} (Oct-Dec)` },
                        { v: `${y - 1}-01-01`, l: `Q1 ${y - 1} (Jan-Mar)` },
                        { v: `${y - 1}-04-01`, l: `Q2 ${y - 1} (Apr-Jun)` },
                        { v: `${y - 1}-07-01`, l: `Q3 ${y - 1} (Jul-Sep)` },
                        { v: `${y - 1}-10-01`, l: `Q4 ${y - 1} (Oct-Dec)` },
                      ];
                    })().map(q => (
                      <SelectItem key={q.v} value={q.v}>{q.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locked && <p className="text-xs text-red-500 mt-1">This quarter is locked. Only admin/manager can edit.</p>}
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {template.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label} {f.required && <span className="text-red-500">*</span>}</Label>
                {f.type === 'number' ? (
                  <Input type="number" disabled={locked} value={misForm[f.key] ?? ''} onChange={e => setMisForm(p => ({ ...p, [f.key]: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="0" data-testid={`mis-${freq}-${f.key}`} />
                ) : f.type === 'boolean' ? (
                  <div className="flex items-center gap-2 h-9">
                    <Switch disabled={locked} checked={misForm[f.key] || false} onCheckedChange={v => setMisForm(p => ({ ...p, [f.key]: v }))} data-testid={`mis-${freq}-${f.key}`} />
                    <span className="text-sm text-slate-500">{misForm[f.key] ? 'Yes' : 'No'}</span>
                  </div>
                ) : f.type === 'dropdown' ? (
                  <Select disabled={locked} value={misForm[f.key] || ''} onValueChange={v => setMisForm(p => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger data-testid={`mis-${freq}-${f.key}`}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Textarea disabled={locked} value={misForm[f.key] || ''} onChange={e => setMisForm(p => ({ ...p, [f.key]: e.target.value }))} rows={2} data-testid={`mis-${freq}-${f.key}`} />
                )}
              </div>
            ))}
          </div>

          <Button onClick={saveMis} disabled={savingMis || locked} className="gap-2 mt-6" data-testid={`save-mis-${freq}`}>
            {savingMis ? <RefreshCw className="w-4 h-4 animate-spin" /> : locked ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {locked ? 'Locked' : 'Save MIS'}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      {showHistory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />Recent {FREQ_LABELS[freq]} Entries
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
                    <TableRow key={e.entry_id}>
                      <TableCell className="font-medium">{e.date}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell>{Object.keys(e.fields || {}).length} fields</TableCell>
                      <TableCell>{e.verified_by_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-6 text-slate-400 text-sm">No entries yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MisEntryTab = ({ user, myTemplates, authHeaders, isHR }) => {
  const templates = myTemplates || [];

  // Group templates by frequency, maintain order
  const freqTabs = useMemo(() => {
    const grouped = {};
    templates.forEach(t => {
      const f = t.frequency || 'daily';
      if (!grouped[f]) grouped[f] = t;
    });
    return FREQ_ORDER.filter(f => grouped[f]).map(f => ({ freq: f, template: grouped[f] }));
  }, [templates]);

  if (freqTabs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-base font-medium">No MIS template assigned to you yet.</p>
          {isHR && <p className="text-sm mt-1">Assign templates via the Admin tab.</p>}
        </CardContent>
      </Card>
    );
  }

  // If only one frequency, don't show tabs
  if (freqTabs.length === 1) {
    return <FrequencyMisForm template={freqTabs[0].template} user={user} authHeaders={authHeaders} isHR={isHR} />;
  }

  return (
    <Tabs defaultValue={freqTabs[0].freq} data-testid="mis-frequency-tabs">
      <TabsList className="mb-4">
        {freqTabs.map(({ freq }) => (
          <TabsTrigger key={freq} value={freq} data-testid={`freq-tab-${freq}`}>
            {FREQ_LABELS[freq]}
          </TabsTrigger>
        ))}
      </TabsList>
      {freqTabs.map(({ freq, template }) => (
        <TabsContent key={freq} value={freq}>
          <FrequencyMisForm template={template} user={user} authHeaders={authHeaders} isHR={isHR} />
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default MisEntryTab;
