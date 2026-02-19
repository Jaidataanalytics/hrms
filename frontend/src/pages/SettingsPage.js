import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Shield,
  Bell,
  Palette,
  Key,
  Building2,
  RefreshCw,
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SettingsPage = () => {
  const { user, getAuthHeaders } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncCredentials, setSyncCredentials] = useState({
    email: 'admin@shardamotor.com',
    password: 'admin123'
  });

  // Load sync status on mount (for admin)
  useEffect(() => {
    if (isAdmin) {
      loadSyncStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data-management/sync/status`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (err) {
      // ignore
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_admin';

  const handleSyncFromDeployed = async () => {
    setSyncing(true);
    setSyncResults(null);
    
    try {
      const response = await fetch(`${API_URL}/api/data-management/sync/from-deployed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(syncCredentials)
      });
      
      const data = await response.json();
      setSyncResults(data);
      
      if (data.success) {
        toast.success('Data synced successfully from deployed environment');
      } else if (data.synced_collections && Object.keys(data.synced_collections).length > 0) {
        toast.warning('Partial sync completed with some errors');
      } else {
        toast.error('Sync failed: ' + (data.errors?.[0] || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
      setSyncResults({ success: false, errors: [error.message] });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAttendanceOnly = async () => {
    setSyncing(true);
    setSyncResults(null);
    
    try {
      const response = await fetch(`${API_URL}/api/data-management/sync/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...syncCredentials,
          month: 1,
          year: 2026
        })
      });
      
      const data = await response.json();
      setSyncResults(data);
      
      if (data.success) {
        toast.success(`Synced ${data.attendance_imported} attendance records`);
      } else {
        toast.error('Sync failed: ' + (data.errors?.[0] || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
      setSyncResults({ success: false, errors: [error.message] });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Settings
        </h1>
        <p className="text-slate-600 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="devtools" className="gap-2" data-testid="tab-devtools">
              <Database className="w-4 h-4" />
              Dev Tools
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6">
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback className="bg-primary text-white text-xl">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">Change Photo</Button>
                    <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF. Max 2MB</p>
                  </div>
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input defaultValue={user?.name} data-testid="input-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input defaultValue={user?.email} disabled data-testid="input-email" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button data-testid="save-profile-btn">Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            {/* Role & Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Shield className="w-5 h-5 text-primary" />
                  Role & Permissions
                </CardTitle>
                <CardDescription>Your access level in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 mb-1">Current Role</p>
                    <Badge className="text-sm capitalize">
                      {user?.role?.replace('_', ' ')}
                    </Badge>
                  </div>
                  {user?.employee_id && (
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-1">Employee ID</p>
                      <p className="font-mono text-sm">{user.employee_id}</p>
                    </div>
                  )}
                  {user?.department_id && (
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-1">Department</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{user.department_id}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-6">
            {/* Password */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Key className="w-5 h-5 text-primary" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-current-password" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" placeholder="••••••••" data-testid="input-new-password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input type="password" placeholder="••••••••" data-testid="input-confirm-password" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" data-testid="update-password-btn">Update Password</Button>
                </div>
              </CardContent>
            </Card>

            {/* Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Active Session
                </CardTitle>
                <CardDescription>Your current login session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Current Session</p>
                      <p className="text-sm text-slate-500">Browser • Active now</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Active
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Only one session can be active at a time for security.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Bell className="w-5 h-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Leave Requests</p>
                    <p className="text-sm text-slate-500">Get notified about leave approvals and rejections</p>
                  </div>
                  <Badge>Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Attendance Alerts</p>
                    <p className="text-sm text-slate-500">Notifications for missed punches and anomalies</p>
                  </div>
                  <Badge>Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Announcements</p>
                    <p className="text-sm text-slate-500">Company-wide announcements and updates</p>
                  </div>
                  <Badge>Enabled</Badge>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                All notifications are in-app only. Email notifications are not available.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dev Tools Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="devtools">
            <div className="grid gap-6">
              {/* Sync from Deployed */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <Cloud className="w-5 h-5 text-primary" />
                    Sync from Deployed Environment
                  </CardTitle>
                  <CardDescription>
                    Pull data from the production/deployed environment to this preview instance.
                    Useful for testing payroll calculations with real data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">Warning</p>
                        <p className="text-sm text-amber-700">
                          This will replace local preview data with data from the deployed environment.
                          The deployed database will NOT be affected.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sync-email">Deployed Admin Email</Label>
                      <Input
                        id="sync-email"
                        type="email"
                        value={syncCredentials.email}
                        onChange={(e) => setSyncCredentials(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="admin@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sync-password">Deployed Admin Password</Label>
                      <Input
                        id="sync-password"
                        type="password"
                        value={syncCredentials.password}
                        onChange={(e) => setSyncCredentials(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      onClick={handleSyncFromDeployed}
                      disabled={syncing}
                      className="gap-2"
                      data-testid="sync-all-btn"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Sync All Data
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={handleSyncAttendanceOnly}
                      disabled={syncing}
                      className="gap-2"
                      data-testid="sync-attendance-btn"
                    >
                      {syncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      Sync Attendance Only (Jan 2026)
                    </Button>
                  </div>

                  {/* Sync Results */}
                  {syncResults && (
                    <div className={`rounded-lg p-4 ${
                      syncResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {syncResults.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${syncResults.success ? 'text-green-800' : 'text-red-800'}`}>
                            {syncResults.success ? 'Sync Completed' : 'Sync Completed with Issues'}
                          </p>
                          
                          {/* Show imported counts */}
                          {syncResults.synced_collections && Object.keys(syncResults.synced_collections).length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-slate-700 font-medium">Imported:</p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(syncResults.synced_collections).map(([key, value]) => (
                                  <div key={key} className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                    <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className="font-medium">{value.imported || 0}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Quick counts for attendance-only sync */}
                          {syncResults.attendance_imported !== undefined && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                <span>Employees</span>
                                <span className="font-medium">{syncResults.employees_imported || 0}</span>
                              </div>
                              <div className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                <span>Attendance</span>
                                <span className="font-medium">{syncResults.attendance_imported || 0}</span>
                              </div>
                              <div className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                <span>Salaries</span>
                                <span className="font-medium">{syncResults.salaries_imported || 0}</span>
                              </div>
                              <div className="flex justify-between bg-white/50 px-2 py-1 rounded">
                                <span>Holidays</span>
                                <span className="font-medium">{syncResults.holidays_imported || 0}</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Show errors */}
                          {syncResults.errors && syncResults.errors.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm text-red-700 font-medium">Errors:</p>
                              <ul className="text-sm text-red-600 list-disc list-inside">
                                {syncResults.errors.map((err, idx) => (
                                  <li key={idx}>{err}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {syncResults.synced_at && (
                            <p className="text-xs text-slate-500 mt-2">
                              Synced at: {new Date(syncResults.synced_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Environment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <Database className="w-5 h-5 text-primary" />
                    Environment Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500">Current Environment</p>
                      <p className="font-medium text-slate-900">Preview</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500">API URL</p>
                      <p className="font-medium text-slate-900 text-xs break-all">{API_URL}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg col-span-2">
                      <p className="text-slate-500">Deployed URL (Source)</p>
                      <p className="font-medium text-slate-900 text-xs">https://hr-calc-resolver.emergentagent.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
