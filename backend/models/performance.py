"""Performance & KPI Models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


class KPITemplate(BaseModel):
    """KPI Template for role-based performance tracking"""
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: f"kpi_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    applicable_designations: List[str] = []  # designation_ids
    applicable_departments: List[str] = []  # department_ids
    questions: List[Dict[str, Any]] = []  # [{question, type, max_points, weightage}]
    total_points: float = 100
    review_frequency: str = "quarterly"  # monthly, quarterly, semi_annual, annual
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KPIQuestion(BaseModel):
    """Individual KPI question/metric"""
    question_id: str = Field(default_factory=lambda: f"q_{uuid.uuid4().hex[:12]}")
    question: str
    description: Optional[str] = None
    type: str = "quantitative"  # quantitative, qualitative, rating
    max_points: float = 10
    weightage: float = 1.0
    target_value: Optional[float] = None
    unit: Optional[str] = None  # %, count, currency, etc.


class EmployeeKPI(BaseModel):
    """Employee KPI submission"""
    model_config = ConfigDict(extra="ignore")
    kpi_id: str = Field(default_factory=lambda: f"ekpi_{uuid.uuid4().hex[:12]}")
    employee_id: str
    template_id: str
    period_type: str = "quarterly"  # monthly, quarterly, semi_annual, annual
    period_start: str  # YYYY-MM-DD
    period_end: str
    responses: List[Dict[str, Any]] = []  # [{question_id, value, score, remarks}]
    self_score: Optional[float] = None
    manager_score: Optional[float] = None
    final_score: Optional[float] = None
    rating: Optional[int] = None  # 1-10 scale
    status: str = "draft"  # draft, submitted, under_review, approved
    submitted_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    manager_remarks: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PerformanceReview(BaseModel):
    """Annual/Periodic performance review"""
    model_config = ConfigDict(extra="ignore")
    review_id: str = Field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    employee_id: str
    reviewer_id: str
    review_period: str  # "2025-Q1", "2025-H1", "2025"
    review_type: str = "annual"  # annual, mid_year, probation, confirmation
    
    # Scores
    kpi_score: Optional[float] = None
    competency_score: Optional[float] = None
    behavior_score: Optional[float] = None
    overall_score: Optional[float] = None
    final_rating: Optional[int] = None  # 1-10
    
    # Qualitative feedback
    strengths: Optional[str] = None
    areas_of_improvement: Optional[str] = None
    goals_achieved: Optional[str] = None
    goals_next_period: Optional[str] = None
    
    # Recommendations
    recommended_increment_percentage: Optional[float] = None
    recommended_promotion: bool = False
    recommended_role: Optional[str] = None
    
    # 360 feedback
    peer_feedback: List[Dict[str, Any]] = []
    
    status: str = "draft"  # draft, submitted, calibrated, approved, shared
    hr_remarks: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Goal(BaseModel):
    """Individual goal tracking"""
    model_config = ConfigDict(extra="ignore")
    goal_id: str = Field(default_factory=lambda: f"goal_{uuid.uuid4().hex[:12]}")
    employee_id: str
    title: str
    description: Optional[str] = None
    category: str = "performance"  # performance, learning, project
    priority: str = "medium"  # low, medium, high
    target_date: Optional[str] = None
    progress: int = 0  # 0-100
    status: str = "in_progress"  # not_started, in_progress, completed, deferred
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
