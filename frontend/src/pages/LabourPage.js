import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
  Users,
  Building,
  Plus,
  RefreshCw,
  Search,
  HardHat,
  Calendar,
  AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LabourPage = () => {
  const { user } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [contractorForm, setContractorForm] = useState({
    name: '', company_name: '', contact_person: '', email: '', phone: '',
    gst_number: '', department_id: '', contract_start: '', contract_end: ''
  });

  const [workerForm, setWorkerForm] = useState({
    contractor_id: '', first_name: '', last_name: '', phone: '',
    aadhaar_number: '', department_id: '', skill_category: '', daily_rate: '', start_date: ''
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contRes, workRes, deptRes, sumRes] = await Promise.all([
        fetch(`${API_URL}/labour/contractors`, { credentials: 'include' }),
        fetch(`${API_URL}/labour/workers`, { credentials: 'include' }),
        fetch(`${API_URL}/departments`, { credentials: 'include' }),
        fetch(`${API_URL}/labour/summary`, { credentials: 'include' })
      ]);

      if (contRes.ok) setContractors(await contRes.json());
      if (workRes.ok) setWorkers(await workRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContractor = async () => {
    if (!contractorForm.name || !contractorForm.company_name) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/labour/contractors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contractorForm)
      });

      if (response.ok) {
        toast.success('Contractor added');
        setShowAddContractor(false);
        setContractorForm({ name: '', company_name: '', contact_person: '', email: '', phone: '', gst_number: '', department_id: '', contract_start: '', contract_end: '' });
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to add contractor');
    }
  };

  const handleCreateWorker = async () => {
    if (!workerForm.first_name || !workerForm.contractor_id) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/labour/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(workerForm)
      });

      if (response.ok) {
        toast.success('Worker added');
        setShowAddWorker(false);
        setWorkerForm({ contractor_id: '', first_name: '', last_name: '', phone: '', aadhaar_number: '', department_id: '', skill_category: '', daily_rate: '', start_date: '' });
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to add worker');
    }
  };

  const getDeptName = (id) => departments.find(d => d.department_id === id)?.name || id || '-';
  const getContractorName = (id) => contractors.find(c => c.contractor_id === id)?.company_name || id || '-';

  const filteredWorkers = workers.filter(w => 
    `${w.first_name} ${w.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.worker_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isHR) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-600">You don't have permission to access this page</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="labour-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Labour Management
          </h1>
          <p className="text-slate-600 mt-1">Manage contractors and contract workers</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddContractor} onOpenChange={setShowAddContractor}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Building className="w-4 h-4" />
                Add Contractor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Contractor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={contractorForm.name} onChange={(e) => setContractorForm({...contractorForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input value={contractorForm.company_name} onChange={(e) => setContractorForm({...contractorForm, company_name: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={contractorForm.contact_person} onChange={(e) => setContractorForm({...contractorForm, contact_person: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={contractorForm.phone} onChange={(e) => setContractorForm({...contractorForm, phone: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={contractorForm.email} onChange={(e) => setContractorForm({...contractorForm, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input value={contractorForm.gst_number} onChange={(e) => setContractorForm({...contractorForm, gst_number: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contract Start</Label>
                    <Input type="date" value={contractorForm.contract_start} onChange={(e) => setContractorForm({...contractorForm, contract_start: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contract End</Label>
                    <Input type="date" value={contractorForm.contract_end} onChange={(e) => setContractorForm({...contractorForm, contract_end: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddContractor(false)}>Cancel</Button>
                <Button onClick={handleCreateContractor}>Add Contractor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddWorker} onOpenChange={setShowAddWorker}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Contract Worker</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Contractor *</Label>
                  <Select value={workerForm.contractor_id} onValueChange={(v) => setWorkerForm({...workerForm, contractor_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
                    <SelectContent>
                      {contractors.map(c => (
                        <SelectItem key={c.contractor_id} value={c.contractor_id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input value={workerForm.first_name} onChange={(e) => setWorkerForm({...workerForm, first_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={workerForm.last_name} onChange={(e) => setWorkerForm({...workerForm, last_name: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={workerForm.phone} onChange={(e) => setWorkerForm({...workerForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar</Label>
                    <Input value={workerForm.aadhaar_number} onChange={(e) => setWorkerForm({...workerForm, aadhaar_number: e.target.value})} maxLength={12} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={workerForm.department_id} onValueChange={(v) => setWorkerForm({...workerForm, department_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Rate (₹)</Label>
                    <Input type="number" value={workerForm.daily_rate} onChange={(e) => setWorkerForm({...workerForm, daily_rate: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Skill Category</Label>
                    <Select value={workerForm.skill_category} onValueChange={(v) => setWorkerForm({...workerForm, skill_category: v})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skilled">Skilled</SelectItem>
                        <SelectItem value="semi_skilled">Semi-Skilled</SelectItem>
                        <SelectItem value="unskilled">Unskilled</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={workerForm.start_date} onChange={(e) => setWorkerForm({...workerForm, start_date: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddWorker(false)}>Cancel</Button>
                <Button onClick={handleCreateWorker}>Add Worker</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.total_contractors || contractors.length}</p>
                <p className="text-xs text-slate-500">Contractors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <HardHat className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.total_workers || workers.length}</p>
                <p className="text-xs text-slate-500">Workers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.present_today || 0}</p>
                <p className="text-xs text-slate-500">Present Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workers.filter(w => w.status === 'active').length}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workers" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="workers" className="gap-2">
            <HardHat className="w-4 h-4" />
            Workers ({workers.length})
          </TabsTrigger>
          <TabsTrigger value="contractors" className="gap-2">
            <Building className="w-4 h-4" />
            Contractors ({contractors.length})
          </TabsTrigger>
        </TabsList>

        {/* Workers Tab */}
        <TabsContent value="workers">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Worker ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Daily Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.length > 0 ? filteredWorkers.map((worker) => (
                    <TableRow key={worker.worker_id}>
                      <TableCell className="font-mono text-sm">{worker.worker_id}</TableCell>
                      <TableCell className="font-medium">{worker.first_name} {worker.last_name}</TableCell>
                      <TableCell>{getContractorName(worker.contractor_id)}</TableCell>
                      <TableCell>{getDeptName(worker.department_id)}</TableCell>
                      <TableCell>₹{worker.daily_rate || '-'}</TableCell>
                      <TableCell>
                        <Badge className={worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {worker.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No workers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contractors Tab */}
        <TabsContent value="contractors">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>ID</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Contract Period</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractors.length > 0 ? contractors.map((cont) => (
                    <TableRow key={cont.contractor_id}>
                      <TableCell className="font-mono text-sm">{cont.contractor_id}</TableCell>
                      <TableCell className="font-medium">{cont.company_name}</TableCell>
                      <TableCell>{cont.contact_person || cont.name}</TableCell>
                      <TableCell>{cont.phone || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {cont.contract_start && cont.contract_end ? 
                          `${new Date(cont.contract_start).toLocaleDateString('en-IN')} - ${new Date(cont.contract_end).toLocaleDateString('en-IN')}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cont.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {cont.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No contractors found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LabourPage;
