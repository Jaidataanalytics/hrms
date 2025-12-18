"""Document & Asset Management Models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


class Document(BaseModel):
    """Employee document"""
    model_config = ConfigDict(extra="ignore")
    document_id: str = Field(default_factory=lambda: f"doc_{uuid.uuid4().hex[:12]}")
    employee_id: str
    name: str
    type: str  # id_proof, address_proof, education, experience, offer_letter, etc.
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    expiry_date: Optional[str] = None
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    remarks: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentType(BaseModel):
    """Document type master"""
    model_config = ConfigDict(extra="ignore")
    type_id: str = Field(default_factory=lambda: f"dtype_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    description: Optional[str] = None
    is_mandatory: bool = False
    requires_expiry: bool = False
    expiry_reminder_days: int = 30
    applicable_to: List[str] = ["management", "labour", "contract"]
    is_active: bool = True


class Asset(BaseModel):
    """Company asset"""
    model_config = ConfigDict(extra="ignore")
    asset_id: str = Field(default_factory=lambda: f"ast_{uuid.uuid4().hex[:12]}")
    name: str
    asset_tag: str
    category: str  # laptop, mobile, furniture, vehicle, etc.
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    warranty_end: Optional[str] = None
    current_value: Optional[float] = None
    location_id: Optional[str] = None
    status: str = "available"  # available, assigned, maintenance, disposed
    assigned_to: Optional[str] = None  # employee_id
    assigned_date: Optional[str] = None
    condition: str = "good"  # excellent, good, fair, poor
    notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssetAssignment(BaseModel):
    """Asset assignment history"""
    model_config = ConfigDict(extra="ignore")
    assignment_id: str = Field(default_factory=lambda: f"asgn_{uuid.uuid4().hex[:12]}")
    asset_id: str
    employee_id: str
    assigned_date: str
    returned_date: Optional[str] = None
    condition_at_assignment: str = "good"
    condition_at_return: Optional[str] = None
    assigned_by: str
    returned_to: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssetRequest(BaseModel):
    """Employee asset request"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"areq_{uuid.uuid4().hex[:12]}")
    employee_id: str
    category: str
    description: str
    justification: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, fulfilled
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    fulfilled_asset_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExpenseClaim(BaseModel):
    """Employee expense claim"""
    model_config = ConfigDict(extra="ignore")
    claim_id: str = Field(default_factory=lambda: f"exp_{uuid.uuid4().hex[:12]}")
    employee_id: str
    title: str
    category: str  # travel, food, accommodation, client_entertainment, fuel, other
    amount: float
    currency: str = "INR"
    expense_date: str
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    receipt_file_name: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, reimbursed
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_amount: Optional[float] = None
    rejection_reason: Optional[str] = None
    reimbursed_date: Optional[str] = None
    transaction_ref: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExpensePolicy(BaseModel):
    """Expense category policy"""
    model_config = ConfigDict(extra="ignore")
    policy_id: str = Field(default_factory=lambda: f"epol_{uuid.uuid4().hex[:12]}")
    category: str
    name: str
    description: Optional[str] = None
    max_amount_per_claim: Optional[float] = None
    max_amount_per_month: Optional[float] = None
    requires_receipt: bool = True
    min_amount_for_receipt: float = 500
    applicable_designations: List[str] = []
    approval_levels: List[Dict[str, Any]] = []  # [{min_amount, max_amount, approver_role}]
    is_active: bool = True
