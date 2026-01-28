"""Surveys & Suggestions API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/helpdesk", tags=["Helpdesk"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== ANONYMOUS SUGGESTIONS ====================

@router.get("/suggestions")
async def list_suggestions(
    request: Request,
    status: Optional[str] = None
):
    """List suggestions - HR sees all, employees see their own"""
    user = await get_current_user(request)
    
    query = {}
    
    # Super admin sees all including submitter identity
    # HR sees all but anonymized
    # Employees see only their own
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["submitted_by"] = user.get("employee_id")
    
    if status and status != "all":
        query["status"] = status
    
    suggestions = await db.suggestions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Anonymize for HR (not super_admin)
    if user.get("role") in ["hr_admin", "hr_executive"]:
        for s in suggestions:
            if s.get("is_anonymous"):
                s["submitted_by"] = None
                s["submitter_name"] = "Anonymous"
    
    return suggestions


@router.post("/suggestions")
async def create_suggestion(data: dict, request: Request):
    """Submit a suggestion (can be anonymous)"""
    user = await get_current_user(request)
    
    suggestion = {
        "suggestion_id": f"SUG-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "submitted_by": user.get("employee_id"),
        "submitter_name": user.get("name"),
        "is_anonymous": data.get("is_anonymous", False),
        "category": data.get("category", "general"),
        "title": data.get("title"),
        "description": data.get("description"),
        "status": "submitted",  # submitted, under_review, acknowledged, implemented, rejected
        "hr_response": None,
        "hr_responded_by": None,
        "hr_responded_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.suggestions.insert_one(suggestion)
    suggestion.pop('_id', None)
    return suggestion


@router.get("/suggestions/{suggestion_id}")
async def get_suggestion(suggestion_id: str, request: Request):
    """Get suggestion details"""
    user = await get_current_user(request)
    
    suggestion = await db.suggestions.find_one({"suggestion_id": suggestion_id}, {"_id": 0})
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        if suggestion.get("submitted_by") != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Anonymize for HR (not super_admin)
    if user.get("role") in ["hr_admin", "hr_executive"] and suggestion.get("is_anonymous"):
        suggestion["submitted_by"] = None
        suggestion["submitter_name"] = "Anonymous"
    
    return suggestion


@router.put("/suggestions/{suggestion_id}/respond")
async def respond_to_suggestion(suggestion_id: str, data: dict, request: Request):
    """HR responds to a suggestion (visible to submitter only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.suggestions.update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {
            "hr_response": data.get("response"),
            "hr_responded_by": user.get("user_id"),
            "hr_responded_by_name": user.get("name"),
            "hr_responded_at": datetime.now(timezone.utc).isoformat(),
            "status": data.get("status", "acknowledged"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Response submitted"}


@router.put("/suggestions/{suggestion_id}/status")
async def update_suggestion_status(suggestion_id: str, data: dict, request: Request):
    """Update suggestion status"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.suggestions.update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {
            "status": data.get("status"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Status updated"}


# ==================== SURVEYS ====================

@router.get("/surveys")
async def list_surveys(
    request: Request,
    status: Optional[str] = None,
    survey_type: Optional[str] = None
):
    """List surveys - HR sees all, employees see surveys assigned to them"""
    user = await get_current_user(request)
    
    if user.get("role") in ["super_admin", "hr_admin", "hr_executive"]:
        # HR sees all surveys
        query = {}
        if status and status != "all":
            query["status"] = status
        if survey_type and survey_type != "all":
            query["survey_type"] = survey_type
        
        surveys = await db.surveys.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        # Employees see surveys assigned to them
        employee_id = user.get("employee_id")
        employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
        
        query = {
            "status": "active",
            "$or": [
                {"target_type": "all"},
                {"target_employees": employee_id},
                {"target_departments": employee.get("department_id") if employee else None},
                {"target_locations": employee.get("location") if employee else None}
            ]
        }
        
        surveys = await db.surveys.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Filter out surveys the employee has already completed (if not editable)
        completed_ids = set()
        responses = await db.survey_responses.find(
            {"employee_id": employee_id}, {"survey_id": 1}
        ).to_list(100)
        for r in responses:
            completed_ids.add(r.get("survey_id"))
        
        # Mark surveys as completed or pending
        for s in surveys:
            s["my_status"] = "completed" if s["survey_id"] in completed_ids else "pending"
    
    return surveys


@router.post("/surveys")
async def create_survey(data: dict, request: Request):
    """Create a new survey (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    survey = {
        "survey_id": f"SRV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "title": data.get("title"),
        "description": data.get("description", ""),
        "survey_type": data.get("survey_type", "custom"),  # poll, text, satisfaction, engagement, colleague_feedback, pulse, custom
        "is_anonymous": data.get("is_anonymous", False),
        "is_mandatory": data.get("is_mandatory", False),
        "allow_edit": data.get("allow_edit", True),  # Can employees edit responses until deadline
        
        # Targeting
        "target_type": data.get("target_type", "all"),  # all, selected, department, location
        "target_employees": data.get("target_employees", []),  # List of employee_ids
        "target_departments": data.get("target_departments", []),  # List of department_ids
        "target_locations": data.get("target_locations", []),  # List of locations
        
        # For colleague feedback
        "feedback_target_type": data.get("feedback_target_type"),  # hr_assigned, employee_choice
        "feedback_targets": data.get("feedback_targets", []),  # List of employee_ids to rate
        
        # Questions
        "questions": data.get("questions", []),
        
        # Scheduling
        "status": data.get("status", "draft"),  # draft, scheduled, active, closed
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "is_recurring": data.get("is_recurring", False),
        "recurrence_pattern": data.get("recurrence_pattern"),  # weekly, monthly, quarterly
        
        # Template
        "is_template": data.get("is_template", False),
        "template_name": data.get("template_name"),
        
        # Metadata
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        
        # Stats (updated as responses come in)
        "total_recipients": 0,
        "total_responses": 0,
        "response_rate": 0
    }
    
    # Calculate total recipients
    survey["total_recipients"] = await calculate_survey_recipients(survey)
    
    await db.surveys.insert_one(survey)
    survey.pop('_id', None)
    
    # Create notifications for active surveys
    if survey["status"] == "active":
        await create_survey_notifications(survey)
    
    return survey


async def calculate_survey_recipients(survey: dict) -> int:
    """Calculate total number of survey recipients"""
    target_type = survey.get("target_type", "all")
    
    if target_type == "all":
        count = await db.employees.count_documents({"is_active": True})
    elif target_type == "selected":
        count = len(survey.get("target_employees", []))
    elif target_type == "department":
        count = await db.employees.count_documents({
            "is_active": True,
            "department_id": {"$in": survey.get("target_departments", [])}
        })
    elif target_type == "location":
        count = await db.employees.count_documents({
            "is_active": True,
            "location": {"$in": survey.get("target_locations", [])}
        })
    else:
        count = 0
    
    return count


async def create_survey_notifications(survey: dict):
    """Create in-app notifications for survey recipients"""
    target_type = survey.get("target_type", "all")
    
    # Get target employees
    if target_type == "all":
        employees = await db.employees.find({"is_active": True}, {"employee_id": 1}).to_list(1000)
    elif target_type == "selected":
        employee_ids = survey.get("target_employees", [])
        employees = [{"employee_id": eid} for eid in employee_ids]
    elif target_type == "department":
        employees = await db.employees.find({
            "is_active": True,
            "department_id": {"$in": survey.get("target_departments", [])}
        }, {"employee_id": 1}).to_list(1000)
    elif target_type == "location":
        employees = await db.employees.find({
            "is_active": True,
            "location": {"$in": survey.get("target_locations", [])}
        }, {"employee_id": 1}).to_list(1000)
    else:
        employees = []
    
    # Create notifications
    notifications = []
    for emp in employees:
        notifications.append({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "employee_id": emp["employee_id"],
            "type": "survey",
            "title": f"New Survey: {survey.get('title')}",
            "message": survey.get("description", "Please complete this survey"),
            "link": f"/helpdesk?survey={survey['survey_id']}",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)


@router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str, request: Request):
    """Get survey details"""
    user = await get_current_user(request)
    
    survey = await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    # Check if employee can access this survey
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        employee_id = user.get("employee_id")
        employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
        
        # Check targeting
        target_type = survey.get("target_type", "all")
        has_access = False
        
        if target_type == "all":
            has_access = True
        elif target_type == "selected" and employee_id in survey.get("target_employees", []):
            has_access = True
        elif target_type == "department" and employee and employee.get("department_id") in survey.get("target_departments", []):
            has_access = True
        elif target_type == "location" and employee and employee.get("location") in survey.get("target_locations", []):
            has_access = True
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Not authorized to view this survey")
        
        # Check if already responded
        existing_response = await db.survey_responses.find_one(
            {"survey_id": survey_id, "employee_id": employee_id}, {"_id": 0}
        )
        survey["my_response"] = existing_response
    
    return survey


@router.put("/surveys/{survey_id}")
async def update_survey(survey_id: str, data: dict, request: Request):
    """Update survey (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Don't allow updating closed surveys
    survey = await db.surveys.find_one({"survey_id": survey_id})
    if survey and survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Cannot update a closed survey")
    
    update_data = {k: v for k, v in data.items() if k not in ["survey_id", "created_at", "created_by"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Recalculate recipients if targeting changed
    if "target_type" in data or "target_employees" in data or "target_departments" in data or "target_locations" in data:
        merged_survey = {**survey, **update_data}
        update_data["total_recipients"] = await calculate_survey_recipients(merged_survey)
    
    await db.surveys.update_one({"survey_id": survey_id}, {"$set": update_data})
    
    # Create notifications if survey just became active
    if data.get("status") == "active" and survey.get("status") != "active":
        merged_survey = {**survey, **update_data}
        await create_survey_notifications(merged_survey)
    
    return await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})


@router.delete("/surveys/{survey_id}")
async def delete_survey(survey_id: str, request: Request):
    """Delete a survey (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete survey and all responses
    await db.survey_responses.delete_many({"survey_id": survey_id})
    await db.surveys.delete_one({"survey_id": survey_id})
    
    return {"message": "Survey deleted"}


@router.post("/surveys/{survey_id}/activate")
async def activate_survey(survey_id: str, request: Request):
    """Activate a draft/scheduled survey"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    survey = await db.surveys.find_one({"survey_id": survey_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    await db.surveys.update_one(
        {"survey_id": survey_id},
        {"$set": {
            "status": "active",
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create notifications
    await create_survey_notifications(survey)
    
    return {"message": "Survey activated"}


@router.post("/surveys/{survey_id}/close")
async def close_survey(survey_id: str, request: Request):
    """Close an active survey"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.surveys.update_one(
        {"survey_id": survey_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Survey closed"}


@router.post("/surveys/{survey_id}/duplicate")
async def duplicate_survey(survey_id: str, request: Request):
    """Duplicate a survey as a new draft"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    original = await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    # Create copy
    new_survey = {**original}
    new_survey["survey_id"] = f"SRV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    new_survey["title"] = f"Copy of {original.get('title', 'Survey')}"
    new_survey["status"] = "draft"
    new_survey["total_responses"] = 0
    new_survey["response_rate"] = 0
    new_survey["created_by"] = user.get("user_id")
    new_survey["created_by_name"] = user.get("name")
    new_survey["created_at"] = datetime.now(timezone.utc).isoformat()
    new_survey["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.surveys.insert_one(new_survey)
    new_survey.pop('_id', None)
    
    return new_survey


# ==================== SURVEY RESPONSES ====================

@router.post("/surveys/{survey_id}/respond")
async def submit_survey_response(survey_id: str, data: dict, request: Request):
    """Submit response to a survey"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    # Get survey
    survey = await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    if survey.get("status") != "active":
        raise HTTPException(status_code=400, detail="Survey is not active")
    
    # Check deadline
    if survey.get("end_date"):
        end_date = datetime.fromisoformat(survey["end_date"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > end_date:
            raise HTTPException(status_code=400, detail="Survey deadline has passed")
    
    # Check if already responded
    existing = await db.survey_responses.find_one(
        {"survey_id": survey_id, "employee_id": employee_id}
    )
    
    if existing and not survey.get("allow_edit", True):
        raise HTTPException(status_code=400, detail="You have already responded to this survey")
    
    response_data = {
        "response_id": existing.get("response_id") if existing else f"RSP-{uuid.uuid4().hex[:12]}",
        "survey_id": survey_id,
        "employee_id": employee_id,
        "employee_name": user.get("name") if not survey.get("is_anonymous") else None,
        "answers": data.get("answers", []),  # [{question_id, answer, rating, selected_options}]
        "feedback_target_id": data.get("feedback_target_id"),  # For colleague feedback
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        # Update existing response
        await db.survey_responses.update_one(
            {"response_id": existing["response_id"]},
            {"$set": response_data}
        )
    else:
        # Insert new response
        await db.survey_responses.insert_one(response_data)
        
        # Update survey stats
        total_responses = await db.survey_responses.count_documents({"survey_id": survey_id})
        response_rate = round((total_responses / survey.get("total_recipients", 1)) * 100, 1) if survey.get("total_recipients") else 0
        
        await db.surveys.update_one(
            {"survey_id": survey_id},
            {"$set": {
                "total_responses": total_responses,
                "response_rate": response_rate
            }}
        )
    
    response_data.pop('_id', None)
    return response_data


@router.get("/surveys/{survey_id}/responses")
async def get_survey_responses(survey_id: str, request: Request):
    """Get all responses for a survey (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    survey = await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    responses = await db.survey_responses.find(
        {"survey_id": survey_id}, {"_id": 0}
    ).to_list(1000)
    
    # Anonymize if survey is anonymous
    if survey.get("is_anonymous"):
        for r in responses:
            r["employee_id"] = None
            r["employee_name"] = "Anonymous"
    
    return responses


@router.get("/surveys/{survey_id}/analytics")
async def get_survey_analytics(survey_id: str, request: Request):
    """Get analytics for a survey (HR/Admin only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    survey = await db.surveys.find_one({"survey_id": survey_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    responses = await db.survey_responses.find(
        {"survey_id": survey_id}, {"_id": 0}
    ).to_list(1000)
    
    # Calculate analytics per question
    questions = survey.get("questions", [])
    question_analytics = []
    
    for q in questions:
        q_id = q.get("question_id")
        q_type = q.get("type")
        q_analytics = {
            "question_id": q_id,
            "question_text": q.get("text"),
            "type": q_type,
            "total_responses": 0,
            "analytics": {}
        }
        
        # Gather all answers for this question
        answers = []
        for r in responses:
            for a in r.get("answers", []):
                if a.get("question_id") == q_id:
                    answers.append(a)
        
        q_analytics["total_responses"] = len(answers)
        
        if q_type in ["multiple_choice", "single_choice", "yes_no"]:
            # Count options
            option_counts = {}
            for a in answers:
                selected = a.get("selected_options", [])
                if isinstance(selected, str):
                    selected = [selected]
                for opt in selected:
                    option_counts[opt] = option_counts.get(opt, 0) + 1
            
            q_analytics["analytics"] = {
                "option_counts": option_counts,
                "total": len(answers)
            }
        
        elif q_type in ["rating", "nps", "satisfaction"]:
            # Calculate average, distribution
            ratings = [a.get("rating", 0) for a in answers if a.get("rating") is not None]
            if ratings:
                q_analytics["analytics"] = {
                    "average": round(sum(ratings) / len(ratings), 2),
                    "min": min(ratings),
                    "max": max(ratings),
                    "distribution": {str(i): ratings.count(i) for i in set(ratings)}
                }
        
        elif q_type in ["text", "long_text"]:
            # Just collect responses
            q_analytics["analytics"] = {
                "responses": [a.get("answer", "") for a in answers if a.get("answer")]
            }
        
        question_analytics.append(q_analytics)
    
    return {
        "survey": survey,
        "summary": {
            "total_recipients": survey.get("total_recipients", 0),
            "total_responses": len(responses),
            "response_rate": round((len(responses) / survey.get("total_recipients", 1)) * 100, 1) if survey.get("total_recipients") else 0,
            "completion_status": "complete" if len(responses) >= survey.get("total_recipients", 0) else "in_progress"
        },
        "question_analytics": question_analytics
    }


# ==================== SURVEY TEMPLATES ====================

@router.get("/survey-templates")
async def list_survey_templates(request: Request):
    """List available survey templates"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get saved templates
    saved_templates = await db.surveys.find(
        {"is_template": True}, {"_id": 0}
    ).to_list(50)
    
    # Built-in templates
    builtin_templates = [
        {
            "template_id": "builtin_satisfaction",
            "template_name": "Employee Satisfaction Survey",
            "description": "Measure overall employee satisfaction with workplace",
            "survey_type": "satisfaction",
            "questions": [
                {"question_id": "q1", "type": "rating", "text": "How satisfied are you with your job overall?", "scale": 5},
                {"question_id": "q2", "type": "rating", "text": "How satisfied are you with your work-life balance?", "scale": 5},
                {"question_id": "q3", "type": "rating", "text": "How satisfied are you with your compensation?", "scale": 5},
                {"question_id": "q4", "type": "rating", "text": "How likely are you to recommend this company as a great place to work?", "scale": 10},
                {"question_id": "q5", "type": "long_text", "text": "What could we do to improve your experience?"}
            ]
        },
        {
            "template_id": "builtin_engagement",
            "template_name": "Employee Engagement Survey",
            "description": "Assess employee engagement and motivation",
            "survey_type": "engagement",
            "questions": [
                {"question_id": "q1", "type": "rating", "text": "I feel motivated to go beyond my basic job requirements", "scale": 5},
                {"question_id": "q2", "type": "rating", "text": "I understand how my work contributes to company goals", "scale": 5},
                {"question_id": "q3", "type": "rating", "text": "I have the tools and resources I need to do my job well", "scale": 5},
                {"question_id": "q4", "type": "rating", "text": "My manager supports my professional development", "scale": 5},
                {"question_id": "q5", "type": "single_choice", "text": "How often do you receive recognition for your work?", "options": ["Daily", "Weekly", "Monthly", "Rarely", "Never"]}
            ]
        },
        {
            "template_id": "builtin_pulse",
            "template_name": "Weekly Pulse Check",
            "description": "Quick weekly check-in with employees",
            "survey_type": "pulse",
            "questions": [
                {"question_id": "q1", "type": "rating", "text": "How would you rate your week overall?", "scale": 5},
                {"question_id": "q2", "type": "yes_no", "text": "Did you face any blockers this week?"},
                {"question_id": "q3", "type": "text", "text": "Anything you'd like to share with HR?"}
            ]
        },
        {
            "template_id": "builtin_onboarding",
            "template_name": "New Employee Onboarding Survey",
            "description": "Gather feedback from new hires about their onboarding experience",
            "survey_type": "custom",
            "questions": [
                {"question_id": "q1", "type": "rating", "text": "How would you rate your overall onboarding experience?", "scale": 5},
                {"question_id": "q2", "type": "rating", "text": "I received adequate training to do my job", "scale": 5},
                {"question_id": "q3", "type": "rating", "text": "My team made me feel welcome", "scale": 5},
                {"question_id": "q4", "type": "single_choice", "text": "Was your workspace ready on your first day?", "options": ["Yes, fully ready", "Partially ready", "Not ready"]},
                {"question_id": "q5", "type": "long_text", "text": "What could we improve about the onboarding process?"}
            ]
        },
        {
            "template_id": "builtin_exit",
            "template_name": "Exit Interview Survey",
            "description": "Understand why employees are leaving",
            "survey_type": "custom",
            "questions": [
                {"question_id": "q1", "type": "single_choice", "text": "Primary reason for leaving?", "options": ["Better opportunity", "Compensation", "Work-life balance", "Management", "Career growth", "Relocation", "Personal reasons", "Other"]},
                {"question_id": "q2", "type": "rating", "text": "How would you rate your overall experience working here?", "scale": 5},
                {"question_id": "q3", "type": "yes_no", "text": "Would you consider working here again in the future?"},
                {"question_id": "q4", "type": "yes_no", "text": "Would you recommend this company to others?"},
                {"question_id": "q5", "type": "long_text", "text": "Any feedback or suggestions for improvement?"}
            ]
        },
        {
            "template_id": "builtin_360",
            "template_name": "360 Degree Feedback",
            "description": "Colleague feedback survey for performance reviews",
            "survey_type": "colleague_feedback",
            "questions": [
                {"question_id": "q1", "type": "rating", "text": "How effectively does this person communicate?", "scale": 5},
                {"question_id": "q2", "type": "rating", "text": "How well does this person collaborate with others?", "scale": 5},
                {"question_id": "q3", "type": "rating", "text": "How reliable is this person in meeting deadlines?", "scale": 5},
                {"question_id": "q4", "type": "rating", "text": "How would you rate this person's problem-solving skills?", "scale": 5},
                {"question_id": "q5", "type": "long_text", "text": "What are this person's strengths?"},
                {"question_id": "q6", "type": "long_text", "text": "What areas could this person improve?"}
            ]
        }
    ]
    
    return {
        "builtin_templates": builtin_templates,
        "saved_templates": saved_templates
    }


@router.post("/survey-templates")
async def save_survey_as_template(data: dict, request: Request):
    """Save a survey as a reusable template"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template = {
        "survey_id": f"TMPL-{uuid.uuid4().hex[:8]}",
        "is_template": True,
        "template_name": data.get("template_name"),
        "title": data.get("title"),
        "description": data.get("description"),
        "survey_type": data.get("survey_type", "custom"),
        "questions": data.get("questions", []),
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.surveys.insert_one(template)
    template.pop('_id', None)
    return template


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
async def get_my_notifications(request: Request, unread_only: bool = False):
    """Get notifications for current user"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    query = {"employee_id": employee_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark notification as read"""
    user = await get_current_user(request)
    
    await db.notifications.update_one(
        {"notification_id": notification_id, "employee_id": user.get("employee_id")},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Marked as read"}


@router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    user = await get_current_user(request)
    
    await db.notifications.update_many(
        {"employee_id": user.get("employee_id"), "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "All notifications marked as read"}


# ==================== HELPER ENDPOINTS ====================

@router.get("/departments")
async def list_departments_for_targeting(request: Request):
    """Get departments for survey targeting"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    departments = await db.departments.find({}, {"_id": 0}).to_list(100)
    return departments


@router.get("/locations")
async def list_locations_for_targeting(request: Request):
    """Get unique locations for survey targeting"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get unique locations from employees
    pipeline = [
        {"$match": {"is_active": True, "location": {"$ne": None}}},
        {"$group": {"_id": "$location"}},
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.employees.aggregate(pipeline).to_list(100)
    locations = [{"location": r["_id"]} for r in result if r["_id"]]
    
    return locations


@router.get("/employees-for-selection")
async def list_employees_for_selection(
    request: Request,
    department_id: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None
):
    """Get employees for survey targeting selection"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    
    if department_id:
        query["department_id"] = department_id
    if location:
        query["location"] = location
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"emp_code": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.employees.find(
        query,
        {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1, "department_name": 1, "location": 1}
    ).to_list(500)
    
    return employees
