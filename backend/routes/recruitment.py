"""Recruitment (Internal) API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/recruitment", tags=["Recruitment"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== JOB POSTINGS ====================

@router.get("/jobs")
async def list_job_postings(
    request: Request,
    status: Optional[str] = None,
    department_id: Optional[str] = None
):
    """List job postings"""
    user = await get_current_user(request)
    
    query = {"is_active": True}
    if status:
        query["status"] = status
    if department_id:
        query["department_id"] = department_id
    
    # Non-admin see only published jobs
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["status"] = "published"
    
    jobs = await db.job_postings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return jobs


@router.post("/jobs")
async def create_job_posting(data: dict, request: Request):
    """Create job posting (HR only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    job = {
        "job_id": f"JOB-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}",
        "title": data.get("title"),
        "department_id": data.get("department_id"),
        "location_id": data.get("location_id"),
        "designation_id": data.get("designation_id"),
        "job_type": data.get("job_type", "full_time"),  # full_time, part_time, contract
        "description": data.get("description"),
        "requirements": data.get("requirements"),
        "skills_required": data.get("skills_required", []),
        "experience_min": data.get("experience_min", 0),
        "experience_max": data.get("experience_max"),
        "salary_min": data.get("salary_min"),
        "salary_max": data.get("salary_max"),
        "vacancies": data.get("vacancies", 1),
        "hiring_manager": data.get("hiring_manager"),
        "status": "draft",  # draft, published, closed, on_hold
        "is_internal": data.get("is_internal", True),
        "application_deadline": data.get("application_deadline"),
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.job_postings.insert_one(job)
    job.pop('_id', None)
    return job


@router.get("/jobs/{job_id}")
async def get_job_posting(job_id: str, request: Request):
    """Get job posting details"""
    await get_current_user(request)
    
    job = await db.job_postings.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/jobs/{job_id}")
async def update_job_posting(job_id: str, data: dict, request: Request):
    """Update job posting"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.job_postings.update_one({"job_id": job_id}, {"$set": data})
    return await db.job_postings.find_one({"job_id": job_id}, {"_id": 0})


@router.put("/jobs/{job_id}/publish")
async def publish_job(job_id: str, request: Request):
    """Publish job posting"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.job_postings.update_one(
        {"job_id": job_id},
        {"$set": {
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Job published"}


@router.put("/jobs/{job_id}/close")
async def close_job(job_id: str, request: Request):
    """Close job posting"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.job_postings.update_one(
        {"job_id": job_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Job closed"}


# ==================== APPLICATIONS ====================

@router.get("/applications")
async def list_applications(
    request: Request,
    job_id: Optional[str] = None,
    status: Optional[str] = None
):
    """List applications"""
    user = await get_current_user(request)
    
    query = {}
    
    # Employees see only their own applications
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        query["employee_id"] = user.get("employee_id")
    
    if job_id:
        query["job_id"] = job_id
    if status:
        query["status"] = status
    
    applications = await db.job_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return applications


@router.post("/applications")
async def apply_for_job(data: dict, request: Request):
    """Apply for internal job"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile")
    
    job_id = data.get("job_id")
    
    # Check if already applied
    existing = await db.job_applications.find_one({
        "job_id": job_id,
        "employee_id": employee_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already applied for this job")
    
    # Get employee details
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    
    application = {
        "application_id": f"APP-{uuid.uuid4().hex[:10].upper()}",
        "job_id": job_id,
        "employee_id": employee_id,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "current_department": employee.get("department_id"),
        "current_designation": employee.get("designation_id"),
        "cover_letter": data.get("cover_letter"),
        "resume_url": data.get("resume_url"),
        "status": "applied",  # applied, screening, interview, selected, rejected, withdrawn
        "interview_schedule": None,
        "remarks": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.job_applications.insert_one(application)
    application.pop('_id', None)
    return application


@router.put("/applications/{app_id}/status")
async def update_application_status(app_id: str, data: dict, request: Request):
    """Update application status (HR only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_status = data.get("status")
    update_data = {
        "status": new_status,
        "remarks": data.get("remarks"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    if new_status == "interview":
        update_data["interview_schedule"] = data.get("interview_schedule")
    
    await db.job_applications.update_one(
        {"application_id": app_id},
        {"$set": update_data}
    )
    return {"message": f"Application status updated to {new_status}"}


@router.put("/applications/{app_id}/withdraw")
async def withdraw_application(app_id: str, request: Request):
    """Withdraw own application"""
    user = await get_current_user(request)
    
    app = await db.job_applications.find_one({"application_id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app["employee_id"] != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.job_applications.update_one(
        {"application_id": app_id},
        {"$set": {
            "status": "withdrawn",
            "withdrawn_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Application withdrawn"}
