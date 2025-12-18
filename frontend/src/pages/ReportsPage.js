import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import {
  BarChart3,
  Users,
  Calendar,
  IndianRupee,
  FileText,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  Building2,
  MapPin
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ReportsPage = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [headcount, setHeadcount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, headcountRes, deptRes, locRes] = await Promise.all([
        fetch(`${API_URL}/reports/summary`, { credentials: 'include' }),
        fetch(`${API_URL}/reports/headcount`, { credentials: 'include' }),
        fetch(`${API_URL}/departments`, { credentials: 'include' }),
        fetch(`${API_URL}/locations`, { credentials: 'include' })
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (headcountRes.ok) setHeadcount(await headcountRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (locRes.ok) setLocations(await locRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeptName = (id) => departments.find(d => d.department_id === id)?.name || id || 'Unknown';
  const getLocName = (id) => locations.find(l => l.location_id === id)?.name || id || 'Unknown';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (!isHR) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-600">You don't have permission to access reports</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Reports & Analytics
          </h1>
          <p className="text-slate-600 mt-1">HR dashboards and insights</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.employees?.total_active || 0}</p>
                <p className="text-xs text-slate-500">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.employees?.present_today || 0}</p>
                <p className="text-xs text-slate-500">Present Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.leave?.pending_requests || 0}</p>
                <p className="text-xs text-slate-500">Pending Leaves</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.grievances?.open_tickets || 0}</p>
                <p className="text-xs text-slate-500">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="headcount" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="headcount" className="gap-2">
            <Users className="w-4 h-4" />
            Headcount
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <IndianRupee className="w-4 h-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        {/* Headcount Tab */}
        <TabsContent value="headcount">
          <div className="grid gap-4 md:grid-cols-2">
            {/* By Department */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  By Department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {headcount?.by_department?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{getDeptName(item._id)}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(item.count / (headcount?.total_active || 1)) * 100} className="w-24 h-2" />
                        <span className="text-sm font-medium w-8">{item.count}</span>
                      </div>
                    </div>
                  ))}
                  {(!headcount?.by_department || headcount.by_department.length === 0) && (
                    <p className="text-sm text-slate-500 text-center py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* By Location */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  By Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {headcount?.by_location?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{getLocName(item._id)}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(item.count / (headcount?.total_active || 1)) * 100} className="w-24 h-2" />
                        <span className="text-sm font-medium w-8">{item.count}</span>
                      </div>
                    </div>
                  ))}
                  {(!headcount?.by_location || headcount.by_location.length === 0) && (
                    <p className="text-sm text-slate-500 text-center py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Expense Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm text-slate-600">Pending Claims</span>
                    <span className="font-semibold">{formatCurrency(summary?.expenses?.pending_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Claims to Process</span>
                    <span className="font-semibold">{summary?.expenses?.pending_claims || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Assets Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-slate-600">Total Assets</span>
                    <span className="font-semibold">{summary?.assets?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-slate-600">Available</span>
                    <span className="font-semibold">{summary?.assets?.available || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Asset Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{summary?.assets?.total || 0}</p>
                  <p className="text-xs text-slate-500">Total Assets</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-600">{summary?.assets?.available || 0}</p>
                  <p className="text-xs text-slate-500">Available</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{(summary?.assets?.total || 0) - (summary?.assets?.available || 0)}</p>
                  <p className="text-xs text-slate-500">Assigned</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600">0</p>
                  <p className="text-xs text-slate-500">Maintenance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
