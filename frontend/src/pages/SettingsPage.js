import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  User,
  Mail,
  Shield,
  Bell,
  Palette,
  Key,
  Building2
} from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
      </Tabs>
    </div>
  );
};

export default SettingsPage;
