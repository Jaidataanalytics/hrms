import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
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
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  Megaphone,
  Plus,
  Pin,
  Bell,
  Calendar,
  Users,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Cake,
  Star
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AnnouncementsPage = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 'normal',
    requires_acknowledgment: false,
    is_pinned: false
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchAnnouncements();
  }, [filterCategory]);

  const fetchAnnouncements = async () => {
    try {
      let url = `${API_URL}/announcements`;
      if (filterCategory !== 'all') {
        url += `?category=${filterCategory}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.content) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success('Announcement published');
        setShowCreateDialog(false);
        setForm({
          title: '',
          content: '',
          category: 'general',
          priority: 'normal',
          requires_acknowledgment: false,
          is_pinned: false
        });
        fetchAnnouncements();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create announcement');
      }
    } catch (error) {
      toast.error('Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (annId) => {
    try {
      const response = await fetch(`${API_URL}/announcements/${annId}/acknowledge`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Acknowledged');
        fetchAnnouncements();
      }
    } catch (error) {
      toast.error('Failed to acknowledge');
    }
  };

  const categoryConfig = {
    general: { label: 'General', icon: Megaphone, color: 'bg-slate-100 text-slate-700' },
    policy: { label: 'Policy Update', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
    event: { label: 'Event', icon: Calendar, color: 'bg-purple-100 text-purple-700' },
    birthday: { label: 'Birthday', icon: Cake, color: 'bg-pink-100 text-pink-700' },
    anniversary: { label: 'Anniversary', icon: Star, color: 'bg-blue-100 text-blue-700' }
  };

  const priorityConfig = {
    low: { color: 'bg-slate-100 text-slate-600' },
    normal: { color: 'bg-blue-100 text-blue-700' },
    high: { color: 'bg-amber-100 text-amber-700' },
    urgent: { color: 'bg-red-100 text-red-700' }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="announcements-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Announcements</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Announcements
          </h1>
          <p className="text-slate-600 mt-1">Company news and updates</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        <div className="flex gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40" data-testid="filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="policy">Policy Updates</SelectItem>
              <SelectItem value="event">Events</SelectItem>
              <SelectItem value="birthday">Birthdays</SelectItem>
              <SelectItem value="anniversary">Anniversaries</SelectItem>
            </SelectContent>
          </Select>
          
          {isHR && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="create-announcement-btn">
                  <Plus className="w-4 h-4" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                  <DialogDescription>
                    Publish a new announcement for employees
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Announcement title"
                      data-testid="input-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Content *</Label>
                    <Textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="Write your announcement..."
                      rows={5}
                      data-testid="input-content"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(value) => setForm({ ...form, category: value })}
                      >
                        <SelectTrigger data-testid="select-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="policy">Policy Update</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="birthday">Birthday</SelectItem>
                          <SelectItem value="anniversary">Anniversary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={form.priority}
                        onValueChange={(value) => setForm({ ...form, priority: value })}
                      >
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pin className="w-4 h-4 text-slate-500" />
                      <Label htmlFor="pinned">Pin this announcement</Label>
                    </div>
                    <Switch
                      id="pinned"
                      checked={form.is_pinned}
                      onCheckedChange={(checked) => setForm({ ...form, is_pinned: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-500" />
                      <Label htmlFor="ack">Require acknowledgment</Label>
                    </div>
                    <Switch
                      id="ack"
                      checked={form.requires_acknowledgment}
                      onCheckedChange={(checked) => setForm({ ...form, requires_acknowledgment: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting} data-testid="publish-btn">
                    {submitting ? 'Publishing...' : 'Publish'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map(ann => {
            const category = categoryConfig[ann.category] || categoryConfig.general;
            const CategoryIcon = category.icon;
            const priority = priorityConfig[ann.priority] || priorityConfig.normal;
            const isAcknowledged = ann.acknowledged_by?.includes(user?.user_id);
            const needsAcknowledgment = ann.requires_acknowledgment && !isAcknowledged;
            
            return (
              <Card 
                key={ann.announcement_id}
                className={`overflow-hidden ${ann.is_pinned ? 'border-primary/30 bg-primary/5' : ''}`}
                data-testid={`announcement-${ann.announcement_id}`}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Left accent bar for pinned/urgent */}
                    {(ann.is_pinned || ann.priority === 'urgent') && (
                      <div className={`w-1 ${ann.priority === 'urgent' ? 'bg-red-500' : 'bg-primary'}`} />
                    )}
                    
                    <div className="flex-1 p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {ann.is_pinned && (
                              <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
                                <Pin className="w-3 h-3" />
                                Pinned
                              </Badge>
                            )}
                            <Badge className={category.color}>
                              <CategoryIcon className="w-3 h-3 mr-1" />
                              {category.label}
                            </Badge>
                            {ann.priority !== 'normal' && (
                              <Badge className={priority.color}>
                                {ann.priority}
                              </Badge>
                            )}
                          </div>
                          
                          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {ann.title}
                          </h3>
                          
                          <p className="text-slate-600 whitespace-pre-wrap mb-4">
                            {ann.content}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(ann.published_at)}
                            </span>
                            {ann.read_by?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {ann.read_by.length} read
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {needsAcknowledgment && (
                          <Button
                            onClick={() => handleAcknowledge(ann.announcement_id)}
                            className="gap-2 shrink-0"
                            data-testid={`ack-${ann.announcement_id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Acknowledge
                          </Button>
                        )}
                        
                        {isAcknowledged && (
                          <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Acknowledged
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Announcements</h3>
              <p className="text-slate-500 mb-4">
                {filterCategory !== 'all' ? 'No announcements in this category' : 'No announcements have been published yet'}
              </p>
              {isHR && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create First Announcement
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsPage;
