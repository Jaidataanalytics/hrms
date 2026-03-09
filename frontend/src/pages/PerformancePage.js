import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Target, Plus, Award, BarChart3, ClipboardList, FileText,
  RefreshCw, CheckCircle2, Users, Building2, Save, Calendar,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Eye, UserCheck, XCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';
const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
];

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
const scoreBg = p => p >= 90 ? 'bg-emerald-50 border-emerald-200' : p >= 70 ? 'bg-blue-50 border-blue-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

const PerformancePage = () => {
  const { user } = useAuth();
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';
  const authHeaders = getAuthHeaders();
  const hdrs = { credentials: 'include', headers: authHeaders };

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [myTemplate, setMyTemplate] = useState(null);
  const [kpiScores, setKpiScores] = useState(null);
  const [kraDefs, setKraDefs] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [allTemplates, setAllTemplates] = useState([]);

  // MIS Entry
  const [misForm, setMisForm] = useState({});
  const [misDate, setMisDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingMis, setSavingMis] = useState(false);

  // Dialogs
  const [showMisTemplateDialog, setShowMisTemplateDialog] = useState(false);
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showKraDialog, setShowKraDialog] = useState(false);
  const [showEvalDialog, setShowEvalDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({ fields: [] });
  const [kpiForm, setKpiForm] = useState({});
  const [kraForm, setKraForm] = useState({});
  const [evalForm, setEvalForm] = useState({ cycle: 'quarterly' });

  // Admin view state
  const [viewEmpId, setViewEmpId] = useState('');
  const [viewEmpScores, setViewEmpScores] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [dR, eR] = await Promise.all([
        fetch(`${API_URL}/departments`, hdrs),
        fetch(`${API_URL}/employees`, hdrs),
      ]);
      if (dR.ok) setDepartments(await dR.json());
      if (eR.ok) { const d = await eR.json(); setEmployees(Array.isArray(d) ? d : d.employees || []); }

      // My template
      if (user?.employee_id) {
        const tR = await fetch(`${API}/mis-templates/employee/${user.employee_id}`, hdrs);
        if (tR.ok) { const t = await tR.json(); if (t) setMyTemplate(t); }
      }

      // My KPI scores
      const sR = await fetch(`${API}/kpi-scores?period=${period}`, hdrs);
      if (sR.ok) setKpiScores(await sR.json());

      // My KRAs
      const kR = await fetch(`${API}/kra-definitions`, hdrs);
      if (kR.ok) setKraDefs(await kR.json());

      // My evaluations
      const evR = await fetch(`${API}/evaluations`, hdrs);
      if (evR.ok) setEvaluations(await evR.json());

      // Admin: compliance + all templates
      if (isHR) {
        const [cR, atR] = await Promise.all([
          fetch(`${API}/mis-compliance`, hdrs),
          fetch(`${API}/mis-templates`, hdrs),
        ]);
        if (cR.ok) setCompliance(await cR.json());
        if (atR.ok) setAllTemplates(await atR.json());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load existing MIS entry for date
  useEffect(() => {
    if (!myTemplate || !misDate || !user?.employee_id) return;
    (async () => {
      const r = await fetch(`${API}/mis-entries?employee_id=${user.employee_id}&date=${misDate}`, hdrs);
      if (r.ok) { const entries = await r.json(); const e = entries.find(x => x.template_id === myTemplate.template_id); setMisForm(e ? e.fields || {} : {}); }
    })();
  }, [misDate, myTemplate]);

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

  const createTemplate = async () => {
    try {
      const r = await fetch(`${API}/mis-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(templateForm)
      });
      if (r.ok) { toast.success('MIS template created'); setShowMisTemplateDialog(false); setTemplateForm({ fields: [] }); fetchAll(); }
    } catch { toast.error('Error'); }
  };

  const createKpi = async () => {
    try {
      const r = await fetch(`${API}/kpi-definitions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(kpiForm)
      });
      if (r.ok) { toast.success('KPI created'); setShowKpiDialog(false); setKpiForm({}); fetchAll(); }
    } catch { toast.error('Error'); }
  };

  const createKra = async () => {
    try {
      const r = await fetch(`${API}/kra-definitions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(kraForm)
      });
      if (r.ok) { toast.success('KRA created'); setShowKraDialog(false); setKraForm({}); fetchAll(); }
    } catch { toast.error('Error'); }
  };

  const createEval = async () => {
    try {
      const r = await fetch(`${API}/evaluations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(evalForm)
      });
      if (r.ok) { toast.success('Evaluation created'); setShowEvalDialog(false); setEvalForm({ cycle: 'quarterly' }); fetchAll(); }
    } catch { toast.error('Error'); }
  };

  const loadEmpScores = async (empId) => {
    setViewEmpId(empId);
    const r = await fetch(`${API}/kpi-scores?employee_id=${empId}&period=${period}`, hdrs);
    if (r.ok) setViewEmpScores(await r.json());
  };

  const getEmpName = (id) => { const e = employees.find(x => x.employee_id === id); return e ? `${e.first_name} ${e.last_name}` : id || 'N/A'; };

  if (loading) return <div className="flex items-center justify-center h-96"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="performance-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Performance Management</h1>
          <p className="text-sm text-slate-500 mt-1">MIS, KPIs, KRAs & Evaluations</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40" data-testid="period-select"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={`grid w-full ${isHR ? 'grid-cols-6' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="mis-entry" data-testid="tab-mis-entry">My MIS</TabsTrigger>
          <TabsTrigger value="kpi-kra" data-testid="tab-kpi-kra">My KPIs</TabsTrigger>
          <TabsTrigger value="evaluations" data-testid="tab-evaluations">Evaluations</TabsTrigger>
          {isHR && <TabsTrigger value="admin" data-testid="tab-admin">Admin</TabsTrigger>}
          {isHR && <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>}
        </TabsList>

        {/* ===== OVERVIEW ===== */}
        <TabsContent value="overview">
          <div className="grid gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-emerald-500"><CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">KPI Score</p>
                <p className={`text-2xl font-bold mt-1 ${scoreColor(kpiScores?.weighted_score || 0)}`}>{kpiScores?.weighted_score || 0}%</p>
                <p className="text-xs text-slate-400">{kpiScores?.scores?.length || 0} KPIs</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-blue-500"><CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">MIS Entries</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{kpiScores?.entry_count || 0}</p>
                <p className="text-xs text-slate-400">This {period}</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-purple-500"><CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">KRAs</p>
                <p className="text-2xl font-bold mt-1 text-purple-600">{kraDefs.length}</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-amber-500"><CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Evaluations</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{evaluations.length}</p>
              </CardContent></Card>
            </div>

            {kpiScores?.scores?.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" />My KPI Scores</CardTitle></CardHeader>
                <CardContent><div className="space-y-3">
                  {kpiScores.scores.map(s => (
                    <div key={s.kpi_id} className={`p-3 rounded-lg border ${scoreBg(s.score_percentage)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-slate-500">Target: {s.target_value}{s.unit === '%' ? '%' : ` ${s.unit}`} | Actual: {s.actual_value} | {s.source === 'manual' ? 'Manual' : 'Auto'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-lg font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                          {s.score_percentage >= 90 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : s.score_percentage >= 50 ? <Minus className="w-4 h-4 text-amber-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      <Progress value={Math.min(100, s.score_percentage)} className="h-2" />
                    </div>
                  ))}
                </div></CardContent>
              </Card>
            )}

            {kraDefs.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Award className="w-5 h-5 text-primary" />My KRAs</CardTitle></CardHeader>
                <CardContent><div className="space-y-2">
                  {kraDefs.map(k => (
                    <div key={k.kra_id} className="p-3 bg-slate-50 rounded-lg border">
                      <p className="font-medium text-sm">{k.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{k.description}</p>
                      <Badge className="mt-1 text-xs">Weight: {k.weight}x</Badge>
                    </div>
                  ))}
                </div></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== MY MIS ===== */}
        <TabsContent value="mis-entry">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />Daily MIS Entry</CardTitle>
              {myTemplate && <CardDescription>{myTemplate.name}</CardDescription>}
            </CardHeader>
            <CardContent>
              {myTemplate ? (<>
                <div className="flex items-center gap-4 mb-6">
                  <div><Label>Date</Label><Input type="date" value={misDate} onChange={e => setMisDate(e.target.value)} className="w-44" data-testid="mis-date" /></div>
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
                          <SelectContent>
                            {(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
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
              </>) : (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No MIS template assigned to you yet.</p>
                  {isHR && <p className="text-sm mt-1">Assign via the Admin tab.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MY KPIs ===== */}
        <TabsContent value="kpi-kra">
          <div className="grid gap-6">
            {kpiScores?.scores?.length > 0 ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" />My KPI Scores — {PERIODS.find(p => p.value === period)?.label}</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Weighted Score</p>
                    <p className={`text-4xl font-bold ${scoreColor(kpiScores.weighted_score)}`}>{kpiScores.weighted_score}%</p>
                    <p className="text-xs text-slate-400 mt-1">Based on {kpiScores.entry_count} MIS entries</p>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>KPI</TableHead><TableHead>Target</TableHead><TableHead>Actual</TableHead><TableHead>Score</TableHead><TableHead>Source</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {kpiScores.scores.map(s => (
                        <TableRow key={s.kpi_id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.target_value} {s.unit}</TableCell>
                          <TableCell>{s.actual_value}</TableCell>
                          <TableCell><span className={`font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span></TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{s.source === 'auto' ? 'Auto (MIS)' : 'Manual'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No KPIs assigned yet. {isHR ? 'Assign via the Admin tab.' : 'Contact HR.'}</p>
              </CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* ===== EVALUATIONS ===== */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Award className="w-5 h-5 text-primary" />Evaluations</CardTitle>
                {isHR && <Button size="sm" onClick={() => setShowEvalDialog(true)} className="gap-1" data-testid="add-eval-btn"><Plus className="w-4 h-4" />New</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {evaluations.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Employee</TableHead><TableHead>Cycle</TableHead><TableHead>Period</TableHead><TableHead>Self</TableHead><TableHead>Manager</TableHead><TableHead>HR</TableHead><TableHead>Overall</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {evaluations.map(ev => (
                      <TableRow key={ev.evaluation_id}>
                        <TableCell className="font-medium">{ev.employee_name || getEmpName(ev.employee_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{ev.cycle}</Badge></TableCell>
                        <TableCell>{ev.period_label}</TableCell>
                        <TableCell>{ev.self_rating ? `${ev.self_rating}/5` : '-'}</TableCell>
                        <TableCell>{ev.manager_rating ? `${ev.manager_rating}/5` : '-'}</TableCell>
                        <TableCell>{ev.hr_rating ? `${ev.hr_rating}/5` : '-'}</TableCell>
                        <TableCell>{ev.overall_rating ? <span className={`font-bold ${scoreColor(ev.overall_rating * 20)}`}>{ev.overall_rating}/5</span> : '-'}</TableCell>
                        <TableCell><Badge className={ev.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{ev.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-12 text-slate-400">No evaluations yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ADMIN TAB ===== */}
        {isHR && (
          <TabsContent value="admin">
            <div className="grid gap-6">
              {/* MIS Compliance */}
              {compliance && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      MIS Compliance — {compliance.date}
                    </CardTitle>
                    <CardDescription>{compliance.filled}/{compliance.total_assigned} employees submitted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{compliance.filled}</p>
                        <p className="text-xs text-emerald-600">Submitted</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
                        <XCircle className="w-6 h-6 text-red-600 mx-auto" />
                        <p className="text-2xl font-bold text-red-700 mt-1">{compliance.not_filled}</p>
                        <p className="text-xs text-red-600">Not Submitted</p>
                      </div>
                    </div>
                    {compliance.not_filled_list?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-2">Not submitted today:</p>
                        <div className="flex flex-wrap gap-2">
                          {compliance.not_filled_list.map((e, i) => (
                            <Badge key={i} variant="outline" className="text-red-700 border-red-300">{e.employee_name} ({e.department_name})</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Assign MIS Template */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />MIS Templates ({allTemplates.filter(t => t.employee_id).length} employees)</CardTitle>
                      <CardDescription>Assign personalized MIS sheets to employees</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { setTemplateForm({ fields: [{ key: '', label: '', type: 'number' }] }); setShowMisTemplateDialog(true); }} className="gap-1" data-testid="add-template-btn">
                      <Plus className="w-4 h-4" />Assign MIS
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {allTemplates.filter(t => t.employee_id).map(t => (
                      <div key={t.template_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm">{t.employee_name}</p>
                          <p className="text-xs text-slate-500">{t.department_name} | {t.fields?.length} fields</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.fields?.slice(0, 4).map(f => <Badge key={f.key} variant="outline" className="text-[10px]">{f.label}</Badge>)}
                            {(t.fields?.length || 0) > 4 && <Badge variant="outline" className="text-[10px]">+{t.fields.length - 4}</Badge>}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => loadEmpScores(t.employee_id)}><Eye className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* View Employee KPI Scores */}
              {viewEmpScores && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />{getEmpName(viewEmpId)} — KPI Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 p-3 bg-slate-50 rounded-lg text-center">
                      <p className={`text-3xl font-bold ${scoreColor(viewEmpScores.weighted_score)}`}>{viewEmpScores.weighted_score}%</p>
                      <p className="text-xs text-slate-400">{viewEmpScores.entry_count} MIS entries</p>
                    </div>
                    {viewEmpScores.scores.map(s => (
                      <div key={s.kpi_id} className={`p-2 rounded border mb-2 ${scoreBg(s.score_percentage)}`}>
                        <div className="flex justify-between text-sm">
                          <span>{s.name}</span>
                          <span className={`font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                        </div>
                        <Progress value={Math.min(100, s.score_percentage)} className="h-1.5 mt-1" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* KPI & KRA Management */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" />KPI Definitions</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowKpiDialog(true)} data-testid="add-kpi-btn"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-y-auto space-y-2">
                    {allTemplates.filter(t => t.employee_id).map(t => {
                      const empKpis = kpiScores?.scores?.filter(s => true) || [];
                      return null;
                    })}
                    <p className="text-xs text-slate-500 text-center py-2">Use "Add KPI" to assign KPIs to specific employees</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4" />KRA Definitions</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowKraDialog(true)} data-testid="add-kra-btn"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-y-auto space-y-2">
                    <p className="text-xs text-slate-500 text-center py-2">Use "Add KRA" to assign KRAs to specific employees</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ===== COMPANY TAB ===== */}
        {isHR && (
          <TabsContent value="company">
            <CompanyDashboard period={period} authHeaders={authHeaders} departments={departments} employees={employees} getEmpName={getEmpName} />
          </TabsContent>
        )}
      </Tabs>

      {/* ===== MIS TEMPLATE DIALOG ===== */}
      <Dialog open={showMisTemplateDialog} onOpenChange={setShowMisTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign MIS Template to Employee</DialogTitle>
            <DialogDescription>Create a personalized daily MIS sheet</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Employee *</Label>
              <Select value={templateForm.employee_id || ''} onValueChange={v => setTemplateForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger data-testid="template-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.is_active !== false).map(e => (
                    <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>MIS Fields</Label>
                <Button size="sm" variant="outline" onClick={() => setTemplateForm(p => ({
                  ...p, fields: [...p.fields, { key: '', label: '', type: 'number' }]
                }))}><Plus className="w-3 h-3 mr-1" />Add Field</Button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {templateForm.fields?.map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-2 rounded">
                    <div className="col-span-5">
                      <Label className="text-xs">Label</Label>
                      <Input value={f.label} onChange={e => {
                        const nf = [...templateForm.fields];
                        nf[i] = { ...nf[i], label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') };
                        setTemplateForm(p => ({ ...p, fields: nf }));
                      }} placeholder="Field label" />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Type</Label>
                      <Select value={f.type} onValueChange={v => {
                        const nf = [...templateForm.fields];
                        nf[i] = { ...nf[i], type: v };
                        setTemplateForm(p => ({ ...p, fields: nf }));
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Yes/No</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {f.type === 'dropdown' && (
                      <div className="col-span-3">
                        <Label className="text-xs">Options (comma-sep)</Label>
                        <Input value={(f.options || []).join(', ')} onChange={e => {
                          const nf = [...templateForm.fields];
                          nf[i] = { ...nf[i], options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) };
                          setTemplateForm(p => ({ ...p, fields: nf }));
                        }} placeholder="Opt1, Opt2" />
                      </div>
                    )}
                    <div className={f.type === 'dropdown' ? 'col-span-1' : 'col-span-4'}>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => {
                        setTemplateForm(p => ({ ...p, fields: p.fields.filter((_, j) => j !== i) }));
                      }}><XCircle className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMisTemplateDialog(false)}>Cancel</Button>
            <Button onClick={createTemplate} disabled={!templateForm.employee_id || !templateForm.fields?.length} data-testid="save-template-btn">Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== KPI DIALOG ===== */}
      <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add KPI</DialogTitle><DialogDescription>Assign a KPI to an employee</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Employee *</Label>
              <Select value={kpiForm.employee_id || ''} onValueChange={v => setKpiForm(p => ({ ...p, employee_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>KPI Name *</Label><Input value={kpiForm.name || ''} onChange={e => setKpiForm(p => ({ ...p, name: e.target.value }))} data-testid="kpi-name" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Target</Label><Input type="number" value={kpiForm.target_value || ''} onChange={e => setKpiForm(p => ({ ...p, target_value: Number(e.target.value) }))} /></div>
              <div><Label>Unit</Label>
                <Select value={kpiForm.unit || '%'} onValueChange={v => setKpiForm(p => ({ ...p, unit: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="%">%</SelectItem><SelectItem value="count">Count</SelectItem><SelectItem value="INR">INR</SelectItem><SelectItem value="avg">Avg</SelectItem></SelectContent></Select></div>
              <div><Label>Weight</Label><Input type="number" step="0.1" value={kpiForm.weight || 1} onChange={e => setKpiForm(p => ({ ...p, weight: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Calc Type</Label>
                <Select value={kpiForm.calculation_type || 'manual'} onValueChange={v => setKpiForm(p => ({ ...p, calculation_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="sum">Sum</SelectItem><SelectItem value="average">Average</SelectItem><SelectItem value="compliance">Compliance %</SelectItem><SelectItem value="percentage">Ratio %</SelectItem><SelectItem value="inverse_sum">Inverse</SelectItem></SelectContent></Select></div>
              <div><Label>Category</Label>
                <Select value={kpiForm.category || 'operational'} onValueChange={v => setKpiForm(p => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="operational">Operational</SelectItem><SelectItem value="financial">Financial</SelectItem><SelectItem value="quality">Quality</SelectItem><SelectItem value="compliance">Compliance</SelectItem><SelectItem value="efficiency">Efficiency</SelectItem></SelectContent></Select></div>
            </div>
            {kpiForm.calculation_type && kpiForm.calculation_type !== 'manual' && (
              <div><Label>MIS Field Key</Label><Input value={kpiForm.mis_field_key || ''} onChange={e => setKpiForm(p => ({ ...p, mis_field_key: e.target.value }))} placeholder="e.g., payments_processed" /></div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowKpiDialog(false)}>Cancel</Button><Button onClick={createKpi} disabled={!kpiForm.name || !kpiForm.employee_id} data-testid="save-kpi-btn">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== KRA DIALOG ===== */}
      <Dialog open={showKraDialog} onOpenChange={setShowKraDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add KRA</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Employee *</Label>
              <Select value={kraForm.employee_id || ''} onValueChange={v => setKraForm(p => ({ ...p, employee_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>KRA Name *</Label><Input value={kraForm.name || ''} onChange={e => setKraForm(p => ({ ...p, name: e.target.value }))} data-testid="kra-name" /></div>
            <div><Label>Description</Label><Textarea value={kraForm.description || ''} onChange={e => setKraForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Weight</Label><Input type="number" step="0.1" value={kraForm.weight || 1} onChange={e => setKraForm(p => ({ ...p, weight: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowKraDialog(false)}>Cancel</Button><Button onClick={createKra} disabled={!kraForm.name || !kraForm.employee_id} data-testid="save-kra-btn">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EVAL DIALOG ===== */}
      <Dialog open={showEvalDialog} onOpenChange={setShowEvalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Evaluation</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Employee *</Label>
              <Select value={evalForm.employee_id || ''} onValueChange={v => setEvalForm(p => ({ ...p, employee_id: v }))}><SelectTrigger data-testid="eval-emp"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cycle</Label>
                <Select value={evalForm.cycle} onValueChange={v => setEvalForm(p => ({ ...p, cycle: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="half_yearly">Half Yearly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
              <div><Label>Period</Label><Input value={evalForm.period_label || ''} onChange={e => setEvalForm(p => ({ ...p, period_label: e.target.value }))} placeholder="Q1 2026" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Self (1-5)</Label><Input type="number" min={1} max={5} value={evalForm.self_rating || ''} onChange={e => setEvalForm(p => ({ ...p, self_rating: Number(e.target.value) }))} /></div>
              <div><Label>Manager (1-5)</Label><Input type="number" min={1} max={5} value={evalForm.manager_rating || ''} onChange={e => setEvalForm(p => ({ ...p, manager_rating: Number(e.target.value) }))} /></div>
              <div><Label>HR (1-5)</Label><Input type="number" min={1} max={5} value={evalForm.hr_rating || ''} onChange={e => setEvalForm(p => ({ ...p, hr_rating: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Comments</Label><Textarea value={evalForm.hr_comments || ''} onChange={e => setEvalForm(p => ({ ...p, hr_comments: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEvalDialog(false)}>Cancel</Button><Button onClick={createEval} disabled={!evalForm.employee_id} data-testid="save-eval-btn">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Company Dashboard
const CompanyDashboard = ({ period, authHeaders, departments, employees, getEmpName }) => {
  const [dashboard, setDashboard] = useState(null);
  const [crossV, setCrossV] = useState(null);
  const hdrs = { credentials: 'include', headers: authHeaders };

  useEffect(() => {
    (async () => {
      const [dR, cR] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/performance/company-dashboard?period=${period}`, hdrs),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/performance/cross-verification?period=${period}`, hdrs),
      ]);
      if (dR.ok) setDashboard(await dR.json());
      if (cR.ok) setCrossV(await cR.json());
    })();
  }, [period]);

  if (!dashboard) return <div className="text-center py-12"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  const EXECS = [
    { name: 'Nandini Kumari', role: 'HR Head', focus: 'People & Compliance', id: 'EMPC6B9A606' },
    { name: 'Anup Kr Mishra', role: 'Accounts Head', focus: 'Financial Accuracy', id: 'EMP8B9486DD' },
    { name: 'Manoj Kumar', role: 'Sales Head', focus: 'Revenue Growth', id: 'EMP8B117F26' },
    { name: 'Umesh Chandra Prasad', role: 'Audit Head', focus: 'Compliance & Risk', id: 'EMP484529A4' },
    { name: 'KN Sinha', role: 'Production Head', focus: 'Operational Efficiency', id: 'EMP5618F5FF' },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500"><CardContent className="pt-4 pb-3"><p className="text-xs text-slate-500 uppercase">Employees</p><p className="text-2xl font-bold text-blue-600">{dashboard.total_employees}</p></CardContent></Card>
        <Card className="border-l-4 border-l-emerald-500"><CardContent className="pt-4 pb-3"><p className="text-xs text-slate-500 uppercase">MIS Assigned</p><p className="text-2xl font-bold text-emerald-600">{dashboard.total_templates_assigned}</p></CardContent></Card>
        <Card className="border-l-4 border-l-purple-500"><CardContent className="pt-4 pb-3"><p className="text-xs text-slate-500 uppercase">MIS Entries</p><p className="text-2xl font-bold text-purple-600">{dashboard.total_mis_entries}</p><p className="text-xs text-slate-400">This {period}</p></CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="pt-4 pb-3"><p className="text-xs text-slate-500 uppercase">Departments</p><p className="text-2xl font-bold text-amber-600">{dashboard.department_summaries?.length}</p></CardContent></Card>
      </div>

      {/* Senior Executives */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Senior Executive KRAs</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXECS.map(exec => (
              <div key={exec.id} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div><p className="font-semibold text-slate-900">{exec.name}</p><p className="text-sm text-primary font-medium">{exec.role}</p></div>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs text-slate-500 mt-1">Focus: {exec.focus}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cross-Verification */}
      {crossV?.checks?.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Cross-Department Verification</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crossV.checks.map((c, i) => (
                <div key={i} className={`p-3 rounded-lg border ${c.status === 'matched' ? 'bg-emerald-50 border-emerald-200' : c.status === 'mismatch' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex justify-between items-center">
                    <div><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-slate-500">{c.description}</p></div>
                    <Badge className={c.status === 'matched' ? 'bg-emerald-100 text-emerald-800' : c.status === 'mismatch' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                      {c.match_percentage}% match
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs"><span>Source A: {c.value_a}</span><span>Source B: {c.value_b}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department MIS */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Department Summary</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Employees</TableHead><TableHead>MIS Assigned</TableHead><TableHead>Entries</TableHead></TableRow></TableHeader>
            <TableBody>
              {(dashboard.department_summaries || []).sort((a, b) => b.mis_entries - a.mis_entries).map(d => (
                <TableRow key={d.department_id}>
                  <TableCell className="font-medium">{d.department_name}</TableCell>
                  <TableCell>{d.employee_count}</TableCell>
                  <TableCell>{d.templates_assigned}</TableCell>
                  <TableCell>{d.mis_entries}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformancePage;
