"""Performance & KPI API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/performance", tags=["Performance"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== KPI TEMPLATES ====================

@router.get("/templates")
async def list_kpi_templates(request: Request):
    """List KPI templates"""
    await get_current_user(request)
    templates = await db.kpi_templates.find({"is_active": True}, {"_id": 0}).to_list(50)
    return templates


@router.post("/templates")
async def create_kpi_template(data: dict, request: Request):
    """Create KPI template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["template_id"] = f"kpi_{uuid.uuid4().hex[:12]}"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["is_active"] = True
    
    # Calculate total points
    total_points = sum(q.get("max_points", 10) * q.get("weightage", 1) for q in data.get("questions", []))
    data["total_points"] = total_points
    
    await db.kpi_templates.insert_one(data)
    return data


@router.get("/templates/{template_id}")
async def get_kpi_template(template_id: str, request: Request):
    """Get KPI template details"""
    await get_current_user(request)
    template = await db.kpi_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/templates/{template_id}")
async def update_kpi_template(template_id: str, data: dict, request: Request):
    """Update KPI template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.kpi_templates.update_one({"template_id": template_id}, {"$set": data})
    
    return await db.kpi_templates.find_one({"template_id": template_id}, {"_id": 0})


# ==================== EMPLOYEE KPI ====================

@router.get("/kpi")
async def list_employee_kpis(
    request: Request,
    employee_id: Optional[str] = None,
    period_type: Optional[str] = None,
    status: Optional[str] = None
):
    """List employee KPIs"""
    user = await get_current_user(request)
    
    query = {}
    
    # Regular employees only see their own
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    if period_type:
        query["period_type"] = period_type
    if status:
        query["status"] = status
    
    kpis = await db.employee_kpis.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return kpis


@router.post("/kpi")
async def create_employee_kpi(data: dict, request: Request):
    """Create/submit employee KPI"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    
    data["kpi_id"] = f"ekpi_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = employee_id
    data["status"] = "draft"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.employee_kpis.insert_one(data)
    return data


@router.get("/kpi/{kpi_id}")
async def get_employee_kpi(kpi_id: str, request: Request):
    """Get employee KPI details"""
    user = await get_current_user(request)
    
    kpi = await db.employee_kpis.find_one({"kpi_id": kpi_id}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        if kpi["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return kpi


@router.put("/kpi/{kpi_id}")
async def update_employee_kpi(kpi_id: str, data: dict, request: Request):
    """Update employee KPI responses"""
    user = await get_current_user(request)
    
    kpi = await db.employee_kpis.find_one({"kpi_id": kpi_id}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    # Only owner can update draft, manager/HR can update under_review
    if kpi["status"] == "draft":
        if kpi["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    elif kpi["status"] == "under_review":
        if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=400, detail="KPI cannot be modified")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.employee_kpis.update_one({"kpi_id": kpi_id}, {"$set": data})
    
    return await db.employee_kpis.find_one({"kpi_id": kpi_id}, {"_id": 0})


@router.put("/kpi/{kpi_id}/submit")
async def submit_kpi(kpi_id: str, request: Request):
    """Submit KPI for review"""
    user = await get_current_user(request)
    
    kpi = await db.employee_kpis.find_one({"kpi_id": kpi_id}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    if kpi["employee_id"] != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if kpi["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft KPIs can be submitted")
    
    # Calculate self score
    responses = kpi.get("responses", [])
    total_score = sum(r.get("score", 0) for r in responses)
    
    await db.employee_kpis.update_one(
        {"kpi_id": kpi_id},
        {"$set": {
            "status": "submitted",
            "self_score": total_score,
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "KPI submitted for review"}


@router.put("/kpi/{kpi_id}/review")
async def review_kpi(kpi_id: str, data: dict, request: Request):
    """Review and approve KPI (manager/HR)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    kpi = await db.employee_kpis.find_one({"kpi_id": kpi_id}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    
    if kpi["status"] not in ["submitted", "under_review"]:
        raise HTTPException(status_code=400, detail="KPI is not ready for review")
    
    update_data = {
        "status": "approved",
        "manager_score": data.get("manager_score"),
        "final_score": data.get("final_score", data.get("manager_score")),
        "rating": data.get("rating"),
        "manager_remarks": data.get("manager_remarks"),
        "reviewed_by": user["user_id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_kpis.update_one({"kpi_id": kpi_id}, {"$set": update_data})
    
    return {"message": "KPI reviewed and approved"}


# ==================== MY KPI ====================

@router.get("/my-kpi")
async def get_my_kpis(request: Request):
    """Get current user's KPIs"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    kpis = await db.employee_kpis.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return kpis


# ==================== GOALS ====================

@router.get("/goals")
async def list_goals(request: Request, employee_id: Optional[str] = None):
    """List goals"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    goals = await db.goals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return goals


@router.post("/goals")
async def create_goal(data: dict, request: Request):
    """Create goal"""
    user = await get_current_user(request)
    
    data["goal_id"] = f"goal_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = data.get("employee_id", user.get("employee_id"))
    data["created_by"] = user["user_id"]
    data["status"] = "in_progress"
    data["progress"] = 0
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.goals.insert_one(data)
    return data


@router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, data: dict, request: Request):
    """Update goal progress"""
    user = await get_current_user(request)
    
    goal = await db.goals.find_one({"goal_id": goal_id}, {"_id": 0})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        if goal["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.goals.update_one({"goal_id": goal_id}, {"$set": data})
    
    return await db.goals.find_one({"goal_id": goal_id}, {"_id": 0})


# ==================== REVIEWS ====================

@router.get("/reviews")
async def list_reviews(request: Request, employee_id: Optional[str] = None):
    """List performance reviews"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin"]:
        if user.get("role") == "manager":
            query["reviewer_id"] = user.get("employee_id")
        else:
            query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    reviews = await db.performance_reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return reviews


@router.post("/reviews")
async def create_review(data: dict, request: Request):
    """Create performance review"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["review_id"] = f"rev_{uuid.uuid4().hex[:12]}"
    data["reviewer_id"] = user.get("employee_id") or user["user_id"]
    data["status"] = "draft"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.performance_reviews.insert_one(data)
    return data
