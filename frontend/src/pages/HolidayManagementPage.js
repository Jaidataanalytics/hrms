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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  AlertCircle,
  PartyPopper,
  Loader2
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const HolidayManagementPage = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [editingHoliday, setEditingHoliday] = useState(null);
  
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    type: 'public',
    is_half_day: false
  });

  const isAuthorized = user?.role === 'super_admin' || user?.role === 'hr_admin';
  
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    if (isAuthorized) {
      fetchHolidays();
    }
  }, [isAuthorized, selectedYear]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/holidays?year=${selectedYear}`, {
        credentials: 'include',
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!formData.date || !formData.name) {
      toast.error('Date and name are required');
      return;
    }

    setProcessing(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      const response = await fetch(`${API_URL}/holidays`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Holiday added successfully');
        setShowAddDialog(false);
        setFormData({ date: '', name: '', type: 'public', is_half_day: false });
        fetchHolidays();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add holiday');
      }
    } catch (error) {
      toast.error('Failed to add holiday');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateHoliday = async () => {
    if (!editingHoliday || !formData.date || !formData.name) {
      toast.error('Date and name are required');
      return;
    }

    setProcessing(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      const response = await fetch(`${API_URL}/holidays/${editingHoliday.holiday_id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Holiday updated successfully');
        setShowEditDialog(false);
        setEditingHoliday(null);
        setFormData({ date: '', name: '', type: 'public' });
        fetchHolidays();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update holiday');
      }
    } catch (error) {
      toast.error('Failed to update holiday');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/holidays/${holidayId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Holiday deleted successfully');
        fetchHolidays();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete holiday');
      }
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  const openEditDialog = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type || 'public'
    });
    setShowEditDialog(true);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'public': return 'bg-emerald-100 text-emerald-700';
      case 'restricted': return 'bg-amber-100 text-amber-700';
      case 'optional': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-slate-500">Only Admin and HR users can manage holidays.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Holiday Management
          </h1>
          <p className="text-slate-600 mt-1">
            Manage company holidays for attendance calculation
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <PartyPopper className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {holidays.filter(h => h.type === 'public').length}
                </p>
                <p className="text-xs text-slate-500">Public Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {holidays.filter(h => h.type === 'restricted').length}
                </p>
                <p className="text-xs text-slate-500">Restricted Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {holidays.filter(h => h.type === 'optional').length}
                </p>
                <p className="text-xs text-slate-500">Optional Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holidays Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Holidays for {selectedYear}</CardTitle>
          <CardDescription>
            These dates will be excluded from absent calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-slate-500">Loading holidays...</p>
            </div>
          ) : holidays.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => {
                    const date = new Date(holiday.date);
                    return (
                      <TableRow key={holiday.holiday_id}>
                        <TableCell className="font-medium">
                          {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          {date.toLocaleDateString('en-IN', { weekday: 'long' })}
                        </TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(holiday.type)}>
                            {holiday.type?.charAt(0).toUpperCase() + holiday.type?.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(holiday)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteHoliday(holiday.holiday_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">No holidays added for {selectedYear}</p>
              <p className="text-xs text-slate-400">Click "Add Holiday" to add holidays</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a new holiday to the calendar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g., Republic Day"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public Holiday</SelectItem>
                  <SelectItem value="restricted">Restricted Holiday</SelectItem>
                  <SelectItem value="optional">Optional Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_half_day"
                checked={formData.is_half_day}
                onChange={(e) => setFormData({ ...formData, is_half_day: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="is_half_day" className="text-sm font-normal">
                Half-day holiday (employees work half day)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHoliday} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
            <DialogDescription>
              Update holiday details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g., Republic Day"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public Holiday</SelectItem>
                  <SelectItem value="restricted">Restricted Holiday</SelectItem>
                  <SelectItem value="optional">Optional Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateHoliday} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit2 className="w-4 h-4 mr-2" />}
              Update Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidayManagementPage;
