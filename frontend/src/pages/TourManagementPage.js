import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plane, Plus, RefreshCw, MapPin, Calendar, Clock, CheckCircle, XCircle, 
  Eye, Navigation, Users, Settings, Briefcase, LogIn, LogOut
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const TourManagementPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [myTourStatus, setMyTourStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('my-tours');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [fieldEmployees, setFieldEmployees] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showFieldEmployeeDialog, setShowFieldEmployeeDialog] = useState(false);
  const [selectedFieldEmployee, setSelectedFieldEmployee] = useState('');

  const [form, setForm] = useState({
    purpose: '',
    location: '',
    client_name: '',
    start_date: '',
    end_date: '',
    transport_mode: 'bus',
    remarks: '',
    request_type: 'tour'
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance' || user?.role === 'manager';

  useEffect(() => {
    fetchData();
    fetchMyTourStatus();
    if (isHR) {
      fetchFieldEmployees();
      fetchEmployees();
    }
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/travel/requests?`;
      if (filterStatus !== 'all') url += `status=${filterStatus}`;
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setRequests(await response.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTourStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/travel/my-active-tour`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMyTourStatus(data);
      }
    } catch (error) {
      console.error('Error fetching tour status:', error);
    }
  };

  const fetchFieldEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/travel/field-employees`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setFieldEmployees(await response.json());
      }
    } catch (error) {
      console.error('Error fetching field employees:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/employees`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  };

  const handleRemoteCheckin = async (punchType) => {
    setCheckinLoading(true);
    setLocationError(null);

    try {
      // Get GPS location
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      // Get location name using reverse geocoding (optional)
      let locationName = '';
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`
        );
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          locationName = geoData.display_name?.split(',').slice(0, 3).join(', ') || '';
        }
      } catch {
        // Ignore geocoding errors
      }

      // Submit remote check-in
      const response = await fetch(`${API_URL}/travel/remote-check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          punch_type: punchType,
          latitude: location.latitude,
          longitude: location.longitude,
          location_name: locationName,
          tour_request_id: myTourStatus?.tour?.request_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Remote ${punchType} recorded at ${data.time}`);
        fetchMyTourStatus();
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Failed to record check-in');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      if (error.code === 1) {
        setLocationError('Location permission denied. Please enable location access.');
      } else if (error.code === 2) {
        setLocationError('Unable to get location. Please try again.');
      } else if (error.code === 3) {
        setLocationError('Location request timed out. Please try again.');
      } else {
        setLocationError(error.message || 'Failed to get location');
      }
      toast.error('Failed to record check-in');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!form.purpose || !form.location || !form.start_date) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/travel/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      if (response.ok) {
        toast.success('Tour request submitted');
        setShowAddRequest(false);
        setForm({
          purpose: '',
          location: '',
          client_name: '',
          start_date: '',
          end_date: '',
          transport_mode: 'bus',
          remarks: '',
          request_type: 'tour'
        });
        fetchData();
      } else {
        toast.error('Failed to submit request');
      }
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const handleApprove = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/travel/requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ approved_budget: selectedRequest?.estimated_budget })
      });
      if (response.ok) {
        toast.success('Tour approved');
        setSelectedRequest(null);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/travel/requests/${requestId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (response.ok) {
        toast.success('Tour rejected');
        setSelectedRequest(null);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleToggleFieldEmployee = async (employeeId, isField) => {
    try {
      const response = await fetch(`${API_URL}/travel/field-employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ is_field_employee: isField })
      });
      if (response.ok) {
        toast.success(isField ? 'Employee marked as field employee' : 'Field employee status removed');
        fetchFieldEmployees();
        setShowFieldEmployeeDialog(false);
        setSelectedFieldEmployee('');
      }
    } catch (error) {
      toast.error('Failed to update field employee status');
    }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    ongoing: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="space-y-6 p-6" data-testid="tour-management-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tour Management</h1>
          <p className="text-slate-600 mt-1">Manage tour requests and remote check-ins</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchData(); fetchMyTourStatus(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddRequest(true)} data-testid="new-tour-request-btn">
            <Plus className="w-4 h-4 mr-1" />
            New Tour Request
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-tours" className="gap-2" data-testid="tab-my-tours">
            <Briefcase className="w-4 h-4" />
            My Tours
          </TabsTrigger>
          <TabsTrigger value="remote-checkin" className="gap-2" data-testid="tab-remote-checkin">
            <Navigation className="w-4 h-4" />
            Remote Check-in
          </TabsTrigger>
          {isHR && (
            <>
              <TabsTrigger value="all-requests" className="gap-2" data-testid="tab-all-requests">
                <Plane className="w-4 h-4" />
                All Requests
              </TabsTrigger>
              <TabsTrigger value="field-employees" className="gap-2" data-testid="tab-field-employees">
                <Users className="w-4 h-4" />
                Field Employees
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* My Tours Tab */}
        <TabsContent value="my-tours">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">My Tour Requests</CardTitle>
              <CardDescription>View and track your tour requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : requests.filter(r => r.employee_id === user?.employee_id).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Purpose</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.filter(r => r.employee_id === user?.employee_id).map((req) => (
                      <TableRow key={req.request_id}>
                        <TableCell className="font-medium">{req.purpose}</TableCell>
                        <TableCell>{req.location}</TableCell>
                        <TableCell>
                          {req.start_date} {req.end_date && req.end_date !== req.start_date ? `- ${req.end_date}` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[req.status]}>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right flex gap-1 justify-end">
                          {req.status === 'pending' && (
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" data-testid={`cancel-tour-${req.request_id}`}
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_URL}/travel/requests/${req.request_id}/cancel`, { method: 'PUT', headers: getAuthHeaders(), credentials: 'include' });
                                  if (res.ok) { toast.success('Tour request cancelled'); fetchData(); }
                                  else { const e = await res.json(); toast.error(e.detail || 'Failed'); }
                                } catch { toast.error('Failed to cancel'); }
                              }}>
                              Cancel
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setSelectedRequest(req)}>
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Plane className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No tour requests yet</p>
                  <Button className="mt-4" onClick={() => setShowAddRequest(true)}>
                    Create Tour Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remote Check-in Tab */}
        <TabsContent value="remote-checkin">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Check-in Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  GPS Remote Check-in
                </CardTitle>
                <CardDescription>
                  Record your attendance from your current location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myTourStatus?.can_remote_checkin ? (
                  <>
                    {myTourStatus?.has_active_tour && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="font-medium text-blue-800">Active Tour</p>
                        <p className="text-sm text-blue-600">
                          {myTourStatus.tour?.purpose} - {myTourStatus.tour?.location}
                        </p>
                        <p className="text-xs text-blue-500 mt-1">
                          {myTourStatus.tour?.start_date} to {myTourStatus.tour?.end_date}
                        </p>
                      </div>
                    )}
                    {myTourStatus?.is_field_employee && !myTourStatus?.has_active_tour && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="font-medium text-purple-800">Field Employee</p>
                        <p className="text-sm text-purple-600">
                          You can check-in from any location
                        </p>
                      </div>
                    )}

                    {locationError && (
                      <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                        {locationError}
                      </div>
                    )}

                    <div className="flex gap-4">
                      <Button
                        className="flex-1 h-16"
                        onClick={() => handleRemoteCheckin('IN')}
                        disabled={checkinLoading}
                        data-testid="remote-checkin-btn"
                      >
                        {checkinLoading ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <LogIn className="w-5 h-5 mr-2" />
                            Check IN
                          </>
                        )}
                      </Button>
                      <Button
                        className="flex-1 h-16"
                        variant="outline"
                        onClick={() => handleRemoteCheckin('OUT')}
                        disabled={checkinLoading}
                        data-testid="remote-checkout-btn"
                      >
                        {checkinLoading ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="w-5 h-5 mr-2" />
                            Check OUT
                          </>
                        )}
                      </Button>
                    </div>

                    {currentLocation && (
                      <p className="text-xs text-slate-500 text-center">
                        Last location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">Remote check-in not available</p>
                    <p className="text-xs text-slate-400">
                      You must be on an approved tour or be a designated field employee
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Check-ins */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today&apos;s Check-ins</CardTitle>
                <CardDescription>Your remote check-in history for today</CardDescription>
              </CardHeader>
              <CardContent>
                {myTourStatus?.todays_checkins?.length > 0 ? (
                  <div className="space-y-3">
                    {myTourStatus.todays_checkins.map((checkin, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {checkin.punch_type === 'IN' ? (
                            <LogIn className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <LogOut className="w-5 h-5 text-amber-600" />
                          )}
                          <div>
                            <p className="font-medium">{checkin.punch_type}</p>
                            <p className="text-xs text-slate-500">{checkin.time}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-500 max-w-[200px] truncate">
                          {checkin.location?.name || `${checkin.location?.latitude?.toFixed(4)}, ${checkin.location?.longitude?.toFixed(4)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-slate-500">No check-ins recorded today</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Requests Tab (HR Only) */}
        {isHR && (
          <TabsContent value="all-requests">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">All Tour Requests</CardTitle>
                    <CardDescription>Manage and approve tour requests</CardDescription>
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : requests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Employee</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((req) => (
                        <TableRow key={req.request_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.employee_name}</p>
                              <p className="text-xs text-slate-500">{req.emp_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>{req.purpose}</TableCell>
                          <TableCell>{req.location}</TableCell>
                          <TableCell>
                            {req.start_date}
                            {req.end_date && req.end_date !== req.start_date && ` - ${req.end_date}`}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[req.status]}>{req.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => setSelectedRequest(req)}>
                                <Eye className="w-3 h-3" />
                              </Button>
                              {req.status === 'pending' && (
                                <>
                                  <Button size="sm" onClick={() => handleApprove(req.request_id)} className="bg-emerald-600 hover:bg-emerald-700">
                                    <CheckCircle className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleReject(req.request_id)}>
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Plane className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No tour requests found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Field Employees Tab (HR Only) */}
        {isHR && (
          <TabsContent value="field-employees">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Field Employees
                    </CardTitle>
                    <CardDescription>
                      Employees who can check-in remotely without tour approval
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowFieldEmployeeDialog(true)} data-testid="add-field-employee-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field Employee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {fieldEmployees.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldEmployees.map((emp) => (
                        <TableRow key={emp.employee_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                              <p className="text-xs text-slate-500">{emp.emp_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>{emp.department || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleFieldEmployee(emp.employee_id, false)}
                              className="text-red-600"
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No field employees configured</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Field employees can use remote check-in without tour approval
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* New Tour Request Dialog */}
      <Dialog open={showAddRequest} onOpenChange={setShowAddRequest}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Tour Request</DialogTitle>
            <DialogDescription>Submit a request for business travel</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Purpose *</Label>
              <Input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g., Client meeting, Site visit"
                data-testid="tour-purpose"
              />
            </div>
            <div className="space-y-2">
              <Label>Location/Destination *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Mumbai, Delhi"
                data-testid="tour-location"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Name (if applicable)</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Client or company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  data-testid="tour-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  data-testid="tour-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transport Mode</Label>
              <Select value={form.transport_mode} onValueChange={(v) => setForm({ ...form, transport_mode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="train">Train</SelectItem>
                  <SelectItem value="flight">Flight</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="self">Self Arrangement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRequest(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} data-testid="submit-tour-btn">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tour Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Employee</Label>
                  <p className="font-medium">{selectedRequest.employee_name}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <Badge className={statusColors[selectedRequest.status]}>{selectedRequest.status}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">Purpose</Label>
                <p className="font-medium">{selectedRequest.purpose}</p>
              </div>
              <div>
                <Label className="text-slate-500">Location</Label>
                <p>{selectedRequest.location}</p>
              </div>
              {selectedRequest.client_name && (
                <div>
                  <Label className="text-slate-500">Client</Label>
                  <p>{selectedRequest.client_name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Start Date</Label>
                  <p>{selectedRequest.start_date}</p>
                </div>
                <div>
                  <Label className="text-slate-500">End Date</Label>
                  <p>{selectedRequest.end_date || selectedRequest.start_date}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">Transport</Label>
                <p className="capitalize">{selectedRequest.transport_mode}</p>
              </div>
              {selectedRequest.remarks && (
                <div>
                  <Label className="text-slate-500">Remarks</Label>
                  <p className="text-sm">{selectedRequest.remarks}</p>
                </div>
              )}
              {selectedRequest.remote_checkins?.length > 0 && (
                <div>
                  <Label className="text-slate-500">Remote Check-ins</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.remote_checkins.map((c, i) => (
                      <div key={i} className="p-2 bg-slate-50 rounded text-sm">
                        <span className="font-medium">{c.punch_type}</span> at {c.time} on {c.date}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedRequest?.status === 'pending' && isHR && (
              <>
                <Button variant="outline" onClick={() => handleReject(selectedRequest.request_id)}>
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedRequest.request_id)} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Field Employee Dialog */}
      <Dialog open={showFieldEmployeeDialog} onOpenChange={setShowFieldEmployeeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Field Employee</DialogTitle>
            <DialogDescription>
              Select an employee to grant field employee status
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Employee</Label>
            <Select value={selectedFieldEmployee} onValueChange={setSelectedFieldEmployee}>
              <SelectTrigger className="mt-2" data-testid="field-employee-select">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter(e => !fieldEmployees.find(f => f.employee_id === e.employee_id))
                  .map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name} ({emp.emp_code || emp.employee_id})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldEmployeeDialog(false)}>Cancel</Button>
            <Button
              onClick={() => handleToggleFieldEmployee(selectedFieldEmployee, true)}
              disabled={!selectedFieldEmployee}
              data-testid="confirm-field-employee-btn"
            >
              Add Field Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TourManagementPage;
