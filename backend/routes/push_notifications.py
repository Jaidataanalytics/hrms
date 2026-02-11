"""Push Notification API Routes — FCM token registration and sending"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import httpx
import logging

router = APIRouter(prefix="/push", tags=["Push Notifications"])

logger = logging.getLogger(__name__)

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

FIREBASE_SERVER_KEY = os.environ.get('FIREBASE_SERVER_KEY', '')


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


@router.post("/register-token")
async def register_device_token(data: dict, request: Request):
    """Register or update a device's FCM push token"""
    user = await get_current_user(request)

    token = data.get("token")
    platform = data.get("platform", "android")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    await db.push_tokens.update_one(
        {"user_id": user["user_id"], "token": token},
        {"$set": {
            "user_id": user["user_id"],
            "employee_id": user.get("employee_id"),
            "token": token,
            "platform": platform,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Token registered"}


@router.delete("/unregister-token")
async def unregister_device_token(data: dict, request: Request):
    """Remove a device token (e.g., on logout)"""
    user = await get_current_user(request)
    token = data.get("token")
    if token:
        await db.push_tokens.delete_one({"user_id": user["user_id"], "token": token})
    else:
        await db.push_tokens.delete_many({"user_id": user["user_id"]})
    return {"message": "Token removed"}


async def send_push_to_user(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification to all devices of a user"""
    if not FIREBASE_SERVER_KEY:
        logger.warning("FIREBASE_SERVER_KEY not set — skipping push")
        return

    tokens_cursor = db.push_tokens.find({"user_id": user_id}, {"_id": 0, "token": 1})
    tokens = [t["token"] async for t in tokens_cursor]

    if not tokens:
        return

    payload = {
        "registration_ids": tokens,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": data or {},
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                json=payload,
                headers={
                    "Authorization": f"key={FIREBASE_SERVER_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                result = resp.json()
                logger.info(f"Push sent to {user_id}: success={result.get('success')}, failure={result.get('failure')}")
            else:
                logger.error(f"FCM error {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Push send failed: {e}")


async def send_push_to_employee(employee_id: str, title: str, body: str, data: dict = None):
    """Send push to all devices of an employee (looks up user by employee_id)"""
    tokens_cursor = db.push_tokens.find({"employee_id": employee_id}, {"_id": 0, "token": 1})
    tokens = [t["token"] async for t in tokens_cursor]

    if not tokens or not FIREBASE_SERVER_KEY:
        return

    payload = {
        "registration_ids": tokens,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": data or {},
    }

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://fcm.googleapis.com/fcm/send",
                json=payload,
                headers={
                    "Authorization": f"key={FIREBASE_SERVER_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"Push send failed: {e}")
