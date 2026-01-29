"""SOP (Standard Operating Procedures) Management API Routes"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import base64
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/sop", tags=["SOP Management"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== SOP CRUD ====================

@router.get("/list")
async def list_sops(
    request: Request,
    department_id: Optional[str] = None,
    designation_id: Optional[str] = None,
    status: Optional[str] = None
):
    """List all SOPs with optional filters"""
    await get_current_user(request)  # Auth check
    
    query = {"is_active": True}
    if department_id:
        query["$or"] = [{"departments": department_id}, {"departments": {"$size": 0}}]
    if designation_id:
        query["$or"] = [{"designations": designation_id}, {"designations": {"$size": 0}}]
    if status:
        query["status"] = status
    
    sops = await db.sops.find(query, {"_id": 0, "file_data": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with department, designation, and employee names
    dept_ids = set()
    desig_ids = set()
    emp_ids = set()
    for sop in sops:
        dept_ids.update(sop.get("departments", []))
        desig_ids.update(sop.get("designations", []))
        emp_ids.update(sop.get("main_responsible", []))
        emp_ids.update(sop.get("also_involved", []))
    
    departments = await db.departments.find({"department_id": {"$in": list(dept_ids)}}, {"_id": 0}).to_list(100)
    designations = await db.designations.find({"designation_id": {"$in": list(desig_ids)}}, {"_id": 0}).to_list(100)
    employees = await db.employees.find(
        {"employee_id": {"$in": list(emp_ids)}},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "emp_code": 1}
    ).to_list(500)
    
    dept_map = {d["department_id"]: d["name"] for d in departments}
    desig_map = {d["designation_id"]: d["name"] for d in designations}
    emp_map = {e["employee_id"]: f"{e.get('first_name', '')} {e.get('last_name', '')}".strip() or e.get('emp_code', e['employee_id']) for e in employees}
    
    for sop in sops:
        sop["department_names"] = [dept_map.get(d, d) for d in sop.get("departments", [])]
        sop["designation_names"] = [desig_map.get(d, d) for d in sop.get("designations", [])]
        sop["main_responsible_names"] = [emp_map.get(e, e) for e in sop.get("main_responsible", [])]
        sop["also_involved_names"] = [emp_map.get(e, e) for e in sop.get("also_involved", [])]
    
    return sops


@router.get("/my-sops")
async def get_my_sops(request: Request):
    """Get SOPs applicable to the current user - split by main responsible and also involved"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return {"main_responsible": [], "also_involved": []}
    
    # Get employee's designation and department
    employee = await db.employees.find_one(
        {"employee_id": employee_id},
        {"_id": 0, "designation_id": 1, "department_id": 1}
    )
    
    designation_id = employee.get("designation_id") if employee else None
    department_id = employee.get("department_id") if employee else None
    
    # Find SOPs where user is main responsible
    main_responsible_sops = await db.sops.find(
        {
            "is_active": True,
            "status": "published",
            "main_responsible": employee_id
        },
        {"_id": 0, "file_data": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Find SOPs where user is also involved (directly or via designation/department)
    also_involved_query = {
        "is_active": True,
        "status": "published",
        "main_responsible": {"$ne": employee_id},  # Exclude ones where they're main responsible
        "$or": [
            {"also_involved": employee_id},  # Directly assigned
            {"designations": designation_id} if designation_id else {"_id": {"$exists": False}},
            {"departments": department_id} if department_id else {"_id": {"$exists": False}},
            {"designations": {"$size": 0}, "departments": {"$size": 0}, "also_involved": {"$size": 0}}  # For all
        ]
    }
    
    also_involved_sops = await db.sops.find(
        also_involved_query,
        {"_id": 0, "file_data": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "main_responsible": main_responsible_sops,
        "also_involved": also_involved_sops
    }


@router.post("/create")
async def create_sop(request: Request):
    """Create a new SOP with Excel file upload"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    form = await request.form()
    
    title = form.get("title")
    description = form.get("description", "")
    departments = form.getlist("departments") or []
    designations = form.getlist("designations") or []
    main_responsible = form.getlist("main_responsible") or []
    also_involved = form.getlist("also_involved") or []
    file = form.get("file")
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    sop_doc = {
        "sop_id": f"SOP-{uuid.uuid4().hex[:8].upper()}",
        "title": title,
        "description": description,
        "departments": departments if isinstance(departments, list) else [departments] if departments else [],
        "designations": designations if isinstance(designations, list) else [designations] if designations else [],
        "main_responsible": main_responsible if isinstance(main_responsible, list) else [main_responsible] if main_responsible else [],
        "also_involved": also_involved if isinstance(also_involved, list) else [also_involved] if also_involved else [],
        "status": "draft",
        "version": 1,
        "is_active": True,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Handle file upload
    if file:
        file_content = await file.read()
        sop_doc["file_name"] = file.filename
        sop_doc["file_data"] = base64.b64encode(file_content).decode('utf-8')
        sop_doc["file_type"] = file.content_type
        sop_doc["file_size"] = len(file_content)
        
        # Parse Excel to get preview data
        try:
            import io
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_content))
            ws = wb.active
            
            # Extract rows for preview (max 50 rows)
            preview_data = []
            for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if row_idx >= 50:
                    break
                preview_data.append([str(cell) if cell is not None else "" for cell in row])
            
            sop_doc["preview_data"] = preview_data
            sop_doc["total_rows"] = ws.max_row
            sop_doc["total_cols"] = ws.max_column
        except Exception as e:
            # If parsing fails, just store the file without preview
            sop_doc["preview_data"] = []
            sop_doc["parse_error"] = str(e)
    
    await db.sops.insert_one(sop_doc)
    sop_doc.pop("_id", None)
    sop_doc.pop("file_data", None)
    
    return sop_doc


@router.get("/{sop_id}")
async def get_sop(sop_id: str, request: Request):
    """Get SOP details"""
    await get_current_user(request)  # Auth check
    
    sop = await db.sops.find_one({"sop_id": sop_id}, {"_id": 0, "file_data": 0})
    if not sop:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    # Get department and designation names
    if sop.get("departments"):
        departments = await db.departments.find(
            {"department_id": {"$in": sop["departments"]}},
            {"_id": 0, "department_id": 1, "name": 1}
        ).to_list(50)
        sop["department_names"] = [d["name"] for d in departments]
    
    if sop.get("designations"):
        designations = await db.designations.find(
            {"designation_id": {"$in": sop["designations"]}},
            {"_id": 0, "designation_id": 1, "name": 1}
        ).to_list(50)
        sop["designation_names"] = [d["name"] for d in designations]
    
    return sop


@router.put("/{sop_id}")
async def update_sop(sop_id: str, request: Request):
    """Update SOP details"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    form = await request.form()
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["user_id"]
    }
    
    if form.get("title"):
        update_data["title"] = form.get("title")
    if form.get("description") is not None:
        update_data["description"] = form.get("description")
    if form.get("status"):
        update_data["status"] = form.get("status")
    
    departments = form.getlist("departments")
    if departments:
        update_data["departments"] = departments if isinstance(departments, list) else [departments]
    
    designations = form.getlist("designations")
    if designations:
        update_data["designations"] = designations if isinstance(designations, list) else [designations]
    
    # Handle new file upload
    file = form.get("file")
    if file and hasattr(file, 'read'):
        file_content = await file.read()
        update_data["file_name"] = file.filename
        update_data["file_data"] = base64.b64encode(file_content).decode('utf-8')
        update_data["file_type"] = file.content_type
        update_data["file_size"] = len(file_content)
        
        # Increment version
        existing = await db.sops.find_one({"sop_id": sop_id}, {"version": 1})
        update_data["version"] = (existing.get("version", 0) if existing else 0) + 1
        
        # Parse Excel for preview
        try:
            import io
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_content))
            ws = wb.active
            
            preview_data = []
            for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if row_idx >= 50:
                    break
                preview_data.append([str(cell) if cell is not None else "" for cell in row])
            
            update_data["preview_data"] = preview_data
            update_data["total_rows"] = ws.max_row
            update_data["total_cols"] = ws.max_column
        except Exception:
            pass
    
    result = await db.sops.update_one({"sop_id": sop_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    return {"message": "SOP updated"}


@router.put("/{sop_id}/publish")
async def publish_sop(sop_id: str, request: Request):
    """Publish a draft SOP and send notifications"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get SOP details for notification
    sop = await db.sops.find_one({"sop_id": sop_id}, {"_id": 0})
    if not sop:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    result = await db.sops.update_one(
        {"sop_id": sop_id},
        {"$set": {
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": user["user_id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    # Create notifications for all involved employees
    notification_recipients = set()
    notification_recipients.update(sop.get("main_responsible", []))
    notification_recipients.update(sop.get("also_involved", []))
    
    # Also notify employees in linked designations and departments
    if sop.get("designations"):
        employees_by_desig = await db.employees.find(
            {"designation_id": {"$in": sop["designations"]}, "is_active": True},
            {"_id": 0, "employee_id": 1}
        ).to_list(500)
        for emp in employees_by_desig:
            notification_recipients.add(emp["employee_id"])
    
    if sop.get("departments"):
        employees_by_dept = await db.employees.find(
            {"department_id": {"$in": sop["departments"]}, "is_active": True},
            {"_id": 0, "employee_id": 1}
        ).to_list(500)
        for emp in employees_by_dept:
            notification_recipients.add(emp["employee_id"])
    
    # Create notifications
    if notification_recipients:
        notifications = []
        for emp_id in notification_recipients:
            notifications.append({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": emp_id,
                "type": "sop_published",
                "title": "New SOP Published",
                "message": f"A new SOP '{sop['title']}' has been published that involves you.",
                "link": f"/dashboard/sop",
                "sop_id": sop_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if notifications:
            await db.notifications.insert_many(notifications)
    
    return {"message": "SOP published", "notifications_sent": len(notification_recipients)}


@router.delete("/{sop_id}")
async def delete_sop(sop_id: str, request: Request):
    """Soft delete an SOP"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.sops.update_one(
        {"sop_id": sop_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    return {"message": "SOP deleted"}


@router.get("/{sop_id}/download")
async def download_sop_file(sop_id: str, request: Request):
    """Download the SOP Excel file"""
    await get_current_user(request)  # Auth check
    
    sop = await db.sops.find_one({"sop_id": sop_id})
    if not sop:
        raise HTTPException(status_code=404, detail="SOP not found")
    
    if not sop.get("file_data"):
        raise HTTPException(status_code=404, detail="No file attached to this SOP")
    
    file_content = base64.b64decode(sop["file_data"])
    
    return Response(
        content=file_content,
        media_type=sop.get("file_type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        headers={
            "Content-Disposition": f"attachment; filename={sop.get('file_name', 'sop.xlsx')}"
        }
    )
