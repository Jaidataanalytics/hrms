import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Settings,
  RefreshCw,
  Play,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Link2,
  Unlink,
  Activity,
  Database,
  Wifi,
  WifiOff,
  Calendar,
  Download,
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  History,
  Zap
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const APIManagerPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  
  // Sync status
  const [syncStatus, setSyncStatus] = useState(null);
  const [unmatchedCodes, setUnmatchedCodes] = useState([]);
  
  // Mappings
  const [mappings, setMappings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({ biometric_code: '', employee_id: '' });
  
  // Sync settings
  const [syncSettings, setSyncSettings] = useState({
    syncFrequency: '3', // hours
    lateThreshold: '09:45',
    autoSyncEnabled: true
  });
  
  // Manual sync options
  const [manualSyncDays, setManualSyncDays] = useState('7');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const isAuthorized = user?.role === 'super_admin' || user?.role === 'hr_admin';

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [statusRes, unmatchedRes, employeesRes] = await Promise.all([
        fetch(`${API_URL}/biometric/sync/status`, { credentials: 'include', headers }),
        fetch(`${API_URL}/biometric/sync/unmatched-codes`, { credentials: 'include', headers }),
        fetch(`${API_URL}/employees`, { credentials: 'include', headers })
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setSyncStatus(data);
      }

      if (unmatchedRes.ok) {
        const data = await unmatchedRes.json();
        setUnmatchedCodes(data.unmatched_codes || []);
      }

      if (employeesRes.ok) {
        const data = await employeesRes.json();
        setEmployees(data);
      }

      // Load existing mappings from employees
      await loadMappings();
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load API status');
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/employees`, { credentials: 'include', headers });
      if (response.ok) {
        const data = await response.json();
        // Create mapping list from employees with biometric codes
        const mappingList = data
          .filter(emp => emp.emp_code)
          .map(emp => ({
            biometric_code: emp.emp_code,
            employee_id: emp.employee_id,
            employee_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            department: emp.department || ''
          }));
        setMappings(mappingList);
      }
    } catch (error) {
      console.error('Error loading mappings:', error);
    }
  };

  const handleManualSync = async (type) => {
    setSyncing(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      let endpoint = `${API_URL}/biometric/sync`;
      let body = {};

      if (type === 'recent') {
        // Sync last N days
        const days = parseInt(manualSyncDays);
        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        body = { from_date: fromDate, to_date: toDate };
      } else if (type === 'custom') {
        if (!customFromDate || !customToDate) {
          toast.error('Please select both from and to dates');
          setSyncing(false);
          return;
        }
        body = { from_date: customFromDate, to_date: customToDate };
      } else if (type === 'historical') {
        endpoint = `${API_URL}/biometric/sync/historical`;
        body = { days: 365 };
      } else if (type === 'refresh') {
        endpoint = `${API_URL}/biometric/sync/refresh-all`;
        body = { days: 365 };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Sync completed! ${result.stats?.updated || result.sync_result?.stats?.updated || 0} records updated`);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleRecalculateLate = async () => {
    setSyncing(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      const response = await fetch(`${API_URL}/biometric/sync/recalculate-late`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Recalculated late status for ${result.updated} records`);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Recalculation failed');
      }
    } catch (error) {
      toast.error('Failed to recalculate late status');
    } finally {
      setSyncing(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-slate-500">Only Admin and HR users can manage API integrations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            API Manager
          </h1>
          <p className="text-slate-600 mt-1">
            Manage biometric API sync, mappings, and settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {syncStatus?.last_sync_stats?.matched || 0}
                </p>
                <p className="text-xs text-slate-500">Last Sync Matched</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {unmatchedCodes.length}
                </p>
                <p className="text-xs text-slate-500">Unmatched Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{mappings.length}</p>
                <p className="text-xs text-slate-500">Mapped Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {formatDateTime(syncStatus?.last_sync).split(',')[0]}
                </p>
                <p className="text-xs text-slate-500">Last Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="status" className="gap-2">
            <Activity className="w-4 h-4" />
            Sync Status
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Zap className="w-4 h-4" />
            Manual Sync
          </TabsTrigger>
          <TabsTrigger value="mappings" className="gap-2">
            <Link2 className="w-4 h-4" />
            Code Mappings
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Unmatched ({unmatchedCodes.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="w-4 h-4" />
            Sync Logs
          </TabsTrigger>
        </TabsList>

        {/* Sync Status Tab */}
        <TabsContent value="status">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-emerald-500" />
                  API Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="font-medium">Biometric API</span>
                  <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
                </div>
                <div className="text-sm text-slate-600 space-y-2">
                  <p><strong>API URL:</strong> http://115.245.227.203:81</p>
                  <p><strong>Sync Frequency:</strong> Every 3 hours</p>
                  <p><strong>Late Threshold:</strong> 09:45 AM</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  Last Sync Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncStatus?.last_sync_stats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between p-2 bg-slate-50 rounded">
                      <span>Total Records</span>
                      <span className="font-bold">{syncStatus.last_sync_stats.total || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-emerald-50 rounded">
                      <span>Matched</span>
                      <span className="font-bold text-emerald-600">{syncStatus.last_sync_stats.matched || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>Updated</span>
                      <span className="font-bold text-blue-600">{syncStatus.last_sync_stats.updated || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-amber-50 rounded">
                      <span>Unmatched</span>
                      <span className="font-bold text-amber-600">{syncStatus.last_sync_stats.unmatched || 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">No sync data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Manual Sync Tab */}
        <TabsContent value="sync">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Sync Options</CardTitle>
                <CardDescription>Run a manual sync for specific time periods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Sync Recent Days</Label>
                  <div className="flex gap-2">
                    <Select value={manualSyncDays} onValueChange={setManualSyncDays}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Day</SelectItem>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="14">14 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="60">60 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleManualSync('recent')} disabled={syncing} className="flex-1">
                      {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      Sync Now
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <Label>Custom Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-500">From</Label>
                      <Input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">To</Label>
                      <Input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={() => handleManualSync('custom')} disabled={syncing} variant="outline" className="w-full">
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                    Sync Custom Range
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Actions</CardTitle>
                <CardDescription>Use these for troubleshooting or full resyncs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <History className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Historical Sync (1 Year)</p>
                      <p className="text-sm text-slate-600">Sync all attendance data from the past year</p>
                    </div>
                  </div>
                  <Button onClick={() => handleManualSync('historical')} disabled={syncing} variant="outline" className="w-full">
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Run Historical Sync
                  </Button>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Full Refresh</p>
                      <p className="text-sm text-slate-600">Delete all synced data and re-sync from scratch</p>
                    </div>
                  </div>
                  <Button onClick={() => handleManualSync('refresh')} disabled={syncing} variant="outline" className="w-full border-amber-300 hover:bg-amber-100">
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Full Refresh (1 Year)
                  </Button>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Recalculate Late Status</p>
                      <p className="text-sm text-slate-600">Re-apply 09:45 late threshold to all records</p>
                    </div>
                  </div>
                  <Button onClick={handleRecalculateLate} disabled={syncing} variant="outline" className="w-full border-purple-300 hover:bg-purple-100">
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                    Recalculate Late
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Code Mappings Tab */}
        <TabsContent value="mappings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Employee Code Mappings</CardTitle>
                  <CardDescription>Biometric device codes mapped to employees (via emp_code field)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Biometric Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.length > 0 ? (
                      mappings.map((mapping) => (
                        <TableRow key={mapping.biometric_code}>
                          <TableCell className="font-mono font-medium">{mapping.biometric_code}</TableCell>
                          <TableCell>{mapping.employee_name}</TableCell>
                          <TableCell>{mapping.department || '-'}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <Link2 className="w-3 h-3 mr-1" />
                              Mapped
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                          No mappings found. Employee codes (emp_code) are used for mapping.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                <strong>Note:</strong> Mapping is done via the employee's <code className="bg-slate-100 px-1 rounded">emp_code</code> field. 
                To add a new mapping, update the employee's code to match their biometric device ID.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unmatched Codes Tab */}
        <TabsContent value="unmatched">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Unmatched Employee Codes
                  </CardTitle>
                  <CardDescription>
                    These codes exist in the biometric system but have no matching employee in the database
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {unmatchedCodes.length} Unmatched
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {unmatchedCodes.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {unmatchedCodes.map((code) => (
                      <div key={code} className="p-2 bg-amber-50 rounded border border-amber-200 text-center">
                        <span className="font-mono text-sm font-medium text-amber-800">{code}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium mb-2">How to fix:</h4>
                    <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                      <li>Go to <strong>Employees</strong> page</li>
                      <li>Find or create the employee</li>
                      <li>Set their <strong>Employee Code</strong> to match the biometric code (e.g., F0001, S0019)</li>
                      <li>Run a sync to update attendance records</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-500">All biometric codes are mapped!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Sync Logs</CardTitle>
              <CardDescription>History of sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {syncStatus?.recent_logs?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Time</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Matched</TableHead>
                        <TableHead className="text-center">Updated</TableHead>
                        <TableHead className="text-center">Unmatched</TableHead>
                        <TableHead className="text-center">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncStatus.recent_logs.map((log, idx) => (
                        <TableRow key={log.sync_id || idx}>
                          <TableCell className="text-sm">
                            {formatDateTime(log.synced_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.from_date} to {log.to_date}
                          </TableCell>
                          <TableCell className="text-center">{log.total_records}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-700">{log.matched}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700">{log.updated}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-amber-100 text-amber-700">{log.unmatched}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {log.errors > 0 ? (
                              <Badge variant="destructive">{log.errors}</Badge>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No sync logs available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default APIManagerPage;
