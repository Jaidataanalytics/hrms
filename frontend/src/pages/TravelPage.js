import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Plane, Plus, RefreshCw, MapPin, Calendar, IndianRupee, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';

import { getAuthHeaders } from '../utils/api';
const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const TravelPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState({
    purpose: '', destination: '', start_date: '', end_date: '', travel_mode: 'flight',
    estimated_budget: '', accommodation_required: true, advance_required: false, advance_amount: '', remarks: ''
  });

  const isApprover = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance' || user?.role === 'manager';

  useEffect(() => { fetchData(); }, [filterStatus]);

  const fetchData = async () => {
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

  const handleSubmit = async () => {
    if (!form.purpose || !form.destination || !form.start_date) {
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
        toast.success('Travel request submitted');
        setShowAddRequest(false);
        setForm({ purpose: '', destination: '', start_date: '', end_date: '', travel_mode: 'flight', estimated_budget: '', accommodation_required: true, advance_required: false, advance_amount: '', remarks: '' });
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
        toast.success('Travel approved');
        setSelectedRequest(null);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (requestId, reason) => {
    try {
      const response = await fetch(`${API_URL}/travel/requests/${requestId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      if (response.ok) {
        toast.success('Travel rejected');
        setSelectedRequest(null);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-slate-100 text-slate-700'
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    total: requests.length,
    budget: requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.estimated_budget || 0), 0)
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Travel Management</h1>
          <p className="text-slate-600 mt-1">Request and manage business travel</p>
        </div>
        <Dialog open={showAddRequest} onOpenChange={setShowAddRequest}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />New Travel Request</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Travel Request</DialogTitle>
              <DialogDescription>Submit a request for business travel</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Purpose of Travel *</Label>
                <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Client meeting, Conference, etc." />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="City, Country" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Travel Mode</Label>
                  <Select value={form.travel_mode} onValueChange={(v) => setForm({ ...form, travel_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flight">Flight</SelectItem>
                      <SelectItem value="train">Train</SelectItem>
                      <SelectItem value="bus">Bus</SelectItem>
                      <SelectItem value="car">Car/Cab</SelectItem>
                      <SelectItem value="self">Self Arranged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Budget (₹)</Label>
                  <Input type="number" value={form.estimated_budget} onChange={(e) => setForm({ ...form, estimated_budget: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.accommodation_required} onChange={(e) => setForm({ ...form, accommodation_required: e.target.checked })} className="rounded" />
                  <span className="text-sm">Accommodation Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.advance_required} onChange={(e) => setForm({ ...form, advance_required: e.target.checked })} className="rounded" />
                  <span className="text-sm">Need Advance</span>
                </label>
              </div>
              {form.advance_required && (
                <div className="space-y-2">
                  <Label>Advance Amount (₹)</Label>
                  <Input type="number" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: parseInt(e.target.value) })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddRequest(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{stats.pending}</p><p className="text-sm text-slate-500">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{stats.approved}</p><p className="text-sm text-slate-500">Approved</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center"><Plane className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{stats.total}</p><p className="text-sm text-slate-500">Total Trips</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center"><IndianRupee className="w-6 h-6 text-purple-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.budget)}</p><p className="text-sm text-slate-500">Budget</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Plane className="w-5 h-5 text-primary" />Travel Requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Purpose</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length > 0 ? requests.map((req) => (
                <TableRow key={req.request_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{req.purpose}</p>
                      {req.employee_name && <p className="text-xs text-slate-500">{req.employee_name}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{req.destination}</div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{req.start_date}</p>
                    {req.end_date && <p className="text-xs text-slate-500">to {req.end_date}</p>}
                  </TableCell>
                  <TableCell>{formatCurrency(req.estimated_budget)}</TableCell>
                  <TableCell><Badge className={statusColors[req.status]}>{req.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(req)}><Eye className="w-4 h-4" /></Button>
                      {isApprover && req.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => { setSelectedRequest(req); handleApprove(req.request_id); }}><CheckCircle className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleReject(req.request_id, 'Budget constraints')}><XCircle className="w-4 h-4" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Plane className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No travel requests found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Travel Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Purpose</p>
                  <p className="font-medium">{selectedRequest.purpose}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Destination</p>
                  <p className="font-medium">{selectedRequest.destination}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Travel Dates</p>
                  <p className="font-medium">{selectedRequest.start_date} - {selectedRequest.end_date || 'TBD'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Mode</p>
                  <p className="font-medium capitalize">{selectedRequest.travel_mode}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Estimated Budget</p>
                  <p className="font-medium">{formatCurrency(selectedRequest.estimated_budget)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge className={statusColors[selectedRequest.status]}>{selectedRequest.status}</Badge>
                </div>
              </div>
              {selectedRequest.remarks && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Remarks</p>
                  <p className="text-sm">{selectedRequest.remarks}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TravelPage;
