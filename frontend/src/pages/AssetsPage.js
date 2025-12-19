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
  Hash
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [assetForm, setAssetForm] = useState({
    name: '', asset_tag: '', category: 'laptop', brand: '', model: '',
    serial_number: '', purchase_date: '', purchase_cost: '', condition: 'good'
  });

  const [requestForm, setRequestForm] = useState({
    category: 'laptop', description: '', justification: ''
  });
  const [selectedAsset, setSelectedAsset] = useState(null);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'it_admin';

  const fetchAssetDetails = async (assetId) => {
    try {
      const response = await fetch(`${API_URL}/assets/${assetId}`, { credentials: 'include' });
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

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterStatus]);

  const fetchData = async () => {
    try {
      const promises = [
        fetch(`${API_URL}/my-assets`, { credentials: 'include' }),
        fetch(`${API_URL}/asset-requests`, { credentials: 'include' })
      ];

      if (isAdmin) {
        let url = `${API_URL}/assets?`;
        if (filterCategory !== 'all') url += `category=${filterCategory}&`;
        if (filterStatus !== 'all') url += `status=${filterStatus}&`;
        promises.push(fetch(url, { credentials: 'include' }));
      }

      const responses = await Promise.all(promises);
      
      if (responses[0].ok) setMyAssets(await responses[0].json());
      if (responses[1].ok) setRequests(await responses[1].json());
      if (isAdmin && responses[2]?.ok) setAssets(await responses[2].json());
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
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

      <Tabs defaultValue="my-assets" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="my-assets" data-testid="tab-my-assets">My Assets</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">My Requests</TabsTrigger>
          {isAdmin && <TabsTrigger value="all" data-testid="tab-all">All Assets</TabsTrigger>}
        </TabsList>

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
    </div>
  );
};

export default AssetsPage;
