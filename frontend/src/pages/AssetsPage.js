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
  Package,
  Plus,
  Laptop,
  Monitor,
  Smartphone,
  Car,
  Search,
  RefreshCw,
  UserPlus,
  RotateCcw,
  Eye,
  Calendar,
  IndianRupee,
  Tag,
  Hash,
  Edit,
  Trash2,
  ArrowRightLeft,
  Printer,
  Phone
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AssetsPage = () => {
  const { user, getAuthHeaders } = useAuth();
  const [assets, setAssets] = useState([]);
  const [employeeAssets, setEmployeeAssets] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('inventory');
  
  // Asset operations state
  const [editAssetOpen, setEditAssetOpen] = useState(false);
  const [reassignAssetOpen, setReassignAssetOpen] = useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');

  const [assetForm, setAssetForm] = useState({
    name: '', asset_tag: '', category: 'laptop', brand: '', model: '',
    serial_number: '', purchase_date: '', purchase_cost: '', condition: 'good'
  });

  const [requestForm, setRequestForm] = useState({
    category: 'laptop', description: '', justification: ''
  });
  const [selectedAsset, setSelectedAsset] = useState(null);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'it_admin' || user?.role === 'hr_executive';

  const fetchAssetDetails = async (assetId) => {
    try {
      const response = await fetch(`${API_URL}/assets/${assetId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setSelectedAsset(data);
      } else {
        toast.error('Failed to fetch asset details');
      }
    } catch (error) {
      toast.error('Failed to fetch asset details');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/assets/employees/list`, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) {
        setEmployees(await response.json());
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  useEffect(() => {
    fetchData();
    if (isAdmin) fetchEmployees();
  }, [filterType, filterStatus, searchTerm]);

  const fetchData = async () => {
    try {
      const promises = [
        fetch(`${API_URL}/my-assets`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/asset-requests`, { credentials: 'include', headers: getAuthHeaders() })
      ];

      if (isAdmin) {
        // Fetch asset inventory
        let url = `${API_URL}/assets?`;
        if (filterType !== 'all') url += `asset_type=${filterType}&`;
        if (filterStatus !== 'all') url += `status=${filterStatus}&`;
        if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
        promises.push(fetch(url, { credentials: 'include', headers: getAuthHeaders() }));
        
        // Fetch employee asset assignments
        let empAssetsUrl = `${API_URL}/assets/employee-assignments?`;
        if (searchTerm) empAssetsUrl += `search=${encodeURIComponent(searchTerm)}&`;
        promises.push(fetch(empAssetsUrl, { credentials: 'include', headers: getAuthHeaders() }));
      }

      const responses = await Promise.all(promises);
      
      if (responses[0].ok) setMyAssets(await responses[0].json());
      if (responses[1].ok) setRequests(await responses[1].json());
      if (isAdmin && responses[2]?.ok) {
        const assetData = await responses[2].json();
        setAssets(assetData.assets || []);
      }
      if (isAdmin && responses[3]?.ok) {
        const empData = await responses[3].json();
        setEmployeeAssets(empData.records || []);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Asset operations
  const handleEditAsset = (asset) => {
    setSelectedAssetForEdit(asset);
    setEditAssetOpen(true);
  };

  const handleSaveAssetEdit = async () => {
    if (!selectedAssetForEdit) return;
    
    try {
      const response = await fetch(`${API_URL}/assets/${selectedAssetForEdit.asset_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          description: selectedAssetForEdit.description,
          asset_tag: selectedAssetForEdit.asset_tag,
          asset_type: selectedAssetForEdit.asset_type,
        })
      });
      
      if (response.ok) {
        toast.success('Asset updated successfully');
        setEditAssetOpen(false);
        fetchData();
      } else {
        toast.error('Failed to update asset');
      }
    } catch (error) {
      toast.error('Failed to update asset');
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    try {
      const response = await fetch(`${API_URL}/assets/${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        toast.success('Asset deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete asset');
      }
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const handleUnassignAsset = async (assetId) => {
    if (!confirm('Return this asset to inventory?')) return;
    
    try {
      const response = await fetch(`${API_URL}/assets/${assetId}/unassign`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        toast.success('Asset returned to inventory');
        fetchData();
      } else {
        toast.error('Failed to unassign asset');
      }
    } catch (error) {
      toast.error('Failed to unassign asset');
    }
  };

  const handleReassignAsset = (asset) => {
    setSelectedAssetForEdit(asset);
    setSelectedEmployeeCode('');
    setReassignAssetOpen(true);
  };

  const handleSaveReassign = async () => {
    if (!selectedAssetForEdit || !selectedEmployeeCode) {
      toast.error('Please select an employee');
      return;
    }
    
    try {
      const selectedEmp = employees.find(e => e.emp_code === selectedEmployeeCode);
      const response = await fetch(`${API_URL}/assets/${selectedAssetForEdit.asset_id}/reassign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          emp_code: selectedEmployeeCode,
          employee_name: selectedEmp?.name || selectedEmployeeCode
        })
      });
      
      if (response.ok) {
        toast.success('Asset reassigned successfully');
        setReassignAssetOpen(false);
        fetchData();
      } else {
        toast.error('Failed to reassign asset');
      }
    } catch (error) {
      toast.error('Failed to reassign asset');
    }
  };

  const handleDeleteEmployeeAssignment = async (empCode) => {
    if (!confirm('Delete this employee assignment and unassign all their assets?')) return;
    
    try {
      const response = await fetch(`${API_URL}/assets/employee-assignments/${empCode}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        toast.success('Employee assignment deleted');
        fetchData();
      } else {
        toast.error('Failed to delete assignment');
      }
    } catch (error) {
      toast.error('Failed to delete assignment');
    }
  };

  const handleCreateAsset = async () => {
    if (!assetForm.name || !assetForm.asset_tag) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assetForm)
      });

      if (response.ok) {
        toast.success('Asset created');
        setShowAddAsset(false);
        setAssetForm({
          name: '', asset_tag: '', category: 'laptop', brand: '', model: '',
          serial_number: '', purchase_date: '', purchase_cost: '', condition: 'good'
        });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create asset');
      }
    } catch (error) {
      toast.error('Failed to create asset');
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.description) {
      toast.error('Please describe your request');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/asset-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestForm)
      });

      if (response.ok) {
        toast.success('Request submitted');
        setShowRequest(false);
        setRequestForm({ category: 'laptop', description: '', justification: '' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to submit request');
      }
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const categoryIcons = {
    laptop: Laptop,
    mobile: Smartphone,
    monitor: Monitor,
    vehicle: Car,
    other: Package
  };

  const statusColors = {
    available: 'bg-emerald-100 text-emerald-700',
    assigned: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-amber-100 text-amber-700',
    disposed: 'bg-slate-100 text-slate-600'
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_tag.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="assets-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Asset Management
          </h1>
          <p className="text-slate-600 mt-1">Manage company assets and equipment</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showRequest} onOpenChange={setShowRequest}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="request-asset-btn">
                <Plus className="w-4 h-4" />
                Request Asset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Asset</DialogTitle>
                <DialogDescription>Submit a request for equipment</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={requestForm.category} onValueChange={(v) => setRequestForm({ ...requestForm, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="mobile">Mobile Phone</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={requestForm.description}
                    onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                    placeholder="Describe what you need..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Justification</Label>
                  <Textarea
                    value={requestForm.justification}
                    onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                    placeholder="Why do you need this?"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRequest(false)}>Cancel</Button>
                <Button onClick={handleSubmitRequest}>Submit Request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isAdmin && (
            <Dialog open={showAddAsset} onOpenChange={setShowAddAsset}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="add-asset-btn">
                  <Plus className="w-4 h-4" />
                  Add Asset
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Asset</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Asset Name *</Label>
                      <Input
                        value={assetForm.name}
                        onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                        placeholder="MacBook Pro 14"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Asset Tag *</Label>
                      <Input
                        value={assetForm.asset_tag}
                        onChange={(e) => setAssetForm({ ...assetForm, asset_tag: e.target.value })}
                        placeholder="AST-001"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={assetForm.category} onValueChange={(v) => setAssetForm({ ...assetForm, category: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="laptop">Laptop</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="monitor">Monitor</SelectItem>
                          <SelectItem value="furniture">Furniture</SelectItem>
                          <SelectItem value="vehicle">Vehicle</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Brand</Label>
                      <Input
                        value={assetForm.brand}
                        onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                        placeholder="Apple"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Input
                        value={assetForm.model}
                        onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                        placeholder="M3 Pro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Serial Number</Label>
                      <Input
                        value={assetForm.serial_number}
                        onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                        placeholder="ABC123XYZ"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Purchase Date</Label>
                      <Input
                        type="date"
                        value={assetForm.purchase_date}
                        onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Cost (₹)</Label>
                      <Input
                        type="number"
                        value={assetForm.purchase_cost}
                        onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: e.target.value })}
                        placeholder="150000"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddAsset(false)}>Cancel</Button>
                  <Button onClick={handleCreateAsset}>Add Asset</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue={isAdmin ? "assignments" : "my-assets"} className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="my-assets" data-testid="tab-my-assets">My Assets</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">My Requests</TabsTrigger>
          {isAdmin && <TabsTrigger value="assignments" data-testid="tab-assignments">Employee Assignments</TabsTrigger>}
          {isAdmin && <TabsTrigger value="all" data-testid="tab-all">Asset Inventory</TabsTrigger>}
        </TabsList>

        {/* Employee Asset Assignments (from bulk import) - Admin Only */}
        {isAdmin && (
          <TabsContent value="assignments">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Employee Asset Assignments
                    </CardTitle>
                    <CardDescription>Assets assigned to employees (from bulk import)</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search by name, code, SDPL..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                        data-testid="search-employee-assets"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {employeeAssets.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Emp Code</TableHead>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>SDPL Number</TableHead>
                        <TableHead>Tag</TableHead>
                        <TableHead className="text-center">Mobile/Charger</TableHead>
                        <TableHead className="text-center">Laptop</TableHead>
                        <TableHead className="text-center">System</TableHead>
                        <TableHead className="text-center">Printer</TableHead>
                        <TableHead>SIM/Mobile No</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeAssets.map((asset) => (
                        <TableRow key={asset.asset_record_id || asset.emp_code} data-testid={`emp-asset-${asset.emp_code}`}>
                          <TableCell className="font-medium">{asset.emp_code}</TableCell>
                          <TableCell>{asset.employee_name || '-'}</TableCell>
                          <TableCell>{asset.sdpl_number || '-'}</TableCell>
                          <TableCell>{asset.tag || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={asset.mobile_charger ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                              {asset.mobile_charger ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={asset.laptop ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                              {asset.laptop ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={asset.system ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                              {asset.system ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={asset.printer ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                              {asset.printer ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell>{asset.sim_mobile_no || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">No employee asset assignments found</p>
                    <p className="text-sm text-slate-400">Import assets via Bulk Import → Assets template</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* My Assets */}
        <TabsContent value="my-assets">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Assigned Assets
              </CardTitle>
              <CardDescription>Equipment assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {myAssets.length > 0 ? (
                <div className="space-y-3">
                  {myAssets.map((asset) => {
                    const IconComponent = categoryIcons[asset.category] || Package;
                    return (
                      <div
                        key={asset.asset_id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <IconComponent className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{asset.name}</p>
                            <p className="text-sm text-slate-500">
                              {asset.asset_tag} • {asset.brand} {asset.model}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusColors.assigned}>Assigned</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No assets assigned to you</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Requests */}
        <TabsContent value="requests">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Asset Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.request_id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-slate-900 capitalize">{req.category}</p>
                        <p className="text-sm text-slate-500">{req.description}</p>
                      </div>
                      <Badge className={
                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }>
                        {req.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500">No asset requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Assets (Admin) */}
        {isAdmin && (
          <TabsContent value="all">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Asset</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => (
                        <TableRow 
                          key={asset.asset_id} 
                          className="cursor-pointer hover:bg-slate-100"
                          onClick={() => fetchAssetDetails(asset.asset_id)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{asset.name}</p>
                              <p className="text-xs text-slate-500">{asset.brand} {asset.model}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{asset.asset_tag}</TableCell>
                          <TableCell className="capitalize">{asset.category}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[asset.status]}>{asset.status}</Badge>
                          </TableCell>
                          <TableCell>{asset.assigned_to || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" onClick={() => fetchAssetDetails(asset.asset_id)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {asset.status === 'available' && (
                                <Button size="sm" variant="outline" className="gap-1">
                                  <UserPlus className="w-3 h-3" />
                                  Assign
                                </Button>
                              )}
                              {asset.status === 'assigned' && (
                                <Button size="sm" variant="outline" className="gap-1">
                                  <RotateCcw className="w-3 h-3" />
                                  Return
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-500">No assets found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Asset Details Modal */}
      <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset?.category && categoryIcons[selectedAsset.category] && 
                React.createElement(categoryIcons[selectedAsset.category], { className: "w-5 h-5 text-primary" })
              }
              {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>Asset Details</DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedAsset.status]}>{selectedAsset.status}</Badge>
                <Badge variant="outline" className="capitalize">{selectedAsset.condition}</Badge>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Asset Tag</p>
                  </div>
                  <p className="font-mono font-medium">{selectedAsset.asset_tag}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Serial Number</p>
                  </div>
                  <p className="font-mono font-medium">{selectedAsset.serial_number || '-'}</p>
                </div>
              </div>

              {/* Brand & Model */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Brand & Model</p>
                <p className="font-medium">{selectedAsset.brand || '-'} {selectedAsset.model || ''}</p>
              </div>

              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Purchase Date</p>
                  </div>
                  <p className="font-medium">
                    {selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString('en-IN') : '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500">Purchase Cost</p>
                  </div>
                  <p className="font-medium">
                    {selectedAsset.purchase_cost ? `₹${selectedAsset.purchase_cost.toLocaleString('en-IN')}` : '-'}
                  </p>
                </div>
              </div>

              {/* Warranty */}
              {selectedAsset.warranty_expiry && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1">Warranty Expiry</p>
                  <p className="font-medium text-amber-700">
                    {new Date(selectedAsset.warranty_expiry).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}

              {/* Assignment Info */}
              {selectedAsset.assigned_to && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Assigned To</p>
                  <p className="font-medium text-blue-700">{selectedAsset.assigned_to}</p>
                  {selectedAsset.assigned_date && (
                    <p className="text-xs text-blue-500 mt-1">
                      Since {new Date(selectedAsset.assigned_date).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedAsset.notes && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{selectedAsset.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAsset(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetsPage;
