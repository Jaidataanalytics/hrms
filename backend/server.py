from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import RedirectResponse
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
    must_change_password: bool = False

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
    email: str  # Using str instead of EmailStr to handle legacy data with invalid emails
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
        # Verify session token from Google OAuth or JWT session
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
            else:
                # Session expired, clean it up
                await db.user_sessions.delete_one({"session_token": session_token})
    
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
        try:
            payload = decode_jwt_token(token)
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                return user
        except:
            pass
    
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
    
    # Use 'lax' for same-site requests, 'none' only needed for cross-site
    samesite_setting = "lax"
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_secure,
        samesite=samesite_setting,
        path="/",
        max_age=7*24*60*60  # 7 days
    )
    
    # Also set the JWT token as a cookie for redundancy
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_secure,
        samesite=samesite_setting,
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
    
    # Check if user must change password (first login)
    must_change_password = user.get("must_change_password", False)
    
    return TokenResponse(
        access_token=token,
        user=user_response,
        must_change_password=must_change_password
    )

@api_router.get("/auth/google")
async def initiate_google_auth(request: Request):
    """Redirect to Emergent's Google OAuth flow"""
    # Get the frontend origin from the request to build redirect URL
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        # Extract base URL from origin/referer
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        redirect_base = f"{parsed.scheme}://{parsed.netloc}"
    else:
        # Fallback to environment or default
        redirect_base = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    redirect_uri = f"{redirect_base}/auth/callback"
    
    # Redirect to Emergent Google OAuth
    auth_url = f"https://demobackend.emergentagent.com/auth/v1/env/oauth/google?redirect_uri={redirect_uri}"
    return RedirectResponse(url=auth_url, status_code=302)

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
        
        # Set cookie - use samesite=lax for better compatibility
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
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
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Logged out successfully"}


@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """Refresh the authentication token to extend session"""
    try:
        user = await get_current_user(request)
        
        # Create new JWT token
        token = create_jwt_token(user["user_id"], user["email"], user.get("role", "employee"))
        
        # Update session expiry
        session_token = request.cookies.get("session_token")
        if session_token:
            await db.user_sessions.update_one(
                {"session_token": session_token},
                {"$set": {"expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()}}
            )
        
        # Detect if running over HTTPS
        is_secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
        
        # Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=is_secure,
            samesite="lax",
            path="/",
            max_age=7*24*60*60
        )
        
        # Also refresh the session token cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=is_secure,
            samesite="lax",
            path="/",
            max_age=7*24*60*60
        )
        
        return {"access_token": token, "message": "Token refreshed"}
    except:
        raise HTTPException(status_code=401, detail="Unable to refresh token")


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str
    

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, request: Request):
    """Change user password. Current password required unless must_change_password is True."""
    user = await get_current_user(request)
    
    db_user = await db.users.find_one({"user_id": user["user_id"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If not first login, require current password
    must_change = db_user.get("must_change_password", False)
    if not must_change:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        
        stored_password = db_user.get("password") or db_user.get("password_hash", "")
        if not verify_password(data.current_password, stored_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Hash and update password
    new_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "password": new_hash,
            "password_hash": new_hash,
            "must_change_password": False,
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}


# ==================== EMPLOYEE ROUTES ====================

@api_router.get("/employees", response_model=List[Employee])
async def list_employees(
    request: Request,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    employment_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False
):
    user = await get_current_user(request)
    
    query = {}
    
    # Filter by status - if 'active' show only active, if 'inactive' show only inactive, if 'all' show all
    if status and status != 'all':
        query["status"] = status
    
    # By default, only show active employees unless include_inactive is True or status filter is set
    if not include_inactive and not status:
        query["is_active"] = True
    
    if department_id and department_id != 'all':
        query["department_id"] = department_id
    if employment_type and employment_type != 'all':
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

@api_router.get("/employees/search")
async def search_employees(
    request: Request,
    q: str,
    limit: int = 10
):
    """Search employees by name, email, emp_code, or department"""
    user = await get_current_user(request)
    
    # Only HR/Admin can search all employees
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build search query
    search_regex = {"$regex": q, "$options": "i"}
    query = {
        "$or": [
            {"first_name": search_regex},
            {"last_name": search_regex},
            {"email": search_regex},
            {"emp_code": search_regex},
            {"department_name": search_regex},
            {"designation": search_regex}
        ]
    }
    
    employees = await db.employees.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return employees


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


@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request, permanent: bool = False):
    """Delete or deactivate an employee"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete employees")
    
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if permanent:
        # Permanent deletion
        await db.employees.delete_one({"employee_id": employee_id})
        # Also delete associated user account
        await db.users.delete_one({"employee_id": employee_id})
        
        await log_audit("DELETE", "employee", "employee", employee_id,
                       user["user_id"], user.get("name", ""), old_value=employee, request=request)
        
        return {"message": "Employee permanently deleted", "employee_id": employee_id}
    else:
        # Soft delete - deactivate
        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$set": {
                "is_active": False,
                "status": "inactive",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        # Also deactivate user account
        await db.users.update_one(
            {"employee_id": employee_id},
            {"$set": {"is_active": False}}
        )
        
        await log_audit("DEACTIVATE", "employee", "employee", employee_id,
                       user["user_id"], user.get("name", ""), request=request)
        
        return {"message": "Employee deactivated", "employee_id": employee_id}


@api_router.post("/employees/{employee_id}/activate")
async def activate_employee(employee_id: str, request: Request):
    """Reactivate a deactivated employee"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.employees.find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {
            "is_active": True,
            "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    # Also activate user account
    await db.users.update_one(
        {"employee_id": employee_id},
        {"$set": {"is_active": True}}
    )
    
    return {"message": "Employee activated", "employee_id": employee_id}

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


@api_router.put("/departments/{department_id}")
async def update_department(department_id: str, dept_data: dict, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.departments.find_one({"department_id": department_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Department not found")
    
    update_data = {
        "name": dept_data.get("name", existing.get("name")),
        "code": dept_data.get("code", existing.get("code")),
        "description": dept_data.get("description", existing.get("description")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.departments.update_one(
        {"department_id": department_id},
        {"$set": update_data}
    )
    
    await log_audit("UPDATE", "master", "department", department_id,
                   user["user_id"], user.get("name", ""), new_value=update_data, request=request)
    
    updated = await db.departments.find_one({"department_id": department_id}, {"_id": 0})
    return updated


@api_router.put("/designations/{designation_id}")
async def update_designation(designation_id: str, desig_data: dict, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.designations.find_one({"designation_id": designation_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Designation not found")
    
    update_data = {
        "name": desig_data.get("name", existing.get("name")),
        "code": desig_data.get("code", existing.get("code")),
        "description": desig_data.get("description", existing.get("description")),
        "grade": desig_data.get("grade", existing.get("grade")),
        "band": desig_data.get("band", existing.get("band")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.designations.update_one(
        {"designation_id": designation_id},
        {"$set": update_data}
    )
    
    await log_audit("UPDATE", "master", "designation", designation_id,
                   user["user_id"], user.get("name", ""), new_value=update_data, request=request)
    
    updated = await db.designations.find_one({"designation_id": designation_id}, {"_id": 0})
    return updated


@api_router.put("/locations/{location_id}")
async def update_location(location_id: str, loc_data: dict, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.locations.find_one({"location_id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")
    
    update_data = {
        "name": loc_data.get("name", existing.get("name")),
        "code": loc_data.get("code", existing.get("code")),
        "description": loc_data.get("description", existing.get("description")),
        "address": loc_data.get("address", existing.get("address")),
        "city": loc_data.get("city", existing.get("city")),
        "state": loc_data.get("state", existing.get("state")),
        "pincode": loc_data.get("pincode", existing.get("pincode")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.locations.update_one(
        {"location_id": location_id},
        {"$set": update_data}
    )
    
    await log_audit("UPDATE", "master", "location", location_id,
                   user["user_id"], user.get("name", ""), new_value=update_data, request=request)
    
    updated = await db.locations.find_one({"location_id": location_id}, {"_id": 0})
    return updated

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


@api_router.get("/attendance")
async def get_attendance(
    request: Request, 
    employee_id: Optional[str] = None, 
    month: Optional[int] = None, 
    year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get attendance records - HR can view any employee, others view their own"""
    user = await get_current_user(request)
    
    if employee_id and employee_id != "all":
        # HR/Admin can view any employee's attendance
        if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Look up employee to get both employee_id and emp_code for broader matching
        employee = await db.employees.find_one(
            {"$or": [{"employee_id": employee_id}, {"emp_code": employee_id}]},
            {"_id": 0, "employee_id": 1, "emp_code": 1}
        )
        
        if employee:
            # Query by both employee_id and emp_code to cover data inconsistencies
            query = {"$or": [
                {"employee_id": employee.get("employee_id")},
                {"employee_id": employee.get("emp_code")},
                {"emp_code": employee.get("emp_code")}
            ]}
        else:
            # Fallback to direct employee_id match
            query = {"employee_id": employee_id}
    elif user.get("role") in ["super_admin", "hr_admin", "hr_executive"]:
        # HR viewing all employees
        query = {}
    else:
        # View own attendance
        target_employee_id = user.get("employee_id")
        if not target_employee_id:
            return []
        query = {"employee_id": target_employee_id}
    
    # Date range filter (preferred over month/year)
    if from_date and to_date:
        if "$or" in query:
            query = {"$and": [query, {"date": {"$gte": from_date, "$lte": to_date}}]}
        else:
            query["date"] = {"$gte": from_date, "$lte": to_date}
    elif month and year:
        # Filter by month/year
        month_str = str(month).zfill(2)
        date_filter = {"date": {"$regex": f"^{year}-{month_str}"}}
        if "$or" in query:
            query = {"$and": [query, date_filter]}
        else:
            query["date"] = {"$regex": f"^{year}-{month_str}"}
    elif year:
        date_filter = {"date": {"$regex": f"^{year}"}}
        if "$or" in query:
            query = {"$and": [query, date_filter]}
        else:
            query["date"] = {"$regex": f"^{year}"}
    
    attendance = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    
    # Enrich with employee info
    if attendance:
        emp_ids = list(set(a.get("employee_id") for a in attendance if a.get("employee_id")))
        employees = await db.employees.find(
            {"$or": [{"employee_id": {"$in": emp_ids}}, {"emp_code": {"$in": emp_ids}}]}, 
            {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "emp_code": 1}
        ).to_list(1000)
        emp_map = {e["employee_id"]: e for e in employees}
        emp_map.update({e["emp_code"]: e for e in employees if e.get("emp_code")})
        
        for att in attendance:
            emp = emp_map.get(att.get("employee_id"), {})
            att["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() or att.get("employee_id")
            att["emp_code"] = emp.get("emp_code", att.get("employee_id"))
    
    return attendance


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


@api_router.get("/attendance/organization")
async def get_organization_attendance(
    request: Request, 
    month: Optional[int] = None, 
    year: Optional[int] = None,
    date: Optional[str] = None
):
    """Get organization-wide attendance data with summary"""
    user = await get_current_user(request)
    
    # All authenticated users can view org attendance
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    target_date = date or now.strftime("%Y-%m-%d")
    
    # Get all active employees
    employees = await db.employees.find(
        {"is_active": True}, 
        {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1, "department": 1}
    ).to_list(1000)
    
    total_employees = len(employees)
    employee_map = {e["employee_id"]: e for e in employees}
    
    # Get today's attendance
    today_attendance = await db.attendance.find(
        {"date": target_date}, 
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate today's summary
    today_present = sum(1 for a in today_attendance if a.get("status") == "present")
    today_wfh = sum(1 for a in today_attendance if a.get("status") == "wfh")
    today_absent = sum(1 for a in today_attendance if a.get("status") == "absent")
    today_leave = sum(1 for a in today_attendance if a.get("status") == "leave")
    today_late = sum(1 for a in today_attendance if a.get("is_late"))
    today_holiday = sum(1 for a in today_attendance if a.get("status") in ["holiday", "weekly_off"])
    
    # Unmarked employees (no attendance record today)
    marked_emp_ids = {a["employee_id"] for a in today_attendance}
    unmarked = total_employees - len(marked_emp_ids)
    
    # Get month's attendance for the table
    month_start = f"{target_year}-{str(target_month).zfill(2)}-01"
    month_end = f"{target_year}-{str(target_month).zfill(2)}-31"
    
    month_attendance = await db.attendance.find(
        {"date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    ).to_list(10000)
    
    # Enrich attendance with employee details
    enriched_attendance = []
    for att in today_attendance:
        emp = employee_map.get(att["employee_id"], {})
        enriched_attendance.append({
            **att,
            "emp_code": emp.get("emp_code", ""),
            "employee_name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "department": emp.get("department", "")
        })
    
    return {
        "date": target_date,
        "month": target_month,
        "year": target_year,
        "summary": {
            "total_employees": total_employees,
            "present": today_present,
            "wfh": today_wfh,
            "absent": today_absent,
            "leave": today_leave,
            "late": today_late,
            "holiday": today_holiday,
            "unmarked": unmarked
        },
        "today_attendance": enriched_attendance,
        "employee_list": employees
    }


@api_router.get("/attendance/summary")
async def get_attendance_summary(
    request: Request,
    from_date: str,
    to_date: str,
    employee_id: Optional[str] = None,
    absence_threshold: Optional[int] = 4,
    absence_threshold_pct: Optional[int] = 10,
    chronic_absence_threshold: Optional[int] = 5
):
    """
    Get comprehensive attendance analytics for a date range.
    HR/Admin only for organization view.
    """
    user = await get_current_user(request)
    
    # Only HR can view organization-wide summary
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from datetime import datetime, timedelta
    from collections import defaultdict
    
    # Parse dates
    start_date = datetime.strptime(from_date, "%Y-%m-%d")
    end_date = datetime.strptime(to_date, "%Y-%m-%d")
    
    # Get holidays in range
    holidays = await db.holidays.find({
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0, "date": 1, "name": 1}).to_list(100)
    holiday_dates = {h["date"]: h.get("name", "Holiday") for h in holidays}
    
    # Calculate working days with day-of-week info
    working_days = []
    working_days_by_weekday = defaultdict(list)  # 0=Mon, 4=Fri
    pre_holiday_days = []
    
    current = start_date
    while current <= end_date:
        date_str = current.strftime("%Y-%m-%d")
        weekday = current.weekday()
        
        # Check if next day is holiday
        next_day = (current + timedelta(days=1)).strftime("%Y-%m-%d")
        is_pre_holiday = next_day in holiday_dates
        
        if weekday != 6 and date_str not in holiday_dates:  # Not Sunday, not holiday
            working_days.append(date_str)
            working_days_by_weekday[weekday].append(date_str)
            if is_pre_holiday:
                pre_holiday_days.append(date_str)
        
        current += timedelta(days=1)
    
    total_working_days = len(working_days)
    monday_count = len(working_days_by_weekday[0])
    friday_count = len(working_days_by_weekday[4])
    
    # Get all active employees
    emp_query = {"is_active": True}
    if employee_id and employee_id != "all":
        emp_query["employee_id"] = employee_id
    
    employees = await db.employees.find(
        emp_query,
        {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1, "department": 1}
    ).to_list(1000)
    
    total_employees = len(employees)
    
    # Build query for attendance records
    att_query = {"date": {"$gte": from_date, "$lte": to_date}}
    if employee_id and employee_id != "all":
        att_query["employee_id"] = employee_id
    
    # Get all attendance in range
    attendance = await db.attendance.find(att_query, {"_id": 0}).to_list(50000)
    
    # Create attendance lookup: {date: {employee_id: record}}
    attendance_by_date = defaultdict(dict)
    for att in attendance:
        attendance_by_date[att.get("date")][att.get("employee_id")] = att
    
    # Daily analysis
    daily_stats = []
    perfect_days = []
    high_absence_days = []
    most_absent_day = {"date": None, "absent_count": 0}
    
    # Day-of-week absence tracking
    monday_absences = 0
    friday_absences = 0
    other_day_absences = 0
    pre_holiday_absences = 0
    
    for day in working_days:
        day_attendance = attendance_by_date.get(day, {})
        present_count = 0
        absent_count = 0
        late_count = 0
        wfh_count = 0
        
        for emp in employees:
            emp_id = emp.get("employee_id")
            att = day_attendance.get(emp_id)
            
            if att:
                status = att.get("status", "present")
                if status == "present":
                    present_count += 1
                elif status == "wfh":
                    wfh_count += 1
                elif status == "leave":
                    pass  # Don't count as present or absent
                else:
                    present_count += 1
                
                if att.get("is_late"):
                    late_count += 1
            else:
                absent_count += 1
        
        # Track day-of-week patterns
        day_date = datetime.strptime(day, "%Y-%m-%d")
        weekday = day_date.weekday()
        
        if weekday == 0:  # Monday
            monday_absences += absent_count
        elif weekday == 4:  # Friday
            friday_absences += absent_count
        else:
            other_day_absences += absent_count
        
        if day in pre_holiday_days:
            pre_holiday_absences += absent_count
        
        # Check for perfect day
        if absent_count == 0:
            perfect_days.append(day)
        
        # Check for high absence day
        absence_pct = (absent_count / total_employees * 100) if total_employees > 0 else 0
        if absent_count >= absence_threshold or absence_pct >= absence_threshold_pct:
            high_absence_days.append({
                "date": day,
                "absent_count": absent_count,
                "absent_pct": round(absence_pct, 1)
            })
        
        # Track most absent day
        if absent_count > most_absent_day["absent_count"]:
            most_absent_day = {"date": day, "absent_count": absent_count, "absent_pct": round(absence_pct, 1)}
        
        daily_stats.append({
            "date": day,
            "present": present_count,
            "absent": absent_count,
            "wfh": wfh_count,
            "late": late_count
        })
    
    # Per-employee stats
    employee_stats = []
    dept_stats = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0, "employees": 0})
    
    for emp in employees:
        emp_id = emp.get("employee_id")
        dept = emp.get("department", "Unknown")
        dept_stats[dept]["employees"] += 1
        
        stats = {
            "employee_id": emp_id,
            "emp_code": emp.get("emp_code", ""),
            "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "department": dept,
            "present_days": 0,
            "absent_days": 0,
            "late_count": 0,
            "wfh_count": 0,
            "leave_count": 0,
            "total_hours": 0
        }
        
        for day in working_days:
            att = attendance_by_date.get(day, {}).get(emp_id)
            if att:
                status = att.get("status", "present")
                if status == "present":
                    stats["present_days"] += 1
                    dept_stats[dept]["present"] += 1
                elif status == "wfh":
                    stats["wfh_count"] += 1
                elif status == "leave":
                    stats["leave_count"] += 1
                else:
                    stats["present_days"] += 1
                    dept_stats[dept]["present"] += 1
                
                if att.get("is_late"):
                    stats["late_count"] += 1
                    dept_stats[dept]["late"] += 1
                
                if att.get("total_hours"):
                    stats["total_hours"] += att.get("total_hours", 0)
            else:
                stats["absent_days"] += 1
                dept_stats[dept]["absent"] += 1
        
        employee_stats.append(stats)
    
    # Calculate rankings
    most_late = sorted(employee_stats, key=lambda x: x["late_count"], reverse=True)[:10]
    most_absent = sorted(employee_stats, key=lambda x: x["absent_days"], reverse=True)[:10]
    chronic_absentees = [s for s in employee_stats if s["absent_days"] >= chronic_absence_threshold]
    punctuality_champions = [s for s in employee_stats if s["late_count"] == 0 and s["absent_days"] == 0]
    most_hours = sorted(employee_stats, key=lambda x: x["total_hours"], reverse=True)[:10]
    
    # Calculate totals
    total_present = sum(s["present_days"] for s in employee_stats)
    total_absent = sum(s["absent_days"] for s in employee_stats)
    total_late = sum(s["late_count"] for s in employee_stats)
    total_wfh = sum(s["wfh_count"] for s in employee_stats)
    total_leave = sum(s["leave_count"] for s in employee_stats)
    total_hours = sum(s["total_hours"] for s in employee_stats)
    
    # Attendance rate (excluding WFH)
    possible_attendance = total_employees * total_working_days
    attendance_rate = round((total_present / possible_attendance * 100), 1) if possible_attendance > 0 else 0
    
    # Average daily attendance
    avg_daily_attendance = round(total_present / total_working_days, 1) if total_working_days > 0 else 0
    avg_daily_hours = round(total_hours / total_present, 2) if total_present > 0 else 0
    
    # Day-of-week analysis
    other_days_count = total_working_days - monday_count - friday_count
    monday_absence_rate = round((monday_absences / (monday_count * total_employees) * 100), 1) if monday_count > 0 else 0
    friday_absence_rate = round((friday_absences / (friday_count * total_employees) * 100), 1) if friday_count > 0 else 0
    other_absence_rate = round((other_day_absences / (other_days_count * total_employees) * 100), 1) if other_days_count > 0 else 0
    pre_holiday_absence_rate = round((pre_holiday_absences / (len(pre_holiday_days) * total_employees) * 100), 1) if pre_holiday_days else 0
    
    # Department ranking
    dept_ranking = []
    for dept, stats in dept_stats.items():
        possible = stats["employees"] * total_working_days
        rate = round((stats["present"] / possible * 100), 1) if possible > 0 else 0
        dept_ranking.append({
            "department": dept,
            "employees": stats["employees"],
            "present_days": stats["present"],
            "absent_days": stats["absent"],
            "late_count": stats["late"],
            "attendance_rate": rate
        })
    
    dept_ranking = sorted(dept_ranking, key=lambda x: x["attendance_rate"], reverse=True)
    
    # Attendance trend (compare first half vs second half)
    mid_point = len(daily_stats) // 2
    if mid_point > 0:
        first_half_present = sum(d["present"] for d in daily_stats[:mid_point])
        second_half_present = sum(d["present"] for d in daily_stats[mid_point:])
        first_half_avg = first_half_present / mid_point if mid_point > 0 else 0
        second_half_avg = second_half_present / (len(daily_stats) - mid_point) if (len(daily_stats) - mid_point) > 0 else 0
        
        if second_half_avg > first_half_avg * 1.05:
            trend = "improving"
        elif second_half_avg < first_half_avg * 0.95:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "insufficient_data"
    
    return {
        "from_date": from_date,
        "to_date": to_date,
        "working_days_in_range": total_working_days,
        "holidays_in_range": len(holiday_dates),
        "total_employees": total_employees,
        
        "overview": {
            "attendance_rate": attendance_rate,
            "avg_daily_attendance": avg_daily_attendance,
            "avg_daily_hours": avg_daily_hours,
            "perfect_days_count": len(perfect_days),
            "high_absence_days_count": len(high_absence_days),
            "late_instances": total_late,
            "wfh_count": total_wfh,
            "leave_count": total_leave,
            "punctuality_champions_count": len(punctuality_champions),
            "chronic_absentees_count": len(chronic_absentees),
            "trend": trend
        },
        
        "key_metrics": {
            "most_absent_day": most_absent_day,
            "perfect_days": perfect_days[:10],
            "high_absence_days": high_absence_days[:10]
        },
        
        "patterns": {
            "monday_absence_rate": monday_absence_rate,
            "friday_absence_rate": friday_absence_rate,
            "other_days_absence_rate": other_absence_rate,
            "pre_holiday_absence_rate": pre_holiday_absence_rate,
            "monday_blues": monday_absence_rate > other_absence_rate * 1.2,
            "friday_flight": friday_absence_rate > other_absence_rate * 1.2,
            "pre_holiday_pattern": pre_holiday_absence_rate > other_absence_rate * 1.2
        },
        
        "rankings": {
            "most_late": most_late,
            "most_absent": most_absent,
            "chronic_absentees": chronic_absentees[:10],
            "punctuality_champions": punctuality_champions[:10],
            "most_hours": most_hours
        },
        
        "department_analysis": dept_ranking,
        
        "employee_stats": employee_stats
    }


@api_router.get("/attendance/my-summary")
async def get_my_attendance_summary(
    request: Request,
    from_date: str,
    to_date: str
):
    """
    Get personal attendance summary for logged-in employee.
    """
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee linked to this user")
    
    from datetime import datetime, timedelta
    
    # Parse dates
    start_date = datetime.strptime(from_date, "%Y-%m-%d")
    end_date = datetime.strptime(to_date, "%Y-%m-%d")
    
    # Get holidays
    holidays = await db.holidays.find({
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0, "date": 1}).to_list(100)
    holiday_dates = set(h["date"] for h in holidays)
    
    # Calculate working days
    working_days = []
    current = start_date
    while current <= end_date:
        date_str = current.strftime("%Y-%m-%d")
        if current.weekday() != 6 and date_str not in holiday_dates:
            working_days.append(date_str)
        current += timedelta(days=1)
    
    # Get my attendance
    attendance = await db.attendance.find({
        "employee_id": employee_id,
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0}).to_list(500)
    
    attendance_by_date = {a["date"]: a for a in attendance}
    
    # Calculate stats
    present_days = 0
    absent_days = 0
    late_count = 0
    wfh_count = 0
    leave_count = 0
    total_hours = 0
    total_late_minutes = 0
    
    for day in working_days:
        att = attendance_by_date.get(day)
        if att:
            status = att.get("status", "present")
            if status == "present":
                present_days += 1
            elif status == "wfh":
                wfh_count += 1
            elif status == "leave":
                leave_count += 1
            else:
                present_days += 1
            
            if att.get("is_late"):
                late_count += 1
                total_late_minutes += att.get("late_minutes", 0)
            
            if att.get("total_hours"):
                total_hours += att.get("total_hours", 0)
        else:
            absent_days += 1
    
    attendance_rate = round((present_days / len(working_days) * 100), 1) if working_days else 0
    avg_hours = round(total_hours / present_days, 2) if present_days > 0 else 0
    
    return {
        "from_date": from_date,
        "to_date": to_date,
        "working_days": len(working_days),
        "summary": {
            "present_days": present_days,
            "absent_days": absent_days,
            "late_count": late_count,
            "wfh_count": wfh_count,
            "leave_count": leave_count,
            "attendance_rate": attendance_rate,
            "total_hours": round(total_hours, 2),
            "avg_hours_per_day": avg_hours,
            "total_late_minutes": total_late_minutes
        },
        "attendance_records": attendance
    }


@api_router.get("/attendance/calendar-data")
async def get_attendance_calendar_data(
    request: Request,
    from_date: str,
    to_date: str
):
    """
    Get attendance data for calendar view.
    Returns daily counts of present, absent, and late employees.
    HR/Admin only.
    """
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all attendance records in the date range
    attendance_records = await db.attendance.find({
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0}).to_list(10000)
    
    # Get all active employees for absent calculation
    employees = await db.employees.find({"is_active": True}, {"_id": 0, "employee_id": 1}).to_list(1000)
    employee_ids = {e["employee_id"] for e in employees}
    total_employees = len(employee_ids)
    
    # Get holidays in range
    holidays = await db.holidays.find({
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0, "date": 1, "name": 1}).to_list(100)
    holiday_dates = {h["date"]: h["name"] for h in holidays}
    
    # Group attendance by date
    from collections import defaultdict
    daily_data = defaultdict(lambda: {"present": [], "absent": [], "late": []})
    
    for record in attendance_records:
        date = record.get("date")
        emp_id = record.get("employee_id")
        is_late = record.get("is_late", False)
        first_in = record.get("first_in", "")
        last_out = record.get("last_out", "")
        
        # Get employee name
        emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0, "first_name": 1, "last_name": 1, "emp_code": 1})
        emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() if emp else emp_id
        emp_code = emp.get("emp_code", "") if emp else ""
        
        emp_data = {
            "employee_id": emp_id,
            "name": emp_name,
            "emp_code": emp_code,
            "in_time": first_in,
            "out_time": last_out
        }
        
        if is_late:
            daily_data[date]["late"].append(emp_data)
        else:
            daily_data[date]["present"].append(emp_data)
    
    # Calculate absent for each date (working days only)
    from datetime import datetime, timedelta
    
    start = datetime.strptime(from_date, "%Y-%m-%d")
    end = datetime.strptime(to_date, "%Y-%m-%d")
    current = start
    
    calendar_data = []
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        is_sunday = current.weekday() == 6
        is_holiday = date_str in holiday_dates
        
        day_info = {
            "date": date_str,
            "day_name": current.strftime("%A"),
            "is_sunday": is_sunday,
            "is_holiday": is_holiday,
            "holiday_name": holiday_dates.get(date_str, ""),
            "present_count": 0,
            "late_count": 0,
            "absent_count": 0,
            "present_employees": [],
            "late_employees": [],
            "absent_employees": []
        }
        
        if not is_sunday and not is_holiday:
            # It's a working day
            present_set = {emp["employee_id"] for emp in daily_data[date_str]["present"]}
            late_set = {emp["employee_id"] for emp in daily_data[date_str]["late"]}
            all_present_ids = present_set | late_set
            absent_ids = employee_ids - all_present_ids
            
            day_info["present_count"] = len(daily_data[date_str]["present"])
            day_info["late_count"] = len(daily_data[date_str]["late"])
            day_info["absent_count"] = len(absent_ids)
            day_info["present_employees"] = daily_data[date_str]["present"]
            day_info["late_employees"] = daily_data[date_str]["late"]
            
            # Build absent employee list
            for emp_id in absent_ids:
                emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0, "first_name": 1, "last_name": 1, "emp_code": 1})
                if emp:
                    day_info["absent_employees"].append({
                        "employee_id": emp_id,
                        "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
                        "emp_code": emp.get("emp_code", ""),
                        "in_time": "",
                        "out_time": ""
                    })
        
        calendar_data.append(day_info)
        current += timedelta(days=1)
    
    return {
        "from_date": from_date,
        "to_date": to_date,
        "total_employees": total_employees,
        "calendar_data": calendar_data
    }


# ==================== HR ATTENDANCE EDITING ====================

@api_router.put("/attendance/{attendance_id}")
async def edit_attendance_record(
    attendance_id: str,
    data: dict,
    request: Request
):
    """HR can edit any attendance record with audit trail"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the record
    record = await db.attendance.find_one({"attendance_id": attendance_id})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Build audit entry
    audit_entry = {
        "edited_by": user.get("user_id"),
        "edited_by_name": user.get("name"),
        "edited_at": datetime.now(timezone.utc).isoformat(),
        "previous_values": {},
        "new_values": {},
        "reason": data.get("edit_reason", "")
    }
    
    # Fields that can be edited
    editable_fields = ["status", "first_in", "last_out", "remarks", "is_late", "late_minutes", "total_hours"]
    update_data = {}
    
    for field in editable_fields:
        if field in data:
            audit_entry["previous_values"][field] = record.get(field)
            audit_entry["new_values"][field] = data[field]
            update_data[field] = data[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Get existing edit history or create new
    edit_history = record.get("edit_history", [])
    edit_history.append(audit_entry)
    
    update_data["edit_history"] = edit_history
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["is_manually_edited"] = True
    
    await db.attendance.update_one(
        {"attendance_id": attendance_id},
        {"$set": update_data}
    )
    
    return {"message": "Attendance record updated", "attendance_id": attendance_id}


@api_router.post("/attendance/manual")
async def add_manual_attendance(
    data: dict,
    request: Request
):
    """HR can add manual attendance entry for any employee/date"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee_id = data.get("employee_id")
    date = data.get("date")
    
    if not employee_id or not date:
        raise HTTPException(status_code=400, detail="Employee ID and date are required")
    
    # Check if record already exists
    existing = await db.attendance.find_one({"employee_id": employee_id, "date": date})
    if existing:
        raise HTTPException(status_code=400, detail="Attendance record already exists for this date. Use edit instead.")
    
    # Verify employee exists
    employee = await db.employees.find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    attendance = {
        "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
        "employee_id": employee_id,
        "date": date,
        "first_in": data.get("first_in"),
        "last_out": data.get("last_out"),
        "punches": [],
        "total_hours": data.get("total_hours"),
        "status": data.get("status", "present"),
        "is_late": data.get("is_late", False),
        "late_minutes": data.get("late_minutes", 0),
        "overtime_hours": 0,
        "remarks": data.get("remarks"),
        "source": "manual",
        "is_manually_edited": True,
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "edit_history": [{
            "edited_by": user.get("user_id"),
            "edited_by_name": user.get("name"),
            "edited_at": datetime.now(timezone.utc).isoformat(),
            "action": "created",
            "reason": data.get("edit_reason", "Manual entry by HR")
        }]
    }
    
    await db.attendance.insert_one(attendance)
    attendance.pop("_id", None)
    
    return {"message": "Attendance record created", "attendance": attendance}


@api_router.get("/attendance/{attendance_id}/history")
async def get_attendance_edit_history(
    attendance_id: str,
    request: Request
):
    """Get edit history for an attendance record (HR only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    record = await db.attendance.find_one({"attendance_id": attendance_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    return {
        "attendance_id": attendance_id,
        "employee_id": record.get("employee_id"),
        "date": record.get("date"),
        "current_status": record.get("status"),
        "is_manually_edited": record.get("is_manually_edited", False),
        "edit_history": record.get("edit_history", [])
    }


# ==================== ATTENDANCE GRID VIEW ====================

@api_router.get("/attendance/grid")
async def get_attendance_grid(
    request: Request,
    from_date: str,
    to_date: str,
    department_id: Optional[str] = None,
    search: Optional[str] = None
):
    """
    Get attendance data in grid format (employees vs dates).
    Returns a matrix of employee rows and date columns for easy tabular display.
    """
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build employee query
    emp_query = {"is_active": True}
    if department_id and department_id != 'all':
        emp_query["department_id"] = department_id
    
    # Get employees with optional search
    employees_cursor = db.employees.find(emp_query, {"_id": 0})
    employees = await employees_cursor.to_list(500)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        employees = [
            e for e in employees 
            if search_lower in (e.get("first_name", "") + " " + e.get("last_name", "")).lower()
            or search_lower in (e.get("emp_code", "") or "").lower()
        ]
    
    # Sort employees by name
    employees.sort(key=lambda x: f"{x.get('first_name', '')} {x.get('last_name', '')}")
    
    # Get department names
    dept_ids = list(set(e.get("department_id") for e in employees if e.get("department_id")))
    departments = await db.departments.find({"department_id": {"$in": dept_ids}}, {"_id": 0}).to_list(100)
    dept_map = {d["department_id"]: d["name"] for d in departments}
    
    # Get holidays in range
    holidays = await db.holidays.find({
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0}).to_list(100)
    holiday_dates = {h["date"]: h.get("name", "Holiday") for h in holidays}
    
    # Generate date range
    from datetime import datetime as dt
    start = dt.strptime(from_date, "%Y-%m-%d")
    end = dt.strptime(to_date, "%Y-%m-%d")
    dates = []
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        is_sunday = current.weekday() == 6
        is_holiday = date_str in holiday_dates
        dates.append({
            "date": date_str,
            "day_name": current.strftime("%a"),
            "day_num": current.day,
            "is_sunday": is_sunday,
            "is_holiday": is_holiday,
            "holiday_name": holiday_dates.get(date_str) if is_holiday else None
        })
        current += timedelta(days=1)
    
    # Get all attendance records in range
    emp_ids = [e["employee_id"] for e in employees]
    attendance_records = await db.attendance.find({
        "employee_id": {"$in": emp_ids},
        "date": {"$gte": from_date, "$lte": to_date}
    }, {"_id": 0}).to_list(10000)
    
    # Build attendance lookup: {employee_id: {date: record}}
    att_lookup = {}
    for att in attendance_records:
        emp_id = att.get("employee_id")
        date = att.get("date")
        if emp_id not in att_lookup:
            att_lookup[emp_id] = {}
        att_lookup[emp_id][date] = att
    
    # Build grid rows
    rows = []
    for emp in employees:
        emp_id = emp["employee_id"]
        emp_attendance = att_lookup.get(emp_id, {})
        
        # Build cells for each date
        cells = []
        for date_info in dates:
            date_str = date_info["date"]
            att = emp_attendance.get(date_str)
            
            cell = {
                "date": date_str,
                "status": None,
                "first_in": None,
                "last_out": None,
                "is_late": False,
                "late_minutes": 0,
                "attendance_id": None,
                "is_editable": not date_info["is_sunday"]
            }
            
            if date_info["is_sunday"]:
                cell["status"] = "sunday"
            elif date_info["is_holiday"]:
                cell["status"] = "holiday"
                cell["holiday_name"] = date_info["holiday_name"]
            elif att:
                cell["status"] = att.get("status", "present")
                cell["first_in"] = att.get("first_in")
                cell["last_out"] = att.get("last_out")
                cell["is_late"] = att.get("is_late", False)
                cell["late_minutes"] = att.get("late_minutes", 0)
                cell["attendance_id"] = att.get("attendance_id")
                cell["total_hours"] = att.get("total_hours")
                cell["is_manually_edited"] = att.get("is_manually_edited", False)
            else:
                cell["status"] = "no_record"
            
            cells.append(cell)
        
        # Calculate summary for the row
        present_count = sum(1 for c in cells if c["status"] == "present")
        absent_count = sum(1 for c in cells if c["status"] in ["absent", "no_record"] and not c.get("is_sunday") and not c.get("holiday_name"))
        wfh_count = sum(1 for c in cells if c["status"] == "wfh")
        late_count = sum(1 for c in cells if c.get("is_late"))
        leave_count = sum(1 for c in cells if c["status"] == "leave")
        half_day_count = sum(1 for c in cells if c["status"] in ["half_day", "HD"])
        
        rows.append({
            "employee_id": emp_id,
            "emp_code": emp.get("emp_code", ""),
            "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "department": dept_map.get(emp.get("department_id"), "Unknown"),
            "department_id": emp.get("department_id"),
            "cells": cells,
            "summary": {
                "present": present_count,
                "absent": absent_count,
                "wfh": wfh_count,
                "late": late_count,
                "leave": leave_count,
                "half_day": half_day_count
            }
        })
    
    return {
        "dates": dates,
        "rows": rows,
        "total_employees": len(rows),
        "from_date": from_date,
        "to_date": to_date
    }


# ==================== HOLIDAY MANAGEMENT ====================

@api_router.get("/holidays")
async def get_holidays(
    request: Request,
    year: Optional[int] = None
):
    """Get all holidays, optionally filtered by year"""
    user = await get_current_user(request)
    
    query = {}
    if year:
        query["date"] = {"$regex": f"^{year}"}
    
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(500)
    return holidays


@api_router.post("/holidays")
async def create_holiday(
    request: Request,
    data: dict
):
    """Create a new holiday (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    date = data.get("date")
    name = data.get("name")
    holiday_type = data.get("type", "public")  # public, restricted, optional
    is_half_day = data.get("is_half_day", False)  # NEW: Support for half-day holidays
    
    if not date or not name:
        raise HTTPException(status_code=400, detail="Date and name are required")
    
    # Check if holiday already exists
    existing = await db.holidays.find_one({"date": date})
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    
    import uuid
    holiday = {
        "holiday_id": f"hol_{uuid.uuid4().hex[:8]}",
        "date": date,
        "name": name,
        "type": holiday_type,
        "is_half_day": is_half_day,
        "created_by": user.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.holidays.insert_one(holiday)
    holiday.pop("_id", None)
    
    return {"message": "Holiday created", "holiday": holiday}


@api_router.put("/holidays/{holiday_id}")
async def update_holiday(
    request: Request,
    holiday_id: str,
    data: dict
):
    """Update a holiday (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if "name" in data:
        update_data["name"] = data["name"]
    if "type" in data:
        update_data["type"] = data["type"]
    if "date" in data:
        update_data["date"] = data["date"]
    if "is_half_day" in data:
        update_data["is_half_day"] = data["is_half_day"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.holidays.update_one(
        {"holiday_id": holiday_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday updated"}


@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    request: Request,
    holiday_id: str
):
    """Delete a holiday (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.holidays.delete_one({"holiday_id": holiday_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday deleted"}


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


@api_router.get("/leave/balances")
async def get_leave_balances_for_employee(request: Request, employee_id: Optional[str] = None):
    """Get leave balances for a specific employee (HR only) or current user"""
    user = await get_current_user(request)
    current_year = datetime.now(timezone.utc).year
    
    if employee_id:
        # HR/Admin can view any employee's balances
        if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        target_employee_id = employee_id
    else:
        # View own balances
        target_employee_id = user.get("employee_id")
        if not target_employee_id:
            return []
    
    balances = await db.leave_balances.find(
        {"employee_id": target_employee_id, "year": current_year}, {"_id": 0}
    ).to_list(50)
    
    # Enrich with leave type names
    leave_types = await db.leave_types.find({}, {"_id": 0}).to_list(50)
    leave_type_map = {lt.get("leave_type_id"): lt.get("name") for lt in leave_types}
    
    for balance in balances:
        balance["leave_type_name"] = leave_type_map.get(balance.get("leave_type_id"), "Unknown")
    
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

@api_router.get("/leave/requests")
async def get_leave_requests(
    request: Request, 
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Get leave requests - HR can view any employee's, others view their own"""
    user = await get_current_user(request)
    
    query = {}
    
    if employee_id:
        # HR/Admin can view any employee's requests
        if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        query["employee_id"] = employee_id
    else:
        # View own requests
        own_emp_id = user.get("employee_id")
        if not own_emp_id:
            return []
        query["employee_id"] = own_emp_id
    
    if status:
        query["status"] = status
    
    requests_list = await db.leave_requests.find(query, {"_id": 0}).sort("applied_on", -1).to_list(limit)
    
    # Enrich with leave type names
    leave_types = await db.leave_types.find({}, {"_id": 0}).to_list(50)
    leave_type_map = {lt.get("leave_type_id"): lt.get("name") for lt in leave_types}
    
    for req in requests_list:
        req["leave_type_name"] = leave_type_map.get(req.get("leave_type_id"), "Unknown")
    
    return requests_list


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


# ==================== LEAVE BALANCE MANAGEMENT ====================

@api_router.get("/leave/balances/all")
async def get_all_leave_balances(
    request: Request, 
    year: Optional[int] = None,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    """Get all leave balances (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current_year = year or datetime.now(timezone.utc).year
    query = {"year": current_year}
    
    if employee_id:
        query["employee_id"] = employee_id
    
    balances = await db.leave_balances.find(query, {"_id": 0}).to_list(1000)
    
    # Group by employee
    employee_balances = {}
    for b in balances:
        emp_id = b.get("employee_id")
        if emp_id not in employee_balances:
            employee_balances[emp_id] = {
                "employee_id": emp_id,
                "emp_code": b.get("emp_code"),
                "employee_name": b.get("employee_name"),
                "balances": []
            }
        employee_balances[emp_id]["balances"].append({
            "leave_type_id": b.get("leave_type_id"),
            "opening_balance": b.get("opening_balance", 0),
            "accrued": b.get("accrued", 0),
            "used": b.get("used", 0),
            "pending": b.get("pending", 0),
            "available": b.get("available", 0)
        })
    
    return list(employee_balances.values())


@api_router.put("/leave/balances/{employee_id}")
async def update_leave_balance(employee_id: str, data: dict, request: Request):
    """Update leave balance for an employee (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_type_id = data.get("leave_type_id")
    year = data.get("year", datetime.now(timezone.utc).year)
    
    if not leave_type_id:
        raise HTTPException(status_code=400, detail="leave_type_id required")
    
    # Verify employee exists
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Calculate available based on updated values
    opening = float(data.get("opening_balance", 0))
    accrued = float(data.get("accrued", 0))
    used = float(data.get("used", 0))
    pending = float(data.get("pending", 0))
    available = opening + accrued - used - pending
    
    update_doc = {
        "employee_id": employee_id,
        "emp_code": employee.get("emp_code"),
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "leave_type_id": leave_type_id,
        "year": year,
        "opening_balance": opening,
        "accrued": accrued,
        "used": used,
        "pending": pending,
        "available": available,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.leave_balances.update_one(
        {"employee_id": employee_id, "leave_type_id": leave_type_id, "year": year},
        {"$set": update_doc},
        upsert=True
    )
    
    await log_audit("UPDATE", "leave", "leave_balance", f"{employee_id}_{leave_type_id}",
                   user["user_id"], user.get("name", ""), new_value=update_doc, request=request)
    
    return {"message": "Leave balance updated", "balance": update_doc}


@api_router.post("/leave/balances/bulk-update")
async def bulk_update_leave_balances(data: List[dict], request: Request):
    """Bulk update leave balances (HR/Admin only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updated = 0
    errors = []
    year = datetime.now(timezone.utc).year
    
    for item in data:
        try:
            employee_id = item.get("employee_id")
            leave_type_id = item.get("leave_type_id")
            
            if not employee_id or not leave_type_id:
                errors.append({"item": item, "error": "Missing employee_id or leave_type_id"})
                continue
            
            employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
            if not employee:
                errors.append({"item": item, "error": f"Employee not found: {employee_id}"})
                continue
            
            opening = float(item.get("opening_balance", 0))
            accrued = float(item.get("accrued", 0))
            used = float(item.get("used", 0))
            pending = float(item.get("pending", 0))
            available = opening + accrued - used - pending
            
            update_doc = {
                "employee_id": employee_id,
                "emp_code": employee.get("emp_code"),
                "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
                "leave_type_id": leave_type_id,
                "year": year,
                "opening_balance": opening,
                "accrued": accrued,
                "used": used,
                "pending": pending,
                "available": available,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user["user_id"]
            }
            
            await db.leave_balances.update_one(
                {"employee_id": employee_id, "leave_type_id": leave_type_id, "year": year},
                {"$set": update_doc},
                upsert=True
            )
            updated += 1
            
        except Exception as e:
            errors.append({"item": item, "error": str(e)})
    
    return {"message": "Bulk update completed", "updated": updated, "errors": errors}


# ==================== LEAVE ACCRUAL RULES ====================

def get_default_leave_accrual_rules():
    """Return default leave accrual rules configuration"""
    return {
        "CL": {
            "name": "Casual Leave",
            "annual_quota": 12,
            "accrual_type": "monthly",  # monthly, quarterly, yearly, none
            "accrual_rate": 1.0,  # Leaves accrued per period
            "carry_forward": False,
            "max_carry_forward": 0,
            "encashment_allowed": False,
            "encashment_rate": 0,  # Percentage of basic per day
            "min_service_days": 0,  # Days of service required to be eligible
            "probation_eligible": True,
            "max_consecutive_days": 3,
            "advance_notice_days": 1,
            "can_be_half_day": True,
            "gender_specific": None,  # null, male, female
        },
        "SL": {
            "name": "Sick Leave",
            "annual_quota": 12,
            "accrual_type": "yearly",
            "accrual_rate": 12.0,
            "carry_forward": False,
            "max_carry_forward": 0,
            "encashment_allowed": False,
            "encashment_rate": 0,
            "min_service_days": 0,
            "probation_eligible": True,
            "max_consecutive_days": 7,
            "advance_notice_days": 0,  # Can be applied same day
            "can_be_half_day": True,
            "gender_specific": None,
            "medical_certificate_required_after": 2,  # Days after which certificate needed
        },
        "EL": {
            "name": "Earned Leave",
            "annual_quota": 15,
            "accrual_type": "monthly",
            "accrual_rate": 1.25,
            "carry_forward": True,
            "max_carry_forward": 30,
            "encashment_allowed": True,
            "encashment_rate": 100,
            "min_service_days": 240,  # Eligible after completing probation
            "probation_eligible": False,
            "max_consecutive_days": 15,
            "advance_notice_days": 7,
            "can_be_half_day": False,
            "gender_specific": None,
        },
        "CO": {
            "name": "Compensatory Off",
            "annual_quota": 0,  # No fixed quota - earned by working extra
            "accrual_type": "none",  # Manually credited
            "accrual_rate": 0,
            "carry_forward": False,
            "max_carry_forward": 0,
            "encashment_allowed": False,
            "encashment_rate": 0,
            "min_service_days": 0,
            "probation_eligible": True,
            "max_consecutive_days": 2,
            "advance_notice_days": 1,
            "can_be_half_day": True,
            "gender_specific": None,
            "validity_days": 30,  # Must be used within 30 days of earning
        },
    }


@api_router.get("/leave/accrual-rules")
async def get_leave_accrual_rules(request: Request):
    """Get leave accrual rules configuration - available to all authenticated users"""
    user = await get_current_user(request)
    # All authenticated users can view rules (needed for displaying correct quotas)
    
    config = await db.leave_config.find_one({"config_type": "accrual_rules"}, {"_id": 0})
    
    if not config:
        return get_default_leave_accrual_rules()
    
    return config.get("rules", get_default_leave_accrual_rules())


@api_router.put("/leave/accrual-rules")
async def update_leave_accrual_rules(rules: dict, request: Request):
    """Update leave accrual rules configuration"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config_doc = {
        "config_type": "accrual_rules",
        "rules": rules,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.leave_config.update_one(
        {"config_type": "accrual_rules"},
        {"$set": config_doc},
        upsert=True
    )
    
    await log_audit("UPDATE", "leave", "accrual_rules", "leave_config",
                   user["user_id"], user.get("name", ""), new_value=rules, request=request)
    
    return {"message": "Leave accrual rules updated", "rules": rules}


@api_router.put("/leave/accrual-rules/{leave_code}")
async def update_single_leave_rule(leave_code: str, rule_data: dict, request: Request):
    """Update a single leave type's accrual rules"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get existing config
    config = await db.leave_config.find_one({"config_type": "accrual_rules"}, {"_id": 0})
    rules = config.get("rules", get_default_leave_accrual_rules()) if config else get_default_leave_accrual_rules()
    
    # Update the specific leave type
    rules[leave_code.upper()] = rule_data
    
    config_doc = {
        "config_type": "accrual_rules",
        "rules": rules,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.leave_config.update_one(
        {"config_type": "accrual_rules"},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"message": f"Leave rule for {leave_code} updated", "rule": rule_data}


@api_router.post("/leave/run-accrual")
async def run_leave_accrual(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Manually run leave accrual for all eligible employees"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Get accrual rules
    config = await db.leave_config.find_one({"config_type": "accrual_rules"}, {"_id": 0})
    rules = config.get("rules", get_default_leave_accrual_rules()) if config else get_default_leave_accrual_rules()
    
    # Get all active employees
    employees = await db.employees.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    accrued_count = 0
    
    for emp in employees:
        employee_id = emp.get("employee_id")
        emp_code = emp.get("emp_code")
        emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
        
        for leave_code, rule in rules.items():
            if rule.get("accrual_type") == "monthly":
                accrual_amount = rule.get("accrual_rate", 0)
                
                if accrual_amount > 0:
                    # Check if accrual already done for this month
                    existing = await db.leave_accrual_log.find_one({
                        "employee_id": employee_id,
                        "leave_code": leave_code,
                        "month": target_month,
                        "year": target_year
                    })
                    
                    if not existing:
                        # Update balance
                        leave_type_id = f"lt_{leave_code.lower()}"
                        
                        await db.leave_balances.update_one(
                            {"employee_id": employee_id, "leave_type_id": leave_type_id, "year": target_year},
                            {
                                "$inc": {"accrued": accrual_amount, "available": accrual_amount},
                                "$setOnInsert": {
                                    "employee_id": employee_id,
                                    "emp_code": emp_code,
                                    "employee_name": emp_name,
                                    "leave_type_id": leave_type_id,
                                    "year": target_year,
                                    "opening_balance": 0,
                                    "used": 0,
                                    "pending": 0
                                }
                            },
                            upsert=True
                        )
                        
                        # Log the accrual
                        await db.leave_accrual_log.insert_one({
                            "employee_id": employee_id,
                            "leave_code": leave_code,
                            "leave_type_id": leave_type_id,
                            "month": target_month,
                            "year": target_year,
                            "amount": accrual_amount,
                            "accrued_at": now.isoformat()
                        })
                        
                        accrued_count += 1
    
    return {
        "message": f"Leave accrual completed for {target_month}/{target_year}",
        "accruals_processed": accrued_count,
        "employees_count": len(employees)
    }


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
from routes.travel import router as travel_router, tours_router
from routes.data_management import router as data_management_router, set_db as set_data_management_db
from routes.biometric import router as biometric_router, set_db as set_biometric_db
from routes.helpdesk import router as helpdesk_router
from routes.sop import router as sop_router
from routes.calendar import router as calendar_router
from services.biometric_sync import set_db as set_biometric_sync_db

# Set database for data management and biometric sync
set_data_management_db(db)
set_biometric_db(db)
set_biometric_sync_db(db)

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
api_router.include_router(tours_router)
api_router.include_router(data_management_router)
api_router.include_router(biometric_router)
api_router.include_router(helpdesk_router)
api_router.include_router(sop_router)
api_router.include_router(calendar_router)

# CORS Configuration - when credentials are used, origins must be explicit
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
if cors_origins_env == '*' or cors_origins_env == '':
    # Default origins for development and production
    cors_origins = [
        "http://localhost:3000",
        "https://hrpro-dashboard.preview.emergentagent.com",
        "https://bulk-import-helper.emergent.host",
        "https://sharda-hr-system.emergent.host",
        "https://hrpro-dashboard.preview.emergentagent.com",
    ]
else:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== SCHEDULER FOR BIOMETRIC SYNC ====================

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    """Start the biometric sync scheduler on app startup"""
    from services.biometric_sync import sync_biometric_data, sync_historical_data
    import asyncio
    
    # Add job to run every 3 hours
    scheduler.add_job(
        sync_biometric_data,
        IntervalTrigger(hours=3),
        id="biometric_sync",
        name="Biometric API Sync (every 3 hours)",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Biometric sync scheduler started - running every 3 hours")
    
    # Run initial sync on startup (in background to not block startup)
    # This ensures production gets data immediately after deployment
    async def initial_sync():
        try:
            # Wait a few seconds for everything to initialize
            await asyncio.sleep(5)
            
            # Check if we have any biometric attendance data
            count = await db.attendance.count_documents({"remarks": "Synced from biometric API"})
            
            if count == 0:
                # No biometric data exists - run historical sync (past 1 year)
                logger.info("No biometric attendance data found - running initial historical sync...")
                await sync_historical_data(days=365)
                logger.info("Initial historical sync completed")
            else:
                # Data exists - just do a regular sync for recent days
                logger.info(f"Found {count} biometric records - running regular sync...")
                await sync_biometric_data()
                logger.info("Regular sync completed")
        except Exception as e:
            logger.error(f"Error in initial sync: {e}")
    
    # Run initial sync in background
    asyncio.create_task(initial_sync())


@app.on_event("shutdown")
async def shutdown_scheduler():
    """Shutdown scheduler gracefully"""
    scheduler.shutdown(wait=False)
    logger.info("Biometric sync scheduler stopped")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== ADMIN DATABASE CLEANUP ====================

@api_router.post("/admin/cleanup-duplicates")
async def cleanup_duplicates(request: Request):
    """Admin endpoint to clean up duplicate records in the database.
    Only super_admin can run this. Safe to run multiple times."""
    user = await get_current_user(request)
    
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can run cleanup")
    
    results = {
        "employees_deleted": 0,
        "insurance_deleted": 0,
        "salaries_deactivated": 0,
        "details": []
    }
    
    try:
        from collections import Counter
        
        # 1. Fix Employee duplicates by emp_code
        pipeline = [
            {"$group": {"_id": "$emp_code", "count": {"$sum": 1}, "docs": {"$push": "$$ROOT"}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        emp_dups = await db.employees.aggregate(pipeline).to_list(100)
        
        for dup in emp_dups:
            docs = dup['docs']
            # Sort by is_active (prefer active) and created_at (prefer newer)
            docs.sort(key=lambda x: (x.get('is_active', False), x.get('created_at', '')), reverse=True)
            
            keep_id = docs[0]['employee_id']
            delete_ids = [d['employee_id'] for d in docs[1:]]
            
            result = await db.employees.delete_many({'employee_id': {'$in': delete_ids}})
            results["employees_deleted"] += result.deleted_count
            results["details"].append(f"emp_code {dup['_id']}: kept {keep_id}, deleted {len(delete_ids)}")
        
        # 2. Fix Insurance duplicates by employee_id
        pipeline = [
            {"$group": {"_id": "$employee_id", "count": {"$sum": 1}, "docs": {"$push": "$$ROOT"}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        ins_dups = await db.insurance.aggregate(pipeline).to_list(100)
        
        for dup in ins_dups:
            docs = dup['docs']
            # Sort by updated_at/created_at to keep the most recent
            docs.sort(key=lambda x: x.get('updated_at', x.get('created_at', '')), reverse=True)
            
            keep_id = docs[0]['insurance_id']
            delete_ids = [d['insurance_id'] for d in docs[1:]]
            
            result = await db.insurance.delete_many({'insurance_id': {'$in': delete_ids}})
            results["insurance_deleted"] += result.deleted_count
            results["details"].append(f"employee_id {dup['_id']}: kept {keep_id}, deleted {len(delete_ids)} insurance records")
        
        # 3. Fix Employee_salaries - ensure only one active per employee
        pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$employee_id", "count": {"$sum": 1}, "docs": {"$push": "$$ROOT"}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        sal_dups = await db.employee_salaries.aggregate(pipeline).to_list(100)
        
        for dup in sal_dups:
            docs = dup['docs']
            # Sort by updated_at to keep the most recent
            docs.sort(key=lambda x: x.get('updated_at', x.get('created_at', '')), reverse=True)
            
            # Keep the first one active, deactivate others
            deactivate_ids = [d['salary_id'] for d in docs[1:]]
            
            result = await db.employee_salaries.update_many(
                {'salary_id': {'$in': deactivate_ids}},
                {'$set': {'is_active': False, 'deactivated_at': datetime.now(timezone.utc).isoformat()}}
            )
            results["salaries_deactivated"] += result.modified_count
            results["details"].append(f"employee_id {dup['_id']}: deactivated {len(deactivate_ids)} duplicate salary records")
        
        results["message"] = "Cleanup completed successfully"
        results["status"] = "success"
        
    except Exception as e:
        results["message"] = f"Error during cleanup: {str(e)}"
        results["status"] = "error"
    
    return results


# ==================== EMPLOYEE INSURANCE ROUTES ====================

class InsuranceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    insurance_id: str = Field(default_factory=lambda: f"ins_{uuid.uuid4().hex[:12]}")
    employee_id: str
    emp_code: str
    employee_name: str
    esic: bool = False  # ESIC covered
    pmjjby: bool = False  # Pradhan Mantri Jeevan Jyoti Bima Yojana
    accidental_insurance: bool = False  # Accidental insurance coverage
    insurance_date: Optional[str] = None  # Date of insurance
    amount: Optional[float] = None
    insurance_company: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None  # health, life, accident, etc.
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = "active"  # active, expired, cancelled
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None


@api_router.get("/insurance")
async def get_all_insurance(
    request: Request,
    employee_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all insurance records"""
    user = await get_current_user(request)
    
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    
    records = await db.insurance.find(query, {"_id": 0}).to_list(1000)
    return records


@api_router.get("/insurance/{insurance_id}")
async def get_insurance_by_id(insurance_id: str, request: Request):
    """Get single insurance record"""
    user = await get_current_user(request)
    
    record = await db.insurance.find_one({"insurance_id": insurance_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    return record


@api_router.post("/insurance")
async def create_insurance(data: dict, request: Request):
    """Create new insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    emp_code = data.get("emp_code")
    if not emp_code:
        raise HTTPException(status_code=400, detail="Employee code is required")
    
    # Find employee
    employee = await db.employees.find_one({"emp_code": emp_code}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee with code {emp_code} not found")
    
    # All fields are now optional except emp_code
    insurance_doc = {
        "insurance_id": f"ins_{uuid.uuid4().hex[:12]}",
        "employee_id": employee["employee_id"],
        "emp_code": emp_code,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "esic": data.get("esic", False),
        "pmjjby": data.get("pmjjby", False),
        "accidental_insurance": data.get("accidental_insurance", False),
        "insurance_date": data.get("insurance_date") or None,
        "amount": float(data.get("amount")) if data.get("amount") else None,
        "insurance_company": data.get("insurance_company") or None,
        "policy_number": data.get("policy_number") or None,
        "coverage_type": data.get("coverage_type") or None,
        "start_date": data.get("start_date") or None,
        "end_date": data.get("end_date") or None,
        "status": data.get("status", "active"),
        "notes": data.get("notes") or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    
    await db.insurance.insert_one(insurance_doc)
    
    # Remove _id from response to avoid serialization issue
    insurance_doc.pop('_id', None)
    return {"message": "Insurance record created", "insurance": insurance_doc}


@api_router.put("/insurance/{insurance_id}")
async def update_insurance(insurance_id: str, data: dict, request: Request):
    """Update insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.insurance.find_one({"insurance_id": insurance_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    
    # All fields are optional - update only what's provided or keep existing
    update_data = {
        "esic": data.get("esic", existing.get("esic", False)),
        "pmjjby": data.get("pmjjby", existing.get("pmjjby", False)),
        "accidental_insurance": data.get("accidental_insurance", existing.get("accidental_insurance", False)),
        "insurance_date": data.get("insurance_date") if "insurance_date" in data else existing.get("insurance_date"),
        "amount": float(data.get("amount")) if data.get("amount") else existing.get("amount"),
        "insurance_company": data.get("insurance_company") if "insurance_company" in data else existing.get("insurance_company"),
        "policy_number": data.get("policy_number") if "policy_number" in data else existing.get("policy_number"),
        "coverage_type": data.get("coverage_type") if "coverage_type" in data else existing.get("coverage_type"),
        "start_date": data.get("start_date") if "start_date" in data else existing.get("start_date"),
        "end_date": data.get("end_date") if "end_date" in data else existing.get("end_date"),
        "status": data.get("status", existing.get("status")),
        "notes": data.get("notes") if "notes" in data else existing.get("notes"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.insurance.update_one(
        {"insurance_id": insurance_id},
        {"$set": update_data}
    )
    
    return {"message": "Insurance record updated"}


@api_router.delete("/insurance/{insurance_id}")
async def delete_insurance(insurance_id: str, request: Request):
    """Delete insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.insurance.delete_one({"insurance_id": insurance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    
    return {"message": "Insurance record deleted"}


# ==================== BUSINESS INSURANCE ROUTES ====================

class BusinessInsuranceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    business_insurance_id: str = Field(default_factory=lambda: f"biz_ins_{uuid.uuid4().hex[:12]}")
    name_of_insurance: str
    vehicle_no: Optional[str] = None
    insurance_company: str
    date_of_issuance: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None


@api_router.get("/business-insurance")
async def get_all_business_insurance(request: Request):
    """Get all business insurance records"""
    user = await get_current_user(request)
    
    records = await db.business_insurance.find({}, {"_id": 0}).to_list(1000)
    return records


@api_router.get("/business-insurance/{business_insurance_id}")
async def get_business_insurance_by_id(business_insurance_id: str, request: Request):
    """Get single business insurance record"""
    user = await get_current_user(request)
    
    record = await db.business_insurance.find_one({"business_insurance_id": business_insurance_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Business insurance record not found")
    return record


@api_router.post("/business-insurance")
async def create_business_insurance(data: dict, request: Request):
    """Create new business insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    name_of_insurance = data.get("name_of_insurance")
    insurance_company = data.get("insurance_company")
    
    if not name_of_insurance or not insurance_company:
        raise HTTPException(status_code=400, detail="Name of Insurance and Insurance Company are required")
    
    business_insurance_doc = {
        "business_insurance_id": f"biz_ins_{uuid.uuid4().hex[:12]}",
        "name_of_insurance": name_of_insurance,
        "vehicle_no": data.get("vehicle_no"),
        "insurance_company": insurance_company,
        "date_of_issuance": data.get("date_of_issuance"),
        "due_date": data.get("due_date"),
        "notes": data.get("notes"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    
    await db.business_insurance.insert_one(business_insurance_doc)
    
    business_insurance_doc.pop('_id', None)
    return {"message": "Business insurance record created", "business_insurance": business_insurance_doc}


@api_router.put("/business-insurance/{business_insurance_id}")
async def update_business_insurance(business_insurance_id: str, data: dict, request: Request):
    """Update business insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.business_insurance.find_one({"business_insurance_id": business_insurance_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Business insurance record not found")
    
    update_data = {
        "name_of_insurance": data.get("name_of_insurance", existing.get("name_of_insurance")),
        "vehicle_no": data.get("vehicle_no", existing.get("vehicle_no")),
        "insurance_company": data.get("insurance_company", existing.get("insurance_company")),
        "date_of_issuance": data.get("date_of_issuance", existing.get("date_of_issuance")),
        "due_date": data.get("due_date", existing.get("due_date")),
        "notes": data.get("notes", existing.get("notes")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.business_insurance.update_one(
        {"business_insurance_id": business_insurance_id},
        {"$set": update_data}
    )
    
    return {"message": "Business insurance record updated"}


@api_router.delete("/business-insurance/{business_insurance_id}")
async def delete_business_insurance(business_insurance_id: str, request: Request):
    """Delete business insurance record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.business_insurance.delete_one({"business_insurance_id": business_insurance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business insurance record not found")
    
    return {"message": "Business insurance record deleted"}


# ==================== EMPLOYEE ASSETS ROUTES ====================

@api_router.get("/employee-assets")
async def get_all_employee_assets(request: Request):
    """Get all employee assets (HR only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await db.employee_assets.find({}, {"_id": 0}).to_list(1000)
    return records


@api_router.get("/employee-assets/my-assets")
async def get_my_assets(request: Request):
    """Get assets assigned to the current logged-in employee"""
    user = await get_current_user(request)
    
    emp_code = user.get("emp_code")
    employee_id = user.get("employee_id")
    
    # Try by emp_code first
    if emp_code:
        record = await db.employee_assets.find_one({"emp_code": emp_code}, {"_id": 0})
        if record:
            return record
    
    # Try by employee_id
    if employee_id:
        record = await db.employee_assets.find_one({"employee_id": employee_id}, {"_id": 0})
        if record:
            return record
        
        # Look up employee to get emp_code
        employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0, "emp_code": 1})
        if employee and employee.get("emp_code"):
            record = await db.employee_assets.find_one({"emp_code": employee["emp_code"]}, {"_id": 0})
            if record:
                return record
    
    return None


@api_router.get("/employee-assets/{identifier}")
async def get_employee_assets_by_code(identifier: str, request: Request):
    """Get assets for a specific employee by emp_code or employee_id"""
    user = await get_current_user(request)
    
    # Try to find by emp_code first
    record = await db.employee_assets.find_one({"emp_code": identifier}, {"_id": 0})
    if record:
        return record
    
    # Try by employee_id in assets collection
    record = await db.employee_assets.find_one({"employee_id": identifier}, {"_id": 0})
    if record:
        return record
    
    # If identifier is an employee_id, look up the employee to get emp_code
    employee = await db.employees.find_one({"employee_id": identifier}, {"_id": 0, "emp_code": 1})
    if employee and employee.get("emp_code"):
        record = await db.employee_assets.find_one({"emp_code": employee["emp_code"]}, {"_id": 0})
        if record:
            return record
    
    # Return empty object instead of 404 to avoid UI errors
    return None


@api_router.post("/employee-assets")
async def create_employee_assets(data: dict, request: Request):
    """Create employee assets record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    emp_code = data.get("emp_code")
    if not emp_code:
        raise HTTPException(status_code=400, detail="Employee code is required")
    
    # Find employee
    employee = await db.employees.find_one({"emp_code": emp_code}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee with code {emp_code} not found")
    
    # Check if assets record already exists
    existing = await db.employee_assets.find_one({"emp_code": emp_code})
    if existing:
        raise HTTPException(status_code=400, detail="Assets record already exists for this employee. Use update instead.")
    
    asset_doc = {
        "asset_record_id": f"ast_{uuid.uuid4().hex[:12]}",
        "employee_id": employee["employee_id"],
        "emp_code": emp_code,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "sdpl_number": data.get("sdpl_number", ""),
        "tag": data.get("tag", ""),
        "mobile_charger": data.get("mobile_charger", False),
        "laptop": data.get("laptop", False),
        "system": data.get("system", False),
        "printer": data.get("printer", False),
        "sim_mobile_no": data.get("sim_mobile_no", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    
    await db.employee_assets.insert_one(asset_doc)
    asset_doc.pop('_id', None)
    return {"message": "Assets record created", "assets": asset_doc}


@api_router.put("/employee-assets/{emp_code}")
async def update_employee_assets(emp_code: str, data: dict, request: Request):
    """Update employee assets record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.employee_assets.find_one({"emp_code": emp_code})
    if not existing:
        raise HTTPException(status_code=404, detail="Assets record not found")
    
    update_data = {
        "sdpl_number": data.get("sdpl_number", existing.get("sdpl_number")),
        "tag": data.get("tag", existing.get("tag")),
        "mobile_charger": data.get("mobile_charger", existing.get("mobile_charger")),
        "laptop": data.get("laptop", existing.get("laptop")),
        "system": data.get("system", existing.get("system")),
        "printer": data.get("printer", existing.get("printer")),
        "sim_mobile_no": data.get("sim_mobile_no", existing.get("sim_mobile_no")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    await db.employee_assets.update_one(
        {"emp_code": emp_code},
        {"$set": update_data}
    )
    
    return {"message": "Assets record updated"}


@api_router.delete("/employee-assets/{emp_code}")
async def delete_employee_assets(emp_code: str, request: Request):
    """Delete employee assets record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.employee_assets.delete_one({"emp_code": emp_code})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assets record not found")
    
    return {"message": "Assets record deleted"}


# Include the router in the main app (after all routes are defined)
app.include_router(api_router)

