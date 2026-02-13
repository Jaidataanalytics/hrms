"""Data Management API Routes - Bulk Delete Operations and Production Sync"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import httpx
import os

router = APIRouter(prefix="/data-management", tags=["Data Management"])

# Import db from server.py - will be set up when router is included
db = None

# Deployed/Production URL - this is the source of truth
DEPLOYED_URL = os.environ.get("DEPLOYED_API_URL", "https://shardahrms.com")

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


# Collections to sync from deployed environment
SYNC_COLLECTIONS = {
    "users": "users",
    "employees": "employees",
    "attendance": "attendance",
    "leave_requests": "leave_requests",
    "leave_balances": "leave_balances",
    "leave_types": "leave_types",
    "departments": "departments",
    "payslips": "payslips",
    "payroll_runs": "payroll_runs",
    "payroll_config": "payroll_config",
    "payroll_rules": "payroll_rules",
    "employee_salaries": "employee_salaries",
    "salary_structures": "salary_structures",
    "holidays": "holidays",
    "sewa_advances": "sewa_advances",
}


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
    "contractors": "contractors",
    "contract_workers": "contract_workers",
    "contract_worker_attendance": "contract_worker_attendance",
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
    "contractors": "Contractors",
    "contract_workers": "Contract Workers",
    "contract_worker_attendance": "Contract Worker Attendance",
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
        except Exception:
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
    await verify_admin_access(request)
    
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



# ==================== PRODUCTION SYNC ====================

@router.get("/sync/status")
async def get_sync_status(request: Request):
    """Get sync status and deployed URL info"""
    await verify_admin_access(request)
    
    local_counts = {}
    for name, collection_name in SYNC_COLLECTIONS.items():
        try:
            count = await db[collection_name].count_documents({})
            local_counts[name] = count
        except Exception:
            local_counts[name] = 0
    
    return {
        "deployed_url": DEPLOYED_URL,
        "local_counts": local_counts,
        "sync_collections": list(SYNC_COLLECTIONS.keys())
    }


@router.post("/sync/from-deployed")
async def sync_from_deployed(request: Request, data: dict = None):
    """
    Sync data from deployed/production environment to preview.
    
    This fetches all data from the deployed API and imports it into
    the local preview database, replacing existing data.
    
    data: {
        "email": "admin@shardamotor.com",  # Deployed admin credentials
        "password": "admin123",
        "collections": ["employees", "attendance", ...]  # Optional - specific collections
    }
    """
    user = await verify_admin_access(request)
    
    data = data or {}
    email = data.get("email", "admin@shardamotor.com")
    password = data.get("password", "admin123")
    collections_to_sync = data.get("collections", list(SYNC_COLLECTIONS.keys()))
    
    results = {
        "success": False,
        "synced_collections": {},
        "errors": [],
        "deployed_url": DEPLOYED_URL
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: Login to deployed environment
        try:
            login_response = await client.post(
                f"{DEPLOYED_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            
            if login_response.status_code != 200:
                results["errors"].append(f"Failed to login to deployed environment: {login_response.text}")
                return results
            
            login_data = login_response.json()
            token = login_data.get("access_token") or login_data.get("token")
            
            if not token:
                results["errors"].append("No token received from deployed environment")
                return results
                
            headers = {"Authorization": f"Bearer {token}"}
            
        except Exception as e:
            results["errors"].append(f"Connection error to deployed environment: {str(e)}")
            return results
        
        # Step 2: Fetch and sync each collection
        for collection_key in collections_to_sync:
            if collection_key not in SYNC_COLLECTIONS:
                continue
                
            collection_name = SYNC_COLLECTIONS[collection_key]
            
            try:
                # Determine the API endpoint for this collection
                endpoint = get_sync_endpoint(collection_key)
                
                if not endpoint:
                    results["errors"].append(f"No sync endpoint for {collection_key}")
                    continue
                
                # Fetch data from deployed
                response = await client.get(
                    f"{DEPLOYED_URL}{endpoint}",
                    headers=headers
                )
                
                if response.status_code != 200:
                    results["errors"].append(f"Failed to fetch {collection_key}: {response.status_code}")
                    continue
                
                remote_data = response.json()
                
                # Handle different response formats
                if isinstance(remote_data, dict):
                    if "data" in remote_data:
                        records = remote_data["data"]
                    elif collection_key in remote_data:
                        records = remote_data[collection_key]
                    elif "employees" in remote_data:
                        records = remote_data["employees"]
                    elif "payslips" in remote_data:
                        records = remote_data["payslips"]
                    else:
                        records = [remote_data] if remote_data else []
                else:
                    records = remote_data if isinstance(remote_data, list) else []
                
                if not records:
                    results["synced_collections"][collection_key] = {"imported": 0, "note": "No data found"}
                    continue
                
                # Clear local collection and insert new data
                await db[collection_name].delete_many({})
                
                # Remove _id fields to avoid conflicts
                for record in records:
                    if "_id" in record:
                        del record["_id"]
                
                if records:
                    await db[collection_name].insert_many(records)
                
                results["synced_collections"][collection_key] = {
                    "imported": len(records)
                }
                
            except Exception as e:
                results["errors"].append(f"Error syncing {collection_key}: {str(e)}")
        
        # Step 3: Sync additional data via direct MongoDB export if available
        # This handles collections that don't have direct API endpoints
        try:
            await sync_via_export_endpoint(client, headers, results)
        except Exception as e:
            results["errors"].append(f"Export sync error: {str(e)}")
    
    results["success"] = len(results["errors"]) == 0
    results["synced_at"] = datetime.now(timezone.utc).isoformat()
    results["synced_by"] = user.get("name", user.get("email"))
    
    return results


def get_sync_endpoint(collection_key: str) -> str:
    """Get the API endpoint for fetching collection data"""
    endpoints = {
        "employees": "/api/employees",
        "attendance": "/api/attendance/all",  # Assuming this endpoint exists
        "leave_requests": "/api/leave/requests",
        "leave_balances": "/api/leave/balances",
        "leave_types": "/api/leave/types",
        "departments": "/api/departments",
        "payslips": "/api/payroll/payslips",
        "payroll_runs": "/api/payroll/runs",
        "payroll_config": "/api/payroll/config",
        "payroll_rules": "/api/payroll/rules",
        "holidays": "/api/calendar/holidays",
        "users": "/api/users",
    }
    return endpoints.get(collection_key)


async def sync_via_export_endpoint(client, headers, results):
    """Try to sync data via a bulk export endpoint if available"""
    try:
        # Try fetching bulk data export if the endpoint exists
        export_response = await client.get(
            f"{DEPLOYED_URL}/api/data-management/export-all",
            headers=headers
        )
        
        if export_response.status_code == 200:
            export_data = export_response.json()
            
            for collection_name, records in export_data.items():
                if collection_name in SYNC_COLLECTIONS.values() and records:
                    # Remove _id fields
                    for record in records:
                        if "_id" in record:
                            del record["_id"]
                    
                    await db[collection_name].delete_many({})
                    await db[collection_name].insert_many(records)
                    
                    results["synced_collections"][collection_name] = {
                        "imported": len(records),
                        "via": "export"
                    }
    except Exception:
        pass  # Export endpoint may not exist


@router.get("/export-all")
async def export_all_data(request: Request):
    """Export all syncable data for backup or transfer"""
    await verify_admin_access(request)
    
    export_data = {}
    
    for collection_key, collection_name in SYNC_COLLECTIONS.items():
        try:
            records = await db[collection_name].find({}, {"_id": 0}).to_list(10000)
            export_data[collection_name] = records
        except Exception as e:
            export_data[collection_name] = {"error": str(e)}
    
    return export_data


@router.post("/sync/attendance")
async def sync_attendance_only(request: Request, data: dict = None):
    """
    Sync only attendance data from deployed environment.
    Useful for testing payroll calculations with real attendance.
    
    data: {
        "email": "admin@shardamotor.com",
        "password": "admin123",
        "month": 1,  # Optional - specific month
        "year": 2026  # Optional - specific year
    }
    """
    await verify_admin_access(request)
    
    data = data or {}
    email = data.get("email", "admin@shardamotor.com")
    password = data.get("password", "admin123")
    month = data.get("month")
    year = data.get("year")
    
    results = {
        "success": False,
        "attendance_imported": 0,
        "employees_imported": 0,
        "salaries_imported": 0,
        "holidays_imported": 0,
        "errors": []
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Login
        try:
            login_response = await client.post(
                f"{DEPLOYED_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            
            if login_response.status_code != 200:
                results["errors"].append(f"Login failed: {login_response.text}")
                return results
            
            token = login_response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            
        except Exception as e:
            results["errors"].append(f"Connection error: {str(e)}")
            return results
        
        # Sync employees
        try:
            emp_response = await client.get(f"{DEPLOYED_URL}/api/employees", headers=headers)
            if emp_response.status_code == 200:
                employees = emp_response.json()
                if isinstance(employees, dict):
                    employees = employees.get("employees", employees.get("data", []))
                
                if employees:
                    for emp in employees:
                        emp.pop("_id", None)
                    await db.employees.delete_many({})
                    await db.employees.insert_many(employees)
                    results["employees_imported"] = len(employees)
        except Exception as e:
            results["errors"].append(f"Employee sync error: {str(e)}")
        
        # Sync salary structures
        try:
            sal_response = await client.get(f"{DEPLOYED_URL}/api/payroll/all-salary-structures", headers=headers)
            if sal_response.status_code == 200:
                sal_data = sal_response.json()
                salaries = sal_data.get("data", []) if isinstance(sal_data, dict) else sal_data
                
                # Also try employee_salaries endpoint
                sal2_response = await client.get(f"{DEPLOYED_URL}/api/payroll/employee-salaries", headers=headers)
                if sal2_response.status_code == 200:
                    sal2_data = sal2_response.json()
                    if isinstance(sal2_data, list):
                        salaries.extend(sal2_data)
                
                if salaries:
                    for sal in salaries:
                        sal.pop("_id", None)
                    await db.employee_salaries.delete_many({})
                    await db.salary_structures.delete_many({})
                    await db.employee_salaries.insert_many(salaries)
                    results["salaries_imported"] = len(salaries)
        except Exception as e:
            results["errors"].append(f"Salary sync error: {str(e)}")
        
        # Sync attendance
        try:
            # Build query params for specific month/year
            params = {}
            if month and year:
                params["month"] = month
                params["year"] = year
            
            att_response = await client.get(
                f"{DEPLOYED_URL}/api/attendance/all",
                headers=headers,
                params=params
            )
            
            if att_response.status_code == 200:
                attendance = att_response.json()
                if isinstance(attendance, dict):
                    attendance = attendance.get("attendance", attendance.get("data", []))
                
                if attendance:
                    for att in attendance:
                        att.pop("_id", None)
                    
                    # If month/year specified, only delete that month's data
                    if month and year:
                        date_prefix = f"{year}-{str(month).zfill(2)}"
                        await db.attendance.delete_many({"date": {"$regex": f"^{date_prefix}"}})
                    else:
                        await db.attendance.delete_many({})
                    
                    await db.attendance.insert_many(attendance)
                    results["attendance_imported"] = len(attendance)
        except Exception as e:
            results["errors"].append(f"Attendance sync error: {str(e)}")
        
        # Sync holidays
        try:
            hol_response = await client.get(f"{DEPLOYED_URL}/api/calendar/holidays", headers=headers)
            if hol_response.status_code == 200:
                holidays = hol_response.json()
                if isinstance(holidays, dict):
                    holidays = holidays.get("holidays", holidays.get("data", []))
                
                if holidays:
                    for hol in holidays:
                        hol.pop("_id", None)
                    await db.holidays.delete_many({})
                    await db.holidays.insert_many(holidays)
                    results["holidays_imported"] = len(holidays)
        except Exception as e:
            results["errors"].append(f"Holiday sync error: {str(e)}")
        
        # Sync payroll rules
        try:
            rules_response = await client.get(f"{DEPLOYED_URL}/api/payroll/rules", headers=headers)
            if rules_response.status_code == 200:
                rules = rules_response.json()
                if rules:
                    rules.pop("_id", None)
                    await db.payroll_rules.delete_many({})
                    await db.payroll_rules.insert_one(rules)
        except Exception as e:
            results["errors"].append(f"Payroll rules sync error: {str(e)}")
    
    results["success"] = len(results["errors"]) == 0 or results["attendance_imported"] > 0
    results["synced_at"] = datetime.now(timezone.utc).isoformat()
    
    return results



# ==================== DATA FIX ENDPOINTS ====================

# Valid attendance status values
VALID_ATTENDANCE_STATUSES = {
    "present", "absent", "leave", "wfh", "tour", "half_day", "hd",
    "sunday", "holiday", "lop", "lwp", "loss_of_pay", "no_record"
}

# Status normalization mapping
STATUS_NORMALIZATION = {
    "t": "tour",
    "p": "present",
    "a": "absent",
    "l": "leave",
    "w": "wfh",
    "h": "holiday",
    "hd": "half_day",
    "new year": "holiday",
    "newyear": "holiday",
    "christmas": "holiday",
    "diwali": "holiday",
    "republic day": "holiday",
    "independence day": "holiday",
}


@router.post("/fix/attendance-status")
async def fix_attendance_status(request: Request, data: dict = None):
    """
    Fix corrupted attendance status values.
    
    This endpoint:
    1. Finds all attendance records with invalid/truncated status values
    2. Normalizes them to valid status values
    3. Updates the records
    
    data: {
        "dry_run": true/false  # If true, just report what would be fixed
    }
    """
    user = await verify_admin_access(request)
    
    data = data or {}
    dry_run = data.get("dry_run", True)
    
    results = {
        "dry_run": dry_run,
        "records_checked": 0,
        "records_fixed": 0,
        "fixes_applied": [],
        "errors": []
    }
    
    try:
        # Find all attendance records
        all_records = await db.attendance.find({}).to_list(50000)
        results["records_checked"] = len(all_records)
        
        fixes = []
        
        for record in all_records:
            status = record.get("status", "")
            att_id = record.get("attendance_id")
            
            if not status or not att_id:
                continue
            
            status_lower = status.lower().strip()
            
            # Check if status needs normalization
            if status_lower in STATUS_NORMALIZATION:
                new_status = STATUS_NORMALIZATION[status_lower]
                fixes.append({
                    "attendance_id": att_id,
                    "employee_id": record.get("employee_id"),
                    "date": record.get("date"),
                    "old_status": status,
                    "new_status": new_status
                })
        
        results["fixes_applied"] = fixes
        results["records_fixed"] = len(fixes)
        
        # Apply fixes if not dry run
        if not dry_run and fixes:
            for fix in fixes:
                await db.attendance.update_one(
                    {"attendance_id": fix["attendance_id"]},
                    {
                        "$set": {
                            "status": fix["new_status"],
                            "status_fixed_at": datetime.now(timezone.utc).isoformat(),
                            "status_fixed_by": user.get("name", user.get("email")),
                            "original_status": fix["old_status"]
                        }
                    }
                )
            
            results["message"] = f"Fixed {len(fixes)} attendance records"
        else:
            results["message"] = f"Found {len(fixes)} records that need fixing (dry run - no changes made)"
        
    except Exception as e:
        results["errors"].append(str(e))
    
    return results


@router.get("/fix/attendance-status/preview")
async def preview_attendance_status_fixes(request: Request):
    """Preview what attendance status fixes would be applied"""
    await verify_admin_access(request)
    
    # Find records with potentially invalid statuses
    all_records = await db.attendance.find({}).to_list(50000)
    
    status_counts = {}
    invalid_records = []
    
    for record in all_records:
        status = record.get("status", "")
        status_lower = status.lower().strip() if status else ""
        
        status_counts[status] = status_counts.get(status, 0) + 1
        
        if status_lower in STATUS_NORMALIZATION:
            invalid_records.append({
                "attendance_id": record.get("attendance_id"),
                "employee_id": record.get("employee_id"),
                "date": record.get("date"),
                "current_status": status,
                "will_become": STATUS_NORMALIZATION[status_lower]
            })
    
    return {
        "total_records": len(all_records),
        "status_distribution": status_counts,
        "records_needing_fix": len(invalid_records),
        "invalid_records": invalid_records[:50],  # Limit to first 50
        "status_normalization_rules": STATUS_NORMALIZATION
    }

