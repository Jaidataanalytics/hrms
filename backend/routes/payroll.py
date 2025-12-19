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


# ==================== ALL EMPLOYEES PAY INFO (HR/Admin only) ====================

@router.get("/all-employees-pay")
async def get_all_employees_pay_info(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get pay info for all employees (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized - HR/Admin only")
    
    # Default to current month/year if not provided
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    # Get all payslips for the month
    payslips = await db.payslips.find(
        {"month": month, "year": year}, {"_id": 0}
    ).to_list(1000)
    
    # Enrich with employee details
    enriched_payslips = []
    for slip in payslips:
        employee = await db.employees.find_one(
            {"employee_id": slip["employee_id"]}, {"_id": 0}
        )
        if employee:
            slip["employee_name"] = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            slip["employee_code"] = employee.get("employee_code", slip["employee_id"])
            slip["department"] = employee.get("department", "")
            slip["designation"] = employee.get("designation", "")
        enriched_payslips.append(slip)
    
    return enriched_payslips


@router.get("/employee-salary-details/{employee_id}")
async def get_employee_salary_details(employee_id: str, request: Request):
    """Get detailed salary info for an employee (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized - HR/Admin only")
    
    # Get employee
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get salary structure
    salary = await db.employee_salaries.find_one(
        {"employee_id": employee_id, "is_active": True}, {"_id": 0}
    )
    
    # Get recent payslips (last 12 months)
    payslips = await db.payslips.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(12)
    
    return {
        "employee": employee,
        "salary_structure": salary,
        "payslips": payslips
    }


@router.get("/employee-breakdown/{employee_id}")
async def get_employee_salary_breakdown(
    employee_id: str, 
    month: int, 
    year: int,
    request: Request
):
    """Get detailed salary breakdown for an employee for a specific month"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized - HR/Admin only")
    
    # Get employee
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get payslip for this month
    payslip = await db.payslips.find_one(
        {"employee_id": employee_id, "month": month, "year": year}, {"_id": 0}
    )
    
    # Get salary structure
    salary_structure = await db.employee_salaries.find_one(
        {"employee_id": employee_id, "is_active": True}, {"_id": 0}
    )
    
    # Get attendance records for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    attendance_records = await db.attendance.find({
        "employee_id": employee_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(31)
    
    # Analyze attendance
    present_days = len([a for a in attendance_records if a.get("status") == "present"])
    absent_days = len([a for a in attendance_records if a.get("status") == "absent"])
    half_days = len([a for a in attendance_records if a.get("status") == "half_day"])
    late_arrivals = len([a for a in attendance_records if a.get("is_late")])
    early_departures = len([a for a in attendance_records if a.get("is_early_departure")])
    
    # Get leave records for the month
    leave_records = await db.leave_requests.find({
        "employee_id": employee_id,
        "status": "approved",
        "$or": [
            {"start_date": {"$gte": start_date, "$lt": end_date}},
            {"end_date": {"$gte": start_date, "$lt": end_date}}
        ]
    }, {"_id": 0}).to_list(20)
    
    # Categorize leaves
    paid_leave_days = 0
    unpaid_leave_days = 0
    leave_breakdown = []
    
    for leave in leave_records:
        leave_type = await db.leave_types.find_one(
            {"leave_type_id": leave.get("leave_type_id")}, {"_id": 0}
        )
        days = leave.get("total_days", 1)
        leave_info = {
            "leave_type": leave_type.get("name") if leave_type else "Unknown",
            "start_date": leave.get("start_date"),
            "end_date": leave.get("end_date"),
            "days": days,
            "is_paid": leave_type.get("is_paid", False) if leave_type else False
        }
        leave_breakdown.append(leave_info)
        
        if leave_type and leave_type.get("is_paid", False):
            paid_leave_days += days
        else:
            unpaid_leave_days += days
    
    # Get payroll config for rules
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    working_days = config.get("working_days_per_month", 26) if config else 26
    
    # Calculate deductions breakdown
    gross_salary = payslip.get("gross_salary", 0) if payslip else (salary_structure.get("gross", 0) if salary_structure else 0)
    per_day_salary = gross_salary / working_days if working_days > 0 else 0
    
    deductions_breakdown = {
        "statutory": {
            "pf_employee": payslip.get("pf_employee", 0) if payslip else 0,
            "esi_employee": payslip.get("esi_employee", 0) if payslip else 0,
            "professional_tax": payslip.get("professional_tax", 0) if payslip else 0,
            "tds": payslip.get("tds", 0) if payslip else 0,
        },
        "attendance_based": {
            "lwp_deduction": (unpaid_leave_days * per_day_salary) if unpaid_leave_days > 0 else 0,
            "absent_deduction": (absent_days * per_day_salary) if absent_days > 0 else 0,
            "half_day_deduction": (half_days * per_day_salary * 0.5) if half_days > 0 else 0,
        },
        "other": payslip.get("other_deductions", 0) if payslip else 0
    }
    
    earnings_breakdown = {
        "basic": payslip.get("basic", 0) if payslip else 0,
        "hra": payslip.get("hra", 0) if payslip else 0,
        "special_allowance": payslip.get("special_allowance", 0) if payslip else 0,
        "conveyance": payslip.get("conveyance", 0) if payslip else 0,
        "medical": payslip.get("medical", 0) if payslip else 0,
        "overtime": payslip.get("overtime_pay", 0) if payslip else 0,
        "bonus": payslip.get("bonus", 0) if payslip else 0,
    }
    
    return {
        "employee": {
            "employee_id": employee_id,
            "name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
            "employee_code": employee.get("employee_code", employee_id),
            "department": employee.get("department", ""),
            "designation": employee.get("designation", "")
        },
        "period": {
            "month": month,
            "year": year,
            "working_days": working_days
        },
        "attendance_summary": {
            "present_days": present_days,
            "absent_days": absent_days,
            "half_days": half_days,
            "late_arrivals": late_arrivals,
            "early_departures": early_departures,
            "paid_leave_days": paid_leave_days,
            "unpaid_leave_days": unpaid_leave_days,
            "effective_working_days": present_days + half_days * 0.5 + paid_leave_days
        },
        "leave_breakdown": leave_breakdown,
        "earnings_breakdown": earnings_breakdown,
        "deductions_breakdown": deductions_breakdown,
        "totals": {
            "gross_salary": payslip.get("gross_salary", 0) if payslip else gross_salary,
            "total_earnings": sum(earnings_breakdown.values()),
            "total_statutory_deductions": sum(deductions_breakdown["statutory"].values()),
            "total_attendance_deductions": sum(deductions_breakdown["attendance_based"].values()),
            "total_deductions": payslip.get("total_deductions", 0) if payslip else 0,
            "net_salary": payslip.get("net_salary", 0) if payslip else 0
        }
    }


# ==================== PAYROLL CONFIG & RULES ====================

def get_default_payroll_rules():
    """Return default payroll rules configuration"""
    return {
        # General Settings
        "working_days_per_month": 26,
        "pay_cycle": "monthly",  # monthly, bi-weekly, weekly
        "salary_credit_day": 1,  # Day of month for salary credit
        
        # Attendance Rules
        "attendance_rules": {
            "grace_period_minutes": 15,  # Minutes allowed after shift start
            "late_coming_deduction": {
                "enabled": True,
                "occurrences_before_deduction": 3,  # Free late comings per month
                "deduction_type": "half_day",  # half_day, hourly, fixed
                "deduction_amount": 0,  # Used if deduction_type is "fixed"
            },
            "early_leaving_deduction": {
                "enabled": True,
                "min_early_minutes": 30,  # Minutes early to count as early leaving
                "deduction_type": "half_day",
            },
            "half_day_rules": {
                "min_hours_for_full_day": 8,
                "min_hours_for_half_day": 4,
                "half_day_deduction_percent": 50,  # Percentage of daily wage deducted
            },
            "absent_deduction": {
                "deduction_type": "full_day",  # full_day, 1.5_day, 2_day
                "multiplier": 1.0,  # 1.0 = 1 day, 1.5 = 1.5 days, 2.0 = 2 days
            },
        },
        
        # Leave Rules for Payroll
        "leave_rules": {
            "CL": {"is_paid": True, "deduction_percent": 0},  # Casual Leave
            "SL": {"is_paid": True, "deduction_percent": 0},  # Sick Leave
            "EL": {"is_paid": True, "deduction_percent": 0},  # Earned Leave
            "PL": {"is_paid": True, "deduction_percent": 0},  # Privilege Leave
            "ML": {"is_paid": True, "deduction_percent": 0},  # Maternity Leave
            "PTL": {"is_paid": True, "deduction_percent": 0},  # Paternity Leave
            "CO": {"is_paid": True, "deduction_percent": 0},  # Compensatory Off
            "LWP": {"is_paid": False, "deduction_percent": 100},  # Leave Without Pay
            "default": {"is_paid": False, "deduction_percent": 100},
        },
        
        # Overtime Rules
        "overtime_rules": {
            "enabled": True,
            "min_hours_for_ot": 1,  # Minimum OT hours to qualify
            "weekday_multiplier": 1.5,  # 1.5x for weekday OT
            "weekend_multiplier": 2.0,  # 2x for weekend OT
            "holiday_multiplier": 2.5,  # 2.5x for holiday OT
            "max_ot_hours_per_day": 4,
            "max_ot_hours_per_month": 50,
        },
        
        # PF (Provident Fund) Configuration
        "pf_rules": {
            "enabled": True,
            "employee_contribution_percent": 12.0,
            "employer_contribution_percent": 12.0,
            "wage_ceiling": 15000,  # Max basic for PF calculation
            "include_basic_only": True,  # PF on basic only or gross
            "admin_charges_percent": 0.5,
            "edli_charges_percent": 0.5,
        },
        
        # ESI (Employee State Insurance) Configuration
        "esi_rules": {
            "enabled": True,
            "employee_contribution_percent": 0.75,
            "employer_contribution_percent": 3.25,
            "wage_ceiling": 21000,  # Max gross for ESI eligibility
        },
        
        # Professional Tax Slabs
        "pt_rules": {
            "enabled": True,
            "state": "Maharashtra",  # State for PT calculation
            "slabs": [
                {"min": 0, "max": 10000, "amount": 0},
                {"min": 10001, "max": 15000, "amount": 150},
                {"min": 15001, "max": 999999999, "amount": 200},
            ],
        },
        
        # TDS (Tax Deducted at Source) Rules
        "tds_rules": {
            "enabled": True,
            "standard_deduction": 50000,
            "tax_slabs_old_regime": [
                {"min": 0, "max": 250000, "rate": 0},
                {"min": 250001, "max": 500000, "rate": 5},
                {"min": 500001, "max": 1000000, "rate": 20},
                {"min": 1000001, "max": 999999999, "rate": 30},
            ],
            "tax_slabs_new_regime": [
                {"min": 0, "max": 300000, "rate": 0},
                {"min": 300001, "max": 600000, "rate": 5},
                {"min": 600001, "max": 900000, "rate": 10},
                {"min": 900001, "max": 1200000, "rate": 15},
                {"min": 1200001, "max": 1500000, "rate": 20},
                {"min": 1500001, "max": 999999999, "rate": 30},
            ],
            "cess_percent": 4,
            "rebate_limit": 500000,
        },
        
        # Salary Components Rules
        "salary_components": {
            "basic_percent_of_ctc": 40,  # Basic as % of CTC
            "hra_percent_of_basic": 40,  # HRA as % of Basic
            "special_allowance_auto_calculate": True,  # Auto-calculate remaining as special allowance
        },
        
        # Bonus & Incentives
        "bonus_rules": {
            "statutory_bonus_enabled": True,
            "statutory_bonus_percent": 8.33,
            "statutory_bonus_ceiling": 7000,  # Monthly basic ceiling
            "performance_bonus_enabled": False,
            "annual_increment_month": 4,  # April
        },
        
        # Loan & Advance Deductions
        "loan_deduction_rules": {
            "max_emi_percent_of_salary": 50,  # Max EMI deduction as % of net salary
            "salary_advance_max_percent": 50,  # Max advance as % of salary
        },
        
        # Reimbursements
        "reimbursement_rules": {
            "process_with_salary": True,
            "max_pending_months": 3,
        },
    }


@router.get("/config")
async def get_payroll_config(request: Request):
    """Get payroll configuration with all rules"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    
    # Return default rules if no config exists
    if not config:
        config = get_default_payroll_rules()
        config["config_id"] = "default"
        config["is_active"] = True
    
    return config


@router.get("/rules")
async def get_payroll_rules(request: Request):
    """Get all payroll rules (separate endpoint for clarity)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    if not config:
        return get_default_payroll_rules()
    return config


@router.post("/config")
async def update_payroll_config(data: dict, request: Request):
    """Update payroll configuration"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["config_id"] = f"cfg_{uuid.uuid4().hex[:12]}"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = user.get("user_id")
    data["is_active"] = True
    
    # Deactivate old config
    await db.payroll_config.update_many({}, {"$set": {"is_active": False}})
    
    await db.payroll_config.insert_one(data)
    data.pop('_id', None)
    return data


@router.put("/rules/{rule_section}")
async def update_payroll_rule_section(rule_section: str, data: dict, request: Request):
    """Update a specific section of payroll rules"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    valid_sections = [
        "attendance_rules", "leave_rules", "overtime_rules", 
        "pf_rules", "esi_rules", "pt_rules", "tds_rules",
        "salary_components", "bonus_rules", "loan_deduction_rules",
        "reimbursement_rules"
    ]
    
    if rule_section not in valid_sections:
        raise HTTPException(status_code=400, detail=f"Invalid rule section. Valid: {valid_sections}")
    
    # Get current config
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    if not config:
        config = get_default_payroll_rules()
    
    # Update the specific section
    config[rule_section] = data
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    config["updated_by"] = user.get("user_id")
    
    # Save updated config
    if config.get("config_id") and config["config_id"] != "default":
        await db.payroll_config.update_one(
            {"config_id": config["config_id"]},
            {"$set": {rule_section: data, "updated_at": config["updated_at"]}}
        )
    else:
        config["config_id"] = f"cfg_{uuid.uuid4().hex[:12]}"
        config["is_active"] = True
        await db.payroll_config.insert_one(config)
        config.pop('_id', None)
    
    return {"message": f"{rule_section} updated successfully", "data": data}


@router.get("/leave-type-rules")
async def get_leave_type_payroll_rules(request: Request):
    """Get payroll rules for each leave type"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get leave types
    leave_types = await db.leave_types.find({}, {"_id": 0}).to_list(50)
    
    # Get current payroll config
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    leave_rules = config.get("leave_rules", {}) if config else {}
    
    # Combine leave types with their payroll rules
    result = []
    for lt in leave_types:
        code = lt.get("code", "")
        rule = leave_rules.get(code, {"is_paid": False, "deduction_percent": 100})
        result.append({
            "leave_type_id": lt.get("leave_type_id"),
            "name": lt.get("name"),
            "code": code,
            "is_paid": rule.get("is_paid", False),
            "deduction_percent": rule.get("deduction_percent", 100),
        })
    
    return result


@router.put("/leave-type-rules")
async def update_leave_type_payroll_rules(data: List[dict], request: Request):
    """Update payroll rules for leave types"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get current config
    config = await db.payroll_config.find_one({"is_active": True}, {"_id": 0})
    if not config:
        config = get_default_payroll_rules()
    
    # Build leave rules dict
    leave_rules = {}
    for item in data:
        code = item.get("code")
        if code:
            leave_rules[code] = {
                "is_paid": item.get("is_paid", False),
                "deduction_percent": item.get("deduction_percent", 100),
            }
    
    config["leave_rules"] = leave_rules
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    config["updated_by"] = user.get("user_id")
    
    # Save
    if config.get("config_id") and config["config_id"] != "default":
        await db.payroll_config.update_one(
            {"config_id": config["config_id"]},
            {"$set": {"leave_rules": leave_rules, "updated_at": config["updated_at"]}}
        )
    else:
        config["config_id"] = f"cfg_{uuid.uuid4().hex[:12]}"
        config["is_active"] = True
        await db.payroll_config.insert_one(config)
        config.pop('_id', None)
    
    return {"message": "Leave type payroll rules updated", "leave_rules": leave_rules}


# ==================== CUSTOM DEDUCTION RULES ====================

@router.get("/custom-rules")
async def get_custom_deduction_rules(request: Request):
    """Get custom deduction rules (e.g., late coming penalties)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    rules = await db.custom_payroll_rules.find({"is_active": True}, {"_id": 0}).to_list(50)
    
    # Return default rules if none exist
    if not rules:
        rules = [
            {
                "rule_id": "default_late",
                "name": "Late Coming Penalty",
                "description": "Deduction for excessive late arrivals",
                "condition_type": "late_count",
                "condition_threshold": 3,
                "condition_operator": "greater_than",
                "action_type": "percentage_deduction",
                "action_value": 5,
                "is_active": True,
                "is_default": True
            },
            {
                "rule_id": "default_absent",
                "name": "Unauthorized Absence Penalty",
                "description": "Extra deduction for unapproved absences",
                "condition_type": "absent_without_leave",
                "condition_threshold": 2,
                "condition_operator": "greater_than",
                "action_type": "fixed_deduction",
                "action_value": 500,
                "is_active": True,
                "is_default": True
            }
        ]
    
    return rules


@router.post("/custom-rules")
async def create_custom_deduction_rule(data: dict, request: Request):
    """Create a new custom deduction rule"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    rule = {
        "rule_id": f"rule_{uuid.uuid4().hex[:12]}",
        "name": data.get("name", "Custom Rule"),
        "description": data.get("description", ""),
        "condition_type": data.get("condition_type"),  # late_count, absent_count, absent_without_leave, early_departure_count
        "condition_threshold": data.get("condition_threshold", 0),
        "condition_operator": data.get("condition_operator", "greater_than"),  # greater_than, equals, less_than
        "action_type": data.get("action_type"),  # percentage_deduction, fixed_deduction, half_day_deduction, full_day_deduction
        "action_value": data.get("action_value", 0),
        "apply_per_occurrence": data.get("apply_per_occurrence", False),  # If true, apply for each occurrence above threshold
        "is_active": True,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("user_id")
    }
    
    await db.custom_payroll_rules.insert_one(rule)
    rule.pop('_id', None)
    return rule


@router.put("/custom-rules/{rule_id}")
async def update_custom_deduction_rule(rule_id: str, data: dict, request: Request):
    """Update a custom deduction rule"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Don't allow editing default rules
    existing = await db.custom_payroll_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if existing and existing.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot edit default rules")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = user.get("user_id")
    
    await db.custom_payroll_rules.update_one(
        {"rule_id": rule_id},
        {"$set": data}
    )
    
    return await db.custom_payroll_rules.find_one({"rule_id": rule_id}, {"_id": 0})


@router.delete("/custom-rules/{rule_id}")
async def delete_custom_deduction_rule(rule_id: str, request: Request):
    """Delete a custom deduction rule"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Don't allow deleting default rules
    existing = await db.custom_payroll_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if existing and existing.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete default rules")
    
    await db.custom_payroll_rules.update_one(
        {"rule_id": rule_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Rule deleted"}


@router.put("/custom-rules/{rule_id}/toggle")
async def toggle_custom_rule(rule_id: str, request: Request):
    """Toggle a custom rule on/off"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    rule = await db.custom_payroll_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    new_status = not rule.get("is_active", True)
    await db.custom_payroll_rules.update_one(
        {"rule_id": rule_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Rule {'enabled' if new_status else 'disabled'}", "is_active": new_status}
