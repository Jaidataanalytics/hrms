import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Target, Award, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const scoreColor = p => p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
const scoreBg = p => p >= 90 ? 'bg-emerald-50 border-emerald-200' : p >= 70 ? 'bg-blue-50 border-blue-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

const OverviewTab = ({ kpiScores, kraDefs, evaluations, period }) => {
  return (
    <div className="grid gap-6" data-testid="overview-tab">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">KPI Score</p>
            <p className={`text-2xl font-bold mt-1 ${scoreColor(kpiScores?.weighted_score || 0)}`}>{kpiScores?.weighted_score || 0}%</p>
            <p className="text-xs text-slate-400">{kpiScores?.scores?.length || 0} KPIs tracked</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">MIS Entries</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{kpiScores?.entry_count || 0}</p>
            <p className="text-xs text-slate-400">This {period}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">KRAs</p>
            <p className="text-2xl font-bold mt-1 text-purple-600">{kraDefs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Evaluations</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{evaluations.length}</p>
          </CardContent>
        </Card>
      </div>

      {kpiScores?.scores?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />My KPI Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpiScores.scores.map(s => (
                <div key={s.kpi_id} className={`p-3 rounded-lg border ${scoreBg(s.score_percentage)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        Target: {s.target_value}{s.unit === '%' ? '%' : ` ${s.unit}`} | Actual: {s.actual_value} | {s.source === 'manual' ? 'Manual' : 'Auto'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-lg font-bold ${scoreColor(s.score_percentage)}`}>{s.score_percentage}%</span>
                      {s.score_percentage >= 90 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : s.score_percentage >= 50 ? <Minus className="w-4 h-4 text-amber-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  <Progress value={Math.min(100, s.score_percentage)} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {kraDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />My KRAs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {kraDefs.map(k => (
                <div key={k.kra_id} className="p-3 bg-slate-50 rounded-lg border">
                  <p className="font-medium text-sm">{k.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{k.description}</p>
                  <Badge className="mt-1 text-xs">Weight: {k.weight}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OverviewTab;
