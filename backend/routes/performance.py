"""Performance Management System - Employee-Specific MIS, KPI, KRA & Evaluations"""
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


def period_range(period, ref_date=None):
    today = ref_date or datetime.now(timezone.utc).date()
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "quarterly":
        q = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=q, day=1)
    elif period == "half_yearly":
        start = today.replace(month=1 if today.month <= 6 else 7, day=1)
    else:
        start = today.replace(month=1, day=1)
    return str(start), str(today)


# ==================== MIS TEMPLATES (Employee-Specific) ====================

@router.get("/mis-templates")
async def list_mis_templates(
    request: Request,
    department_id: Optional[str] = None,
    employee_id: Optional[str] = None
):
    user = await get_current_user(request)
    query = {"is_active": True}
    if employee_id:
        query["$or"] = [{"employee_id": employee_id}, {"employee_id": None, "department_id": None}]
    elif department_id:
        query["$or"] = [{"department_id": department_id, "employee_id": None}, {"employee_id": None, "department_id": None}]

    if not is_admin_or_hr(user.get("role")) and not employee_id:
        query = {"is_active": True, "employee_id": user.get("employee_id")}

    templates = await db.mis_templates.find(query, {"_id": 0}).sort("employee_name", 1).to_list(500)
    return templates


@router.get("/mis-templates/employee/{employee_id}")
async def get_employee_template(employee_id: str, request: Request):
    await get_current_user(request)
    template = await db.mis_templates.find_one(
        {"employee_id": employee_id, "is_active": True}, {"_id": 0}
    )
    if not template:
        emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0, "department_id": 1})
        if emp and emp.get("department_id"):
            template = await db.mis_templates.find_one(
                {"department_id": emp["department_id"], "employee_id": None, "is_active": True}, {"_id": 0}
            )
    return template


@router.post("/mis-templates")
async def create_mis_template(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    emp_id = data.get("employee_id")
    emp_name = ""
    dept_id = data.get("department_id")
    if emp_id:
        emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0})
        if emp:
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            dept_id = dept_id or emp.get("department_id")

    template = {
        "template_id": f"mist_{uuid.uuid4().hex[:12]}",
        "employee_id": emp_id,
        "employee_name": emp_name,
        "department_id": dept_id,
        "department_name": data.get("department_name", ""),
        "name": data.get("name", f"{emp_name} Daily MIS" if emp_name else "Daily MIS"),
        "fields": data.get("fields", []),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    # Upsert: replace if employee-specific template exists
    if emp_id:
        existing = await db.mis_templates.find_one({"employee_id": emp_id, "is_active": True})
        if existing:
            template["template_id"] = existing["template_id"]
            await db.mis_templates.update_one(
                {"template_id": existing["template_id"]},
                {"$set": template}
            )
            template.pop("_id", None)
            return template

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


@router.delete("/mis-templates/{template_id}")
async def delete_mis_template(template_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.mis_templates.update_one({"template_id": template_id}, {"$set": {"is_active": False}})
    return {"message": "Template deleted"}


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
        fd, td = period_range(period)
        query["date"] = {"$gte": fd, "$lte": td}

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
        "status": "submitted",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if existing:
        entry["status"] = existing.get("status", "submitted")
        if existing.get("status") == "verified":
            entry["status"] = "resubmitted"
        await db.mis_entries.update_one({"entry_id": existing["entry_id"]}, {"$set": entry})
    else:
        entry["created_at"] = datetime.now(timezone.utc).isoformat()
        entry["submitted_by"] = user.get("employee_id") or user["user_id"]
        await db.mis_entries.insert_one(entry)
        entry.pop("_id", None)

    return entry


@router.put("/mis-entries/{entry_id}/verify")
async def verify_mis_entry(entry_id: str, data: dict, request: Request):
    user = await get_current_user(request)
    update = {
        "manager_remarks": data.get("manager_remarks", ""),
        "status": data.get("status", "verified"),
        "verified_by": user.get("employee_id") or user["user_id"],
        "verified_by_name": user.get("name", ""),
        "verified_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mis_entries.update_one({"entry_id": entry_id}, {"$set": update})
    return {"message": f"MIS entry {update['status']}"}


@router.get("/mis-compliance")
async def get_mis_compliance(request: Request, date: Optional[str] = None):
    """Show who has and hasn't submitted MIS for a given date"""
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    check_date = date or str(datetime.now(timezone.utc).date())

    # Get all employees with MIS templates
    templates = await db.mis_templates.find(
        {"is_active": True, "employee_id": {"$ne": None}}, {"_id": 0, "employee_id": 1, "employee_name": 1, "department_id": 1}
    ).to_list(500)

    emp_ids_with_template = [t["employee_id"] for t in templates]

    # Get today's submissions
    submissions = await db.mis_entries.find(
        {"date": check_date, "employee_id": {"$in": emp_ids_with_template}},
        {"_id": 0, "employee_id": 1, "status": 1}
    ).to_list(500)
    submitted_ids = {s["employee_id"]: s["status"] for s in submissions}

    filled = []
    not_filled = []
    for t in templates:
        emp_id = t["employee_id"]
        dept = await db.departments.find_one({"department_id": t.get("department_id")}, {"_id": 0, "name": 1})
        info = {
            "employee_id": emp_id,
            "employee_name": t.get("employee_name", ""),
            "department_name": dept.get("name", "") if dept else ""
        }
        if emp_id in submitted_ids:
            info["status"] = submitted_ids[emp_id]
            filled.append(info)
        else:
            not_filled.append(info)

    return {
        "date": check_date,
        "total_assigned": len(emp_ids_with_template),
        "filled": len(filled),
        "not_filled": len(not_filled),
        "filled_list": filled,
        "not_filled_list": not_filled
    }


# ==================== MIS SUMMARY ====================

@router.get("/mis-summary")
async def get_mis_summary(
    request: Request,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
    period: str = "monthly"
):
    user = await get_current_user(request)
    if not employee_id and not is_admin_or_hr(user.get("role")):
        employee_id = user.get("employee_id")

    fd, td = period_range(period)
    match = {"date": {"$gte": fd, "$lte": td}}
    if employee_id:
        match["employee_id"] = employee_id
    if department_id:
        match["department_id"] = department_id

    entries = await db.mis_entries.find(match, {"_id": 0}).to_list(10000)
    entry_count = len(entries)

    numeric_sums = {}
    bool_counts = {}
    for entry in entries:
        for key, val in entry.get("fields", {}).items():
            if isinstance(val, (int, float)):
                numeric_sums[key] = numeric_sums.get(key, 0) + val
            elif isinstance(val, bool):
                if key not in bool_counts:
                    bool_counts[key] = {"true": 0, "total": 0}
                bool_counts[key]["total"] += 1
                if val:
                    bool_counts[key]["true"] += 1

    return {
        "period": period,
        "from_date": fd,
        "to_date": td,
        "entry_count": entry_count,
        "sums": numeric_sums,
        "averages": {k: round(v / max(entry_count, 1), 2) for k, v in numeric_sums.items()},
        "compliance_rates": {
            k: round(v["true"] / max(v["total"], 1) * 100, 1) for k, v in bool_counts.items()
        }
    }


# ==================== KPI DEFINITIONS (Employee-Specific) ====================

@router.get("/kpi-definitions")
async def list_kpi_definitions(
    request: Request,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    user = await get_current_user(request)
    query = {"is_active": True}

    if employee_id:
        query["employee_id"] = employee_id
    elif not is_admin_or_hr(user.get("role")):
        query["employee_id"] = user.get("employee_id")
    elif department_id:
        query["department_id"] = department_id

    defs = await db.kpi_definitions.find(query, {"_id": 0}).to_list(500)
    return defs


@router.post("/kpi-definitions")
async def create_kpi_definition(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    emp_name = ""
    if data.get("employee_id"):
        emp = await db.employees.find_one({"employee_id": data["employee_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        if emp:
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    definition = {
        "kpi_id": f"kpi_{uuid.uuid4().hex[:12]}",
        "name": data["name"],
        "description": data.get("description", ""),
        "employee_id": data.get("employee_id"),
        "employee_name": emp_name,
        "department_id": data.get("department_id"),
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


# ==================== KPI SCORES ====================

@router.get("/kpi-scores")
async def get_kpi_scores(
    request: Request,
    employee_id: Optional[str] = None,
    period: str = "monthly"
):
    user = await get_current_user(request)
    if not employee_id:
        employee_id = user.get("employee_id")

    fd, td = period_range(period)

    kpi_defs = await db.kpi_definitions.find(
        {"employee_id": employee_id, "is_active": True}, {"_id": 0}
    ).to_list(100)

    mis_entries = await db.mis_entries.find(
        {"employee_id": employee_id, "date": {"$gte": fd, "$lte": td}}, {"_id": 0}
    ).to_list(500)
    entry_count = len(mis_entries)

    # Check for manual overrides
    overrides = {}
    override_docs = await db.kpi_scores.find(
        {"employee_id": employee_id, "period": period, "from_date": fd}, {"_id": 0}
    ).to_list(100)
    for od in override_docs:
        overrides[od["kpi_id"]] = od

    scores = []
    for kpi in kpi_defs:
        calc = kpi.get("calculation_type", "manual")
        fk = kpi.get("mis_field_key")
        fk2 = kpi.get("mis_field_key_2")
        target = kpi.get("target_value", 100)
        actual = 0
        source = "auto"

        # Check override first
        override = overrides.get(kpi["kpi_id"])
        if override and override.get("manual_override"):
            actual = override.get("actual_value", 0)
            source = "manual"
        elif calc == "manual" or not fk or entry_count == 0:
            actual = override.get("actual_value", 0) if override else 0
            source = "manual"
        elif calc == "sum":
            actual = sum(e.get("fields", {}).get(fk, 0) for e in mis_entries if isinstance(e.get("fields", {}).get(fk, 0), (int, float)))
        elif calc == "average":
            total = sum(e.get("fields", {}).get(fk, 0) for e in mis_entries if isinstance(e.get("fields", {}).get(fk, 0), (int, float)))
            actual = round(total / entry_count, 2)
        elif calc == "compliance":
            tc = sum(1 for e in mis_entries if e.get("fields", {}).get(fk) is True)
            actual = round(tc / entry_count * 100, 1)
        elif calc == "percentage":
            num = sum(e.get("fields", {}).get(fk, 0) for e in mis_entries if isinstance(e.get("fields", {}).get(fk, 0), (int, float)))
            den = sum(e.get("fields", {}).get(fk2, 0) for e in mis_entries if isinstance(e.get("fields", {}).get(fk2, 0), (int, float)))
            actual = round(num / max(den, 1) * 100, 1)
        elif calc == "inverse_sum":
            actual = sum(e.get("fields", {}).get(fk, 0) for e in mis_entries if isinstance(e.get("fields", {}).get(fk, 0), (int, float)))

        if calc == "inverse_sum":
            score = max(0, round((1 - actual / max(target, 1)) * 100, 1)) if target else 100
        else:
            score = min(100, round(actual / max(target, 0.01) * 100, 1)) if target else 0

        scores.append({
            "kpi_id": kpi["kpi_id"], "name": kpi["name"], "category": kpi.get("category"),
            "unit": kpi.get("unit", "%"), "target_value": target, "actual_value": actual,
            "score_percentage": score, "weight": kpi.get("weight", 1.0),
            "calculation_type": calc, "source": source
        })

    tw = sum(s["weight"] for s in scores) or 1
    ws = round(sum(s["score_percentage"] * s["weight"] for s in scores) / tw, 1)

    return {"scores": scores, "weighted_score": ws, "period": period, "from_date": fd, "to_date": td, "entry_count": entry_count}


@router.post("/kpi-scores/override")
async def override_kpi_score(data: dict, request: Request):
    """Manager/HR manually scores or overrides an auto-calculated KPI"""
    user = await get_current_user(request)
    kpi_id = data["kpi_id"]
    employee_id = data["employee_id"]
    period = data.get("period", "monthly")
    fd, _ = period_range(period)

    score_doc = {
        "kpi_id": kpi_id,
        "employee_id": employee_id,
        "period": period,
        "from_date": fd,
        "actual_value": data.get("actual_value", 0),
        "manual_override": True,
        "scored_by": user.get("employee_id") or user["user_id"],
        "scored_at": datetime.now(timezone.utc).isoformat(),
        "remarks": data.get("remarks", "")
    }

    await db.kpi_scores.update_one(
        {"kpi_id": kpi_id, "employee_id": employee_id, "period": period, "from_date": fd},
        {"$set": score_doc},
        upsert=True
    )
    return {"message": "KPI score updated"}


# ==================== KRA DEFINITIONS ====================

@router.get("/kra-definitions")
async def list_kra_definitions(request: Request, employee_id: Optional[str] = None):
    user = await get_current_user(request)
    query = {"is_active": True}
    if employee_id:
        query["employee_id"] = employee_id
    elif not is_admin_or_hr(user.get("role")):
        query["employee_id"] = user.get("employee_id")
    return await db.kra_definitions.find(query, {"_id": 0}).to_list(200)


@router.post("/kra-definitions")
async def create_kra_definition(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    emp_name = ""
    if data.get("employee_id"):
        emp = await db.employees.find_one({"employee_id": data["employee_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        if emp:
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    kra = {
        "kra_id": f"kra_{uuid.uuid4().hex[:12]}",
        "name": data["name"],
        "description": data.get("description", ""),
        "employee_id": data.get("employee_id"),
        "employee_name": emp_name,
        "department_id": data.get("department_id"),
        "weight": data.get("weight", 1.0),
        "target_description": data.get("target_description", ""),
        "linked_kpi_ids": data.get("linked_kpi_ids", []),
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
async def list_evaluations(request: Request, employee_id: Optional[str] = None, cycle: Optional[str] = None):
    user = await get_current_user(request)
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    elif not is_admin_or_hr(user.get("role")):
        query["employee_id"] = user.get("employee_id")
    if cycle:
        query["cycle"] = cycle
    return await db.evaluations.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/evaluations")
async def create_evaluation(data: dict, request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    emp_name = ""
    if data.get("employee_id"):
        emp = await db.employees.find_one({"employee_id": data["employee_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        if emp:
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    ratings = [data.get("self_rating"), data.get("manager_rating"), data.get("hr_rating")]
    valid_ratings = [r for r in ratings if r is not None]
    overall = round(sum(valid_ratings) / len(valid_ratings), 1) if valid_ratings else None

    ev = {
        "evaluation_id": f"eval_{uuid.uuid4().hex[:12]}",
        "employee_id": data["employee_id"],
        "employee_name": emp_name,
        "cycle": data.get("cycle", "quarterly"),
        "period_label": data.get("period_label", ""),
        "self_rating": data.get("self_rating"),
        "self_comments": data.get("self_comments", ""),
        "manager_rating": data.get("manager_rating"),
        "manager_comments": data.get("manager_comments", ""),
        "hr_rating": data.get("hr_rating"),
        "hr_comments": data.get("hr_comments", ""),
        "overall_rating": overall,
        "status": data.get("status", "draft"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("employee_id") or user["user_id"]
    }
    await db.evaluations.insert_one(ev)
    ev.pop("_id", None)
    return ev


@router.put("/evaluations/{evaluation_id}")
async def update_evaluation(evaluation_id: str, data: dict, request: Request):
    await get_current_user(request)
    data.pop("_id", None)
    data.pop("evaluation_id", None)
    if any(data.get(k) for k in ["self_rating", "manager_rating", "hr_rating"]):
        ratings = [data.get("self_rating"), data.get("manager_rating"), data.get("hr_rating")]
        valid = [r for r in ratings if r is not None]
        if valid:
            data["overall_rating"] = round(sum(valid) / len(valid), 1)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.evaluations.update_one({"evaluation_id": evaluation_id}, {"$set": data})
    return {"message": "Evaluation updated"}


# ==================== CROSS-DEPARTMENT VERIFICATION ====================

@router.get("/cross-verification")
async def cross_department_verification(request: Request, period: str = "monthly"):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    fd, td = period_range(period)
    entries = await db.mis_entries.find(
        {"date": {"$gte": fd, "$lte": td}}, {"_id": 0}
    ).to_list(50000)

    dept_agg = {}
    for e in entries:
        did = e.get("department_id", "unknown")
        if did not in dept_agg:
            dept_agg[did] = {}
        for k, v in e.get("fields", {}).items():
            if isinstance(v, (int, float)):
                dept_agg[did][k] = dept_agg[did].get(k, 0) + v

    # Cross-verification rules
    checks = [
        {"name": "Purchase POs vs Store GRNs", "dept_a_field": "pos_raised", "dept_b_field": "grn_completed", "description": "POs raised by Purchase should match GRNs in Store"},
        {"name": "Production Units vs Quality Inspections", "dept_a_field": "units_produced", "dept_b_field": "inspections_done", "description": "Units produced should be inspected by Quality"},
        {"name": "Purchase Rejections vs Quality Defects", "dept_a_field": "rejections_reported", "dept_b_field": "defects_found", "description": "Purchase rejections should correlate with Quality defects"},
    ]

    results = []
    for check in checks:
        val_a = val_b = None
        for did, agg in dept_agg.items():
            if check["dept_a_field"] in agg:
                val_a = agg[check["dept_a_field"]]
            if check["dept_b_field"] in agg:
                val_b = agg[check["dept_b_field"]]

        if val_a is not None or val_b is not None:
            match_pct = 0
            if val_a and val_b:
                match_pct = round(min(val_a, val_b) / max(val_a, val_b) * 100, 1)
            results.append({
                "name": check["name"],
                "description": check["description"],
                "value_a": val_a or 0,
                "value_b": val_b or 0,
                "match_percentage": match_pct,
                "status": "matched" if match_pct >= 90 else "mismatch" if match_pct < 70 else "partial"
            })

    return {"period": period, "from_date": fd, "to_date": td, "checks": results}


# ==================== COMPANY DASHBOARD ====================

@router.get("/company-dashboard")
async def get_company_dashboard(request: Request, period: str = "monthly"):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    fd, td = period_range(period)
    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(30)

    dept_summaries = []
    for dept in departments:
        did = dept["department_id"]
        mis_count = await db.mis_entries.count_documents({"department_id": did, "date": {"$gte": fd, "$lte": td}})
        emp_count = await db.employees.count_documents({"department_id": did, "is_active": True})
        templates_count = await db.mis_templates.count_documents({"department_id": did, "employee_id": {"$ne": None}, "is_active": True})

        dept_summaries.append({
            "department_id": did, "department_name": dept["name"],
            "employee_count": emp_count, "templates_assigned": templates_count,
            "mis_entries": mis_count,
            "mis_compliance": round(mis_count / max(emp_count, 1), 1)
        })

    total_mis = await db.mis_entries.count_documents({"date": {"$gte": fd, "$lte": td}})
    total_employees = await db.employees.count_documents({"is_active": True})
    total_templates = await db.mis_templates.count_documents({"employee_id": {"$ne": None}, "is_active": True})

    return {
        "period": period, "from_date": fd, "to_date": td,
        "total_employees": total_employees,
        "total_templates_assigned": total_templates,
        "total_mis_entries": total_mis,
        "department_summaries": dept_summaries
    }


# ==================== SEED DATA ====================

@router.post("/seed-data")
async def seed_employee_data(request: Request):
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    created = {"templates": 0, "kpis": 0, "kras": 0}
    now = datetime.now(timezone.utc).isoformat()

    EMPLOYEE_MIS = {
        "EMP31088E46": {  # Rudra Pratap Singh - Accounts
            "name": "Rudra Pratap Singh",
            "fields": [
                {"key": "payments_processed", "label": "Payments Processed Today", "type": "number"},
                {"key": "payment_value", "label": "Value of Payments Processed (INR)", "type": "number"},
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
            ],
            "kpis": [
                {"name": "Timely Payment %", "unit": "%", "target_value": 95, "calculation_type": "compliance", "mis_field_key": "tally_updated", "category": "financial", "weight": 1.5},
                {"name": "Payment Errors", "unit": "count", "target_value": 2, "calculation_type": "inverse_sum", "mis_field_key": "vendor_mismatches", "category": "quality", "weight": 1.0},
                {"name": "Vendor Reconciliation %", "unit": "%", "target_value": 95, "calculation_type": "compliance", "mis_field_key": "dealer_statements_updated", "category": "compliance", "weight": 1.2},
                {"name": "Bank Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "bank_statements_updated", "category": "compliance", "weight": 1.2},
                {"name": "2B Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "reconciliation_2b_done", "category": "compliance", "weight": 1.0},
                {"name": "Voucher Verification %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "voucher_check_done", "category": "compliance", "weight": 1.0},
                {"name": "Stock Statement Timeliness %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "stock_statement_submitted", "category": "compliance", "weight": 0.8},
                {"name": "Bank Receipt Posting TAT", "unit": "avg", "target_value": 10, "calculation_type": "average", "mis_field_key": "bank_entries_posted", "category": "efficiency", "weight": 1.0},
            ],
        },
        "EMP35946842": {  # Rounak Singh - Accounts
            "name": "Rounak Singh",
            "fields": [
                {"key": "followups_done", "label": "Follow-ups Done", "type": "number"},
                {"key": "entries_made", "label": "Entries Made Today", "type": "number"},
                {"key": "supplier_gst_check", "label": "Checking with Suppliers for GST Filings", "type": "dropdown", "options": ["Completed", "Partial", "Not Done", "N/A"]},
                {"key": "sewa_updation", "label": "SEWA Updation", "type": "dropdown", "options": ["Completed", "Partial", "Not Done"]},
                {"key": "gst_reconciliation_done", "label": "GST Reconciliation Done", "type": "boolean"},
                {"key": "expense_entries_done", "label": "All Expense Entries Done", "type": "boolean"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ],
            "kpis": [
                {"name": "GST Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "gst_reconciliation_done", "category": "compliance", "weight": 2.0},
                {"name": "Expense Entry %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "expense_entries_done", "category": "compliance", "weight": 1.5},
                {"name": "Daily Follow-ups", "unit": "avg", "target_value": 5, "calculation_type": "average", "mis_field_key": "followups_done", "category": "activity", "weight": 1.0},
            ],
        },
        "EMP6BE094D9": {  # Praveen Kumar Verma - Accounts
            "name": "Praveen Kumar Verma",
            "fields": [
                {"key": "tax_invoices", "label": "Tax Invoices (with e-Invoicing & e-Way Bill)", "type": "number"},
                {"key": "purchase_entries", "label": "Purchase Entries", "type": "number"},
                {"key": "clearance_sales_match", "label": "Clearance & Sales Register Match", "type": "dropdown", "options": ["Matched", "Partial Match", "Mismatch", "Not Done"]},
                {"key": "dg_manufacturing_entry", "label": "DG Manufacturing Entry", "type": "dropdown", "options": ["Completed", "Partial", "Not Done"]},
                {"key": "dispatch_register", "label": "Daily Dispatch Register Maintained", "type": "boolean"},
                {"key": "tds_on_purchase", "label": "TDS on Purchase", "type": "dropdown", "options": ["Completed", "Partial", "Not Done", "N/A"]},
                {"key": "debit_credit_resolved", "label": "Debit/Credit Notes Issues Resolved", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ],
            "kpis": [
                {"name": "Petty Cash Handling Accuracy", "unit": "%", "target_value": 100, "calculation_type": "manual", "category": "financial", "weight": 1.5},
                {"name": "All Accounts Entry Completion", "unit": "%", "target_value": 100, "calculation_type": "manual", "category": "compliance", "weight": 2.0},
                {"name": "Debit/Credit Notes Resolution", "unit": "avg", "target_value": 3, "calculation_type": "average", "mis_field_key": "debit_credit_resolved", "category": "efficiency", "weight": 1.0},
                {"name": "Dispatch Register Maintenance %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "dispatch_register", "category": "compliance", "weight": 1.2},
            ],
        },
    }

    SENIOR_EXEC_KRAS = {
        "EMPC6B9A606": {  # Nandini Kumari - HR Head
            "name": "Nandini Kumari",
            "kras": [
                {"name": "Employee Retention Rate", "description": "Maintain attrition below target", "weight": 2.0},
                {"name": "Training Completion %", "description": "Ensure all mandatory trainings completed", "weight": 1.5},
                {"name": "Attendance Compliance", "description": "Overall attendance compliance across firm", "weight": 1.0},
                {"name": "Grievance Resolution TAT", "description": "Resolve grievances within SLA", "weight": 1.2},
                {"name": "Payroll Accuracy", "description": "Zero payroll errors", "weight": 1.5},
            ]
        },
        "EMP8B9486DD": {  # Anup Kr Mishra - Accounts Head
            "name": "Anup Kr Mishra",
            "kras": [
                {"name": "Financial Closing Timeliness", "description": "Monthly closing within 5 working days", "weight": 2.0},
                {"name": "Audit Compliance", "description": "All audit observations resolved", "weight": 1.5},
                {"name": "Vendor Payment Accuracy", "description": "Zero payment errors across dept", "weight": 1.5},
                {"name": "GST Filing Timeliness", "description": "All GST returns filed on time", "weight": 1.2},
                {"name": "Cash Flow Management", "description": "Maintain healthy cash flow ratio", "weight": 1.0},
            ]
        },
        "EMP8B117F26": {  # Manoj Kumar - Sales Head
            "name": "Manoj Kumar",
            "kras": [
                {"name": "Revenue vs Target", "description": "Achieve monthly/quarterly revenue targets", "weight": 2.5},
                {"name": "New Client Acquisition", "description": "Add target number of new clients", "weight": 1.5},
                {"name": "Order Pipeline", "description": "Maintain healthy order pipeline value", "weight": 1.0},
                {"name": "Payment Collection Ratio", "description": "Collect payments within credit terms", "weight": 1.5},
                {"name": "Customer Retention", "description": "Retain existing customer base", "weight": 1.2},
            ]
        },
        "EMP484529A4": {  # Umesh Chandra Prasad - Audit Head
            "name": "Umesh Chandra Prasad",
            "kras": [
                {"name": "Audit Completion Rate", "description": "Complete all planned audits on schedule", "weight": 2.0},
                {"name": "Non-Conformance Closure", "description": "Close all non-conformances within SLA", "weight": 1.5},
                {"name": "Compliance Score", "description": "Maintain overall compliance score above target", "weight": 1.5},
                {"name": "Process Improvement", "description": "Identify and implement process improvements", "weight": 1.0},
                {"name": "Risk Mitigation", "description": "Identify and mitigate operational risks", "weight": 1.2},
            ]
        },
        "EMP5618F5FF": {  # KN Sinha - Production Head
            "name": "KN Sinha",
            "kras": [
                {"name": "OEE %", "description": "Overall Equipment Effectiveness above target", "weight": 2.0},
                {"name": "Rejection Rate", "description": "Keep rejection rate below target across all lines", "weight": 1.5},
                {"name": "On-Time Delivery", "description": "Deliver production orders on schedule", "weight": 1.5},
                {"name": "Safety Incidents", "description": "Zero safety incidents", "weight": 1.5},
                {"name": "Capacity Utilization", "description": "Maximize production capacity utilization", "weight": 1.2},
            ]
        },
    }

    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(30)
    dept_map = {d["department_id"]: d["name"] for d in departments}

    # Clean old seeded data
    await db.mis_templates.delete_many({"created_by": "system"})
    await db.kpi_definitions.delete_many({"created_by": "system"})
    await db.kra_definitions.delete_many({"created_by": "system"})

    # Seed employee-specific MIS templates and KPIs
    for emp_id, data in EMPLOYEE_MIS.items():
        emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0, "department_id": 1})
        dept_id = emp.get("department_id") if emp else None
        dept_name = dept_map.get(dept_id, "")

        template = {
            "template_id": f"mist_{uuid.uuid4().hex[:12]}",
            "employee_id": emp_id,
            "employee_name": data["name"],
            "department_id": dept_id,
            "department_name": dept_name,
            "name": f"{data['name']} - Daily MIS",
            "fields": data["fields"],
            "is_active": True,
            "created_at": now,
            "created_by": "system"
        }
        await db.mis_templates.insert_one(template)
        created["templates"] += 1

        for kpi_data in data.get("kpis", []):
            kpi = {
                "kpi_id": f"kpi_{uuid.uuid4().hex[:12]}",
                "employee_id": emp_id,
                "employee_name": data["name"],
                "department_id": dept_id,
                "name": kpi_data["name"],
                "unit": kpi_data.get("unit", "%"),
                "target_value": kpi_data.get("target_value", 100),
                "weight": kpi_data.get("weight", 1.0),
                "calculation_type": kpi_data.get("calculation_type", "manual"),
                "mis_field_key": kpi_data.get("mis_field_key"),
                "mis_field_key_2": kpi_data.get("mis_field_key_2"),
                "category": kpi_data.get("category", "operational"),
                "is_active": True,
                "created_at": now,
                "created_by": "system"
            }
            await db.kpi_definitions.insert_one(kpi)
            created["kpis"] += 1

    # Seed Senior Executive KRAs
    for emp_id, data in SENIOR_EXEC_KRAS.items():
        emp = await db.employees.find_one({"employee_id": emp_id}, {"_id": 0, "department_id": 1})
        dept_id = emp.get("department_id") if emp else None

        for kra_data in data["kras"]:
            kra = {
                "kra_id": f"kra_{uuid.uuid4().hex[:12]}",
                "employee_id": emp_id,
                "employee_name": data["name"],
                "department_id": dept_id,
                "name": kra_data["name"],
                "description": kra_data["description"],
                "weight": kra_data.get("weight", 1.0),
                "is_active": True,
                "created_at": now,
                "created_by": "system"
            }
            await db.kra_definitions.insert_one(kra)
            created["kras"] += 1

    return {
        "message": f"Seeded {created['templates']} MIS templates, {created['kpis']} KPIs, {created['kras']} KRAs",
        **created
    }
