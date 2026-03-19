import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import {
  FileText, Plus, Target, Award, Eye, XCircle, AlertTriangle,
  CheckCircle2, RefreshCw, BarChart3, Database, Trash2, Search, TrendingUp,
  Pencil, Users
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
const scoreBg = p => p >= 90 ? 'bg-emerald-50 border-emerald-200' : p >= 70 ? 'bg-blue-50 border-blue-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

const AdminTab = ({ employees, authHeaders, period }) => {
  const [compliance, setCompliance] = useState(null);
  const [allTemplates, setAllTemplates] = useState([]);
  const [allKpis, setAllKpis] = useState([]);
  const [allKras, setAllKras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // View employee MIS + KPI dialog
  const [viewEmpId, setViewEmpId] = useState('');
  const [viewEmpScores, setViewEmpScores] = useState(null);
  const [viewEmpEntries, setViewEmpEntries] = useState([]);
  const [viewEmpSummary, setViewEmpSummary] = useState(null);
  const [viewPeriod, setViewPeriod] = useState('monthly');
  const [viewLoading, setViewLoading] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);

  // Filters for MIS templates list
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateDeptFilter, setTemplateDeptFilter] = useState('all');

  // Dialogs
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showKraDialog, setShowKraDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({ fields: [] });
  const [kpiForm, setKpiForm] = useState({});
  const [kraForm, setKraForm] = useState({});

  const hdrs = { credentials: 'include', headers: authHeaders };

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [cR, tR, kpR, krR] = await Promise.all([
        fetch(`${API}/mis-compliance`, hdrs),
        fetch(`${API}/mis-templates`, hdrs),
        fetch(`${API}/all-kpi-definitions`, hdrs),
        fetch(`${API}/all-kra-definitions`, hdrs),
      ]);
      if (cR.ok) setCompliance(await cR.json());
      if (tR.ok) setAllTemplates(await tR.json());
      if (kpR.ok) setAllKpis(await kpR.json());
      if (krR.ok) setAllKras(await krR.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

  const seedData = async () => {
    setSeeding(true);
    try {
      const r = await fetch(`${API}/seed-data`, { method: 'POST', headers: authHeaders, credentials: 'include' });
      if (r.ok) { const d = await r.json(); toast.success(d.message); fetchAdminData(); }
      else toast.error('Failed to seed data');
    } catch { toast.error('Error seeding data'); }
    finally { setSeeding(false); }
  };

  const loadEmpScores = async (empId, per = viewPeriod) => {
    setViewEmpId(empId);
    setViewLoading(true);
    setViewPeriod(per);
    try {
      const [eR, sR, kR] = await Promise.all([
        fetch(`${API}/mis-entries?employee_id=${empId}&period=${per}`, hdrs),
        fetch(`${API}/mis-summary?employee_id=${empId}&period=${per}`, hdrs),
        fetch(`${API}/kpi-scores?employee_id=${empId}&period=${per}`, hdrs),
      ]);
      if (eR.ok) setViewEmpEntries(await eR.json());
      if (sR.ok) setViewEmpSummary(await sR.json());
      if (kR.ok) setViewEmpScores(await kR.json());
    } catch (err) {
      toast.error('Failed to load employee data');
    } finally {
      setViewLoading(false);
    }
  };

  const closeEmpView = () => {
    setViewEmpId('');
    setViewEmpScores(null);
    setViewEmpEntries([]);
    setViewEmpSummary(null);
    setViewEntry(null);
  };

  const createTemplate = async () => {
    try {
      const payload = {
        employee_id: templateForm.employee_id,
        frequency: templateForm.frequency || 'daily',
        fields: (templateForm.fields || []).filter(f => f.label),
      };
      const r = await fetch(`${API}/mis-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (r.ok) { toast.success('MIS template created'); setShowTemplateDialog(false); setTemplateForm({ fields: [], frequency: 'daily' }); fetchAdminData(); }
      else toast.error('Failed to create template');
    } catch { toast.error('Error'); }
  };

  const deleteTemplate = async (templateId) => {
    try {
      const r = await fetch(`${API}/mis-templates/${templateId}`, { method: 'DELETE', headers: authHeaders, credentials: 'include' });
      if (r.ok) { toast.success('Template removed'); fetchAdminData(); }
    } catch { toast.error('Error'); }
  };

  const createKpi = async () => {
    try {
      const r = await fetch(`${API}/kpi-definitions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(kpiForm)
      });
      if (r.ok) { toast.success('KPI created'); setShowKpiDialog(false); setKpiForm({}); fetchAdminData(); }
    } catch { toast.error('Error'); }
  };

  const deleteKpi = async (kpiId) => {
    try {
      const r = await fetch(`${API}/kpi-definitions/${kpiId}`, { method: 'DELETE', headers: authHeaders, credentials: 'include' });
      if (r.ok) { toast.success('KPI removed'); fetchAdminData(); }
    } catch { toast.error('Error'); }
  };

  const createKra = async () => {
    try {
      const r = await fetch(`${API}/kra-definitions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify(kraForm)
      });
      if (r.ok) { toast.success('KRA created'); setShowKraDialog(false); setKraForm({}); fetchAdminData(); }
    } catch { toast.error('Error'); }
  };

  const deleteKra = async (kraId) => {
    try {
      const r = await fetch(`${API}/kra-definitions/${kraId}`, { method: 'DELETE', headers: authHeaders, credentials: 'include' });
      if (r.ok) { toast.success('KRA removed'); fetchAdminData(); }
    } catch { toast.error('Error'); }
  };

  const getEmpName = (id) => {
    const e = employees.find(x => x.employee_id === id);
    return e ? `${e.first_name} ${e.last_name}` : id || 'N/A';
  };

  const openEditTemplate = (template) => {
    setEditingTemplateId(template.template_id);
    setTemplateForm({
      employee_id: template.employee_id,
      frequency: template.frequency || 'daily',
      fields: template.fields?.length > 0 ? template.fields : [{ key: '', label: '', type: 'number' }],
    });
    setShowTemplateDialog(true);
  };

  const openNewTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({ fields: [{ key: '', label: '', type: 'number' }], frequency: 'daily' });
    setShowTemplateDialog(true);
  };

  // Group KPIs and KRAs by employee
  const kpisByEmployee = {};
  allKpis.forEach(k => {
    const eid = k.employee_id || 'unassigned';
    if (!kpisByEmployee[eid]) kpisByEmployee[eid] = { name: k.employee_name || 'Unassigned', items: [] };
    kpisByEmployee[eid].items.push(k);
  });

  const krasByEmployee = {};
  allKras.forEach(k => {
    const eid = k.employee_id || 'unassigned';
    if (!krasByEmployee[eid]) krasByEmployee[eid] = { name: k.employee_name || 'Unassigned', items: [] };
    krasByEmployee[eid].items.push(k);
  });

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid gap-6" data-testid="admin-tab">
      {/* Seed Data */}
      <Card className="border-dashed border-2">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Seed Sample Data</p>
            <p className="text-xs text-slate-500">Populate MIS templates, KPIs, and KRAs for demo employees (Accounts dept + Senior Executives)</p>
          </div>
          <Button onClick={seedData} disabled={seeding} variant="outline" className="gap-2" data-testid="seed-data-btn">
            {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {seeding ? 'Seeding...' : 'Seed Data'}
          </Button>
        </CardContent>
      </Card>

      {/* MIS Compliance */}
      {compliance && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />MIS Compliance — {compliance.date}
              </CardTitle>
              <Badge variant="outline" className={compliance.filled === compliance.total_assigned ? 'text-emerald-600 border-emerald-300' : 'text-amber-600 border-amber-300'}>
                {compliance.filled}/{compliance.total_assigned} submitted
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{compliance.filled} submitted</span>
                <span>{compliance.not_filled} pending</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${compliance.filled === compliance.total_assigned ? 'bg-emerald-500' : compliance.filled > compliance.total_assigned / 2 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${compliance.total_assigned ? (compliance.filled / compliance.total_assigned * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Compact pending list — grouped by department */}
            {compliance.not_filled_list?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Pending submissions ({compliance.not_filled})</p>
                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                  {Object.entries(
                    compliance.not_filled_list.reduce((acc, e) => {
                      const dept = e.department_name || 'Other';
                      if (!acc[dept]) acc[dept] = [];
                      acc[dept].push(e);
                      return acc;
                    }, {})
                  ).sort(([, a], [, b]) => b.length - a.length).map(([dept, emps]) => (
                    <div key={dept} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border text-xs">
                      <Badge variant="outline" className="shrink-0 text-[10px] mt-0.5">{dept} ({emps.length})</Badge>
                      <span className="text-slate-600 leading-relaxed">{emps.map(e => e.employee_name).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MIS Templates — Filterable */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />MIS Templates ({allTemplates.filter(t => t.employee_id).length} employees)
              </CardTitle>
              <CardDescription>Click the view button to see employee's MIS entries and KPI scores</CardDescription>
            </div>
            <Button size="sm" onClick={openNewTemplate} className="gap-1" data-testid="add-template-btn">
              <Plus className="w-4 h-4" />Assign MIS
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search employee name..."
                className="pl-9 h-9"
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                data-testid="template-search-input"
              />
            </div>
            <Select value={templateDeptFilter} onValueChange={setTemplateDeptFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-9" data-testid="template-dept-filter">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {[...new Set(allTemplates.filter(t => t.department_name).map(t => t.department_name))].sort().map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {allTemplates.filter(t => t.employee_id).filter(t => {
              if (templateSearch && !t.employee_name?.toLowerCase().includes(templateSearch.toLowerCase())) return false;
              if (templateDeptFilter !== 'all' && t.department_name !== templateDeptFilter) return false;
              return true;
            }).map(t => (
              <div key={t.template_id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${viewEmpId === t.employee_id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 hover:bg-slate-100'}`} data-testid={`template-${t.template_id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{t.employee_name}</p>
                    {t.frequency && <Badge variant="outline" className="text-[10px] capitalize shrink-0">{t.frequency}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{t.department_name} | {t.fields?.length} fields</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.fields?.slice(0, 3).map(f => <Badge key={f.key} variant="outline" className="text-[10px]">{f.label}</Badge>)}
                    {(t.fields?.length || 0) > 3 && <Badge variant="outline" className="text-[10px]">+{t.fields.length - 3}</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => loadEmpScores(t.employee_id)} data-testid={`view-scores-${t.employee_id}`}>
                    <Eye className="w-3.5 h-3.5" />View
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openEditTemplate(t)} data-testid={`edit-template-${t.template_id}`}>
                    <Pencil className="w-3.5 h-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteTemplate(t.template_id)} data-testid={`delete-template-${t.template_id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
            {allTemplates.filter(t => t.employee_id).length === 0 && (
              <p className="text-center py-6 text-sm text-slate-400">No MIS templates assigned yet. Click "Assign MIS" or "Seed Data" to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee MIS Entries + KPI Scores Viewer Dialog */}
      <Dialog open={!!viewEmpId} onOpenChange={(open) => { if (!open) closeEmpView(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="emp-mis-kpi-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {getEmpName(viewEmpId)} — MIS Entries & KPI Scores
            </DialogTitle>
          </DialogHeader>

          {/* Period selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { value: 'daily', label: 'Today' },
              { value: 'weekly', label: 'Week' },
              { value: 'monthly', label: 'Month' },
              { value: 'quarterly', label: 'Quarter' },
              { value: 'half_yearly', label: 'Half Year' },
              { value: 'annual', label: 'Year' },
            ].map(p => (
              <Button
                key={p.value}
                size="sm"
                variant={viewPeriod === p.value ? 'default' : 'outline'}
                onClick={() => loadEmpScores(viewEmpId, p.value)}
                className="text-xs"
                data-testid={`period-btn-${p.value}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {viewLoading ? (
            <div className="flex items-center justify-center h-32"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <p className="text-xl font-bold text-blue-700">{viewEmpSummary?.entry_count || 0}</p>
                  <p className="text-xs text-slate-500">MIS Entries</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border text-center">
                  <p className="text-xs text-slate-500">{viewEmpSummary?.from_date?.slice(5) || '-'}</p>
                  <p className="text-xs font-medium text-slate-700">to {viewEmpSummary?.to_date?.slice(5) || '-'}</p>
                </div>
                {viewEmpScores && (
                  <>
                    <div className={`p-3 rounded-lg border text-center ${scoreBg(viewEmpScores.weighted_score)}`}>
                      <p className={`text-xl font-bold ${scoreColor(viewEmpScores.weighted_score)}`}>{viewEmpScores.weighted_score}%</p>
                      <p className="text-xs text-slate-500">KPI Score</p>
                    </div>
                    <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-center">
                      <p className="text-xl font-bold text-violet-700">{viewEmpScores.scores?.length || 0}</p>
                      <p className="text-xs text-slate-500">Active KPIs</p>
                    </div>
                  </>
                )}
              </div>

              {/* MIS Field Aggregates */}
              {viewEmpSummary && Object.keys(viewEmpSummary.sums || {}).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-blue-600" />MIS Field Totals
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(viewEmpSummary.sums).map(([key, total]) => (
                      <div key={key} className="p-2.5 bg-slate-50 rounded-lg border">
                        <p className="text-xs text-slate-500 truncate capitalize">{key.replace(/_/g, ' ')}</p>
                        <span className="text-base font-bold text-slate-900">{typeof total === 'number' ? total.toLocaleString() : total}</span>
                        {viewEmpSummary.averages?.[key] !== undefined && (
                          <span className="text-xs text-blue-500 ml-2">Avg: {viewEmpSummary.averages[key]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KPI Score Cards */}
              {viewEmpScores?.scores?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Target className="w-4 h-4 text-violet-600" />KPI Scores
                    <Badge variant="outline" className={`ml-auto ${scoreColor(viewEmpScores.weighted_score)}`}>
                      Overall: {viewEmpScores.weighted_score}%
                    </Badge>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {viewEmpScores.scores.map(s => (
                      <div key={s.kpi_id} className={`p-2.5 rounded-lg border ${scoreBg(s.score_percentage)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                          <span className={`text-sm font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                        </div>
                        <Progress value={Math.min(100, s.score_percentage)} className="h-1.5 mb-1" />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Actual: {s.actual_value}</span>
                          <span>Target: {s.target_value} {s.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MIS Entry List */}
              {viewEmpEntries.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <FileText className="w-4 h-4 text-primary" />MIS Entries ({viewEmpEntries.length})
                  </p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {viewEmpEntries.map(entry => (
                      <div
                        key={entry.entry_id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => setViewEntry(viewEntry?.entry_id === entry.entry_id ? null : entry)}
                        data-testid={`mis-entry-row-${entry.entry_id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-700 leading-none">{entry.date?.slice(8)}</span>
                            <span className="text-[9px] text-blue-500">
                              {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{entry.date}</p>
                            <p className="text-xs text-slate-500">{Object.keys(entry.fields || {}).length} fields</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${
                          entry.status === 'verified' ? 'text-emerald-600 border-emerald-300' :
                          entry.status === 'submitted' ? 'text-blue-600 border-blue-300' :
                          'text-amber-600 border-amber-300'
                        }`}>
                          {entry.status === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {entry.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg border">
                  <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No MIS entries submitted for this period</p>
                </div>
              )}

              {/* Expanded MIS entry detail */}
              {viewEntry && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4" data-testid="mis-entry-expanded">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Entry Detail — {viewEntry.date}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(viewEntry.fields || {}).map(([key, value]) => (
                      <div key={key} className="p-2 bg-white rounded border">
                        <p className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-semibold text-slate-900">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</p>
                      </div>
                    ))}
                  </div>
                  {viewEntry.verified_by_name && (
                    <p className="text-xs text-emerald-600 mt-2">Verified by {viewEntry.verified_by_name} on {viewEntry.verified_at?.slice(0, 10)}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* KPI Definitions by Employee */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" />KPI Definitions ({allKpis.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowKpiDialog(true)} className="gap-1" data-testid="add-kpi-btn"><Plus className="w-4 h-4" />Add KPI</Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.entries(kpisByEmployee).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(kpisByEmployee).map(([eid, group]) => (
                <div key={eid}>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" />{group.name}
                    <Badge variant="outline" className="text-[10px]">{group.items.length} KPIs</Badge>
                  </p>
                  <div className="space-y-1.5 ml-5">
                    {group.items.map(k => (
                      <div key={k.kpi_id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm" data-testid={`kpi-item-${k.kpi_id}`}>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{k.name}</span>
                          <span className="text-xs text-slate-500 ml-2">Target: {k.target_value}{k.unit} | {k.calculation_type} | W:{k.weight}x</span>
                          {k.max_marks && <span className="text-xs text-blue-500 ml-2">Max: {k.max_marks}</span>}
                          {k.scoring_rubric && <p className="text-xs text-slate-400 mt-0.5 truncate">{k.scoring_rubric}</p>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0 shrink-0" onClick={() => deleteKpi(k.kpi_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-sm text-slate-400">No KPIs defined yet</p>
          )}
        </CardContent>
      </Card>

      {/* KRA Definitions by Employee */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Award className="w-5 h-5 text-primary" />KRA Definitions ({allKras.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowKraDialog(true)} className="gap-1" data-testid="add-kra-btn"><Plus className="w-4 h-4" />Add KRA</Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.entries(krasByEmployee).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(krasByEmployee).map(([eid, group]) => (
                <div key={eid}>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Award className="w-3.5 h-3.5" />{group.name}
                    <Badge variant="outline" className="text-[10px]">{group.items.length} KRAs</Badge>
                  </p>
                  <div className="space-y-1.5 ml-5">
                    {group.items.map(k => (
                      <div key={k.kra_id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm" data-testid={`kra-item-${k.kra_id}`}>
                        <div>
                          <span className="font-medium">{k.name}</span>
                          {k.description && <span className="text-xs text-slate-500 ml-2">{k.description}</span>}
                          <span className="text-xs text-slate-400 ml-2">W:{k.weight}x</span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0" onClick={() => deleteKra(k.kra_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-sm text-slate-400">No KRAs defined yet</p>
          )}
        </CardContent>
      </Card>

      {/* ===== MIS TEMPLATE DIALOG ===== */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? 'Edit MIS Template' : 'Assign MIS Template to Employee'}</DialogTitle>
            <DialogDescription>{editingTemplateId ? 'Modify fields and frequency for this template' : 'Create a personalized MIS sheet with a specific frequency'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employee *</Label>
                <Select value={templateForm.employee_id || ''} onValueChange={v => setTemplateForm(p => ({ ...p, employee_id: v }))} disabled={!!editingTemplateId}>
                  <SelectTrigger data-testid="template-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.is_active !== false).map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency *</Label>
                <Select value={templateForm.frequency || 'daily'} onValueChange={v => setTemplateForm(p => ({ ...p, frequency: v }))} disabled={!!editingTemplateId}>
                  <SelectTrigger data-testid="template-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={createTemplate} disabled={!templateForm.employee_id || !templateForm.fields?.length} data-testid="save-template-btn">{editingTemplateId ? 'Save Changes' : 'Create Template'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== KPI DIALOG ===== */}
      <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add KPI</DialogTitle><DialogDescription>Assign a KPI to an employee</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employee *</Label>
              <Select value={kpiForm.employee_id || ''} onValueChange={v => setKpiForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger data-testid="kpi-employee"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>KPI Name *</Label><Input value={kpiForm.name || ''} onChange={e => setKpiForm(p => ({ ...p, name: e.target.value }))} data-testid="kpi-name" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Target</Label><Input type="number" value={kpiForm.target_value || ''} onChange={e => setKpiForm(p => ({ ...p, target_value: Number(e.target.value) }))} /></div>
              <div><Label>Unit</Label>
                <Select value={kpiForm.unit || '%'} onValueChange={v => setKpiForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="%">%</SelectItem><SelectItem value="count">Count</SelectItem><SelectItem value="INR">INR</SelectItem><SelectItem value="avg">Avg</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Weight</Label><Input type="number" step="0.1" value={kpiForm.weight || 1} onChange={e => setKpiForm(p => ({ ...p, weight: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Calc Type</Label>
                <Select value={kpiForm.calculation_type || 'manual'} onValueChange={v => setKpiForm(p => ({ ...p, calculation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem><SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem><SelectItem value="compliance">Compliance %</SelectItem>
                    <SelectItem value="percentage">Ratio %</SelectItem><SelectItem value="inverse_sum">Inverse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label>
                <Select value={kpiForm.category || 'operational'} onValueChange={v => setKpiForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem><SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem><SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="efficiency">Efficiency</SelectItem><SelectItem value="activity">Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kpiForm.calculation_type && kpiForm.calculation_type !== 'manual' && (
              <div><Label>MIS Field Key</Label><Input value={kpiForm.mis_field_key || ''} onChange={e => setKpiForm(p => ({ ...p, mis_field_key: e.target.value }))} placeholder="e.g., payments_processed" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKpiDialog(false)}>Cancel</Button>
            <Button onClick={createKpi} disabled={!kpiForm.name || !kpiForm.employee_id} data-testid="save-kpi-btn">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== KRA DIALOG ===== */}
      <Dialog open={showKraDialog} onOpenChange={setShowKraDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add KRA</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employee *</Label>
              <Select value={kraForm.employee_id || ''} onValueChange={v => setKraForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger data-testid="kra-employee"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.is_active !== false).map(e => <SelectItem key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>KRA Name *</Label><Input value={kraForm.name || ''} onChange={e => setKraForm(p => ({ ...p, name: e.target.value }))} data-testid="kra-name" /></div>
            <div><Label>Description</Label><Textarea value={kraForm.description || ''} onChange={e => setKraForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Weight</Label><Input type="number" step="0.1" value={kraForm.weight || 1} onChange={e => setKraForm(p => ({ ...p, weight: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKraDialog(false)}>Cancel</Button>
            <Button onClick={createKra} disabled={!kraForm.name || !kraForm.employee_id} data-testid="save-kra-btn">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTab;
