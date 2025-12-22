from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'sharda-hr-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 168  # 7 days for better UX

# Create the main app
app = FastAPI(title="Sharda HR API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# Authentication Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    employee_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "employee"
    roles: List[str] = []
    permissions: List[str] = []
    employee_id: Optional[str] = None
    department_id: Optional[str] = None
    is_active: bool = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class SessionData(BaseModel):
    session_id: str

# Role & Permission Models
class Permission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    permission_id: str = Field(default_factory=lambda: f"perm_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    module: str
    description: Optional[str] = None

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role_id: str = Field(default_factory=lambda: f"role_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    description: Optional[str] = None
    permissions: List[str] = []
    is_system: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Employee Models
class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    employee_id: str = Field(default_factory=lambda: f"EMP{uuid.uuid4().hex[:8].upper()}")
    user_id: Optional[str] = None
    emp_code: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    location_id: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    employment_type: str = "management"  # management, labour, contract
    joining_date: Optional[str] = None
    confirmation_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    status: str = "active"  # active, inactive, terminated, resigned
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    location_id: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    employment_type: str = "management"
    joining_date: Optional[str] = None

# Master Data Models
class Department(BaseModel):
    model_config = ConfigDict(extra="ignore")
    department_id: str = Field(default_factory=lambda: f"dept_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    description: Optional[str] = None
    head_employee_id: Optional[str] = None
    parent_department_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Designation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    designation_id: str = Field(default_factory=lambda: f"desig_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    grade: Optional[str] = None
    band: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Location(BaseModel):
    model_config = ConfigDict(extra="ignore")
    location_id: str = Field(default_factory=lambda: f"loc_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Attendance Models
class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    attendance_id: str = Field(default_factory=lambda: f"att_{uuid.uuid4().hex[:12]}")
    employee_id: str
    date: str  # YYYY-MM-DD
    first_in: Optional[str] = None
    last_out: Optional[str] = None
    punches: List[Dict[str, str]] = []  # [{type: "IN/OUT", time: "HH:MM", source: "biometric/wfh/tour"}]
    total_hours: Optional[float] = None
    status: str = "present"  # present, absent, half_day, wfh, tour, holiday, weekly_off
    is_late: bool = False
    late_minutes: int = 0
    overtime_hours: float = 0
    shift_id: Optional[str] = None
    remarks: Optional[str] = None
    is_regularized: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceMarkRequest(BaseModel):
    punch_type: str = "IN"  # IN or OUT
    source: str = "biometric"  # biometric, wfh, tour, manual
    location: Optional[Dict[str, float]] = None  # {lat, lng} for GPS
    remarks: Optional[str] = None

# Leave Models
class LeaveType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leave_type_id: str = Field(default_factory=lambda: f"lt_{uuid.uuid4().hex[:12]}")
    name: str
    code: str
    description: Optional[str] = None
    annual_quota: int = 0
    carry_forward_allowed: bool = False
    max_carry_forward: int = 0
    encashment_allowed: bool = False
    half_day_allowed: bool = True
    negative_balance_allowed: bool = False
    requires_approval: bool = True
    applicable_to: List[str] = ["management", "labour", "contract"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeaveBalance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    balance_id: str = Field(default_factory=lambda: f"lb_{uuid.uuid4().hex[:12]}")
    employee_id: str
    leave_type_id: str
    year: int
    opening_balance: float = 0
    accrued: float = 0
    used: float = 0
    pending: float = 0
    available: float = 0
    carry_forward: float = 0

class LeaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leave_id: str = Field(default_factory=lambda: f"leave_{uuid.uuid4().hex[:12]}")
    employee_id: str
    leave_type_id: str
    from_date: str
    to_date: str
    days: float
    is_half_day: bool = False
    half_day_type: Optional[str] = None  # first_half, second_half
    reason: str
    status: str = "pending"  # pending, approved, rejected, cancelled
    applied_on: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_by: Optional[str] = None
    approved_on: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeaveApplyRequest(BaseModel):
    leave_type_id: str
    from_date: str
    to_date: str
    is_half_day: bool = False
    half_day_type: Optional[str] = None
    reason: str

# Audit Log Model
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    audit_id: str = Field(default_factory=lambda: f"audit_{uuid.uuid4().hex[:12]}")
    action: str
    module: str
    entity_type: str
    entity_id: str
    user_id: str
    user_name: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Announcement Model
class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    announcement_id: str = Field(default_factory=lambda: f"ann_{uuid.uuid4().hex[:12]}")
    title: str
    content: str
    category: str = "general"  # general, policy, event, birthday, anniversary
    priority: str = "normal"  # low, normal, high, urgent
    target_departments: List[str] = []  # empty = all
    target_locations: List[str] = []
    requires_acknowledgment: bool = False
    acknowledged_by: List[str] = []
    read_by: List[str] = []
    is_pinned: bool = False
    published_by: str
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Notification Model
class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    message: str
    type: str = "info"  # info, success, warning, error
    module: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    # Check cookie first, then Authorization header
    session_token = request.cookies.get("session_token")
    access_token_cookie = request.cookies.get("access_token")
    
    if session_token:
        # Verify session token from Google OAuth
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user
    
    # Check access_token cookie (JWT)
    if access_token_cookie:
        try:
            payload = decode_jwt_token(access_token_cookie)
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                return user
        except:
            pass  # Token invalid, try other methods
    
    # Check Authorization header for JWT
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_jwt_token(token)
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    
    raise HTTPException(status_code=401, detail="Not authenticated")

async def log_audit(action: str, module: str, entity_type: str, entity_id: str, 
                   user_id: str, user_name: str, old_value: dict = None, 
                   new_value: dict = None, request: Request = None):
    audit = AuditLog(
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        user_name=user_name,
        old_value=old_value,
        new_value=new_value,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )
    doc = audit.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)

async def create_notification(user_id: str, title: str, message: str, 
                             type: str, module: str, link: str = None):
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        module=module,
        link=link
    )
    doc = notif.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, request: Request):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": user_data.name,
        "picture": None,
        "role": "employee",
        "roles": ["employee"],
        "permissions": [],
        "employee_id": user_data.employee_id,
        "department_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Log audit
    await log_audit("CREATE", "auth", "user", user_id, user_id, user_data.name, 
                   new_value={"email": user_data.email, "name": user_data.name}, request=request)
    
    token = create_jwt_token(user_id, user_data.email, "employee")
    
    user_response = UserResponse(
        user_id=user_id,
        email=user_data.email,
        name=user_data.name,
        role="employee",
        roles=["employee"],
        permissions=[],
        employee_id=user_data.employee_id
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    # Support both 'password' and 'password_hash' fields for compatibility
    stored_password = user.get("password") or user.get("password_hash", "") if user else ""
    if not user or not verify_password(credentials.password, stored_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    # Invalidate existing sessions (single session enforcement)
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    
    token = create_jwt_token(user["user_id"], user["email"], user.get("role", "employee"))
    
    # Create session for JWT login as well
    session_token = f"jwt_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie - detect if running over HTTPS
    is_secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_secure,
        samesite="lax" if not is_secure else "none",
        path="/",
        max_age=7*24*60*60  # 7 days
    )
    
    # Also set the JWT token as a cookie for redundancy
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_secure,
        samesite="lax" if not is_secure else "none",
        path="/",
        max_age=7*24*60*60  # 7 days
    )
    
    user_response = UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture"),
        role=user.get("role", "employee"),
        roles=user.get("roles", ["employee"]),
        permissions=user.get("permissions", []),
        employee_id=user.get("employee_id"),
        department_id=user.get("department_id")
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/google-session")
async def process_google_session(session_data: SessionData, response: Response):
    """Process Google OAuth session from Emergent Auth"""
    try:
        # Call Emergent auth API to get user data
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_data.session_id}
            )
            
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = resp.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            user = existing_user
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "password": None,
                "role": "employee",
                "roles": ["employee"],
                "permissions": [],
                "employee_id": None,
                "department_id": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
        
        # Invalidate existing sessions (single session enforcement)
        await db.user_sessions.delete_many({"user_id": user_id})
        
        # Store session
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": user.get("role", "employee"),
            "roles": user.get("roles", ["employee"]),
            "permissions": user.get("permissions", []),
            "employee_id": user.get("employee_id"),
            "department_id": user.get("department_id"),
            "is_active": True
        }
        
    except httpx.RequestError as e:
        logger.error(f"Error calling Emergent auth: {e}")
        raise HTTPException(status_code=500, detail="Authentication service error")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture"),
        role=user.get("role", "employee"),
        roles=user.get("roles", ["employee"]),
        permissions=user.get("permissions", []),
        employee_id=user.get("employee_id"),
        department_id=user.get("department_id"),
        is_active=user.get("is_active", True)
    )

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== EMPLOYEE ROUTES ====================

@api_router.get("/employees", response_model=List[Employee])
async def list_employees(
    request: Request,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    employment_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    user = await get_current_user(request)
    
    query = {}
    if department_id:
        query["department_id"] = department_id
    if status:
        query["status"] = status
    if employment_type:
        query["employment_type"] = employment_type
    
    # Apply data visibility rules
    user_role = user.get("role", "employee")
    if user_role == "employee":
        query["employee_id"] = user.get("employee_id")
    elif user_role in ["manager", "team_lead"]:
        # Managers see their department
        if user.get("department_id"):
            query["department_id"] = user["department_id"]
    # HR and admin see all
    
    employees = await db.employees.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return employees

@api_router.post("/employees", response_model=Employee)
async def create_employee(emp_data: EmployeeCreate, request: Request):
    user = await get_current_user(request)
    
    # Check permission (HR/Admin only)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized to create employees")
    
    employee = Employee(**emp_data.model_dump())
    doc = employee.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.employees.insert_one(doc)
    
    await log_audit("CREATE", "employee", "employee", employee.employee_id,
                   user["user_id"], user.get("name", ""), new_value=emp_data.model_dump(), request=request)
    
    return employee

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    user_role = user.get("role", "employee")
    if user_role == "employee" and employee_id != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return employee

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, emp_data: dict, request: Request):
    user = await get_current_user(request)
    
    old_emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not old_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.employees.update_one({"employee_id": employee_id}, {"$set": emp_data})
    
    await log_audit("UPDATE", "employee", "employee", employee_id,
                   user["user_id"], user.get("name", ""), old_value=old_emp, new_value=emp_data, request=request)
    
    updated = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    return updated

# ==================== MASTER DATA ROUTES ====================

# Departments
@api_router.get("/departments", response_model=List[Department])
async def list_departments(request: Request):
    await get_current_user(request)
    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(100)
    return departments

@api_router.post("/departments", response_model=Department)
async def create_department(dept_data: dict, request: Request):
    user = await get_current_user(request)
    
    department = Department(**dept_data)
    doc = department.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.departments.insert_one(doc)
    
    await log_audit("CREATE", "master", "department", department.department_id,
                   user["user_id"], user.get("name", ""), new_value=dept_data, request=request)
    
    return department

# Designations
@api_router.get("/designations", response_model=List[Designation])
async def list_designations(request: Request):
    await get_current_user(request)
    designations = await db.designations.find({"is_active": True}, {"_id": 0}).to_list(100)
    return designations

@api_router.post("/designations", response_model=Designation)
async def create_designation(desig_data: dict, request: Request):
    user = await get_current_user(request)
    
    designation = Designation(**desig_data)
    doc = designation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.designations.insert_one(doc)
    
    await log_audit("CREATE", "master", "designation", designation.designation_id,
                   user["user_id"], user.get("name", ""), new_value=desig_data, request=request)
    
    return designation

# Locations
@api_router.get("/locations", response_model=List[Location])
async def list_locations(request: Request):
    await get_current_user(request)
    locations = await db.locations.find({"is_active": True}, {"_id": 0}).to_list(100)
    return locations

@api_router.post("/locations", response_model=Location)
async def create_location(loc_data: dict, request: Request):
    user = await get_current_user(request)
    
    location = Location(**loc_data)
    doc = location.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.locations.insert_one(doc)
    
    await log_audit("CREATE", "master", "location", location.location_id,
                   user["user_id"], user.get("name", ""), new_value=loc_data, request=request)
    
    return location

# ==================== ATTENDANCE ROUTES ====================

@api_router.post("/attendance/mark")
async def mark_attendance(mark_data: AttendanceMarkRequest, request: Request):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now_time = datetime.now(timezone.utc).strftime("%H:%M")
    
    # Find or create today's attendance
    existing = await db.attendance.find_one({"employee_id": employee_id, "date": today}, {"_id": 0})
    
    punch = {"type": mark_data.punch_type, "time": now_time, "source": mark_data.source}
    if mark_data.location:
        punch["location"] = mark_data.location
    
    if existing:
        punches = existing.get("punches", [])
        punches.append(punch)
        
        # Calculate first_in, last_out
        in_times = [p["time"] for p in punches if p["type"] == "IN"]
        out_times = [p["time"] for p in punches if p["type"] == "OUT"]
        
        first_in = min(in_times) if in_times else None
        last_out = max(out_times) if out_times else None
        
        # Calculate total hours if we have both
        total_hours = None
        if first_in and last_out:
            from datetime import datetime as dt
            t1 = dt.strptime(first_in, "%H:%M")
            t2 = dt.strptime(last_out, "%H:%M")
            total_hours = round((t2 - t1).seconds / 3600, 2)
        
        await db.attendance.update_one(
            {"employee_id": employee_id, "date": today},
            {"$set": {
                "punches": punches,
                "first_in": first_in,
                "last_out": last_out,
                "total_hours": total_hours,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        attendance = Attendance(
            employee_id=employee_id,
            date=today,
            first_in=now_time if mark_data.punch_type == "IN" else None,
            last_out=now_time if mark_data.punch_type == "OUT" else None,
            punches=[punch],
            status="present" if mark_data.source != "wfh" else "wfh"
        )
        doc = attendance.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.attendance.insert_one(doc)
    
    await create_notification(user["user_id"], "Attendance Marked",
                             f"Your {mark_data.punch_type} has been recorded at {now_time}",
                             "success", "attendance")
    
    return {"message": f"Attendance {mark_data.punch_type} marked successfully", "time": now_time}

@api_router.get("/attendance/my")
async def get_my_attendance(request: Request, month: Optional[str] = None, year: Optional[int] = None):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    query = {"employee_id": employee_id}
    
    if month and year:
        # Filter by month/year
        query["date"] = {"$regex": f"^{year}-{month.zfill(2)}"}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(100)
    return attendance

@api_router.get("/attendance/daily")
async def get_daily_attendance(request: Request, date: Optional[str] = None, department_id: Optional[str] = None):
    user = await get_current_user(request)
    
    # Check permission
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {"date": target_date}
    if department_id:
        # Get employees in department
        dept_employees = await db.employees.find({"department_id": department_id}, {"employee_id": 1, "_id": 0}).to_list(1000)
        emp_ids = [e["employee_id"] for e in dept_employees]
        query["employee_id"] = {"$in": emp_ids}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(500)
    return attendance

# ==================== LEAVE ROUTES ====================

@api_router.get("/leave-types", response_model=List[LeaveType])
async def list_leave_types(request: Request):
    await get_current_user(request)
    leave_types = await db.leave_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    return leave_types

@api_router.post("/leave-types", response_model=LeaveType)
async def create_leave_type(lt_data: dict, request: Request):
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_type = LeaveType(**lt_data)
    doc = leave_type.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.leave_types.insert_one(doc)
    
    await log_audit("CREATE", "leave", "leave_type", leave_type.leave_type_id,
                   user["user_id"], user.get("name", ""), new_value=lt_data, request=request)
    
    return leave_type

@api_router.get("/leave/balance")
async def get_leave_balance(request: Request):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    current_year = datetime.now(timezone.utc).year
    balances = await db.leave_balances.find(
        {"employee_id": employee_id, "year": current_year}, {"_id": 0}
    ).to_list(50)
    
    return balances

@api_router.post("/leave/apply", response_model=LeaveRequest)
async def apply_leave(leave_data: LeaveApplyRequest, request: Request):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    
    # Calculate days
    from datetime import datetime as dt
    from_dt = dt.strptime(leave_data.from_date, "%Y-%m-%d")
    to_dt = dt.strptime(leave_data.to_date, "%Y-%m-%d")
    days = (to_dt - from_dt).days + 1
    
    if leave_data.is_half_day:
        days = 0.5
    
    leave_request = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=leave_data.leave_type_id,
        from_date=leave_data.from_date,
        to_date=leave_data.to_date,
        days=days,
        is_half_day=leave_data.is_half_day,
        half_day_type=leave_data.half_day_type,
        reason=leave_data.reason
    )
    
    doc = leave_request.model_dump()
    doc['applied_on'] = doc['applied_on'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.leave_requests.insert_one(doc)
    
    # Get employee's manager and notify
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if employee and employee.get("reporting_manager_id"):
        manager = await db.employees.find_one({"employee_id": employee["reporting_manager_id"]}, {"_id": 0})
        if manager and manager.get("user_id"):
            await create_notification(
                manager["user_id"],
                "Leave Request",
                f"{user.get('name', 'Employee')} has applied for leave from {leave_data.from_date} to {leave_data.to_date}",
                "info", "leave", f"/leave/requests/{leave_request.leave_id}"
            )
    
    return leave_request

@api_router.get("/leave/my-requests")
async def get_my_leave_requests(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    query = {"employee_id": employee_id}
    if status:
        query["status"] = status
    
    requests = await db.leave_requests.find(query, {"_id": 0}).sort("applied_on", -1).to_list(100)
    return requests

@api_router.get("/leave/pending-approvals")
async def get_pending_leave_approvals(request: Request):
    user = await get_current_user(request)
    
    # Check if user is a manager
    employee_id = user.get("employee_id")
    
    # Get employees reporting to this manager
    reportees = await db.employees.find({"reporting_manager_id": employee_id}, {"employee_id": 1, "_id": 0}).to_list(100)
    reportee_ids = [r["employee_id"] for r in reportees]
    
    if not reportee_ids and user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        return []
    
    query = {"status": "pending"}
    if reportee_ids and user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["employee_id"] = {"$in": reportee_ids}
    
    requests = await db.leave_requests.find(query, {"_id": 0}).sort("applied_on", -1).to_list(100)
    return requests

@api_router.put("/leave/{leave_id}/approve")
async def approve_leave(leave_id: str, request: Request):
    user = await get_current_user(request)
    
    leave_req = await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.get("employee_id") or user["user_id"],
            "approved_on": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update leave balance
    current_year = datetime.now(timezone.utc).year
    await db.leave_balances.update_one(
        {"employee_id": leave_req["employee_id"], "leave_type_id": leave_req["leave_type_id"], "year": current_year},
        {"$inc": {"used": leave_req["days"], "pending": -leave_req["days"]}}
    )
    
    # Notify employee
    employee = await db.employees.find_one({"employee_id": leave_req["employee_id"]}, {"_id": 0})
    if employee and employee.get("user_id"):
        await create_notification(
            employee["user_id"],
            "Leave Approved",
            f"Your leave from {leave_req['from_date']} to {leave_req['to_date']} has been approved",
            "success", "leave"
        )
    
    await log_audit("APPROVE", "leave", "leave_request", leave_id,
                   user["user_id"], user.get("name", ""), request=request)
    
    return {"message": "Leave approved successfully"}

@api_router.put("/leave/{leave_id}/reject")
async def reject_leave(leave_id: str, rejection_reason: str, request: Request):
    user = await get_current_user(request)
    
    leave_req = await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "rejected",
            "approved_by": user.get("employee_id") or user["user_id"],
            "approved_on": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": rejection_reason
        }}
    )
    
    # Update leave balance
    current_year = datetime.now(timezone.utc).year
    await db.leave_balances.update_one(
        {"employee_id": leave_req["employee_id"], "leave_type_id": leave_req["leave_type_id"], "year": current_year},
        {"$inc": {"pending": -leave_req["days"]}}
    )
    
    # Notify employee
    employee = await db.employees.find_one({"employee_id": leave_req["employee_id"]}, {"_id": 0})
    if employee and employee.get("user_id"):
        await create_notification(
            employee["user_id"],
            "Leave Rejected",
            f"Your leave from {leave_req['from_date']} to {leave_req['to_date']} has been rejected",
            "error", "leave"
        )
    
    await log_audit("REJECT", "leave", "leave_request", leave_id,
                   user["user_id"], user.get("name", ""), request=request)
    
    return {"message": "Leave rejected"}

# ==================== ANNOUNCEMENTS ROUTES ====================

@api_router.get("/announcements")
async def list_announcements(request: Request, category: Optional[str] = None):
    user = await get_current_user(request)
    
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort("published_at", -1).to_list(50)
    return announcements

@api_router.post("/announcements", response_model=Announcement)
async def create_announcement(ann_data: dict, request: Request):
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    ann_data["published_by"] = user["user_id"]
    announcement = Announcement(**ann_data)
    doc = announcement.model_dump()
    doc['published_at'] = doc['published_at'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('expires_at'):
        doc['expires_at'] = doc['expires_at'].isoformat()
    
    await db.announcements.insert_one(doc)
    
    return announcement

@api_router.put("/announcements/{ann_id}/acknowledge")
async def acknowledge_announcement(ann_id: str, request: Request):
    user = await get_current_user(request)
    
    await db.announcements.update_one(
        {"announcement_id": ann_id},
        {"$addToSet": {"acknowledged_by": user["user_id"], "read_by": user["user_id"]}}
    )
    
    return {"message": "Acknowledged"}

# ==================== NOTIFICATIONS ROUTES ====================

@api_router.get("/notifications")
async def list_notifications(request: Request, unread_only: bool = False):
    user = await get_current_user(request)
    
    query = {"user_id": user["user_id"]}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifications

@api_router.get("/notifications/count")
async def get_notification_count(request: Request):
    user = await get_current_user(request)
    
    count = await db.notifications.count_documents({"user_id": user["user_id"], "is_read": False})
    return {"unread_count": count}

@api_router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    
    await db.notifications.update_one(
        {"notification_id": notif_id, "user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    user = await get_current_user(request)
    
    await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "All notifications marked as read"}

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get counts based on role
    total_employees = await db.employees.count_documents({"is_active": True})
    present_today = await db.attendance.count_documents({"date": today, "status": "present"})
    on_leave_today = await db.leave_requests.count_documents({
        "status": "approved",
        "from_date": {"$lte": today},
        "to_date": {"$gte": today}
    })
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    
    # Get department distribution
    dept_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$department_id", "count": {"$sum": 1}}}
    ]
    dept_dist = await db.employees.aggregate(dept_pipeline).to_list(20)
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "on_leave_today": on_leave_today,
        "pending_leaves": pending_leaves,
        "department_distribution": dept_dist,
        "attendance_percentage": round((present_today / total_employees * 100) if total_employees > 0 else 0, 1)
    }

@api_router.get("/dashboard/employee")
async def get_employee_dashboard(request: Request):
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return {
            "profile_complete": False,
            "attendance_today": None,
            "leave_balance": [],
            "pending_requests": 0,
            "recent_announcements": []
        }
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_year = datetime.now(timezone.utc).year
    
    # Get today's attendance
    attendance = await db.attendance.find_one({"employee_id": employee_id, "date": today}, {"_id": 0})
    
    # Get leave balances
    balances = await db.leave_balances.find(
        {"employee_id": employee_id, "year": current_year}, {"_id": 0}
    ).to_list(10)
    
    # Get pending requests
    pending = await db.leave_requests.count_documents({"employee_id": employee_id, "status": "pending"})
    
    # Get recent announcements
    announcements = await db.announcements.find(
        {"is_active": True}, {"_id": 0}
    ).sort("published_at", -1).limit(5).to_list(5)
    
    return {
        "profile_complete": True,
        "attendance_today": attendance,
        "leave_balance": balances,
        "pending_requests": pending,
        "recent_announcements": announcements
    }

# ==================== ROLES & PERMISSIONS ====================

@api_router.get("/roles")
async def list_roles(request: Request):
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    roles = await db.roles.find({}, {"_id": 0}).to_list(50)
    return roles

@api_router.post("/roles", response_model=Role)
async def create_role(role_data: dict, request: Request):
    user = await get_current_user(request)
    
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create roles")
    
    role = Role(**role_data)
    doc = role.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.roles.insert_one(doc)
    
    await log_audit("CREATE", "rbac", "role", role.role_id,
                   user["user_id"], user.get("name", ""), new_value=role_data, request=request)
    
    return role

# ==================== AUDIT LOGS ====================

@api_router.get("/audit-logs")
async def list_audit_logs(
    request: Request,
    module: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "auditor"]:
        raise HTTPException(status_code=403, detail="Not authorized to view audit logs")
    
    query = {}
    if module:
        query["module"] = module
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# ==================== SEED DATA ====================

@api_router.post("/seed/initial")
async def seed_initial_data(request: Request):
    """Seed initial data for the HRMS"""
    
    # Create default roles
    default_roles = [
        {"name": "Super Admin", "code": "super_admin", "description": "Full system access", "is_system": True,
         "permissions": ["all"]},
        {"name": "HR Admin", "code": "hr_admin", "description": "Full HR access + rules configuration", "is_system": True,
         "permissions": ["hr.*", "leave.*", "attendance.*", "payroll.*", "employee.*"]},
        {"name": "HR Executive", "code": "hr_executive", "description": "Limited HR access", "is_system": True,
         "permissions": ["hr.read", "leave.manage", "attendance.manage", "employee.read"]},
        {"name": "Finance", "code": "finance", "description": "Payroll and reports access", "is_system": True,
         "permissions": ["payroll.*", "reports.*"]},
        {"name": "Department Manager", "code": "manager", "description": "Department-level access", "is_system": True,
         "permissions": ["team.manage", "leave.approve", "attendance.view", "performance.manage"]},
        {"name": "Team Lead", "code": "team_lead", "description": "Team-level access", "is_system": True,
         "permissions": ["team.view", "leave.recommend", "attendance.view"]},
        {"name": "Employee", "code": "employee", "description": "Self-service access", "is_system": True,
         "permissions": ["self.*"]},
        {"name": "Auditor", "code": "auditor", "description": "Read-only audit access", "is_system": True,
         "permissions": ["audit.read"]}
    ]
    
    for role_data in default_roles:
        existing = await db.roles.find_one({"code": role_data["code"]})
        if not existing:
            role = Role(**role_data)
            doc = role.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.roles.insert_one(doc)
    
    # Create default leave types
    default_leave_types = [
        {"name": "Casual Leave", "code": "CL", "annual_quota": 12, "carry_forward_allowed": False,
         "half_day_allowed": True},
        {"name": "Sick Leave", "code": "SL", "annual_quota": 12, "carry_forward_allowed": False,
         "half_day_allowed": True},
        {"name": "Privilege Leave", "code": "PL", "annual_quota": 15, "carry_forward_allowed": True,
         "max_carry_forward": 30, "encashment_allowed": True},
        {"name": "Maternity Leave", "code": "ML", "annual_quota": 182, "carry_forward_allowed": False,
         "applicable_to": ["management"]},
        {"name": "Paternity Leave", "code": "PTL", "annual_quota": 15, "carry_forward_allowed": False,
         "applicable_to": ["management"]},
        {"name": "Compensatory Off", "code": "CO", "annual_quota": 0, "carry_forward_allowed": False,
         "description": "Earned for working on holidays/weekends"},
        {"name": "Leave Without Pay", "code": "LWP", "annual_quota": 0, "negative_balance_allowed": True}
    ]
    
    for lt_data in default_leave_types:
        existing = await db.leave_types.find_one({"code": lt_data["code"]})
        if not existing:
            leave_type = LeaveType(**lt_data)
            doc = leave_type.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.leave_types.insert_one(doc)
    
    # Create sample departments
    default_depts = [
        {"name": "Human Resources", "code": "HR"},
        {"name": "Engineering", "code": "ENG"},
        {"name": "Finance", "code": "FIN"},
        {"name": "Sales", "code": "SALES"},
        {"name": "Operations", "code": "OPS"},
        {"name": "Marketing", "code": "MKT"}
    ]
    
    for dept_data in default_depts:
        existing = await db.departments.find_one({"code": dept_data["code"]})
        if not existing:
            dept = Department(**dept_data)
            doc = dept.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.departments.insert_one(doc)
    
    # Create sample designations
    default_desigs = [
        {"name": "Chief Executive Officer", "code": "CEO", "grade": "E1", "band": "Executive"},
        {"name": "Chief Technology Officer", "code": "CTO", "grade": "E1", "band": "Executive"},
        {"name": "Vice President", "code": "VP", "grade": "E2", "band": "Senior Leadership"},
        {"name": "Senior Manager", "code": "SM", "grade": "M1", "band": "Management"},
        {"name": "Manager", "code": "MGR", "grade": "M2", "band": "Management"},
        {"name": "Team Lead", "code": "TL", "grade": "M3", "band": "Management"},
        {"name": "Senior Engineer", "code": "SE", "grade": "IC3", "band": "Individual Contributor"},
        {"name": "Engineer", "code": "ENG", "grade": "IC2", "band": "Individual Contributor"},
        {"name": "Junior Engineer", "code": "JE", "grade": "IC1", "band": "Individual Contributor"},
        {"name": "Executive", "code": "EXEC", "grade": "S1", "band": "Staff"},
        {"name": "Assistant", "code": "ASST", "grade": "S2", "band": "Staff"}
    ]
    
    for desig_data in default_desigs:
        existing = await db.designations.find_one({"code": desig_data["code"]})
        if not existing:
            desig = Designation(**desig_data)
            doc = desig.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.designations.insert_one(doc)
    
    # Create sample locations
    default_locs = [
        {"name": "Head Office - Mumbai", "code": "HO-MUM", "city": "Mumbai", "state": "Maharashtra"},
        {"name": "Branch Office - Bangalore", "code": "BO-BLR", "city": "Bangalore", "state": "Karnataka"},
        {"name": "Branch Office - Delhi", "code": "BO-DEL", "city": "New Delhi", "state": "Delhi"}
    ]
    
    for loc_data in default_locs:
        existing = await db.locations.find_one({"code": loc_data["code"]})
        if not existing:
            loc = Location(**loc_data)
            doc = loc.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.locations.insert_one(doc)
    
    # Create a super admin user with employee profile if not exists
    admin_exists = await db.users.find_one({"email": "admin@shardahr.com"})
    if not admin_exists:
        admin_user_id = f"user_{uuid.uuid4().hex[:12]}"
        admin_emp_id = "EMP000001"
        
        # Get HR department ID
        hr_dept = await db.departments.find_one({"code": "HR"}, {"_id": 0})
        hr_dept_id = hr_dept["department_id"] if hr_dept else None
        
        # Get CEO designation ID
        ceo_desig = await db.designations.find_one({"code": "CEO"}, {"_id": 0})
        ceo_desig_id = ceo_desig["designation_id"] if ceo_desig else None
        
        # Create employee profile for admin
        admin_employee = {
            "employee_id": admin_emp_id,
            "user_id": admin_user_id,
            "emp_code": "ADMIN001",
            "first_name": "System",
            "last_name": "Admin",
            "email": "admin@shardahr.com",
            "phone": "+91 9876543210",
            "department_id": hr_dept_id,
            "designation_id": ceo_desig_id,
            "employment_type": "management",
            "joining_date": "2020-01-01",
            "status": "active",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.employees.insert_one(admin_employee)
        
        admin_user = {
            "user_id": admin_user_id,
            "email": "admin@shardahr.com",
            "password": hash_password("Admin@123"),
            "name": "System Admin",
            "picture": None,
            "role": "super_admin",
            "roles": ["super_admin"],
            "permissions": ["all"],
            "employee_id": admin_emp_id,
            "department_id": hr_dept_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        
        # Create leave balances for admin
        current_year = datetime.now(timezone.utc).year
        leave_types_list = await db.leave_types.find({}, {"_id": 0}).to_list(10)
        for lt in leave_types_list:
            if lt.get("annual_quota", 0) > 0:
                balance = {
                    "balance_id": f"lb_{uuid.uuid4().hex[:12]}",
                    "employee_id": admin_emp_id,
                    "leave_type_id": lt["leave_type_id"],
                    "year": current_year,
                    "opening_balance": lt["annual_quota"],
                    "accrued": 0,
                    "used": 0,
                    "pending": 0,
                    "available": lt["annual_quota"],
                    "carry_forward": 0
                }
                await db.leave_balances.insert_one(balance)
    
    return {"message": "Initial data seeded successfully"}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Sharda HR API", "version": "1.0.0", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# ==================== SHORTCUT ENDPOINTS FOR FRONTEND ====================

@api_router.get("/my-assets")
async def get_my_assets_shortcut(request: Request):
    """Shortcut for getting current user's assets"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    if not employee_id:
        return []
    assets = await db.assets.find({"assigned_to": employee_id, "status": "assigned"}, {"_id": 0}).to_list(50)
    return assets


@api_router.get("/asset-requests")
async def list_asset_requests_shortcut(request: Request):
    """Shortcut for asset requests"""
    user = await get_current_user(request)
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        query["employee_id"] = user.get("employee_id")
    requests = await db.asset_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@api_router.post("/asset-requests")
async def create_asset_request_shortcut(data: dict, request: Request):
    """Shortcut for creating asset request"""
    import uuid
    user = await get_current_user(request)
    req = {
        "request_id": f"areq_{uuid.uuid4().hex[:12]}",
        "employee_id": user.get("employee_id"),
        "category": data.get("category"),
        "description": data.get("description"),
        "justification": data.get("justification"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.asset_requests.insert_one(req)
    req.pop('_id', None)
    return req


@api_router.get("/expense-categories")
async def list_expense_categories_shortcut(request: Request):
    """Shortcut for expense categories"""
    await get_current_user(request)
    existing = await db.expense_categories.find_one()
    if not existing:
        categories = [
            {"code": "travel", "name": "Travel", "limit": 50000, "requires_receipt": True},
            {"code": "food", "name": "Food & Meals", "limit": 10000, "requires_receipt": True},
            {"code": "accommodation", "name": "Accommodation", "limit": 25000, "requires_receipt": True},
            {"code": "client_entertainment", "name": "Client Entertainment", "limit": 20000, "requires_receipt": True},
            {"code": "fuel", "name": "Fuel", "limit": 15000, "requires_receipt": True},
            {"code": "office_supplies", "name": "Office Supplies", "limit": 5000, "requires_receipt": False},
            {"code": "other", "name": "Other", "limit": 10000, "requires_receipt": True}
        ]
        await db.expense_categories.insert_many(categories)
    categories = await db.expense_categories.find({}, {"_id": 0}).to_list(50)
    return categories


# Import and include additional routers BEFORE mounting api_router to app
from routes.payroll import router as payroll_router
from routes.performance import router as performance_router
from routes.bulk_import import router as import_router
from routes.documents import router as documents_router
from routes.assets import router as assets_router
from routes.expenses import router as expenses_router
from routes.grievance import router as grievance_router
from routes.recruitment import router as recruitment_router
from routes.onboarding import router as onboarding_router
from routes.reports import router as reports_router
from routes.labour import router as labour_router
from routes.user_management import router as user_management_router
from routes.training import router as training_router
from routes.travel import router as travel_router

api_router.include_router(payroll_router)
api_router.include_router(performance_router)
api_router.include_router(import_router)
api_router.include_router(documents_router)
api_router.include_router(assets_router)
api_router.include_router(expenses_router)
api_router.include_router(grievance_router)
api_router.include_router(recruitment_router)
api_router.include_router(onboarding_router)
api_router.include_router(reports_router)
api_router.include_router(labour_router)
api_router.include_router(user_management_router)
api_router.include_router(training_router)
api_router.include_router(travel_router)

# Include the router in the main app (after all sub-routers are added)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
