"""Onboarding & Exit Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/onboarding", tags=["Onboarding & Exit"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== ONBOARDING ====================

@router.get("/tasks")
async def list_onboarding_tasks(
    request: Request,
    employee_id: Optional[str] = None,
    status: Optional[str] = None
):
    """List onboarding tasks"""
    user = await get_current_user(request)
    
    query = {}
    
    # Non-HR see only their own tasks
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    if status:
        query["status"] = status
    
    tasks = await db.onboarding_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    return tasks


@router.post("/tasks")
async def create_onboarding_task(data: dict, request: Request):
    """Create onboarding task"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    task = {
        "task_id": f"onb_{uuid.uuid4().hex[:12]}",
        "employee_id": data.get("employee_id"),
        "title": data.get("title"),
        "description": data.get("description"),
        "category": data.get("category", "general"),  # documents, training, it_setup, introduction
        "assigned_to": data.get("assigned_to"),  # who should complete this
        "due_date": data.get("due_date"),
        "status": "pending",  # pending, in_progress, completed, skipped
        "priority": data.get("priority", "medium"),
        "completed_at": None,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.onboarding_tasks.insert_one(task)
    task.pop('_id', None)
    return task


@router.put("/tasks/{task_id}")
async def update_onboarding_task(task_id: str, data: dict, request: Request):
    """Update onboarding task"""
    user = await get_current_user(request)
    
    task = await db.onboarding_tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Allow task owner or HR to update
    is_owner = task.get("assigned_to") == user.get("employee_id") or task.get("employee_id") == user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    if not (is_owner or is_hr):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if data.get("status") == "completed":
        data["completed_at"] = datetime.now(timezone.utc).isoformat()
        data["completed_by"] = user["user_id"]
    
    await db.onboarding_tasks.update_one({"task_id": task_id}, {"$set": data})
    return await db.onboarding_tasks.find_one({"task_id": task_id}, {"_id": 0})


@router.post("/templates")
async def create_onboarding_template(data: dict, request: Request):
    """Create onboarding template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template = {
        "template_id": f"obtempl_{uuid.uuid4().hex[:10]}",
        "name": data.get("name"),
        "description": data.get("description"),
        "tasks": data.get("tasks", []),  # List of task definitions
        "department_id": data.get("department_id"),  # Optional, for department-specific templates
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.onboarding_templates.insert_one(template)
    template.pop('_id', None)
    return template


@router.get("/templates")
async def list_onboarding_templates(request: Request):
    """List onboarding templates"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    templates = await db.onboarding_templates.find({"is_active": True}, {"_id": 0}).to_list(50)
    return templates


@router.post("/apply-template")
async def apply_template_to_employee(data: dict, request: Request):
    """Apply onboarding template to new employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template_id = data.get("template_id")
    employee_id = data.get("employee_id")
    start_date = data.get("start_date", datetime.now(timezone.utc).date().isoformat())
    
    template = await db.onboarding_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    created_tasks = []
    for idx, task_def in enumerate(template.get("tasks", [])):
        task = {
            "task_id": f"onb_{uuid.uuid4().hex[:12]}",
            "employee_id": employee_id,
            "title": task_def.get("title"),
            "description": task_def.get("description"),
            "category": task_def.get("category", "general"),
            "assigned_to": task_def.get("assigned_to"),
            "due_date": task_def.get("due_date"),
            "status": "pending",
            "priority": task_def.get("priority", "medium"),
            "order": idx + 1,
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.onboarding_tasks.insert_one(task)
        task.pop('_id', None)
        created_tasks.append(task)
    
    return {"message": f"Created {len(created_tasks)} onboarding tasks", "tasks": created_tasks}


# ==================== ONBOARDING RECORDS (NEW) ====================

# Default task templates for each stage
ONBOARDING_TASK_TEMPLATES = {
    'pre_joining': [
        {'task_id': 'id_proof', 'title': 'Submit ID Proof', 'description': 'Upload Aadhaar/Passport/Voter ID', 'category': 'documents'},
        {'task_id': 'pan_card', 'title': 'Submit PAN Card', 'description': 'Upload PAN card copy', 'category': 'documents'},
        {'task_id': 'bank_details', 'title': 'Submit Bank Details', 'description': 'Provide bank account for salary', 'category': 'documents'},
        {'task_id': 'address_proof', 'title': 'Submit Address Proof', 'description': 'Upload utility bill/rent agreement', 'category': 'documents'},
        {'task_id': 'education_certs', 'title': 'Submit Education Certificates', 'description': 'Upload degree/diploma certificates', 'category': 'documents'},
        {'task_id': 'offer_acceptance', 'title': 'Accept Offer Letter', 'description': 'Sign and accept the offer letter', 'category': 'documents'},
    ],
    'day_1': [
        {'task_id': 'id_card', 'title': 'ID Card Generation', 'description': 'Employee ID card creation', 'category': 'it_setup', 'assigned_to_hr': True},
        {'task_id': 'laptop_assignment', 'title': 'Laptop Assignment', 'description': 'Assign laptop and accessories', 'category': 'it_setup', 'assigned_to_hr': True},
        {'task_id': 'email_setup', 'title': 'Email Account Setup', 'description': 'Create corporate email account', 'category': 'it_setup', 'assigned_to_hr': True},
        {'task_id': 'system_access', 'title': 'System Access', 'description': 'Grant access to required systems', 'category': 'it_setup', 'assigned_to_hr': True},
        {'task_id': 'workstation', 'title': 'Workstation Setup', 'description': 'Allocate desk and workspace', 'category': 'it_setup', 'assigned_to_hr': True},
    ],
    'week_1': [
        {'task_id': 'company_orientation', 'title': 'Company Orientation', 'description': 'Attend company overview session', 'category': 'training'},
        {'task_id': 'hr_policies', 'title': 'HR Policies Training', 'description': 'Complete HR policies acknowledgment', 'category': 'training'},
        {'task_id': 'safety_training', 'title': 'Safety Training', 'description': 'Complete workplace safety training', 'category': 'training'},
        {'task_id': 'department_intro', 'title': 'Department Introduction', 'description': 'Meet team members', 'category': 'introduction'},
        {'task_id': 'buddy_meeting', 'title': 'Buddy/Mentor Meeting', 'description': 'Initial meeting with assigned mentor', 'category': 'introduction'},
    ],
    'month_1': [
        {'task_id': 'mentor_checkin', 'title': 'Mentor Check-in', 'description': '30-day mentor review', 'category': 'review'},
        {'task_id': 'initial_feedback', 'title': 'Initial Feedback', 'description': 'Provide initial experience feedback', 'category': 'review'},
        {'task_id': 'goal_setting', 'title': 'Goal Setting', 'description': 'Set initial performance goals', 'category': 'review'},
        {'task_id': 'role_clarity', 'title': 'Role Clarity Session', 'description': 'Clarify job responsibilities', 'category': 'review'},
    ],
    'probation': [
        {'task_id': 'performance_review', 'title': 'Probation Review', 'description': 'Complete probation performance review', 'category': 'evaluation', 'assigned_to_hr': True},
        {'task_id': 'confirmation_decision', 'title': 'Confirmation Decision', 'description': 'Confirmation/extension decision', 'category': 'evaluation', 'assigned_to_hr': True},
        {'task_id': 'final_feedback', 'title': 'Final Feedback', 'description': 'Probation period feedback', 'category': 'evaluation'},
    ]
}


@router.get("/records")
async def list_onboarding_records(request: Request, status: Optional[str] = None):
    """List all onboarding records (HR sees all, employees see their own)"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["employee_id"] = user.get("employee_id")
    
    if status:
        query["status"] = status
    
    records = await db.onboarding_records.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with employee names
    for record in records:
        emp = await db.employees.find_one({"employee_id": record.get("employee_id")}, {"_id": 0})
        if emp:
            record["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            record["emp_code"] = emp.get("emp_code", "")
    
    return records


@router.post("/records")
async def create_onboarding_record(data: dict, request: Request):
    """Create a new onboarding record for an employee"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    
    # Check if employee already has active onboarding
    existing = await db.onboarding_records.find_one({
        "employee_id": employee_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Employee already has an active onboarding")
    
    # Get employee details
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Create all tasks for all stages
    all_tasks = []
    for stage, tasks in ONBOARDING_TASK_TEMPLATES.items():
        for task in tasks:
            all_tasks.append({
                **task,
                "stage": stage,
                "completed": False,
                "completed_at": None,
                "completed_by": None
            })
    
    record = {
        "onboarding_id": f"onb_{uuid.uuid4().hex[:12]}",
        "employee_id": employee_id,
        "department_id": employee.get("department_id") or data.get("department_id"),
        "designation_id": employee.get("designation_id") or data.get("designation_id"),
        "joining_date": data.get("joining_date"),
        "mentor_id": data.get("mentor_id"),
        "current_stage": "pre_joining",
        "status": "active",
        "tasks": all_tasks,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.onboarding_records.insert_one(record)
    record.pop('_id', None)
    
    # Add employee name for response
    record["employee_name"] = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
    record["emp_code"] = employee.get("emp_code", "")
    
    return record


@router.get("/records/{onboarding_id}")
async def get_onboarding_record(onboarding_id: str, request: Request):
    """Get a specific onboarding record"""
    user = await get_current_user(request)
    
    record = await db.onboarding_records.find_one({"onboarding_id": onboarding_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    
    # Check access
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    is_owner = record.get("employee_id") == user.get("employee_id")
    
    if not (is_hr or is_owner):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Add employee name
    emp = await db.employees.find_one({"employee_id": record.get("employee_id")}, {"_id": 0})
    if emp:
        record["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
        record["emp_code"] = emp.get("emp_code", "")
    
    return record


@router.put("/records/{onboarding_id}/stage")
async def update_onboarding_stage(onboarding_id: str, data: dict, request: Request):
    """Update the current stage of an onboarding record"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    record = await db.onboarding_records.find_one({"onboarding_id": onboarding_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    
    new_stage = data.get("stage")
    valid_stages = ["pre_joining", "day_1", "week_1", "month_1", "probation", "completed"]
    
    if new_stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    update_data = {
        "current_stage": new_stage,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If stage is completed, mark the record as completed
    if new_stage == "completed":
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.onboarding_records.update_one(
        {"onboarding_id": onboarding_id},
        {"$set": update_data}
    )
    
    return {"message": f"Stage updated to {new_stage}"}


@router.put("/records/{onboarding_id}/tasks/{task_id}")
async def update_onboarding_task(onboarding_id: str, task_id: str, data: dict, request: Request):
    """Update a specific task in an onboarding record"""
    user = await get_current_user(request)
    
    record = await db.onboarding_records.find_one({"onboarding_id": onboarding_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    
    # Check access
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    is_owner = record.get("employee_id") == user.get("employee_id")
    
    if not (is_hr or is_owner):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find and update the task
    tasks = record.get("tasks", [])
    task_found = False
    
    for task in tasks:
        if task.get("task_id") == task_id:
            task["completed"] = data.get("completed", False)
            task["completed_at"] = data.get("completed_at") if data.get("completed") else None
            task["completed_by"] = user.get("user_id") if data.get("completed") else None
            task_found = True
            break
    
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.onboarding_records.update_one(
        {"onboarding_id": onboarding_id},
        {"$set": {"tasks": tasks, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Task updated"}


# ==================== EXIT MANAGEMENT ====================

@router.get("/exit-requests")
async def list_exit_requests(
    request: Request,
    status: Optional[str] = None
):
    """List exit/resignation requests"""
    user = await get_current_user(request)
    
    query = {}
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        query["employee_id"] = user.get("employee_id")
    
    if status:
        query["status"] = status
    
    requests = await db.exit_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@router.post("/exit-requests")
async def create_exit_request(data: dict, request: Request):
    """Submit resignation/exit request"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile")
    
    # Check if already has pending request
    existing = await db.exit_requests.find_one({
        "employee_id": employee_id,
        "status": {"$in": ["pending", "approved", "in_notice"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already has an active exit request")
    
    exit_request = {
        "request_id": f"EXIT-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}",
        "employee_id": employee_id,
        "employee_name": user.get("name"),
        "resignation_date": datetime.now(timezone.utc).date().isoformat(),
        "requested_last_day": data.get("requested_last_day"),
        "reason": data.get("reason"),
        "reason_category": data.get("reason_category", "personal"),  # personal, career, relocation, other
        "status": "pending",  # pending, approved, rejected, in_notice, completed, withdrawn
        "notice_period_days": data.get("notice_period_days", 30),
        "actual_last_day": None,
        "exit_interview_date": None,
        "exit_interview_notes": None,
        "clearance_status": {},
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.exit_requests.insert_one(exit_request)
    exit_request.pop('_id', None)
    return exit_request


@router.get("/exit-requests/{request_id}")
async def get_exit_request(request_id: str, request: Request):
    """Get exit request details"""
    user = await get_current_user(request)
    
    exit_req = await db.exit_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not exit_req:
        raise HTTPException(status_code=404, detail="Exit request not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        if exit_req["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return exit_req


@router.put("/exit-requests/{request_id}/approve")
async def approve_exit_request(request_id: str, data: dict, request: Request):
    """Approve exit request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    actual_last_day = data.get("actual_last_day")
    
    await db.exit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "actual_last_day": actual_last_day,
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "remarks": data.get("remarks")
        }}
    )
    return {"message": "Exit request approved"}


@router.put("/exit-requests/{request_id}/reject")
async def reject_exit_request(request_id: str, data: dict, request: Request):
    """Reject exit request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.exit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user["user_id"],
            "rejection_reason": data.get("reason"),
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Exit request rejected"}


@router.put("/exit-requests/{request_id}/clearance")
async def update_clearance(request_id: str, data: dict, request: Request):
    """Update exit clearance status"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager", "it_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    department = data.get("department")  # hr, it, finance, admin, manager
    cleared = data.get("cleared", False)
    remarks = data.get("remarks")
    
    clearance_update = {
        f"clearance_status.{department}": {
            "cleared": cleared,
            "cleared_by": user["user_id"],
            "cleared_at": datetime.now(timezone.utc).isoformat(),
            "remarks": remarks
        }
    }
    
    await db.exit_requests.update_one(
        {"request_id": request_id},
        {"$set": clearance_update}
    )
    return {"message": f"{department} clearance updated"}


@router.put("/exit-requests/{request_id}/complete")
async def complete_exit(request_id: str, data: dict, request: Request):
    """Mark exit as complete"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    exit_req = await db.exit_requests.find_one({"request_id": request_id}, {"_id": 0})
    
    # Update exit request
    await db.exit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "exit_interview_notes": data.get("exit_interview_notes")
        }}
    )
    
    # Update employee status
    if exit_req:
        await db.employees.update_one(
            {"employee_id": exit_req["employee_id"]},
            {"$set": {
                "employment_status": "separated",
                "separation_date": exit_req.get("actual_last_day") or datetime.now(timezone.utc).date().isoformat(),
                "separation_reason": exit_req.get("reason_category")
            }}
        )
    
    return {"message": "Exit completed"}


@router.put("/exit-requests/{request_id}/withdraw")
async def withdraw_exit_request(request_id: str, request: Request):
    """Withdraw own exit request"""
    user = await get_current_user(request)
    
    exit_req = await db.exit_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not exit_req:
        raise HTTPException(status_code=404, detail="Exit request not found")
    
    if exit_req["employee_id"] != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if exit_req["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Cannot withdraw at this stage")
    
    await db.exit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "withdrawn",
            "withdrawn_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Exit request withdrawn"}
