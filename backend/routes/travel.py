"""Travel & Tour Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone, date as dt_date
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/travel", tags=["Travel & Tour Management"])

# Also create a secondary router for /tours alias
tours_router = APIRouter(prefix="/tours", tags=["Tours"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== EMPLOYEE SELF-SERVICE ====================

@tours_router.get("/my-tours")
async def get_my_tours(request: Request):
    """Get tours for the current logged-in employee"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    tours = await db.travel_requests.find(
        {"employee_id": employee_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Transform for dashboard display
    result = []
    for tour in tours:
        result.append({
            "request_id": tour.get("request_id"),
            "destination": tour.get("location") or tour.get("client_name") or tour.get("purpose"),
            "from_date": tour.get("start_date"),
            "to_date": tour.get("end_date"),
            "status": tour.get("status"),
            "purpose": tour.get("purpose"),
            "request_type": tour.get("request_type", "tour")
        })
    
    return result


# ==================== TOUR/TRAVEL REQUESTS ====================

@router.get("/requests")
async def list_travel_requests(
    request: Request,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    request_type: Optional[str] = None  # tour, single_day, all
):
    """List travel/tour requests"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id and employee_id != "all":
        query["employee_id"] = employee_id
    
    if status and status != "all":
        query["status"] = status
    
    if request_type and request_type != "all":
        query["request_type"] = request_type
    
    requests = await db.travel_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with employee names and linked data
    for req in requests:
        if req.get("employee_id"):
            emp = await db.employees.find_one({"employee_id": req["employee_id"]}, {"_id": 0})
            if emp:
                req["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                req["emp_code"] = emp.get("emp_code")
        
        # Get linked expenses count
        expense_count = await db.expenses.count_documents({"travel_request_id": req.get("request_id")})
        req["expense_count"] = expense_count
        
        # Get remote check-ins for this tour
        checkins = await db.remote_checkins.find(
            {"tour_request_id": req.get("request_id")}, {"_id": 0}
        ).to_list(50)
        req["remote_checkins"] = checkins
    
    return requests


@router.post("/requests")
async def create_travel_request(data: dict, request: Request):
    """Create travel/tour request (multi-day tour or single-day remote punch)"""
    user = await get_current_user(request)
    
    request_type = data.get("request_type", "tour")  # tour or single_day
    
    travel_data = {
        "request_id": f"tour_{uuid.uuid4().hex[:12]}",
        "employee_id": user.get("employee_id"),
        "employee_name": user.get("name"),
        "request_type": request_type,
        "status": "pending",
        
        # Common fields
        "purpose": data.get("purpose"),
        "location": data.get("location"),
        "remarks": data.get("remarks"),
        
        # Tour specific
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date") or data.get("start_date"),  # Same date for single_day
        "client_name": data.get("client_name"),
        "transport_mode": data.get("transport_mode"),
        
        # Timeline
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Calculate trip days
    if travel_data["start_date"] and travel_data["end_date"]:
        start = datetime.fromisoformat(travel_data["start_date"])
        end = datetime.fromisoformat(travel_data["end_date"])
        travel_data["trip_days"] = (end - start).days + 1
    else:
        travel_data["trip_days"] = 1
    
    await db.travel_requests.insert_one(travel_data)
    travel_data.pop('_id', None)
    return travel_data


@router.get("/requests/{request_id}")
async def get_travel_request(request_id: str, request: Request):
    """Get travel request details"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        if travel_req["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get related expenses
    expenses = await db.expenses.find(
        {"travel_request_id": request_id}, {"_id": 0}
    ).to_list(50)
    travel_req["expenses"] = expenses
    
    return travel_req


@router.put("/requests/{request_id}")
async def update_travel_request(request_id: str, data: dict, request: Request):
    """Update travel request"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Only creator can update pending requests
    if travel_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending requests")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": data}
    )
    return {"message": "Request updated"}


@router.put("/requests/{request_id}/approve")
async def approve_travel_request(request_id: str, data: dict, request: Request):
    """Approve travel request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.get("user_id"),
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_budget": data.get("approved_budget"),
            "approval_remarks": data.get("remarks")
        }}
    )
    return {"message": "Travel request approved"}


@router.put("/requests/{request_id}/reject")
async def reject_travel_request(request_id: str, data: dict, request: Request):
    """Reject travel request"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user.get("user_id"),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": data.get("reason")
        }}
    )
    return {"message": "Travel request rejected"}


@router.put("/requests/{request_id}/complete")
async def complete_travel(request_id: str, data: dict, request: Request):
    """Mark travel as completed"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "completed",
            "actual_end_date": data.get("actual_end_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "trip_report": data.get("trip_report"),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Travel marked as completed"}


@router.put("/requests/{request_id}/cancel")
async def cancel_travel_request(request_id: str, data: dict, request: Request):
    """Cancel travel request"""
    user = await get_current_user(request)
    
    travel_req = await db.travel_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not travel_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if travel_req["employee_id"] != user.get("employee_id"):
        if user.get("role") not in ["super_admin", "hr_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.travel_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancellation_reason": data.get("reason"),
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Travel request cancelled"}


# ==================== MY TRAVEL ====================

@router.get("/my-requests")
async def get_my_travel_requests(request: Request):
    """Get current user's travel requests"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    requests = await db.travel_requests.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


# ==================== TRAVEL SUMMARY ====================

@router.get("/summary")
async def get_travel_summary(request: Request):
    """Get travel summary for dashboard"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pending = await db.travel_requests.count_documents({"status": "pending"})
    approved = await db.travel_requests.count_documents({"status": "approved"})
    ongoing = await db.travel_requests.count_documents({"status": "ongoing"})
    completed = await db.travel_requests.count_documents({"status": "completed"})
    
    # Calculate total budget used this month
    from datetime import datetime as dt
    start_of_month = dt.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    pipeline = [
        {"$match": {"status": {"$in": ["approved", "completed"]}, "created_at": {"$gte": start_of_month.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$approved_budget"}}}
    ]
    result = await db.travel_requests.aggregate(pipeline).to_list(1)
    total_budget = result[0]["total"] if result else 0
    
    return {
        "pending": pending,
        "approved": approved,
        "ongoing": ongoing,
        "completed": completed,
        "total_budget_this_month": total_budget
    }


# ==================== GPS-BASED REMOTE CHECK-IN ====================

@router.post("/remote-check-in")
async def remote_check_in(data: dict, request: Request):
    """
    GPS-based remote check-in for employees on approved tours or field employees.
    Records attendance with location data.
    """
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    
    punch_type = data.get("punch_type", "IN")  # IN or OUT
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    location_name = data.get("location_name", "")
    tour_request_id = data.get("tour_request_id")  # Optional - if checking in for a specific tour
    
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="GPS location is required for remote check-in")
    
    # Check eligibility: Either on approved tour or is a field employee
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    is_field_employee = employee.get("is_field_employee", False)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if employee has an approved tour covering today
    active_tour = None
    if tour_request_id:
        active_tour = await db.travel_requests.find_one({
            "request_id": tour_request_id,
            "employee_id": employee_id,
            "status": {"$in": ["approved", "ongoing"]},
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        }, {"_id": 0})
    else:
        # Find any active tour
        active_tour = await db.travel_requests.find_one({
            "employee_id": employee_id,
            "status": {"$in": ["approved", "ongoing"]},
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        }, {"_id": 0})
    
    if not is_field_employee and not active_tour:
        # Check for HR override for today
        has_override = await db.remote_checkin_overrides.find_one({
            "date": today,
            "$or": [
                {"type": "employee", "employee_ids": employee_id},
                {"type": "department", "department_id": employee.get("department_id")}
            ]
        })
        if not has_override:
            raise HTTPException(
                status_code=403, 
                detail="Remote check-in is only allowed for field employees, those on approved tours, or with HR override"
            )
    
    now_time = datetime.now(timezone.utc).strftime("%H:%M")
    
    # Record the remote check-in
    checkin_record = {
        "checkin_id": f"rcheckin_{uuid.uuid4().hex[:12]}",
        "employee_id": employee_id,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "punch_type": punch_type,
        "date": today,
        "time": now_time,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name
        },
        "tour_request_id": active_tour.get("request_id") if active_tour else None,
        "is_field_employee_checkin": is_field_employee and not active_tour,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.remote_checkins.insert_one(checkin_record)
    checkin_record.pop("_id", None)
    
    # Also update/create attendance record
    existing_attendance = await db.attendance.find_one(
        {"employee_id": employee_id, "date": today}
    )
    
    punch = {
        "type": punch_type,
        "time": now_time,
        "source": "tour" if active_tour else "remote",
        "location": {"lat": latitude, "lng": longitude, "name": location_name}
    }
    
    if existing_attendance:
        # Update existing attendance
        punches = existing_attendance.get("punches", [])
        punches.append(punch)
        
        in_times = [p["time"] for p in punches if p["type"] == "IN"]
        out_times = [p["time"] for p in punches if p["type"] == "OUT"]
        
        first_in = min(in_times) if in_times else None
        last_out = max(out_times) if out_times else None
        
        total_hours = None
        if first_in and last_out:
            t1 = datetime.strptime(first_in, "%H:%M")
            t2 = datetime.strptime(last_out, "%H:%M")
            total_hours = round((t2 - t1).seconds / 3600, 2)
        
        await db.attendance.update_one(
            {"employee_id": employee_id, "date": today},
            {"$set": {
                "punches": punches,
                "first_in": first_in or existing_attendance.get("first_in"),
                "last_out": last_out,
                "total_hours": total_hours,
                "status": "tour" if active_tour else existing_attendance.get("status", "present"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new attendance record
        attendance_doc = {
            "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
            "employee_id": employee_id,
            "date": today,
            "first_in": now_time if punch_type == "IN" else None,
            "last_out": now_time if punch_type == "OUT" else None,
            "punches": [punch],
            "total_hours": None,
            "status": "tour" if active_tour else "present",
            "is_late": False,
            "late_minutes": 0,
            "overtime_hours": 0,
            "remarks": f"Remote check-in from {location_name or 'GPS location'}",
            "source": "tour" if active_tour else "remote",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.attendance.insert_one(attendance_doc)
    
    # Update tour status to ongoing if this is the first check-in for the tour
    if active_tour and active_tour.get("status") == "approved":
        await db.travel_requests.update_one(
            {"request_id": active_tour["request_id"]},
            {"$set": {"status": "ongoing", "actual_start_date": today}}
        )
    
    return {
        "message": f"Remote {punch_type} recorded successfully",
        "checkin": checkin_record,
        "time": now_time,
        "location": location_name or f"{latitude}, {longitude}"
    }


@router.get("/remote-check-ins")
async def get_remote_checkins(
    request: Request,
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    tour_request_id: Optional[str] = None
):
    """Get remote check-in records"""
    user = await get_current_user(request)
    
    query = {}
    
    # Access control
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id and employee_id != "all":
        query["employee_id"] = employee_id
    
    if date:
        query["date"] = date
    
    if tour_request_id:
        query["tour_request_id"] = tour_request_id
    
    checkins = await db.remote_checkins.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return checkins


@router.get("/my-active-tour")
async def get_my_active_tour(request: Request):
    """Get current user's active tour if any"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return {"has_active_tour": False, "tour": None, "is_field_employee": False}
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if field employee
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    is_field_employee = employee.get("is_field_employee", False) if employee else False
    
    # Find active tour
    active_tour = await db.travel_requests.find_one({
        "employee_id": employee_id,
        "status": {"$in": ["approved", "ongoing"]},
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    }, {"_id": 0})
    
    # Get today's check-ins
    todays_checkins = await db.remote_checkins.find({
        "employee_id": employee_id,
        "date": today
    }, {"_id": 0}).to_list(20)
    
    # Check for HR override
    has_override = await db.remote_checkin_overrides.find_one({
        "date": today,
        "$or": [
            {"type": "employee", "employee_ids": employee_id},
            {"type": "department", "department_id": employee.get("department_id") if employee else None}
        ]
    })
    
    return {
        "has_active_tour": active_tour is not None,
        "tour": active_tour,
        "is_field_employee": is_field_employee,
        "has_override": has_override is not None,
        "can_remote_checkin": active_tour is not None or is_field_employee or has_override is not None,
        "todays_checkins": todays_checkins
    }


# ==================== FIELD EMPLOYEE MANAGEMENT ====================

@router.get("/field-employees")
async def get_field_employees(request: Request):
    """Get list of employees marked as field employees"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find(
        {"is_field_employee": True, "is_active": True},
        {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1, "department": 1}
    ).to_list(500)
    
    return employees


@router.put("/field-employees/{employee_id}")
async def toggle_field_employee(employee_id: str, data: dict, request: Request):
    """Mark/unmark an employee as a field employee"""
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_field_employee = data.get("is_field_employee", False)
    
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"is_field_employee": is_field_employee}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {
        "message": f"Employee {'marked' if is_field_employee else 'unmarked'} as field employee",
        "employee_id": employee_id,
        "is_field_employee": is_field_employee
    }


# ==================== HR REMOTE CHECK-IN OVERRIDES ====================

@router.post("/remote-checkin-override")
async def create_remote_checkin_override(data: dict, request: Request):
    """HR allows remote check-in for specific employee(s) or department for a day"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    override = {
        "override_id": f"rco_{uuid.uuid4().hex[:12]}",
        "date": data.get("date"),
        "type": data.get("type", "employee"),  # "employee" or "department"
        "employee_ids": data.get("employee_ids", []),
        "department_id": data.get("department_id"),
        "reason": data.get("reason", ""),
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.remote_checkin_overrides.insert_one(override)
    override.pop("_id", None)
    return override


@router.get("/remote-checkin-overrides")
async def list_remote_checkin_overrides(request: Request, date: str = None):
    """List remote check-in overrides"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if date:
        query["date"] = date
    
    overrides = await db.remote_checkin_overrides.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return overrides


@router.delete("/remote-checkin-overrides/{override_id}")
async def delete_remote_checkin_override(override_id: str, request: Request):
    """Remove a remote check-in override"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.remote_checkin_overrides.delete_one({"override_id": override_id})
    return {"message": "Override removed"}

