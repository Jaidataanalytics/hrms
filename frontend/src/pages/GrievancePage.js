import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
import { getAuthHeaders } from '../utils/api';
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import {
  HelpCircle,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  User,
  Lock
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const GrievancePage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [form, setForm] = useState({
    category: 'general',
    subject: '',
    description: '',
    priority: 'medium',
    is_anonymous: false
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchTickets();
  }, [filterStatus]);

  const fetchTickets = async () => {
    try {
      let url = `${API_URL}/grievances?`;
      if (filterStatus !== 'all') url += `status=${filterStatus}`;
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setTickets(await response.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.subject || !form.description) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success('Ticket created successfully');
        setShowCreate(false);
        setForm({ category: 'general', subject: '', description: '', priority: 'medium', is_anonymous: false });
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to create ticket');
    }
  };

  const statusConfig = {
    open: { icon: AlertCircle, color: 'bg-amber-100 text-amber-700', label: 'Open' },
    in_progress: { icon: Clock, color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
    resolved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700', label: 'Resolved' },
    closed: { icon: CheckCircle2, color: 'bg-slate-100 text-slate-600', label: 'Closed' },
    reopened: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Reopened' }
  };

  const priorityColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600'
  };

  const categories = [
    { code: 'general', name: 'General Query' },
    { code: 'payroll', name: 'Payroll Issue' },
    { code: 'leave', name: 'Leave Related' },
    { code: 'harassment', name: 'Harassment' },
    { code: 'workplace', name: 'Workplace Concern' },
    { code: 'benefits', name: 'Benefits & Insurance' },
    { code: 'it_support', name: 'IT Support' },
    { code: 'policy', name: 'Policy Clarification' },
    { code: 'feedback', name: 'Feedback/Suggestion' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="grievance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Helpdesk
          </h1>
          <p className="text-slate-600 mt-1">Submit queries and track tickets</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="new-ticket-btn">
              <Plus className="w-4 h-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>Describe your issue or query</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.code} value={cat.code}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Provide details about your issue..."
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="anonymous"
                  checked={form.is_anonymous}
                  onCheckedChange={(checked) => setForm({ ...form, is_anonymous: checked })}
                />
                <Label htmlFor="anonymous" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Lock className="w-3 h-3" />
                  Submit anonymously
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Submit Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{tickets.filter(t => t.status === 'open').length}</p>
                <p className="text-xs text-slate-500">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{tickets.filter(t => t.status === 'in_progress').length}</p>
                <p className="text-xs text-slate-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{tickets.filter(t => t.status === 'resolved').length}</p>
                <p className="text-xs text-slate-500">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{tickets.length}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status] || statusConfig.open;
                const StatusIcon = status.icon;
                return (
                  <div
                    key={ticket.ticket_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg gap-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-400">{ticket.ticket_id}</span>
                        {ticket.is_anonymous && <Lock className="w-3 h-3 text-slate-400" />}
                      </div>
                      <p className="font-medium text-slate-900">{ticket.subject}</p>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="capitalize">{ticket.category?.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={priorityColors[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No tickets found</p>
              <Button onClick={() => setShowCreate(true)}>Create First Ticket</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
              {selectedTicket?.ticket_id} • Created {selectedTicket && new Date(selectedTicket.created_at).toLocaleString('en-IN')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge className={statusConfig[selectedTicket?.status]?.color}>
                {statusConfig[selectedTicket?.status]?.label}
              </Badge>
              <Badge className={priorityColors[selectedTicket?.priority]}>
                {selectedTicket?.priority} priority
              </Badge>
              <Badge variant="outline" className="capitalize">
                {selectedTicket?.category?.replace('_', ' ')}
              </Badge>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket?.description}</p>
            </div>
            {selectedTicket?.resolution && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium mb-1">Resolution</p>
                <p className="text-slate-700">{selectedTicket.resolution}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrievancePage;
