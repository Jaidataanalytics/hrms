"""
Biometric API Sync Service
Fetches attendance data from external biometric API and syncs to database.
Runs every 3 hours via APScheduler.
"""

import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import asyncio
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Biometric API Configuration
BIOMETRIC_API_URL = "http://115.245.227.203:81/api/v2/WebAPI/GetDeviceLogs"
BIOMETRIC_API_KEY = "180817012620"

# Database reference
db: Optional[AsyncIOMotorDatabase] = None


def set_db(database: AsyncIOMotorDatabase):
    """Set database reference for sync operations"""
    global db
    db = database
    logger.info("Biometric sync service: Database connected")


async def fetch_biometric_data(from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """
    Fetch attendance data from biometric API.
    
    Args:
        from_date: Start date in YYYY-MM-DD format
        to_date: End date in YYYY-MM-DD format
    
    Returns:
        List of attendance records from API
    """
    try:
        url = f"{BIOMETRIC_API_URL}?APIKey={BIOMETRIC_API_KEY}&FromDate={from_date}&ToDate={to_date}"
        
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Fetched {len(data)} records from biometric API ({from_date} to {to_date})")
            return data
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching biometric data: {e}")
        return []
    except Exception as e:
        logger.error(f"Error fetching biometric data: {e}")
        return []


async def get_employee_map() -> Dict[str, Dict[str, Any]]:
    """
    Get mapping of emp_code to employee data.
    
    Returns:
        Dict mapping emp_code to employee info
    """
    if db is None:
        logger.error("Database not initialized")
        return {}
    
    try:
        employees = await db.employees.find(
            {"is_active": True},
            {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1}
        ).to_list(1000)
        
        emp_map = {}
        for emp in employees:
            if emp.get("emp_code"):
                emp_map[emp["emp_code"]] = {
                    "employee_id": emp["employee_id"],
                    "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                }
        
        logger.info(f"Loaded {len(emp_map)} employee mappings")
        return emp_map
        
    except Exception as e:
        logger.error(f"Error loading employee map: {e}")
        return {}


def parse_punch_direction(direction: str) -> str:
    """Convert API punch direction to standard format"""
    if direction and direction.lower() == "in":
        return "IN"
    elif direction and direction.lower() == "out":
        return "OUT"
    return "IN"  # Default


def parse_log_datetime(log_date: str) -> tuple:
    """
    Parse LogDate from API to date and time strings.
    
    Args:
        log_date: DateTime string like "2025-01-02 08:33:01"
    
    Returns:
        Tuple of (date_str, time_str) e.g. ("2025-01-02", "08:33:01")
    """
    try:
        dt = datetime.strptime(log_date, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except:
        # Try alternative formats
        try:
            dt = datetime.strptime(log_date, "%Y-%m-%d %H:%M")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:00")
        except:
            logger.warning(f"Could not parse log date: {log_date}")
            return None, None


async def update_attendance_record(
    employee_id: str,
    emp_code: str,
    date: str,
    punch_time: str,
    punch_type: str,
    device_serial: str = None
) -> bool:
    """
    Update or create attendance record for an employee.
    
    Args:
        employee_id: Internal employee ID
        emp_code: Employee code (for logging)
        date: Date string YYYY-MM-DD
        punch_time: Time string HH:MM:SS
        punch_type: "IN" or "OUT"
        device_serial: Optional device serial number
    
    Returns:
        True if successful
    """
    if db is None:
        return False
    
    try:
        punch_record = {
            "type": punch_type,
            "time": punch_time,
            "source": "biometric_api",
            "device": device_serial
        }
        
        # Find existing attendance for this date
        existing = await db.attendance.find_one(
            {"employee_id": employee_id, "date": date}
        )
        
        if existing:
            # Check if this punch already exists (avoid duplicates)
            existing_punches = existing.get("punches", [])
            for p in existing_punches:
                if p.get("time") == punch_time and p.get("type") == punch_type:
                    # Punch already recorded, skip
                    return True
            
            # Add new punch
            existing_punches.append(punch_record)
            
            # Recalculate first_in and last_out
            in_times = [p["time"] for p in existing_punches if p.get("type") == "IN"]
            out_times = [p["time"] for p in existing_punches if p.get("type") == "OUT"]
            
            first_in = min(in_times) if in_times else existing.get("first_in")
            last_out = max(out_times) if out_times else existing.get("last_out")
            
            # Calculate total hours and late status
            total_hours = None
            is_late = False
            late_minutes = 0
            
            if first_in:
                try:
                    # Parse first_in time
                    time_format = "%H:%M:%S" if first_in.count(":") == 2 else "%H:%M"
                    in_time = datetime.strptime(first_in, time_format)
                    late_threshold = datetime.strptime("09:45:00", "%H:%M:%S")
                    
                    # Check if late (after 09:45)
                    if in_time > late_threshold:
                        is_late = True
                        late_minutes = int((in_time - late_threshold).seconds / 60)
                except:
                    pass
            
            if first_in and last_out:
                try:
                    t1 = datetime.strptime(first_in, "%H:%M:%S" if first_in.count(":") == 2 else "%H:%M")
                    t2 = datetime.strptime(last_out, "%H:%M:%S" if last_out.count(":") == 2 else "%H:%M")
                    total_hours = round((t2 - t1).seconds / 3600, 2)
                except:
                    pass
            
            await db.attendance.update_one(
                {"employee_id": employee_id, "date": date},
                {"$set": {
                    "punches": existing_punches,
                    "first_in": first_in,
                    "last_out": last_out,
                    "total_hours": total_hours,
                    "status": "present",
                    "is_late": is_late,
                    "late_minutes": late_minutes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new attendance record
            import uuid
            attendance_doc = {
                "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
                "employee_id": employee_id,
                "emp_code": emp_code,
                "date": date,
                "first_in": punch_time if punch_type == "IN" else None,
                "last_out": punch_time if punch_type == "OUT" else None,
                "punches": [punch_record],
                "total_hours": None,
                "status": "present",
                "is_late": False,
                "late_minutes": 0,
                "overtime_hours": 0,
                "remarks": "Synced from biometric API",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.attendance.insert_one(attendance_doc)
        
        return True
        
    except Exception as e:
        logger.error(f"Error updating attendance for {emp_code} on {date}: {e}")
        return False


async def sync_biometric_data(from_date: str = None, to_date: str = None) -> Dict[str, Any]:
    """
    Main sync function - fetches biometric data and updates attendance.
    
    Args:
        from_date: Optional start date (defaults to yesterday)
        to_date: Optional end date (defaults to today)
    
    Returns:
        Sync results summary
    """
    if db is None:
        logger.error("Database not initialized for biometric sync")
        return {"success": False, "error": "Database not initialized"}
    
    # Default to last 2 days if not specified
    if not to_date:
        to_date = datetime.now().strftime("%Y-%m-%d")
    if not from_date:
        from_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logger.info(f"Starting biometric sync from {from_date} to {to_date}")
    
    # Get employee mapping
    emp_map = await get_employee_map()
    if not emp_map:
        logger.warning("No employee mappings found")
        return {"success": False, "error": "No employee mappings"}
    
    # Fetch biometric data
    biometric_data = await fetch_biometric_data(from_date, to_date)
    if not biometric_data:
        logger.info("No biometric data to sync")
        return {"success": True, "message": "No data to sync", "records_processed": 0}
    
    # Process records
    stats = {
        "total_records": len(biometric_data),
        "matched": 0,
        "unmatched": 0,
        "updated": 0,
        "errors": 0,
        "unmatched_codes": set()
    }
    
    for record in biometric_data:
        emp_code = record.get("EmployeeCode")
        log_date = record.get("LogDate")
        punch_direction = record.get("PunchDirection")
        device_serial = record.get("SerialNumber")
        
        if not emp_code or not log_date:
            stats["errors"] += 1
            continue
        
        # Check if employee exists
        emp_info = emp_map.get(emp_code)
        if not emp_info:
            stats["unmatched"] += 1
            stats["unmatched_codes"].add(emp_code)
            continue
        
        stats["matched"] += 1
        
        # Parse date and time
        date_str, time_str = parse_log_datetime(log_date)
        if not date_str or not time_str:
            stats["errors"] += 1
            continue
        
        # Update attendance
        punch_type = parse_punch_direction(punch_direction)
        success = await update_attendance_record(
            employee_id=emp_info["employee_id"],
            emp_code=emp_code,
            date=date_str,
            punch_time=time_str,
            punch_type=punch_type,
            device_serial=device_serial
        )
        
        if success:
            stats["updated"] += 1
        else:
            stats["errors"] += 1
    
    # Log sync completion
    await log_sync_result(from_date, to_date, stats)
    
    # Convert set to list for JSON serialization
    stats["unmatched_codes"] = list(stats["unmatched_codes"])
    
    logger.info(f"Biometric sync completed: {stats['updated']} updated, {stats['unmatched']} unmatched, {stats['errors']} errors")
    
    return {
        "success": True,
        "from_date": from_date,
        "to_date": to_date,
        "stats": stats
    }


async def sync_historical_data(days: int = 365) -> Dict[str, Any]:
    """
    Sync historical biometric data for specified number of days.
    
    Args:
        days: Number of days to sync (default 365 = 1 year)
    
    Returns:
        Sync results summary
    """
    to_date = datetime.now().strftime("%Y-%m-%d")
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    logger.info(f"Starting historical sync for {days} days ({from_date} to {to_date})")
    
    return await sync_biometric_data(from_date, to_date)


async def log_sync_result(from_date: str, to_date: str, stats: Dict[str, Any]):
    """Log sync operation to database for tracking"""
    if db is None:
        return
    
    try:
        log_doc = {
            "sync_id": f"sync_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "type": "biometric_api_sync",
            "from_date": from_date,
            "to_date": to_date,
            "total_records": stats.get("total_records", 0),
            "matched": stats.get("matched", 0),
            "unmatched": stats.get("unmatched", 0),
            "updated": stats.get("updated", 0),
            "errors": stats.get("errors", 0),
            "unmatched_codes": list(stats.get("unmatched_codes", [])),
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        await db.biometric_sync_logs.insert_one(log_doc)
    except Exception as e:
        logger.error(f"Error logging sync result: {e}")


async def get_sync_logs(limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent sync logs"""
    if db is None:
        return []
    
    try:
        logs = await db.biometric_sync_logs.find(
            {}, {"_id": 0}
        ).sort("synced_at", -1).limit(limit).to_list(limit)
        return logs
    except Exception as e:
        logger.error(f"Error getting sync logs: {e}")
        return []


# Scheduler job function (called by APScheduler)
def run_scheduled_sync():
    """Wrapper to run async sync in scheduler"""
    logger.info("Scheduled biometric sync triggered")
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(sync_biometric_data())
        else:
            loop.run_until_complete(sync_biometric_data())
    except RuntimeError:
        # Create new event loop if none exists
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(sync_biometric_data())


# For use with FastAPI lifespan
async def scheduled_sync_task():
    """Async task for scheduled sync"""
    await sync_biometric_data()
