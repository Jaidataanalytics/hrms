import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RefreshCw } from 'lucide-react';

import OverviewTab from './performance/OverviewTab';
import MisEntryTab from './performance/MisEntryTab';
import KpiTab from './performance/KpiTab';
import EvaluationsTab from './performance/EvaluationsTab';
import AdminTab from './performance/AdminTab';
import ManagerTab from './performance/ManagerTab';
import CompanyDashboard from './performance/CompanyDashboard';
import InsightsTab from './performance/InsightsTab';

const API = process.env.REACT_APP_BACKEND_URL + '/api/performance';
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
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';
  const authHeaders = getAuthHeaders();

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [employees, setEmployees] = useState([]);
  const [myTemplate, setMyTemplate] = useState(null);
  const [kpiScores, setKpiScores] = useState(null);
  const [kraDefs, setKraDefs] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [hasTeam, setHasTeam] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const hdrs = { credentials: 'include', headers: authHeaders };

      // Fetch employees list
      const eR = await fetch(`${API_URL}/employees`, hdrs);
      if (eR.ok) { const d = await eR.json(); setEmployees(Array.isArray(d) ? d : d.employees || []); }

      // My MIS template
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

      // Check if user has a team (for manager tab)
      const teamR = await fetch(`${API}/my-team`, hdrs);
      if (teamR.ok) { const team = await teamR.json(); setHasTeam(team.length > 0); }

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, user?.employee_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine visible tabs
  const showManager = hasTeam;
  const showAdmin = isHR;
  const showCompany = isHR;
  const tabCount = 4 + (showManager ? 1 : 0) + (showAdmin ? 1 : 0) + (showCompany ? 1 : 0);

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
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="mis-entry" data-testid="tab-mis-entry">My MIS</TabsTrigger>
          <TabsTrigger value="kpi" data-testid="tab-kpi">My KPIs</TabsTrigger>
          <TabsTrigger value="evaluations" data-testid="tab-evaluations">Evaluations</TabsTrigger>
          {showManager && <TabsTrigger value="manager" data-testid="tab-manager">Team Review</TabsTrigger>}
          {showAdmin && <TabsTrigger value="admin" data-testid="tab-admin">Admin</TabsTrigger>}
          {showCompany && <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>}
          {showAdmin && <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab kpiScores={kpiScores} kraDefs={kraDefs} evaluations={evaluations} period={period} />
        </TabsContent>

        <TabsContent value="mis-entry">
          <MisEntryTab user={user} myTemplate={myTemplate} authHeaders={authHeaders} isHR={isHR} />
        </TabsContent>

        <TabsContent value="kpi">
          <KpiTab kpiScores={kpiScores} period={period} isHR={isHR} />
        </TabsContent>

        <TabsContent value="evaluations">
          <EvaluationsTab user={user} evaluations={evaluations} employees={employees} isHR={isHR} authHeaders={authHeaders} onRefresh={fetchAll} />
        </TabsContent>

        {showManager && (
          <TabsContent value="manager">
            <ManagerTab authHeaders={authHeaders} />
          </TabsContent>
        )}

        {showAdmin && (
          <TabsContent value="admin">
            <AdminTab employees={employees} authHeaders={authHeaders} period={period} />
          </TabsContent>
        )}

        {showCompany && (
          <TabsContent value="company">
            <CompanyDashboard period={period} authHeaders={authHeaders} />
          </TabsContent>
        )}

        {showAdmin && (
          <TabsContent value="insights">
            <InsightsTab period={period} authHeaders={authHeaders} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PerformancePage;
