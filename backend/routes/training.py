"""Training Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/training", tags=["Training Management"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== TRAINING PROGRAMS ====================

@router.get("/programs")
async def list_training_programs(
    request: Request,
    status: Optional[str] = None,
    category: Optional[str] = None
):
    """List training programs"""
    await get_current_user(request)
    
    query = {"is_active": True}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    programs = await db.training_programs.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)
    return programs


@router.post("/programs")
async def create_training_program(data: dict, request: Request):
    """Create training program"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["program_id"] = f"trn_{uuid.uuid4().hex[:12]}"
    data["created_by"] = user.get("user_id")
    data["is_active"] = True
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.training_programs.insert_one(data)
    data.pop('_id', None)
    return data


@router.get("/programs/{program_id}")
async def get_training_program(program_id: str, request: Request):
    """Get training program details"""
    await get_current_user(request)
    
    program = await db.training_programs.find_one({"program_id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Get enrolled employees
    enrollments = await db.training_enrollments.find(
        {"program_id": program_id}, {"_id": 0}
    ).to_list(500)
    program["enrollments"] = enrollments
    
    return program


@router.put("/programs/{program_id}")
async def update_training_program(program_id: str, data: dict, request: Request):
    """Update training program"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = user.get("user_id")
    
    await db.training_programs.update_one(
        {"program_id": program_id},
        {"$set": data}
    )
    return {"message": "Program updated"}


@router.delete("/programs/{program_id}")
async def delete_training_program(program_id: str, request: Request):
    """Delete training program"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.training_programs.update_one(
        {"program_id": program_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Program deleted"}


# ==================== ENROLLMENTS ====================

@router.get("/enrollments")
async def list_enrollments(request: Request, program_id: Optional[str] = None):
    """List training enrollments"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        query["employee_id"] = user.get("employee_id")
    if program_id:
        query["program_id"] = program_id
    
    enrollments = await db.training_enrollments.find(query, {"_id": 0}).to_list(500)
    return enrollments


@router.post("/enrollments")
async def enroll_employee(data: dict, request: Request):
    """Enroll employee in training"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["enrollment_id"] = f"enr_{uuid.uuid4().hex[:12]}"
    data["status"] = "enrolled"
    data["enrolled_by"] = user.get("user_id")
    data["enrolled_at"] = datetime.now(timezone.utc).isoformat()
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.training_enrollments.insert_one(data)
    data.pop('_id', None)
    return data


@router.put("/enrollments/{enrollment_id}/complete")
async def complete_training(enrollment_id: str, data: dict, request: Request):
    """Mark training as completed"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.training_enrollments.update_one(
        {"enrollment_id": enrollment_id},
        {"$set": {
            "status": "completed",
            "completion_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "score": data.get("score"),
            "certificate_url": data.get("certificate_url"),
            "feedback": data.get("feedback")
        }}
    )
    return {"message": "Training marked as completed"}


# ==================== CERTIFICATIONS ====================

@router.get("/certifications")
async def list_certifications(request: Request, employee_id: Optional[str] = None):
    """List employee certifications"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    certs = await db.certifications.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(200)
    return certs


@router.post("/certifications")
async def add_certification(data: dict, request: Request):
    """Add employee certification"""
    user = await get_current_user(request)
    
    # Employees can add their own, HR can add for anyone
    if user.get("role") not in ["super_admin", "hr_admin"]:
        data["employee_id"] = user.get("employee_id")
    
    data["certification_id"] = f"cert_{uuid.uuid4().hex[:12]}"
    data["verified"] = user.get("role") in ["super_admin", "hr_admin"]
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.certifications.insert_one(data)
    data.pop('_id', None)
    return data


@router.put("/certifications/{cert_id}/verify")
async def verify_certification(cert_id: str, request: Request):
    """Verify certification"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.certifications.update_one(
        {"certification_id": cert_id},
        {"$set": {"verified": True, "verified_by": user.get("user_id")}}
    )
    return {"message": "Certification verified"}


# ==================== SKILL MATRIX ====================

@router.get("/skills")
async def list_skills(request: Request):
    """List all skills in the system"""
    await get_current_user(request)
    skills = await db.skills.find({"is_active": True}, {"_id": 0}).to_list(200)
    return skills


@router.post("/skills")
async def create_skill(data: dict, request: Request):
    """Create skill"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["skill_id"] = f"skl_{uuid.uuid4().hex[:12]}"
    data["is_active"] = True
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.skills.insert_one(data)
    data.pop('_id', None)
    return data


@router.get("/employee-skills/{employee_id}")
async def get_employee_skills(employee_id: str, request: Request):
    """Get employee skill matrix"""
    user = await get_current_user(request)
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        if user.get("employee_id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    skills = await db.employee_skills.find({"employee_id": employee_id}, {"_id": 0}).to_list(100)
    return skills


@router.post("/employee-skills")
async def add_employee_skill(data: dict, request: Request):
    """Add/update employee skill"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        data["employee_id"] = user.get("employee_id")
        data["self_assessed"] = True
    
    data["record_id"] = f"eskl_{uuid.uuid4().hex[:12]}"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert
    existing = await db.employee_skills.find_one({
        "employee_id": data["employee_id"],
        "skill_id": data["skill_id"]
    })
    
    if existing:
        await db.employee_skills.update_one(
            {"employee_id": data["employee_id"], "skill_id": data["skill_id"]},
            {"$set": data}
        )
    else:
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.employee_skills.insert_one(data)
    
    data.pop('_id', None)
    return data


# ==================== MY TRAINING ====================

@router.get("/my-training")
async def get_my_training(request: Request):
    """Get current user's training history"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return {"enrollments": [], "certifications": [], "skills": []}
    
    enrollments = await db.training_enrollments.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).to_list(50)
    
    certifications = await db.certifications.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).to_list(50)
    
    skills = await db.employee_skills.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).to_list(50)
    
    return {
        "enrollments": enrollments,
        "certifications": certifications,
        "skills": skills
    }
