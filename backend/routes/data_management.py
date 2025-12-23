"""Data Management API Routes - Bulk Delete Operations"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid

router = APIRouter(prefix="/data-management", tags=["Data Management"])

# Import db from server.py - will be set up when router is included
db = None

def set_db(database):
    global db
    db = database

async def get_current_user(request: Request):
    """Get current user from request - imported from main server"""
    from server import get_current_user as server_get_current_user
    return await server_get_current_user(request)


async def verify_admin_access(request: Request):
    """Verify user has admin/HR access for data management"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized - Admin/HR only")
    return user


# Data type to collection mapping
DATA_COLLECTIONS = {
    "employees": "employees",
    "attendance": "attendance",
    "leave_requests": "leave_requests",
    "leave_balances": "leave_balances",
    "payslips": "payslips",
    "payroll_runs": "payroll_runs",
    "employee_kpis": "employee_kpis",
    "employee_goals": "employee_goals",
    "kpi_templates": "kpi_templates",
    "performance_reviews": "performance_reviews",
    "assets": "assets",
    "asset_requests": "asset_requests",
    "expenses": "expenses",
    "training_programs": "training_programs",
    "user_trainings": "user_trainings",
    "travel_requests": "travel_requests",
    "announcements": "announcements",
}

# Friendly names for display
DATA_TYPE_NAMES = {
    "employees": "Employees",
    "attendance": "Attendance Records",
    "leave_requests": "Leave Requests",
    "leave_balances": "Leave Balances",
    "payslips": "Payslips",
    "payroll_runs": "Payroll Runs",
    "employee_kpis": "KPI Records",
    "employee_goals": "Goals",
    "kpi_templates": "KPI Templates",
    "performance_reviews": "Performance Reviews",
    "assets": "Assets",
    "asset_requests": "Asset Requests",
    "expenses": "Expense Claims",
    "training_programs": "Training Programs",
    "user_trainings": "Training Enrollments",
    "travel_requests": "Travel Requests",
    "announcements": "Announcements",
}


@router.get("/stats")
async def get_data_stats(request: Request):
    """Get record counts for all data types"""
    await verify_admin_access(request)
    
    stats = []
    for data_type, collection_name in DATA_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Count total records
            total_count = await collection.count_documents({})
            
            # Count soft-deleted records (if applicable)
            deleted_count = await collection.count_documents({"is_deleted": True})
            active_count = total_count - deleted_count
            
            stats.append({
                "data_type": data_type,
                "display_name": DATA_TYPE_NAMES.get(data_type, data_type),
                "total_count": total_count,
                "active_count": active_count,
                "deleted_count": deleted_count,
                "collection": collection_name
            })
        except Exception as e:
            stats.append({
                "data_type": data_type,
                "display_name": DATA_TYPE_NAMES.get(data_type, data_type),
                "total_count": 0,
                "active_count": 0,
                "deleted_count": 0,
                "collection": collection_name,
                "error": str(e)
            })
    
    return stats


@router.post("/bulk-delete")
async def bulk_delete(request: Request, data: dict):
    """
    Bulk delete records with filters
    
    data: {
        "data_type": "attendance",
        "delete_type": "soft" | "hard",
        "filters": {
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "department": "Sales",
            "employee_id": "EMP001",
            "status": "rejected"
        }
    }
    """
    user = await verify_admin_access(request)
    
    data_type = data.get("data_type")
    delete_type = data.get("delete_type", "soft")  # soft or hard
    filters = data.get("filters", {})
    
    if data_type not in DATA_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")
    
    collection_name = DATA_COLLECTIONS[data_type]
    collection = db[collection_name]
    
    # Build query from filters
    query = {}
    
    # Date range filter
    date_field = get_date_field(data_type)
    if filters.get("date_from") or filters.get("date_to"):
        date_query = {}
        if filters.get("date_from"):
            date_query["$gte"] = filters["date_from"]
        if filters.get("date_to"):
            date_query["$lte"] = filters["date_to"]
        if date_query:
            query[date_field] = date_query
    
    # Department filter
    if filters.get("department"):
        query["department"] = filters["department"]
    
    # Employee filter
    if filters.get("employee_id"):
        query["employee_id"] = filters["employee_id"]
    
    # Status filter
    if filters.get("status"):
        query["status"] = filters["status"]
    
    # Count records to be deleted
    count = await collection.count_documents(query)
    
    if count == 0:
        return {"message": "No records match the criteria", "deleted_count": 0}
    
    # Perform deletion
    if delete_type == "hard":
        # Permanent deletion
        result = await collection.delete_many(query)
        deleted_count = result.deleted_count
    else:
        # Soft deletion - mark as deleted
        result = await collection.update_many(
            query,
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": user.get("user_id")
                }
            }
        )
        deleted_count = result.modified_count
    
    return {
        "message": f"Successfully {'permanently deleted' if delete_type == 'hard' else 'soft deleted'} {deleted_count} records",
        "deleted_count": deleted_count,
        "data_type": data_type,
        "delete_type": delete_type
    }


@router.post("/delete-all-type")
async def delete_all_of_type(request: Request, data: dict):
    """Delete all records of a specific data type"""
    user = await verify_admin_access(request)
    
    data_type = data.get("data_type")
    delete_type = data.get("delete_type", "soft")
    
    if data_type not in DATA_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")
    
    collection_name = DATA_COLLECTIONS[data_type]
    collection = db[collection_name]
    
    # Count records
    count = await collection.count_documents({})
    
    if count == 0:
        return {"message": "No records to delete", "deleted_count": 0}
    
    if delete_type == "hard":
        result = await collection.delete_many({})
        deleted_count = result.deleted_count
    else:
        result = await collection.update_many(
            {},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": user.get("user_id")
                }
            }
        )
        deleted_count = result.modified_count
    
    return {
        "message": f"Successfully {'permanently deleted' if delete_type == 'hard' else 'soft deleted'} {deleted_count} records",
        "deleted_count": deleted_count,
        "data_type": data_type
    }


@router.post("/delete-everything")
async def delete_everything(request: Request, data: dict):
    """
    Delete all data except admin/HR user accounts
    Requires confirmation_text to be "DELETE ALL DATA"
    """
    user = await verify_admin_access(request)
    
    confirmation_text = data.get("confirmation_text", "")
    
    if confirmation_text != "DELETE ALL DATA":
        raise HTTPException(
            status_code=400, 
            detail="Invalid confirmation. Please type 'DELETE ALL DATA' exactly."
        )
    
    delete_type = data.get("delete_type", "hard")  # Default to hard delete for "delete everything"
    
    deleted_summary = {}
    total_deleted = 0
    
    # Delete all data except users
    for data_type, collection_name in DATA_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            count = await collection.count_documents({})
            
            if count > 0:
                if delete_type == "hard":
                    result = await collection.delete_many({})
                    deleted_count = result.deleted_count
                else:
                    result = await collection.update_many(
                        {},
                        {
                            "$set": {
                                "is_deleted": True,
                                "deleted_at": datetime.now(timezone.utc).isoformat(),
                                "deleted_by": user.get("user_id")
                            }
                        }
                    )
                    deleted_count = result.modified_count
                
                deleted_summary[data_type] = deleted_count
                total_deleted += deleted_count
        except Exception as e:
            deleted_summary[data_type] = f"Error: {str(e)}"
    
    # Also clear related collections that aren't in main list
    additional_collections = [
        "notifications", "user_sessions", "payroll_config", 
        "leave_types", "departments", "custom_payroll_rules"
    ]
    
    for coll_name in additional_collections:
        try:
            collection = db[coll_name]
            if delete_type == "hard":
                result = await collection.delete_many({})
                if result.deleted_count > 0:
                    deleted_summary[coll_name] = result.deleted_count
                    total_deleted += result.deleted_count
        except:
            pass
    
    return {
        "message": f"Successfully deleted all data. Total records removed: {total_deleted}",
        "total_deleted": total_deleted,
        "summary": deleted_summary,
        "users_preserved": True
    }


@router.post("/restore")
async def restore_soft_deleted(request: Request, data: dict):
    """Restore soft-deleted records"""
    user = await verify_admin_access(request)
    
    data_type = data.get("data_type")
    
    if data_type not in DATA_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid data type: {data_type}")
    
    collection_name = DATA_COLLECTIONS[data_type]
    collection = db[collection_name]
    
    # Restore all soft-deleted records
    result = await collection.update_many(
        {"is_deleted": True},
        {
            "$set": {"is_deleted": False},
            "$unset": {"deleted_at": "", "deleted_by": ""}
        }
    )
    
    return {
        "message": f"Restored {result.modified_count} records",
        "restored_count": result.modified_count,
        "data_type": data_type
    }


@router.get("/departments")
async def get_departments_for_filter(request: Request):
    """Get list of departments for filter dropdown"""
    await verify_admin_access(request)
    
    departments = await db.employees.distinct("department")
    return [d for d in departments if d]


@router.get("/employees-list")
async def get_employees_for_filter(request: Request):
    """Get list of employees for filter dropdown"""
    await verify_admin_access(request)
    
    employees = await db.employees.find(
        {}, 
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "employee_code": 1}
    ).to_list(500)
    
    return [
        {
            "employee_id": e.get("employee_id"),
            "name": f"{e.get('first_name', '')} {e.get('last_name', '')}".strip(),
            "code": e.get("employee_code", e.get("employee_id"))
        }
        for e in employees
    ]


def get_date_field(data_type: str) -> str:
    """Get the appropriate date field for each data type"""
    date_fields = {
        "employees": "join_date",
        "attendance": "date",
        "leave_requests": "start_date",
        "leave_balances": "year",
        "payslips": "created_at",
        "payroll_runs": "created_at",
        "employee_kpis": "created_at",
        "employee_goals": "created_at",
        "kpi_templates": "created_at",
        "performance_reviews": "review_date",
        "assets": "purchase_date",
        "asset_requests": "created_at",
        "expenses": "expense_date",
        "training_programs": "start_date",
        "user_trainings": "enrolled_at",
        "travel_requests": "start_date",
        "announcements": "created_at",
    }
    return date_fields.get(data_type, "created_at")
