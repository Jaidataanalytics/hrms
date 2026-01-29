import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Building, Plus, RefreshCw, Users, IndianRupee, Calendar, Trash2, Edit, User,
  FileText, Clock, Upload, Download, Eye, Phone, MapPin, ChevronLeft, Save, X,
  CheckCircle, XCircle, Briefcase
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ContractLabourPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('workers');
  
  // Contractors state
  const [contractors, setContractors] = useState([]);
  const [showContractorDialog, setShowContractorDialog] = useState(false);
  const [editingContractor, setEditingContractor] = useState(null);
  const [contractorForm, setContractorForm] = useState({
    name: '', company_name: '', contact_person: '', email: '', phone: '',
    address: '', gst_number: '', pan_number: '', contract_start: '', contract_end: ''
  });

  // Workers state
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    name: '', phone: '', address: '', aadhar_number: '', emergency_contact_name: '',
    emergency_contact_phone: '', contractor_id: '', daily_wage: '', joining_date: '',
    contract_end_date: '', photo_url: ''
  });
  
  // Worker detail tabs
  const [workerTab, setWorkerTab] = useState('profile');
  const [workerAttendance, setWorkerAttendance] = useState([]);
  const [workerDocuments, setWorkerDocuments] = useState([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState(null);

  // Document upload
  const [showDocUploadDialog, setShowDocUploadDialog] = useState(false);
  const [docUploadForm, setDocUploadForm] = useState({ document_type: '', file: null });
  const [uploading, setUploading] = useState(false);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchContractors();
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorker) {
      fetchWorkerAttendance();
      fetchWorkerDocuments();
      calculatePayroll();
    }
  }, [selectedWorker, attendanceMonth, payrollMonth]);

  const fetchContractors = async () => {
    try {
      const response = await fetch(`${API_URL}/labour/contractors`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (response.ok) setContractors(await response.json());
    } catch (error) {
      console.error('Error fetching contractors:', error);
    }
  };

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/labour/workers`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (response.ok) setWorkers(await response.json());
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerAttendance = async () => {
    if (!selectedWorker) return;
    try {
      const [year, month] = attendanceMonth.split('-');
      const response = await fetch(
        `${API_URL}/labour/attendance?worker_id=${selectedWorker.worker_id}&month=${month}&year=${year}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) setWorkerAttendance(await response.json());
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchWorkerDocuments = async () => {
    if (!selectedWorker) return;
    try {
      const response = await fetch(
        `${API_URL}/labour/workers/${selectedWorker.worker_id}/documents`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        setWorkerDocuments(await response.json());
      } else {
        setWorkerDocuments([]);
      }
    } catch (error) {
      setWorkerDocuments([]);
    }
  };

  const calculatePayroll = () => {
    if (!selectedWorker || !workerAttendance.length) {
      setPayrollData(null);
      return;
    }

    const dailyWage = parseFloat(selectedWorker.daily_wage) || 0;
    const presentDays = workerAttendance.filter(a => a.status === 'present' || a.status === 'half_day').length;
    const halfDays = workerAttendance.filter(a => a.status === 'half_day').length;
    const absentDays = workerAttendance.filter(a => a.status === 'absent').length;
    
    const totalDays = presentDays - (halfDays * 0.5);
    const grossPay = totalDays * dailyWage;

    setPayrollData({
      daily_wage: dailyWage,
      present_days: presentDays,
      half_days: halfDays,
      absent_days: absentDays,
      total_working_days: totalDays,
      gross_pay: grossPay,
      deductions: 0,
      net_pay: grossPay
    });
  };

  const handleSaveContractor = async () => {
    try {
      const url = editingContractor 
        ? `${API_URL}/labour/contractors/${editingContractor.contractor_id}`
        : `${API_URL}/labour/contractors`;
      const method = editingContractor ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(contractorForm)
      });

      if (response.ok) {
        toast.success(editingContractor ? 'Contractor updated' : 'Contractor added');
        setShowContractorDialog(false);
        setEditingContractor(null);
        setContractorForm({
          name: '', company_name: '', contact_person: '', email: '', phone: '',
          address: '', gst_number: '', pan_number: '', contract_start: '', contract_end: ''
        });
        fetchContractors();
      } else {
        toast.error('Failed to save contractor');
      }
    } catch (error) {
      toast.error('Failed to save contractor');
    }
  };

  const handleSaveWorker = async () => {
    if (!workerForm.name || !workerForm.contractor_id || !workerForm.daily_wage) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const url = selectedWorker && !showWorkerDialog
        ? `${API_URL}/labour/workers/${selectedWorker.worker_id}`
        : `${API_URL}/labour/workers`;
      const method = selectedWorker && !showWorkerDialog ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(workerForm)
      });

      if (response.ok) {
        toast.success(method === 'PUT' ? 'Worker updated' : 'Worker added');
        setShowWorkerDialog(false);
        setWorkerForm({
          name: '', phone: '', address: '', aadhar_number: '', emergency_contact_name: '',
          emergency_contact_phone: '', contractor_id: '', daily_wage: '', joining_date: '',
          contract_end_date: '', photo_url: ''
        });
        fetchWorkers();
        if (selectedWorker) {
          const updated = await response.json();
          setSelectedWorker(updated);
        }
      } else {
        toast.error('Failed to save worker');
      }
    } catch (error) {
      toast.error('Failed to save worker');
    }
  };

  const handleMarkAttendance = async (date, status) => {
    if (!selectedWorker) return;

    try {
      const response = await fetch(`${API_URL}/labour/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          worker_id: selectedWorker.worker_id,
          date,
          status,
          in_time: status === 'present' ? '09:00' : null,
          out_time: status === 'present' ? '18:00' : null
        })
      });

      if (response.ok) {
        toast.success('Attendance marked');
        fetchWorkerAttendance();
      } else {
        toast.error('Failed to mark attendance');
      }
    } catch (error) {
      toast.error('Failed to mark attendance');
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedWorker || !docUploadForm.document_type || !docUploadForm.file) {
      toast.error('Please select document type and file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', docUploadForm.file);
      formData.append('document_type', docUploadForm.document_type);
      formData.append('worker_id', selectedWorker.worker_id);

      const response = await fetch(`${API_URL}/labour/workers/${selectedWorker.worker_id}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('Document uploaded');
        setShowDocUploadDialog(false);
        setDocUploadForm({ document_type: '', file: null });
        fetchWorkerDocuments();
      } else {
        toast.error('Failed to upload document');
      }
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getContractorName = (contractorId) => {
    const contractor = contractors.find(c => c.contractor_id === contractorId);
    return contractor?.name || contractor?.company_name || 'Unknown';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  // Generate calendar days for attendance
  const generateCalendarDays = () => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const attendance = workerAttendance.find(a => a.date === dateStr);
      days.push({ date: dateStr, day: d, status: attendance?.status || null });
    }
    return days;
  };

  if (selectedWorker) {
    // Worker Detail View
    return (
      <div className="space-y-6 p-6" data-testid="worker-detail-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedWorker(null)} data-testid="back-to-workers-btn">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Workers
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{selectedWorker.name}</h1>
            <p className="text-slate-600">
              {getContractorName(selectedWorker.contractor_id)} • ₹{selectedWorker.daily_wage}/day
            </p>
          </div>
          <Badge className={selectedWorker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
            {selectedWorker.status}
          </Badge>
        </div>

        {/* Worker Tabs */}
        <Tabs value={workerTab} onValueChange={setWorkerTab}>
          <TabsList>
            <TabsTrigger value="profile" className="gap-2" data-testid="worker-tab-profile">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2" data-testid="worker-tab-attendance">
              <Clock className="w-4 h-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2" data-testid="worker-tab-payroll">
              <IndianRupee className="w-4 h-4" />
              Payroll
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2" data-testid="worker-tab-documents">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                  <Button variant="outline" onClick={() => {
                    setWorkerForm({
                      name: selectedWorker.name || '',
                      phone: selectedWorker.phone || '',
                      address: selectedWorker.address || '',
                      aadhar_number: selectedWorker.aadhar_number || '',
                      emergency_contact_name: selectedWorker.emergency_contact_name || '',
                      emergency_contact_phone: selectedWorker.emergency_contact_phone || '',
                      contractor_id: selectedWorker.contractor_id || '',
                      daily_wage: selectedWorker.daily_wage || '',
                      joining_date: selectedWorker.joining_date?.split('T')[0] || '',
                      contract_end_date: selectedWorker.contract_end_date?.split('T')[0] || ''
                    });
                    setShowWorkerDialog(true);
                  }}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-500">Full Name</Label>
                      <p className="font-medium">{selectedWorker.name}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Phone</Label>
                      <p className="font-medium">{selectedWorker.phone || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Address</Label>
                      <p className="font-medium">{selectedWorker.address || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Aadhar Number</Label>
                      <p className="font-medium">{selectedWorker.aadhar_number || '-'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-500">Contractor/Agency</Label>
                      <p className="font-medium">{getContractorName(selectedWorker.contractor_id)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Daily Wage</Label>
                      <p className="font-medium text-emerald-600">{formatCurrency(selectedWorker.daily_wage)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Joining Date</Label>
                      <p className="font-medium">{selectedWorker.joining_date?.split('T')[0] || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Contract End Date</Label>
                      <p className="font-medium">{selectedWorker.contract_end_date?.split('T')[0] || '-'}</p>
                    </div>
                  </div>
                </div>
                {(selectedWorker.emergency_contact_name || selectedWorker.emergency_contact_phone) && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-medium mb-3">Emergency Contact</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-500">Name</Label>
                        <p className="font-medium">{selectedWorker.emergency_contact_name || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500">Phone</Label>
                        <p className="font-medium">{selectedWorker.emergency_contact_phone || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Attendance Record</CardTitle>
                  <Input
                    type="month"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                    className="w-[180px]"
                    data-testid="attendance-month-picker"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">{day}</div>
                  ))}
                  {/* Add empty cells for first day offset */}
                  {Array.from({ length: new Date(attendanceMonth + '-01').getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {generateCalendarDays().map(({ date, day, status }) => (
                    <div
                      key={date}
                      className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${
                        status === 'present' ? 'bg-emerald-100 border-emerald-300' :
                        status === 'half_day' ? 'bg-amber-100 border-amber-300' :
                        status === 'absent' ? 'bg-red-100 border-red-300' :
                        'bg-slate-50 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        const nextStatus = !status ? 'present' : status === 'present' ? 'half_day' : status === 'half_day' ? 'absent' : 'present';
                        handleMarkAttendance(date, nextStatus);
                      }}
                      data-testid={`attendance-day-${date}`}
                    >
                      <span className="text-sm font-medium">{day}</span>
                      {status && (
                        <div className="text-xs mt-1">
                          {status === 'present' && <CheckCircle className="w-3 h-3 mx-auto text-emerald-600" />}
                          {status === 'half_day' && <span className="text-amber-600">½</span>}
                          {status === 'absent' && <XCircle className="w-3 h-3 mx-auto text-red-600" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded" />
                    <span className="text-sm">Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded" />
                    <span className="text-sm">Half Day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
                    <span className="text-sm">Absent</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Monthly Payroll</CardTitle>
                  <Input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => {
                      setPayrollMonth(e.target.value);
                      setAttendanceMonth(e.target.value);
                    }}
                    className="w-[180px]"
                    data-testid="payroll-month-picker"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {payrollData ? (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg text-center">
                        <p className="text-sm text-slate-500">Daily Wage</p>
                        <p className="text-xl font-bold">{formatCurrency(payrollData.daily_wage)}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-lg text-center">
                        <p className="text-sm text-emerald-600">Present Days</p>
                        <p className="text-xl font-bold text-emerald-700">{payrollData.present_days}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg text-center">
                        <p className="text-sm text-amber-600">Half Days</p>
                        <p className="text-xl font-bold text-amber-700">{payrollData.half_days}</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <p className="text-sm text-red-600">Absent Days</p>
                        <p className="text-xl font-bold text-red-700">{payrollData.absent_days}</p>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 font-medium">Payroll Calculation</div>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between">
                          <span>Working Days ({payrollData.total_working_days} days × {formatCurrency(payrollData.daily_wage)})</span>
                          <span className="font-medium">{formatCurrency(payrollData.gross_pay)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Deductions</span>
                          <span>- {formatCurrency(payrollData.deductions)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t text-lg font-bold">
                          <span>Net Payable</span>
                          <span className="text-emerald-600">{formatCurrency(payrollData.net_pay)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <IndianRupee className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No attendance data for this month</p>
                    <p className="text-xs text-slate-400 mt-1">Mark attendance first to calculate payroll</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <Button onClick={() => setShowDocUploadDialog(true)} data-testid="upload-document-btn">
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {workerDocuments.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {workerDocuments.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-slate-400" />
                          <div>
                            <p className="font-medium capitalize">{doc.document_type?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-slate-500">
                              Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No documents uploaded</p>
                    <Button className="mt-4" onClick={() => setShowDocUploadDialog(true)}>
                      Upload First Document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Worker Dialog */}
        <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Worker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={workerForm.name} onChange={(e) => setWorkerForm({...workerForm, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={workerForm.phone} onChange={(e) => setWorkerForm({...workerForm, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Aadhar Number</Label>
                  <Input value={workerForm.aadhar_number} onChange={(e) => setWorkerForm({...workerForm, aadhar_number: e.target.value})} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Address</Label>
                  <Textarea value={workerForm.address} onChange={(e) => setWorkerForm({...workerForm, address: e.target.value})} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Contractor *</Label>
                  <Select value={workerForm.contractor_id} onValueChange={(v) => setWorkerForm({...workerForm, contractor_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
                    <SelectContent>
                      {contractors.map(c => (
                        <SelectItem key={c.contractor_id} value={c.contractor_id}>{c.name || c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Daily Wage (₹) *</Label>
                  <Input type="number" value={workerForm.daily_wage} onChange={(e) => setWorkerForm({...workerForm, daily_wage: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Joining Date</Label>
                  <Input type="date" value={workerForm.joining_date} onChange={(e) => setWorkerForm({...workerForm, joining_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Contract End Date</Label>
                  <Input type="date" value={workerForm.contract_end_date} onChange={(e) => setWorkerForm({...workerForm, contract_end_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input value={workerForm.emergency_contact_name} onChange={(e) => setWorkerForm({...workerForm, emergency_contact_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input value={workerForm.emergency_contact_phone} onChange={(e) => setWorkerForm({...workerForm, emergency_contact_phone: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWorkerDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveWorker}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Upload Dialog */}
        <Dialog open={showDocUploadDialog} onOpenChange={setShowDocUploadDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select value={docUploadForm.document_type} onValueChange={(v) => setDocUploadForm({...docUploadForm, document_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhar">Aadhar Card</SelectItem>
                    <SelectItem value="pan">PAN Card</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="bank_passbook">Bank Passbook</SelectItem>
                    <SelectItem value="contract">Contract Agreement</SelectItem>
                    <SelectItem value="safety_certificate">Safety Certificate</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File *</Label>
                <Input type="file" onChange={(e) => setDocUploadForm({...docUploadForm, file: e.target.files?.[0]})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDocUploadDialog(false)}>Cancel</Button>
              <Button onClick={handleDocumentUpload} disabled={uploading}>
                {uploading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main List View
  return (
    <div className="space-y-6 p-6" data-testid="contract-labour-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contract Labour Management</h1>
          <p className="text-slate-600 mt-1">Manage contractors, workers, attendance, and payroll</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchContractors(); fetchWorkers(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList>
          <TabsTrigger value="workers" className="gap-2" data-testid="main-tab-workers">
            <Users className="w-4 h-4" />
            Workers ({workers.length})
          </TabsTrigger>
          <TabsTrigger value="contractors" className="gap-2" data-testid="main-tab-contractors">
            <Building className="w-4 h-4" />
            Contractors ({contractors.length})
          </TabsTrigger>
        </TabsList>

        {/* Workers Tab */}
        <TabsContent value="workers">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Contract Workers</CardTitle>
                  <CardDescription>Click on a worker to view full details</CardDescription>
                </div>
                <Button onClick={() => {
                  setWorkerForm({
                    name: '', phone: '', address: '', aadhar_number: '', emergency_contact_name: '',
                    emergency_contact_phone: '', contractor_id: '', daily_wage: '', joining_date: '',
                    contract_end_date: '', photo_url: ''
                  });
                  setSelectedWorker(null);
                  setShowWorkerDialog(true);
                }} data-testid="add-worker-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Worker
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : workers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Worker</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Daily Wage</TableHead>
                      <TableHead>Joining Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.map((worker) => (
                      <TableRow 
                        key={worker.worker_id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedWorker(worker)}
                        data-testid={`worker-row-${worker.worker_id}`}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{worker.name}</p>
                            <p className="text-xs text-slate-500">{worker.phone || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getContractorName(worker.contractor_id)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(worker.daily_wage)}</TableCell>
                        <TableCell>{worker.joining_date?.split('T')[0] || '-'}</TableCell>
                        <TableCell>
                          <Badge className={worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                            {worker.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedWorker(worker); }}>
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No workers registered</p>
                  <Button className="mt-4" onClick={() => setShowWorkerDialog(true)}>
                    Add First Worker
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contractors Tab */}
        <TabsContent value="contractors">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Contractors / Agencies</CardTitle>
                <Button onClick={() => {
                  setEditingContractor(null);
                  setContractorForm({
                    name: '', company_name: '', contact_person: '', email: '', phone: '',
                    address: '', gst_number: '', pan_number: '', contract_start: '', contract_end: ''
                  });
                  setShowContractorDialog(true);
                }} data-testid="add-contractor-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contractor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contractors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Contractor</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Contract Period</TableHead>
                      <TableHead>Workers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractors.map((contractor) => (
                      <TableRow key={contractor.contractor_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contractor.name || contractor.company_name}</p>
                            {contractor.company_name && contractor.name && (
                              <p className="text-xs text-slate-500">{contractor.company_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{contractor.contact_person || '-'}</TableCell>
                        <TableCell>{contractor.phone || '-'}</TableCell>
                        <TableCell>
                          {contractor.contract_start && contractor.contract_end ? (
                            <span className="text-sm">
                              {contractor.contract_start} to {contractor.contract_end}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {workers.filter(w => w.contractor_id === contractor.contractor_id).length} workers
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingContractor(contractor);
                            setContractorForm({
                              name: contractor.name || '',
                              company_name: contractor.company_name || '',
                              contact_person: contractor.contact_person || '',
                              email: contractor.email || '',
                              phone: contractor.phone || '',
                              address: contractor.address || '',
                              gst_number: contractor.gst_number || '',
                              pan_number: contractor.pan_number || '',
                              contract_start: contractor.contract_start || '',
                              contract_end: contractor.contract_end || ''
                            });
                            setShowContractorDialog(true);
                          }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No contractors registered</p>
                  <Button className="mt-4" onClick={() => setShowContractorDialog(true)}>
                    Add First Contractor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Worker Dialog (for new workers) */}
      <Dialog open={showWorkerDialog && !selectedWorker} onOpenChange={setShowWorkerDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Full Name *</Label>
                <Input value={workerForm.name} onChange={(e) => setWorkerForm({...workerForm, name: e.target.value})} data-testid="worker-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={workerForm.phone} onChange={(e) => setWorkerForm({...workerForm, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Aadhar Number</Label>
                <Input value={workerForm.aadhar_number} onChange={(e) => setWorkerForm({...workerForm, aadhar_number: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Address</Label>
                <Textarea value={workerForm.address} onChange={(e) => setWorkerForm({...workerForm, address: e.target.value})} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Contractor *</Label>
                <Select value={workerForm.contractor_id} onValueChange={(v) => setWorkerForm({...workerForm, contractor_id: v})}>
                  <SelectTrigger data-testid="worker-contractor-select"><SelectValue placeholder="Select contractor" /></SelectTrigger>
                  <SelectContent>
                    {contractors.map(c => (
                      <SelectItem key={c.contractor_id} value={c.contractor_id}>{c.name || c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Daily Wage (₹) *</Label>
                <Input type="number" value={workerForm.daily_wage} onChange={(e) => setWorkerForm({...workerForm, daily_wage: e.target.value})} data-testid="worker-wage-input" />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input type="date" value={workerForm.joining_date} onChange={(e) => setWorkerForm({...workerForm, joining_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Contract End Date</Label>
                <Input type="date" value={workerForm.contract_end_date} onChange={(e) => setWorkerForm({...workerForm, contract_end_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Emergency Contact Name</Label>
                <Input value={workerForm.emergency_contact_name} onChange={(e) => setWorkerForm({...workerForm, emergency_contact_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Emergency Contact Phone</Label>
                <Input value={workerForm.emergency_contact_phone} onChange={(e) => setWorkerForm({...workerForm, emergency_contact_phone: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkerDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWorker} data-testid="save-worker-btn">Add Worker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Contractor Dialog */}
      <Dialog open={showContractorDialog} onOpenChange={setShowContractorDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContractor ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={contractorForm.name} onChange={(e) => setContractorForm({...contractorForm, name: e.target.value})} data-testid="contractor-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={contractorForm.company_name} onChange={(e) => setContractorForm({...contractorForm, company_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={contractorForm.contact_person} onChange={(e) => setContractorForm({...contractorForm, contact_person: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={contractorForm.phone} onChange={(e) => setContractorForm({...contractorForm, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={contractorForm.email} onChange={(e) => setContractorForm({...contractorForm, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={contractorForm.gst_number} onChange={(e) => setContractorForm({...contractorForm, gst_number: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Address</Label>
                <Textarea value={contractorForm.address} onChange={(e) => setContractorForm({...contractorForm, address: e.target.value})} rows={2} />
              </div>
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
            <Button variant="outline" onClick={() => setShowContractorDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveContractor} data-testid="save-contractor-btn">
              {editingContractor ? 'Save Changes' : 'Add Contractor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractLabourPage;
