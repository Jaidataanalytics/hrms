"""Reports & Analytics API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/reports", tags=["Reports"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


@router.get("/summary")
async def get_summary_report(request: Request):
    """Get overall HR summary report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Employee stats
    total_employees = await db.employees.count_documents({"employment_status": "active"})
    employees_by_dept = await db.employees.aggregate([
        {"$match": {"employment_status": "active"}},
        {"$group": {"_id": "$department_id", "count": {"$sum": 1}}}
    ]).to_list(50)
    
    # Attendance today
    present_today = await db.attendance.count_documents({"date": today, "status": "present"})
    
    # Leave stats
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    
    # Expense stats
    pending_expenses = await db.expenses.count_documents({"status": "pending"})
    total_pending_amount = 0
    async for exp in db.expenses.find({"status": "pending"}):
        total_pending_amount += exp.get("amount", 0)
    
    # Grievance stats
    open_tickets = await db.grievances.count_documents({"status": {"$in": ["open", "in_progress"]}})
    
    # Asset stats
    total_assets = await db.assets.count_documents({"is_active": True})
    available_assets = await db.assets.count_documents({"is_active": True, "status": "available"})
    
    return {
        "as_of": today,
        "employees": {
            "total_active": total_employees,
            "by_department": employees_by_dept,
            "present_today": present_today
        },
        "leave": {
            "pending_requests": pending_leaves
        },
        "expenses": {
            "pending_claims": pending_expenses,
            "pending_amount": total_pending_amount
        },
        "grievances": {
            "open_tickets": open_tickets
        },
        "assets": {
            "total": total_assets,
            "available": available_assets
        }
    }


@router.get("/attendance")
async def get_attendance_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department_id: Optional[str] = None
):
    """Get attendance report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    if not end_date:
        end_date = datetime.now(timezone.utc).date().isoformat()
    
    pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    status_counts = await db.attendance.aggregate(pipeline).to_list(10)
    
    # Daily breakdown
    daily_pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": "$date",
            "present": {"$sum": {"$cond": [{"$eq": ["$status", "present"]}, 1, 0]}},
            "absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}},
            "leave": {"$sum": {"$cond": [{"$eq": ["$status", "leave"]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_stats = await db.attendance.aggregate(daily_pipeline).to_list(60)
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": status_counts,
        "daily": daily_stats
    }


@router.get("/leave")
async def get_leave_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get leave analytics report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    if not end_date:
        end_date = datetime.now(timezone.utc).date().isoformat()
    
    # By leave type
    by_type = await db.leave_requests.aggregate([
        {"$match": {"start_date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": "$leave_type_id",
            "total_requests": {"$sum": 1},
            "approved": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, 1, 0]}},
            "rejected": {"$sum": {"$cond": [{"$eq": ["$status", "rejected"]}, 1, 0]}},
            "pending": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}}
        }}
    ]).to_list(20)
    
    # By department
    by_dept = await db.leave_requests.aggregate([
        {"$match": {"start_date": {"$gte": start_date, "$lte": end_date}}},
        {"$lookup": {
            "from": "employees",
            "localField": "employee_id",
            "foreignField": "employee_id",
            "as": "employee"
        }},
        {"$unwind": {"path": "$employee", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$employee.department_id",
            "count": {"$sum": 1}
        }}
    ]).to_list(20)
    
    return {
        "period": {"start": start_date, "end": end_date},
        "by_leave_type": by_type,
        "by_department": by_dept
    }


@router.get("/headcount")
async def get_headcount_report(request: Request):
    """Get headcount and demographics report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # By department
    by_department = await db.employees.aggregate([
        {"$match": {"employment_status": "active"}},
        {"$group": {"_id": "$department_id", "count": {"$sum": 1}}}
    ]).to_list(50)
    
    # By location
    by_location = await db.employees.aggregate([
        {"$match": {"employment_status": "active"}},
        {"$group": {"_id": "$location_id", "count": {"$sum": 1}}}
    ]).to_list(50)
    
    # By designation
    by_designation = await db.employees.aggregate([
        {"$match": {"employment_status": "active"}},
        {"$group": {"_id": "$designation_id", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    # By employment type
    by_type = await db.employees.aggregate([
        {"$match": {"employment_status": "active"}},
        {"$group": {"_id": "$employment_type", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    return {
        "total_active": await db.employees.count_documents({"employment_status": "active"}),
        "by_department": by_department,
        "by_location": by_location,
        "by_designation": by_designation,
        "by_employment_type": by_type
    }


@router.get("/expense")
async def get_expense_report(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get expense analytics report"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    if not end_date:
        end_date = datetime.now(timezone.utc).date().isoformat()
    
    # By category
    by_category = await db.expenses.aggregate([
        {"$match": {"expense_date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": "$category",
            "total_claimed": {"$sum": "$amount"},
            "total_approved": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, "$approved_amount", 0]}},
            "count": {"$sum": 1}
        }}
    ]).to_list(20)
    
    # By status
    by_status = await db.expenses.aggregate([
        {"$match": {"expense_date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": "$status",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(10)
    
    return {
        "period": {"start": start_date, "end": end_date},
        "by_category": by_category,
        "by_status": by_status
    }
