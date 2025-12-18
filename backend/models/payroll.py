"""Payroll Models for India Compliance"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


class SalaryComponent(BaseModel):
    """Salary component (earning or deduction)"""
    model_config = ConfigDict(extra="ignore")
    component_id: str = Field(default_factory=lambda: f"comp_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    type: str = "earning"  # earning, deduction, reimbursement
    calculation_type: str = "fixed"  # fixed, percentage, formula
    percentage_of: Optional[str] = None  # component_id for percentage calculation
    formula: Optional[str] = None
    is_taxable: bool = True
    is_pf_applicable: bool = False
    is_esi_applicable: bool = False
    is_pt_applicable: bool = False
    applicable_to: List[str] = ["management", "labour", "contract"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SalaryTemplate(BaseModel):
    """Salary structure template"""
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: f"tmpl_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    description: Optional[str] = None
    components: List[Dict[str, Any]] = []  # [{component_id, default_amount, is_mandatory}]
    applicable_to: List[str] = ["management"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EmployeeSalary(BaseModel):
    """Employee salary structure assignment"""
    model_config = ConfigDict(extra="ignore")
    salary_id: str = Field(default_factory=lambda: f"sal_{uuid.uuid4().hex[:12]}")
    employee_id: str
    template_id: Optional[str] = None
    effective_from: str  # YYYY-MM-DD
    effective_to: Optional[str] = None
    ctc: float = 0
    gross: float = 0
    net: float = 0
    components: List[Dict[str, Any]] = []  # [{component_id, amount}]
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    uan_number: Optional[str] = None  # PF UAN
    esi_number: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PayrollRun(BaseModel):
    """Monthly payroll run"""
    model_config = ConfigDict(extra="ignore")
    payroll_id: str = Field(default_factory=lambda: f"pr_{uuid.uuid4().hex[:12]}")
    month: int
    year: int
    status: str = "draft"  # draft, processing, processed, locked
    total_employees: int = 0
    total_gross: float = 0
    total_deductions: float = 0
    total_net: float = 0
    total_pf: float = 0
    total_esi: float = 0
    total_pt: float = 0
    total_tds: float = 0
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Payslip(BaseModel):
    """Individual employee payslip"""
    model_config = ConfigDict(extra="ignore")
    payslip_id: str = Field(default_factory=lambda: f"ps_{uuid.uuid4().hex[:12]}")
    payroll_id: str
    employee_id: str
    month: int
    year: int
    working_days: int = 0
    present_days: float = 0
    lwp_days: float = 0
    paid_days: float = 0
    
    # Earnings
    basic: float = 0
    hra: float = 0
    special_allowance: float = 0
    other_earnings: float = 0
    overtime_amount: float = 0
    bonus: float = 0
    gross_salary: float = 0
    
    # Deductions
    pf_employee: float = 0
    pf_employer: float = 0
    esi_employee: float = 0
    esi_employer: float = 0
    professional_tax: float = 0
    tds: float = 0
    loan_deduction: float = 0
    other_deductions: float = 0
    total_deductions: float = 0
    
    net_salary: float = 0
    
    # Breakdown
    earnings_breakdown: List[Dict[str, Any]] = []
    deductions_breakdown: List[Dict[str, Any]] = []
    
    status: str = "draft"  # draft, approved, paid
    payment_date: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_ref: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PayrollConfig(BaseModel):
    """Payroll configuration and rules"""
    model_config = ConfigDict(extra="ignore")
    config_id: str = Field(default_factory=lambda: f"cfg_{uuid.uuid4().hex[:12]}")
    
    # PF Configuration
    pf_enabled: bool = True
    pf_employee_rate: float = 12.0  # percentage
    pf_employer_rate: float = 12.0
    pf_wage_ceiling: float = 15000  # Max basic for PF calculation
    
    # ESI Configuration
    esi_enabled: bool = True
    esi_employee_rate: float = 0.75
    esi_employer_rate: float = 3.25
    esi_wage_ceiling: float = 21000  # Monthly gross limit
    
    # PT Configuration (State-wise)
    pt_enabled: bool = True
    pt_slabs: List[Dict[str, Any]] = [
        {"min": 0, "max": 10000, "amount": 0},
        {"min": 10001, "max": 15000, "amount": 150},
        {"min": 15001, "max": 999999999, "amount": 200}
    ]
    
    # TDS Configuration
    tds_enabled: bool = True
    
    # Other settings
    payroll_cutoff_day: int = 25  # Day of month for attendance cutoff
    payment_day: int = 1  # Day of next month for payment
    
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
