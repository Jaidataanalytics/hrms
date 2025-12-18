"""Labour & Contract Labour Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/labour", tags=["Labour Management"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== CONTRACTORS ====================

@router.get("/contractors")
async def list_contractors(
    request: Request,
    status: Optional[str] = None,
    department_id: Optional[str] = None
):
    """List contractors/agencies"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    if status:
        query["status"] = status
    if department_id:
        query["department_id"] = department_id
    
    contractors = await db.contractors.find(query, {"_id": 0}).to_list(100)
    return contractors


@router.post("/contractors")
async def create_contractor(data: dict, request: Request):
    """Register contractor/agency"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    contractor = {
        "contractor_id": f"CONT-{uuid.uuid4().hex[:8].upper()}",
        "name": data.get("name"),
        "company_name": data.get("company_name"),
        "contact_person": data.get("contact_person"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "address": data.get("address"),
        "gst_number": data.get("gst_number"),
        "pan_number": data.get("pan_number"),
        "department_id": data.get("department_id"),
        "contract_start": data.get("contract_start"),
        "contract_end": data.get("contract_end"),
        "contract_value": data.get("contract_value"),
        "status": "active",
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contractors.insert_one(contractor)
    contractor.pop('_id', None)
    return contractor


@router.get("/contractors/{contractor_id}")
async def get_contractor(contractor_id: str, request: Request):
    """Get contractor details"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    contractor = await db.contractors.find_one({"contractor_id": contractor_id}, {"_id": 0})
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    
    # Get associated workers
    workers = await db.contract_workers.find({"contractor_id": contractor_id}, {"_id": 0}).to_list(200)
    contractor["workers"] = workers
    contractor["worker_count"] = len(workers)
    
    return contractor


@router.put("/contractors/{contractor_id}")
async def update_contractor(contractor_id: str, data: dict, request: Request):
    """Update contractor"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.contractors.update_one({"contractor_id": contractor_id}, {"$set": data})
    return await db.contractors.find_one({"contractor_id": contractor_id}, {"_id": 0})


# ==================== CONTRACT WORKERS ====================

@router.get("/workers")
async def list_contract_workers(
    request: Request,
    contractor_id: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[str] = None
):
    """List contract workers"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    if contractor_id:
        query["contractor_id"] = contractor_id
    if status:
        query["status"] = status
    if department_id:
        query["department_id"] = department_id
    
    workers = await db.contract_workers.find(query, {"_id": 0}).to_list(500)
    return workers


@router.post("/workers")
async def create_contract_worker(data: dict, request: Request):
    """Add contract worker"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    worker = {
        "worker_id": f"CW-{uuid.uuid4().hex[:8].upper()}",
        "contractor_id": data.get("contractor_id"),
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "aadhaar_number": data.get("aadhaar_number"),
        "department_id": data.get("department_id"),
        "location_id": data.get("location_id"),
        "skill_category": data.get("skill_category"),
        "daily_rate": data.get("daily_rate"),
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "reporting_manager": data.get("reporting_manager"),
        "status": "active",
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contract_workers.insert_one(worker)
    worker.pop('_id', None)
    return worker


@router.get("/workers/{worker_id}")
async def get_contract_worker(worker_id: str, request: Request):
    """Get contract worker details"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    worker = await db.contract_workers.find_one({"worker_id": worker_id}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    # Get attendance
    attendance = await db.contract_worker_attendance.find(
        {"worker_id": worker_id}, {"_id": 0}
    ).sort("date", -1).to_list(30)
    worker["recent_attendance"] = attendance
    
    return worker


@router.put("/workers/{worker_id}")
async def update_contract_worker(worker_id: str, data: dict, request: Request):
    """Update contract worker"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.contract_workers.update_one({"worker_id": worker_id}, {"$set": data})
    return await db.contract_workers.find_one({"worker_id": worker_id}, {"_id": 0})


@router.put("/workers/{worker_id}/terminate")
async def terminate_contract_worker(worker_id: str, data: dict, request: Request):
    """Terminate contract worker"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.contract_workers.update_one(
        {"worker_id": worker_id},
        {"$set": {
            "status": "terminated",
            "is_active": False,
            "termination_date": data.get("termination_date", datetime.now(timezone.utc).date().isoformat()),
            "termination_reason": data.get("reason"),
            "terminated_by": user["user_id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Worker terminated"}


# ==================== CONTRACT WORKER ATTENDANCE ====================

@router.get("/attendance")
async def list_contract_worker_attendance(
    request: Request,
    worker_id: Optional[str] = None,
    contractor_id: Optional[str] = None,
    date: Optional[str] = None
):
    """List contract worker attendance"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if worker_id:
        query["worker_id"] = worker_id
    if contractor_id:
        query["contractor_id"] = contractor_id
    if date:
        query["date"] = date
    
    attendance = await db.contract_worker_attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return attendance


@router.post("/attendance")
async def mark_contract_worker_attendance(data: dict, request: Request):
    """Mark contract worker attendance"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    attendance = {
        "attendance_id": f"cwa_{uuid.uuid4().hex[:12]}",
        "worker_id": data.get("worker_id"),
        "contractor_id": data.get("contractor_id"),
        "date": data.get("date", datetime.now(timezone.utc).date().isoformat()),
        "status": data.get("status", "present"),  # present, absent, half_day
        "in_time": data.get("in_time"),
        "out_time": data.get("out_time"),
        "hours_worked": data.get("hours_worked"),
        "overtime_hours": data.get("overtime_hours", 0),
        "remarks": data.get("remarks"),
        "marked_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contract_worker_attendance.insert_one(attendance)
    attendance.pop('_id', None)
    return attendance


# ==================== SUMMARY & REPORTS ====================

@router.get("/summary")
async def get_labour_summary(request: Request):
    """Get labour management summary"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    total_contractors = await db.contractors.count_documents({"is_active": True})
    total_workers = await db.contract_workers.count_documents({"is_active": True})
    
    # Workers by department
    by_department = await db.contract_workers.aggregate([
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$department_id", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Today's attendance
    present_today = await db.contract_worker_attendance.count_documents({
        "date": today, "status": "present"
    })
    
    return {
        "total_contractors": total_contractors,
        "total_workers": total_workers,
        "present_today": present_today,
        "by_department": by_department
    }
