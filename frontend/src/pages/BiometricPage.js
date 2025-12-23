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
  Fingerprint,
  Plus,
  RefreshCw,
  Settings,
  Link2,
  Unlink,
  Activity,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  Loader2,
  Trash2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const BiometricPage = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [unmatchedLogs, setUnmatchedLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Form states
  const [deviceForm, setDeviceForm] = useState({
    serial_number: '',
    name: '',
    model: 'N-MB260W',
    location: '',
    ip_address: ''
  });
  
  const [mappingForm, setMappingForm] = useState({
    biometric_id: '',
    employee_id: ''
  });

  const isAuthorized = user?.role === 'super_admin' || user?.role === 'hr_admin';
  const webhookUrl = `${process.env.REACT_APP_BACKEND_URL}/api/biometric/webhook`;

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devicesRes, mappingsRes, logsRes, unmatchedRes, employeesRes] = await Promise.all([
        fetch(`${API_URL}/biometric/devices`, { credentials: 'include' }),
        fetch(`${API_URL}/biometric/mapping`, { credentials: 'include' }),
        fetch(`${API_URL}/biometric/logs?limit=50`, { credentials: 'include' }),
        fetch(`${API_URL}/biometric/logs/unmatched?limit=20`, { credentials: 'include' }),
        fetch(`${API_URL}/employees`, { credentials: 'include' })
      ]);

      if (devicesRes.ok) setDevices(await devicesRes.json());
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
      if (unmatchedRes.ok) setUnmatchedLogs(await unmatchedRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    if (!deviceForm.serial_number) {
      toast.error('Serial number is required');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/biometric/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(deviceForm)
      });

      const result = await response.json();
      if (response.ok) {
        toast.success('Device registered successfully');
        setShowAddDevice(false);
        setDeviceForm({ serial_number: '', name: '', model: 'N-MB260W', location: '', ip_address: '' });
        fetchData();
      } else {
        toast.error(result.detail || 'Failed to register device');
      }
    } catch (error) {
      toast.error('Failed to register device');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddMapping = async () => {
    if (!mappingForm.biometric_id || !mappingForm.employee_id) {
      toast.error('Both Biometric ID and Employee are required');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/biometric/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mappingForm)
      });

      const result = await response.json();
      if (response.ok) {
        toast.success('Mapping created successfully');
        setShowAddMapping(false);
        setMappingForm({ biometric_id: '', employee_id: '' });
        fetchData();
      } else {
        toast.error(result.detail || 'Failed to create mapping');
      }
    } catch (error) {
      toast.error('Failed to create mapping');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteMapping = async (biometricId) => {
    try {
      const response = await fetch(`${API_URL}/biometric/mapping/${biometricId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Mapping deleted');
        fetchData();
      } else {
        toast.error('Failed to delete mapping');
      }
    } catch (error) {
      toast.error('Failed to delete mapping');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">Only Admin and HR users can manage biometric devices.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Biometric Integration</h1>
            <p className="text-slate-500">Manage devices and employee mappings</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSetupGuide(true)} className="gap-2">
            <Settings className="w-4 h-4" />
            Setup Guide
          </Button>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Devices</p>
                <p className="text-2xl font-bold">{devices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Mapped Users</p>
                <p className="text-2xl font-bold">{mappings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Unmatched</p>
                <p className="text-2xl font-bold">{unmatchedLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Today's Punches</p>
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.date === new Date().toISOString().split('T')[0]).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL Card */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-indigo-900">Webhook URL (Configure in your BioMax device)</p>
              <code className="text-sm text-indigo-700 bg-white px-2 py-1 rounded mt-1 inline-block">
                {webhookUrl}
              </code>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)} className="gap-2">
              <Copy className="w-4 h-4" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices" className="gap-2">
            <Fingerprint className="w-4 h-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="mappings" className="gap-2">
            <Link2 className="w-4 h-4" />
            Employee Mappings
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="w-4 h-4" />
            Punch Logs
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="gap-2">
            <AlertCircle className="w-4 h-4" />
            Unmatched ({unmatchedLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Registered Devices</CardTitle>
                <CardDescription>Biometric devices configured to send data to Sharda HR</CardDescription>
              </div>
              <Button onClick={() => setShowAddDevice(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Device
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Fingerprint className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No devices registered yet</p>
                  <Button variant="outline" className="mt-3" onClick={() => setShowAddDevice(true)}>
                    Register Your First Device
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.device_id}>
                        <TableCell>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-xs text-slate-400">{device.model}</div>
                        </TableCell>
                        <TableCell><code>{device.serial_number}</code></TableCell>
                        <TableCell>{device.ip_address || '-'}</TableCell>
                        <TableCell>{device.location || '-'}</TableCell>
                        <TableCell>{formatDateTime(device.last_sync)}</TableCell>
                        <TableCell>
                          {device.last_sync ? (
                            <Badge className="bg-green-100 text-green-700 gap-1">
                              <Wifi className="w-3 h-3" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 gap-1">
                              <WifiOff className="w-3 h-3" /> Waiting
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mappings Tab */}
        <TabsContent value="mappings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Employee Mappings</CardTitle>
                <CardDescription>Link biometric user IDs to employees</CardDescription>
              </div>
              <Button onClick={() => setShowAddMapping(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Mapping
              </Button>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Link2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No mappings created yet</p>
                  <p className="text-sm mt-1">Map biometric IDs to employees for automatic attendance</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Biometric ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.mapping_id}>
                        <TableCell><code className="bg-slate-100 px-2 py-1 rounded">{mapping.biometric_id}</code></TableCell>
                        <TableCell>
                          <div className="font-medium">{mapping.employee_name}</div>
                          <div className="text-xs text-slate-400">{mapping.employee_id}</div>
                        </TableCell>
                        <TableCell>{formatDateTime(mapping.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteMapping(mapping.biometric_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Punch Logs</CardTitle>
              <CardDescription>All biometric attendance records received</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No punch logs received yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Input</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.log_id}>
                        <TableCell>
                          {log.employee_name ? (
                            <div>
                              <div className="font-medium">{log.employee_name}</div>
                              <div className="text-xs text-slate-400">{log.biometric_id}</div>
                            </div>
                          ) : (
                            <code className="text-amber-600">{log.biometric_id}</code>
                          )}
                        </TableCell>
                        <TableCell>{log.date}</TableCell>
                        <TableCell>{log.punch_time}</TableCell>
                        <TableCell>
                          <Badge variant={log.punch_type === 'IN' ? 'default' : 'secondary'}>
                            {log.punch_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{log.input_type}</TableCell>
                        <TableCell>
                          {log.status === 'matched' ? (
                            <Badge className="bg-green-100 text-green-700 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 gap-1">
                              <AlertCircle className="w-3 h-3" /> Unmatched
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unmatched Tab */}
        <TabsContent value="unmatched">
          <Card>
            <CardHeader>
              <CardTitle>Unmatched Punches</CardTitle>
              <CardDescription>Biometric IDs that need to be mapped to employees</CardDescription>
            </CardHeader>
            <CardContent>
              {unmatchedLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-300" />
                  <p>All punches are matched!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Biometric ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedLogs.map((log) => (
                      <TableRow key={log.log_id}>
                        <TableCell><code className="bg-amber-50 text-amber-700 px-2 py-1 rounded">{log.biometric_id}</code></TableCell>
                        <TableCell>{log.date}</TableCell>
                        <TableCell>{log.punch_time}</TableCell>
                        <TableCell>
                          <Badge variant={log.punch_type === 'IN' ? 'default' : 'secondary'}>
                            {log.punch_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setMappingForm({ ...mappingForm, biometric_id: log.biometric_id });
                              setShowAddMapping(true);
                            }}
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            Map
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Biometric Device</DialogTitle>
            <DialogDescription>Add your BioMax device to receive attendance data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Serial Number *</Label>
              <Input
                value={deviceForm.serial_number}
                onChange={(e) => setDeviceForm({ ...deviceForm, serial_number: e.target.value })}
                placeholder="e.g., AMDB211116000015"
              />
            </div>
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input
                value={deviceForm.name}
                onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                placeholder="e.g., Main Entrance"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={deviceForm.model} onValueChange={(v) => setDeviceForm({ ...deviceForm, model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N-MB260W">BioMax N-MB260W Pro</SelectItem>
                  <SelectItem value="K21-Pro">BioMax K21 Pro</SelectItem>
                  <SelectItem value="X990">BioMax X990</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={deviceForm.ip_address}
                onChange={(e) => setDeviceForm({ ...deviceForm, ip_address: e.target.value })}
                placeholder="e.g., 192.168.29.47"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={deviceForm.location}
                onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                placeholder="e.g., Office Main Gate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)}>Cancel</Button>
            <Button onClick={handleAddDevice} disabled={processing}>
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering...</> : 'Register Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mapping Dialog */}
      <Dialog open={showAddMapping} onOpenChange={setShowAddMapping}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Employee Mapping</DialogTitle>
            <DialogDescription>Link a biometric user ID to an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Biometric User ID *</Label>
              <Input
                value={mappingForm.biometric_id}
                onChange={(e) => setMappingForm({ ...mappingForm, biometric_id: e.target.value })}
                placeholder="e.g., 1, 2, 101"
              />
              <p className="text-xs text-slate-500">This is the ID shown on the biometric device when employee punches</p>
            </div>
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={mappingForm.employee_id} onValueChange={(v) => setMappingForm({ ...mappingForm, employee_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name} ({emp.emp_code || emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMapping(false)}>Cancel</Button>
            <Button onClick={handleAddMapping} disabled={processing}>
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Guide Dialog */}
      <Dialog open={showSetupGuide} onOpenChange={setShowSetupGuide}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>BioMax Device Setup Guide</DialogTitle>
            <DialogDescription>Follow these steps to connect your BioMax device to Sharda HR</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Step 1: Register Device in Sharda HR</h3>
              <p className="text-slate-600">Click "Add Device" and enter your device's serial number (found in Menu → System Info)</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Step 2: Configure Device Network</h3>
              <p className="text-slate-600">On your BioMax device:</p>
              <ol className="list-decimal list-inside space-y-2 text-slate-600 ml-4">
                <li>Go to <strong>Menu → Communication → Network</strong></li>
                <li>Ensure device is connected to internet (Ethernet/WiFi)</li>
                <li>Note the device IP address</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Step 3: Configure Push Server</h3>
              <p className="text-slate-600">On your BioMax device:</p>
              <ol className="list-decimal list-inside space-y-2 text-slate-600 ml-4">
                <li>Go to <strong>Menu → Communication → Cloud Server</strong> or <strong>Push Settings</strong></li>
                <li>Enable Push/Cloud mode</li>
                <li>Set Server URL to:</li>
              </ol>
              <div className="bg-slate-100 p-3 rounded-lg mt-2">
                <code className="text-sm break-all">{webhookUrl}</code>
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-amber-600 mt-2">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                If your device only accepts IP addresses, you may need to use the CAMS API or a local relay.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Step 4: Create Employee Mappings</h3>
              <p className="text-slate-600">
                For each employee registered on the biometric device, create a mapping that links their biometric user ID 
                (the number they see when they punch) to their employee record in Sharda HR.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Step 5: Test the Connection</h3>
              <p className="text-slate-600">
                Have an employee punch on the device. If configured correctly, you should see the punch appear in the 
                "Punch Logs" tab within seconds.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-blue-800">Need Help?</h4>
              <p className="text-blue-700 text-sm mt-1">
                If your device doesn't support URL-based push, you may need to set up a local relay or use the CAMS Biometric API. 
                Contact your BioMax vendor for specific configuration instructions for your model.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSetupGuide(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BiometricPage;
