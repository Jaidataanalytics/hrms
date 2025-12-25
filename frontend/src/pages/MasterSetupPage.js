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
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  Building2,
  Users2,
  MapPin,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  Tag
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MasterSetupPage = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState('department');
  const [editItem, setEditItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_admin';

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    // Location specific
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Designation specific
    grade: '',
    band: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [deptRes, desigRes, locRes] = await Promise.all([
        fetch(`${API_URL}/departments`, { credentials: 'include' }),
        fetch(`${API_URL}/designations`, { credentials: 'include' }),
        fetch(`${API_URL}/locations`, { credentials: 'include' })
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (desigRes.ok) setDesignations(await desigRes.json());
      if (locRes.ok) setLocations(await locRes.json());
    } catch (error) {
      console.error('Error fetching master data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      code: '',
      description: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      grade: '',
      band: ''
    });
    setEditItem(null);
  };

  const openCreateDialog = (type) => {
    setDialogType(type);
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (type, item) => {
    setDialogType(type);
    setEditItem(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      pincode: item.pincode || '',
      grade: item.grade || '',
      band: item.band || ''
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      toast.error('Name and Code are required');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = dialogType === 'department' ? 'departments' 
        : dialogType === 'designation' ? 'designations' 
        : 'locations';

      let payload = { name: form.name, code: form.code, description: form.description };

      if (dialogType === 'location') {
        payload = { ...payload, address: form.address, city: form.city, state: form.state, pincode: form.pincode };
      } else if (dialogType === 'designation') {
        payload = { ...payload, grade: form.grade, band: form.band };
      }

      // Determine if this is an edit or create
      const isEdit = editItem !== null;
      const itemId = editItem?.department_id || editItem?.designation_id || editItem?.location_id;
      
      const url = isEdit ? `${API_URL}/${endpoint}/${itemId}` : `${API_URL}/${endpoint}`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(`${dialogType.charAt(0).toUpperCase() + dialogType.slice(1)} ${isEdit ? 'updated' : 'created'} successfully`);
        setShowDialog(false);
        resetForm();
        fetchAllData();
      } else {
        const error = await response.json();
        toast.error(error.detail || `Failed to ${isEdit ? 'update' : 'create'}`);
      }
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
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

  const dialogConfig = {
    department: { title: 'Department', icon: Building2 },
    designation: { title: 'Designation', icon: Briefcase },
    location: { title: 'Location', icon: MapPin }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="master-setup-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Master Setup
        </h1>
        <p className="text-slate-600 mt-1">Manage organizational structure and master data</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{departments.length}</p>
                <p className="text-xs text-slate-500">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{designations.length}</p>
                <p className="text-xs text-slate-500">Designations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-xs text-slate-500">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="departments" className="gap-2" data-testid="tab-departments">
            <Building2 className="w-4 h-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="designations" className="gap-2" data-testid="tab-designations">
            <Briefcase className="w-4 h-4" />
            Designations
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2" data-testid="tab-locations">
            <MapPin className="w-4 h-4" />
            Locations
          </TabsTrigger>
        </TabsList>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Departments</CardTitle>
                  <CardDescription>Manage company departments</CardDescription>
                </div>
                <Button className="gap-2" onClick={() => openCreateDialog('department')} data-testid="add-department-btn">
                  <Plus className="w-4 h-4" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.length > 0 ? departments.map((dept) => (
                    <TableRow key={dept.department_id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell><Badge variant="outline">{dept.code}</Badge></TableCell>
                      <TableCell className="text-slate-500">{dept.description || '-'}</TableCell>
                      <TableCell>
                        <Badge className={dept.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog('department', dept)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No departments found. Click "Add Department" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Designations Tab */}
        <TabsContent value="designations">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Designations</CardTitle>
                  <CardDescription>Manage job titles and grades</CardDescription>
                </div>
                <Button className="gap-2" onClick={() => openCreateDialog('designation')} data-testid="add-designation-btn">
                  <Plus className="w-4 h-4" />
                  Add Designation
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designations.length > 0 ? designations.map((desig) => (
                    <TableRow key={desig.designation_id}>
                      <TableCell className="font-medium">{desig.name}</TableCell>
                      <TableCell><Badge variant="outline">{desig.code}</Badge></TableCell>
                      <TableCell>{desig.grade || '-'}</TableCell>
                      <TableCell>{desig.band || '-'}</TableCell>
                      <TableCell>
                        <Badge className={desig.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {desig.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog('designation', desig)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No designations found. Click "Add Designation" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Locations</CardTitle>
                  <CardDescription>Manage office locations</CardDescription>
                </div>
                <Button className="gap-2" onClick={() => openCreateDialog('location')} data-testid="add-location-btn">
                  <Plus className="w-4 h-4" />
                  Add Location
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.length > 0 ? locations.map((loc) => (
                    <TableRow key={loc.location_id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell><Badge variant="outline">{loc.code}</Badge></TableCell>
                      <TableCell>{loc.city || '-'}</TableCell>
                      <TableCell>{loc.state || '-'}</TableCell>
                      <TableCell>
                        <Badge className={loc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {loc.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog('location', loc)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No locations found. Click "Add Location" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {React.createElement(dialogConfig[dialogType]?.icon || Building2, { className: 'w-5 h-5 text-primary' })}
              {editItem ? 'Edit' : 'Add'} {dialogConfig[dialogType]?.title}
            </DialogTitle>
            <DialogDescription>
              {editItem ? 'Update the details below' : 'Fill in the details to create a new entry'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Engineering"
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., ENG"
                  data-testid="input-code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            {/* Location specific fields */}
            {dialogType === 'location' && (
              <>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Mumbai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="400001"
                    maxLength={6}
                  />
                </div>
              </>
            )}

            {/* Designation specific fields */}
            {dialogType === 'designation' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Input
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="e.g., L5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Band</Label>
                  <Input
                    value={form.band}
                    onChange={(e) => setForm({ ...form, band: e.target.value })}
                    placeholder="e.g., B2"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} data-testid="submit-btn">
              {submitting ? 'Saving...' : (editItem ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterSetupPage;
