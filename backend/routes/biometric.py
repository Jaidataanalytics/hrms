"""
BioMax Biometric Device Integration
Handles real-time attendance push from BioMax devices (N-MB260W and similar models)
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
import logging
import httpx

router = APIRouter(prefix="/biometric", tags=["Biometric Integration"])

# Configure logging
logger = logging.getLogger(__name__)

# Database reference - will be set from server.py
db = None

def set_db(database):
    global db
    db = database

# Store registered devices
# In production, this should be in the database
REGISTERED_DEVICES = {}

# Configuration for forwarding to other servers (for "keep both" functionality)
FORWARD_SERVERS = []


# ==================== MODELS ====================

class BiometricPunchData:
    """Standard format for biometric punch data"""
    def __init__(self, 
                 user_id: str,
                 punch_time: datetime,
                 punch_type: str = "IN",  # IN or OUT
                 device_serial: str = None,
                 input_type: str = "fingerprint",  # fingerprint, face, card, password
                 raw_data: dict = None):
        self.user_id = user_id
        self.punch_time = punch_time
        self.punch_type = punch_type
        self.device_serial = device_serial
        self.input_type = input_type
        self.raw_data = raw_data


# ==================== WEBHOOK ENDPOINTS ====================

@router.post("/webhook")
async def receive_biomax_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Main webhook endpoint to receive attendance data from BioMax devices.
    Supports multiple data formats that BioMax devices may send.
    
    Expected formats:
    1. JSON: {"UserID": "123", "LogTime": "2024-01-15 09:00:00 GMT +0530", "Type": "CheckIn", "InputType": "Fingerprint"}
    2. Form data: userid=123&logtime=2024-01-15 09:00:00&type=0
    3. XML (some older devices)
    """
    try:
        content_type = request.headers.get("content-type", "")
        raw_body = await request.body()
        
        logger.info(f"Biometric webhook received - Content-Type: {content_type}")
        logger.info(f"Raw body: {raw_body.decode('utf-8', errors='ignore')[:500]}")
        
        punch_data = None
        
        # Try to parse as JSON first
        if "application/json" in content_type or raw_body.startswith(b'{'):
            try:
                data = await request.json()
                punch_data = parse_biomax_json(data)
            except:
                pass
        
        # Try form data
        if not punch_data and ("form" in content_type or b'=' in raw_body):
            try:
                form_data = await request.form()
                punch_data = parse_biomax_form(dict(form_data))
            except:
                pass
        
        # Try query params (some devices send via GET params in POST)
        if not punch_data:
            query_params = dict(request.query_params)
            if query_params:
                punch_data = parse_biomax_form(query_params)
        
        # If still no data, try raw parsing
        if not punch_data and raw_body:
            punch_data = parse_raw_data(raw_body.decode('utf-8', errors='ignore'))
        
        if not punch_data:
            logger.warning("Could not parse biometric data")
            # Still return OK to device to prevent retries
            return {"status": "received", "message": "Data format not recognized but logged"}
        
        # Process the attendance
        result = await process_attendance_punch(punch_data)
        
        # Forward to other servers in background (for "keep both" feature)
        if FORWARD_SERVERS:
            background_tasks.add_task(forward_to_servers, raw_body, request.headers)
        
        return {
            "status": "success",
            "message": "Attendance recorded",
            "data": {
                "employee_code": punch_data.user_id,
                "time": punch_data.punch_time.isoformat() if punch_data.punch_time else None,
                "type": punch_data.punch_type
            }
        }
        
    except Exception as e:
        logger.error(f"Error processing biometric webhook: {str(e)}")
        # Return OK to prevent device from retrying indefinitely
        return {"status": "error", "message": str(e)}


@router.post("/webhook/biomax")
async def receive_biomax_specific(request: Request, background_tasks: BackgroundTasks):
    """Alias endpoint specifically for BioMax devices"""
    return await receive_biomax_webhook(request, background_tasks)


@router.get("/webhook")
async def webhook_health_check():
    """Health check for webhook - some devices ping this first"""
    return {
        "status": "active",
        "message": "BioMax webhook endpoint is ready",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/push")
async def receive_push_data(request: Request, background_tasks: BackgroundTasks):
    """Alternative endpoint for push data - some BioMax configs use /push"""
    return await receive_biomax_webhook(request, background_tasks)


# ==================== DEVICE MANAGEMENT ====================

@router.post("/devices/register")
async def register_device(data: dict, request: Request):
    """Register a new biometric device"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    device_serial = data.get("serial_number")
    if not device_serial:
        raise HTTPException(status_code=400, detail="Serial number required")
    
    device_doc = {
        "device_id": f"dev_{uuid.uuid4().hex[:12]}",
        "serial_number": device_serial,
        "name": data.get("name", f"BioMax {device_serial[-6:]}"),
        "model": data.get("model", "N-MB260W"),
        "location": data.get("location", ""),
        "ip_address": data.get("ip_address", ""),
        "status": "active",
        "last_sync": None,
        "registered_by": user["user_id"],
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "settings": {
            "push_url": data.get("push_url", ""),
            "api_key": f"biomax_{uuid.uuid4().hex[:16]}"
        }
    }
    
    # Check if device already exists
    existing = await db.biometric_devices.find_one({"serial_number": device_serial})
    if existing:
        await db.biometric_devices.update_one(
            {"serial_number": device_serial},
            {"$set": device_doc}
        )
        device_doc["device_id"] = existing.get("device_id", device_doc["device_id"])
    else:
        await db.biometric_devices.insert_one(device_doc)
    
    REGISTERED_DEVICES[device_serial] = device_doc
    
    return {
        "message": "Device registered successfully",
        "device": {
            "device_id": device_doc["device_id"],
            "serial_number": device_serial,
            "name": device_doc["name"],
            "api_key": device_doc["settings"]["api_key"],
            "webhook_url": f"/api/biometric/webhook"
        }
    }


@router.get("/devices")
async def list_devices(request: Request):
    """List all registered biometric devices"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    devices = await db.biometric_devices.find({}, {"_id": 0}).to_list(100)
    return devices


@router.get("/devices/{serial_number}/status")
async def get_device_status(serial_number: str, request: Request):
    """Get status of a specific device"""
    from server import get_current_user
    await get_current_user(request)
    
    device = await db.biometric_devices.find_one(
        {"serial_number": serial_number}, {"_id": 0}
    )
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Get recent punches from this device
    recent_punches = await db.biometric_logs.find(
        {"device_serial": serial_number}
    ).sort("received_at", -1).limit(5).to_list(5)
    
    return {
        "device": device,
        "recent_activity": [{
            "employee_code": p.get("employee_code"),
            "time": p.get("punch_time"),
            "type": p.get("punch_type")
        } for p in recent_punches]
    }


# ==================== EMPLOYEE MAPPING ====================

@router.post("/mapping")
async def create_employee_mapping(data: dict, request: Request):
    """Map biometric user ID to employee ID"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    biometric_id = data.get("biometric_id")
    employee_id = data.get("employee_id")
    
    if not biometric_id or not employee_id:
        raise HTTPException(status_code=400, detail="biometric_id and employee_id required")
    
    # Verify employee exists
    employee = await db.employees.find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    mapping_doc = {
        "mapping_id": f"map_{uuid.uuid4().hex[:12]}",
        "biometric_id": str(biometric_id),
        "employee_id": employee_id,
        "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    # Upsert mapping
    await db.biometric_mappings.update_one(
        {"biometric_id": str(biometric_id)},
        {"$set": mapping_doc},
        upsert=True
    )
    
    return {"message": "Mapping created successfully", "mapping": mapping_doc}


@router.get("/mapping")
async def list_mappings(request: Request):
    """List all biometric to employee mappings"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    mappings = await db.biometric_mappings.find({"is_active": True}, {"_id": 0}).to_list(1000)
    return mappings


@router.delete("/mapping/{biometric_id}")
async def delete_mapping(biometric_id: str, request: Request):
    """Delete a biometric mapping"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.biometric_mappings.update_one(
        {"biometric_id": biometric_id},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    return {"message": "Mapping deleted successfully"}


# ==================== LOGS & REPORTS ====================

@router.get("/logs")
async def get_biometric_logs(
    request: Request,
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    device_serial: Optional[str] = None,
    limit: int = 100
):
    """Get biometric punch logs"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if date:
        query["date"] = date
    if employee_id:
        query["employee_id"] = employee_id
    if device_serial:
        query["device_serial"] = device_serial
    
    logs = await db.biometric_logs.find(query, {"_id": 0}).sort("received_at", -1).limit(limit).to_list(limit)
    return logs


@router.get("/logs/unmatched")
async def get_unmatched_logs(request: Request, limit: int = 100):
    """Get biometric logs that couldn't be matched to employees"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = await db.biometric_logs.find(
        {"employee_id": None, "status": "unmatched"},
        {"_id": 0}
    ).sort("received_at", -1).limit(limit).to_list(limit)
    
    return logs


# ==================== FORWARDING CONFIGURATION ====================

@router.post("/forward/add")
async def add_forward_server(data: dict, request: Request):
    """Add a server to forward biometric data to (for 'keep both' functionality)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    
    server_url = data.get("url")
    if not server_url:
        raise HTTPException(status_code=400, detail="Server URL required")
    
    forward_doc = {
        "forward_id": f"fwd_{uuid.uuid4().hex[:12]}",
        "url": server_url,
        "name": data.get("name", "Forward Server"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.biometric_forwards.insert_one(forward_doc)
    FORWARD_SERVERS.append({"url": server_url, "name": forward_doc["name"]})
    
    return {"message": "Forward server added", "forward": forward_doc}


@router.get("/forward")
async def list_forward_servers(request: Request):
    """List all forward servers"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    
    servers = await db.biometric_forwards.find({"is_active": True}, {"_id": 0}).to_list(50)
    return servers


# ==================== HELPER FUNCTIONS ====================

def parse_biomax_json(data: dict) -> Optional[BiometricPunchData]:
    """Parse BioMax JSON format"""
    try:
        user_id = data.get("UserID") or data.get("userid") or data.get("user_id") or data.get("empid")
        if not user_id:
            return None
        
        # Parse time - BioMax usually sends "2024-01-15 09:00:00 GMT +0530"
        log_time_str = data.get("LogTime") or data.get("logtime") or data.get("log_time") or data.get("time")
        punch_time = parse_datetime(log_time_str) if log_time_str else datetime.now(timezone.utc)
        
        # Parse type
        punch_type_raw = data.get("Type") or data.get("type") or data.get("status") or "0"
        punch_type = parse_punch_type(punch_type_raw)
        
        # Input type
        input_type = data.get("InputType") or data.get("inputtype") or data.get("verify_type") or "unknown"
        input_type = input_type.lower() if isinstance(input_type, str) else "unknown"
        
        # Device serial
        device_serial = data.get("DeviceSerial") or data.get("device_serial") or data.get("sn") or data.get("serialnumber")
        
        return BiometricPunchData(
            user_id=str(user_id),
            punch_time=punch_time,
            punch_type=punch_type,
            device_serial=device_serial,
            input_type=input_type,
            raw_data=data
        )
    except Exception as e:
        logger.error(f"Error parsing BioMax JSON: {e}")
        return None


def parse_biomax_form(data: dict) -> Optional[BiometricPunchData]:
    """Parse BioMax form/query data format"""
    try:
        user_id = data.get("userid") or data.get("UserID") or data.get("empid") or data.get("id")
        if not user_id:
            return None
        
        log_time_str = data.get("logtime") or data.get("LogTime") or data.get("time") or data.get("datetime")
        punch_time = parse_datetime(log_time_str) if log_time_str else datetime.now(timezone.utc)
        
        punch_type_raw = data.get("type") or data.get("Type") or data.get("status") or "0"
        punch_type = parse_punch_type(punch_type_raw)
        
        device_serial = data.get("sn") or data.get("serial") or data.get("device")
        
        return BiometricPunchData(
            user_id=str(user_id),
            punch_time=punch_time,
            punch_type=punch_type,
            device_serial=device_serial,
            input_type="unknown",
            raw_data=data
        )
    except Exception as e:
        logger.error(f"Error parsing BioMax form data: {e}")
        return None


def parse_raw_data(raw: str) -> Optional[BiometricPunchData]:
    """Try to parse raw string data"""
    try:
        # Try key=value pairs
        if '=' in raw:
            pairs = {}
            for part in raw.replace('&', '\n').split('\n'):
                if '=' in part:
                    key, value = part.split('=', 1)
                    pairs[key.strip()] = value.strip()
            if pairs:
                return parse_biomax_form(pairs)
        
        # Try comma-separated
        if ',' in raw:
            parts = raw.split(',')
            if len(parts) >= 2:
                return BiometricPunchData(
                    user_id=parts[0].strip(),
                    punch_time=parse_datetime(parts[1].strip()) if len(parts) > 1 else datetime.now(timezone.utc),
                    punch_type="IN",
                    raw_data={"raw": raw}
                )
        
        return None
    except:
        return None


def parse_datetime(dt_str: str) -> datetime:
    """Parse various datetime formats"""
    if not dt_str:
        return datetime.now(timezone.utc)
    
    # Remove timezone suffix like "GMT +0530"
    dt_str = dt_str.strip()
    for tz in ["GMT", "UTC", "IST"]:
        if tz in dt_str:
            dt_str = dt_str.split(tz)[0].strip()
    
    # Try various formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt).replace(tzinfo=timezone.utc)
        except:
            continue
    
    # If all else fails, use current time
    logger.warning(f"Could not parse datetime: {dt_str}")
    return datetime.now(timezone.utc)


def parse_punch_type(type_val) -> str:
    """Parse punch type from various formats"""
    if isinstance(type_val, str):
        type_lower = type_val.lower()
        if type_lower in ["checkin", "check-in", "in", "0", "i"]:
            return "IN"
        elif type_lower in ["checkout", "check-out", "out", "1", "o"]:
            return "OUT"
        elif type_lower in ["break_out", "break-out", "2"]:
            return "BREAK_OUT"
        elif type_lower in ["break_in", "break-in", "3"]:
            return "BREAK_IN"
    elif isinstance(type_val, int):
        return "IN" if type_val == 0 else "OUT"
    
    return "IN"  # Default to IN


async def process_attendance_punch(punch_data: BiometricPunchData) -> dict:
    """Process and store attendance punch"""
    try:
        # Find employee mapping
        mapping = await db.biometric_mappings.find_one(
            {"biometric_id": punch_data.user_id, "is_active": True}
        )
        
        employee_id = mapping["employee_id"] if mapping else None
        employee_name = mapping.get("employee_name", "") if mapping else None
        
        # Get date string
        punch_date = punch_data.punch_time.strftime("%Y-%m-%d")
        punch_time_str = punch_data.punch_time.strftime("%H:%M:%S")
        
        # Log the raw punch
        log_doc = {
            "log_id": f"blog_{uuid.uuid4().hex[:12]}",
            "biometric_id": punch_data.user_id,
            "employee_id": employee_id,
            "employee_name": employee_name,
            "employee_code": punch_data.user_id,  # Use biometric ID as code if no mapping
            "date": punch_date,
            "punch_time": punch_time_str,
            "punch_type": punch_data.punch_type,
            "device_serial": punch_data.device_serial,
            "input_type": punch_data.input_type,
            "status": "matched" if employee_id else "unmatched",
            "raw_data": punch_data.raw_data,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "processed": False
        }
        
        await db.biometric_logs.insert_one(log_doc)
        
        # If we have an employee mapping, update their attendance
        if employee_id:
            await update_employee_attendance(
                employee_id=employee_id,
                date=punch_date,
                punch_time=punch_time_str,
                punch_type=punch_data.punch_type,
                source="biometric",
                device_serial=punch_data.device_serial
            )
            
            # Mark log as processed
            await db.biometric_logs.update_one(
                {"log_id": log_doc["log_id"]},
                {"$set": {"processed": True}}
            )
        
        # Update device last sync
        if punch_data.device_serial:
            await db.biometric_devices.update_one(
                {"serial_number": punch_data.device_serial},
                {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
            )
        
        return {
            "success": True,
            "employee_id": employee_id,
            "matched": employee_id is not None
        }
        
    except Exception as e:
        logger.error(f"Error processing attendance punch: {e}")
        return {"success": False, "error": str(e)}


async def update_employee_attendance(
    employee_id: str,
    date: str,
    punch_time: str,
    punch_type: str,
    source: str = "biometric",
    device_serial: str = None
):
    """Update or create attendance record for employee"""
    try:
        # Find existing attendance for this date
        existing = await db.attendance.find_one(
            {"employee_id": employee_id, "date": date}
        )
        
        punch_record = {
            "type": punch_type,
            "time": punch_time,
            "source": source,
            "device": device_serial
        }
        
        if existing:
            # Add punch to existing record
            punches = existing.get("punches", [])
            punches.append(punch_record)
            
            # Recalculate first_in and last_out
            in_times = [p["time"] for p in punches if p["type"] == "IN"]
            out_times = [p["time"] for p in punches if p["type"] == "OUT"]
            
            first_in = min(in_times) if in_times else existing.get("first_in")
            last_out = max(out_times) if out_times else existing.get("last_out")
            
            # Calculate total hours
            total_hours = None
            if first_in and last_out:
                from datetime import datetime as dt
                try:
                    t1 = dt.strptime(first_in, "%H:%M:%S" if ":" in first_in and first_in.count(":") == 2 else "%H:%M")
                    t2 = dt.strptime(last_out, "%H:%M:%S" if ":" in last_out and last_out.count(":") == 2 else "%H:%M")
                    total_hours = round((t2 - t1).seconds / 3600, 2)
                except:
                    pass
            
            await db.attendance.update_one(
                {"employee_id": employee_id, "date": date},
                {"$set": {
                    "punches": punches,
                    "first_in": first_in,
                    "last_out": last_out,
                    "total_hours": total_hours,
                    "status": "present",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new attendance record
            attendance_doc = {
                "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
                "employee_id": employee_id,
                "date": date,
                "first_in": punch_time if punch_type == "IN" else None,
                "last_out": punch_time if punch_type == "OUT" else None,
                "punches": [punch_record],
                "total_hours": None,
                "status": "present",
                "is_late": False,
                "late_minutes": 0,
                "overtime_hours": 0,
                "remarks": "Recorded via biometric",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.attendance.insert_one(attendance_doc)
            
    except Exception as e:
        logger.error(f"Error updating attendance: {e}")


async def forward_to_servers(raw_body: bytes, headers: dict):
    """Forward biometric data to other configured servers"""
    for server in FORWARD_SERVERS:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    server["url"],
                    content=raw_body,
                    headers={
                        "Content-Type": headers.get("content-type", "application/json")
                    },
                    timeout=10
                )
                logger.info(f"Forwarded to {server['name']}")
        except Exception as e:
            logger.error(f"Failed to forward to {server['name']}: {e}")


# ==================== INITIALIZATION ====================

async def load_forward_servers():
    """Load forward servers from database on startup"""
    global FORWARD_SERVERS
    try:
        servers = await db.biometric_forwards.find({"is_active": True}).to_list(50)
        FORWARD_SERVERS = [{"url": s["url"], "name": s["name"]} for s in servers]
        logger.info(f"Loaded {len(FORWARD_SERVERS)} forward servers")
    except:
        pass


async def load_registered_devices():
    """Load registered devices from database on startup"""
    global REGISTERED_DEVICES
    try:
        devices = await db.biometric_devices.find({}).to_list(100)
        REGISTERED_DEVICES = {d["serial_number"]: d for d in devices}
        logger.info(f"Loaded {len(REGISTERED_DEVICES)} registered devices")
    except:
        pass
