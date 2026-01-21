import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
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
import { toast } from 'sonner';
import {
  CreditCard,
  FileText,
  Download,
  Play,
  Lock,
  RefreshCw,
  IndianRupee,
  Calendar,
  Users,
  Settings,
  Clock,
  AlertCircle,
  Edit,
  Eye,
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Search
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PayrollPage = () => {
  const { user } = useAuth();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [myPayslips, setMyPayslips] = useState([]);
  const [allEmployeesPay, setAllEmployeesPay] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [salaryStructuresLoading, setSalaryStructuresLoading] = useState(false);
  const [salaryStructuresSearch, setSalaryStructuresSearch] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [employeeBreakdown, setEmployeeBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payrollRules, setPayrollRules] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [leaveTypeRules, setLeaveTypeRules] = useState([]);
  const [leavePolicyRules, setLeavePolicyRules] = useState({
    financial_year_start: "04-01",
    annual_quotas: { CL: 6, SL: 6, EL: 12 },
    carry_forward: { CL: false, SL: false, EL: true, max_el_accumulation: 30 },
    sunday_leave_rules: { enabled: true, weekly_threshold: 2, monthly_threshold: 6, auto_apply: true }
  });
  const [expandedSections, setExpandedSections] = useState({});
  const [breakdownExpandedSections, setBreakdownExpandedSections] = useState({
    attendance: true,
    leaves: false,
    earnings: true,
    deductions: true
  });
  const [customRules, setCustomRules] = useState([]);
  const [showAddCustomRule, setShowAddCustomRule] = useState(false);
  const [customRuleForm, setCustomRuleForm] = useState({
    name: '',
    description: '',
    condition_type: 'late_count',
    condition_threshold: 3,
    condition_operator: 'greater_than',
    action_type: 'percentage_deduction',
    action_value: 5,
    apply_per_occurrence: false
  });
  
  // Employee Salary Edit states
  const [editSalaryOpen, setEditSalaryOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [salaryForm, setSalaryForm] = useState({
    basic: 0, da: 0, hra: 0, conveyance: 0, grade_pay: 0, other_allowance: 0, medical_allowance: 0,
    epf_applicable: true, esi_applicable: true, sewa_applicable: true,
    sewa_advance: 0, other_deduction: 0, reason: ''
  });
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryChangeRequests, setSalaryChangeRequests] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);
  
  // Payroll Details state
  const [viewPayrollOpen, setViewPayrollOpen] = useState(false);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState(null);
  const [payrollDetails, setPayrollDetails] = useState(null);
  const [loadingPayrollDetails, setLoadingPayrollDetails] = useState(false);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'finance' || user?.role === 'hr_executive';
  const canApproveSalary = user?.role === 'super_admin' || user?.role === 'finance';

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isHR) {
      fetchAllEmployeesPay();
      fetchSalaryChangeRequests();
    }
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [runsRes, payslipsRes, rulesRes, leaveRulesRes, customRulesRes, leavePolicyRes] = await Promise.all([
        isHR ? fetch(`${API_URL}/payroll/runs`, { credentials: 'include', headers: authHeaders }) : Promise.resolve({ ok: false }),
        fetch(`${API_URL}/payroll/my-payslips`, { credentials: 'include', headers: authHeaders }),
        isHR ? fetch(`${API_URL}/payroll/rules`, { credentials: 'include', headers: authHeaders }) : Promise.resolve({ ok: false }),
        isHR ? fetch(`${API_URL}/payroll/leave-type-rules`, { credentials: 'include', headers: authHeaders }) : Promise.resolve({ ok: false }),
        isHR ? fetch(`${API_URL}/payroll/custom-rules`, { credentials: 'include', headers: authHeaders }) : Promise.resolve({ ok: false }),
        isHR ? fetch(`${API_URL}/payroll/leave-policy-rules`, { credentials: 'include', headers: authHeaders }) : Promise.resolve({ ok: false }),
      ]);

      if (runsRes.ok) setPayrollRuns(await runsRes.json());
      if (payslipsRes.ok) setMyPayslips(await payslipsRes.json());
      if (rulesRes.ok) setPayrollRules(await rulesRes.json());
      if (leaveRulesRes.ok) setLeaveTypeRules(await leaveRulesRes.json());
      if (customRulesRes.ok) setCustomRules(await customRulesRes.json());
      if (leavePolicyRes.ok) setLeavePolicyRules(await leavePolicyRes.json());
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEmployeesPay = async () => {
    try {
      const response = await fetch(
        `${API_URL}/payroll/all-employees-pay?month=${selectedMonth}&year=${selectedYear}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        setAllEmployeesPay(await response.json());
      }
    } catch (error) {
      console.error('Error fetching employees pay:', error);
    }
  };

  const fetchSalaryStructures = async (search = '') => {
    setSalaryStructuresLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.append('search', search);
      
      const response = await fetch(
        `${API_URL}/payroll/all-salary-structures?${params}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setSalaryStructures(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching salary structures:', error);
      toast.error('Failed to load salary structures');
    } finally {
      setSalaryStructuresLoading(false);
    }
  };

  const openEditSalary = async (emp) => {
    setEditingEmployee(emp);
    
    // Fetch current salary details
    try {
      const response = await fetch(
        `${API_URL}/payroll/employee/${emp.employee_id}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const salary = await response.json();
        const fc = salary?.fixed_components || {};
        const dc = salary?.deduction_config || {};
        const fd = salary?.fixed_deductions || {};
        
        setSalaryForm({
          basic: fc.basic || salary?.basic || 0,
          da: fc.da || salary?.da || 0,
          hra: fc.hra || salary?.hra || 0,
          conveyance: fc.conveyance || salary?.conveyance || 0,
          grade_pay: fc.grade_pay || 0,
          other_allowance: fc.other_allowance || salary?.other_allowance || 0,
          medical_allowance: fc.medical_allowance || 0,
          epf_applicable: dc.epf_applicable !== false,
          esi_applicable: dc.esi_applicable !== false,
          sewa_applicable: dc.sewa_applicable !== false,
          sewa_advance: fd.sewa_advance || 0,
          other_deduction: fd.other_deduction || 0,
          reason: ''
        });
      } else {
        // No salary exists, use defaults
        setSalaryForm({
          basic: 0, da: 0, hra: 0, conveyance: 0, grade_pay: 0, other_allowance: 0, medical_allowance: 0,
          epf_applicable: true, esi_applicable: true, sewa_applicable: true,
          sewa_advance: 0, other_deduction: 0, reason: ''
        });
      }
    } catch (error) {
      console.error('Error fetching salary:', error);
    }
    
    setEditSalaryOpen(true);
  };

  const handleSaveSalary = async () => {
    if (!editingEmployee) return;
    
    setSavingSalary(true);
    try {
      const totalFixed = 
        parseFloat(salaryForm.basic || 0) + 
        parseFloat(salaryForm.da || 0) + 
        parseFloat(salaryForm.hra || 0) + 
        parseFloat(salaryForm.conveyance || 0) + 
        parseFloat(salaryForm.grade_pay || 0) + 
        parseFloat(salaryForm.other_allowance || 0) + 
        parseFloat(salaryForm.medical_allowance || 0);
      
      const payload = {
        ...salaryForm,
        total_fixed: totalFixed,
        emp_code: editingEmployee.emp_code,
        employee_name: editingEmployee.employee_name
      };
      
      const response = await fetch(
        `${API_URL}/payroll/employee/${editingEmployee.employee_id}/salary`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify(payload)
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.request) {
          toast.success('Salary change request submitted for approval');
          fetchSalaryChangeRequests();
        } else {
          toast.success('Salary structure updated successfully');
          fetchSalaryStructures(salaryStructuresSearch);
        }
        setEditSalaryOpen(false);
      } else {
        toast.error(data.detail || 'Failed to update salary');
      }
    } catch (error) {
      toast.error('Failed to save salary structure');
    } finally {
      setSavingSalary(false);
    }
  };

  const fetchSalaryChangeRequests = async () => {
    try {
      const response = await fetch(
        `${API_URL}/payroll/salary-change-requests?status=pending`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setSalaryChangeRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching change requests:', error);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const response = await fetch(
        `${API_URL}/payroll/salary-change-requests/${requestId}/approve`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          credentials: 'include'
        }
      );
      
      if (response.ok) {
        toast.success('Salary change approved');
        fetchSalaryChangeRequests();
        fetchSalaryStructures(salaryStructuresSearch);
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve salary change');
    }
  };

  const handleRejectRequest = async (requestId) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      const response = await fetch(
        `${API_URL}/payroll/salary-change-requests/${requestId}/reject`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ reason })
        }
      );
      
      if (response.ok) {
        toast.success('Salary change rejected');
        fetchSalaryChangeRequests();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to reject');
      }
    } catch (error) {
      toast.error('Failed to reject salary change');
    }
  };

  const fetchSalaryHistory = async (employeeId) => {
    try {
      const response = await fetch(
        `${API_URL}/payroll/employee/${employeeId}/salary-history`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setSalaryHistory(data);
        setShowSalaryHistory(true);
      }
    } catch (error) {
      toast.error('Failed to fetch salary history');
    }
  };

  const fetchEmployeeDetails = async (employeeId) => {
    try {
      const response = await fetch(
        `${API_URL}/payroll/employee-salary-details/${employeeId}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedEmployeeDetails(data);
      }
    } catch (error) {
      toast.error('Failed to fetch employee details');
    }
  };

  const fetchEmployeeBreakdown = async (employeeId) => {
    setLoadingBreakdown(true);
    try {
      const response = await fetch(
        `${API_URL}/payroll/employee-breakdown/${employeeId}?month=${selectedMonth}&year=${selectedYear}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setEmployeeBreakdown(data);
      } else {
        toast.error('Failed to fetch breakdown');
      }
    } catch (error) {
      toast.error('Failed to fetch employee breakdown');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const toggleBreakdownSection = (section) => {
    setBreakdownExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreatePayroll = async () => {
    try {
      const response = await fetch(`${API_URL}/payroll/runs?month=${selectedMonth}&year=${selectedYear}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Payroll run created');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create payroll');
      }
    } catch (error) {
      toast.error('Failed to create payroll');
    }
  };

  const handleProcessPayroll = async (payrollId) => {
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/payroll/runs/${payrollId}/process`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchData();
        fetchAllEmployeesPay();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to process payroll');
      }
    } catch (error) {
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const handleLockPayroll = async (payrollId) => {
    try {
      const response = await fetch(`${API_URL}/payroll/runs/${payrollId}/lock`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Payroll locked');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to lock payroll');
      }
    } catch (error) {
      toast.error('Failed to lock payroll');
    }
  };

  const fetchPayrollDetails = async (payrollId) => {
    setLoadingPayrollDetails(true);
    try {
      const response = await fetch(
        `${API_URL}/payroll/runs/${payrollId}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setPayrollDetails(data);
        setViewPayrollOpen(true);
      } else {
        toast.error('Failed to fetch payroll details');
      }
    } catch (error) {
      toast.error('Failed to fetch payroll details');
    } finally {
      setLoadingPayrollDetails(false);
    }
  };

  const handleViewPayroll = (run) => {
    setSelectedPayrollRun(run);
    if (run.status === 'processed' || run.status === 'locked') {
      fetchPayrollDetails(run.payroll_id);
    } else {
      toast.info('Process the payroll first to view details');
    }
  };

  const exportPayrollToExcel = async () => {
    if (!payrollDetails || !payrollDetails.payslips) {
      toast.error('No payroll data to export');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      
      // Prepare data for export
      const exportData = payrollDetails.payslips.map((slip, index) => ({
        'S.No': index + 1,
        'Emp Code': slip.emp_code || slip.employee_id,
        'Employee Name': slip.employee_name || '-',
        'Department': slip.department || '-',
        'Designation': slip.designation || '-',
        'Working Days': slip.working_days || 26,
        'Present Days': slip.present_days || 0,
        'Paid Days': slip.paid_days || 0,
        'LWP Days': slip.lwp_days || 0,
        'Basic': slip.basic || 0,
        'HRA': slip.hra || 0,
        'Special Allowance': slip.special_allowance || 0,
        'Gross Salary': slip.gross_salary || 0,
        'PF (Employee)': slip.pf_employee || 0,
        'ESI (Employee)': slip.esi_employee || 0,
        'Professional Tax': slip.professional_tax || 0,
        'Total Deductions': slip.total_deductions || 0,
        'Net Salary': slip.net_salary || 0,
      }));

      // Add summary row
      exportData.push({});
      exportData.push({
        'S.No': '',
        'Emp Code': 'TOTALS',
        'Employee Name': `${payrollDetails.summary?.total_employees || 0} Employees`,
        'Department': '',
        'Designation': '',
        'Working Days': '',
        'Present Days': '',
        'Paid Days': '',
        'LWP Days': '',
        'Basic': '',
        'HRA': '',
        'Special Allowance': '',
        'Gross Salary': payrollDetails.summary?.total_gross || 0,
        'PF (Employee)': payrollDetails.summary?.total_pf || 0,
        'ESI (Employee)': payrollDetails.summary?.total_esi || 0,
        'Professional Tax': payrollDetails.summary?.total_pt || 0,
        'Total Deductions': payrollDetails.summary?.total_deductions || 0,
        'Net Salary': payrollDetails.summary?.total_net || 0,
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');

      // Auto-size columns
      const maxWidth = 20;
      const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: maxWidth }));
      worksheet['!cols'] = cols;

      // Generate filename
      const monthName = getMonthName(payrollDetails.payroll?.month || selectedMonth);
      const year = payrollDetails.payroll?.year || selectedYear;
      const filename = `Payroll_${monthName}_${year}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success(`Exported to ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export payroll');
    }
  };

  const handleSaveRuleSection = async (section) => {
    try {
      const response = await fetch(`${API_URL}/payroll/rules/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payrollRules[section])
      });

      if (response.ok) {
        toast.success(`${section.replace(/_/g, ' ')} rules saved`);
        setEditingSection(null);
      } else {
        toast.error('Failed to save rules');
      }
    } catch (error) {
      toast.error('Failed to save rules');
    }
  };

  const handleSaveLeaveTypeRules = async () => {
    try {
      const response = await fetch(`${API_URL}/payroll/leave-type-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(leaveTypeRules)
      });

      if (response.ok) {
        toast.success('Leave type rules saved');
      } else {
        toast.error('Failed to save leave type rules');
      }
    } catch (error) {
      toast.error('Failed to save leave type rules');
    }
  };

  const handleSaveLeavePolicyRules = async () => {
    try {
      const response = await fetch(`${API_URL}/payroll/leave-policy-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(leavePolicyRules)
      });

      if (response.ok) {
        toast.success('Leave policy rules saved');
      } else {
        toast.error('Failed to save leave policy rules');
      }
    } catch (error) {
      toast.error('Failed to save leave policy rules');
    }
  };

  const handleAddCustomRule = async () => {
    if (!customRuleForm.name) {
      toast.error('Please enter a rule name');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/payroll/custom-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(customRuleForm)
      });
      if (response.ok) {
        toast.success('Custom rule added');
        setShowAddCustomRule(false);
        setCustomRuleForm({
          name: '', description: '', condition_type: 'late_count',
          condition_threshold: 3, condition_operator: 'greater_than',
          action_type: 'percentage_deduction', action_value: 5, apply_per_occurrence: false
        });
        fetchData();
      } else {
        toast.error('Failed to add rule');
      }
    } catch (error) {
      toast.error('Failed to add rule');
    }
  };

  const handleToggleCustomRule = async (ruleId) => {
    try {
      const response = await fetch(`${API_URL}/payroll/custom-rules/${ruleId}/toggle`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Rule toggled');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const handleDeleteCustomRule = async (ruleId) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      const response = await fetch(`${API_URL}/payroll/custom-rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Rule deleted');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const updateRule = (section, path, value) => {
    setPayrollRules(prev => {
      const newRules = { ...prev };
      let obj = newRules[section];
      const keys = path.split('.');
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newRules;
    });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getMonthName = (month) => {
    return new Date(2000, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    processing: 'bg-blue-100 text-blue-700',
    processed: 'bg-emerald-100 text-emerald-700',
    locked: 'bg-purple-100 text-purple-700'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const RuleSection = ({ title, section, children }) => (
    <Card className="mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-slate-50 transition-colors pb-3"
        onClick={() => toggleSection(section)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {editingSection === section ? (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSaveRuleSection(section); }}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingSection(section); }}>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
            {expandedSections[section] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </CardHeader>
      {expandedSections[section] && (
        <CardContent>{children}</CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="payroll-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Payroll
          </h1>
          <p className="text-slate-600 mt-1">Manage payroll, rules, and view salary slips</p>
        </div>
      </div>

      <Tabs defaultValue={isHR ? "runs" : "my-payslips"} className="space-y-4">
        <TabsList className="bg-white border flex-wrap h-auto">
          {isHR && <TabsTrigger value="runs" data-testid="tab-runs">Payroll Runs</TabsTrigger>}
          {isHR && <TabsTrigger value="employees-pay" data-testid="tab-employees-pay">All Employees</TabsTrigger>}
          {isHR && <TabsTrigger value="salary-structures" data-testid="tab-salary-structures">Salary Structures</TabsTrigger>}
          <TabsTrigger value="my-payslips" data-testid="tab-my-payslips">My Payslips</TabsTrigger>
          {isHR && <TabsTrigger value="rules" data-testid="tab-rules">Payroll Rules</TabsTrigger>}
          {isHR && <TabsTrigger value="config" data-testid="tab-config">Statutory Config</TabsTrigger>}
        </TabsList>

        {/* Payroll Runs (HR/Finance only) */}
        {isHR && (
          <TabsContent value="runs">
            <div className="grid gap-6">
              {/* Create New Payroll */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Create Payroll Run</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Month</label>
                      <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {getMonthName(i + 1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Year</label>
                      <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreatePayroll} data-testid="create-payroll-btn">
                      Create Payroll
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Payroll Runs List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Payroll History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Period</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRuns.length > 0 ? (
                        payrollRuns.map((run) => (
                          <TableRow 
                            key={run.payroll_id}
                            className={`${(run.status === 'processed' || run.status === 'locked') ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                            onClick={() => (run.status === 'processed' || run.status === 'locked') && handleViewPayroll(run)}
                            data-testid={`payroll-run-${run.payroll_id}`}
                          >
                            <TableCell className="font-medium">
                              {getMonthName(run.month)} {run.year}
                            </TableCell>
                            <TableCell>{run.total_employees}</TableCell>
                            <TableCell>{formatCurrency(run.total_gross)}</TableCell>
                            <TableCell>{formatCurrency(run.total_net)}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[run.status]}>
                                {run.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                {(run.status === 'processed' || run.status === 'locked') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewPayroll(run)}
                                    className="gap-1"
                                    data-testid={`view-payroll-${run.payroll_id}`}
                                  >
                                    <Eye className="w-3 h-3" />
                                    View
                                  </Button>
                                )}
                                {run.status === 'draft' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleProcessPayroll(run.payroll_id)}
                                    disabled={processing}
                                    className="gap-1"
                                  >
                                    <Play className="w-3 h-3" />
                                    Process
                                  </Button>
                                )}
                                {run.status === 'processed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLockPayroll(run.payroll_id)}
                                    className="gap-1"
                                  >
                                    <Lock className="w-3 h-3" />
                                    Lock
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500">No payroll runs yet</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* All Employees Pay (HR only) */}
        {isHR && (
          <TabsContent value="employees-pay">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Employee Pay Information
                    </CardTitle>
                    <CardDescription>View salary details for all employees</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allEmployeesPay.length > 0 ? (
                      allEmployeesPay.map((emp) => (
                        <TableRow 
                          key={emp.payslip_id}
                          className="cursor-pointer hover:bg-slate-100"
                          onClick={() => fetchEmployeeBreakdown(emp.employee_id)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{emp.employee_name || emp.employee_id}</p>
                              <p className="text-xs text-slate-500">{emp.employee_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>{emp.department || '-'}</TableCell>
                          <TableCell>
                            <span className="text-sm">{emp.paid_days}/{emp.working_days}</span>
                          </TableCell>
                          <TableCell>{formatCurrency(emp.gross_salary)}</TableCell>
                          <TableCell className="text-red-600">{formatCurrency(emp.total_deductions)}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{formatCurrency(emp.net_salary)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchEmployeeBreakdown(emp.employee_id)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              Breakdown
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-500">No payroll data for this period</p>
                          <p className="text-xs text-slate-400 mt-1">Process payroll to see employee pay details</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Salary Structures Tab (HR only) */}
        {isHR && (
          <TabsContent value="salary-structures">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IndianRupee className="w-5 h-5 text-primary" />
                      All Salary Structures
                    </CardTitle>
                    <CardDescription>View salary details for all employees</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name, code, email..."
                      value={salaryStructuresSearch}
                      onChange={(e) => setSalaryStructuresSearch(e.target.value)}
                      className="w-64"
                      data-testid="salary-search-input"
                    />
                    <Button 
                      onClick={() => fetchSalaryStructures(salaryStructuresSearch)}
                      data-testid="salary-search-btn"
                    >
                      Search
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => { setSalaryStructuresSearch(''); fetchSalaryStructures(''); }}
                      data-testid="salary-clear-btn"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {salaryStructuresLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-slate-500">Loading salary structures...</p>
                  </div>
                ) : salaryStructures.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Emp Code</TableHead>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Gross Salary</TableHead>
                          <TableHead className="text-right">Basic</TableHead>
                          <TableHead>Data Source</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryStructures.map((emp) => (
                          <TableRow 
                            key={emp.employee_id} 
                            className="hover:bg-slate-50"
                            data-testid={`salary-row-${emp.employee_id}`}
                          >
                            <TableCell className="font-medium">{emp.emp_code || '-'}</TableCell>
                            <TableCell>{emp.employee_name || '-'}</TableCell>
                            <TableCell>{emp.department || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {emp.gross_salary ? formatCurrency(emp.gross_salary) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {emp.basic_salary ? formatCurrency(emp.basic_salary) : '-'}
                            </TableCell>
                            <TableCell>
                              {emp.has_salary_data ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  {emp.salary_source || 'Available'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  No Data
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditSalary(emp)}
                                  data-testid={`edit-salary-${emp.employee_id}`}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => fetchSalaryHistory(emp.employee_id)}
                                  data-testid={`salary-history-${emp.employee_id}`}
                                >
                                  <Clock className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">No salary structures found</p>
                    <p className="text-xs text-slate-400">Click Search or use Bulk Import to add salary data</p>
                    <Button 
                      onClick={() => fetchSalaryStructures('')} 
                      className="mt-4"
                      data-testid="load-salary-btn"
                    >
                      Load All Salaries
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* My Payslips */}
        <TabsContent value="my-payslips">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                My Salary Slips
              </CardTitle>
              <CardDescription>View and download your payslips</CardDescription>
            </CardHeader>
            <CardContent>
              {myPayslips.length > 0 ? (
                <div className="space-y-3">
                  {myPayslips.map((slip) => (
                    <div
                      key={slip.payslip_id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => setSelectedPayslip(slip)}
                      data-testid={`payslip-${slip.payslip_id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <IndianRupee className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {getMonthName(slip.month)} {slip.year}
                          </p>
                          <p className="text-sm text-slate-500">
                            {slip.paid_days} days worked
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(slip.net_salary)}
                        </p>
                        <p className="text-xs text-slate-500">Net Pay</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No payslips available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Rules */}
        {isHR && payrollRules && (
          <TabsContent value="rules">
            <div className="space-y-4">
              {/* Attendance Rules */}
              <RuleSection title="Attendance Rules" section="attendance_rules">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Grace Period (minutes)</Label>
                      <Input
                        type="number"
                        value={payrollRules.attendance_rules?.grace_period_minutes || 15}
                        onChange={(e) => updateRule('attendance_rules', 'grace_period_minutes', Number(e.target.value))}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Hours for Full Day</Label>
                      <Input
                        type="number"
                        value={payrollRules.attendance_rules?.half_day_rules?.min_hours_for_full_day || 8}
                        onChange={(e) => updateRule('attendance_rules', 'half_day_rules.min_hours_for_full_day', Number(e.target.value))}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Hours for Half Day</Label>
                      <Input
                        type="number"
                        value={payrollRules.attendance_rules?.half_day_rules?.min_hours_for_half_day || 4}
                        onChange={(e) => updateRule('attendance_rules', 'half_day_rules.min_hours_for_half_day', Number(e.target.value))}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Half Day Deduction %</Label>
                      <Input
                        type="number"
                        value={payrollRules.attendance_rules?.half_day_rules?.half_day_deduction_percent || 50}
                        onChange={(e) => updateRule('attendance_rules', 'half_day_rules.half_day_deduction_percent', Number(e.target.value))}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Absent Day Multiplier</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={payrollRules.attendance_rules?.absent_deduction?.multiplier || 1}
                        onChange={(e) => updateRule('attendance_rules', 'absent_deduction.multiplier', Number(e.target.value))}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                      <p className="text-xs text-slate-500">1 = 1 day deduction, 1.5 = 1.5 days, 2 = 2 days</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={payrollRules.attendance_rules?.late_coming_deduction?.enabled}
                        onCheckedChange={(v) => updateRule('attendance_rules', 'late_coming_deduction.enabled', v)}
                        disabled={editingSection !== 'attendance_rules'}
                      />
                      <Label>Enable Late Coming Deduction</Label>
                    </div>
                  </div>
                </div>
              </RuleSection>

              {/* Leave Type Rules */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Leave Type Payroll Rules
                    </CardTitle>
                    <Button size="sm" onClick={handleSaveLeaveTypeRules}>
                      <Save className="w-4 h-4 mr-1" /> Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Paid Leave</TableHead>
                        <TableHead>Deduction %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypeRules.map((lt, idx) => (
                        <TableRow key={lt.leave_type_id || idx}>
                          <TableCell className="font-medium">{lt.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lt.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={lt.is_paid}
                              onCheckedChange={(v) => {
                                const updated = [...leaveTypeRules];
                                updated[idx].is_paid = v;
                                updated[idx].deduction_percent = v ? 0 : 100;
                                setLeaveTypeRules(updated);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={lt.deduction_percent}
                              onChange={(e) => {
                                const updated = [...leaveTypeRules];
                                updated[idx].deduction_percent = Number(e.target.value);
                                setLeaveTypeRules(updated);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Overtime Rules */}
              <RuleSection title="Overtime Rules" section="overtime_rules">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Switch
                        checked={payrollRules.overtime_rules?.enabled}
                        onCheckedChange={(v) => updateRule('overtime_rules', 'enabled', v)}
                        disabled={editingSection !== 'overtime_rules'}
                      />
                      <Label>Enable Overtime</Label>
                    </div>
                    <Label>Weekday Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={payrollRules.overtime_rules?.weekday_multiplier || 1.5}
                      onChange={(e) => updateRule('overtime_rules', 'weekday_multiplier', Number(e.target.value))}
                      disabled={editingSection !== 'overtime_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weekend Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={payrollRules.overtime_rules?.weekend_multiplier || 2.0}
                      onChange={(e) => updateRule('overtime_rules', 'weekend_multiplier', Number(e.target.value))}
                      disabled={editingSection !== 'overtime_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Holiday Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={payrollRules.overtime_rules?.holiday_multiplier || 2.5}
                      onChange={(e) => updateRule('overtime_rules', 'holiday_multiplier', Number(e.target.value))}
                      disabled={editingSection !== 'overtime_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max OT Hours/Day</Label>
                    <Input
                      type="number"
                      value={payrollRules.overtime_rules?.max_ot_hours_per_day || 4}
                      onChange={(e) => updateRule('overtime_rules', 'max_ot_hours_per_day', Number(e.target.value))}
                      disabled={editingSection !== 'overtime_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max OT Hours/Month</Label>
                    <Input
                      type="number"
                      value={payrollRules.overtime_rules?.max_ot_hours_per_month || 50}
                      onChange={(e) => updateRule('overtime_rules', 'max_ot_hours_per_month', Number(e.target.value))}
                      disabled={editingSection !== 'overtime_rules'}
                    />
                  </div>
                </div>
              </RuleSection>

              {/* Salary Components */}
              <RuleSection title="Salary Components" section="salary_components">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Basic % of CTC</Label>
                    <Input
                      type="number"
                      value={payrollRules.salary_components?.basic_percent_of_ctc || 40}
                      onChange={(e) => updateRule('salary_components', 'basic_percent_of_ctc', Number(e.target.value))}
                      disabled={editingSection !== 'salary_components'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HRA % of Basic</Label>
                    <Input
                      type="number"
                      value={payrollRules.salary_components?.hra_percent_of_basic || 40}
                      onChange={(e) => updateRule('salary_components', 'hra_percent_of_basic', Number(e.target.value))}
                      disabled={editingSection !== 'salary_components'}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={payrollRules.salary_components?.special_allowance_auto_calculate}
                      onCheckedChange={(v) => updateRule('salary_components', 'special_allowance_auto_calculate', v)}
                      disabled={editingSection !== 'salary_components'}
                    />
                    <Label>Auto-calculate Special Allowance</Label>
                  </div>
                </div>
              </RuleSection>

              {/* Bonus Rules */}
              <RuleSection title="Bonus & Incentives" section="bonus_rules">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={payrollRules.bonus_rules?.statutory_bonus_enabled}
                        onCheckedChange={(v) => updateRule('bonus_rules', 'statutory_bonus_enabled', v)}
                        disabled={editingSection !== 'bonus_rules'}
                      />
                      <Label>Enable Statutory Bonus</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Statutory Bonus %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={payrollRules.bonus_rules?.statutory_bonus_percent || 8.33}
                        onChange={(e) => updateRule('bonus_rules', 'statutory_bonus_percent', Number(e.target.value))}
                        disabled={editingSection !== 'bonus_rules'}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Statutory Bonus Ceiling (Monthly Basic)</Label>
                      <Input
                        type="number"
                        value={payrollRules.bonus_rules?.statutory_bonus_ceiling || 7000}
                        onChange={(e) => updateRule('bonus_rules', 'statutory_bonus_ceiling', Number(e.target.value))}
                        disabled={editingSection !== 'bonus_rules'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Annual Increment Month</Label>
                      <Select
                        value={String(payrollRules.bonus_rules?.annual_increment_month || 4)}
                        onValueChange={(v) => updateRule('bonus_rules', 'annual_increment_month', Number(v))}
                        disabled={editingSection !== 'bonus_rules'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </RuleSection>

              {/* Custom Deduction Rules */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Custom Deduction Rules
                      </CardTitle>
                      <CardDescription>Define automatic deductions based on attendance patterns</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setShowAddCustomRule(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Add Rule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {customRules.length > 0 ? (
                    <div className="space-y-3">
                      {customRules.map((rule) => (
                        <div 
                          key={rule.rule_id}
                          className={`p-4 rounded-lg border ${rule.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{rule.name}</p>
                                {rule.is_default && (
                                  <Badge variant="outline" className="text-xs">Default</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 mb-2">{rule.description}</p>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="bg-blue-100 text-blue-700">
                                  If {rule.condition_type?.replace(/_/g, ' ')} {rule.condition_operator?.replace(/_/g, ' ')} {rule.condition_threshold}
                                </Badge>
                                <Badge className="bg-amber-100 text-amber-700">
                                  Then {rule.action_type?.replace(/_/g, ' ')}: {rule.action_type === 'percentage_deduction' ? `${rule.action_value}%` : `₹${rule.action_value}`}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={() => handleToggleCustomRule(rule.rule_id)}
                              />
                              {!rule.is_default && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-500"
                                  onClick={() => handleDeleteCustomRule(rule.rule_id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 mb-4">No custom deduction rules defined</p>
                      <Button variant="outline" onClick={() => setShowAddCustomRule(true)}>
                        Add First Rule
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Statutory Configuration */}
        {isHR && payrollRules && (
          <TabsContent value="config">
            <div className="grid md:grid-cols-2 gap-6">
              {/* PF Configuration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">PF Configuration</CardTitle>
                    {editingSection === 'pf_rules' ? (
                      <Button size="sm" onClick={() => handleSaveRuleSection('pf_rules')}>
                        <Save className="w-4 h-4 mr-1" /> Save
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingSection('pf_rules')}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={payrollRules.pf_rules?.enabled}
                      onCheckedChange={(v) => updateRule('pf_rules', 'enabled', v)}
                      disabled={editingSection !== 'pf_rules'}
                    />
                    <Label>Enable PF</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Employee Contribution %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payrollRules.pf_rules?.employee_contribution_percent || 12}
                      onChange={(e) => updateRule('pf_rules', 'employee_contribution_percent', Number(e.target.value))}
                      disabled={editingSection !== 'pf_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employer Contribution %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payrollRules.pf_rules?.employer_contribution_percent || 12}
                      onChange={(e) => updateRule('pf_rules', 'employer_contribution_percent', Number(e.target.value))}
                      disabled={editingSection !== 'pf_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wage Ceiling (₹)</Label>
                    <Input
                      type="number"
                      value={payrollRules.pf_rules?.wage_ceiling || 15000}
                      onChange={(e) => updateRule('pf_rules', 'wage_ceiling', Number(e.target.value))}
                      disabled={editingSection !== 'pf_rules'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ESI Configuration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">ESI Configuration</CardTitle>
                    {editingSection === 'esi_rules' ? (
                      <Button size="sm" onClick={() => handleSaveRuleSection('esi_rules')}>
                        <Save className="w-4 h-4 mr-1" /> Save
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingSection('esi_rules')}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={payrollRules.esi_rules?.enabled}
                      onCheckedChange={(v) => updateRule('esi_rules', 'enabled', v)}
                      disabled={editingSection !== 'esi_rules'}
                    />
                    <Label>Enable ESI</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Employee Contribution %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payrollRules.esi_rules?.employee_contribution_percent || 0.75}
                      onChange={(e) => updateRule('esi_rules', 'employee_contribution_percent', Number(e.target.value))}
                      disabled={editingSection !== 'esi_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employer Contribution %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payrollRules.esi_rules?.employer_contribution_percent || 3.25}
                      onChange={(e) => updateRule('esi_rules', 'employer_contribution_percent', Number(e.target.value))}
                      disabled={editingSection !== 'esi_rules'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wage Ceiling (₹/month)</Label>
                    <Input
                      type="number"
                      value={payrollRules.esi_rules?.wage_ceiling || 21000}
                      onChange={(e) => updateRule('esi_rules', 'wage_ceiling', Number(e.target.value))}
                      disabled={editingSection !== 'esi_rules'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Professional Tax */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Professional Tax Slabs</CardTitle>
                    {editingSection === 'pt_rules' ? (
                      <Button size="sm" onClick={() => handleSaveRuleSection('pt_rules')}>
                        <Save className="w-4 h-4 mr-1" /> Save
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingSection('pt_rules')}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Switch
                      checked={payrollRules.pt_rules?.enabled}
                      onCheckedChange={(v) => updateRule('pt_rules', 'enabled', v)}
                      disabled={editingSection !== 'pt_rules'}
                    />
                    <Label>Enable Professional Tax</Label>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Min Salary (₹)</TableHead>
                        <TableHead>Max Salary (₹)</TableHead>
                        <TableHead>PT Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRules.pt_rules?.slabs?.map((slab, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{formatCurrency(slab.min)}</TableCell>
                          <TableCell>{slab.max >= 999999999 ? '∞' : formatCurrency(slab.max)}</TableCell>
                          <TableCell>{formatCurrency(slab.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Payslip Detail Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Salary Slip - {selectedPayslip && `${getMonthName(selectedPayslip.month)} ${selectedPayslip.year}`}
            </DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Earnings</h4>
                <div className="space-y-2 bg-emerald-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Basic</span>
                    <span>{formatCurrency(selectedPayslip.basic)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>HRA</span>
                    <span>{formatCurrency(selectedPayslip.hra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Special Allowance</span>
                    <span>{formatCurrency(selectedPayslip.special_allowance)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Gross Salary</span>
                    <span>{formatCurrency(selectedPayslip.gross_salary)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Deductions</h4>
                <div className="space-y-2 bg-red-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>PF (Employee)</span>
                    <span>{formatCurrency(selectedPayslip.pf_employee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ESI (Employee)</span>
                    <span>{formatCurrency(selectedPayslip.esi_employee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Professional Tax</span>
                    <span>{formatCurrency(selectedPayslip.professional_tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(selectedPayslip.total_deductions)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Net Salary</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(selectedPayslip.net_salary)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <span>Working Days: {selectedPayslip.working_days}</span>
                <span>Present: {selectedPayslip.present_days}</span>
                <span>LWP: {selectedPayslip.lwp_days}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayslip(null)}>
              Close
            </Button>
            <Button className="gap-2">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Details Dialog */}
      <Dialog open={!!selectedEmployeeDetails} onOpenChange={() => setSelectedEmployeeDetails(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Employee Salary Details
            </DialogTitle>
            <DialogDescription>
              {selectedEmployeeDetails?.employee?.first_name} {selectedEmployeeDetails?.employee?.last_name}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployeeDetails && (
            <div className="space-y-4">
              {selectedEmployeeDetails.salary_structure && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Salary Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Gross Salary</p>
                        <p className="text-lg font-semibold">{formatCurrency(selectedEmployeeDetails.salary_structure.gross)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Effective From</p>
                        <p className="font-medium">{selectedEmployeeDetails.salary_structure.effective_from}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Payslips</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEmployeeDetails.payslips?.map((slip) => (
                        <TableRow key={slip.payslip_id}>
                          <TableCell>{getMonthName(slip.month)} {slip.year}</TableCell>
                          <TableCell>{formatCurrency(slip.gross_salary)}</TableCell>
                          <TableCell className="text-red-600">{formatCurrency(slip.total_deductions)}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{formatCurrency(slip.net_salary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEmployeeDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Salary Breakdown Modal */}
      <Dialog open={!!employeeBreakdown} onOpenChange={() => setEmployeeBreakdown(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-primary" />
              Salary Breakdown
            </DialogTitle>
            <DialogDescription>
              {employeeBreakdown?.employee?.name} - {getMonthName(employeeBreakdown?.period?.month)} {employeeBreakdown?.period?.year}
            </DialogDescription>
          </DialogHeader>
          
          {loadingBreakdown ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : employeeBreakdown && (
            <div className="space-y-4">
              {/* Employee Info */}
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{employeeBreakdown.employee?.name}</p>
                  <p className="text-sm text-slate-500">
                    {employeeBreakdown.employee?.department} • {employeeBreakdown.employee?.designation}
                  </p>
                </div>
                <Badge variant="outline">{employeeBreakdown.employee?.employee_code}</Badge>
              </div>

              {/* Net Salary Summary */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg text-center">
                <p className="text-sm text-slate-600 mb-1">Net Salary</p>
                <p className="text-3xl font-bold text-emerald-600">{formatCurrency(employeeBreakdown.totals?.net_salary)}</p>
              </div>

              {/* Attendance Section */}
              <Card>
                <CardHeader 
                  className="pb-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleBreakdownSection('attendance')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      Attendance Summary
                    </CardTitle>
                    {breakdownExpandedSections.attendance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </CardHeader>
                {breakdownExpandedSections.attendance && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      <div className="p-2 bg-emerald-50 rounded text-center">
                        <p className="text-xl font-bold text-emerald-600">{employeeBreakdown.attendance_summary?.present_days || 0}</p>
                        <p className="text-xs text-slate-500">Present</p>
                      </div>
                      <div className="p-2 bg-red-50 rounded text-center">
                        <p className="text-xl font-bold text-red-600">{employeeBreakdown.attendance_summary?.absent_days || 0}</p>
                        <p className="text-xs text-slate-500">Absent</p>
                      </div>
                      <div className="p-2 bg-amber-50 rounded text-center">
                        <p className="text-xl font-bold text-amber-600">{employeeBreakdown.attendance_summary?.half_days || 0}</p>
                        <p className="text-xs text-slate-500">Half Days</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded text-center">
                        <p className="text-xl font-bold text-blue-600">{employeeBreakdown.attendance_summary?.paid_leave_days || 0}</p>
                        <p className="text-xs text-slate-500">Paid Leave</p>
                      </div>
                      <div className="p-2 bg-purple-50 rounded text-center">
                        <p className="text-xl font-bold text-purple-600">{employeeBreakdown.attendance_summary?.unpaid_leave_days || 0}</p>
                        <p className="text-xs text-slate-500">LWP</p>
                      </div>
                      <div className="p-2 bg-orange-50 rounded text-center">
                        <p className="text-xl font-bold text-orange-600">{employeeBreakdown.attendance_summary?.late_arrivals || 0}</p>
                        <p className="text-xs text-slate-500">Late</p>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-slate-100 rounded flex justify-between text-sm">
                      <span>Effective Working Days:</span>
                      <span className="font-semibold">{employeeBreakdown.attendance_summary?.effective_working_days?.toFixed(1) || 0} / {employeeBreakdown.period?.working_days}</span>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Leave Breakdown Section */}
              {employeeBreakdown.leave_breakdown?.length > 0 && (
                <Card>
                  <CardHeader 
                    className="pb-2 cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleBreakdownSection('leaves')}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        Leave Details ({employeeBreakdown.leave_breakdown.length})
                      </CardTitle>
                      {breakdownExpandedSections.leaves ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                  {breakdownExpandedSections.leaves && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {employeeBreakdown.leave_breakdown.map((leave, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                            <div>
                              <span className="font-medium">{leave.leave_type}</span>
                              <span className="text-slate-500 ml-2">
                                ({leave.start_date} - {leave.end_date})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{leave.days} day(s)</span>
                              <Badge className={leave.is_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                                {leave.is_paid ? 'Paid' : 'Unpaid'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Earnings Section */}
              <Card>
                <CardHeader 
                  className="pb-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleBreakdownSection('earnings')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                      <IndianRupee className="w-4 h-4" />
                      Earnings
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-600">{formatCurrency(employeeBreakdown.totals?.gross_salary)}</span>
                      {breakdownExpandedSections.earnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
                {breakdownExpandedSections.earnings && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {Object.entries(employeeBreakdown.earnings_breakdown || {}).map(([key, value]) => (
                        value > 0 && (
                          <div key={key} className="flex justify-between text-sm p-2 bg-emerald-50 rounded">
                            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{formatCurrency(value)}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Deductions Section */}
              <Card>
                <CardHeader 
                  className="pb-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleBreakdownSection('deductions')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      Deductions
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600">{formatCurrency(employeeBreakdown.totals?.total_deductions)}</span>
                      {breakdownExpandedSections.deductions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
                {breakdownExpandedSections.deductions && (
                  <CardContent className="pt-0 space-y-3">
                    {/* Statutory Deductions */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Statutory Deductions</p>
                      <div className="space-y-1">
                        {Object.entries(employeeBreakdown.deductions_breakdown?.statutory || {}).map(([key, value]) => (
                          value > 0 && (
                            <div key={key} className="flex justify-between text-sm p-2 bg-red-50 rounded">
                              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-medium text-red-600">{formatCurrency(value)}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                    {/* Attendance-based Deductions */}
                    {Object.values(employeeBreakdown.deductions_breakdown?.attendance_based || {}).some(v => v > 0) && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Attendance-based Deductions</p>
                        <div className="space-y-1">
                          {Object.entries(employeeBreakdown.deductions_breakdown?.attendance_based || {}).map(([key, value]) => (
                            value > 0 && (
                              <div key={key} className="flex justify-between text-sm p-2 bg-orange-50 rounded">
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="font-medium text-orange-600">{formatCurrency(value)}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeBreakdown(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Rule Dialog */}
      <Dialog open={showAddCustomRule} onOpenChange={setShowAddCustomRule}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Custom Deduction Rule</DialogTitle>
            <DialogDescription>Define conditions and actions for automatic deductions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={customRuleForm.name}
                onChange={(e) => setCustomRuleForm({ ...customRuleForm, name: e.target.value })}
                placeholder="e.g., Excessive Late Arrivals Penalty"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={customRuleForm.description}
                onChange={(e) => setCustomRuleForm({ ...customRuleForm, description: e.target.value })}
                placeholder="Brief description of the rule"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Condition Type</Label>
                <Select
                  value={customRuleForm.condition_type}
                  onValueChange={(v) => setCustomRuleForm({ ...customRuleForm, condition_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="late_count">Late Arrivals</SelectItem>
                    <SelectItem value="absent_count">Total Absents</SelectItem>
                    <SelectItem value="absent_without_leave">Unapproved Absents</SelectItem>
                    <SelectItem value="early_departure_count">Early Departures</SelectItem>
                    <SelectItem value="half_day_count">Half Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={customRuleForm.condition_operator}
                  onValueChange={(v) => setCustomRuleForm({ ...customRuleForm, condition_operator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greater_than">&gt; Greater than</SelectItem>
                    <SelectItem value="greater_equals">&gt;= Greater or equal</SelectItem>
                    <SelectItem value="equals">= Equals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  type="number"
                  value={customRuleForm.condition_threshold}
                  onChange={(e) => setCustomRuleForm({ ...customRuleForm, condition_threshold: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={customRuleForm.action_type}
                  onValueChange={(v) => setCustomRuleForm({ ...customRuleForm, action_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage_deduction">% of Gross</SelectItem>
                    <SelectItem value="fixed_deduction">Fixed Amount (₹)</SelectItem>
                    <SelectItem value="half_day_deduction">Half Day per Occurrence</SelectItem>
                    <SelectItem value="full_day_deduction">Full Day per Occurrence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {customRuleForm.action_type === 'percentage_deduction' ? 'Percentage (%)' : 
                   customRuleForm.action_type === 'fixed_deduction' ? 'Amount (₹)' : 'Multiplier'}
                </Label>
                <Input
                  type="number"
                  value={customRuleForm.action_value}
                  onChange={(e) => setCustomRuleForm({ ...customRuleForm, action_value: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Rule Preview:</strong> If {customRuleForm.condition_type.replace(/_/g, ' ')} is {customRuleForm.condition_operator.replace(/_/g, ' ')} {customRuleForm.condition_threshold}, 
                then deduct {customRuleForm.action_type === 'percentage_deduction' ? `${customRuleForm.action_value}% of gross salary` : 
                customRuleForm.action_type === 'fixed_deduction' ? `₹${customRuleForm.action_value}` : 
                `${customRuleForm.action_value} ${customRuleForm.action_type.replace(/_/g, ' ')}`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCustomRule(false)}>Cancel</Button>
            <Button onClick={handleAddCustomRule}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Salary Dialog */}
      <Dialog open={editSalaryOpen} onOpenChange={setEditSalaryOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Salary Structure
            </DialogTitle>
            <DialogDescription>
              {editingEmployee?.employee_name} ({editingEmployee?.emp_code})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Fixed Components (Earnings) */}
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Fixed Components (Earnings)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="basic">BASIC</Label>
                  <Input
                    id="basic"
                    type="number"
                    value={salaryForm.basic}
                    onChange={(e) => setSalaryForm({...salaryForm, basic: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="da">DA</Label>
                  <Input
                    id="da"
                    type="number"
                    value={salaryForm.da}
                    onChange={(e) => setSalaryForm({...salaryForm, da: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="hra">HRA</Label>
                  <Input
                    id="hra"
                    type="number"
                    value={salaryForm.hra}
                    onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="conveyance">Conveyance</Label>
                  <Input
                    id="conveyance"
                    type="number"
                    value={salaryForm.conveyance}
                    onChange={(e) => setSalaryForm({...salaryForm, conveyance: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="grade_pay">Grade Pay</Label>
                  <Input
                    id="grade_pay"
                    type="number"
                    value={salaryForm.grade_pay}
                    onChange={(e) => setSalaryForm({...salaryForm, grade_pay: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="other_allowance">Other Allowance</Label>
                  <Input
                    id="other_allowance"
                    type="number"
                    value={salaryForm.other_allowance}
                    onChange={(e) => setSalaryForm({...salaryForm, other_allowance: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="medical_allowance">Medical/Spl. Allow</Label>
                  <Input
                    id="medical_allowance"
                    type="number"
                    value={salaryForm.medical_allowance}
                    onChange={(e) => setSalaryForm({...salaryForm, medical_allowance: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Fixed Salary:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(
                      parseFloat(salaryForm.basic || 0) + 
                      parseFloat(salaryForm.da || 0) + 
                      parseFloat(salaryForm.hra || 0) + 
                      parseFloat(salaryForm.conveyance || 0) + 
                      parseFloat(salaryForm.grade_pay || 0) + 
                      parseFloat(salaryForm.other_allowance || 0) + 
                      parseFloat(salaryForm.medical_allowance || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Deduction Configuration */}
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Deduction Configuration</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="epf_applicable"
                    checked={salaryForm.epf_applicable}
                    onCheckedChange={(checked) => setSalaryForm({...salaryForm, epf_applicable: checked})}
                  />
                  <Label htmlFor="epf_applicable">EPF Applicable</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="esi_applicable"
                    checked={salaryForm.esi_applicable}
                    onCheckedChange={(checked) => setSalaryForm({...salaryForm, esi_applicable: checked})}
                  />
                  <Label htmlFor="esi_applicable">ESI Applicable</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="sewa_applicable"
                    checked={salaryForm.sewa_applicable}
                    onCheckedChange={(checked) => setSalaryForm({...salaryForm, sewa_applicable: checked})}
                  />
                  <Label htmlFor="sewa_applicable">SEWA Applicable</Label>
                </div>
              </div>
            </div>

            {/* Fixed Deductions */}
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Fixed Deductions</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sewa_advance">SEWA Advance</Label>
                  <Input
                    id="sewa_advance"
                    type="number"
                    value={salaryForm.sewa_advance}
                    onChange={(e) => setSalaryForm({...salaryForm, sewa_advance: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="other_deduction">Other Deduction</Label>
                  <Input
                    id="other_deduction"
                    type="number"
                    value={salaryForm.other_deduction}
                    onChange={(e) => setSalaryForm({...salaryForm, other_deduction: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason for Change</Label>
              <Input
                id="reason"
                value={salaryForm.reason}
                onChange={(e) => setSalaryForm({...salaryForm, reason: e.target.value})}
                placeholder="Enter reason for salary change..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSalaryOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSalary} disabled={savingSalary}>
              {savingSalary ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {user?.role === 'super_admin' ? 'Save Changes' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Change Requests Dialog (for approvers) */}
      {salaryChangeRequests.length > 0 && canApproveSalary && (
        <Card className="fixed bottom-4 right-4 w-80 shadow-lg border-amber-200 bg-amber-50 z-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4" />
              Pending Salary Changes ({salaryChangeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {salaryChangeRequests.slice(0, 3).map((req) => (
                <div key={req.request_id} className="bg-white p-2 rounded border text-sm">
                  <p className="font-medium">{req.employee_name}</p>
                  <p className="text-xs text-slate-500">By {req.requested_by_name}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleApproveRequest(req.request_id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRejectRequest(req.request_id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary History Dialog */}
      <Dialog open={showSalaryHistory} onOpenChange={setShowSalaryHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Salary Change History
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {salaryHistory.length > 0 ? (
              <div className="space-y-4">
                {salaryHistory.map((entry, idx) => (
                  <div key={entry.history_id || idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">Changed by: {entry.changed_by_name}</p>
                        {entry.approved_by_name && (
                          <p className="text-sm text-slate-500">Approved by: {entry.approved_by_name}</p>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {new Date(entry.changed_at).toLocaleDateString('en-IN', { 
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">Reason: {entry.reason || 'Not specified'}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-red-50 p-2 rounded">
                        <p className="text-red-700 font-medium">Previous</p>
                        <p>Total: {formatCurrency(entry.old_salary?.total_fixed || 0)}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-green-700 font-medium">New</p>
                        <p>Total: {formatCurrency(entry.new_salary?.total_fixed || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                No salary change history found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payroll Details Dialog */}
      <Dialog open={viewPayrollOpen} onOpenChange={setViewPayrollOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Payroll Details - {selectedPayrollRun && `${getMonthName(selectedPayrollRun.month)} ${selectedPayrollRun.year}`}
              </DialogTitle>
              <Button 
                onClick={exportPayrollToExcel} 
                className="gap-2"
                disabled={!payrollDetails}
                data-testid="export-payroll-btn"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </Button>
            </div>
            <DialogDescription>
              {selectedPayrollRun && (
                <div className="flex gap-4 mt-2">
                  <Badge className={statusColors[selectedPayrollRun.status]}>
                    {selectedPayrollRun.status}
                  </Badge>
                  <span className="text-slate-600">{payrollDetails?.summary?.total_employees || 0} employees</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingPayrollDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : payrollDetails ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Total Gross</p>
                  <p className="text-lg font-bold text-blue-800">{formatCurrency(payrollDetails.summary?.total_gross)}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Total Deductions</p>
                  <p className="text-lg font-bold text-red-800">{formatCurrency(payrollDetails.summary?.total_deductions)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-xs text-emerald-600 font-medium">Total Net Pay</p>
                  <p className="text-lg font-bold text-emerald-800">{formatCurrency(payrollDetails.summary?.total_net)}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">PF + ESI + PT</p>
                  <p className="text-lg font-bold text-purple-800">
                    {formatCurrency(
                      (payrollDetails.summary?.total_pf || 0) + 
                      (payrollDetails.summary?.total_esi || 0) + 
                      (payrollDetails.summary?.total_pt || 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Payslips Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Emp Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollDetails.payslips?.map((slip, index) => (
                      <TableRow key={slip.payslip_id || index} data-testid={`payslip-row-${index}`}>
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium">{slip.emp_code || slip.employee_id}</TableCell>
                        <TableCell>{slip.employee_name || '-'}</TableCell>
                        <TableCell className="text-slate-600">{slip.department || '-'}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm">
                            {slip.paid_days || 0}/{slip.working_days || 26}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(slip.gross_salary)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(slip.total_deductions)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(slip.net_salary)}</TableCell>
                      </TableRow>
                    ))}
                    {(!payrollDetails.payslips || payrollDetails.payslips.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          No payslips found for this payroll run
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              No payroll data available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollPage;
