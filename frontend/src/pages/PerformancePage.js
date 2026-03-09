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
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  Target, Plus, TrendingUp, Award, BarChart3, ClipboardList, FileText,
  RefreshCw, CheckCircle2, Clock, Users, Building2, ChevronRight,
  Save, Calendar, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
];

const PerformancePage = () => {
  const { user } = useAuth();
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [misTemplates, setMisTemplates] = useState([]);
  const [misEntries, setMisEntries] = useState([]);
  const [kpiDefs, setKpiDefs] = useState([]);
  const [kraDefs, setKraDefs] = useState([]);
  const [kpiScores, setKpiScores] = useState(null);
  const [companyDashboard, setCompanyDashboard] = useState(null);
  const [evaluations, setEvaluations] = useState([]);

  // MIS Entry state
  const [misForm, setMisForm] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [misDate, setMisDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingMis, setSavingMis] = useState(false);

  // Filter state
  const [filterDeptId, setFilterDeptId] = useState('all');
  const [filterEmpId, setFilterEmpId] = useState('all');

  // Dialog state
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showKraDialog, setShowKraDialog] = useState(false);
  const [showEvalDialog, setShowEvalDialog] = useState(false);
  const [kpiForm, setKpiForm] = useState({});
  const [kraForm, setKraForm] = useState({});
  const [evalForm, setEvalForm] = useState({});

  const authHeaders = getAuthHeaders();

  const fetchData = useCallback(async () => {
    try {
      const headers = { credentials: 'include', headers: authHeaders };
      const [deptRes, empRes, misTemplRes, kpiRes, kraRes] = await Promise.all([
        fetch(`${API_URL}/departments`, headers),
        fetch(`${API_URL}/employees`, headers),
        fetch(`${API_URL}/performance/mis-templates`, headers),
        fetch(`${API_URL}/performance/kpi-definitions`, headers),
        fetch(`${API_URL}/performance/kra-definitions`, headers),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(Array.isArray(data) ? data : data.employees || []);
      }
      if (misTemplRes.ok) setMisTemplates(await misTemplRes.json());
      if (kpiRes.ok) setKpiDefs(await kpiRes.json());
      if (kraRes.ok) setKraDefs(await kraRes.json());

      // Load user's MIS template
      if (user?.employee_id) {
        const emp = (await (await fetch(`${API_URL}/employees/${user.employee_id}`, headers)).json());
        if (emp?.department_id) {
          const tempRes = await fetch(`${API_URL}/performance/mis-templates?department_id=${emp.department_id}`, headers);
          if (tempRes.ok) {
            const temps = await tempRes.json();
            if (temps.length > 0) setSelectedTemplate(temps[0]);
          }
        }
      }

      // Load KPI scores
      const scoreRes = await fetch(`${API_URL}/performance/kpi-scores?period=${period}`, headers);
      if (scoreRes.ok) setKpiScores(await scoreRes.json());

      // Load company dashboard (admin only)
      if (isHR) {
        const dashRes = await fetch(`${API_URL}/performance/company-dashboard?period=${period}`, headers);
        if (dashRes.ok) setCompanyDashboard(await dashRes.json());
      }

      // Load evaluations
      const evalRes = await fetch(`${API_URL}/performance/evaluations`, headers);
      if (evalRes.ok) setEvaluations(await evalRes.json());

    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load existing MIS entry for selected date
  useEffect(() => {
    if (selectedTemplate && misDate && user?.employee_id) {
      (async () => {
        try {
          const res = await fetch(
            `${API_URL}/performance/mis-entries?employee_id=${user.employee_id}&date=${misDate}`,
            { credentials: 'include', headers: authHeaders }
          );
          if (res.ok) {
            const entries = await res.json();
            const existing = entries.find(e => e.template_id === selectedTemplate.template_id);
            if (existing) {
              setMisForm(existing.fields || {});
            } else {
              setMisForm({});
            }
          }
        } catch (e) { /* ignore */ }
      })();
    }
  }, [misDate, selectedTemplate]);

  const handleSaveMis = async () => {
    setSavingMis(true);
    try {
      const emp = employees.find(e => e.employee_id === user?.employee_id);
      const res = await fetch(`${API_URL}/performance/mis-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({
          template_id: selectedTemplate.template_id,
          department_id: selectedTemplate.department_id,
          employee_id: user?.employee_id,
          date: misDate,
          fields: misForm
        })
      });
      if (res.ok) {
        toast.success('MIS entry saved successfully');
      } else {
        toast.error('Failed to save MIS entry');
      }
    } catch (err) {
      toast.error('Error saving MIS entry');
    } finally {
      setSavingMis(false);
    }
  };

  const handleCreateKpi = async () => {
    try {
      const res = await fetch(`${API_URL}/performance/kpi-definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(kpiForm)
      });
      if (res.ok) {
        toast.success('KPI created');
        setShowKpiDialog(false);
        setKpiForm({});
        fetchData();
      } else {
        toast.error('Failed to create KPI');
      }
    } catch (err) {
      toast.error('Error creating KPI');
    }
  };

  const handleCreateKra = async () => {
    try {
      const res = await fetch(`${API_URL}/performance/kra-definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(kraForm)
      });
      if (res.ok) {
        toast.success('KRA created');
        setShowKraDialog(false);
        setKraForm({});
        fetchData();
      } else {
        toast.error('Failed to create KRA');
      }
    } catch (err) {
      toast.error('Error creating KRA');
    }
  };

  const handleCreateEval = async () => {
    try {
      const res = await fetch(`${API_URL}/performance/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(evalForm)
      });
      if (res.ok) {
        toast.success('Evaluation created');
        setShowEvalDialog(false);
        setEvalForm({});
        fetchData();
      } else {
        toast.error('Failed to create evaluation');
      }
    } catch (err) {
      toast.error('Error creating evaluation');
    }
  };

  const getDeptName = (id) => departments.find(d => d.department_id === id)?.name || id || 'All';
  const getEmpName = (id) => {
    const emp = employees.find(e => e.employee_id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : id || 'N/A';
  };

  const getScoreColor = (pct) => {
    if (pct >= 90) return 'text-emerald-600';
    if (pct >= 70) return 'text-blue-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (pct) => {
    if (pct >= 90) return 'bg-emerald-50 border-emerald-200';
    if (pct >= 70) return 'bg-blue-50 border-blue-200';
    if (pct >= 50) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="performance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Performance Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">MIS, KPIs, KRAs & Evaluations</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" data-testid="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="mis-entry" data-testid="tab-mis-entry">MIS Entry</TabsTrigger>
          <TabsTrigger value="mis-reports" data-testid="tab-mis-reports">MIS Reports</TabsTrigger>
          <TabsTrigger value="kpi-kra" data-testid="tab-kpi-kra">KPI / KRA</TabsTrigger>
          <TabsTrigger value="evaluations" data-testid="tab-evaluations">Evaluations</TabsTrigger>
          {isHR && <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>}
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview">
          <div className="grid gap-6">
            {/* Score Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">KPI Score</p>
                  <p className={`text-2xl font-bold mt-1 ${getScoreColor(kpiScores?.weighted_score || 0)}`}>
                    {kpiScores?.weighted_score || 0}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{kpiScores?.scores?.length || 0} KPIs tracked</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">MIS Entries</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600">{kpiScores?.entry_count || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">This {period}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">KRAs Assigned</p>
                  <p className="text-2xl font-bold mt-1 text-purple-600">{kraDefs.length}</p>
                  <p className="text-xs text-slate-400 mt-1">Active</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Evaluations</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">{evaluations.length}</p>
                  <p className="text-xs text-slate-400 mt-1">Total</p>
                </CardContent>
              </Card>
            </div>

            {/* KPI Scores Breakdown */}
            {kpiScores?.scores?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    KPI Scores - {PERIODS.find(p => p.value === period)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {kpiScores.scores.map(score => (
                      <div key={score.kpi_id} className={`p-3 rounded-lg border ${getScoreBg(score.score_percentage)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm text-slate-800">{score.name}</p>
                            <p className="text-xs text-slate-500">
                              Target: {score.target_value}{score.unit === '%' ? '%' : ` ${score.unit}`} | Actual: {score.actual_value}{score.unit === '%' ? '%' : ` ${score.unit}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${getScoreColor(score.score_percentage)}`}>
                              {score.score_percentage}%
                            </span>
                            {score.score_percentage >= 90 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> :
                             score.score_percentage >= 50 ? <Minus className="w-4 h-4 text-amber-500" /> :
                             <ArrowDownRight className="w-4 h-4 text-red-500" />}
                          </div>
                        </div>
                        <Progress value={Math.min(100, score.score_percentage)} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== MIS ENTRY TAB ===== */}
        <TabsContent value="mis-entry">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Daily MIS Entry
              </CardTitle>
              <CardDescription>
                Fill in your daily Management Information Sheet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={misDate}
                    onChange={(e) => setMisDate(e.target.value)}
                    className="w-44"
                    data-testid="mis-date-input"
                  />
                </div>
                {selectedTemplate && (
                  <div className="space-y-1">
                    <Label>Template</Label>
                    <Badge variant="secondary" className="text-sm py-1 px-3">
                      {selectedTemplate.department_name} - {selectedTemplate.name}
                    </Badge>
                  </div>
                )}
              </div>

              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedTemplate.fields.map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-sm">{field.label}</Label>
                        {field.type === 'number' ? (
                          <Input
                            type="number"
                            value={misForm[field.key] ?? ''}
                            onChange={(e) => setMisForm(prev => ({
                              ...prev,
                              [field.key]: e.target.value === '' ? '' : Number(e.target.value)
                            }))}
                            placeholder="0"
                            data-testid={`mis-field-${field.key}`}
                          />
                        ) : field.type === 'boolean' ? (
                          <div className="flex items-center gap-2 h-9">
                            <Switch
                              checked={misForm[field.key] || false}
                              onCheckedChange={(val) => setMisForm(prev => ({
                                ...prev, [field.key]: val
                              }))}
                              data-testid={`mis-field-${field.key}`}
                            />
                            <span className="text-sm text-slate-500">
                              {misForm[field.key] ? 'Yes' : 'No'}
                            </span>
                          </div>
                        ) : (
                          <Textarea
                            value={misForm[field.key] || ''}
                            onChange={(e) => setMisForm(prev => ({
                              ...prev, [field.key]: e.target.value
                            }))}
                            rows={2}
                            placeholder="Enter details..."
                            data-testid={`mis-field-${field.key}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <Button onClick={handleSaveMis} disabled={savingMis} className="gap-2" data-testid="save-mis-btn">
                    {savingMis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save MIS Entry
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No MIS template assigned for your department yet.</p>
                  {isHR && <p className="text-sm mt-1">Go to the KPI/KRA tab to manage templates.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MIS REPORTS TAB ===== */}
        <TabsContent value="mis-reports">
          <MISReports
            authHeaders={authHeaders}
            period={period}
            departments={departments}
            employees={employees}
            isHR={isHR}
            filterDeptId={filterDeptId}
            setFilterDeptId={setFilterDeptId}
            filterEmpId={filterEmpId}
            setFilterEmpId={setFilterEmpId}
            getEmpName={getEmpName}
            getDeptName={getDeptName}
          />
        </TabsContent>

        {/* ===== KPI/KRA TAB ===== */}
        <TabsContent value="kpi-kra">
          <div className="grid gap-6">
            {/* KPI Definitions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    KPI Definitions ({kpiDefs.length})
                  </CardTitle>
                  {isHR && (
                    <Button size="sm" onClick={() => { setKpiForm({}); setShowKpiDialog(true); }} className="gap-1" data-testid="add-kpi-btn">
                      <Plus className="w-4 h-4" /> Add KPI
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {kpiDefs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KPI Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Calc Type</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiDefs.map(kpi => (
                        <TableRow key={kpi.kpi_id}>
                          <TableCell className="font-medium">{kpi.name}</TableCell>
                          <TableCell>{getDeptName(kpi.department_id)}</TableCell>
                          <TableCell>{kpi.target_value} {kpi.unit}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{kpi.calculation_type}</Badge>
                          </TableCell>
                          <TableCell>{kpi.weight}x</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs capitalize">{kpi.category}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-slate-500">No KPIs defined yet</p>
                )}
              </CardContent>
            </Card>

            {/* KRA Definitions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    KRA Definitions ({kraDefs.length})
                  </CardTitle>
                  {isHR && (
                    <Button size="sm" onClick={() => { setKraForm({}); setShowKraDialog(true); }} className="gap-1" data-testid="add-kra-btn">
                      <Plus className="w-4 h-4" /> Add KRA
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {kraDefs.length > 0 ? (
                  <div className="space-y-3">
                    {kraDefs.map(kra => (
                      <div key={kra.kra_id} className="p-4 bg-slate-50 rounded-lg border">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{kra.name}</p>
                            <p className="text-sm text-slate-500 mt-1">{kra.description || kra.target_description}</p>
                            <div className="flex gap-2 mt-2">
                              {kra.employee_id && (
                                <Badge variant="outline" className="text-xs">{getEmpName(kra.employee_id)}</Badge>
                              )}
                              {kra.department_id && (
                                <Badge variant="secondary" className="text-xs">{getDeptName(kra.department_id)}</Badge>
                              )}
                              <Badge className="text-xs">Weight: {kra.weight}x</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-slate-500">No KRAs defined yet</p>
                )}
              </CardContent>
            </Card>

            {/* MIS Templates (Admin) */}
            {isHR && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    MIS Templates ({misTemplates.length})
                  </CardTitle>
                  <CardDescription>Department-specific daily MIS sheet templates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {misTemplates.map(t => (
                      <div key={t.template_id} className="p-3 bg-slate-50 rounded-lg border hover:border-primary/50 transition-colors">
                        <p className="font-medium text-sm">{t.department_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.fields?.length || 0} fields</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.fields?.slice(0, 3).map(f => (
                            <Badge key={f.key} variant="outline" className="text-[10px]">{f.label}</Badge>
                          ))}
                          {(t.fields?.length || 0) > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{t.fields.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===== EVALUATIONS TAB ===== */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Performance Evaluations
                </CardTitle>
                {isHR && (
                  <Button size="sm" onClick={() => { setEvalForm({ cycle: 'quarterly' }); setShowEvalDialog(true); }} className="gap-1" data-testid="add-eval-btn">
                    <Plus className="w-4 h-4" /> New Evaluation
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map(ev => (
                      <TableRow key={ev.evaluation_id}>
                        <TableCell className="font-medium">{getEmpName(ev.employee_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{ev.cycle}</Badge></TableCell>
                        <TableCell>{ev.period_label}</TableCell>
                        <TableCell>{ev.self_rating ? `${ev.self_rating}/5` : '-'}</TableCell>
                        <TableCell>{ev.manager_rating ? `${ev.manager_rating}/5` : '-'}</TableCell>
                        <TableCell>{ev.hr_rating ? `${ev.hr_rating}/5` : '-'}</TableCell>
                        <TableCell>
                          {ev.overall_rating ? (
                            <span className={`font-bold ${getScoreColor(ev.overall_rating * 20)}`}>{ev.overall_rating}/5</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={ev.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            {ev.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No evaluations yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== COMPANY DASHBOARD TAB ===== */}
        {isHR && (
          <TabsContent value="company">
            <CompanyDashboard
              dashboard={companyDashboard}
              period={period}
              authHeaders={authHeaders}
              departments={departments}
              employees={employees}
              getEmpName={getEmpName}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* ===== DIALOGS ===== */}
      {/* Add KPI Dialog */}
      <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add KPI Definition</DialogTitle>
            <DialogDescription>Define a new Key Performance Indicator</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>KPI Name *</Label>
              <Input value={kpiForm.name || ''} onChange={e => setKpiForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Timely Payment %" data-testid="kpi-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={kpiForm.department_id || 'all'} onValueChange={v => setKpiForm(p => ({ ...p, department_id: v === 'all' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Employee (Optional)</Label>
                <Select value={kpiForm.employee_id || 'all'} onValueChange={v => setKpiForm(p => ({ ...p, employee_id: v === 'all' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.filter(e => e.is_active !== false).map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Target Value</Label>
                <Input type="number" value={kpiForm.target_value || ''} onChange={e => setKpiForm(p => ({ ...p, target_value: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={kpiForm.unit || '%'} onValueChange={v => setKpiForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Weight</Label>
                <Input type="number" step="0.1" value={kpiForm.weight || 1} onChange={e => setKpiForm(p => ({ ...p, weight: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Calculation Type</Label>
                <Select value={kpiForm.calculation_type || 'manual'} onValueChange={v => setKpiForm(p => ({ ...p, calculation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="sum">Sum (MIS field)</SelectItem>
                    <SelectItem value="average">Average (MIS field)</SelectItem>
                    <SelectItem value="compliance">Compliance % (boolean)</SelectItem>
                    <SelectItem value="percentage">Ratio % (field1/field2)</SelectItem>
                    <SelectItem value="inverse_sum">Inverse (lower is better)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={kpiForm.category || 'operational'} onValueChange={v => setKpiForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="people">People</SelectItem>
                    <SelectItem value="efficiency">Efficiency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kpiForm.calculation_type && kpiForm.calculation_type !== 'manual' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>MIS Field Key</Label>
                  <Input value={kpiForm.mis_field_key || ''} onChange={e => setKpiForm(p => ({ ...p, mis_field_key: e.target.value }))} placeholder="e.g., payments_processed" />
                </div>
                {kpiForm.calculation_type === 'percentage' && (
                  <div className="space-y-1.5">
                    <Label>MIS Field Key 2 (Denominator)</Label>
                    <Input value={kpiForm.mis_field_key_2 || ''} onChange={e => setKpiForm(p => ({ ...p, mis_field_key_2: e.target.value }))} placeholder="e.g., total_payments" />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKpiDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateKpi} disabled={!kpiForm.name} data-testid="save-kpi-btn">Create KPI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add KRA Dialog */}
      <Dialog open={showKraDialog} onOpenChange={setShowKraDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add KRA Definition</DialogTitle>
            <DialogDescription>Define a new Key Result Area</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>KRA Name *</Label>
              <Input value={kraForm.name || ''} onChange={e => setKraForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Department Revenue Growth" data-testid="kra-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={kraForm.description || ''} onChange={e => setKraForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assign to Employee</Label>
                <Select value={kraForm.employee_id || 'all'} onValueChange={v => setKraForm(p => ({ ...p, employee_id: v === 'all' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All (Role-based)</SelectItem>
                    {employees.filter(e => e.is_active !== false).map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={kraForm.department_id || 'all'} onValueChange={v => setKraForm(p => ({ ...p, department_id: v === 'all' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {departments.map(d => <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Designation Level</Label>
                <Select value={kraForm.designation_level || 'all'} onValueChange={v => setKraForm(p => ({ ...p, designation_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {['CEO','Vice President','Director','Manager','Team Lead','Senior Executive','Executive','Junior Executive','Trainee'].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Weight</Label>
                <Input type="number" step="0.1" value={kraForm.weight || 1} onChange={e => setKraForm(p => ({ ...p, weight: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Description</Label>
              <Textarea value={kraForm.target_description || ''} onChange={e => setKraForm(p => ({ ...p, target_description: e.target.value }))} rows={2} placeholder="Describe the expected outcome..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKraDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateKra} disabled={!kraForm.name} data-testid="save-kra-btn">Create KRA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Evaluation Dialog */}
      <Dialog open={showEvalDialog} onOpenChange={setShowEvalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Performance Evaluation</DialogTitle>
            <DialogDescription>Create an evaluation for an employee</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select value={evalForm.employee_id || ''} onValueChange={v => setEvalForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger data-testid="eval-employee-select"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.is_active !== false).map(e => (
                    <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cycle</Label>
                <Select value={evalForm.cycle || 'quarterly'} onValueChange={v => setEvalForm(p => ({ ...p, cycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half_yearly">Half Yearly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Period Label</Label>
                <Input value={evalForm.period_label || ''} onChange={e => setEvalForm(p => ({ ...p, period_label: e.target.value }))} placeholder="Q1 2026" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Self Rating (1-5)</Label>
                <Input type="number" min={1} max={5} value={evalForm.self_rating || ''} onChange={e => setEvalForm(p => ({ ...p, self_rating: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Manager Rating (1-5)</Label>
                <Input type="number" min={1} max={5} value={evalForm.manager_rating || ''} onChange={e => setEvalForm(p => ({ ...p, manager_rating: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>HR Rating (1-5)</Label>
                <Input type="number" min={1} max={5} value={evalForm.hr_rating || ''} onChange={e => setEvalForm(p => ({ ...p, hr_rating: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Comments</Label>
              <Textarea value={evalForm.hr_comments || ''} onChange={e => setEvalForm(p => ({ ...p, hr_comments: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEvalDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateEval} disabled={!evalForm.employee_id} data-testid="save-eval-btn">Create Evaluation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


// ===== MIS Reports Sub-component =====
const MISReports = ({ authHeaders, period, departments, employees, isHR, filterDeptId, setFilterDeptId, filterEmpId, setFilterEmpId, getEmpName, getDeptName }) => {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/performance/mis-entries?period=${period}`;
      if (filterDeptId && filterDeptId !== 'all') url += `&department_id=${filterDeptId}`;
      if (filterEmpId && filterEmpId !== 'all') url += `&employee_id=${filterEmpId}`;

      const res = await fetch(url, { credentials: 'include', headers: authHeaders });
      if (res.ok) setEntries(await res.json());

      // Load summary
      let sumUrl = `${API_URL}/performance/mis-summary?period=${period}`;
      if (filterDeptId && filterDeptId !== 'all') sumUrl += `&department_id=${filterDeptId}`;
      if (filterEmpId && filterEmpId !== 'all') sumUrl += `&employee_id=${filterEmpId}`;

      const sumRes = await fetch(sumUrl, { credentials: 'include', headers: authHeaders });
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEntries(); }, [period, filterDeptId, filterEmpId]);

  return (
    <div className="grid gap-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            {isHR && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Department</Label>
                  <Select value={filterDeptId} onValueChange={setFilterDeptId}>
                    <SelectTrigger className="w-48" data-testid="filter-dept"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Employee</Label>
                  <Select value={filterEmpId} onValueChange={setFilterEmpId}>
                    <SelectTrigger className="w-48" data-testid="filter-emp"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.filter(e => e.is_active !== false && (!filterDeptId || filterDeptId === 'all' || e.department_id === filterDeptId)).map(e => (
                        <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              MIS Summary ({summary.entry_count} entries)
            </CardTitle>
            <CardDescription>{summary.from_date} to {summary.to_date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(summary.sums || {}).map(([key, val]) => (
                <div key={key} className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold text-blue-700">{typeof val === 'number' ? val.toLocaleString() : val}</p>
                  <p className="text-[10px] text-slate-400">Avg: {summary.averages?.[key] || 0}</p>
                </div>
              ))}
              {Object.entries(summary.compliance_rates || {}).map(([key, val]) => (
                <div key={key} className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold text-emerald-700">{val}%</p>
                  <p className="text-[10px] text-slate-400">Compliance</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">MIS Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
          ) : entries.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {entries.map(entry => (
                <div key={entry.entry_id} className="p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-sm">{entry.date}</span>
                      <Badge variant="outline" className="text-xs">{getEmpName(entry.employee_id)}</Badge>
                    </div>
                    <Badge className={entry.status === 'reviewed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>
                      {entry.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {Object.entries(entry.fields || {}).map(([k, v]) => (
                      <div key={k} className="bg-white px-2 py-1 rounded">
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}: </span>
                        <span className="font-medium">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">No MIS entries found for this period</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};


// ===== Company Dashboard Sub-component =====
const CompanyDashboard = ({ dashboard, period, authHeaders, departments, employees, getEmpName }) => {
  if (!dashboard) return <div className="text-center py-12 text-slate-500">Loading company dashboard...</div>;

  const SENIOR_EXECS = [
    { name: 'Nandani Kumar', role: 'HR Head', focus: 'People & Compliance' },
    { name: 'Anup Kumar', role: 'Accounts Head', focus: 'Financial Accuracy' },
    { name: 'Manoj Kumar', role: 'Sales Head', focus: 'Revenue Growth' },
    { name: 'Umesh Prasad', role: 'Audit Head', focus: 'Compliance & Risk' },
    { name: 'K.N. Sinha', role: 'Production Head', focus: 'Operational Efficiency' },
  ];

  return (
    <div className="grid gap-6">
      {/* Company Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Employees</p>
            <p className="text-2xl font-bold text-blue-600">{dashboard.total_employees}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">MIS Entries</p>
            <p className="text-2xl font-bold text-emerald-600">{dashboard.total_mis_entries}</p>
            <p className="text-xs text-slate-400">This {period}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Departments</p>
            <p className="text-2xl font-bold text-purple-600">{dashboard.department_summaries?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Period</p>
            <p className="text-sm font-bold text-amber-600 mt-1">{dashboard.from_date}</p>
            <p className="text-xs text-slate-400">to {dashboard.to_date}</p>
          </CardContent>
        </Card>
      </div>

      {/* Senior Executives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Senior Executive Performance
          </CardTitle>
          <CardDescription>KRAs tied to overall firm performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SENIOR_EXECS.map((exec, i) => (
              <div key={i} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{exec.name}</p>
                    <p className="text-sm text-primary font-medium">{exec.role}</p>
                  </div>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs text-slate-500 mt-2">Focus: {exec.focus}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Department Performance</span>
                    <span className="font-medium">--</span>
                  </div>
                  <Progress value={0} className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Department MIS Compliance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Department MIS Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>MIS Entries</TableHead>
                <TableHead>Avg Entries/Employee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dashboard.department_summaries || [])
                .sort((a, b) => b.mis_compliance - a.mis_compliance)
                .map(dept => (
                <TableRow key={dept.department_id}>
                  <TableCell className="font-medium">{dept.department_name}</TableCell>
                  <TableCell>{dept.employee_count}</TableCell>
                  <TableCell>{dept.mis_entries}</TableCell>
                  <TableCell>
                    <span className={dept.mis_compliance >= 5 ? 'text-emerald-600 font-medium' : dept.mis_compliance >= 1 ? 'text-amber-600' : 'text-red-600'}>
                      {dept.mis_compliance}
                    </span>
                  </TableCell>
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
