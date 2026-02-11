import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { toast } from 'sonner';
import {
  Briefcase,
  Plus,
  MapPin,
  Clock,
  Users,
  RefreshCw,
  FileText,
  Send,
  Eye
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const RecruitmentPage = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showApply, setShowApply] = useState(null);

  const [form, setForm] = useState({
    title: '',
    department_id: '',
    description: '',
    requirements: '',
    experience_min: 0,
    experience_max: 5,
    vacancies: 1
  });

  const [applyForm, setApplyForm] = useState({ cover_letter: '' });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [jobsRes, appsRes, deptRes] = await Promise.all([
        fetch(`${API_URL}/recruitment/jobs`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/recruitment/applications`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/departments`, { credentials: 'include', headers: getAuthHeaders() })
      ]);

      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (appsRes.ok) setApplications(await appsRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!form.title || !form.department_id) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/recruitment/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success('Job posting created');
        setShowCreate(false);
        setForm({ title: '', department_id: '', description: '', requirements: '', experience_min: 0, experience_max: 5, vacancies: 1 });
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to create job');
    }
  };

  const handleApply = async (jobId) => {
    try {
      const response = await fetch(`${API_URL}/recruitment/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ job_id: jobId, cover_letter: applyForm.cover_letter })
      });

      if (response.ok) {
        toast.success('Application submitted');
        setShowApply(null);
        setApplyForm({ cover_letter: '' });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to apply');
      }
    } catch (error) {
      toast.error('Failed to apply');
    }
  };

  const publishJob = async (jobId) => {
    try {
      const response = await fetch(`${API_URL}/recruitment/jobs/${jobId}/publish`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Job published');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to publish');
    }
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-600',
    published: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-red-100 text-red-700',
    on_hold: 'bg-amber-100 text-amber-700'
  };

  const appStatusColors = {
    applied: 'bg-blue-100 text-blue-700',
    screening: 'bg-amber-100 text-amber-700',
    interview: 'bg-purple-100 text-purple-700',
    selected: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-slate-100 text-slate-600'
  };

  const getDeptName = (id) => departments.find(d => d.department_id === id)?.name || id;

  const hasApplied = (jobId) => applications.some(a => a.job_id === jobId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="recruitment-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Recruitment</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Internal Jobs
          </h1>
          <p className="text-slate-600 mt-1">Browse and apply for internal opportunities</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        {isHR && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="create-job-btn">
                <Plus className="w-4 h-4" />
                Post New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Job Posting</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Job Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Senior Software Engineer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vacancies</Label>
                    <Input
                      type="number"
                      value={form.vacancies}
                      onChange={(e) => setForm({ ...form, vacancies: parseInt(e.target.value) })}
                      min={1}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Experience (years)</Label>
                    <Input
                      type="number"
                      value={form.experience_min}
                      onChange={(e) => setForm({ ...form, experience_min: parseInt(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Experience (years)</Label>
                    <Input
                      type="number"
                      value={form.experience_max}
                      onChange={(e) => setForm({ ...form, experience_max: parseInt(e.target.value) })}
                      min={0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Requirements</Label>
                  <Textarea
                    value={form.requirements}
                    onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreateJob}>Create Job</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="jobs" className="gap-2" data-testid="tab-jobs">
            <Briefcase className="w-4 h-4" />
            Open Positions
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2" data-testid="tab-applications">
            <FileText className="w-4 h-4" />
            My Applications
          </TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.filter(j => j.status === 'published' || isHR).map((job) => (
              <Card key={job.job_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>{getDeptName(job.department_id)}</span>
                        {job.location_id && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span>{job.location_id}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className={statusColors[job.status]}>{job.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 line-clamp-2 mb-4">{job.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {job.experience_min}-{job.experience_max} yrs
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {job.vacancies} opening{job.vacancies > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {job.status === 'published' && !hasApplied(job.job_id) && (
                      <Button size="sm" className="gap-1" onClick={() => setShowApply(job)}>
                        <Send className="w-3 h-3" />
                        Apply
                      </Button>
                    )}
                    {hasApplied(job.job_id) && (
                      <Badge variant="outline">Applied</Badge>
                    )}
                    {isHR && job.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => publishJob(job.job_id)}>
                        Publish
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {jobs.filter(j => j.status === 'published' || isHR).length === 0 && (
              <Card className="col-span-2">
                <CardContent className="text-center py-12">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No job openings available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">My Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((app) => {
                    const job = jobs.find(j => j.job_id === app.job_id);
                    return (
                      <div
                        key={app.application_id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{job?.title || app.job_id}</p>
                          <p className="text-sm text-slate-500">Applied {new Date(app.created_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <Badge className={appStatusColors[app.status]}>{app.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No applications yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Apply Dialog */}
      <Dialog open={!!showApply} onOpenChange={() => setShowApply(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {showApply?.title}</DialogTitle>
            <DialogDescription>Submit your application for this internal position</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cover Letter</Label>
              <Textarea
                value={applyForm.cover_letter}
                onChange={(e) => setApplyForm({ ...applyForm, cover_letter: e.target.value })}
                placeholder="Why are you interested in this role?"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(null)}>Cancel</Button>
            <Button onClick={() => handleApply(showApply?.job_id)}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecruitmentPage;
