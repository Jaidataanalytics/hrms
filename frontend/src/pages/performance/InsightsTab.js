import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  BarChart3, AlertTriangle, CheckCircle2, XCircle, Users, Target,
  Award, TrendingUp, Shield, RefreshCw, Activity, Zap
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const severityStyle = s => s === 'high' ? 'bg-red-50 border-red-200 text-red-800' : s === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800';

const InsightsTab = ({ period, authHeaders }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/insights?period=${period}`, { headers: authHeaders });
      if (r.ok) setData(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, authHeaders]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return null;

  const { summary, department_health, compliance_heatmap, red_flags, executive_kra_tracker, employee_rankings } = data;

  return (
    <div className="grid gap-6" data-testid="insights-tab">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Employees</p>
            <p className="text-xl font-bold text-blue-600">{summary.total_employees}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total KPIs</p>
            <p className="text-xl font-bold text-emerald-600">{summary.total_kpis}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Auto KPIs</p>
            <p className="text-xl font-bold text-purple-600">{summary.auto_pct}%</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">MIS Entries</p>
            <p className="text-xl font-bold text-cyan-600">{summary.total_entries}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Departments</p>
            <p className="text-xl font-bold text-amber-600">{summary.total_departments}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Red Flags</p>
            <p className="text-xl font-bold text-red-600">{red_flags.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Manual KPIs</p>
            <p className="text-xl font-bold text-green-600">{summary.manual_kpis}</p>
          </CardContent>
        </Card>
      </div>

      {/* Red Flag Alerts */}
      {red_flags.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />Red Flag Alerts ({red_flags.length})
            </CardTitle>
            <CardDescription>Issues requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {red_flags.map((rf, i) => (
                <div key={`rf-${i}`} className={`p-3 rounded-lg border ${severityStyle(rf.severity)}`} data-testid={`red-flag-${i}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rf.severity === 'high' ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                      <span className="font-medium text-sm">{rf.employee_name}</span>
                    </div>
                    <Badge className={rf.severity === 'high' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'}>{rf.severity}</Badge>
                  </div>
                  <p className="text-sm mt-1 ml-6">{rf.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />Department Health Overview
          </CardTitle>
          <CardDescription>KPI coverage and MIS activity by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {department_health.map(dept => {
              const empWithEntries = dept.employees.filter(e => e.entry_count > 0).length;
              const compliancePct = dept.employees.length > 0 ? Math.round(empWithEntries / dept.employees.length * 100) : 0;
              return (
                <div key={dept.name} className="p-4 bg-slate-50 rounded-lg border" data-testid={`dept-health-${dept.name}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{dept.name}</p>
                      <p className="text-xs text-slate-500">{dept.employees.length} employees | {dept.total_kpis} KPIs | {dept.total_entries} entries</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${compliancePct >= 80 ? 'text-emerald-600' : compliancePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{compliancePct}%</p>
                      <p className="text-[10px] text-slate-400">MIS Active</p>
                    </div>
                  </div>
                  <Progress value={compliancePct} className="h-2 mb-2" />
                  <div className="flex flex-wrap gap-1.5">
                    {dept.employees.map(e => (
                      <Badge key={e.employee_id} variant="outline" className={`text-[10px] ${e.entry_count > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {e.name.split(' ')[0]} ({e.entry_count})
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* MIS Compliance Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />MIS Compliance Heatmap (Last 14 Days)
          </CardTitle>
          <CardDescription>Daily MIS submission status — green = submitted, red = missing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium text-slate-500 sticky left-0 bg-white min-w-[120px]">Employee</th>
                  {compliance_heatmap.map(d => (
                    <th key={d.date} className="p-1.5 font-medium text-slate-400 text-center min-w-[32px]">
                      {d.date.split('-')[2]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compliance_heatmap[0]?.employees?.map(emp => (
                  <tr key={emp.employee_id}>
                    <td className="p-1.5 font-medium text-slate-700 sticky left-0 bg-white truncate max-w-[120px]">{emp.name.split(' ').slice(0, 2).join(' ')}</td>
                    {compliance_heatmap.map(d => {
                      const dayEmp = d.employees.find(e => e.employee_id === emp.employee_id);
                      const submitted = dayEmp?.submitted;
                      const isWeekend = new Date(d.date).getDay() === 0;
                      return (
                        <td key={d.date} className="p-0.5 text-center">
                          <div className={`w-6 h-6 rounded-sm mx-auto ${isWeekend ? 'bg-slate-100' : submitted ? 'bg-emerald-400' : 'bg-red-300'}`}
                            title={`${dayEmp?.name || ''} - ${d.date}: ${submitted ? 'Submitted' : isWeekend ? 'Weekend' : 'Missing'}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Executive KRA Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />Executive KRA Tracker
          </CardTitle>
          <CardDescription>Senior executive Key Result Areas with targets and progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {executive_kra_tracker.map(exec => (
              <div key={exec.name} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-lg border hover:shadow-md transition-shadow" data-testid={`exec-kra-${exec.name}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-slate-900">{exec.name}</p>
                  <Badge variant="outline" className="text-[10px]">{exec.kras.length} KRAs</Badge>
                </div>
                <div className="space-y-2">
                  {exec.kras.map((kra, i) => (
                    <div key={`insight-${i}`} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 text-xs">{kra.name} <span className="text-slate-400 font-normal">W:{kra.weight}x</span></p>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{kra.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Rankings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />Employee Performance Rankings
          </CardTitle>
          <CardDescription>Ranked by MIS engagement and KPI coverage</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>KPIs</TableHead>
                <TableHead>MIS Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee_rankings.map((emp, i) => (
                <TableRow key={emp.employee_id} data-testid={`rank-row-${i}`}>
                  <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell><span className="text-xs text-slate-500">{emp.role || '-'}</span></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{emp.department}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{emp.frequency}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-sm font-medium">{emp.kpi_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={emp.mis_entries > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                      {emp.mis_entries}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KPI Automation Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />KPI Automation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
              <p className="text-3xl font-bold text-emerald-700">{summary.auto_kpis}</p>
              <p className="text-xs text-emerald-600 mt-1">Auto-Calculated</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
              <p className="text-3xl font-bold text-amber-700">{summary.manual_kpis}</p>
              <p className="text-xs text-amber-600 mt-1">Manual Entry</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-3xl font-bold text-blue-700">{summary.auto_pct}%</p>
              <p className="text-xs text-blue-600 mt-1">Automation Rate</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            {summary.auto_pct >= 90 ? 'Excellent automation coverage. Only manual KPIs remain where external data is required.' :
             summary.auto_pct >= 70 ? 'Good automation. Consider converting remaining manual KPIs.' :
             'Low automation. Review MIS fields to enable auto-calculation.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsTab;
