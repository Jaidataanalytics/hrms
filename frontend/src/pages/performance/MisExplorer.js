import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, FileText, Calendar, Eye, BarChart3, Target, TrendingUp,
  CheckCircle2, Clock, ChevronRight, RefreshCw, Hash
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
const scoreBg = p => p >= 90 ? 'bg-emerald-50 border-emerald-200' : p >= 70 ? 'bg-blue-50 border-blue-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

const PERIODS = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'quarterly', label: 'This Quarter' },
  { value: 'half_yearly', label: 'Half Year' },
  { value: 'annual', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const MisExplorer = ({ employees, authHeaders }) => {
  const [selectedEmp, setSelectedEmp] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [kpiScores, setKpiScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const hdrs = { headers: authHeaders };

  const empName = (id) => {
    const e = employees.find(x => x.employee_id === id);
    return e ? `${e.first_name} ${e.last_name}` : id;
  };

  const fetchData = useCallback(async () => {
    if (!selectedEmp) return;
    setLoading(true);
    try {
      let entriesUrl = `${API}/mis-entries?employee_id=${selectedEmp}`;
      let summaryUrl = `${API}/mis-summary?employee_id=${selectedEmp}`;
      let kpiUrl = `${API}/kpi-scores?employee_id=${selectedEmp}`;

      if (period === 'custom' && customFrom && customTo) {
        entriesUrl += `&from_date=${customFrom}&to_date=${customTo}`;
        summaryUrl += `&period=custom&from_date=${customFrom}&to_date=${customTo}`;
      } else if (period === 'daily') {
        const today = new Date().toISOString().split('T')[0];
        entriesUrl += `&date=${today}`;
        summaryUrl += `&period=daily`;
        kpiUrl += `&period=monthly`;
      } else {
        entriesUrl += `&period=${period}`;
        summaryUrl += `&period=${period}`;
        kpiUrl += `&period=${period}`;
      }

      const [eR, sR, kR] = await Promise.all([
        fetch(entriesUrl, hdrs),
        fetch(summaryUrl, hdrs),
        fetch(kpiUrl, hdrs),
      ]);

      if (eR.ok) setEntries(await eR.json());
      if (sR.ok) setSummary(await sR.json());
      if (kR.ok) setKpiScores(await kR.json());
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedEmp, period, customFrom, customTo, authHeaders]);

  const filteredEmps = employees.filter(e =>
    e.is_active !== false && (
      !searchTerm ||
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-5" data-testid="mis-explorer">
      {/* Controls Row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <Label className="text-xs text-slate-500 mb-1 block">Employee</Label>
              <Select value={selectedEmp} onValueChange={(v) => { setSelectedEmp(v); setEntries([]); setSummary(null); setKpiScores(null); }}>
                <SelectTrigger data-testid="mis-explorer-emp-select">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-8"
                      data-testid="mis-explorer-emp-search"
                    />
                  </div>
                  {filteredEmps.map(e => (
                    <SelectItem key={e.employee_id} value={e.employee_id}>
                      {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs text-slate-500 mb-1 block">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="mis-explorer-period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {period === 'custom' && (
              <>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-500 mb-1 block">From</Label>
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} data-testid="mis-explorer-from" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-500 mb-1 block">To</Label>
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} data-testid="mis-explorer-to" />
                </div>
              </>
            )}
            <div className={period === 'custom' ? 'sm:col-span-1' : 'sm:col-span-5'}>
              <Button
                onClick={fetchData}
                disabled={!selectedEmp || loading}
                className="w-full gap-2"
                data-testid="mis-explorer-load-btn"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Load
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3" data-testid="mis-entry-count-card">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Hash className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{summary.entry_count}</p>
                <p className="text-xs text-slate-500">MIS Entries</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{summary.from_date?.slice(5) || '-'}</p>
                <p className="text-xs text-slate-500">to {summary.to_date?.slice(5) || '-'}</p>
              </div>
            </div>
          </Card>
          {kpiScores && (
            <>
              <Card className="p-3" data-testid="mis-kpi-score-card">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Target className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${scoreColor(kpiScores.weighted_score)}`}>{kpiScores.weighted_score}%</p>
                    <p className="text-xs text-slate-500">KPI Score</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">{kpiScores.scores?.length || 0}</p>
                    <p className="text-xs text-slate-500">Active KPIs</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* MIS Summary Aggregates */}
      {summary && Object.keys(summary.sums || {}).length > 0 && (
        <Card data-testid="mis-summary-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              MIS Summary — {empName(selectedEmp)}
            </CardTitle>
            <CardDescription>{summary.entry_count} entries from {summary.from_date} to {summary.to_date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(summary.sums).map(([key, total]) => (
                <div key={key} className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-slate-500 truncate capitalize">{key.replace(/_/g, ' ')}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold text-slate-900">{typeof total === 'number' ? total.toLocaleString() : total}</span>
                    <span className="text-xs text-slate-400">total</span>
                  </div>
                  {summary.averages?.[key] !== undefined && (
                    <p className="text-xs text-blue-500 mt-0.5">Avg: {summary.averages[key]}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Score Cards */}
      {kpiScores?.scores?.length > 0 && (
        <Card data-testid="mis-kpi-cards">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-600" />
              KPI Scores — {empName(selectedEmp)}
              <Badge variant="outline" className={`ml-auto ${scoreColor(kpiScores.weighted_score)}`}>
                Overall: {kpiScores.weighted_score}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {kpiScores.scores.map(s => (
                <div key={s.kpi_id} className={`p-3 rounded-lg border ${scoreBg(s.score_percentage)}`} data-testid={`kpi-card-${s.kpi_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{s.name}</span>
                    <span className={`text-sm font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                  </div>
                  <Progress value={Math.min(100, s.score_percentage)} className="h-1.5 mb-2" />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Actual: {s.actual_value} {s.unit}</span>
                    <span>Target: {s.target_value} {s.unit}</span>
                    <Badge variant="outline" className="text-[10px]">{s.source} | {s.calculation_type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MIS Entry Cards */}
      {entries.length > 0 && (
        <Card data-testid="mis-entries-list">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              MIS Entries ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {entries.map(entry => (
                <div
                  key={entry.entry_id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => setViewEntry(entry)}
                  data-testid={`mis-entry-${entry.entry_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700 leading-none">{entry.date?.slice(8)}</span>
                      <span className="text-[9px] text-blue-500 leading-none">
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{entry.date}</p>
                      <p className="text-xs text-slate-500">
                        {Object.keys(entry.fields || {}).length} fields |
                        {entry.status === 'verified' ? ' Verified' : entry.status === 'submitted' ? ' Submitted' : ` ${entry.status}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        entry.status === 'verified' ? 'text-emerald-600 border-emerald-300' :
                        entry.status === 'submitted' ? 'text-blue-600 border-blue-300' :
                        'text-amber-600 border-amber-300'
                      }`}
                    >
                      {entry.status === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {entry.status === 'submitted' && <Clock className="w-3 h-3 mr-1" />}
                      {entry.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedEmp && !loading && entries.length === 0 && summary && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No MIS entries found for this employee in the selected period</p>
          </CardContent>
        </Card>
      )}

      {/* MIS Entry Detail Dialog */}
      <Dialog open={!!viewEntry} onOpenChange={() => setViewEntry(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="mis-entry-detail-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              MIS Entry — {viewEntry?.date}
            </DialogTitle>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{empName(viewEntry.employee_id)}</p>
                  <p className="text-xs text-slate-500">Entry ID: {viewEntry.entry_id}</p>
                </div>
                <Badge
                  className={`ml-auto ${
                    viewEntry.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                    viewEntry.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}
                >
                  {viewEntry.status}
                </Badge>
              </div>
              <div className="space-y-2">
                {Object.entries(viewEntry.fields || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
                    <span className="text-sm text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
              {viewEntry.verified_by_name && (
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                  <p className="text-emerald-700">Verified by <strong>{viewEntry.verified_by_name}</strong> on {viewEntry.verified_at?.slice(0, 10)}</p>
                  {viewEntry.manager_remarks && <p className="text-emerald-600 mt-1">Remarks: {viewEntry.manager_remarks}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MisExplorer;
