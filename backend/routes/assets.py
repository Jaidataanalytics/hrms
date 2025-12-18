"""Asset Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/assets", tags=["Assets"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== ASSETS ====================

@router.get("")
async def list_assets(
    request: Request,
    category: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List all assets (Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    if category and category != "all":
        query["category"] = category
    if status and status != "all":
        query["status"] = status
    
    assets = await db.assets.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return assets


@router.post("")
async def create_asset(data: dict, request: Request):
    """Create new asset"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    asset = {
        "asset_id": f"ast_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "asset_tag": data.get("asset_tag"),
        "category": data.get("category", "other"),
        "brand": data.get("brand"),
        "model": data.get("model"),
        "serial_number": data.get("serial_number"),
        "purchase_date": data.get("purchase_date"),
        "purchase_cost": float(data.get("purchase_cost", 0) or 0),
        "warranty_expiry": data.get("warranty_expiry"),
        "condition": data.get("condition", "good"),
        "status": "available",
        "assigned_to": None,
        "assigned_date": None,
        "location_id": data.get("location_id"),
        "notes": data.get("notes"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    
    await db.assets.insert_one(asset)
    asset.pop('_id', None)
    return asset


@router.get("/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    """Get asset details"""
    await get_current_user(request)
    
    asset = await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{asset_id}")
async def update_asset(asset_id: str, data: dict, request: Request):
    """Update asset"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.assets.update_one({"asset_id": asset_id}, {"$set": data})
    return await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})


@router.put("/{asset_id}/assign")
async def assign_asset(asset_id: str, data: dict, request: Request):
    """Assign asset to employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID required")
    
    await db.assets.update_one(
        {"asset_id": asset_id},
        {"$set": {
            "status": "assigned",
            "assigned_to": employee_id,
            "assigned_date": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log assignment
    await db.asset_history.insert_one({
        "history_id": f"ahist_{uuid.uuid4().hex[:12]}",
        "asset_id": asset_id,
        "action": "assigned",
        "employee_id": employee_id,
        "performed_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Asset assigned successfully"}


@router.put("/{asset_id}/return")
async def return_asset(asset_id: str, data: dict, request: Request):
    """Return asset from employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    asset = await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})
    
    await db.assets.update_one(
        {"asset_id": asset_id},
        {"$set": {
            "status": "available",
            "assigned_to": None,
            "assigned_date": None,
            "condition": data.get("condition", "good"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log return
    await db.asset_history.insert_one({
        "history_id": f"ahist_{uuid.uuid4().hex[:12]}",
        "asset_id": asset_id,
        "action": "returned",
        "employee_id": asset.get("assigned_to"),
        "performed_by": user["user_id"],
        "notes": data.get("notes"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Asset returned successfully"}


# ==================== MY ASSETS ====================

@router.get("/my")
async def get_my_assets(request: Request):
    """Get assets assigned to current user"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    assets = await db.assets.find(
        {"assigned_to": employee_id, "status": "assigned"}, {"_id": 0}
    ).to_list(50)
    return assets


# ==================== ASSET REQUESTS ====================

@router.get("/requests")
async def list_asset_requests(request: Request, status: Optional[str] = None):
    """List asset requests"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        query["employee_id"] = user.get("employee_id")
    if status:
        query["status"] = status
    
    requests = await db.asset_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@router.post("/requests")
async def create_asset_request(data: dict, request: Request):
    """Create asset request"""
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


@router.put("/requests/{request_id}/approve")
async def approve_asset_request(request_id: str, data: dict, request: Request):
    """Approve asset request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.asset_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "asset_id": data.get("asset_id")
        }}
    )
    return {"message": "Request approved"}


@router.put("/requests/{request_id}/reject")
async def reject_asset_request(request_id: str, data: dict, request: Request):
    """Reject asset request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.asset_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user["user_id"],
            "rejection_reason": data.get("reason"),
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Request rejected"}
