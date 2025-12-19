"""Reports & Analytics API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/reports", tags=["Reports"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== HEADCOUNT REPORT ====================

@router.get("/headcount")
async def get_headcount_report(request: Request, period: Optional[str] = "monthly"):
    """Get headcount trends report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Current headcount by department
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_department = await db.employees.aggregate(pipeline).to_list(50)
    
    # By designation
    pipeline_desig = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$designation", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_designation = await db.employees.aggregate(pipeline_desig).to_list(50)
    
    # By gender
    pipeline_gender = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}}
    ]
    by_gender = await db.employees.aggregate(pipeline_gender).to_list(10)
    
    # Monthly joining trends (last 12 months)
    twelve_months_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    pipeline_joining = [
        {"$match": {"date_of_joining": {"$gte": twelve_months_ago}}},
        {"$addFields": {
            "join_month": {"$substr": ["$date_of_joining", 0, 7]}
        }},
        {"$group": {"_id": "$join_month", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    joining_trend = await db.employees.aggregate(pipeline_joining).to_list(12)
    
    total = await db.employees.count_documents({"status": "active"})
    
    return {
        "total_headcount": total,
        "by_department": [{"department": d["_id"] or "Unassigned", "count": d["count"]} for d in by_department],
        "by_designation": [{"designation": d["_id"] or "Unassigned", "count": d["count"]} for d in by_designation],
        "by_gender": [{"gender": g["_id"] or "Not Specified", "count": g["count"]} for g in by_gender],
        "joining_trend": [{"month": j["_id"], "count": j["count"]} for j in joining_trend]
    }


# ==================== ATTRITION REPORT ====================

@router.get("/attrition")
async def get_attrition_report(request: Request, year: Optional[int] = None):
    """Get attrition analysis report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now().year
    
    # Get exits this year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    exits = await db.exit_requests.find({
        "last_working_day": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(500)
    
    # Exit by reason
    reasons = {}
    departments = {}
    tenure_buckets = {"<1 year": 0, "1-2 years": 0, "2-5 years": 0, "5+ years": 0}
    monthly_exits = {str(m).zfill(2): 0 for m in range(1, 13)}
    
    for exit in exits:
        # By reason
        reason = exit.get("exit_reason", "Other")
        reasons[reason] = reasons.get(reason, 0) + 1
        
        # By department
        dept = exit.get("department", "Unknown")
        departments[dept] = departments.get(dept, 0) + 1
        
        # By month
        lwd = exit.get("last_working_day", "")
        if lwd and len(lwd) >= 7:
            month = lwd[5:7]
            monthly_exits[month] = monthly_exits.get(month, 0) + 1
        
        # By tenure
        tenure = exit.get("tenure_years", 0)
        if tenure < 1:
            tenure_buckets["<1 year"] += 1
        elif tenure < 2:
            tenure_buckets["1-2 years"] += 1
        elif tenure < 5:
            tenure_buckets["2-5 years"] += 1
        else:
            tenure_buckets["5+ years"] += 1
    
    # Calculate attrition rate
    avg_headcount = await db.employees.count_documents({})
    attrition_rate = (len(exits) / avg_headcount * 100) if avg_headcount > 0 else 0
    
    return {
        "year": year,
        "total_exits": len(exits),
        "attrition_rate": round(attrition_rate, 2),
        "by_reason": [{"reason": k, "count": v} for k, v in reasons.items()],
        "by_department": [{"department": k, "count": v} for k, v in departments.items()],
        "by_tenure": [{"tenure": k, "count": v} for k, v in tenure_buckets.items()],
        "monthly_trend": [{"month": k, "exits": v} for k, v in monthly_exits.items()]
    }


# ==================== PAYROLL COST REPORT ====================

@router.get("/payroll-cost")
async def get_payroll_cost_report(
    request: Request,
    year: Optional[int] = None,
    month: Optional[int] = None
):
    """Get payroll cost analysis report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now().year
    
    # Get payroll data
    query = {"year": year}
    if month:
        query["month"] = month
    
    payslips = await db.payslips.find(query, {"_id": 0}).to_list(5000)
    
    if not payslips:
        return {
            "year": year,
            "month": month,
            "total_gross": 0,
            "total_net": 0,
            "total_deductions": 0,
            "employee_count": 0,
            "by_department": [],
            "monthly_trend": []
        }
    
    # Aggregate by department
    dept_costs = {}
    monthly_costs = {}
    total_gross = 0
    total_net = 0
    total_deductions = 0
    
    for slip in payslips:
        total_gross += slip.get("gross_salary", 0)
        total_net += slip.get("net_salary", 0)
        total_deductions += slip.get("total_deductions", 0)
        
        # Get employee department
        emp = await db.employees.find_one({"employee_id": slip["employee_id"]}, {"_id": 0})
        dept = emp.get("department", "Unknown") if emp else "Unknown"
        
        if dept not in dept_costs:
            dept_costs[dept] = {"gross": 0, "net": 0, "count": 0}
        dept_costs[dept]["gross"] += slip.get("gross_salary", 0)
        dept_costs[dept]["net"] += slip.get("net_salary", 0)
        dept_costs[dept]["count"] += 1
        
        # Monthly
        m = str(slip.get("month", 1)).zfill(2)
        if m not in monthly_costs:
            monthly_costs[m] = {"gross": 0, "net": 0}
        monthly_costs[m]["gross"] += slip.get("gross_salary", 0)
        monthly_costs[m]["net"] += slip.get("net_salary", 0)
    
    return {
        "year": year,
        "month": month,
        "total_gross": round(total_gross),
        "total_net": round(total_net),
        "total_deductions": round(total_deductions),
        "total_pf": round(total_gross * 0.12),
        "total_esi": round(total_gross * 0.0325),
        "employee_count": len(set(s["employee_id"] for s in payslips)),
        "avg_salary": round(total_gross / len(payslips)) if payslips else 0,
        "by_department": [
            {"department": k, "gross": round(v["gross"]), "net": round(v["net"]), "employees": v["count"]}
            for k, v in sorted(dept_costs.items(), key=lambda x: x[1]["gross"], reverse=True)
        ],
        "monthly_trend": [
            {"month": k, "gross": round(v["gross"]), "net": round(v["net"])}
            for k, v in sorted(monthly_costs.items())
        ]
    }


# ==================== ATTENDANCE REPORT ====================

@router.get("/attendance")
async def get_attendance_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None
):
    """Get attendance analytics report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Get attendance records
    query = {"date": {"$gte": start_date, "$lte": end_date}}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    
    if not attendance:
        return {
            "period": {"start": start_date, "end": end_date},
            "total_records": 0,
            "avg_attendance_rate": 0,
            "by_status": [],
            "by_department": [],
            "late_comers": []
        }
    
    # Aggregate
    status_counts = {}
    dept_attendance = {}
    late_employees = {}
    
    for record in attendance:
        # By status
        status = record.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # Get employee department
        emp = await db.employees.find_one({"employee_id": record["employee_id"]}, {"_id": 0})
        dept = emp.get("department", "Unknown") if emp else "Unknown"
        
        if department and dept != department:
            continue
        
        if dept not in dept_attendance:
            dept_attendance[dept] = {"present": 0, "absent": 0, "late": 0, "wfh": 0, "half_day": 0}
        
        if status == "present":
            dept_attendance[dept]["present"] += 1
        elif status == "absent":
            dept_attendance[dept]["absent"] += 1
        elif status == "late":
            dept_attendance[dept]["late"] += 1
            emp_id = record["employee_id"]
            late_employees[emp_id] = late_employees.get(emp_id, 0) + 1
        elif status == "wfh":
            dept_attendance[dept]["wfh"] += 1
        elif status == "half_day":
            dept_attendance[dept]["half_day"] += 1
    
    total_present = status_counts.get("present", 0) + status_counts.get("wfh", 0) + status_counts.get("late", 0)
    total_records = len(attendance)
    avg_rate = (total_present / total_records * 100) if total_records > 0 else 0
    
    # Top late comers
    top_late = sorted(late_employees.items(), key=lambda x: x[1], reverse=True)[:10]
    late_list = []
    for emp_id, count in top_late:
        emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0})
        if emp:
            late_list.append({
                "employee_id": emp_id,
                "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
                "late_count": count
            })
    
    return {
        "period": {"start": start_date, "end": end_date},
        "total_records": total_records,
        "avg_attendance_rate": round(avg_rate, 1),
        "by_status": [{"status": k, "count": v} for k, v in status_counts.items()],
        "by_department": [
            {"department": k, **v}
            for k, v in sorted(dept_attendance.items())
        ],
        "late_comers": late_list
    }


# ==================== LEAVE REPORT ====================

@router.get("/leave")
async def get_leave_report(
    request: Request,
    year: Optional[int] = None
):
    """Get leave analytics report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now().year
    
    # Get leave requests for the year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    leaves = await db.leave_requests.find({
        "from_date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(5000)
    
    # Aggregate by leave type
    by_type = {}
    by_status = {}
    by_month = {str(m).zfill(2): 0 for m in range(1, 13)}
    total_days = 0
    
    for leave in leaves:
        # By type
        lt = leave.get("leave_type_name", "Unknown")
        if lt not in by_type:
            by_type[lt] = {"count": 0, "days": 0}
        by_type[lt]["count"] += 1
        by_type[lt]["days"] += leave.get("days", 0)
        
        # By status
        status = leave.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
        
        # By month
        from_date = leave.get("from_date", "")
        if from_date and len(from_date) >= 7:
            month = from_date[5:7]
            by_month[month] = by_month.get(month, 0) + leave.get("days", 0)
        
        if status == "approved":
            total_days += leave.get("days", 0)
    
    return {
        "year": year,
        "total_requests": len(leaves),
        "total_days_taken": total_days,
        "by_type": [{"type": k, **v} for k, v in by_type.items()],
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "monthly_trend": [{"month": k, "days": v} for k, v in sorted(by_month.items())]
    }


# ==================== CUSTOM REPORT ====================

@router.post("/custom")
async def generate_custom_report(data: dict, request: Request):
    """Generate custom report based on parameters"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    report_type = data.get("report_type")
    filters = data.get("filters", {})
    group_by = data.get("group_by")
    
    # Map report types to collections
    collection_map = {
        "employees": "employees",
        "attendance": "attendance",
        "leave": "leave_requests",
        "payroll": "payslips",
        "expenses": "expenses",
        "assets": "assets"
    }
    
    if report_type not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    collection = db[collection_map[report_type]]
    
    # Build query from filters
    query = {}
    for key, value in filters.items():
        if value and value != "all":
            query[key] = value
    
    # Get data
    if group_by:
        pipeline = [
            {"$match": query},
            {"$group": {"_id": f"${group_by}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        results = await collection.aggregate(pipeline).to_list(100)
        return {
            "report_type": report_type,
            "grouped_by": group_by,
            "data": [{"group": r["_id"], "count": r["count"]} for r in results]
        }
    else:
        results = await collection.find(query, {"_id": 0}).limit(500).to_list(500)
        return {
            "report_type": report_type,
            "count": len(results),
            "data": results
        }
