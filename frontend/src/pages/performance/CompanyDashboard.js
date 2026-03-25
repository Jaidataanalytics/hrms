import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Users, Building2, AlertTriangle, Award, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';

const EXECS = [
  { name: 'Nandini Kumari', role: 'HR Head', focus: 'People & Compliance', id: 'EMPC6B9A606' },
  { name: 'Anup Kr Mishra', role: 'Accounts Head', focus: 'Financial Accuracy', id: 'EMP8B9486DD' },
  { name: 'Manoj Kumar', role: 'Sales Head', focus: 'Revenue Growth', id: 'EMP8B117F26' },
  { name: 'Umesh Chandra Prasad', role: 'Audit Head', focus: 'Compliance & Risk', id: 'EMP484529A4' },
  { name: 'KN Sinha', role: 'Production Head', focus: 'Operational Efficiency', id: 'EMP5618F5FF' },
];

const CompanyDashboard = ({ period, authHeaders }) => {
  const [dashboard, setDashboard] = useState(null);
  const [crossV, setCrossV] = useState(null);
  const hdrs = { headers: authHeaders };

  useEffect(() => {
    (async () => {
      const [dR, cR] = await Promise.all([
        fetch(`${API}/company-dashboard?period=${period}`, hdrs),
        fetch(`${API}/cross-verification?period=${period}`, hdrs),
      ]);
      if (dR.ok) setDashboard(await dR.json());
      if (cR.ok) setCrossV(await cR.json());
    })();
  }, [period]);

  if (!dashboard) return <div className="flex items-center justify-center h-48"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid gap-6" data-testid="company-tab">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase">Employees</p>
            <p className="text-2xl font-bold text-blue-600">{dashboard.total_employees}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase">MIS Assigned</p>
            <p className="text-2xl font-bold text-emerald-600">{dashboard.total_templates_assigned}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase">MIS Entries</p>
            <p className="text-2xl font-bold text-purple-600">{dashboard.total_mis_entries}</p>
            <p className="text-xs text-slate-400">This {period}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase">Departments</p>
            <p className="text-2xl font-bold text-amber-600">{dashboard.department_summaries?.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Senior Executives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />Senior Executive KRAs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXECS.map(exec => (
              <div key={exec.id} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{exec.name}</p>
                    <p className="text-sm text-primary font-medium">{exec.role}</p>
                  </div>
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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />Cross-Department Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crossV.checks.map((c, i) => (
                <div key={i} className={`p-3 rounded-lg border ${c.status === 'matched' ? 'bg-emerald-50 border-emerald-200' : c.status === 'mismatch' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.description}</p>
                    </div>
                    <Badge className={c.status === 'matched' ? 'bg-emerald-100 text-emerald-800' : c.status === 'mismatch' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                      {c.match_percentage}% match
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Source A: {c.value_a}</span>
                    <span>Source B: {c.value_b}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />Department Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>MIS Assigned</TableHead>
                <TableHead>Entries</TableHead>
              </TableRow>
            </TableHeader>
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

export default CompanyDashboard;
