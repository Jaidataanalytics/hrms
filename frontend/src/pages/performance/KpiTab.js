import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Target } from 'lucide-react';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' }, { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
];

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';

const KpiTab = ({ kpiScores, period, isHR }) => {
  if (!kpiScores?.scores?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400" data-testid="kpi-empty">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No KPIs assigned yet. {isHR ? 'Assign via the Admin tab.' : 'Contact HR.'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6" data-testid="kpi-tab">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            My KPI Scores — {PERIODS.find(p => p.value === period)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-sm text-slate-500">Weighted Score</p>
            <p className={`text-4xl font-bold ${scoreColor(kpiScores.weighted_score)}`}>{kpiScores.weighted_score}%</p>
            <p className="text-xs text-slate-400 mt-1">Based on {kpiScores.entry_count} MIS entries</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpiScores.scores.map(s => (
                <TableRow key={s.kpi_id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{s.category}</Badge></TableCell>
                  <TableCell>{s.target_value} {s.unit}</TableCell>
                  <TableCell>{s.actual_value}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                      <Progress value={Math.min(100, s.score_percentage)} className="h-1.5 w-16" />
                    </div>
                  </TableCell>
                  <TableCell>{s.weight}x</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.source === 'auto' ? 'Auto (MIS)' : 'Manual'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpiTab;
