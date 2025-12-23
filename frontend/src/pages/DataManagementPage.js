import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Filter,
  Calendar,
  Building,
  User,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldAlert
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DataManagementPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Dialog states
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showDeleteAllTypeDialog, setShowDeleteAllTypeDialog] = useState(false);
  const [showDeleteEverythingDialog, setShowDeleteEverythingDialog] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [deleteEverythingText, setDeleteEverythingText] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Current operation state
  const [currentDataType, setCurrentDataType] = useState(null);
  const [deleteType, setDeleteType] = useState('soft');
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    department: 'all',
    employee_id: 'all',
    status: 'all'
  });

  const isAuthorized = user?.role === 'super_admin' || user?.role === 'hr_admin';

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
      fetchFilterOptions();
    }
  }, [isAuthorized]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/data-management/stats`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      toast.error('Failed to fetch data statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        fetch(`${API_URL}/data-management/departments`, { credentials: 'include' }),
        fetch(`${API_URL}/data-management/employees-list`, { credentials: 'include' })
      ]);
      
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const openBulkDeleteDialog = (dataType) => {
    setCurrentDataType(dataType);
    setFilters({ date_from: '', date_to: '', department: '', employee_id: '', status: '' });
    setDeleteType('soft');
    setConfirmStep(1);
    setShowBulkDeleteDialog(true);
  };

  const openDeleteAllTypeDialog = (dataType) => {
    setCurrentDataType(dataType);
    setDeleteType('soft');
    setConfirmStep(1);
    setShowDeleteAllTypeDialog(true);
  };

  const handleBulkDelete = async () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }

    setProcessing(true);
    try {
      // Process filters to convert "all" values to empty strings
      const processedFilters = {
        ...filters,
        department: filters.department === 'all' ? '' : filters.department,
        employee_id: filters.employee_id === 'all' ? '' : filters.employee_id,
        status: filters.status === 'all' ? '' : filters.status
      };
      
      const response = await fetch(`${API_URL}/data-management/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data_type: currentDataType,
          delete_type: deleteType,
          filters: processedFilters
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        setShowBulkDeleteDialog(false);
        fetchStats();
      } else {
        toast.error(result.detail || 'Delete failed');
      }
    } catch (error) {
      toast.error('Failed to delete records');
    } finally {
      setProcessing(false);
      setConfirmStep(1);
    }
  };

  const handleDeleteAllType = async () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/data-management/delete-all-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data_type: currentDataType,
          delete_type: deleteType
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        setShowDeleteAllTypeDialog(false);
        fetchStats();
      } else {
        toast.error(result.detail || 'Delete failed');
      }
    } catch (error) {
      toast.error('Failed to delete records');
    } finally {
      setProcessing(false);
      setConfirmStep(1);
    }
  };

  const handleDeleteEverything = async () => {
    if (deleteEverythingText !== 'DELETE ALL DATA') {
      toast.error('Please type "DELETE ALL DATA" exactly to confirm');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/data-management/delete-everything`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          confirmation_text: deleteEverythingText,
          delete_type: 'hard'
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        setShowDeleteEverythingDialog(false);
        setDeleteEverythingText('');
        fetchStats();
      } else {
        toast.error(result.detail || 'Delete failed');
      }
    } catch (error) {
      toast.error('Failed to delete all data');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async (dataType) => {
    try {
      const response = await fetch(`${API_URL}/data-management/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data_type: dataType })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        fetchStats();
      } else {
        toast.error(result.detail || 'Restore failed');
      }
    } catch (error) {
      toast.error('Failed to restore records');
    }
  };

  const getStatusBadge = (stat) => {
    if (stat.deleted_count > 0) {
      return <Badge variant="outline" className="text-amber-600">Has Deleted</Badge>;
    }
    if (stat.total_count === 0) {
      return <Badge variant="outline" className="text-slate-400">Empty</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">Only Admin and HR users can access Data Management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
            <p className="text-slate-500">Manage and delete data in bulk</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Caution: Data Deletion</p>
            <p className="text-sm text-amber-700">
              Deleted data may be unrecoverable. Soft-deleted records can be restored, but hard-deleted records are permanently removed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Overview</CardTitle>
          <CardDescription>View and manage all data types in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Type</TableHead>
                  <TableHead className="text-center">Total Records</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Deleted</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.data_type}>
                    <TableCell>
                      <div className="font-medium">{stat.display_name}</div>
                      <div className="text-xs text-slate-400">{stat.collection}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-lg">{stat.total_count.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-emerald-600 font-medium">{stat.active_count.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600 font-medium">{stat.deleted_count.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(stat)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            Actions
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openBulkDeleteDialog(stat.data_type)}>
                            <Filter className="w-4 h-4 mr-2" />
                            Bulk Delete with Filters
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => openDeleteAllTypeDialog(stat.data_type)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete All {stat.display_name}
                          </DropdownMenuItem>
                          {stat.deleted_count > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRestore(stat.data_type)}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restore Deleted ({stat.deleted_count})
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Everything Section */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions that affect all data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="font-medium text-red-800">Delete Everything</p>
              <p className="text-sm text-red-600">
                Permanently delete all data in the system. User accounts will be preserved.
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteEverythingDialog(true)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Delete - {stats.find(s => s.data_type === currentDataType)?.display_name}</DialogTitle>
            <DialogDescription>
              {confirmStep === 1 ? 'Configure filters and deletion type' : 'Confirm your deletion'}
            </DialogDescription>
          </DialogHeader>
          
          {confirmStep === 1 ? (
            <div className="space-y-4 py-4">
              {/* Delete Type */}
              <div className="space-y-2">
                <Label>Deletion Type</Label>
                <Select value={deleteType} onValueChange={setDeleteType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Soft Delete (Recoverable)</SelectItem>
                    <SelectItem value="hard">Hard Delete (Permanent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date From
                  </Label>
                  <Input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  />
                </div>
              </div>

              {/* Department Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building className="w-3 h-3" /> Department
                </Label>
                <Select value={filters.department} onValueChange={(v) => setFilters({ ...filters, department: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="w-3 h-3" /> Employee
                </Label>
                <Select value={filters.employee_id} onValueChange={(v) => setFilters({ ...filters, employee_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.employee_id} value={e.employee_id}>
                        {e.name} ({e.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="py-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <p className="text-center text-slate-700 mb-4">
                Are you sure you want to <strong>{deleteType === 'hard' ? 'permanently delete' : 'soft delete'}</strong> the selected records?
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p><strong>Data Type:</strong> {stats.find(s => s.data_type === currentDataType)?.display_name}</p>
                <p><strong>Delete Type:</strong> {deleteType === 'hard' ? 'Permanent (Unrecoverable)' : 'Soft (Recoverable)'}</p>
                {filters.date_from && <p><strong>From:</strong> {filters.date_from}</p>}
                {filters.date_to && <p><strong>To:</strong> {filters.date_to}</p>}
                {filters.department && <p><strong>Department:</strong> {filters.department}</p>}
                {filters.employee_id && <p><strong>Employee:</strong> {employees.find(e => e.employee_id === filters.employee_id)?.name}</p>}
                {filters.status && <p><strong>Status:</strong> {filters.status}</p>}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkDeleteDialog(false); setConfirmStep(1); }}>
              Cancel
            </Button>
            <Button 
              variant={confirmStep === 2 ? "destructive" : "default"}
              onClick={handleBulkDelete}
              disabled={processing}
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : confirmStep === 1 ? (
                'Continue'
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Confirm Delete</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All of Type Dialog */}
      <Dialog open={showDeleteAllTypeDialog} onOpenChange={setShowDeleteAllTypeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete All {stats.find(s => s.data_type === currentDataType)?.display_name}</DialogTitle>
            <DialogDescription>
              {confirmStep === 1 ? 'Choose deletion type' : 'This action cannot be undone for hard deletes'}
            </DialogDescription>
          </DialogHeader>
          
          {confirmStep === 1 ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-amber-800 font-medium">
                  Total records: {stats.find(s => s.data_type === currentDataType)?.total_count.toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Deletion Type</Label>
                <Select value={deleteType} onValueChange={setDeleteType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Soft Delete (Recoverable)</SelectItem>
                    <SelectItem value="hard">Hard Delete (Permanent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-slate-700 mb-2">
                You are about to <strong>{deleteType === 'hard' ? 'permanently delete' : 'soft delete'}</strong>
              </p>
              <p className="text-2xl font-bold text-red-600 mb-4">
                {stats.find(s => s.data_type === currentDataType)?.total_count.toLocaleString()} records
              </p>
              <p className="text-sm text-slate-500">
                {deleteType === 'hard' ? 'This action cannot be undone!' : 'Records can be restored later.'}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteAllTypeDialog(false); setConfirmStep(1); }}>
              Cancel
            </Button>
            <Button 
              variant={confirmStep === 2 ? "destructive" : "default"}
              onClick={handleDeleteAllType}
              disabled={processing}
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : confirmStep === 1 ? (
                'Continue'
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Confirm Delete All</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Everything Dialog */}
      <Dialog open={showDeleteEverythingDialog} onOpenChange={setShowDeleteEverythingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete All Data
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL data in the system
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-800 font-medium mb-2">Warning: This action is irreversible!</p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All employees, attendance, leave records will be deleted</li>
                <li>• All payroll, KPI, and performance data will be deleted</li>
                <li>• All assets, expenses, training records will be deleted</li>
                <li>• User accounts will be preserved for login</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label>Type <span className="font-mono font-bold">DELETE ALL DATA</span> to confirm:</Label>
              <Input
                value={deleteEverythingText}
                onChange={(e) => setDeleteEverythingText(e.target.value)}
                placeholder="Type here..."
                className={deleteEverythingText === 'DELETE ALL DATA' ? 'border-red-500' : ''}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteEverythingDialog(false); setDeleteEverythingText(''); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteEverything}
              disabled={processing || deleteEverythingText !== 'DELETE ALL DATA'}
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Everything</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataManagementPage;
