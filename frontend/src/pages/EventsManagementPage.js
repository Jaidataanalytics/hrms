import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Gift, Star, Heart, PartyPopper, Plus, Upload, Download,
  Trash2, Search, Calendar, Users, Clock, Filter
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const EVENT_TYPES = {
  birthday: { label: 'Birthday', icon: Gift, color: 'amber' },
  work_anniversary: { label: 'Work Anniversary', icon: Star, color: 'blue' },
  marriage_anniversary: { label: 'Marriage Anniversary', icon: Heart, color: 'pink' },
  custom: { label: 'Custom', icon: PartyPopper, color: 'emerald' },
};

const EventsManagementPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    emp_code: '', event_type: 'birthday', event_date: '', label: '',
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [eventsRes, empRes, upcomingRes] = await Promise.all([
        fetch(`${API_URL}/events`, { headers, credentials: 'include' }),
        fetch(`${API_URL}/employees`, { headers, credentials: 'include' }),
        fetch(`${API_URL}/events/upcoming?days=30`, { headers, credentials: 'include' }),
      ]);
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (upcomingRes.ok) setUpcomingEvents(await upcomingRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateEvent = async () => {
    if (!form.emp_code || !form.event_type || !form.event_date) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Event created');
        setShowAddDialog(false);
        setForm({ emp_code: '', event_type: 'birthday', event_date: '', label: '' });
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create event');
      }
    } catch { toast.error('Failed to create event'); }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const res = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
      });
      if (res.ok) { toast.success('Event deleted'); fetchData(); }
    } catch { toast.error('Failed to delete event'); }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/events/bulk-upload`, {
        method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setShowUploadDialog(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Upload failed');
      }
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const downloadTemplate = () => {
    window.open(`${API_URL}/events/template`, '_blank');
  };

  const filteredEvents = events.filter(ev => {
    const matchesSearch = !searchQuery ||
      ev.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.emp_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || ev.event_type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: events.length,
    birthdays: events.filter(e => e.event_type === 'birthday').length,
    work: events.filter(e => e.event_type === 'work_anniversary').length,
    marriage: events.filter(e => e.event_type === 'marriage_anniversary').length,
    upcoming: upcomingEvents.length,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6" data-testid="events-management-page">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Events & Celebrations</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Employee Events</h1>
          <p className="text-slate-500 text-sm mt-1">Manage birthdays, anniversaries, and celebrations</p>
          <div className="header-accent-line mt-3 max-w-[180px]" />
        </div>
        <div className="flex gap-2">
          {isHR && (
            <>
              <Button variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="bulk-upload-btn">
                <Upload className="w-4 h-4 mr-2" /> Bulk Upload
              </Button>
              <Button onClick={() => setShowAddDialog(true)} data-testid="add-event-btn">
                <Plus className="w-4 h-4 mr-2" /> Add Event
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total, icon: Calendar, color: 'slate' },
          { label: 'Birthdays', value: stats.birthdays, icon: Gift, color: 'amber' },
          { label: 'Work Anniv.', value: stats.work, icon: Star, color: 'blue' },
          { label: 'Marriage Anniv.', value: stats.marriage, icon: Heart, color: 'pink' },
          { label: 'Upcoming (30d)', value: stats.upcoming, icon: Clock, color: 'emerald' },
        ].map((s, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="stat-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 text-${s.color}-600`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg">All Events</CardTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search employee..." className="pl-9 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="events-search" />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[160px] h-9">
                      <Filter className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="work_anniversary">Work Anniversary</SelectItem>
                      <SelectItem value="marriage_anniversary">Marriage Anniversary</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
                </div>
              ) : filteredEvents.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredEvents.map((event) => {
                    const config = EVENT_TYPES[event.event_type] || EVENT_TYPES.custom;
                    const Icon = config.icon;
                    return (
                      <div key={event.event_id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors group" data-testid={`event-${event.event_id}`}>
                        <div className={`w-9 h-9 rounded-lg bg-${config.color}-100 flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 text-${config.color}-600`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{event.employee_name || event.emp_code}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0">{config.label}</Badge>
                            <span className="text-xs text-slate-400">{event.event_date}</span>
                            {event.department && <span className="text-xs text-slate-400">{event.department}</span>}
                          </div>
                        </div>
                        {isHR && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteEvent(event.event_id)}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Calendar className="empty-state-icon" />
                  <p className="empty-state-title">No events found</p>
                  <p className="empty-state-description">Add employee events to track celebrations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Celebrations */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-amber-500" /> Upcoming
              </CardTitle>
              <CardDescription>Next 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[450px] overflow-y-auto">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event) => {
                const config = EVENT_TYPES[event.event_type] || EVENT_TYPES.custom;
                const Icon = config.icon;
                return (
                  <div key={event.event_id} className={`p-3 rounded-lg bg-${config.color}-50 border border-${config.color}-100`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 text-${config.color}-600`} />
                      <p className={`text-sm font-medium text-${config.color}-900 truncate`}>{event.employee_name || event.emp_code}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs text-${config.color}-600`}>{config.label}</span>
                      <Badge variant="outline" className="text-[10px]">in {event.days_until}d</Badge>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-slate-400 text-center py-6">No upcoming events</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee Event</DialogTitle>
            <DialogDescription>Create a birthday, anniversary, or custom celebration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={form.emp_code} onValueChange={(v) => setForm({ ...form, emp_code: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.slice(0, 100).map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="work_anniversary">Work Anniversary</SelectItem>
                  <SelectItem value="marriage_anniversary">Marriage Anniversary</SelectItem>
                  <SelectItem value="custom">Custom Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Label (Optional)</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g., Joined as Engineer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent}>Create Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Events</DialogTitle>
            <DialogDescription>Upload an Excel file with employee events</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm text-slate-600 mb-3">Download the template, fill it out, and upload:</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="download-template-btn">
                <Download className="w-4 h-4 mr-2" /> Download Template
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Upload Excel File</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} disabled={uploading} data-testid="upload-events-file" />
              {uploading && <p className="text-sm text-primary">Uploading...</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsManagementPage;
