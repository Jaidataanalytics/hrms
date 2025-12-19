"""Travel Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/travel", tags=["Travel Management"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== TRAVEL REQUESTS ====================

@router.get("/requests")
async def list_travel_requests(
    request: Request,
    status: Optional[str] = None,
    employee_id: Optional[str] = None
):
    """List travel requests"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id and employee_id != "all":
        query["employee_id"] = employee_id
    
    if status and status != "all":
        query["status"] = status
    
    requests = await db.travel_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with employee names
    for req in requests:
        if req.get("employee_id"):
            emp = await db.employees.find_one({"employee_id": req["employee_id"]}, {"_id": 0})
            if emp:
                req["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    
    return requests


@router.post("/requests")
async def create_travel_request(data: dict, request: Request):
    """Create travel request"""
    user = await get_current_user(request)
    
    data["request_id"] = f"tvl_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = user.get("employee_id")
    data["status"] = "pending"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Calculate estimated cost
    days = 1
    if data.get("start_date") and data.get("end_date"):
        from datetime import datetime as dt
        start = dt.fromisoformat(data["start_date"])
        end = dt.fromisoformat(data["end_date"])
        days = (end - start).days + 1
    
    data["trip_days"] = days
    
    await db.travel_requests.insert_one(data)
    data.pop('_id', None)
    return data


@router.get("/requests/{request_id}")
async def get_travel_request(request_id: str, request: Request):
    """Get travel request details"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        if travel_req["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get related expenses
    expenses = await db.expenses.find(
        {"travel_request_id": request_id}, {"_id": 0}
    ).to_list(50)
    travel_req["expenses"] = expenses
    
    return travel_req


@router.put("/requests/{request_id}")
async def update_travel_request(request_id: str, data: dict, request: Request):
    """Update travel request"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Only creator can update pending requests
    if travel_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending requests")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": data}
    )
    return {"message": "Request updated"}


@router.put("/requests/{request_id}/approve")
async def approve_travel_request(request_id: str, data: dict, request: Request):
    """Approve travel request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.get("user_id"),
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_budget": data.get("approved_budget"),
            "approval_remarks": data.get("remarks")
        }}
    )
    return {"message": "Travel request approved"}


@router.put("/requests/{request_id}/reject")
async def reject_travel_request(request_id: str, data: dict, request: Request):
    """Reject travel request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user.get("user_id"),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": data.get("reason")
        }}
    )
    return {"message": "Travel request rejected"}


@router.put("/requests/{request_id}/complete")
async def complete_travel(request_id: str, data: dict, request: Request):
    """Mark travel as completed"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "completed",
            "actual_end_date": data.get("actual_end_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "trip_report": data.get("trip_report"),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Travel marked as completed"}


@router.put("/requests/{request_id}/cancel")
async def cancel_travel_request(request_id: str, data: dict, request: Request):
    """Cancel travel request"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancellation_reason": data.get("reason"),
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Travel request cancelled"}


# ==================== MY TRAVEL ====================

@router.get("/my-requests")
async def get_my_travel_requests(request: Request):
    """Get current user's travel requests"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    requests = await db.travel_requests.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


# ==================== TRAVEL SUMMARY ====================

@router.get("/summary")
async def get_travel_summary(request: Request):
    """Get travel summary for dashboard"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pending = await db.travel_requests.count_documents({"status": "pending"})
    approved = await db.travel_requests.count_documents({"status": "approved"})
    ongoing = await db.travel_requests.count_documents({"status": "ongoing"})
    completed = await db.travel_requests.count_documents({"status": "completed"})
    
    # Calculate total budget used this month
    from datetime import datetime as dt
    start_of_month = dt.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    pipeline = [
        {"$match": {"status": {"$in": ["approved", "completed"]}, "created_at": {"$gte": start_of_month.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$approved_budget"}}}
    ]
    result = await db.travel_requests.aggregate(pipeline).to_list(1)
    total_budget = result[0]["total"] if result else 0
    
    return {
        "pending": pending,
        "approved": approved,
        "ongoing": ongoing,
        "completed": completed,
        "total_budget_this_month": total_budget
    }
