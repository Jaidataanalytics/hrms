"""Internal Meeting Management System API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/meetings", tags=["Meetings"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


async def create_notification(user_id: str, title: str, message: str, 
                              type: str, module: str, link: str = None,
                              meeting_id: str = None, notification_type: str = "general"):
    """Create in-app notification"""
    notif = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "module": module,
        "link": link,
        "meeting_id": meeting_id,
        "notification_type": notification_type,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif)
    return notif


async def log_meeting_activity(meeting_id: str, action: str, user_id: str, 
                                user_name: str, details: dict = None,
                                field_changed: str = None, old_value: str = None, 
                                new_value: str = None):
    """Log activity/changes for a meeting"""
    activity = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "meeting_id": meeting_id,
        "action": action,
        "user_id": user_id,
        "user_name": user_name,
        "field_changed": field_changed,
        "old_value": old_value,
        "new_value": new_value,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.meeting_activities.insert_one(activity)
    return activity


# ==================== MEETINGS CRUD ====================

@router.get("/list")
async def list_meetings(
    request: Request,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    series_id: Optional[str] = None
):
    """List meetings for the current user (organized or participant)"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    # Build query
    if is_hr:
        # HR can see all meetings
        query = {}
    else:
        # Regular users see meetings they organize or participate in
        query = {
            "$or": [
                {"organizer_id": user.get("user_id")},
                {"organizer_employee_id": employee_id},
                {"participants": employee_id}
            ]
        }
    
    if status:
        query["status"] = status
    
    if from_date:
        query.setdefault("meeting_date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("meeting_date", {})["$lte"] = to_date
    
    if series_id:
        query["series_id"] = series_id
    
    meetings = await db.internal_meetings.find(query, {"_id": 0}).sort([("meeting_date", 1), ("start_time", 1)]).to_list(500)
    
    # Enrich with participant names
    for meeting in meetings:
        await enrich_meeting_data(meeting)
    
    return meetings


async def enrich_meeting_data(meeting: dict):
    """Add employee names and other enriched data to meeting"""
    # Get organizer name
    if meeting.get("organizer_employee_id"):
        org = await db.employees.find_one({"employee_id": meeting["organizer_employee_id"]}, {"_id": 0})
        if org:
            meeting["organizer_name"] = f"{org.get('first_name', '')} {org.get('last_name', '')}".strip()
    
    # Get participant names
    participant_names = []
    if meeting.get("participants"):
        for pid in meeting["participants"]:
            emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0})
            if emp:
                participant_names.append({
                    "employee_id": pid,
                    "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                })
    meeting["participant_details"] = participant_names
    
    # Get previous meeting info if part of series
    if meeting.get("previous_meeting_id"):
        prev = await db.internal_meetings.find_one(
            {"meeting_id": meeting["previous_meeting_id"]}, 
            {"_id": 0, "subject": 1, "meeting_date": 1}
        )
        if prev:
            meeting["previous_meeting_info"] = prev
    
    # Get follow-up meeting info
    if meeting.get("next_meeting_id"):
        next_m = await db.internal_meetings.find_one(
            {"meeting_id": meeting["next_meeting_id"]}, 
            {"_id": 0, "subject": 1, "meeting_date": 1}
        )
        if next_m:
            meeting["next_meeting_info"] = next_m


@router.post("/create")
async def create_meeting(data: dict, request: Request):
    """Create a new internal meeting"""
    user = await get_current_user(request)
    
    if not data.get("subject"):
        raise HTTPException(status_code=400, detail="Subject is required")
    if not data.get("meeting_date"):
        raise HTTPException(status_code=400, detail="Meeting date is required")
    if not data.get("start_time"):
        raise HTTPException(status_code=400, detail="Start time is required")
    
    meeting_id = f"mtg_{uuid.uuid4().hex[:12]}"
    series_id = data.get("series_id") or f"series_{uuid.uuid4().hex[:8]}"
    
    meeting = {
        "meeting_id": meeting_id,
        "series_id": series_id,
        "subject": data.get("subject"),
        "meeting_date": data.get("meeting_date"),
        "start_time": data.get("start_time"),
        "end_time": data.get("end_time", ""),
        "location": data.get("location", ""),
        "participants": data.get("participants", []),
        
        # Meeting content
        "agenda_items": data.get("agenda_items", []),  # Things to focus on
        "discussion_notes": [],  # Added during/after meeting
        "follow_up_points": [],  # Points for next meeting
        "next_meeting_date": data.get("next_meeting_date"),
        
        # Linking
        "previous_meeting_id": data.get("previous_meeting_id"),
        "next_meeting_id": None,
        
        # Status
        "status": "scheduled",  # scheduled, in_progress, completed, cancelled
        
        # Metadata
        "organizer_id": user.get("user_id"),
        "organizer_employee_id": user.get("employee_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_meetings.insert_one(meeting)
    meeting.pop('_id', None)
    
    # If this is a follow-up meeting, link it to the previous one
    if data.get("previous_meeting_id"):
        await db.internal_meetings.update_one(
            {"meeting_id": data["previous_meeting_id"]},
            {"$set": {"next_meeting_id": meeting_id}}
        )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "created", user.get("user_id"),
        user.get("name", "Unknown"), 
        details={"subject": meeting["subject"]}
    )
    
    # Send notifications to participants
    for pid in meeting.get("participants", []):
        # Look up user by employee_id
        participant_user = await db.users.find_one({"employee_id": pid}, {"_id": 0, "user_id": 1})
        if participant_user:
            await create_notification(
                participant_user["user_id"],
                "Meeting Invitation",
                f"You've been invited to: {meeting['subject']} on {meeting['meeting_date']} at {meeting['start_time']}",
                "info", "meetings",
                link=f"/dashboard/meetings/{meeting_id}",
                meeting_id=meeting_id,
                notification_type="meeting_invite"
            )
    
    await enrich_meeting_data(meeting)
    return meeting


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str, request: Request):
    """Get a specific meeting with full details"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check access
    is_organizer = meeting.get("organizer_id") == user.get("user_id")
    is_participant = employee_id in meeting.get("participants", [])
    
    if not (is_hr or is_organizer or is_participant):
        raise HTTPException(status_code=403, detail="Not authorized to view this meeting")
    
    await enrich_meeting_data(meeting)
    
    # Get activity log
    activities = await db.meeting_activities.find(
        {"meeting_id": meeting_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    meeting["activities"] = activities
    
    return meeting


@router.put("/{meeting_id}")
async def update_meeting(meeting_id: str, data: dict, request: Request):
    """Update meeting details"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check permission
    is_organizer = meeting.get("organizer_id") == user.get("user_id")
    is_participant = employee_id in meeting.get("participants", [])
    
    if not (is_hr or is_organizer or is_participant):
        raise HTTPException(status_code=403, detail="Not authorized to update this meeting")
    
    # Track changes for activity log
    changes = []
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Basic info (only organizer can change)
    if is_organizer or is_hr:
        if "subject" in data and data["subject"] != meeting.get("subject"):
            changes.append(("subject", meeting.get("subject"), data["subject"]))
            update_data["subject"] = data["subject"]
        
        if "meeting_date" in data and data["meeting_date"] != meeting.get("meeting_date"):
            changes.append(("meeting_date", meeting.get("meeting_date"), data["meeting_date"]))
            update_data["meeting_date"] = data["meeting_date"]
        
        if "start_time" in data:
            update_data["start_time"] = data["start_time"]
        if "end_time" in data:
            update_data["end_time"] = data["end_time"]
        if "location" in data:
            update_data["location"] = data["location"]
        if "participants" in data:
            # Notify new participants
            old_participants = set(meeting.get("participants", []))
            new_participants = set(data["participants"])
            newly_added = new_participants - old_participants
            
            for pid in newly_added:
                emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0})
                if emp and emp.get("user_id"):
                    await create_notification(
                        emp["user_id"],
                        "Meeting Invitation",
                        f"You've been added to: {meeting['subject']}",
                        "info", "meetings",
                        meeting_id=meeting_id,
                        notification_type="meeting_invite"
                    )
            
            update_data["participants"] = data["participants"]
        
        if "agenda_items" in data:
            update_data["agenda_items"] = data["agenda_items"]
        
        if "status" in data:
            update_data["status"] = data["status"]
        
        if "next_meeting_date" in data:
            update_data["next_meeting_date"] = data["next_meeting_date"]
    
    # Anyone can add discussion notes and follow-ups
    if "follow_up_points" in data:
        update_data["follow_up_points"] = data["follow_up_points"]
    
    await db.internal_meetings.update_one({"meeting_id": meeting_id}, {"$set": update_data})
    
    # Log changes
    for field, old_val, new_val in changes:
        await log_meeting_activity(
            meeting_id, "updated", user.get("user_id"),
            user.get("name", "Unknown"),
            field_changed=field, old_value=str(old_val), new_value=str(new_val)
        )
    
    updated = await db.internal_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    await enrich_meeting_data(updated)
    return updated


@router.post("/{meeting_id}/notes")
async def add_discussion_note(meeting_id: str, data: dict, request: Request):
    """Add a discussion note to a meeting"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check access
    is_organizer = meeting.get("organizer_id") == user.get("user_id")
    is_participant = employee_id in meeting.get("participants", [])
    
    if not (is_hr or is_organizer or is_participant):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not data.get("content"):
        raise HTTPException(status_code=400, detail="Note content is required")
    
    note = {
        "note_id": f"note_{uuid.uuid4().hex[:8]}",
        "content": data.get("content"),
        "added_by": user.get("user_id"),
        "added_by_name": user.get("name", "Unknown"),
        "added_by_employee_id": employee_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$push": {"discussion_notes": note}}
    )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "note_added", user.get("user_id"),
        user.get("name", "Unknown"),
        details={"note_preview": data.get("content")[:100]}
    )
    
    return note


@router.put("/{meeting_id}/notes/{note_id}")
async def update_discussion_note(meeting_id: str, note_id: str, data: dict, request: Request):
    """Edit a discussion note"""
    user = await get_current_user(request)
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Find the note
    notes = meeting.get("discussion_notes", [])
    note_idx = None
    old_content = None
    for i, note in enumerate(notes):
        if note.get("note_id") == note_id:
            note_idx = i
            old_content = note.get("content")
            break
    
    if note_idx is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only the note author can edit
    if notes[note_idx].get("added_by") != user.get("user_id"):
        raise HTTPException(status_code=403, detail="Only the author can edit this note")
    
    # Update the note
    notes[note_idx]["content"] = data.get("content")
    notes[note_idx]["edited_at"] = datetime.now(timezone.utc).isoformat()
    notes[note_idx]["edit_history"] = notes[note_idx].get("edit_history", [])
    notes[note_idx]["edit_history"].append({
        "old_content": old_content,
        "edited_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"discussion_notes": notes}}
    )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "note_edited", user.get("user_id"),
        user.get("name", "Unknown"),
        field_changed="discussion_note",
        old_value=old_content[:50] if old_content else "",
        new_value=data.get("content", "")[:50]
    )
    
    return notes[note_idx]


@router.delete("/{meeting_id}/notes/{note_id}")
async def delete_discussion_note(meeting_id: str, note_id: str, request: Request):
    """Delete a discussion note"""
    user = await get_current_user(request)
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    notes = meeting.get("discussion_notes", [])
    note_to_delete = None
    for note in notes:
        if note.get("note_id") == note_id:
            note_to_delete = note
            break
    
    if not note_to_delete:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author or HR can delete
    if note_to_delete.get("added_by") != user.get("user_id") and not is_hr:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")
    
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$pull": {"discussion_notes": {"note_id": note_id}}}
    )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "note_removed", user.get("user_id"),
        user.get("name", "Unknown"),
        details={"deleted_note": note_to_delete.get("content", "")[:50]}
    )
    
    return {"message": "Note deleted"}


@router.post("/{meeting_id}/schedule-followup")
async def schedule_followup_meeting(meeting_id: str, data: dict, request: Request):
    """Schedule a follow-up meeting with agenda items from current meeting's follow-up points"""
    user = await get_current_user(request)
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Only organizer can schedule follow-up
    if meeting.get("organizer_id") != user.get("user_id"):
        is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
        if not is_hr:
            raise HTTPException(status_code=403, detail="Only organizer can schedule follow-up")
    
    if not data.get("meeting_date"):
        raise HTTPException(status_code=400, detail="Meeting date is required")
    if not data.get("start_time"):
        raise HTTPException(status_code=400, detail="Start time is required")
    
    # Create follow-up meeting with follow-up points as agenda
    followup_agenda = []
    for point in meeting.get("follow_up_points", []):
        followup_agenda.append({
            "item_id": f"item_{uuid.uuid4().hex[:8]}",
            "content": point.get("content") if isinstance(point, dict) else point,
            "from_previous_meeting": True,
            "status": "pending"
        })
    
    # Add any new agenda items
    for item in data.get("additional_agenda", []):
        followup_agenda.append({
            "item_id": f"item_{uuid.uuid4().hex[:8]}",
            "content": item,
            "from_previous_meeting": False,
            "status": "pending"
        })
    
    followup_data = {
        "subject": data.get("subject") or f"Follow-up: {meeting['subject']}",
        "meeting_date": data["meeting_date"],
        "start_time": data["start_time"],
        "end_time": data.get("end_time", ""),
        "location": data.get("location", meeting.get("location", "")),
        "participants": data.get("participants", meeting.get("participants", [])),
        "agenda_items": followup_agenda,
        "series_id": meeting.get("series_id"),
        "previous_meeting_id": meeting_id
    }
    
    # Create the follow-up meeting
    followup = await create_meeting(followup_data, request)
    
    # Update original meeting status
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {
            "next_meeting_id": followup["meeting_id"],
            "next_meeting_date": data["meeting_date"],
            "status": "completed"
        }}
    )
    
    return followup


@router.get("/{meeting_id}/series")
async def get_meeting_series(meeting_id: str, request: Request):
    """Get all meetings in the same series (meeting chain)"""
    user = await get_current_user(request)
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    series_id = meeting.get("series_id")
    if not series_id:
        return [meeting]
    
    series = await db.internal_meetings.find(
        {"series_id": series_id}, {"_id": 0}
    ).sort("meeting_date", 1).to_list(100)
    
    for m in series:
        await enrich_meeting_data(m)
    
    return series


@router.delete("/{meeting_id}")
async def cancel_meeting(meeting_id: str, request: Request):
    """Cancel a meeting"""
    user = await get_current_user(request)
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Only organizer or HR can cancel
    if meeting.get("organizer_id") != user.get("user_id") and not is_hr:
        raise HTTPException(status_code=403, detail="Only organizer can cancel meeting")
    
    # Update status instead of deleting
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user.get("user_id")
        }}
    )
    
    # Notify participants
    for pid in meeting.get("participants", []):
        emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0})
        if emp and emp.get("user_id"):
            await create_notification(
                emp["user_id"],
                "Meeting Cancelled",
                f"Meeting '{meeting['subject']}' on {meeting['meeting_date']} has been cancelled",
                "warning", "meetings",
                meeting_id=meeting_id,
                notification_type="meeting_cancelled"
            )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "cancelled", user.get("user_id"),
        user.get("name", "Unknown")
    )
    
    return {"message": "Meeting cancelled"}


# ==================== FOLLOW-UP POINTS ====================

@router.post("/{meeting_id}/followups")
async def add_followup_point(meeting_id: str, data: dict, request: Request):
    """Add a follow-up point to a meeting"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check access
    is_organizer = meeting.get("organizer_id") == user.get("user_id")
    is_participant = employee_id in meeting.get("participants", [])
    
    if not (is_hr or is_organizer or is_participant):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    followup = {
        "followup_id": f"fu_{uuid.uuid4().hex[:8]}",
        "content": data.get("content"),
        "assigned_to": data.get("assigned_to"),
        "status": "pending",  # pending, completed
        "added_by": user.get("user_id"),
        "added_by_name": user.get("name", "Unknown"),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$push": {"follow_up_points": followup}}
    )
    
    # Log activity
    await log_meeting_activity(
        meeting_id, "followup_added", user.get("user_id"),
        user.get("name", "Unknown"),
        details={"content": data.get("content", "")[:50]}
    )
    
    return followup


@router.put("/{meeting_id}/followups/{followup_id}")
async def update_followup_status(meeting_id: str, followup_id: str, data: dict, request: Request):
    """Update follow-up point status (mark as completed)"""
    user = await get_current_user(request)
    
    meeting = await db.internal_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    followups = meeting.get("follow_up_points", [])
    for i, fu in enumerate(followups):
        if fu.get("followup_id") == followup_id:
            followups[i]["status"] = data.get("status", "completed")
            followups[i]["completed_at"] = datetime.now(timezone.utc).isoformat() if data.get("status") == "completed" else None
            followups[i]["completed_by"] = user.get("user_id") if data.get("status") == "completed" else None
            break
    
    await db.internal_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"follow_up_points": followups}}
    )
    
    return {"message": "Follow-up updated"}


# ==================== ANALYTICS ====================

@router.get("/analytics/overview")
async def get_meeting_analytics(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    """Get comprehensive meeting analytics"""
    user = await get_current_user(request)
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    if not is_hr:
        raise HTTPException(status_code=403, detail="HR/Admin access required")
    
    # Default date range: last 30 days
    if not from_date:
        from_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {
        "meeting_date": {"$gte": from_date, "$lte": to_date},
        "status": {"$ne": "cancelled"}
    }
    
    if employee_id:
        query["$or"] = [
            {"organizer_employee_id": employee_id},
            {"participants": employee_id}
        ]
    
    meetings = await db.internal_meetings.find(query, {"_id": 0}).to_list(5000)
    
    # Basic stats
    total_meetings = len(meetings)
    completed_meetings = sum(1 for m in meetings if m.get("status") == "completed")
    
    # Meetings by department
    dept_stats = defaultdict(lambda: {"count": 0, "participants": set()})
    
    # Per employee stats
    employee_stats = defaultdict(lambda: {"organized": 0, "attended": 0, "total_hours": 0})
    
    # Follow-up completion tracking
    total_followups = 0
    completed_followups = 0
    
    # Meeting frequency by day of week
    day_frequency = defaultdict(int)
    
    # Time between meetings in a series
    series_gaps = []
    
    for meeting in meetings:
        # Day frequency
        meeting_date = datetime.strptime(meeting["meeting_date"], "%Y-%m-%d")
        day_frequency[meeting_date.strftime("%A")] += 1
        
        # Employee stats
        org_id = meeting.get("organizer_employee_id")
        if org_id:
            employee_stats[org_id]["organized"] += 1
        
        for pid in meeting.get("participants", []):
            employee_stats[pid]["attended"] += 1
        
        # Follow-up stats
        for fu in meeting.get("follow_up_points", []):
            total_followups += 1
            if fu.get("status") == "completed":
                completed_followups += 1
        
        # Series gap calculation
        if meeting.get("previous_meeting_id"):
            prev = await db.internal_meetings.find_one(
                {"meeting_id": meeting["previous_meeting_id"]},
                {"_id": 0, "meeting_date": 1}
            )
            if prev:
                prev_date = datetime.strptime(prev["meeting_date"], "%Y-%m-%d")
                curr_date = datetime.strptime(meeting["meeting_date"], "%Y-%m-%d")
                gap = (curr_date - prev_date).days
                series_gaps.append(gap)
    
    # Calculate averages
    avg_meetings_per_day = total_meetings / max((datetime.strptime(to_date, "%Y-%m-%d") - datetime.strptime(from_date, "%Y-%m-%d")).days, 1)
    followup_completion_rate = (completed_followups / total_followups * 100) if total_followups > 0 else 0
    avg_time_between_meetings = sum(series_gaps) / len(series_gaps) if series_gaps else 0
    
    # Get top organizers and attendees
    emp_ids = list(employee_stats.keys())
    employees = await db.employees.find(
        {"employee_id": {"$in": emp_ids}},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "department": 1}
    ).to_list(500)
    emp_map = {e["employee_id"]: e for e in employees}
    
    top_organizers = sorted(
        [{"employee_id": k, "name": f"{emp_map.get(k, {}).get('first_name', '')} {emp_map.get(k, {}).get('last_name', '')}".strip(), **v} 
         for k, v in employee_stats.items()],
        key=lambda x: x["organized"], reverse=True
    )[:10]
    
    top_attendees = sorted(
        [{"employee_id": k, "name": f"{emp_map.get(k, {}).get('first_name', '')} {emp_map.get(k, {}).get('last_name', '')}".strip(), **v}
         for k, v in employee_stats.items()],
        key=lambda x: x["attended"], reverse=True
    )[:10]
    
    # Meeting trend (weekly)
    weekly_trend = defaultdict(int)
    for meeting in meetings:
        meeting_date = datetime.strptime(meeting["meeting_date"], "%Y-%m-%d")
        week_start = meeting_date - timedelta(days=meeting_date.weekday())
        weekly_trend[week_start.strftime("%Y-%m-%d")] += 1
    
    return {
        "date_range": {"from": from_date, "to": to_date},
        "overview": {
            "total_meetings": total_meetings,
            "completed_meetings": completed_meetings,
            "avg_meetings_per_day": round(avg_meetings_per_day, 2),
            "total_followups": total_followups,
            "completed_followups": completed_followups,
            "followup_completion_rate": round(followup_completion_rate, 1),
            "avg_days_between_followup_meetings": round(avg_time_between_meetings, 1)
        },
        "day_frequency": dict(sorted(day_frequency.items(), key=lambda x: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].index(x[0]))),
        "weekly_trend": dict(sorted(weekly_trend.items())),
        "top_organizers": top_organizers,
        "top_attendees": top_attendees
    }


@router.get("/analytics/employee/{employee_id}")
async def get_employee_meeting_stats(employee_id: str, request: Request):
    """Get meeting statistics for a specific employee"""
    user = await get_current_user(request)
    is_hr = user.get("role") in ["super_admin", "hr_admin", "hr_executive"]
    
    # Employee can view their own stats, HR can view anyone's
    if not is_hr and user.get("employee_id") != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get meetings organized by or participated in by this employee
    meetings = await db.internal_meetings.find({
        "$or": [
            {"organizer_employee_id": employee_id},
            {"participants": employee_id}
        ],
        "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(500)
    
    organized = sum(1 for m in meetings if m.get("organizer_employee_id") == employee_id)
    attended = sum(1 for m in meetings if employee_id in m.get("participants", []))
    
    # Follow-up completion for this employee
    assigned_followups = 0
    completed_assigned = 0
    
    for meeting in meetings:
        for fu in meeting.get("follow_up_points", []):
            if fu.get("assigned_to") == employee_id:
                assigned_followups += 1
                if fu.get("status") == "completed":
                    completed_assigned += 1
    
    # Monthly trend
    monthly_trend = defaultdict(int)
    for meeting in meetings:
        month = meeting["meeting_date"][:7]
        monthly_trend[month] += 1
    
    return {
        "employee_id": employee_id,
        "total_meetings": len(meetings),
        "organized": organized,
        "attended": attended,
        "assigned_followups": assigned_followups,
        "completed_followups": completed_assigned,
        "followup_completion_rate": round((completed_assigned / assigned_followups * 100) if assigned_followups > 0 else 0, 1),
        "monthly_trend": dict(sorted(monthly_trend.items()))
    }


# ==================== NOTIFICATIONS ====================

@router.get("/notifications/pending")
async def get_pending_meeting_notifications(request: Request):
    """Get meetings that need notification reminders (for background job)"""
    # This endpoint is for the notification service/background job
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Find meetings for today that haven't been notified
    meetings_today = await db.internal_meetings.find({
        "meeting_date": today,
        "status": "scheduled"
    }, {"_id": 0}).to_list(200)
    
    notifications_to_send = []
    
    for meeting in meetings_today:
        start_time = meeting.get("start_time", "")
        if not start_time:
            continue
        
        # Parse meeting time
        try:
            meeting_datetime = datetime.strptime(f"{today} {start_time}", "%Y-%m-%d %H:%M")
            meeting_datetime = meeting_datetime.replace(tzinfo=timezone.utc)
        except:
            continue
        
        time_diff = (meeting_datetime - now).total_seconds() / 60  # minutes
        
        # Check if we should send notification
        # Morning notification at 9 AM
        morning_notif_key = f"morning_{meeting['meeting_id']}"
        if current_time >= "09:00" and not meeting.get(f"notified_{morning_notif_key}"):
            notifications_to_send.append({
                "meeting": meeting,
                "type": "morning",
                "message": f"Today's meeting: {meeting['subject']} at {start_time}"
            })
        
        # 1 hour before notification
        hour_before_key = f"hour_before_{meeting['meeting_id']}"
        if 55 <= time_diff <= 65 and not meeting.get(f"notified_{hour_before_key}"):
            notifications_to_send.append({
                "meeting": meeting,
                "type": "hour_before",
                "message": f"Meeting in 1 hour: {meeting['subject']}"
            })
    
    return notifications_to_send


@router.post("/notifications/send")
async def send_meeting_notifications(request: Request):
    """Send meeting notifications (called by background job)"""
    pending = await get_pending_meeting_notifications(request)
    
    sent_count = 0
    for item in pending:
        meeting = item["meeting"]
        notif_type = item["type"]
        message = item["message"]
        
        # Send to organizer
        if meeting.get("organizer_id"):
            await create_notification(
                meeting["organizer_id"],
                "Meeting Reminder",
                message,
                "info", "meetings",
                link=f"/dashboard/meetings/{meeting['meeting_id']}",
                meeting_id=meeting["meeting_id"],
                notification_type=f"meeting_{notif_type}"
            )
            sent_count += 1
        
        # Send to participants
        for pid in meeting.get("participants", []):
            emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0})
            if emp and emp.get("user_id"):
                await create_notification(
                    emp["user_id"],
                    "Meeting Reminder",
                    message,
                    "info", "meetings",
                    link=f"/dashboard/meetings/{meeting['meeting_id']}",
                    meeting_id=meeting["meeting_id"],
                    notification_type=f"meeting_{notif_type}"
                )
                sent_count += 1
        
        # Mark as notified
        await db.internal_meetings.update_one(
            {"meeting_id": meeting["meeting_id"]},
            {"$set": {f"notified_{notif_type}_{meeting['meeting_id']}": True}}
        )
    
    return {"sent": sent_count}
