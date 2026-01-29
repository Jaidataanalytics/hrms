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
    
    # Enrich with department and designation names
    dept_ids = set()
    desig_ids = set()
    for sop in sops:
        dept_ids.update(sop.get("departments", []))
        desig_ids.update(sop.get("designations", []))
    
    departments = await db.departments.find({"department_id": {"$in": list(dept_ids)}}, {"_id": 0}).to_list(100)
    designations = await db.designations.find({"designation_id": {"$in": list(desig_ids)}}, {"_id": 0}).to_list(100)
    
    dept_map = {d["department_id"]: d["name"] for d in departments}
    desig_map = {d["designation_id"]: d["name"] for d in designations}
    
    for sop in sops:
        sop["department_names"] = [dept_map.get(d, d) for d in sop.get("departments", [])]
        sop["designation_names"] = [desig_map.get(d, d) for d in sop.get("designations", [])]
    
    return sops


@router.get("/my-sops")
async def get_my_sops(request: Request):
    """Get SOPs applicable to the current user based on their designation"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    # Get employee's designation and department
    employee = await db.employees.find_one(
        {"employee_id": employee_id},
        {"_id": 0, "designation_id": 1, "department_id": 1}
    )
    
    if not employee:
        return []
    
    designation_id = employee.get("designation_id")
    department_id = employee.get("department_id")
    
    # Find SOPs that match employee's designation or department, or are for all
    query = {
        "is_active": True,
        "status": "published",
        "$or": [
            {"designations": {"$size": 0}, "departments": {"$size": 0}},  # For all
            {"designations": designation_id} if designation_id else {"designations": {"$exists": False}},
            {"departments": department_id} if department_id else {"departments": {"$exists": False}}
        ]
    }
    
    sops = await db.sops.find(query, {"_id": 0, "file_data": 0}).sort("created_at", -1).to_list(50)
    return sops


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
    file = form.get("file")
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    sop_doc = {
        "sop_id": f"SOP-{uuid.uuid4().hex[:8].upper()}",
        "title": title,
        "description": description,
        "departments": departments if isinstance(departments, list) else [departments] if departments else [],
        "designations": designations if isinstance(designations, list) else [designations] if designations else [],
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
    """Publish a draft SOP"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    
    return {"message": "SOP published"}


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
    user = await get_current_user(request)
    
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
