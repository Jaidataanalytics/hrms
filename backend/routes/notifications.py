"""Notifications API Routes - Bell Icon Notifications"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/notifications", tags=["Notifications"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


@router.get("/list")
async def list_notifications(
    request: Request,
    is_read: Optional[bool] = None,
    module: Optional[str] = None,
    limit: int = 50
):
    """Get notifications for the current user"""
    user = await get_current_user(request)
    
    query = {"user_id": user.get("user_id")}
    
    if is_read is not None:
        query["is_read"] = is_read
    
    if module:
        query["module"] = module
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications


@router.get("/unread-count")
async def get_unread_count(request: Request):
    """Get count of unread notifications"""
    user = await get_current_user(request)
    
    count = await db.notifications.count_documents({
        "user_id": user.get("user_id"),
        "is_read": False
    })
    
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, request: Request):
    """Mark a single notification as read"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.get("user_id")},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}


@router.put("/mark-all-read")
async def mark_all_as_read(request: Request):
    """Mark all notifications as read for the current user"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_many(
        {"user_id": user.get("user_id"), "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": user.get("user_id")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}


@router.delete("/clear-all")
async def clear_all_notifications(request: Request):
    """Clear all notifications for the current user"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_many({
        "user_id": user.get("user_id")
    })
    
    return {"message": f"Deleted {result.deleted_count} notifications"}
