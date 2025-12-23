"""Bulk Import API Routes"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import csv
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/import", tags=["Bulk Import"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== TEMPLATES ====================

@router.get("/templates/employees")
async def download_employee_template(request: Request):
    """Download employee import template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    headers = [
        "first_name", "last_name", "email", "phone", "date_of_birth", "gender",
        "address", "city", "state", "pincode",
        "department_code", "designation_code", "location_code",
        "employment_type", "joining_date", "reporting_manager_email"
    ]
    writer.writerow(headers)
    
    # Sample row
    sample = [
        "Rahul", "Sharma", "rahul.sharma@company.com", "+91 9876543210", "1990-05-15", "male",
        "123 Main Street", "Mumbai", "Maharashtra", "400001",
        "ENG", "SE", "HO-MUM",
        "management", "2024-01-15", "manager@company.com"
    ]
    writer.writerow(sample)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=employee_import_template.csv",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/templates/attendance")
async def download_attendance_template(request: Request):
    """Download attendance import template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = ["employee_id", "date", "first_in", "last_out", "status"]
    writer.writerow(headers)
    writer.writerow(["EMP000001", "2025-01-15", "09:00", "18:00", "present"])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=attendance_import_template.csv",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/templates/salary")
async def download_salary_template(request: Request):
    """Download salary import template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        "employee_id", "ctc", "basic", "hra", "special_allowance",
        "bank_name", "bank_account", "ifsc_code", "pan_number", "uan_number"
    ]
    writer.writerow(headers)
    writer.writerow([
        "EMP000001", "600000", "240000", "96000", "264000",
        "HDFC Bank", "1234567890", "HDFC0001234", "ABCDE1234F", "100123456789"
    ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=salary_import_template.csv"}
    )


# ==================== IMPORTS ====================

@router.post("/employees")
async def import_employees(request: Request, file: UploadFile = File(...)):
    """Bulk import employees from CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')  # Handle BOM
    reader = csv.DictReader(io.StringIO(decoded))
    
    # Get lookup data
    departments = {d["code"]: d["department_id"] for d in await db.departments.find({}, {"_id": 0}).to_list(100)}
    designations = {d["code"]: d["designation_id"] for d in await db.designations.find({}, {"_id": 0}).to_list(100)}
    locations = {l["code"]: l["location_id"] for l in await db.locations.find({}, {"_id": 0}).to_list(100)}
    
    imported = 0
    errors = []
    
    for idx, row in enumerate(reader, start=2):
        try:
            # Check required fields
            if not row.get("first_name") or not row.get("last_name") or not row.get("email"):
                errors.append({"row": idx, "error": "Missing required fields (first_name, last_name, email)"})
                continue
            
            # Check for duplicate email
            existing = await db.employees.find_one({"email": row["email"]})
            if existing:
                errors.append({"row": idx, "error": f"Email {row['email']} already exists"})
                continue
            
            employee = {
                "employee_id": f"EMP{uuid.uuid4().hex[:8].upper()}",
                "emp_code": f"EMP{str(imported + 1).zfill(5)}",
                "first_name": row["first_name"].strip(),
                "last_name": row["last_name"].strip(),
                "email": row["email"].strip().lower(),
                "phone": row.get("phone", "").strip() or None,
                "date_of_birth": row.get("date_of_birth", "").strip() or None,
                "gender": row.get("gender", "").strip().lower() or None,
                "address": row.get("address", "").strip() or None,
                "city": row.get("city", "").strip() or None,
                "state": row.get("state", "").strip() or None,
                "pincode": row.get("pincode", "").strip() or None,
                "department_id": departments.get(row.get("department_code", "").strip()),
                "designation_id": designations.get(row.get("designation_code", "").strip()),
                "location_id": locations.get(row.get("location_code", "").strip()),
                "employment_type": row.get("employment_type", "management").strip().lower(),
                "joining_date": row.get("joining_date", "").strip() or None,
                "status": "active",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.employees.insert_one(employee)
            imported += 1
            
        except Exception as e:
            errors.append({"row": idx, "error": str(e)})
    
    # Log the import
    await db.audit_logs.insert_one({
        "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
        "action": "BULK_IMPORT",
        "module": "employee",
        "entity_type": "employee",
        "entity_id": "bulk",
        "user_id": user["user_id"],
        "user_name": user.get("name", ""),
        "new_value": {"imported": imported, "errors": len(errors)},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Import completed",
        "imported": imported,
        "errors": errors,
        "total_rows": imported + len(errors)
    }


@router.post("/attendance")
async def import_attendance(request: Request, file: UploadFile = File(...)):
    """Bulk import attendance from CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    
    for idx, row in enumerate(reader, start=2):
        try:
            employee_id = row.get("employee_id", "").strip()
            date = row.get("date", "").strip()
            
            if not employee_id or not date:
                errors.append({"row": idx, "error": "Missing employee_id or date"})
                continue
            
            # Verify employee exists
            employee = await db.employees.find_one({"employee_id": employee_id})
            if not employee:
                errors.append({"row": idx, "error": f"Employee {employee_id} not found"})
                continue
            
            attendance = {
                "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
                "employee_id": employee_id,
                "date": date,
                "first_in": row.get("first_in", "").strip() or None,
                "last_out": row.get("last_out", "").strip() or None,
                "status": row.get("status", "present").strip().lower(),
                "punches": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Calculate total hours
            if attendance["first_in"] and attendance["last_out"]:
                try:
                    from datetime import datetime as dt
                    t1 = dt.strptime(attendance["first_in"], "%H:%M")
                    t2 = dt.strptime(attendance["last_out"], "%H:%M")
                    attendance["total_hours"] = round((t2 - t1).seconds / 3600, 2)
                except:
                    pass
            
            # Upsert attendance
            await db.attendance.update_one(
                {"employee_id": employee_id, "date": date},
                {"$set": attendance},
                upsert=True
            )
            imported += 1
            
        except Exception as e:
            errors.append({"row": idx, "error": str(e)})
    
    return {
        "message": f"Import completed",
        "imported": imported,
        "errors": errors,
        "total_rows": imported + len(errors)
    }


@router.post("/salary")
async def import_salary(request: Request, file: UploadFile = File(...)):
    """Bulk import salary structures from CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    
    for idx, row in enumerate(reader, start=2):
        try:
            employee_id = row.get("employee_id", "").strip()
            
            if not employee_id:
                errors.append({"row": idx, "error": "Missing employee_id"})
                continue
            
            # Verify employee exists
            employee = await db.employees.find_one({"employee_id": employee_id})
            if not employee:
                errors.append({"row": idx, "error": f"Employee {employee_id} not found"})
                continue
            
            ctc = float(row.get("ctc", 0) or 0)
            basic = float(row.get("basic", ctc * 0.5) or ctc * 0.5)
            hra = float(row.get("hra", basic * 0.4) or basic * 0.4)
            special = float(row.get("special_allowance", ctc - basic - hra) or ctc - basic - hra)
            
            salary = {
                "salary_id": f"sal_{uuid.uuid4().hex[:12]}",
                "employee_id": employee_id,
                "effective_from": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "ctc": ctc,
                "gross": ctc / 12,  # Monthly gross
                "components": [
                    {"name": "Basic", "code": "BASIC", "amount": basic / 12},
                    {"name": "HRA", "code": "HRA", "amount": hra / 12},
                    {"name": "Special Allowance", "code": "SA", "amount": special / 12}
                ],
                "bank_name": row.get("bank_name", "").strip() or None,
                "bank_account": row.get("bank_account", "").strip() or None,
                "ifsc_code": row.get("ifsc_code", "").strip() or None,
                "pan_number": row.get("pan_number", "").strip() or None,
                "uan_number": row.get("uan_number", "").strip() or None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Deactivate existing
            await db.employee_salaries.update_many(
                {"employee_id": employee_id, "is_active": True},
                {"$set": {"is_active": False}}
            )
            
            await db.employee_salaries.insert_one(salary)
            imported += 1
            
        except Exception as e:
            errors.append({"row": idx, "error": str(e)})
    
    return {
        "message": f"Import completed",
        "imported": imported,
        "errors": errors,
        "total_rows": imported + len(errors)
    }


# ==================== EXPORT ====================

@router.get("/export/employees")
async def export_employees(request: Request):
    """Export all employees to CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find({"is_active": True}, {"_id": 0}).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        "employee_id", "emp_code", "first_name", "last_name", "email", "phone",
        "date_of_birth", "gender", "address", "city", "state", "pincode",
        "department_id", "designation_id", "location_id",
        "employment_type", "joining_date", "status"
    ]
    writer.writerow(headers)
    
    for emp in employees:
        writer.writerow([emp.get(h, "") for h in headers])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=employees_export_{datetime.now().strftime('%Y%m%d')}.csv",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/export/attendance")
async def export_attendance(request: Request):
    """Export attendance records to CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get last 30 days of attendance
    from datetime import timedelta
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find(
        {"date": {"$gte": thirty_days_ago}}, 
        {"_id": 0}
    ).to_list(50000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = ["employee_id", "date", "first_in", "last_out", "status", "total_hours", "is_late", "remarks"]
    writer.writerow(headers)
    
    for record in attendance:
        writer.writerow([record.get(h, "") for h in headers])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=attendance_export_{datetime.now().strftime('%Y%m%d')}.csv",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/export/salary")
async def export_salary(request: Request):
    """Export salary structures to CSV"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find({"is_active": True}, {"_id": 0}).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        "employee_id", "emp_code", "first_name", "last_name",
        "ctc", "basic_salary", "hra", "special_allowance",
        "bank_name", "bank_account_number", "ifsc_code", "pan_number", "uan_number"
    ]
    writer.writerow(headers)
    
    for emp in employees:
        salary = emp.get("salary_info", {})
        bank = emp.get("bank_details", {})
        writer.writerow([
            emp.get("employee_id", ""),
            emp.get("emp_code", ""),
            emp.get("first_name", ""),
            emp.get("last_name", ""),
            salary.get("ctc", ""),
            salary.get("basic_salary", salary.get("basic", "")),
            salary.get("hra", ""),
            salary.get("special_allowance", ""),
            bank.get("bank_name", ""),
            bank.get("account_number", bank.get("bank_account", "")),
            bank.get("ifsc_code", ""),
            bank.get("pan_number", emp.get("pan_number", "")),
            bank.get("uan_number", emp.get("uan_number", ""))
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=salary_export_{datetime.now().strftime('%Y%m%d')}.csv",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
