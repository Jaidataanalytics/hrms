import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { GraduationCap, Plus, RefreshCw, Award, BookOpen, Users, Calendar, CheckCircle, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const TrainingPage = () => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [myTraining, setMyTraining] = useState({ enrollments: [], certifications: [], skills: [] });
  const [loading, setLoading] = useState(true);
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [programForm, setForm] = useState({
    name: '', description: '', category: 'technical', trainer: '', start_date: '', end_date: '', location: '', max_participants: 30
  });
  const [certForm, setCertForm] = useState({
    name: '', issuing_body: '', issue_date: '', expiry_date: '', credential_id: ''
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [programsRes, myRes] = await Promise.all([
        fetch(`${API_URL}/training/programs`, { credentials: 'include' }),
        fetch(`${API_URL}/training/my-training`, { credentials: 'include' })
      ]);
      if (programsRes.ok) setPrograms(await programsRes.json());
      if (myRes.ok) setMyTraining(await myRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async () => {
    try {
      const response = await fetch(`${API_URL}/training/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(programForm)
      });
      if (response.ok) {
        toast.success('Program created');
        setShowAddProgram(false);
        setForm({ name: '', description: '', category: 'technical', trainer: '', start_date: '', end_date: '', location: '', max_participants: 30 });
        fetchData();
      } else {
        toast.error('Failed to create program');
      }
    } catch (error) {
      toast.error('Failed to create program');
    }
  };

  const handleAddCertification = async () => {
    try {
      const response = await fetch(`${API_URL}/training/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(certForm)
      });
      if (response.ok) {
        toast.success('Certification added');
        setShowAddCert(false);
        setCertForm({ name: '', issuing_body: '', issue_date: '', expiry_date: '', credential_id: '' });
        fetchData();
      } else {
        toast.error('Failed to add certification');
      }
    } catch (error) {
      toast.error('Failed to add certification');
    }
  };

  const handleEnroll = async (programId) => {
    try {
      const response = await fetch(`${API_URL}/training/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ program_id: programId, employee_id: user.employee_id })
      });
      if (response.ok) {
        toast.success('Enrolled successfully');
        fetchData();
      } else {
        toast.error('Failed to enroll');
      }
    } catch (error) {
      toast.error('Failed to enroll');
    }
  };

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-slate-100 text-slate-700',
    enrolled: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Training & Development</h1>
          <p className="text-slate-600 mt-1">Manage training programs, certifications, and skills</p>
        </div>
        {isHR && (
          <Dialog open={showAddProgram} onOpenChange={setShowAddProgram}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Add Program</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Training Program</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Program Name</Label>
                  <Input value={programForm.name} onChange={(e) => setForm({ ...programForm, name: e.target.value })} placeholder="Leadership Workshop" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={programForm.category} onValueChange={(v) => setForm({ ...programForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="soft_skills">Soft Skills</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="leadership">Leadership</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Participants</Label>
                    <Input type="number" value={programForm.max_participants} onChange={(e) => setForm({ ...programForm, max_participants: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={programForm.start_date} onChange={(e) => setForm({ ...programForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={programForm.end_date} onChange={(e) => setForm({ ...programForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trainer</Label>
                  <Input value={programForm.trainer} onChange={(e) => setForm({ ...programForm, trainer: e.target.value })} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={programForm.description} onChange={(e) => setForm({ ...programForm, description: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddProgram(false)}>Cancel</Button>
                <Button onClick={handleCreateProgram}>Create Program</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{programs.length}</p><p className="text-sm text-slate-500">Programs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{myTraining.enrollments.filter(e => e.status === 'completed').length}</p><p className="text-sm text-slate-500">Completed</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center"><Award className="w-6 h-6 text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{myTraining.certifications.length}</p><p className="text-sm text-slate-500">Certifications</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center"><Users className="w-6 h-6 text-purple-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{myTraining.skills.length}</p><p className="text-sm text-slate-500">Skills</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="programs" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="programs">Training Programs</TabsTrigger>
          <TabsTrigger value="my-training">My Training</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
        </TabsList>

        <TabsContent value="programs">
          <Card>
            <CardHeader><CardTitle className="text-lg">Available Programs</CardTitle></CardHeader>
            <CardContent>
              {programs.length > 0 ? (
                <div className="space-y-3">
                  {programs.map((prog) => (
                    <div key={prog.program_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{prog.name}</p>
                          <p className="text-sm text-slate-500">{prog.trainer} • {prog.start_date} to {prog.end_date}</p>
                          <Badge className={statusColors[prog.status] || 'bg-slate-100'}>{prog.status || 'upcoming'}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleEnroll(prog.program_id)}>Enroll</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No training programs available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-training">
          <Card>
            <CardHeader><CardTitle className="text-lg">My Enrollments</CardTitle></CardHeader>
            <CardContent>
              {myTraining.enrollments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Program</TableHead><TableHead>Enrolled On</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {myTraining.enrollments.map((enr) => (
                      <TableRow key={enr.enrollment_id}>
                        <TableCell className="font-medium">{enr.program_id}</TableCell>
                        <TableCell>{enr.enrolled_at?.split('T')[0]}</TableCell>
                        <TableCell><Badge className={statusColors[enr.status]}>{enr.status}</Badge></TableCell>
                        <TableCell>{enr.score || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8"><p className="text-slate-500">No enrollments yet</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">My Certifications</CardTitle>
              <Dialog open={showAddCert} onOpenChange={setShowAddCert}>
                <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Certification</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Certification Name</Label>
                      <Input value={certForm.name} onChange={(e) => setCertForm({ ...certForm, name: e.target.value })} placeholder="AWS Solutions Architect" />
                    </div>
                    <div className="space-y-2">
                      <Label>Issuing Body</Label>
                      <Input value={certForm.issuing_body} onChange={(e) => setCertForm({ ...certForm, issuing_body: e.target.value })} placeholder="Amazon Web Services" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Issue Date</Label>
                        <Input type="date" value={certForm.issue_date} onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <Input type="date" value={certForm.expiry_date} onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Credential ID</Label>
                      <Input value={certForm.credential_id} onChange={(e) => setCertForm({ ...certForm, credential_id: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddCert(false)}>Cancel</Button>
                    <Button onClick={handleAddCertification}>Add Certification</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {myTraining.certifications.length > 0 ? (
                <div className="space-y-3">
                  {myTraining.certifications.map((cert) => (
                    <div key={cert.certification_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><Award className="w-5 h-5 text-amber-600" /></div>
                        <div>
                          <p className="font-medium text-slate-900">{cert.name}</p>
                          <p className="text-sm text-slate-500">{cert.issuing_body} • Expires: {cert.expiry_date || 'Never'}</p>
                        </div>
                      </div>
                      {cert.verified ? <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge> : <Badge variant="outline">Pending</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8"><p className="text-slate-500">No certifications added</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrainingPage;
