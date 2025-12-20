"""Performance & KPI API Routes"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
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
    data.pop('_id', None)
    return data


@router.post("/templates/upload")
async def upload_kpi_template(request: Request, file: UploadFile = File(...)):
    """Upload KPI template from Excel file"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Read file content
    content = await file.read()
    
    try:
        import pandas as pd
        
        # Read Excel/CSV file
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Expected columns: Question/KPI Name, Description, Max Points, Category (optional)
        questions = []
        for idx, row in df.iterrows():
            question = {
                "question_id": f"q_{uuid.uuid4().hex[:8]}",
                "question": str(row.iloc[0]) if pd.notna(row.iloc[0]) else f"Question {idx+1}",
                "description": str(row.iloc[1]) if len(row) > 1 and pd.notna(row.iloc[1]) else "",
                "max_points": int(row.iloc[2]) if len(row) > 2 and pd.notna(row.iloc[2]) else 10,
                "category": str(row.iloc[3]) if len(row) > 3 and pd.notna(row.iloc[3]) else "General",
                "weightage": 1
            }
            questions.append(question)
        
        # Create template
        template_name = file.filename.rsplit('.', 1)[0]
        total_points = sum(q["max_points"] * q["weightage"] for q in questions)
        
        template_data = {
            "template_id": f"kpi_{uuid.uuid4().hex[:12]}",
            "name": template_name,
            "description": f"Imported from {file.filename}",
            "questions": questions,
            "total_points": total_points,
            "uploaded_from_excel": True,
            "original_filename": file.filename,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.get("user_id"),
            "is_active": True
        }
        
        await db.kpi_templates.insert_one(template_data)
        template_data.pop('_id', None)
        
        return {
            "message": f"Template created with {len(questions)} questions",
            "template": template_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


@router.get("/templates/sample")
async def download_sample_template(request: Request):
    """Download sample KPI template Excel file"""
    await get_current_user(request)
    
    try:
        import pandas as pd
        
        # Create sample data
        sample_data = {
            "KPI Name": [
                "Project Delivery",
                "Code Quality",
                "Team Collaboration",
                "Communication Skills",
                "Initiative & Innovation"
            ],
            "Description": [
                "Timely delivery of assigned projects",
                "Code review scores and bug count",
                "Contribution to team activities",
                "Clear and effective communication",
                "New ideas and process improvements"
            ],
            "Max Points": [20, 20, 20, 20, 20],
            "Category": ["Delivery", "Technical", "Teamwork", "Soft Skills", "Growth"]
        }
        
        df = pd.DataFrame(sample_data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='KPI Template')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=kpi_template_sample.xlsx"}
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel export not available. Install openpyxl.")


@router.get("/templates/{template_id}/download")
async def download_template(template_id: str, request: Request):
    """Download KPI template as Excel"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template = await db.kpi_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        import pandas as pd
        
        # Create dataframe from questions
        questions = template.get("questions", [])
        data = {
            "KPI Name": [q.get("question", "") for q in questions],
            "Description": [q.get("description", "") for q in questions],
            "Max Points": [q.get("max_points", 10) for q in questions],
            "Category": [q.get("category", "General") for q in questions]
        }
        
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='KPI Template')
        output.seek(0)
        
        filename = f"{template.get('name', 'template')}.xlsx".replace(' ', '_')
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel export not available")


@router.delete("/templates/{template_id}")
async def delete_kpi_template(template_id: str, request: Request):
    """Delete KPI template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.kpi_templates.delete_one({"template_id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted successfully"}


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
    data.pop('_id', None)
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


# ==================== TEAM PERFORMANCE (HR/Manager View) ====================

@router.get("/team-performance")
async def get_team_performance(
    request: Request,
    department: Optional[str] = None,
    status: Optional[str] = None
):
    """Get performance history for all employees (HR/Manager only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized - HR/Manager only")
    
    # Get all employees
    emp_query = {}
    if department:
        emp_query["department"] = department
    
    employees = await db.employees.find(emp_query, {"_id": 0}).to_list(500)
    
    # Get all KPIs
    kpi_query = {}
    if status:
        kpi_query["status"] = status
    
    all_kpis = await db.employee_kpis.find(kpi_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Group KPIs by employee
    employee_kpis = {}
    for kpi in all_kpis:
        emp_id = kpi.get("employee_id")
        if emp_id not in employee_kpis:
            employee_kpis[emp_id] = []
        employee_kpis[emp_id].append(kpi)
    
    # Build response with employee details and their KPIs
    result = []
    for emp in employees:
        emp_id = emp.get("employee_id")
        kpis = employee_kpis.get(emp_id, [])
        
        # Calculate average score for completed KPIs
        completed_kpis = [k for k in kpis if k.get("status") == "approved" and k.get("final_score")]
        avg_score = sum(k["final_score"] for k in completed_kpis) / len(completed_kpis) if completed_kpis else None
        
        result.append({
            "employee_id": emp_id,
            "employee_name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "employee_code": emp.get("employee_code", emp_id),
            "department": emp.get("department", ""),
            "designation": emp.get("designation", ""),
            "total_kpis": len(kpis),
            "pending_kpis": len([k for k in kpis if k.get("status") in ["draft", "submitted", "under_review"]]),
            "approved_kpis": len([k for k in kpis if k.get("status") == "approved"]),
            "average_score": round(avg_score, 1) if avg_score else None,
            "kpis": kpis[:10]  # Return last 10 KPIs for each employee
        })
    
    # Sort by average score (descending), then by name
    result.sort(key=lambda x: (-(x["average_score"] or 0), x["employee_name"]))
    
    return result


@router.get("/employee-performance/{employee_id}")
async def get_employee_performance_history(employee_id: str, request: Request):
    """Get detailed performance history for a specific employee (HR/Manager only)"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized - HR/Manager only")
    
    # Get employee details
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get all KPIs for this employee
    kpis = await db.employee_kpis.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get all goals for this employee
    goals = await db.employee_goals.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate statistics
    completed_kpis = [k for k in kpis if k.get("status") == "approved" and k.get("final_score")]
    avg_score = sum(k["final_score"] for k in completed_kpis) / len(completed_kpis) if completed_kpis else None
    
    # Get score trend (last 6 approved KPIs)
    score_trend = [{"period": k.get("period_type"), "score": k.get("final_score"), "date": k.get("reviewed_at") or k.get("created_at")} 
                   for k in completed_kpis[:6]]
    score_trend.reverse()  # Oldest first for trend
    
    return {
        "employee": {
            "employee_id": employee_id,
            "name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
            "employee_code": employee.get("employee_code", employee_id),
            "department": employee.get("department", ""),
            "designation": employee.get("designation", ""),
            "email": employee.get("email", ""),
            "join_date": employee.get("join_date", "")
        },
        "statistics": {
            "total_kpis": len(kpis),
            "approved_kpis": len(completed_kpis),
            "pending_kpis": len([k for k in kpis if k.get("status") in ["draft", "submitted", "under_review"]]),
            "average_score": round(avg_score, 1) if avg_score else None,
            "highest_score": max([k.get("final_score", 0) for k in completed_kpis]) if completed_kpis else None,
            "lowest_score": min([k.get("final_score", 0) for k in completed_kpis]) if completed_kpis else None,
            "total_goals": len(goals),
            "completed_goals": len([g for g in goals if g.get("status") == "completed"])
        },
        "score_trend": score_trend,
        "kpis": kpis,
        "goals": goals
    }


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
    data.pop('_id', None)
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
