"""Meeting Notification Background Service
Runs periodically to send meeting reminders:
- Morning notification at 9 AM
- 1 hour before notification
"""
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def create_notification(user_id: str, title: str, message: str, 
                              type: str, module: str, link: str = None,
                              meeting_id: str = None, notification_type: str = "general"):
    """Create in-app notification"""
    import uuid
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


async def send_meeting_reminders():
    """Check and send meeting reminders"""
    now = datetime.now(timezone.utc)
    # Adjust for IST (UTC+5:30)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    
    today = now_ist.strftime("%Y-%m-%d")
    current_hour = now_ist.hour
    current_minute = now_ist.minute
    current_time = now_ist.strftime("%H:%M")
    
    logger.info(f"Checking meeting reminders at {current_time} IST for {today}")
    
    # Find meetings for today
    meetings_today = await db.internal_meetings.find({
        "meeting_date": today,
        "status": "scheduled"
    }, {"_id": 0}).to_list(200)
    
    sent_count = 0
    
    for meeting in meetings_today:
        start_time = meeting.get("start_time", "")
        if not start_time:
            continue
        
        meeting_id = meeting.get("meeting_id")
        
        # Parse meeting time
        try:
            meeting_hour, meeting_minute = map(int, start_time.split(":"))
        except:
            continue
        
        # Calculate minutes until meeting
        minutes_until = (meeting_hour * 60 + meeting_minute) - (current_hour * 60 + current_minute)
        
        # Get all people to notify (organizer + participants)
        people_to_notify = []
        
        # Organizer
        if meeting.get("organizer_id"):
            people_to_notify.append({
                "user_id": meeting["organizer_id"],
                "type": "organizer"
            })
        
        # Participants
        for pid in meeting.get("participants", []):
            emp = await db.employees.find_one({"employee_id": pid}, {"_id": 0, "user_id": 1})
            if emp and emp.get("user_id"):
                people_to_notify.append({
                    "user_id": emp["user_id"],
                    "type": "participant"
                })
        
        # Morning notification (9 AM - send once between 9:00-9:05)
        morning_key = f"morning_notif_sent_{meeting_id}"
        if current_hour == 9 and current_minute < 5:
            already_sent = await db.internal_meetings.find_one(
                {"meeting_id": meeting_id, morning_key: True}
            )
            if not already_sent:
                for person in people_to_notify:
                    await create_notification(
                        person["user_id"],
                        "📅 Meeting Today",
                        f"Today at {start_time}: {meeting['subject']}",
                        "info", "meetings",
                        link=f"/dashboard/my-calendar",
                        meeting_id=meeting_id,
                        notification_type="meeting_morning"
                    )
                    sent_count += 1
                
                await db.internal_meetings.update_one(
                    {"meeting_id": meeting_id},
                    {"$set": {morning_key: True}}
                )
                logger.info(f"Sent morning notification for meeting {meeting_id}")
        
        # 1 hour before notification (between 55-65 minutes before)
        hour_before_key = f"hour_before_notif_sent_{meeting_id}"
        if 55 <= minutes_until <= 65:
            already_sent = await db.internal_meetings.find_one(
                {"meeting_id": meeting_id, hour_before_key: True}
            )
            if not already_sent:
                for person in people_to_notify:
                    await create_notification(
                        person["user_id"],
                        "⏰ Meeting in 1 Hour",
                        f"Reminder: {meeting['subject']} starts at {start_time}",
                        "warning", "meetings",
                        link=f"/dashboard/my-calendar",
                        meeting_id=meeting_id,
                        notification_type="meeting_hour_before"
                    )
                    sent_count += 1
                
                await db.internal_meetings.update_one(
                    {"meeting_id": meeting_id},
                    {"$set": {hour_before_key: True}}
                )
                logger.info(f"Sent 1-hour reminder for meeting {meeting_id}")
    
    return sent_count


async def main():
    """Main loop to run the notification service"""
    logger.info("Meeting notification service started")
    
    while True:
        try:
            sent = await send_meeting_reminders()
            if sent > 0:
                logger.info(f"Sent {sent} meeting notifications")
        except Exception as e:
            logger.error(f"Error sending notifications: {e}")
        
        # Check every 5 minutes
        await asyncio.sleep(300)


if __name__ == "__main__":
    asyncio.run(main())
