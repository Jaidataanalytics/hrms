import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  ListChecks,
  Link2,
  MoreVertical,
  CheckCircle2,
  Circle,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Target,
  CalendarDays,
  Search,
  Filter,
  Send,
  History,
  MapPin
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Meeting Card Component - moved outside MeetingsPage to prevent re-creation on each render
const MeetingCard = ({ meeting, onOpenDetail }) => (
  <Card 
    className="cursor-pointer hover:shadow-md transition-shadow"
    onClick={() => onOpenDetail(meeting)}
    data-testid={`meeting-card-${meeting.meeting_id}`}
  >
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{meeting.subject}</h3>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {meeting.meeting_date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {meeting.start_time}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3" />
              {meeting.location}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">
              {meeting.participants?.length || 0} participants
            </span>
            {meeting.follow_up_points?.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {meeting.follow_up_points.filter(f => f.status === 'pending').length} pending follow-ups
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={
            meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
            meeting.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            meeting.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-slate-100 text-slate-700'
          }>
            {meeting.status}
          </Badge>
          {meeting.series_id && meeting.previous_meeting_id && (
            <Badge variant="outline" className="text-xs">
              <Link2 className="w-3 h-3 mr-1" />
              Series
            </Badge>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const MeetingsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  
  // Data
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Form state
  const [meetingForm, setMeetingForm] = useState({
    subject: '',
    meeting_date: '',
    start_time: '',
    end_time: '',
    location: '',
    participants: [],
    agenda_items: [],
    next_meeting_date: ''
  });
  
  const [newAgendaItem, setNewAgendaItem] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newFollowUp, setNewFollowUp] = useState({ content: '', assigned_to: '' });
  
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [meetingsRes, employeesRes] = await Promise.all([
        fetch(`${API_URL}/meetings/list`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/employees`, { credentials: 'include', headers: authHeaders })
      ]);

      if (meetingsRes.ok) setMeetings(await meetingsRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
      
      // Fetch analytics for HR
      if (isHR) {
        const analyticsRes = await fetch(`${API_URL}/meetings/analytics/overview`, { 
          credentials: 'include', headers: authHeaders 
        });
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [isHR]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreateMeeting = async () => {
    if (!meetingForm.subject || !meetingForm.meeting_date || !meetingForm.start_time) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const url = editingMeeting 
        ? `${API_URL}/meetings/${editingMeeting.meeting_id}`
        : `${API_URL}/meetings/create`;
      
      const response = await fetch(url, {
        method: editingMeeting ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(meetingForm)
      });

      if (response.ok) {
        toast.success(editingMeeting ? 'Meeting updated' : 'Meeting created');
        setShowCreateDialog(false);
        resetForm();
        fetchMeetings();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to save meeting');
      }
    } catch (error) {
      toast.error('Failed to save meeting');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedMeeting) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/meetings/${selectedMeeting.meeting_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({ content: newNote })
      });

      if (response.ok) {
        toast.success('Note added');
        setNewNote('');
        // Refresh meeting details
        await fetchMeetingDetails(selectedMeeting.meeting_id);
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleAddFollowUp = async () => {
    if (!newFollowUp.content.trim() || !selectedMeeting) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/meetings/${selectedMeeting.meeting_id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(newFollowUp)
      });

      if (response.ok) {
        toast.success('Follow-up added');
        setNewFollowUp({ content: '', assigned_to: '' });
        await fetchMeetingDetails(selectedMeeting.meeting_id);
      } else {
        toast.error('Failed to add follow-up');
      }
    } catch (error) {
      toast.error('Failed to add follow-up');
    }
  };

  const handleToggleFollowUp = async (followupId, currentStatus) => {
    if (!selectedMeeting) return;

    try {
      const authHeaders = getAuthHeaders();
      await fetch(`${API_URL}/meetings/${selectedMeeting.meeting_id}/followups/${followupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({ status: currentStatus === 'completed' ? 'pending' : 'completed' })
      });
      await fetchMeetingDetails(selectedMeeting.meeting_id);
    } catch (error) {
      toast.error('Failed to update follow-up');
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!selectedMeeting) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/meetings/${selectedMeeting.meeting_id}/schedule-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({
          meeting_date: meetingForm.meeting_date,
          start_time: meetingForm.start_time,
          end_time: meetingForm.end_time,
          location: meetingForm.location,
          participants: selectedMeeting.participants
        })
      });

      if (response.ok) {
        toast.success('Follow-up meeting scheduled');
        setShowFollowUpDialog(false);
        resetForm();
        fetchMeetings();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to schedule follow-up');
      }
    } catch (error) {
      toast.error('Failed to schedule follow-up');
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Meeting cancelled');
        setShowDetailDialog(false);
        fetchMeetings();
      } else {
        toast.error('Failed to cancel meeting');
      }
    } catch (error) {
      toast.error('Failed to cancel meeting');
    }
  };

  const fetchMeetingDetails = async (meetingId) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/meetings/${meetingId}`, {
        credentials: 'include',
        headers: authHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedMeeting(data);
      }
    } catch (error) {
      console.error('Failed to fetch meeting details:', error);
    }
  };

  const openMeetingDetail = async (meeting) => {
    await fetchMeetingDetails(meeting.meeting_id);
    setShowDetailDialog(true);
  };

  const openEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setMeetingForm({
      subject: meeting.subject,
      meeting_date: meeting.meeting_date,
      start_time: meeting.start_time,
      end_time: meeting.end_time || '',
      location: meeting.location || '',
      participants: meeting.participants || [],
      agenda_items: meeting.agenda_items || [],
      next_meeting_date: meeting.next_meeting_date || ''
    });
    setShowCreateDialog(true);
  };

  const resetForm = () => {
    setEditingMeeting(null);
    setMeetingForm({
      subject: '',
      meeting_date: '',
      start_time: '',
      end_time: '',
      location: '',
      participants: [],
      agenda_items: [],
      next_meeting_date: ''
    });
    setNewAgendaItem('');
  };

  const addAgendaItem = () => {
    if (!newAgendaItem.trim()) return;
    setMeetingForm(prev => ({
      ...prev,
      agenda_items: [...prev.agenda_items, { 
        item_id: `item_${Date.now()}`, 
        content: newAgendaItem, 
        status: 'pending' 
      }]
    }));
    setNewAgendaItem('');
  };

  const removeAgendaItem = (index) => {
    setMeetingForm(prev => ({
      ...prev,
      agenda_items: prev.agenda_items.filter((_, i) => i !== index)
    }));
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.employee_id === empId);
    return emp ? `${emp.first_name} ${emp.last_name}` : empId;
  };

  // Filter meetings
  const filteredMeetings = meetings.filter(m => {
    const matchesSearch = m.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const upcomingMeetings = filteredMeetings.filter(m => 
    m.status === 'scheduled' && m.meeting_date >= new Date().toISOString().split('T')[0]
  ).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

  const pastMeetings = filteredMeetings.filter(m => 
    m.status === 'completed' || m.meeting_date < new Date().toISOString().split('T')[0]
  ).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));

  return (
    <div className="space-y-6" data-testid="meetings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Meetings</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Meeting Management</h1>
          <p className="text-slate-600 mt-1">Track meetings, discussions, and follow-ups</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="create-meeting-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Meeting
        </Button>
      </div>

      {/* Analytics Summary (HR only) */}
      {isHR && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-200">
                  <CalendarDays className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-900">{analytics.overview?.total_meetings || 0}</p>
                  <p className="text-xs text-blue-600">Total Meetings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-900">{analytics.overview?.followup_completion_rate || 0}%</p>
                  <p className="text-xs text-emerald-600">Follow-up Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-200">
                  <TrendingUp className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-900">{analytics.overview?.avg_meetings_per_day || 0}</p>
                  <p className="text-xs text-amber-600">Avg/Day</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-200">
                  <Target className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-900">{analytics.overview?.avg_days_between_followup_meetings || 0}</p>
                  <p className="text-xs text-purple-600">Avg Days Between</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search meetings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchMeetings}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Meetings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingMeetings.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastMeetings.length})
          </TabsTrigger>
          {isHR && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : upcomingMeetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingMeetings.map(meeting => (
                <MeetingCard key={meeting.meeting_id} meeting={meeting} onOpenDetail={openMeetingDetail} />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No upcoming meetings</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  Schedule a Meeting
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastMeetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastMeetings.map(meeting => (
                <MeetingCard key={meeting.meeting_id} meeting={meeting} onOpenDetail={openMeetingDetail} />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <History className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No past meetings</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isHR && (
          <TabsContent value="analytics" className="mt-4">
            {analytics ? (
              <div className="space-y-6">
                {/* Day Frequency */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Meeting Frequency by Day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                      {Object.entries(analytics.day_frequency || {}).map(([day, count]) => (
                        <div key={day} className="text-center p-3 rounded-lg bg-slate-50">
                          <p className="text-xs text-slate-500">{day.slice(0, 3)}</p>
                          <p className="text-xl font-bold text-slate-800">{count}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Organizers & Attendees */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Organizers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.top_organizers?.slice(0, 5).map((emp, i) => (
                          <div key={emp.employee_id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium">{emp.name || 'Unknown'}</span>
                            </div>
                            <Badge variant="outline">{emp.organized} meetings</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Attendees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.top_attendees?.slice(0, 5).map((emp, i) => (
                          <div key={emp.employee_id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium">{emp.name || 'Unknown'}</span>
                            </div>
                            <Badge variant="outline">{emp.attended} meetings</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="py-12">
                <CardContent className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">No analytics data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Meeting Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeeting ? 'Edit Meeting' : 'Create New Meeting'}</DialogTitle>
            <DialogDescription>Fill in the meeting details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={meetingForm.subject}
                onChange={(e) => setMeetingForm({ ...meetingForm, subject: e.target.value })}
                placeholder="Meeting subject"
                data-testid="meeting-subject-input"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={meetingForm.meeting_date}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={meetingForm.start_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={meetingForm.end_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={meetingForm.location}
                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                placeholder="Conference room / Online"
              />
            </div>

            <div className="space-y-2">
              <Label>Participants</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  if (v && !meetingForm.participants.includes(v)) {
                    setMeetingForm({ ...meetingForm, participants: [...meetingForm.participants, v] });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add participants" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => !meetingForm.participants.includes(e.employee_id)).slice(0, 50).map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {meetingForm.participants.map(pid => (
                  <Badge key={pid} variant="secondary" className="gap-1">
                    {getEmployeeName(pid)}
                    <button 
                      onClick={() => setMeetingForm({ 
                        ...meetingForm, 
                        participants: meetingForm.participants.filter(p => p !== pid) 
                      })}
                      className="ml-1 hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Agenda / Things to Focus On</Label>
              <div className="flex gap-2">
                <Input
                  value={newAgendaItem}
                  onChange={(e) => setNewAgendaItem(e.target.value)}
                  placeholder="Add agenda item"
                  onKeyDown={(e) => e.key === 'Enter' && addAgendaItem()}
                />
                <Button type="button" variant="outline" onClick={addAgendaItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {meetingForm.agenda_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                    <ListChecks className="w-4 h-4 text-slate-400" />
                    <span className="flex-1 text-sm">{item.content || item}</span>
                    <button onClick={() => removeAgendaItem(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateMeeting} data-testid="save-meeting-btn">
              {editingMeeting ? 'Update' : 'Create'} Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedMeeting && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedMeeting.subject}</DialogTitle>
                    <DialogDescription className="mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {selectedMeeting.meeting_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {selectedMeeting.start_time} - {selectedMeeting.end_time || '?'}
                      </span>
                      {selectedMeeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {selectedMeeting.location}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setShowDetailDialog(false); openEditMeeting(selectedMeeting); }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Meeting
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowFollowUpDialog(true)}>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Schedule Follow-up
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleCancelMeeting(selectedMeeting.meeting_id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Cancel Meeting
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 py-4">
                  {/* Participants */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Participants ({selectedMeeting.participants?.length || 0})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-primary/10">
                        {selectedMeeting.organizer_name || 'Organizer'} (Organizer)
                      </Badge>
                      {selectedMeeting.participant_details?.map(p => (
                        <Badge key={p.employee_id} variant="secondary">{p.name}</Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Agenda */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" />
                      Agenda / Things to Focus On
                    </h4>
                    {selectedMeeting.agenda_items?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMeeting.agenda_items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                            <Circle className="w-3 h-3 text-slate-400" />
                            <span className="text-sm">{item.content || item}</span>
                            {item.from_previous_meeting && (
                              <Badge variant="outline" className="text-xs ml-auto">From Previous</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No agenda items</p>
                    )}
                  </div>

                  <Separator />

                  {/* Discussion Notes */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Discussion Notes
                    </h4>
                    <div className="space-y-3">
                      {selectedMeeting.discussion_notes?.map((note, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-sm">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <span className="font-medium">{note.added_by_name}</span>
                            <span>•</span>
                            <span>{new Date(note.timestamp).toLocaleString()}</span>
                            {note.edited_at && (
                              <>
                                <span>•</span>
                                <span className="italic">edited</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Add note form */}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Add a discussion note..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={2}
                          className="flex-1"
                        />
                        <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Follow-up Points */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Follow-up Points for Next Meeting
                    </h4>
                    <div className="space-y-2">
                      {selectedMeeting.follow_up_points?.map((fu, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                          <button onClick={() => handleToggleFollowUp(fu.followup_id, fu.status)}>
                            {fu.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span className={`flex-1 text-sm ${fu.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                            {fu.content}
                          </span>
                          {fu.assigned_to && (
                            <Badge variant="outline" className="text-xs">
                              {getEmployeeName(fu.assigned_to)}
                            </Badge>
                          )}
                        </div>
                      ))}
                      
                      {/* Add follow-up form */}
                      <div className="flex gap-2 mt-3">
                        <Input
                          placeholder="Add follow-up point..."
                          value={newFollowUp.content}
                          onChange={(e) => setNewFollowUp({ ...newFollowUp, content: e.target.value })}
                          className="flex-1"
                        />
                        <Select
                          value={newFollowUp.assigned_to}
                          onValueChange={(v) => setNewFollowUp({ ...newFollowUp, assigned_to: v })}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Assign to" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.slice(0, 30).map(emp => (
                              <SelectItem key={emp.employee_id} value={emp.employee_id}>
                                {emp.first_name} {emp.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddFollowUp} disabled={!newFollowUp.content.trim()}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Meeting Series */}
                  {(selectedMeeting.previous_meeting_info || selectedMeeting.next_meeting_info) && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Link2 className="w-4 h-4" />
                          Meeting Series
                        </h4>
                        <div className="flex items-center gap-4">
                          {selectedMeeting.previous_meeting_info && (
                            <Button variant="outline" size="sm">
                              <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                              Previous: {selectedMeeting.previous_meeting_info.meeting_date}
                            </Button>
                          )}
                          {selectedMeeting.next_meeting_info && (
                            <Button variant="outline" size="sm">
                              Next: {selectedMeeting.next_meeting_info.meeting_date}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Activity Log */}
                  {selectedMeeting.activities?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Activity Log
                        </h4>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {selectedMeeting.activities.slice(0, 10).map((act, i) => (
                            <div key={i} className="text-xs text-slate-500 flex items-center gap-2">
                              <span className="font-medium text-slate-700">{act.user_name}</span>
                              <span>{act.action}</span>
                              {act.field_changed && (
                                <span className="text-slate-400">({act.field_changed})</span>
                              )}
                              <span className="ml-auto">{new Date(act.timestamp).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
                <Button onClick={() => setShowFollowUpDialog(true)}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Schedule Follow-up
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up Meeting</DialogTitle>
            <DialogDescription>
              Follow-up points will be automatically added as agenda items
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={meetingForm.meeting_date}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={meetingForm.start_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={meetingForm.end_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={meetingForm.location}
                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                placeholder={selectedMeeting?.location || 'Conference room / Online'}
              />
            </div>

            {selectedMeeting?.follow_up_points?.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium mb-2">These follow-up points will become the agenda:</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {selectedMeeting.follow_up_points.filter(f => f.status !== 'completed').map((fu, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Circle className="w-2 h-2" />
                      {fu.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>Cancel</Button>
            <Button onClick={handleScheduleFollowUp}>
              Schedule Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingsPage;
