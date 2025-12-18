"""Grievance / Helpdesk API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/grievances", tags=["Grievance"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== TICKETS ====================

@router.get("")
async def list_grievances(
    request: Request,
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None
):
    """List grievance tickets"""
    user = await get_current_user(request)
    
    query = {}
    
    # Regular employees see only their own
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["employee_id"] = user.get("employee_id")
    
    if status and status != "all":
        query["status"] = status
    if category and category != "all":
        query["category"] = category
    if priority and priority != "all":
        query["priority"] = priority
    
    tickets = await db.grievances.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tickets


@router.post("")
async def create_grievance(data: dict, request: Request):
    """Submit grievance ticket"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    ticket = {
        "ticket_id": f"TKT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "employee_id": employee_id,
        "employee_name": user.get("name"),
        "category": data.get("category", "general"),
        "subject": data.get("subject"),
        "description": data.get("description"),
        "priority": data.get("priority", "medium"),
        "status": "open",
        "is_anonymous": data.get("is_anonymous", False),
        "assigned_to": None,
        "resolution": None,
        "resolved_at": None,
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if ticket["is_anonymous"]:
        ticket["employee_id"] = None
        ticket["employee_name"] = "Anonymous"
    
    await db.grievances.insert_one(ticket)
    return ticket


@router.get("/{ticket_id}")
async def get_grievance(ticket_id: str, request: Request):
    """Get grievance ticket details"""
    user = await get_current_user(request)
    
    ticket = await db.grievances.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Check access (HR can see all, employees only their own)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        if ticket.get("employee_id") and ticket["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return ticket


@router.put("/{ticket_id}")
async def update_grievance(ticket_id: str, data: dict, request: Request):
    """Update grievance ticket (HR only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.grievances.update_one({"ticket_id": ticket_id}, {"$set": data})
    return await db.grievances.find_one({"ticket_id": ticket_id}, {"_id": 0})


@router.post("/{ticket_id}/comment")
async def add_comment(ticket_id: str, data: dict, request: Request):
    """Add comment to ticket"""
    user = await get_current_user(request)
    
    comment = {
        "comment_id": f"cmt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "user_name": user.get("name"),
        "content": data.get("content"),
        "is_internal": data.get("is_internal", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.grievances.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"comments": comment},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    return comment


@router.put("/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, data: dict, request: Request):
    """Assign ticket to HR member"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.grievances.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "assigned_to": data.get("assignee_id"),
            "status": "in_progress",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Ticket assigned"}


@router.put("/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, data: dict, request: Request):
    """Resolve grievance ticket"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.grievances.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "resolved",
            "resolution": data.get("resolution"),
            "resolved_by": user["user_id"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Ticket resolved"}


@router.put("/{ticket_id}/close")
async def close_ticket(ticket_id: str, request: Request):
    """Close grievance ticket"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.grievances.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Ticket closed"}


@router.put("/{ticket_id}/reopen")
async def reopen_ticket(ticket_id: str, request: Request):
    """Reopen closed ticket"""
    user = await get_current_user(request)
    
    await db.grievances.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "reopened",
            "reopened_at": datetime.now(timezone.utc).isoformat(),
            "reopened_by": user["user_id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Ticket reopened"}


# ==================== CATEGORIES ====================

@router.get("/categories")
async def list_grievance_categories(request: Request):
    """List grievance categories"""
    await get_current_user(request)
    return [
        {"code": "general", "name": "General Query"},
        {"code": "payroll", "name": "Payroll Issue"},
        {"code": "leave", "name": "Leave Related"},
        {"code": "harassment", "name": "Harassment", "allow_anonymous": True},
        {"code": "workplace", "name": "Workplace Concern"},
        {"code": "benefits", "name": "Benefits & Insurance"},
        {"code": "it_support", "name": "IT Support"},
        {"code": "policy", "name": "Policy Clarification"},
        {"code": "feedback", "name": "Feedback/Suggestion"}
    ]
