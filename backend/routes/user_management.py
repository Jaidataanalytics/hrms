"""User Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

router = APIRouter(prefix="/users", tags=["User Management"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== LIST USERS ====================

@router.get("")
async def list_users(
    request: Request,
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List all users (Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if role and role != "all":
        query["role"] = role
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}


# ==================== GET USER ====================

@router.get("/{user_id}")
async def get_user(user_id: str, request: Request):
    """Get user details"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"] and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get linked employee if exists
    if user.get("employee_id"):
        employee = await db.employees.find_one({"employee_id": user["employee_id"]}, {"_id": 0})
        user["employee"] = employee
    
    return user


# ==================== CREATE USER ====================

@router.post("")
async def create_user(data: dict, request: Request):
    """Create new user (Admin only)"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Only super_admin can create super_admin users
    if data.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create super admin users")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.get("email")})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate required fields
    if not data.get("email") or not data.get("password") or not data.get("name"):
        raise HTTPException(status_code=400, detail="Email, password and name are required")
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": data.get("email"),
        "password_hash": pwd_context.hash(data.get("password")),
        "name": data.get("name"),
        "role": data.get("role", "employee"),
        "employee_id": data.get("employee_id"),
        "is_active": True,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    user.pop('_id', None)
    user.pop('password_hash', None)
    
    return user


# ==================== UPDATE USER ====================

@router.put("/{user_id}")
async def update_user(user_id: str, data: dict, request: Request):
    """Update user details (Admin only)"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get existing user
    existing = await db.users.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super_admin can modify super_admin users
    if existing.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can modify super admin users")
    
    # Only super_admin can change role to super_admin
    if data.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can assign super admin role")
    
    # Check email uniqueness if changing
    if data.get("email") and data.get("email") != existing.get("email"):
        email_exists = await db.users.find_one({"email": data.get("email"), "user_id": {"$ne": user_id}})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    update_data = {}
    allowed_fields = ["email", "name", "role", "employee_id"]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["user_id"]
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    # Also update employee record if name changed
    if data.get("name") and existing.get("employee_id"):
        name_parts = data["name"].split(" ", 1)
        await db.employees.update_one(
            {"employee_id": existing["employee_id"]},
            {"$set": {
                "first_name": name_parts[0],
                "last_name": name_parts[1] if len(name_parts) > 1 else ""
            }}
        )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


# ==================== DELETE USER ====================

@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete user (Admin only) - Soft delete"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cannot delete self
    if current_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Get existing user
    existing = await db.users.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super_admin can delete super_admin users
    if existing.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can delete super admin users")
    
    # Soft delete - mark as inactive and append timestamp to email
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_active": False,
            "email": f"{existing['email']}_deleted_{datetime.now().timestamp()}",
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user["user_id"]
        }}
    )
    
    # Also deactivate employee if linked
    if existing.get("employee_id"):
        await db.employees.update_one(
            {"employee_id": existing["employee_id"]},
            {"$set": {
                "employment_status": "terminated",
                "is_active": False,
                "termination_date": datetime.now(timezone.utc).date().isoformat()
            }}
        )
    
    return {"message": "User deleted successfully"}


# ==================== ACTIVATE/DEACTIVATE USER ====================

@router.put("/{user_id}/activate")
async def activate_user(user_id: str, request: Request):
    """Activate user (Admin only)"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_active": True,
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "activated_by": current_user["user_id"]
        }}
    )
    
    return {"message": "User activated successfully"}


@router.put("/{user_id}/deactivate")
async def deactivate_user(user_id: str, request: Request):
    """Deactivate user (Admin only)"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cannot deactivate self
    if current_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivated_by": current_user["user_id"]
        }}
    )
    
    return {"message": "User deactivated successfully"}


# ==================== RESET PASSWORD ====================

@router.put("/{user_id}/reset-password")
async def reset_password(user_id: str, data: dict, request: Request):
    """Reset user password (Admin only)"""
    current_user = await get_current_user(request)
    if current_user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Get existing user
    existing = await db.users.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super_admin can reset super_admin passwords
    if existing.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can reset super admin passwords")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "password_hash": pwd_context.hash(new_password),
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by": current_user["user_id"]
        }}
    )
    
    return {"message": "Password reset successfully"}


# ==================== CHANGE OWN PASSWORD ====================

@router.put("/me/change-password")
async def change_own_password(data: dict, request: Request):
    """Change own password"""
    current_user = await get_current_user(request)
    
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Get user with password
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Verify current password
    if not pwd_context.verify(current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "password_hash": pwd_context.hash(new_password),
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}


# ==================== GET ROLES ====================

@router.get("/roles/list")
async def list_roles(request: Request):
    """List available roles"""
    await get_current_user(request)
    
    roles = await db.roles.find({"is_active": True}, {"_id": 0}).to_list(20)
    if not roles:
        # Return default roles if not seeded
        roles = [
            {"role_id": "super_admin", "name": "Super Admin"},
            {"role_id": "hr_admin", "name": "HR Admin"},
            {"role_id": "hr_executive", "name": "HR Executive"},
            {"role_id": "manager", "name": "Manager"},
            {"role_id": "finance", "name": "Finance"},
            {"role_id": "it_admin", "name": "IT Admin"},
            {"role_id": "employee", "name": "Employee"}
        ]
    return roles
