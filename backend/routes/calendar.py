"""Calendar Tasks & Meetings API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/calendar", tags=["Calendar"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== TASKS ====================

@router.get("/tasks")
async def list_tasks(
    request: Request,
    month: Optional[str] = None,
    assigned_to: Optional[str] = None,
    completed: Optional[bool] = None
):
    """List tasks for the current user or assigned to them"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    # Build query - tasks created by user OR assigned to user
    query = {
        "$or": [
            {"created_by": user.get("user_id")},
            {"assigned_to": employee_id},
            {"assigned_to": ""},  # Self-assigned tasks
            {"assigned_to": None}
        ]
    }
    
    if month:
        # Filter by month (YYYY-MM format)
        query["due_date"] = {"$regex": f"^{month}"}
    
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    if completed is not None:
        query["completed"] = completed
    
    tasks = await db.calendar_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    
    # Enrich with assignee names
    for task in tasks:
        if task.get("assigned_to"):
            emp = await db.employees.find_one({"employee_id": task["assigned_to"]}, {"_id": 0})
            if emp:
                task["assigned_to_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    
    return tasks


@router.post("/tasks")
async def create_task(data: dict, request: Request):
    """Create a new task"""
    user = await get_current_user(request)
    
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")
    
    if not data.get("due_date"):
        raise HTTPException(status_code=400, detail="Due date is required")
    
    task = {
        "task_id": f"task_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "description": data.get("description", ""),
        "due_date": data.get("due_date"),
        "due_time": data.get("due_time", ""),
        "priority": data.get("priority", "medium"),
        "assigned_to": data.get("assigned_to") or user.get("employee_id"),
        "completed": False,
        "completed_at": None,
        "created_by": user.get("user_id"),
        "created_by_employee_id": user.get("employee_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.calendar_tasks.insert_one(task)
    task.pop('_id', None)
    
    # Send notification to assigned employee if different from creator
    assigned_to = task.get("assigned_to")
    if assigned_to and assigned_to != user.get("employee_id"):
        assignee_user = await db.users.find_one({"employee_id": assigned_to}, {"_id": 0, "user_id": 1})
        if assignee_user:
            from server import create_notification
            await create_notification(
                assignee_user["user_id"],
                "New Task Assigned",
                f"You've been assigned: {task['title']} (Due: {task['due_date']})",
                "info", "calendar",
                link="/dashboard/my-calendar"
            )
    
    return task


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    """Get a specific task"""
    user = await get_current_user(request)
    
    task = await db.calendar_tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: dict, request: Request):
    """Update a task"""
    user = await get_current_user(request)
    
    task = await db.calendar_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permission
    is_owner = task.get("created_by") == user.get("user_id")
    is_assignee = task.get("assigned_to") == user.get("employee_id")
    
    if not (is_owner or is_assignee):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "title": data.get("title", task.get("title")),
        "description": data.get("description", task.get("description")),
        "due_date": data.get("due_date", task.get("due_date")),
        "due_time": data.get("due_time", task.get("due_time")),
        "priority": data.get("priority", task.get("priority")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if "completed" in data:
        update_data["completed"] = data["completed"]
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat() if data["completed"] else None
    
    await db.calendar_tasks.update_one({"task_id": task_id}, {"$set": update_data})
    
    return await db.calendar_tasks.find_one({"task_id": task_id}, {"_id": 0})


@router.put("/tasks/{task_id}/toggle")
async def toggle_task_completion(task_id: str, request: Request):
    """Toggle task completion status"""
    user = await get_current_user(request)
    
    task = await db.calendar_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    new_status = not task.get("completed", False)
    
    await db.calendar_tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "completed": new_status,
            "completed_at": datetime.now(timezone.utc).isoformat() if new_status else None,
            "completed_by": user.get("user_id") if new_status else None
        }}
    )
    
    return {"completed": new_status}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    """Delete a task"""
    user = await get_current_user(request)
    
    task = await db.calendar_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permission
    is_owner = task.get("created_by") == user.get("user_id")
    
    if not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.calendar_tasks.delete_one({"task_id": task_id})
    
    return {"message": "Task deleted"}


# ==================== MEETINGS ====================

@router.get("/meetings")
async def list_meetings(
    request: Request,
    month: Optional[str] = None,
    date: Optional[str] = None
):
    """List meetings for the current user"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    # Build query - meetings organized by user OR where user is a participant
    query = {
        "$or": [
            {"organizer_id": user.get("user_id")},
            {"organizer_employee_id": employee_id},
            {"participants": employee_id}
        ]
    }
    
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    if date:
        query["date"] = date
    
    meetings = await db.calendar_meetings.find(query, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).to_list(200)
    
    # Enrich with organizer and participant names
    for meeting in meetings:
        # Get organizer name
        if meeting.get("organizer_employee_id"):
            org = await db.employees.find_one({"employee_id": meeting["organizer_employee_id"]}, {"_id": 0})
            if org:
                meeting["organizer_name"] = f"{org.get('first_name', '')} {org.get('last_name', '')}".strip()
        
        # Get participant names
        if meeting.get("participants"):
            participant_names = []
            for pid in meeting["participants"]:
                emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0})
                if emp:
                    participant_names.append(f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip())
            meeting["participant_names"] = participant_names
    
    return meetings


@router.post("/meetings")
async def create_meeting(data: dict, request: Request):
    """Create a new meeting"""
    user = await get_current_user(request)
    
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")
    
    if not data.get("date"):
        raise HTTPException(status_code=400, detail="Date is required")
    
    if not data.get("start_time"):
        raise HTTPException(status_code=400, detail="Start time is required")
    
    meeting = {
        "meeting_id": f"meet_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "description": data.get("description", ""),
        "date": data.get("date"),
        "start_time": data.get("start_time"),
        "end_time": data.get("end_time", ""),
        "participants": data.get("participants", []),
        "meeting_link": data.get("meeting_link", ""),
        "location": data.get("location", ""),
        "status": "scheduled",
        "organizer_id": user.get("user_id"),
        "organizer_employee_id": user.get("employee_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.calendar_meetings.insert_one(meeting)
    meeting.pop('_id', None)
    
    # TODO: Send calendar invites to participants via email/Teams
    
    return meeting


@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, request: Request):
    """Get a specific meeting"""
    user = await get_current_user(request)
    
    meeting = await db.calendar_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return meeting


@router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, data: dict, request: Request):
    """Update a meeting"""
    user = await get_current_user(request)
    
    meeting = await db.calendar_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check permission - only organizer can update
    if meeting.get("organizer_id") != user.get("user_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "title": data.get("title", meeting.get("title")),
        "description": data.get("description", meeting.get("description")),
        "date": data.get("date", meeting.get("date")),
        "start_time": data.get("start_time", meeting.get("start_time")),
        "end_time": data.get("end_time", meeting.get("end_time")),
        "participants": data.get("participants", meeting.get("participants")),
        "meeting_link": data.get("meeting_link", meeting.get("meeting_link")),
        "location": data.get("location", meeting.get("location")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.calendar_meetings.update_one({"meeting_id": meeting_id}, {"$set": update_data})
    
    return await db.calendar_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})


@router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, request: Request):
    """Cancel/delete a meeting"""
    user = await get_current_user(request)
    
    meeting = await db.calendar_meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check permission - only organizer can delete
    if meeting.get("organizer_id") != user.get("user_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.calendar_meetings.delete_one({"meeting_id": meeting_id})
    
    # TODO: Send cancellation notification to participants
    
    return {"message": "Meeting cancelled"}


# ==================== ASSIGNED TASKS ====================

@router.get("/assigned-tasks")
async def get_assigned_tasks(request: Request):
    """Get tasks assigned to the current user by others"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    tasks = await db.calendar_tasks.find({
        "assigned_to": employee_id,
        "created_by_employee_id": {"$ne": employee_id}
    }, {"_id": 0}).sort("due_date", 1).to_list(100)
    
    # Enrich with creator names
    for task in tasks:
        if task.get("created_by_employee_id"):
            emp = await db.employees.find_one({"employee_id": task["created_by_employee_id"]}, {"_id": 0})
            if emp:
                task["assigned_by_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    
    return tasks
