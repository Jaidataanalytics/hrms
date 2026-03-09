"""Performance Management System - MIS, KPI, KRA & Evaluations"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/performance", tags=["Performance"])

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


def is_admin_or_hr(role):
    return role in ["super_admin", "hr_admin", "hr_executive"]


# ==================== MIS TEMPLATES ====================

@router.get("/mis-templates")
async def list_mis_templates(request: Request, department_id: Optional[str] = None):
    await get_current_user(request)
    query = {"is_active": True}
    if department_id:
        query["department_id"] = department_id
    templates = await db.mis_templates.find(query, {"_id": 0}).sort("department_name", 1).to_list(100)
    return templates


@router.post("/mis-templates")
async def create_mis_template(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    template = {
        "template_id": f"mist_{uuid.uuid4().hex[:12]}",
        "department_id": data.get("department_id"),
        "department_name": data.get("department_name", ""),
        "designation_level": data.get("designation_level", "all"),
        "name": data.get("name", ""),
        "fields": data.get("fields", []),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    await db.mis_templates.insert_one(template)
    template.pop("_id", None)
    return template


@router.put("/mis-templates/{template_id}")
async def update_mis_template(template_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    data.pop("_id", None)
    data.pop("template_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.mis_templates.update_one({"template_id": template_id}, {"$set": data})
    return {"message": "Template updated"}


# ==================== MIS ENTRIES ====================

@router.get("/mis-entries")
async def list_mis_entries(
    request: Request,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
    date: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    period: Optional[str] = None
):
    user = await get_current_user(request)
    query = {}

    if employee_id:
        query["employee_id"] = employee_id
    elif not is_admin_or_hr(user.get("role")):
        query["employee_id"] = user.get("employee_id")

    if department_id:
        query["department_id"] = department_id
    if date:
        query["date"] = date

    if from_date and to_date:
        query["date"] = {"$gte": from_date, "$lte": to_date}
    elif period:
        today = datetime.now(timezone.utc).date()
        if period == "weekly":
            start = today - timedelta(days=today.weekday())
            query["date"] = {"$gte": str(start), "$lte": str(today)}
        elif period == "monthly":
            start = today.replace(day=1)
            query["date"] = {"$gte": str(start), "$lte": str(today)}
        elif period == "quarterly":
            q_month = ((today.month - 1) // 3) * 3 + 1
            start = today.replace(month=q_month, day=1)
            query["date"] = {"$gte": str(start), "$lte": str(today)}
        elif period == "half_yearly":
            start = today.replace(month=1 if today.month <= 6 else 7, day=1)
            query["date"] = {"$gte": str(start), "$lte": str(today)}
        elif period == "annual":
            start = today.replace(month=1, day=1)
            query["date"] = {"$gte": str(start), "$lte": str(today)}

    entries = await db.mis_entries.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    return entries


@router.post("/mis-entries")
async def create_mis_entry(data: dict, request: Request):
    user = await get_current_user(request)
    employee_id = data.get("employee_id") or user.get("employee_id")
    entry_date = data.get("date", str(datetime.now(timezone.utc).date()))

    existing = await db.mis_entries.find_one(
        {"employee_id": employee_id, "date": entry_date, "template_id": data.get("template_id")},
        {"_id": 0}
    )

    entry = {
        "entry_id": existing.get("entry_id") if existing else f"mis_{uuid.uuid4().hex[:12]}",
        "employee_id": employee_id,
        "template_id": data.get("template_id"),
        "department_id": data.get("department_id"),
        "date": entry_date,
        "fields": data.get("fields", {}),
        "manager_remarks": data.get("manager_remarks", ""),
        "status": data.get("status", "submitted"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if existing:
        await db.mis_entries.update_one(
            {"entry_id": existing["entry_id"]},
            {"$set": entry}
        )
    else:
        entry["created_at"] = datetime.now(timezone.utc).isoformat()
        entry["submitted_by"] = user.get("employee_id") or user["user_id"]
        await db.mis_entries.insert_one(entry)
        entry.pop("_id", None)

    return entry


@router.put("/mis-entries/{entry_id}/review")
async def review_mis_entry(entry_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    update = {
        "manager_remarks": data.get("manager_remarks", ""),
        "status": data.get("status", "reviewed"),
        "reviewed_by": user.get("employee_id") or user["user_id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mis_entries.update_one({"entry_id": entry_id}, {"$set": update})
    return {"message": "MIS entry reviewed"}


# ==================== MIS AGGREGATION ====================

@router.get("/mis-summary")
async def get_mis_summary(
    request: Request,
    department_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    period: str = "monthly",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    await get_current_user(request)
    today = datetime.now(timezone.utc).date()

    if not from_date or not to_date:
        if period == "weekly":
            start = today - timedelta(days=today.weekday())
        elif period == "monthly":
            start = today.replace(day=1)
        elif period == "quarterly":
            q_month = ((today.month - 1) // 3) * 3 + 1
            start = today.replace(month=q_month, day=1)
        elif period == "half_yearly":
            start = today.replace(month=1 if today.month <= 6 else 7, day=1)
        else:
            start = today.replace(month=1, day=1)
        from_date = str(start)
        to_date = str(today)

    match_query = {"date": {"$gte": from_date, "$lte": to_date}}
    if department_id:
        match_query["department_id"] = department_id
    if employee_id:
        match_query["employee_id"] = employee_id

    entries = await db.mis_entries.find(match_query, {"_id": 0}).to_list(10000)

    numeric_sums = {}
    bool_counts = {}
    entry_count = len(entries)

    for entry in entries:
        fields = entry.get("fields", {})
        for key, val in fields.items():
            if isinstance(val, (int, float)):
                numeric_sums[key] = numeric_sums.get(key, 0) + val
            elif isinstance(val, bool):
                if key not in bool_counts:
                    bool_counts[key] = {"true": 0, "total": 0}
                bool_counts[key]["total"] += 1
                if val:
                    bool_counts[key]["true"] += 1

    numeric_averages = {k: round(v / entry_count, 2) if entry_count else 0 for k, v in numeric_sums.items()}
    bool_percentages = {
        k: round(v["true"] / v["total"] * 100, 1) if v["total"] else 0
        for k, v in bool_counts.items()
    }

    return {
        "period": period,
        "from_date": from_date,
        "to_date": to_date,
        "entry_count": entry_count,
        "sums": numeric_sums,
        "averages": numeric_averages,
        "compliance_rates": bool_percentages,
        "department_id": department_id,
        "employee_id": employee_id
    }


# ==================== KPI DEFINITIONS ====================

@router.get("/kpi-definitions")
async def list_kpi_definitions(
    request: Request,
    department_id: Optional[str] = None,
    employee_id: Optional[str] = None
):
    await get_current_user(request)
    query = {"is_active": True}
    if department_id:
        query["$or"] = [{"department_id": department_id}, {"department_id": None}, {"department_id": "all"}]
    if employee_id:
        query["$or"] = [{"employee_id": employee_id}, {"employee_id": None}, {"employee_id": "all"}]
    definitions = await db.kpi_definitions.find(query, {"_id": 0}).to_list(200)
    return definitions


@router.post("/kpi-definitions")
async def create_kpi_definition(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    definition = {
        "kpi_id": f"kpi_{uuid.uuid4().hex[:12]}",
        "name": data["name"],
        "description": data.get("description", ""),
        "department_id": data.get("department_id"),
        "designation_level": data.get("designation_level"),
        "employee_id": data.get("employee_id"),
        "category": data.get("category", "operational"),
        "unit": data.get("unit", "%"),
        "target_value": data.get("target_value", 100),
        "weight": data.get("weight", 1.0),
        "calculation_type": data.get("calculation_type", "manual"),
        "mis_field_key": data.get("mis_field_key"),
        "mis_field_key_2": data.get("mis_field_key_2"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    await db.kpi_definitions.insert_one(definition)
    definition.pop("_id", None)
    return definition


@router.put("/kpi-definitions/{kpi_id}")
async def update_kpi_definition(kpi_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    data.pop("_id", None)
    data.pop("kpi_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.kpi_definitions.update_one({"kpi_id": kpi_id}, {"$set": data})
    return {"message": "KPI updated"}


@router.delete("/kpi-definitions/{kpi_id}")
async def delete_kpi_definition(kpi_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.kpi_definitions.update_one({"kpi_id": kpi_id}, {"$set": {"is_active": False}})
    return {"message": "KPI deleted"}


# ==================== KPI SCORES (AUTO-CALCULATED) ====================

@router.get("/kpi-scores")
async def get_kpi_scores(
    request: Request,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
    period: str = "monthly"
):
    user = await get_current_user(request)
    if not employee_id and not is_admin_or_hr(user.get("role")):
        employee_id = user.get("employee_id")

    today = datetime.now(timezone.utc).date()
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "quarterly":
        q_month = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=q_month, day=1)
    elif period == "half_yearly":
        start = today.replace(month=1 if today.month <= 6 else 7, day=1)
    else:
        start = today.replace(month=1, day=1)

    from_date = str(start)
    to_date = str(today)

    # Get applicable KPIs
    kpi_query = {"is_active": True}
    if department_id:
        kpi_query["$or"] = [{"department_id": department_id}, {"department_id": None}, {"department_id": "all"}]

    kpi_defs = await db.kpi_definitions.find(kpi_query, {"_id": 0}).to_list(200)

    # Get MIS entries for the period
    mis_query = {"date": {"$gte": from_date, "$lte": to_date}}
    if employee_id:
        mis_query["employee_id"] = employee_id
    elif department_id:
        mis_query["department_id"] = department_id

    mis_entries = await db.mis_entries.find(mis_query, {"_id": 0}).to_list(10000)
    entry_count = len(mis_entries)

    # Calculate KPI scores
    scores = []
    for kpi in kpi_defs:
        calc_type = kpi.get("calculation_type", "manual")
        field_key = kpi.get("mis_field_key")
        field_key_2 = kpi.get("mis_field_key_2")
        target = kpi.get("target_value", 100)
        actual = 0

        if calc_type == "manual" or not field_key or entry_count == 0:
            stored = await db.kpi_scores.find_one(
                {"kpi_id": kpi["kpi_id"], "employee_id": employee_id, "period": period,
                 "from_date": from_date},
                {"_id": 0}
            )
            actual = stored.get("actual_value", 0) if stored else 0
        elif calc_type == "sum":
            for e in mis_entries:
                v = e.get("fields", {}).get(field_key, 0)
                actual += v if isinstance(v, (int, float)) else 0
        elif calc_type == "average":
            total = 0
            for e in mis_entries:
                v = e.get("fields", {}).get(field_key, 0)
                total += v if isinstance(v, (int, float)) else 0
            actual = round(total / entry_count, 2)
        elif calc_type == "compliance":
            true_count = sum(1 for e in mis_entries if e.get("fields", {}).get(field_key) is True)
            actual = round(true_count / entry_count * 100, 1)
        elif calc_type == "percentage":
            num_total = sum(
                e.get("fields", {}).get(field_key, 0)
                for e in mis_entries
                if isinstance(e.get("fields", {}).get(field_key, 0), (int, float))
            )
            den_total = sum(
                e.get("fields", {}).get(field_key_2, 0)
                for e in mis_entries
                if isinstance(e.get("fields", {}).get(field_key_2, 0), (int, float))
            )
            actual = round(num_total / den_total * 100, 1) if den_total else 0
        elif calc_type == "inverse_sum":
            for e in mis_entries:
                v = e.get("fields", {}).get(field_key, 0)
                actual += v if isinstance(v, (int, float)) else 0

        # Score: actual vs target (capped at 100%)
        if calc_type == "inverse_sum":
            score_pct = max(0, round((1 - actual / max(target, 1)) * 100, 1)) if target else 100
        else:
            score_pct = min(100, round(actual / max(target, 0.01) * 100, 1)) if target else 0

        scores.append({
            "kpi_id": kpi["kpi_id"],
            "name": kpi["name"],
            "category": kpi.get("category"),
            "unit": kpi.get("unit", "%"),
            "target_value": target,
            "actual_value": actual,
            "score_percentage": score_pct,
            "weight": kpi.get("weight", 1.0),
            "calculation_type": calc_type,
            "period": period,
            "from_date": from_date,
            "to_date": to_date
        })

    # Weighted average
    total_weight = sum(s["weight"] for s in scores) or 1
    weighted_score = round(sum(s["score_percentage"] * s["weight"] for s in scores) / total_weight, 1)

    return {
        "scores": scores,
        "weighted_score": weighted_score,
        "period": period,
        "from_date": from_date,
        "to_date": to_date,
        "entry_count": entry_count
    }


# ==================== KRA DEFINITIONS ====================

@router.get("/kra-definitions")
async def list_kra_definitions(
    request: Request,
    employee_id: Optional[str] = None,
    designation_level: Optional[str] = None
):
    await get_current_user(request)
    query = {"is_active": True}
    if employee_id:
        query["$or"] = [{"employee_id": employee_id}, {"employee_id": None}]
    if designation_level:
        if "$or" in query:
            query["$and"] = [
                {"$or": query.pop("$or")},
                {"$or": [{"designation_level": designation_level}, {"designation_level": None}, {"designation_level": "all"}]}
            ]
        else:
            query["$or"] = [{"designation_level": designation_level}, {"designation_level": None}, {"designation_level": "all"}]
    kras = await db.kra_definitions.find(query, {"_id": 0}).to_list(200)
    return kras


@router.post("/kra-definitions")
async def create_kra_definition(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    kra = {
        "kra_id": f"kra_{uuid.uuid4().hex[:12]}",
        "name": data["name"],
        "description": data.get("description", ""),
        "employee_id": data.get("employee_id"),
        "department_id": data.get("department_id"),
        "designation_level": data.get("designation_level"),
        "weight": data.get("weight", 1.0),
        "linked_kpi_ids": data.get("linked_kpi_ids", []),
        "target_description": data.get("target_description", ""),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    await db.kra_definitions.insert_one(kra)
    kra.pop("_id", None)
    return kra


@router.put("/kra-definitions/{kra_id}")
async def update_kra_definition(kra_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    data.pop("_id", None)
    data.pop("kra_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.kra_definitions.update_one({"kra_id": kra_id}, {"$set": data})
    return {"message": "KRA updated"}


@router.delete("/kra-definitions/{kra_id}")
async def delete_kra_definition(kra_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.kra_definitions.update_one({"kra_id": kra_id}, {"$set": {"is_active": False}})
    return {"message": "KRA deleted"}


# ==================== EVALUATIONS ====================

@router.get("/evaluations")
async def list_evaluations(
    request: Request,
    employee_id: Optional[str] = None,
    cycle: Optional[str] = None,
    status: Optional[str] = None
):
    user = await get_current_user(request)
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    elif not is_admin_or_hr(user.get("role")):
        query["employee_id"] = user.get("employee_id")
    if cycle:
        query["cycle"] = cycle
    if status:
        query["status"] = status
    evals = await db.evaluations.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return evals


@router.post("/evaluations")
async def create_evaluation(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    evaluation = {
        "evaluation_id": f"eval_{uuid.uuid4().hex[:12]}",
        "employee_id": data["employee_id"],
        "cycle": data.get("cycle", "quarterly"),
        "period_label": data.get("period_label", ""),
        "kra_scores": data.get("kra_scores", []),
        "kpi_scores": data.get("kpi_scores", []),
        "self_rating": data.get("self_rating"),
        "self_comments": data.get("self_comments", ""),
        "manager_rating": data.get("manager_rating"),
        "manager_comments": data.get("manager_comments", ""),
        "hr_rating": data.get("hr_rating"),
        "hr_comments": data.get("hr_comments", ""),
        "overall_rating": data.get("overall_rating"),
        "overall_score": data.get("overall_score"),
        "status": data.get("status", "draft"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    await db.evaluations.insert_one(evaluation)
    evaluation.pop("_id", None)
    return evaluation


@router.put("/evaluations/{evaluation_id}")
async def update_evaluation(evaluation_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    data.pop("_id", None)
    data.pop("evaluation_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = user.get("employee_id") or user["user_id"]
    await db.evaluations.update_one({"evaluation_id": evaluation_id}, {"$set": data})
    return {"message": "Evaluation updated"}


# ==================== COMPANY DASHBOARD ====================

@router.get("/company-dashboard")
async def get_company_dashboard(request: Request, period: str = "monthly"):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    today = datetime.now(timezone.utc).date()
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "quarterly":
        q_month = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=q_month, day=1)
    elif period == "half_yearly":
        start = today.replace(month=1 if today.month <= 6 else 7, day=1)
    else:
        start = today.replace(month=1, day=1)

    from_date = str(start)
    to_date = str(today)

    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(30)

    dept_summaries = []
    for dept in departments:
        dept_id = dept["department_id"]
        mis_count = await db.mis_entries.count_documents({
            "department_id": dept_id, "date": {"$gte": from_date, "$lte": to_date}
        })
        emp_count = await db.employees.count_documents({"department_id": dept_id, "is_active": True})

        dept_summaries.append({
            "department_id": dept_id,
            "department_name": dept["name"],
            "employee_count": emp_count,
            "mis_entries": mis_count,
            "mis_compliance": round(mis_count / max(emp_count, 1), 1)
        })

    total_mis = await db.mis_entries.count_documents({"date": {"$gte": from_date, "$lte": to_date}})
    total_employees = await db.employees.count_documents({"is_active": True})

    return {
        "period": period,
        "from_date": from_date,
        "to_date": to_date,
        "total_employees": total_employees,
        "total_mis_entries": total_mis,
        "department_summaries": dept_summaries
    }


# ==================== SEED DATA ====================

@router.post("/seed-templates")
async def seed_all_templates(request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(30)
    dept_map = {d["name"].strip(): d["department_id"] for d in departments}

    MIS_TEMPLATES = {
        "Accounts": {
            "fields": [
                {"key": "payments_processed", "label": "Payments Processed Today", "type": "number"},
                {"key": "payment_value", "label": "Value of Payments Processed", "type": "number"},
                {"key": "receipts_recorded", "label": "Receipts Recorded Today", "type": "number"},
                {"key": "outstanding_followups", "label": "Outstanding Follow-ups Done", "type": "number"},
                {"key": "vendor_mismatches", "label": "Vendor Ledger Mismatches Identified", "type": "number"},
                {"key": "tally_updated", "label": "Tally Updated Till Date", "type": "boolean"},
                {"key": "bank_statements_updated", "label": "Bank Statements Updated", "type": "boolean"},
                {"key": "bank_entries_posted", "label": "Bank Entries Posted", "type": "number"},
                {"key": "clearances_provided", "label": "Clearances Provided", "type": "number"},
                {"key": "dealer_statements_updated", "label": "Dealer Statements Updated", "type": "boolean"},
                {"key": "cash_ledger_posted", "label": "Cash Ledger Entries Posted", "type": "number"},
                {"key": "expense_entries_posted", "label": "Expense Entries Posted", "type": "number"},
                {"key": "reconciliation_2b_done", "label": "2B Reconciliation Done", "type": "boolean"},
                {"key": "voucher_check_done", "label": "Voucher Check Completed", "type": "boolean"},
                {"key": "stock_statement_submitted", "label": "Stock Statement Submitted", "type": "boolean"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Sales": {
            "fields": [
                {"key": "new_leads", "label": "New Leads Generated", "type": "number"},
                {"key": "followups_done", "label": "Follow-ups Done", "type": "number"},
                {"key": "client_meetings", "label": "Client Meetings/Calls", "type": "number"},
                {"key": "quotations_sent", "label": "Quotations Sent", "type": "number"},
                {"key": "orders_received", "label": "Orders Received", "type": "number"},
                {"key": "order_value", "label": "Order Value (INR)", "type": "number"},
                {"key": "demos_conducted", "label": "Demos Conducted", "type": "number"},
                {"key": "lost_deals", "label": "Lost Deals", "type": "number"},
                {"key": "pipeline_value", "label": "Pipeline Value (INR)", "type": "number"},
                {"key": "payments_collected", "label": "Payments Collected (INR)", "type": "number"},
                {"key": "outstanding_followups", "label": "Outstanding Follow-ups", "type": "number"},
                {"key": "new_clients", "label": "New Clients Added", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Marketing": {
            "fields": [
                {"key": "social_posts", "label": "Social Media Posts Created", "type": "number"},
                {"key": "campaigns_launched", "label": "Campaigns Launched", "type": "number"},
                {"key": "leads_from_marketing", "label": "Leads from Marketing", "type": "number"},
                {"key": "inquiries", "label": "Website/Phone Inquiries", "type": "number"},
                {"key": "content_created", "label": "Content Pieces Created", "type": "number"},
                {"key": "events_planned", "label": "Events/Exhibitions Planned", "type": "number"},
                {"key": "collateral_updates", "label": "Brand Collateral Updates", "type": "number"},
                {"key": "market_research", "label": "Market Research Reports", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Purchase": {
            "fields": [
                {"key": "pos_raised", "label": "Purchase Orders Raised", "type": "number"},
                {"key": "po_value", "label": "PO Value (INR)", "type": "number"},
                {"key": "deliveries_received", "label": "Deliveries Received", "type": "number"},
                {"key": "pending_followups", "label": "Pending Deliveries Followed Up", "type": "number"},
                {"key": "vendor_comparisons", "label": "Vendor Comparisons Done", "type": "number"},
                {"key": "cost_savings", "label": "Cost Savings Identified (INR)", "type": "number"},
                {"key": "grn_done", "label": "GRN Entries Done", "type": "number"},
                {"key": "rejections_reported", "label": "Rejections Reported", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Administration": {
            "fields": [
                {"key": "issues_resolved", "label": "Facility Issues Resolved", "type": "number"},
                {"key": "vendor_payments", "label": "Vendor Payments Processed", "type": "number"},
                {"key": "inventory_managed", "label": "Inventory Items Managed", "type": "number"},
                {"key": "supplies_ordered", "label": "Office Supplies Ordered", "type": "number"},
                {"key": "visitors_managed", "label": "Visitors Managed", "type": "number"},
                {"key": "transport_arranged", "label": "Transport Arrangements", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Human Resource": {
            "fields": [
                {"key": "attendance_processed", "label": "Attendance Processing Done", "type": "boolean"},
                {"key": "leaves_processed", "label": "Leave Requests Processed", "type": "number"},
                {"key": "new_hires_onboarded", "label": "New Hires Onboarded", "type": "number"},
                {"key": "exits_processed", "label": "Exit Formalities Processed", "type": "number"},
                {"key": "trainings_conducted", "label": "Training Sessions Conducted", "type": "number"},
                {"key": "grievances_handled", "label": "Grievances Handled", "type": "number"},
                {"key": "payroll_queries", "label": "Payroll Queries Resolved", "type": "number"},
                {"key": "policy_updates", "label": "Policy Updates Communicated", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Production": {
            "fields": [
                {"key": "units_produced", "label": "Units Produced", "type": "number"},
                {"key": "target_units", "label": "Target Units", "type": "number"},
                {"key": "rejections", "label": "Rejection Count", "type": "number"},
                {"key": "downtime_hours", "label": "Machine Downtime (Hours)", "type": "number"},
                {"key": "overtime_hours", "label": "Overtime Hours", "type": "number"},
                {"key": "raw_material_used", "label": "Raw Material Consumed", "type": "number"},
                {"key": "wip_count", "label": "Work in Progress Count", "type": "number"},
                {"key": "safety_incidents", "label": "Safety Incidents", "type": "number"},
                {"key": "maintenance_issues", "label": "Maintenance Issues Reported", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Quality": {
            "fields": [
                {"key": "inspections_done", "label": "Inspections Completed", "type": "number"},
                {"key": "defects_found", "label": "Defects Found", "type": "number"},
                {"key": "rework_items", "label": "Rework Items", "type": "number"},
                {"key": "reports_generated", "label": "Quality Reports Generated", "type": "number"},
                {"key": "calibration_checks", "label": "Calibration Checks Done", "type": "number"},
                {"key": "ncr_raised", "label": "Non-Conformance Reports Raised", "type": "number"},
                {"key": "complaints_addressed", "label": "Customer Complaints Addressed", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Store ": {
            "fields": [
                {"key": "items_received", "label": "Items Received", "type": "number"},
                {"key": "items_issued", "label": "Items Issued", "type": "number"},
                {"key": "stock_entries_updated", "label": "Stock Entries Updated", "type": "number"},
                {"key": "physical_verification", "label": "Physical Verification Done", "type": "boolean"},
                {"key": "discrepancies", "label": "Discrepancies Found", "type": "number"},
                {"key": "grn_completed", "label": "GRN Completed", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Fabrication": {
            "fields": [
                {"key": "parts_fabricated", "label": "Parts Fabricated", "type": "number"},
                {"key": "target_parts", "label": "Target Parts", "type": "number"},
                {"key": "rejections", "label": "Rejection Count", "type": "number"},
                {"key": "downtime_hours", "label": "Machine Downtime (Hours)", "type": "number"},
                {"key": "raw_material_used", "label": "Raw Material Used (Kg)", "type": "number"},
                {"key": "safety_incidents", "label": "Safety Incidents", "type": "number"},
                {"key": "quality_passed", "label": "Quality Checks Passed", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Line Assembly": {
            "fields": [
                {"key": "units_assembled", "label": "Units Assembled", "type": "number"},
                {"key": "target_units", "label": "Target Units", "type": "number"},
                {"key": "rejections", "label": "Rejection Count", "type": "number"},
                {"key": "line_downtime", "label": "Line Downtime (Hours)", "type": "number"},
                {"key": "quality_passed", "label": "Quality Checks Passed", "type": "number"},
                {"key": "rework_items", "label": "Rework Items", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
                {"key": "delay_reasons", "label": "Delay Reasons", "type": "text"},
            ]
        },
        "Powder Coating": {
            "fields": [
                {"key": "items_coated", "label": "Items Coated", "type": "number"},
                {"key": "target_items", "label": "Target Items", "type": "number"},
                {"key": "rejections", "label": "Rejection Count", "type": "number"},
                {"key": "rework_items", "label": "Rework Items", "type": "number"},
                {"key": "material_consumed", "label": "Material Consumed (Kg)", "type": "number"},
                {"key": "quality_passed", "label": "Quality Checks Passed", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Electrical ": {
            "fields": [
                {"key": "installations_done", "label": "Installations Completed", "type": "number"},
                {"key": "wiring_done", "label": "Wiring Completed", "type": "number"},
                {"key": "testing_done", "label": "Testing Completed", "type": "number"},
                {"key": "faults_identified", "label": "Faults Identified", "type": "number"},
                {"key": "faults_resolved", "label": "Faults Resolved", "type": "number"},
                {"key": "safety_checks", "label": "Safety Checks Done", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Production Planning": {
            "fields": [
                {"key": "plans_created", "label": "Production Plans Created", "type": "number"},
                {"key": "plans_executed", "label": "Plans Executed", "type": "number"},
                {"key": "materials_planned", "label": "Material Requirements Planned", "type": "number"},
                {"key": "capacity_utilization", "label": "Capacity Utilization (%)", "type": "number"},
                {"key": "schedule_adherence", "label": "Schedule Adherence", "type": "boolean"},
                {"key": "bottlenecks", "label": "Bottlenecks Identified", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
        "Computer Numerical Control": {
            "fields": [
                {"key": "programs_run", "label": "Programs Run", "type": "number"},
                {"key": "parts_machined", "label": "Parts Machined", "type": "number"},
                {"key": "target_parts", "label": "Target Parts", "type": "number"},
                {"key": "rejections", "label": "Rejection Count", "type": "number"},
                {"key": "downtime_hours", "label": "Machine Downtime (Hours)", "type": "number"},
                {"key": "tool_changes", "label": "Tool Changes Done", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ]
        },
    }

    KPI_TEMPLATES = {
        "Accounts": [
            {"name": "Timely Payment %", "unit": "%", "target_value": 95, "calculation_type": "compliance", "mis_field_key": "tally_updated", "category": "financial", "weight": 1.5},
            {"name": "Payment Errors", "unit": "count", "target_value": 2, "calculation_type": "inverse_sum", "mis_field_key": "vendor_mismatches", "category": "quality", "weight": 1.0},
            {"name": "Vendor Reconciliation %", "unit": "%", "target_value": 95, "calculation_type": "compliance", "mis_field_key": "dealer_statements_updated", "category": "compliance", "weight": 1.2},
            {"name": "Bank Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "bank_statements_updated", "category": "compliance", "weight": 1.2},
            {"name": "2B Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "reconciliation_2b_done", "category": "compliance", "weight": 1.0},
            {"name": "Voucher Verification %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "voucher_check_done", "category": "compliance", "weight": 1.0},
            {"name": "Stock Statement Timeliness %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "stock_statement_submitted", "category": "compliance", "weight": 0.8},
        ],
        "Sales": [
            {"name": "Lead Conversion Rate %", "unit": "%", "target_value": 25, "calculation_type": "percentage", "mis_field_key": "orders_received", "mis_field_key_2": "new_leads", "category": "revenue", "weight": 1.5},
            {"name": "Monthly Revenue", "unit": "INR", "target_value": 5000000, "calculation_type": "sum", "mis_field_key": "order_value", "category": "revenue", "weight": 2.0},
            {"name": "Payment Collection", "unit": "INR", "target_value": 4000000, "calculation_type": "sum", "mis_field_key": "payments_collected", "category": "revenue", "weight": 1.5},
            {"name": "New Clients", "unit": "count", "target_value": 5, "calculation_type": "sum", "mis_field_key": "new_clients", "category": "growth", "weight": 1.0},
            {"name": "Daily Follow-ups", "unit": "avg", "target_value": 10, "calculation_type": "average", "mis_field_key": "followups_done", "category": "activity", "weight": 0.8},
        ],
        "Production": [
            {"name": "Production Efficiency %", "unit": "%", "target_value": 90, "calculation_type": "percentage", "mis_field_key": "units_produced", "mis_field_key_2": "target_units", "category": "efficiency", "weight": 2.0},
            {"name": "Rejection Rate", "unit": "count", "target_value": 5, "calculation_type": "inverse_sum", "mis_field_key": "rejections", "category": "quality", "weight": 1.5},
            {"name": "Safety Incidents", "unit": "count", "target_value": 0, "calculation_type": "sum", "mis_field_key": "safety_incidents", "category": "safety", "weight": 1.0},
            {"name": "Machine Downtime", "unit": "hours", "target_value": 10, "calculation_type": "inverse_sum", "mis_field_key": "downtime_hours", "category": "efficiency", "weight": 1.2},
        ],
        "Quality": [
            {"name": "First Pass Yield %", "unit": "%", "target_value": 95, "calculation_type": "percentage", "mis_field_key": "inspections_done", "mis_field_key_2": "defects_found", "category": "quality", "weight": 2.0},
            {"name": "Defect Rate", "unit": "count", "target_value": 5, "calculation_type": "inverse_sum", "mis_field_key": "defects_found", "category": "quality", "weight": 1.5},
            {"name": "NCR Closure Rate", "unit": "avg", "target_value": 3, "calculation_type": "average", "mis_field_key": "ncr_raised", "category": "compliance", "weight": 1.0},
        ],
        "Purchase": [
            {"name": "On-Time Delivery %", "unit": "%", "target_value": 90, "calculation_type": "percentage", "mis_field_key": "deliveries_received", "mis_field_key_2": "pos_raised", "category": "efficiency", "weight": 1.5},
            {"name": "Cost Savings", "unit": "INR", "target_value": 100000, "calculation_type": "sum", "mis_field_key": "cost_savings", "category": "financial", "weight": 1.5},
            {"name": "GRN Completion Rate", "unit": "avg", "target_value": 5, "calculation_type": "average", "mis_field_key": "grn_done", "category": "compliance", "weight": 1.0},
        ],
        "Human Resource": [
            {"name": "Attendance Accuracy %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "attendance_processed", "category": "compliance", "weight": 1.5},
            {"name": "Grievance Resolution", "unit": "avg", "target_value": 3, "calculation_type": "average", "mis_field_key": "grievances_handled", "category": "people", "weight": 1.2},
            {"name": "Training Sessions", "unit": "count", "target_value": 4, "calculation_type": "sum", "mis_field_key": "trainings_conducted", "category": "development", "weight": 1.0},
        ],
    }

    created_templates = 0
    created_kpis = 0

    # Seed MIS templates
    for dept_name, template_data in MIS_TEMPLATES.items():
        dept_id = dept_map.get(dept_name)
        if not dept_id:
            continue
        existing = await db.mis_templates.find_one({"department_id": dept_id})
        if existing:
            continue
        template = {
            "template_id": f"mist_{uuid.uuid4().hex[:12]}",
            "department_id": dept_id,
            "department_name": dept_name,
            "name": f"{dept_name} Daily MIS",
            "designation_level": "all",
            "fields": template_data["fields"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system"
        }
        await db.mis_templates.insert_one(template)
        created_templates += 1

    # Seed KPI definitions
    for dept_name, kpis in KPI_TEMPLATES.items():
        dept_id = dept_map.get(dept_name)
        if not dept_id:
            continue
        for kpi_data in kpis:
            existing = await db.kpi_definitions.find_one({
                "department_id": dept_id, "name": kpi_data["name"], "is_active": True
            })
            if existing:
                continue
            kpi = {
                "kpi_id": f"kpi_{uuid.uuid4().hex[:12]}",
                "department_id": dept_id,
                "name": kpi_data["name"],
                "description": "",
                "unit": kpi_data["unit"],
                "target_value": kpi_data["target_value"],
                "weight": kpi_data["weight"],
                "calculation_type": kpi_data["calculation_type"],
                "mis_field_key": kpi_data.get("mis_field_key"),
                "mis_field_key_2": kpi_data.get("mis_field_key_2"),
                "category": kpi_data.get("category", "operational"),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            }
            await db.kpi_definitions.insert_one(kpi)
            created_kpis += 1

    return {
        "message": f"Seeded {created_templates} MIS templates and {created_kpis} KPI definitions",
        "templates_created": created_templates,
        "kpis_created": created_kpis
    }
