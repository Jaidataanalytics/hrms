"""Payroll API Routes"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/payroll", tags=["Payroll"])

# Get DB from environment
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    """Get current user from session"""
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== SALARY COMPONENTS ====================

@router.get("/components")
async def list_salary_components(request: Request):
    """List all salary components"""
    await get_current_user(request)
    components = await db.salary_components.find({"is_active": True}, {"_id": 0}).to_list(100)
    return components


@router.post("/components")
async def create_salary_component(data: dict, request: Request):
    """Create salary component"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["component_id"] = f"comp_{uuid.uuid4().hex[:12]}"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["is_active"] = True
    
    await db.salary_components.insert_one(data)
    data.pop('_id', None)
    return data


# ==================== SALARY TEMPLATES ====================

@router.get("/templates")
async def list_salary_templates(request: Request):
    """List salary templates"""
    await get_current_user(request)
    templates = await db.salary_templates.find({"is_active": True}, {"_id": 0}).to_list(50)
    return templates


@router.post("/templates")
async def create_salary_template(data: dict, request: Request):
    """Create salary template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["template_id"] = f"tmpl_{uuid.uuid4().hex[:12]}"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["is_active"] = True
    
    await db.salary_templates.insert_one(data)
    data.pop('_id', None)
    return data


# ==================== EMPLOYEE SALARY ====================

@router.get("/employee/{employee_id}")
async def get_employee_salary(employee_id: str, request: Request):
    """Get employee salary structure"""
    user = await get_current_user(request)
    
    # Check permission
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        if user.get("employee_id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.employee_salaries.find_one(
        {"employee_id": employee_id, "is_active": True}, {"_id": 0}
    )
    return salary


@router.post("/employee/{employee_id}")
async def assign_employee_salary(employee_id: str, data: dict, request: Request):
    """Assign salary structure to employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Deactivate existing salary
    await db.employee_salaries.update_many(
        {"employee_id": employee_id, "is_active": True},
        {"$set": {"is_active": False, "effective_to": data.get("effective_from")}}
    )
    
    data["salary_id"] = f"sal_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = employee_id
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["is_active"] = True
    
    await db.employee_salaries.insert_one(data)
    data.pop('_id', None)
    return data


# ==================== PAYROLL RUN ====================

@router.get("/runs")
async def list_payroll_runs(request: Request, year: Optional[int] = None):
    """List payroll runs"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if year:
        query["year"] = year
    
    runs = await db.payroll_runs.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(24)
    return runs


@router.post("/runs")
async def create_payroll_run(month: int, year: int, request: Request):
    """Initialize payroll run for a month"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if already exists
    existing = await db.payroll_runs.find_one({"month": month, "year": year})
    if existing:
        raise HTTPException(status_code=400, detail="Payroll run already exists for this month")
    
    payroll_run = {
        "payroll_id": f"pr_{uuid.uuid4().hex[:12]}",
        "month": month,
        "year": year,
        "status": "draft",
        "total_employees": 0,
        "total_gross": 0,
        "total_deductions": 0,
        "total_net": 0,
        "total_pf": 0,
        "total_esi": 0,
        "total_pt": 0,
        "total_tds": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payroll_runs.insert_one(payroll_run)
    payroll_run.pop('_id', None)
    return payroll_run


@router.post("/runs/{payroll_id}/process")
async def process_payroll(payroll_id: str, request: Request):
    """Process payroll - calculate all payslips"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payroll = await db.payroll_runs.find_one({"payroll_id": payroll_id}, {"_id": 0})
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    
    if payroll["status"] == "locked":
        raise HTTPException(status_code=400, detail="Payroll is locked")
    
    month, year = payroll["month"], payroll["year"]
    
    # Get payroll config
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    if not config:
        config = {
            "pf_employee_rate": 12.0,
            "pf_employer_rate": 12.0,
            "pf_wage_ceiling": 15000,
            "esi_employee_rate": 0.75,
            "esi_employer_rate": 3.25,
            "esi_wage_ceiling": 21000,
            "pt_slabs": [
                {"min": 0, "max": 10000, "amount": 0},
                {"min": 10001, "max": 15000, "amount": 150},
                {"min": 15001, "max": 999999999, "amount": 200}
            ]
        }
    
    # Get all active employees with salary
    employees_with_salary = await db.employee_salaries.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(1000)
    
    total_gross = 0
    total_deductions = 0
    total_net = 0
    total_pf = 0
    total_esi = 0
    total_pt = 0
    payslips_created = 0
    
    for emp_salary in employees_with_salary:
        employee_id = emp_salary["employee_id"]
        
        # Get attendance for the month
        month_str = f"{year}-{str(month).zfill(2)}"
        attendance = await db.attendance.find(
            {"employee_id": employee_id, "date": {"$regex": f"^{month_str}"}}
        ).to_list(31)
        
        working_days = 26  # Default working days
        present_days = len([a for a in attendance if a.get("status") in ["present", "wfh", "tour"]])
        
        # Get leave deductions
        lwp_days = 0
        leaves = await db.leave_requests.find({
            "employee_id": employee_id,
            "status": "approved",
            "from_date": {"$regex": f"^{month_str}"}
        }).to_list(10)
        
        for leave in leaves:
            leave_type = await db.leave_types.find_one({"leave_type_id": leave["leave_type_id"]}, {"_id": 0})
            if leave_type and leave_type.get("code") == "LWP":
                lwp_days += leave.get("days", 0)
        
        paid_days = working_days - lwp_days
        
        # Calculate salary
        gross = emp_salary.get("gross", 0)
        basic = emp_salary.get("components", [{}])[0].get("amount", gross * 0.5) if emp_salary.get("components") else gross * 0.5
        
        # Pro-rate for attendance
        daily_rate = gross / working_days
        prorated_gross = daily_rate * paid_days
        prorated_basic = (basic / working_days) * paid_days
        
        # Calculate PF (on basic, max 15000)
        pf_basic = min(prorated_basic, config.get("pf_wage_ceiling", 15000))
        pf_employee = round(pf_basic * config.get("pf_employee_rate", 12) / 100, 0)
        pf_employer = round(pf_basic * config.get("pf_employer_rate", 12) / 100, 0)
        
        # Calculate ESI (if gross < ceiling)
        esi_employee = 0
        esi_employer = 0
        if prorated_gross <= config.get("esi_wage_ceiling", 21000):
            esi_employee = round(prorated_gross * config.get("esi_employee_rate", 0.75) / 100, 0)
            esi_employer = round(prorated_gross * config.get("esi_employer_rate", 3.25) / 100, 0)
        
        # Calculate PT
        pt = 0
        for slab in config.get("pt_slabs", []):
            if slab["min"] <= prorated_gross <= slab["max"]:
                pt = slab["amount"]
                break
        
        # Calculate deductions
        total_ded = pf_employee + esi_employee + pt
        net = prorated_gross - total_ded
        
        # Create payslip
        payslip = {
            "payslip_id": f"ps_{uuid.uuid4().hex[:12]}",
            "payroll_id": payroll_id,
            "employee_id": employee_id,
            "month": month,
            "year": year,
            "working_days": working_days,
            "present_days": present_days,
            "lwp_days": lwp_days,
            "paid_days": paid_days,
            "basic": round(prorated_basic, 0),
            "hra": round(prorated_basic * 0.4, 0),
            "special_allowance": round(prorated_gross - prorated_basic - prorated_basic * 0.4, 0),
            "gross_salary": round(prorated_gross, 0),
            "pf_employee": pf_employee,
            "pf_employer": pf_employer,
            "esi_employee": esi_employee,
            "esi_employer": esi_employer,
            "professional_tax": pt,
            "total_deductions": round(total_ded, 0),
            "net_salary": round(net, 0),
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert payslip
        await db.payslips.update_one(
            {"employee_id": employee_id, "month": month, "year": year},
            {"$set": payslip},
            upsert=True
        )
        
        total_gross += prorated_gross
        total_deductions += total_ded
        total_net += net
        total_pf += pf_employee
        total_esi += esi_employee
        total_pt += pt
        payslips_created += 1
    
    # Update payroll run
    await db.payroll_runs.update_one(
        {"payroll_id": payroll_id},
        {"$set": {
            "status": "processed",
            "total_employees": payslips_created,
            "total_gross": round(total_gross, 0),
            "total_deductions": round(total_deductions, 0),
            "total_net": round(total_net, 0),
            "total_pf": round(total_pf, 0),
            "total_esi": round(total_esi, 0),
            "total_pt": round(total_pt, 0),
            "processed_by": user["user_id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Processed {payslips_created} payslips", "payroll_id": payroll_id}


@router.post("/runs/{payroll_id}/lock")
async def lock_payroll(payroll_id: str, request: Request):
    """Lock payroll after verification"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.payroll_runs.update_one(
        {"payroll_id": payroll_id},
        {"$set": {
            "status": "locked",
            "locked_by": user["user_id"],
            "locked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payroll locked successfully"}


# ==================== PAYSLIPS ====================

@router.get("/payslips")
async def list_payslips(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[str] = None
):
    """List payslips"""
    user = await get_current_user(request)
    
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    # Regular employees can only see their own
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    payslips = await db.payslips.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(100)
    return payslips


@router.get("/payslips/{payslip_id}")
async def get_payslip(payslip_id: str, request: Request):
    """Get single payslip"""
    user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        if payslip["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get employee details
    employee = await db.employees.find_one({"employee_id": payslip["employee_id"]}, {"_id": 0})
    payslip["employee"] = employee
    
    return payslip


@router.get("/my-payslips")
async def get_my_payslips(request: Request):
    """Get current user's payslips"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    payslips = await db.payslips.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(24)
    
    return payslips


# ==================== PAYROLL CONFIG ====================

@router.get("/config")
async def get_payroll_config(request: Request):
    """Get payroll configuration"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    return config


@router.post("/config")
async def update_payroll_config(data: dict, request: Request):
    """Update payroll configuration"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["config_id"] = f"cfg_{uuid.uuid4().hex[:12]}"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["is_active"] = True
    
    # Deactivate old config
    await db.payroll_config.update_many({}, {"$set": {"is_active": False}})
    
    await db.payroll_config.insert_one(data)
    return data
