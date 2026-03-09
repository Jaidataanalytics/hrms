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





# ==================== PERFORMANCE INSIGHTS DASHBOARD ====================

@router.get("/insights")
async def get_performance_insights(request: Request, period: str = "monthly"):
    """Comprehensive performance insights for employer dashboard"""
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    today = datetime.now(timezone.utc)
    if period == "weekly":
        start = today - timedelta(days=7)
    elif period == "monthly":
        start = today.replace(day=1)
    elif period == "quarterly":
        q_month = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=q_month, day=1)
    elif period == "half_yearly":
        start = today.replace(month=1 if today.month <= 6 else 7, day=1)
    else:
        start = today.replace(month=1, day=1)

    start_str = str(start.date())
    today_str = str(today.date())

    # Fetch all core data
    templates = await db.mis_templates.find({"is_active": True}, {"_id": 0}).to_list(200)
    kpi_defs = await db.kpi_definitions.find({"is_active": True}, {"_id": 0}).to_list(500)
    entries = await db.mis_entries.find({"date": {"$gte": start_str, "$lte": today_str}}, {"_id": 0}).to_list(5000)
    employees = await db.employees.find({"is_active": True}, {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "department_id": 1}).to_list(200)
    departments = await db.departments.find({"is_active": True}, {"_id": 0, "department_id": 1, "name": 1}).to_list(50)
    dept_map = {d["department_id"]: d["name"] for d in departments}

    # Build employee lookup
    emp_map = {}
    for e in employees:
        emp_map[e["employee_id"]] = f"{e.get('first_name', '')} {e.get('last_name', '')}".strip()

    # 1. DEPARTMENT HEALTH SCORES
    dept_health = {}
    kpi_scores_cache = {}
    for tpl in templates:
        eid = tpl.get("employee_id")
        did = tpl.get("department_id")
        if not eid or not did:
            continue
        emp_kpis = [k for k in kpi_defs if k.get("employee_id") == eid]
        emp_entries = [e for e in entries if e.get("employee_id") == eid]
        if not emp_kpis:
            continue

        # Simple score: count how many entries exist (compliance proxy)
        entry_count = len(emp_entries)
        if did not in dept_health:
            dept_health[did] = {"name": dept_map.get(did, did), "employees": [], "total_kpis": 0, "total_entries": 0}
        dept_health[did]["employees"].append({
            "employee_id": eid,
            "name": tpl.get("employee_name", emp_map.get(eid, "?")),
            "kpi_count": len(emp_kpis),
            "entry_count": entry_count,
            "frequency": tpl.get("frequency", "daily"),
        })
        dept_health[did]["total_kpis"] += len(emp_kpis)
        dept_health[did]["total_entries"] += entry_count

    # 2. MIS COMPLIANCE HEATMAP (last 14 days)
    compliance_heatmap = []
    template_emp_ids = {t["employee_id"] for t in templates if t.get("employee_id")}
    daily_templates = {t["employee_id"]: t for t in templates if t.get("frequency") == "daily" and t.get("employee_id")}
    for day_offset in range(14):
        check_date = str((today - timedelta(days=day_offset)).date())
        day_entries = [e for e in entries if e.get("date") == check_date]
        submitted_ids = {e["employee_id"] for e in day_entries}
        day_data = {"date": check_date, "employees": []}
        for eid, tpl in daily_templates.items():
            day_data["employees"].append({
                "employee_id": eid,
                "name": tpl.get("employee_name", emp_map.get(eid, "?")),
                "submitted": eid in submitted_ids,
                "status": next((e["status"] for e in day_entries if e.get("employee_id") == eid), "not_submitted"),
            })
        compliance_heatmap.append(day_data)

    # 3. RED FLAG ALERTS
    red_flags = []
    # Check who hasn't submitted MIS in last 3 days (for daily MIS employees)
    for eid, tpl in daily_templates.items():
        recent_entries = [e for e in entries if e.get("employee_id") == eid and e.get("date") >= str((today - timedelta(days=3)).date())]
        if len(recent_entries) == 0:
            red_flags.append({
                "type": "mis_missing",
                "severity": "high",
                "employee_id": eid,
                "employee_name": tpl.get("employee_name", emp_map.get(eid, "?")),
                "message": f"No MIS submitted in last 3 days",
            })

    # Check MIS entries with zero or abnormal values
    for entry in entries:
        fields = entry.get("fields", {})
        eid = entry.get("employee_id")
        for key, val in fields.items():
            if isinstance(val, (int, float)):
                # Flag unusually high defect rates
                if "defect" in key.lower() and val > 5:
                    red_flags.append({
                        "type": "kpi_threshold",
                        "severity": "medium",
                        "employee_id": eid,
                        "employee_name": emp_map.get(eid, "?"),
                        "message": f"High defect rate ({val}%) on {entry.get('date')}",
                    })
                # Flag high shortage counts
                if "shortage" in key.lower() and val > 10:
                    red_flags.append({
                        "type": "kpi_threshold",
                        "severity": "medium",
                        "employee_id": eid,
                        "employee_name": emp_map.get(eid, "?"),
                        "message": f"High material shortages ({val}) on {entry.get('date')}",
                    })

    # Deduplicate red flags
    seen = set()
    unique_flags = []
    for rf in red_flags:
        key = f"{rf['type']}_{rf['employee_id']}_{rf.get('message','')[:30]}"
        if key not in seen:
            seen.add(key)
            unique_flags.append(rf)

    # 4. KPI AUTOMATION SUMMARY
    auto_count = sum(1 for k in kpi_defs if k.get("calculation_type", "manual") != "manual")
    manual_count = sum(1 for k in kpi_defs if k.get("calculation_type", "manual") == "manual")

    # 5. EXECUTIVE KRA TRACKER
    exec_kras = await db.kra_definitions.find({"is_active": True}, {"_id": 0}).to_list(100)
    exec_tracker = {}
    for kra in exec_kras:
        eid = kra.get("employee_id")
        if eid not in exec_tracker:
            exec_tracker[eid] = {"name": kra.get("employee_name", emp_map.get(eid, "?")), "kras": []}
        exec_tracker[eid]["kras"].append({
            "name": kra.get("name"),
            "description": kra.get("description", ""),
            "weight": kra.get("weight", 1.0),
        })

    # 6. EMPLOYEE RANKING (by entry count as proxy for engagement)
    emp_rankings = []
    for tpl in templates:
        eid = tpl.get("employee_id")
        if not eid:
            continue
        emp_entries_count = len([e for e in entries if e.get("employee_id") == eid])
        emp_kpi_count = len([k for k in kpi_defs if k.get("employee_id") == eid])
        emp_rankings.append({
            "employee_id": eid,
            "name": tpl.get("employee_name", emp_map.get(eid, "?")),
            "department": dept_map.get(tpl.get("department_id"), "?"),
            "frequency": tpl.get("frequency", "?"),
            "mis_entries": emp_entries_count,
            "kpi_count": emp_kpi_count,
            "role": tpl.get("role", ""),
        })
    emp_rankings.sort(key=lambda x: x["mis_entries"], reverse=True)

    return {
        "period": period,
        "date_range": {"start": start_str, "end": today_str},
        "summary": {
            "total_employees": len(templates),
            "total_kpis": len(kpi_defs),
            "auto_kpis": auto_count,
            "manual_kpis": manual_count,
            "auto_pct": round(auto_count * 100 / max(auto_count + manual_count, 1)),
            "total_entries": len(entries),
            "total_departments": len(dept_health),
        },
        "department_health": list(dept_health.values()),
        "compliance_heatmap": compliance_heatmap,
        "red_flags": unique_flags[:20],
        "executive_kra_tracker": list(exec_tracker.values()),
        "employee_rankings": emp_rankings,
    }


# ==================== MANAGER TEAM VIEW ====================

@router.get("/my-team")
async def get_my_team(request: Request):
    """Get employees reporting to current user"""
    user = await get_current_user(request)
    emp_id = user.get("employee_id")
    if not emp_id:
        return []
    team = await db.employees.find(
        {"reporting_manager_id": emp_id, "is_active": True},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "department_id": 1, "designation": 1}
    ).to_list(100)
    return team


@router.get("/my-team-compliance")
async def get_team_compliance(request: Request, date: Optional[str] = None):
    """MIS compliance for manager's direct reports"""
    user = await get_current_user(request)
    emp_id = user.get("employee_id")
    if not emp_id:
        return {"date": "", "team": [], "filled": 0, "not_filled": 0}

    check_date = date or str(datetime.now(timezone.utc).date())
    team = await db.employees.find(
        {"reporting_manager_id": emp_id, "is_active": True},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "department_id": 1}
    ).to_list(100)
    team_ids = [t["employee_id"] for t in team]

    # Get which team members have MIS templates
    templates = await db.mis_templates.find(
        {"employee_id": {"$in": team_ids}, "is_active": True},
        {"_id": 0, "employee_id": 1}
    ).to_list(100)
    template_emp_ids = {t["employee_id"] for t in templates}

    # Get submissions
    submissions = await db.mis_entries.find(
        {"date": check_date, "employee_id": {"$in": list(template_emp_ids)}},
        {"_id": 0, "employee_id": 1, "status": 1, "entry_id": 1}
    ).to_list(100)
    submitted_map = {s["employee_id"]: s for s in submissions}

    results = []
    for t in team:
        eid = t["employee_id"]
        has_template = eid in template_emp_ids
        sub = submitted_map.get(eid)
        results.append({
            "employee_id": eid,
            "employee_name": f"{t.get('first_name', '')} {t.get('last_name', '')}".strip(),
            "has_template": has_template,
            "submitted": sub is not None,
            "status": sub["status"] if sub else "not_submitted",
            "entry_id": sub["entry_id"] if sub else None
        })

    filled = sum(1 for r in results if r["submitted"])
    return {"date": check_date, "team": results, "filled": filled, "not_filled": len(results) - filled, "total": len(results)}


@router.get("/my-team-entries")
async def get_team_entries(request: Request, date: Optional[str] = None):
    """Get MIS entries for manager's team for a specific date"""
    user = await get_current_user(request)
    emp_id = user.get("employee_id")
    if not emp_id:
        return []

    check_date = date or str(datetime.now(timezone.utc).date())
    team = await db.employees.find(
        {"reporting_manager_id": emp_id, "is_active": True},
        {"_id": 0, "employee_id": 1}
    ).to_list(100)
    team_ids = [t["employee_id"] for t in team]

    entries = await db.mis_entries.find(
        {"date": check_date, "employee_id": {"$in": team_ids}},
        {"_id": 0}
    ).to_list(500)
    return entries


@router.get("/all-kpi-definitions")
async def list_all_kpi_definitions(request: Request):
    """Admin: Get ALL active KPI definitions grouped by employee"""
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    defs = await db.kpi_definitions.find({"is_active": True}, {"_id": 0}).to_list(500)
    return defs


@router.get("/all-kra-definitions")
async def list_all_kra_definitions(request: Request):
    """Admin: Get ALL active KRA definitions"""
    user = await get_current_user(request)
    if not is_admin_or_hr(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    defs = await db.kra_definitions.find({"is_active": True}, {"_id": 0}).to_list(500)
    return defs



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

    # =====================================================
    # EMPLOYEE MIS & KPI DATA (from uploaded documents)
    # =====================================================
    EMPLOYEE_MIS = {
        # ============================================================
        # ACCOUNTS DEPARTMENT
        # ============================================================
        # --- RUDRA PRATAP SINGH - Payment Processing, Vendor Mgmt, Bank Mgmt ---
        "EMP31088E46": {
            "name": "Rudra Pratap Singh",
            "role": "Payment Processing, Vendor Management, Bank Management",
            "frequency": "daily",
            "fields": [
                {"key": "payments_processed", "label": "Payments Processed Today", "type": "number"},
                {"key": "payment_value", "label": "Value of Payments Processed (INR)", "type": "number"},
                {"key": "receipts_recorded", "label": "Receipts Recorded Today", "type": "number"},
                {"key": "outstanding_followups", "label": "Outstanding Follow-ups Done", "type": "number"},
                {"key": "vendor_mismatches", "label": "Vendor Ledger Mismatches Identified", "type": "number"},
                {"key": "vendor_queries_resolved", "label": "Vendor Queries Resolved Today", "type": "number"},
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
                {"name": "Payment Processing Volume Trend", "unit": "avg", "target_value": 15, "calculation_type": "average", "mis_field_key": "payments_processed", "category": "operational", "weight": 0.8,
                 "scoring_rubric": "Tracks workload growth. Avg payments/day. >=15=100, 10-14=80, 5-9=50, <5=30"},
                {"name": "Vendor Query Resolution TAT", "unit": "avg", "target_value": 5, "calculation_type": "average", "mis_field_key": "vendor_queries_resolved", "category": "quality", "weight": 1.0,
                 "scoring_rubric": "Avg queries resolved/day. >=5=100, 3-4=80, 1-2=50, 0=0. Vendor satisfaction indicator."},
            ],
        },
        # --- ROUNAK SINGH - Reconciliation, GST/Tax Compliance, Expense Entries ---
        "EMP35946842": {
            "name": "Rounak Singh",
            "role": "Reconciliation, GST/Tax Compliance, Expense Entries",
            "frequency": "daily",
            "fields": [
                {"key": "followups_done", "label": "Follow-ups Done", "type": "number"},
                {"key": "entries_made", "label": "Entries Made Today", "type": "number"},
                {"key": "supplier_gst_check", "label": "Checking with Suppliers for GST Filings", "type": "dropdown", "options": ["Completed", "Partial", "Not Done", "N/A"]},
                {"key": "sewa_updation", "label": "SEWA Updation", "type": "dropdown", "options": ["Completed", "Partial", "Not Done"]},
                {"key": "gst_reconciliation_done", "label": "GST Reconciliation Done", "type": "boolean"},
                {"key": "expense_entries_done", "label": "All Expense Entries Done", "type": "boolean"},
                {"key": "reconciliation_corrections", "label": "Reconciliation Corrections Needed", "type": "number"},
                {"key": "days_before_gst_deadline", "label": "Days Before GST Filing Deadline", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ],
            "kpis": [
                {"name": "GST Reconciliation %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "gst_reconciliation_done", "category": "compliance", "weight": 2.0},
                {"name": "Expense Entry %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "expense_entries_done", "category": "compliance", "weight": 1.5},
                {"name": "Daily Follow-ups", "unit": "avg", "target_value": 5, "calculation_type": "average", "mis_field_key": "followups_done", "category": "activity", "weight": 1.0},
                {"name": "GST Filing Timeliness (Buffer Days)", "unit": "avg", "target_value": 3, "calculation_type": "average", "mis_field_key": "days_before_gst_deadline", "category": "compliance", "weight": 1.5,
                 "scoring_rubric": "Avg days before deadline. >=5=100, 3-4=80, 1-2=50, 0=30, missed=0. Higher buffer = lower risk."},
                {"name": "Reconciliation Accuracy %", "unit": "avg", "target_value": 0, "calculation_type": "inverse_sum", "mis_field_key": "reconciliation_corrections", "category": "quality", "weight": 1.2,
                 "scoring_rubric": "Fewer corrections = higher accuracy. 0/month=100, 1-2=80, 3-5=50, >5=20"},
            ],
        },
        # --- PRAVEEN KUMAR VERMA - Invoicing and Dispatch Register ---
        "EMP6BE094D9": {
            "name": "Praveen Kumar Verma",
            "role": "Invoicing and Dispatch Register",
            "frequency": "daily",
            "fields": [
                {"key": "tax_invoices", "label": "Tax Invoices (with e-Invoicing & e-Way Bill)", "type": "number"},
                {"key": "purchase_entries", "label": "Purchase Entries", "type": "number"},
                {"key": "clearance_sales_match", "label": "Clearance & Sales Register Match", "type": "dropdown", "options": ["Matched", "Partial Match", "Mismatch", "Not Done"]},
                {"key": "dg_manufacturing_entry", "label": "DG Manufacturing Entry", "type": "dropdown", "options": ["Completed", "Partial", "Not Done"]},
                {"key": "dispatch_register", "label": "Daily Dispatch Register Maintained", "type": "boolean"},
                {"key": "tds_on_purchase", "label": "TDS on Purchase", "type": "dropdown", "options": ["Completed", "Partial", "Not Done", "N/A"]},
                {"key": "debit_credit_resolved", "label": "Debit/Credit Notes Issues Resolved", "type": "number"},
                {"key": "invoice_errors", "label": "Invoice Errors Found/Corrected Today", "type": "number"},
                {"key": "eway_bills_generated", "label": "E-Way Bills Generated", "type": "number"},
                {"key": "eway_bills_required", "label": "E-Way Bills Required", "type": "number"},
                {"key": "critical_pending", "label": "Critical Pending Items", "type": "text"},
            ],
            "kpis": [
                {"name": "Petty Cash Handling Accuracy", "unit": "%", "target_value": 100, "calculation_type": "manual", "category": "financial", "weight": 1.5},
                {"name": "All Accounts Entry Completion", "unit": "%", "target_value": 100, "calculation_type": "manual", "category": "compliance", "weight": 2.0},
                {"name": "Debit/Credit Notes Resolution", "unit": "avg", "target_value": 3, "calculation_type": "average", "mis_field_key": "debit_credit_resolved", "category": "efficiency", "weight": 1.0},
                {"name": "Dispatch Register Maintenance %", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "dispatch_register", "category": "compliance", "weight": 1.2},
                {"name": "Invoice Error Rate", "unit": "avg", "target_value": 0, "calculation_type": "inverse_sum", "mis_field_key": "invoice_errors", "category": "quality", "weight": 1.5,
                 "scoring_rubric": "Wrong invoices -> GST notices -> penalties. 0/month=100, 1-2=70, 3-5=40, >5=0"},
                {"name": "E-Way Bill Compliance %", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "eway_bills_generated", "mis_field_key_2": "eway_bills_required", "category": "compliance", "weight": 1.5,
                 "scoring_rubric": "Generated/Required * 100. Missing e-way bills = legal risk. 100%=100, 95-99%=70, <95%=30"},
            ],
        },
        # ============================================================
        # STORE DEPARTMENT
        # ============================================================
        # --- AWDHESH KUMAR - Store Manager (WEEKLY MIS) ---
        "EMP4282E9BF": {
            "name": "Awdhesh Kumar",
            "role": "Store Manager",
            "frequency": "weekly",
            "fields": [
                {"key": "back_order_items_count", "label": "Back Orders Received This Week", "type": "number"},
                {"key": "back_order_resolved", "label": "Back Orders Resolved This Week", "type": "number"},
                {"key": "shortage_production_loss", "label": "Shortage Caused Production Loss", "type": "boolean"},
                {"key": "stock_out_items_count", "label": "Stock Outs This Week (Engine/Alt/Canopy)", "type": "number"},
                {"key": "stock_out_resolved", "label": "Stock Outs Resolved This Week", "type": "number"},
                {"key": "stock_out_production_loss", "label": "Stock Out Caused Production Loss", "type": "boolean"},
                {"key": "total_lots_received", "label": "Incoming Lots Inspected This Week", "type": "number"},
                {"key": "total_rejections", "label": "Rejections Found This Week", "type": "number"},
                {"key": "physical_inspection_done", "label": "Physical Incoming Inspection Done", "type": "boolean"},
                {"key": "fifo_followed", "label": "FIFO Followed for A-Grade Items", "type": "boolean"},
                {"key": "bin_card_updated", "label": "Bin Card Updated with FIFO Sticker", "type": "boolean"},
                {"key": "stacking_done", "label": "Stacking Done Properly", "type": "boolean"},
                {"key": "utilisation_sheet_attached", "label": "Utilisation Data Sheet Attached", "type": "boolean"},
                {"key": "housekeeping_3s_4s", "label": "Housekeeping 3S/4S Done", "type": "boolean"},
                {"key": "housekeeping_5s_progress", "label": "Working Towards 5S", "type": "boolean"},
                {"key": "kaizen_count", "label": "Kaizen Activities This Week", "type": "number"},
                {"key": "physical_stock_count_done", "label": "Physical Stock Count Done (Cycle Count)", "type": "boolean"},
                {"key": "dead_stock_value", "label": "Dead/Slow-Moving Stock Identified (INR)", "type": "number"},
                {"key": "production_material_complaints", "label": "Material Issue Complaints from Production", "type": "number"},
                {"key": "kaizen_description", "label": "Kaizen Details", "type": "text"},
                {"key": "remarks", "label": "Remarks", "type": "text"},
            ],
            "kpis": [
                {"name": "Back Order Resolution Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "back_order_resolved", "mis_field_key_2": "back_order_items_count", "category": "operational", "weight": 2.0,
                 "scoring_rubric": "Resolved/Received * 100. 100%=10, 80-99%=8, 60-79%=6, <60%=3", "max_marks": 10},
                {"name": "Stock Out Resolution Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "stock_out_resolved", "mis_field_key_2": "stock_out_items_count", "category": "operational", "weight": 2.0,
                 "scoring_rubric": "Resolved/Occurred * 100. 100%=10, 80-99%=8, 60-79%=6, <60%=3", "max_marks": 10},
                {"name": "Incoming Inspection Quality", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "total_rejections", "mis_field_key_2": "total_lots_received", "category": "quality", "weight": 2.0,
                 "scoring_rubric": "Lower rejection ratio = higher score", "max_marks": 10},
                {"name": "FIFO/Stacking/Bin Card Compliance", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "fifo_followed", "category": "compliance", "weight": 1.0,
                 "scoring_rubric": "Auto from 3 booleans: fifo + bin_card + stacking. All 3 yes=5, 2=3, 1=2, 0=0", "max_marks": 5},
                {"name": "Utilisation Data Compliance", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "utilisation_sheet_attached", "category": "compliance", "weight": 1.0,
                 "scoring_rubric": "Data sheet attached and accurate", "max_marks": 5},
                {"name": "Housekeeping Score", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "housekeeping_3s_4s", "category": "compliance", "weight": 1.0,
                 "scoring_rubric": "Auto: 3S/4S done + 5S progress. Both yes=5, 3S only=3, none=0", "max_marks": 5},
                {"name": "Kaizen per Month", "unit": "count", "target_value": 3, "calculation_type": "sum", "mis_field_key": "kaizen_count", "category": "operational", "weight": 1.0,
                 "scoring_rubric": "3+/month=5, 2=3, 1=2, 0=0", "max_marks": 5},
                {"name": "Stock Accuracy (Physical Count)", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "physical_stock_count_done", "category": "compliance", "weight": 1.5,
                 "scoring_rubric": "Weekly cycle count done? Discrepancy tracking. Always done=10, 3/4 weeks=7, 2/4=5, <2=2", "max_marks": 10},
            ],
        },
        # ============================================================
        # SALES DEPARTMENT
        # ============================================================
        # --- CHANDAN SHARMA - Sales Coordinator ---
        "EMPBD5000B3": {
            "name": "Chandan Sharma",
            "role": "Sales Coordinator",
            "frequency": "monthly",
            "fields": [
                {"key": "forecasted_sales_volume", "label": "Forecasted Sales Volume of the Month", "type": "number"},
                {"key": "actual_sales_volume", "label": "Actual Sales Volume of the Month", "type": "number"},
                {"key": "total_orders_processed", "label": "Total Orders Processed", "type": "number"},
                {"key": "accurate_orders_processed", "label": "Accurate Orders Processed", "type": "number"},
                {"key": "total_orders_received", "label": "Total Orders Received", "type": "number"},
                {"key": "on_time_orders_fulfilled", "label": "On-Time Orders Fulfilled", "type": "number"},
                {"key": "total_dealer_feedback", "label": "Total Feedback Received from Dealers", "type": "number"},
                {"key": "positive_dealer_feedback", "label": "Positive Feedback from Dealers", "type": "number"},
                {"key": "report_signoff_by_2nd", "label": "All Reports Signed Off by 2nd of Month", "type": "boolean"},
                {"key": "total_billing_value", "label": "Total Billing Value of Customers (INR)", "type": "number"},
                {"key": "total_overdue_amount", "label": "Total Overdue Amount at Month End (INR)", "type": "number"},
                {"key": "remarks", "label": "Remarks", "type": "text"},
            ],
            "kpis": [
                {"name": "Sales Forecast Accuracy", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "actual_sales_volume", "mis_field_key_2": "forecasted_sales_volume", "category": "operational", "weight": 1.0,
                 "scoring_rubric": "Auto: 100 - |Actual-Forecast|/Forecast * 100", "max_marks": 100},
                {"name": "Order Processing Accuracy", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "accurate_orders_processed", "mis_field_key_2": "total_orders_processed", "category": "quality", "weight": 1.0,
                 "scoring_rubric": "Accurate Orders / Total Orders * 100", "max_marks": 100},
                {"name": "Sales Backorder Rate (On-Time Fulfillment)", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "on_time_orders_fulfilled", "mis_field_key_2": "total_orders_received", "category": "operational", "weight": 1.0,
                 "scoring_rubric": "On-Time Fulfilled / Total Received * 100", "max_marks": 100},
                {"name": "Dealer Satisfaction Score", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "positive_dealer_feedback", "mis_field_key_2": "total_dealer_feedback", "category": "quality", "weight": 1.0,
                 "scoring_rubric": "Positive Feedback / Total Feedback * 100", "max_marks": 100},
                {"name": "Reporting Adherence", "unit": "%", "target_value": 100, "calculation_type": "compliance", "mis_field_key": "report_signoff_by_2nd", "category": "compliance", "weight": 1.0,
                 "scoring_rubric": "By 2nd: 100%, By 3rd: 50%, After: 0%", "max_marks": 100},
                {"name": "Overdue Collection %", "unit": "%", "target_value": 5, "calculation_type": "percentage", "mis_field_key": "total_overdue_amount", "mis_field_key_2": "total_billing_value", "category": "financial", "weight": 1.0,
                 "scoring_rubric": "Auto: Overdue/Billing*100. <5%: 100, 5-7%: 50, >7-10%: 20, >10%: 0", "max_marks": 100},
            ],
        },
        # --- ASM/BDM SALES TEAM (6 employees - same structure) ---
        "EMPACD56C4D": {
            "name": "Ashok Kumar",
            "role": "Area Sales Manager / BDM",
            "frequency": "monthly",
            "fields": [
                {"key": "sales_target", "label": "Monthly Sales Target (Units)", "type": "number"},
                {"key": "sales_achieved", "label": "Monthly Sales Achieved (Units)", "type": "number"},
                {"key": "new_leads_generated", "label": "New Leads Generated", "type": "number"},
                {"key": "customer_visits", "label": "Customer Visits / Meetings", "type": "number"},
                {"key": "orders_closed", "label": "Orders Closed", "type": "number"},
                {"key": "outstanding_followups", "label": "Outstanding Follow-ups Done", "type": "number"},
                {"key": "kpi_score_pct", "label": "Back Office KPI Score %", "type": "number"},
                {"key": "remarks", "label": "Remarks", "type": "text"},
            ],
            "kpis": [
                {"name": "Target Achievement %", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "sales_achieved", "mis_field_key_2": "sales_target", "category": "operational", "weight": 2.0,
                 "scoring_rubric": "Achievement/Target * 100. >=100%=100, 80-99%=80, 60-79%=60, <60%=40", "max_marks": 100},
                {"name": "Back Office KPI Score", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "kpi_score_pct", "category": "quality", "weight": 1.0,
                 "scoring_rubric": "Monthly KPI % score from back office activities", "max_marks": 100},
                {"name": "Lead Conversion Rate", "unit": "%", "target_value": 30, "calculation_type": "percentage", "mis_field_key": "orders_closed", "mis_field_key_2": "new_leads_generated", "category": "operational", "weight": 1.5,
                 "scoring_rubric": "Orders Closed / Leads * 100. Measures sales effectiveness. >=30%=100, 20-29%=80, 10-19%=50, <10%=20", "max_marks": 100},
                {"name": "Customer Visit Productivity", "unit": "%", "target_value": 20, "calculation_type": "percentage", "mis_field_key": "orders_closed", "mis_field_key_2": "customer_visits", "category": "efficiency", "weight": 1.0,
                 "scoring_rubric": "Orders/Visits * 100. Are visits translating to business? >=20%=100, 10-19%=70, 5-9%=40, <5%=10", "max_marks": 100},
            ],
        },
    }
    
    # Clone ASM/BDM structure for other 5 sales team members
    _ASM_TEMPLATE = EMPLOYEE_MIS["EMPACD56C4D"]
    for eid, ename in [
        ("EMPF08BB218", "Harendra Prasad"),
        ("EMP2A1C5C71", "Gavesh Kumar"),
        ("EMP8461D267", "Rahul Kumar"),
        ("EMP817A5537", "Vishal Kr Gupta"),
        ("EMP8C8264A1", "Amit Kumar"),
    ]:
        EMPLOYEE_MIS[eid] = {
            **_ASM_TEMPLATE,
            "name": ename,
            "fields": [dict(f) for f in _ASM_TEMPLATE["fields"]],
            "kpis": [dict(k) for k in _ASM_TEMPLATE["kpis"]],
        }
    
    # ============================================================
    # MARKETING DEPARTMENT
    # ============================================================
    EMPLOYEE_MIS["EMP7E8C1D39"] = {
        "name": "Prashant Kumar Gupta",
        "role": "Marketing Manager",
        "frequency": "monthly",
        "fields": [
            {"key": "total_customers_surveyed", "label": "Total Customers Surveyed", "type": "number"},
            {"key": "satisfied_customers", "label": "Satisfied Customers", "type": "number"},
            {"key": "total_marketing_spend", "label": "Total Marketing Spend (INR)", "type": "number"},
            {"key": "leads_generated", "label": "Total Leads Generated", "type": "number"},
            {"key": "gem_tenders_floated", "label": "GEM Tenders Floated", "type": "number"},
            {"key": "gem_tenders_participated", "label": "GEM Tenders Participated", "type": "number"},
            {"key": "gem_results", "label": "GEM Results (Won/Disqualified/Pending)", "type": "text"},
            {"key": "total_leads", "label": "Total Leads in Month", "type": "number"},
            {"key": "actual_enquiries", "label": "Actual Enquiries from Leads", "type": "number"},
            {"key": "dms_overdue_calls", "label": "DMS Overdue & Unassigned Calls", "type": "number"},
            {"key": "dms_total_entries", "label": "Total DMS Entries", "type": "number"},
            {"key": "dms_lost_enquiry", "label": "Lost Enquiry Count", "type": "number"},
            {"key": "website_total_clicks", "label": "Website/FB Ad Total Clicks", "type": "number"},
            {"key": "website_total_impressions", "label": "Website/FB Ad Total Impressions", "type": "number"},
            {"key": "new_enquiry_followups", "label": "New Enquiry Follow-ups Done", "type": "number"},
            {"key": "positive_responses", "label": "Positive Responses Received", "type": "number"},
            {"key": "remarks", "label": "Remarks", "type": "text"},
        ],
        "kpis": [
            {"name": "Customer Satisfaction Ratio (CSR)", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "satisfied_customers", "mis_field_key_2": "total_customers_surveyed", "category": "quality", "weight": 1.0,
             "scoring_rubric": "Satisfied / Total Surveyed * 100", "max_marks": 100},
            {"name": "Cost Per Lead (CPL)", "unit": "INR", "target_value": 30, "calculation_type": "percentage", "mis_field_key": "total_marketing_spend", "mis_field_key_2": "leads_generated", "category": "financial", "weight": 1.0,
             "scoring_rubric": "Auto: Spend/Leads. <30=100%, <50=80%, <80=50%, >80=30%. No advertising=50%", "max_marks": 100},
            {"name": "GEM Participation Ratio", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "gem_tenders_participated", "mis_field_key_2": "gem_tenders_floated", "category": "operational", "weight": 1.0,
             "scoring_rubric": "Participated / Floated * 100", "max_marks": 100},
            {"name": "Enquiry Generation Rate", "unit": "%", "target_value": 70, "calculation_type": "percentage", "mis_field_key": "actual_enquiries", "mis_field_key_2": "total_leads", "category": "operational", "weight": 1.0,
             "scoring_rubric": "Enq/Lead%. <10%=0%, <30%=50%, <50%=70%, <70%=90%, >70%=100%", "max_marks": 100},
            {"name": "DMS Compliance", "unit": "count", "target_value": 50, "calculation_type": "inverse_sum", "mis_field_key": "dms_overdue_calls", "category": "compliance", "weight": 1.0,
             "scoring_rubric": "Auto: Lower overdue=better. >200=0%, >150=25%, >100=50%, >50=75%, <50=100%", "max_marks": 100},
            {"name": "Website & FB Ad CTR", "unit": "%", "target_value": 5, "calculation_type": "percentage", "mis_field_key": "website_total_clicks", "mis_field_key_2": "website_total_impressions", "category": "operational", "weight": 1.0,
             "scoring_rubric": "CTR = Clicks/Impressions * 100", "max_marks": 100},
        ],
    }
    
    # ============================================================
    # PURCHASE DEPARTMENT
    # ============================================================
    EMPLOYEE_MIS["EMPD12C8C64"] = {
        "name": "Rajiv Ranjan",
        "role": "Purchase Manager",
        "frequency": "daily",
        "fields": [
            {"key": "number_of_shortages", "label": "Number of Material Shortages", "type": "number"},
            {"key": "total_materials_ordered", "label": "Total Materials Ordered in PO", "type": "number"},
            {"key": "excess_stock", "label": "Excess Stock Quantity", "type": "number"},
            {"key": "total_stock", "label": "Total Stock Available", "type": "number"},
            {"key": "po_count", "label": "Number of POs Raised Today", "type": "number"},
            {"key": "correct_po_count", "label": "Correct POs (No Errors)", "type": "number"},
            {"key": "on_time_deliveries", "label": "On-Time Deliveries Received", "type": "number"},
            {"key": "total_deliveries", "label": "Total Deliveries as per PO", "type": "number"},
            {"key": "defective_items_received", "label": "Defective Items Received", "type": "number"},
            {"key": "total_items_received", "label": "Total Items Received", "type": "number"},
            {"key": "order_cycle_time_days", "label": "Avg Order Cycle Time (Days)", "type": "number"},
            {"key": "cost_saving_amount", "label": "Cost Saving Amount (INR)", "type": "number"},
            {"key": "shortage_item_details", "label": "Shortage Item Details", "type": "text"},
            {"key": "defect_item_details", "label": "Defect Item Details", "type": "text"},
        ],
        "kpis": [
            {"name": "Inventory Turnover (Days)", "unit": "days", "target_value": 37, "calculation_type": "manual", "category": "operational", "weight": 1.0,
             "scoring_rubric": "30-37 days=10, 37-45=5, 45-60=3, >60=0", "max_marks": 10},
            {"name": "Material Shortages %", "unit": "%", "target_value": 0, "calculation_type": "percentage", "mis_field_key": "number_of_shortages", "mis_field_key_2": "total_materials_ordered", "category": "operational", "weight": 1.0,
             "scoring_rubric": "0%=10, 1-2%=8, 2-4%=6, 4-6%=4, 6-10%=2, >10%=0", "max_marks": 10},
            {"name": "Excess Inventory %", "unit": "%", "target_value": 2, "calculation_type": "percentage", "mis_field_key": "excess_stock", "mis_field_key_2": "total_stock", "category": "financial", "weight": 1.0,
             "scoring_rubric": "<2%=10, 2-10%=8, 10-25%=6, 26-30%=0", "max_marks": 10},
            {"name": "Order Cycle Time", "unit": "days", "target_value": 26, "calculation_type": "average", "mis_field_key": "order_cycle_time_days", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": "Within lead time=10, 1-2 days delay=5, 3-4 days=2, >4 days=0", "max_marks": 10},
            {"name": "PO Accuracy Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "correct_po_count", "mis_field_key_2": "po_count", "category": "quality", "weight": 1.0,
             "scoring_rubric": "100%=10, 90-99%=8, 80-89%=6, 70-79%=4, 60-69%=2, <60%=0", "max_marks": 10},
            {"name": "On-Time Delivery Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "on_time_deliveries", "mis_field_key_2": "total_deliveries", "category": "operational", "weight": 1.0,
             "scoring_rubric": "100%=10, >=85%=8, 75-85%=6, 60-75%=4, 50-60%=2, <50%=0", "max_marks": 10},
            {"name": "Supplier Defect Rate", "unit": "%", "target_value": 0, "calculation_type": "percentage", "mis_field_key": "defective_items_received", "mis_field_key_2": "total_items_received", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, 1-2%=8, 3-5%=6, 6-8%=4, >8%=0", "max_marks": 10},
            {"name": "Cost Saving", "unit": "INR", "target_value": 50000, "calculation_type": "sum", "mis_field_key": "cost_saving_amount", "category": "financial", "weight": 1.0,
             "scoring_rubric": "Auto: sum of daily savings. Proportional to 0.25% of total purchase/year", "max_marks": 10},
        ],
    }
    
    EMPLOYEE_MIS["EMP2CD56E12"] = {
        "name": "Rahul Balbhadra",
        "role": "Purchase Executive",
        "frequency": "daily",
        "fields": [
            {"key": "number_of_shortages", "label": "Number of Material Shortages", "type": "number"},
            {"key": "total_materials_ordered", "label": "Total Materials Ordered in PO", "type": "number"},
            {"key": "excess_stock", "label": "Excess Stock Quantity", "type": "number"},
            {"key": "total_stock", "label": "Total Stock Available", "type": "number"},
            {"key": "min_stock_level", "label": "Minimum Stock Level", "type": "number"},
            {"key": "po_count", "label": "Number of POs Raised Today", "type": "number"},
            {"key": "correct_po_count", "label": "Correct POs (No Errors)", "type": "number"},
            {"key": "on_time_deliveries", "label": "On-Time Deliveries Received", "type": "number"},
            {"key": "total_deliveries", "label": "Total Deliveries as per PO", "type": "number"},
            {"key": "defective_items_received", "label": "Defective Items Received", "type": "number"},
            {"key": "total_items_received", "label": "Total Items Received", "type": "number"},
            {"key": "order_cycle_time_days", "label": "Avg Order Cycle Time (Days)", "type": "number"},
            {"key": "cost_saving_amount", "label": "Cost Saving Amount (INR)", "type": "number"},
            {"key": "previous_purchase_rate", "label": "Previous Purchase Rate", "type": "number"},
            {"key": "current_purchase_rate", "label": "Current Purchase Rate", "type": "number"},
            {"key": "shortage_item_details", "label": "Shortage Item Details", "type": "text"},
            {"key": "defect_item_details", "label": "Defect Item Details", "type": "text"},
        ],
        "kpis": [
            {"name": "Inventory Turnover (Days)", "unit": "days", "target_value": 37, "calculation_type": "manual", "category": "operational", "weight": 1.0,
             "scoring_rubric": "30-37 days=10, 37-45=5, 45-60=3, >60=0", "max_marks": 10},
            {"name": "Material Shortages %", "unit": "%", "target_value": 0, "calculation_type": "percentage", "mis_field_key": "number_of_shortages", "mis_field_key_2": "total_materials_ordered", "category": "operational", "weight": 1.0,
             "scoring_rubric": "0%=10, 1-2%=8, 2-4%=6, 4-6%=4, 6-10%=2, >10%=0", "max_marks": 10},
            {"name": "Excess Inventory %", "unit": "%", "target_value": 2, "calculation_type": "percentage", "mis_field_key": "excess_stock", "mis_field_key_2": "total_stock", "category": "financial", "weight": 1.0,
             "scoring_rubric": "<2%=10, 2-10%=8, 10-25%=6, 26-30%=0", "max_marks": 10},
            {"name": "Order Cycle Time", "unit": "days", "target_value": 25, "calculation_type": "average", "mis_field_key": "order_cycle_time_days", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": "Within lead time=10, 1-2 days delay=5, 3-4 days=2, >4 days=0", "max_marks": 10},
            {"name": "PO Accuracy Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "correct_po_count", "mis_field_key_2": "po_count", "category": "quality", "weight": 1.0,
             "scoring_rubric": "100%=10, 90-99%=8, 80-89%=6, 70-79%=4, 60-69%=2, <60%=0", "max_marks": 10},
            {"name": "On-Time Delivery Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "on_time_deliveries", "mis_field_key_2": "total_deliveries", "category": "operational", "weight": 1.0,
             "scoring_rubric": "100%=10, >=85%=8, 75-85%=6, 60-75%=4, 50-60%=2, <50%=0", "max_marks": 10},
            {"name": "Supplier Defect Rate", "unit": "%", "target_value": 0, "calculation_type": "percentage", "mis_field_key": "defective_items_received", "mis_field_key_2": "total_items_received", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, 1-2%=8, 3-5%=6, 6-8%=4, >8%=0", "max_marks": 10},
            {"name": "Cost Saving", "unit": "INR", "target_value": 50000, "calculation_type": "sum", "mis_field_key": "cost_saving_amount", "category": "financial", "weight": 1.0,
             "scoring_rubric": "Auto: sum of daily savings. Proportional to 0.25% of total purchase/year", "max_marks": 10},
        ],
    }
    
    # ============================================================
    # PRODUCTION DEPARTMENT
    # ============================================================
    EMPLOYEE_MIS["EMPD72BBD26"] = {
        "name": "Nitesh Bhashker",
        "role": "Production Manager",
        "frequency": "daily",
        "fields": [
            {"key": "production_points", "label": "Production Points (Target 300/month = ~12/day)", "type": "number"},
            {"key": "production_efficiency_pct", "label": "Production Efficiency %", "type": "number"},
            {"key": "oee_pct", "label": "Overall Equipment Effectiveness (OEE) %", "type": "number"},
            {"key": "labor_productivity", "label": "Labor Productivity (Units/Manpower)", "type": "number"},
            {"key": "order_fulfillment_rate_pct", "label": "Order Fulfillment Rate %", "type": "number"},
            {"key": "cycle_time_points_hr", "label": "Cycle Time (Points/Hr)", "type": "number"},
            {"key": "overtime_hrs", "label": "Overtime Hours", "type": "number"},
            {"key": "downtime_pct", "label": "Unplanned Downtime % of Available Time", "type": "number"},
            {"key": "defect_rate_pct", "label": "Defect Rate %", "type": "number"},
            {"key": "scrap_rate_pct", "label": "Scrap Rate %", "type": "number"},
            {"key": "first_pass_yield_pct", "label": "First Pass Yield (FPY) %", "type": "number"},
            {"key": "copq_cost", "label": "Cost of Poor Quality (INR)", "type": "number"},
            {"key": "kaizen_count", "label": "Kaizen / Training Activities", "type": "number"},
            {"key": "safety_5s_score", "label": "Safety/5S Compliance Score (0-1)", "type": "number"},
            {"key": "nva_time_mins", "label": "Non-Value-Added (NVA) Time (mins)", "type": "number"},
            {"key": "machine_breakdowns", "label": "Machine Breakdowns Today", "type": "number"},
        ],
        "kpis": [
            {"name": "Production Points vs Target", "unit": "%", "target_value": 300, "calculation_type": "sum", "mis_field_key": "production_points", "category": "operational", "weight": 1.0,
             "scoring_rubric": "Target 300/month. 300+=10, 270-299=8, 240-269=6, 200-239=4, <200=2", "max_marks": 10},
            {"name": "Production Efficiency", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "production_efficiency_pct", "category": "operational", "weight": 1.0,
             "scoring_rubric": "Actual/Planned * 100. >=95%=10, 85-94%=8, 75-84%=6, <75%=4", "max_marks": 10},
            {"name": "OEE %", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "oee_pct", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": ">=90%=10, 80-89%=7, 70-79%=5, <70%=3", "max_marks": 10},
            {"name": "Labor Productivity", "unit": "ratio", "target_value": 0.3, "calculation_type": "average", "mis_field_key": "labor_productivity", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": "Units/Manpower. >=0.3=10, 0.25-0.29=7, 0.20-0.24=5, <0.20=3", "max_marks": 10},
            {"name": "Schedule Adherence", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "order_fulfillment_rate_pct", "category": "operational", "weight": 1.0,
             "scoring_rubric": ">=95%=10, 85-94%=7, 75-84%=5, <75%=3", "max_marks": 10},
            {"name": "Cycle Time", "unit": "pts/hr", "target_value": 1.5, "calculation_type": "average", "mis_field_key": "cycle_time_points_hr", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": ">=1.5=10, 1.2-1.49=7, 1.0-1.19=5, <1.0=3", "max_marks": 10},
            {"name": "Downtime Ratio", "unit": "%", "target_value": 0, "calculation_type": "average", "mis_field_key": "downtime_pct", "category": "operational", "weight": 1.0,
             "scoring_rubric": "0-5%=10, 5-10%=7, 10-15%=5, 15-20%=3, >20%=0", "max_marks": 10},
            {"name": "Defect Rate", "unit": "%", "target_value": 0, "calculation_type": "average", "mis_field_key": "defect_rate_pct", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, <0.5%=8, 0.5-1%=5, 1-2%=3, >2%=0", "max_marks": 10},
            {"name": "Scrap Rate", "unit": "%", "target_value": 0, "calculation_type": "average", "mis_field_key": "scrap_rate_pct", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, <0.5%=7, 0.5-1%=5, >1%=2", "max_marks": 10},
            {"name": "First Pass Yield (FPY)", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "first_pass_yield_pct", "category": "quality", "weight": 0.5,
             "scoring_rubric": ">=99.5%=5, 99-99.4%=4, 98-98.9%=3, <98%=1", "max_marks": 5},
            {"name": "COPQ", "unit": "INR", "target_value": 0, "calculation_type": "sum", "mis_field_key": "copq_cost", "category": "financial", "weight": 0.5,
             "scoring_rubric": "0=5, <500=4, 500-1000=3, 1000-2000=2, >2000=0", "max_marks": 5},
            {"name": "Kaizen & Training", "unit": "count", "target_value": 3, "calculation_type": "sum", "mis_field_key": "kaizen_count", "category": "operational", "weight": 0.5,
             "scoring_rubric": "3+/quarter=5, 2=3, 1=2, 0=0", "max_marks": 5},
            {"name": "NVA Time %", "unit": "mins", "target_value": 156, "calculation_type": "sum", "mis_field_key": "nva_time_mins", "category": "efficiency", "weight": 0.5,
             "scoring_rubric": "<5%=5, 5-10%=4, 10-15%=3, >15%=1", "max_marks": 5},
            {"name": "Machine Breakdown Frequency", "unit": "count", "target_value": 0, "calculation_type": "sum", "mis_field_key": "machine_breakdowns", "category": "operational", "weight": 1.0,
             "scoring_rubric": "Predictive maintenance indicator. 0/month=10, 1-2=7, 3-5=4, >5=0", "max_marks": 10},
        ],
    }
    
    # ============================================================
    # QUALITY DEPARTMENT
    # ============================================================
    EMPLOYEE_MIS["EMP09B94222"] = {
        "name": "Saurav Kumar",
        "role": "Quality Manager/Engineer",
        "frequency": "daily",
        "fields": [
            {"key": "production_points", "label": "Production Points (Target 300/month)", "type": "number"},
            {"key": "production_efficiency_pct", "label": "Production Efficiency %", "type": "number"},
            {"key": "manpower_capacity_pct", "label": "Manpower Capacity vs Actual %", "type": "number"},
            {"key": "schedule_adherence_pct", "label": "Production Schedule Adherence %", "type": "number"},
            {"key": "cycle_time_pct", "label": "Cycle Time %", "type": "number"},
            {"key": "overtime_hrs", "label": "Overtime Hours", "type": "number"},
            {"key": "production_loss", "label": "Production Loss (0=No, 1=Yes)", "type": "number"},
            {"key": "defect_rate_pct", "label": "Defect Rate %", "type": "number"},
            {"key": "first_pass_yield_pct", "label": "First Pass Yield (FPY) %", "type": "number"},
            {"key": "copq_cost", "label": "Cost of Poor Quality (INR)", "type": "number"},
            {"key": "customer_complaint_rate", "label": "Customer Complaint Rate %", "type": "number"},
            {"key": "incoming_acceptance_pct", "label": "Incoming Material Acceptance Rate %", "type": "number"},
            {"key": "mpes_score", "label": "MPES Score (e.g. B-67)", "type": "text"},
            {"key": "kaizen_count", "label": "Kaizen / Training Activities", "type": "number"},
            {"key": "safety_5s_score", "label": "Safety/5S Score (0-1)", "type": "number"},
            {"key": "corrective_actions_found", "label": "Corrective Actions Raised", "type": "number"},
            {"key": "corrective_actions_closed", "label": "Corrective Actions Closed", "type": "number"},
        ],
        "kpis": [
            {"name": "Production Points vs Target", "unit": "%", "target_value": 300, "calculation_type": "sum", "mis_field_key": "production_points", "category": "operational", "weight": 1.0,
             "scoring_rubric": ">=300=10, 270-299=8, 240-269=6, 200-239=4, <200=2", "max_marks": 10},
            {"name": "Production Efficiency", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "production_efficiency_pct", "category": "operational", "weight": 1.0, "max_marks": 10},
            {"name": "Manpower Utilization", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "manpower_capacity_pct", "category": "efficiency", "weight": 1.0,
             "scoring_rubric": ">=80%=10, 60-79%=7, 40-59%=5, <40%=3", "max_marks": 10},
            {"name": "Schedule Adherence", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "schedule_adherence_pct", "category": "operational", "weight": 1.0, "max_marks": 10},
            {"name": "Cycle Time Performance", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "cycle_time_pct", "category": "efficiency", "weight": 1.0, "max_marks": 10},
            {"name": "Defect Rate", "unit": "%", "target_value": 0, "calculation_type": "average", "mis_field_key": "defect_rate_pct", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, <1%=8, 1-2%=6, 2-3%=4, >3%=0", "max_marks": 10},
            {"name": "First Pass Yield (FPY)", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "first_pass_yield_pct", "category": "quality", "weight": 1.0,
             "scoring_rubric": ">=99.5%=10, 99-99.4%=8, 98-98.9%=7, <98%=5", "max_marks": 10},
            {"name": "COPQ", "unit": "INR", "target_value": 0, "calculation_type": "sum", "mis_field_key": "copq_cost", "category": "financial", "weight": 1.0,
             "scoring_rubric": "0=10, <200=7, 200-500=5, >500=2", "max_marks": 10},
            {"name": "Kaizen & Training", "unit": "count", "target_value": 3, "calculation_type": "sum", "mis_field_key": "kaizen_count", "category": "operational", "weight": 0.5, "max_marks": 5},
            {"name": "Safety & 5S", "unit": "count", "target_value": 3, "calculation_type": "sum", "mis_field_key": "safety_5s_score", "category": "compliance", "weight": 0.5, "max_marks": 5},
            {"name": "Customer Complaint Rate", "unit": "%", "target_value": 0, "calculation_type": "average", "mis_field_key": "customer_complaint_rate", "category": "quality", "weight": 1.0,
             "scoring_rubric": "0%=10, <0.5%=7, 0.5-1%=5, >1%=0", "max_marks": 10},
            {"name": "Incoming Material Acceptance", "unit": "%", "target_value": 100, "calculation_type": "average", "mis_field_key": "incoming_acceptance_pct", "category": "quality", "weight": 1.0,
             "scoring_rubric": "100%=10, 95-99%=8, 90-94%=6, <90%=3", "max_marks": 10},
            {"name": "MPES Score", "unit": "score", "target_value": 70, "calculation_type": "manual", "category": "quality", "weight": 1.0,
             "scoring_rubric": "B-70+=10, B-67=6.7, B-65=5, <B-60=3", "max_marks": 10},
            {"name": "Corrective Action Closure Rate", "unit": "%", "target_value": 100, "calculation_type": "percentage", "mis_field_key": "corrective_actions_closed", "mis_field_key_2": "corrective_actions_found", "category": "quality", "weight": 1.0,
             "scoring_rubric": "Auto: Closed/Raised * 100. Quality issues found but not fixed = systemic risk. 100%=10, 80-99%=7, <80%=4", "max_marks": 10},
        ],
    }
    
    # ============================================================
    # EXECUTIVE MONTHLY MIS TEMPLATES
    # ============================================================
    EMPLOYEE_MIS["EMPC6B9A606"] = {
        "name": "Nandini Kumari",
        "role": "HR Head",
        "frequency": "monthly",
        "fields": [
            {"key": "total_headcount", "label": "Total Headcount (Company Role)", "type": "number"},
            {"key": "vendor_headcount", "label": "Total Headcount (Vendor)", "type": "number"},
            {"key": "hr_cost_company", "label": "HR Cost - Company Role (INR Lakhs)", "type": "number"},
            {"key": "hr_cost_vendor", "label": "HR Cost - Vendor (INR Lakhs)", "type": "number"},
            {"key": "new_hires", "label": "New Hires This Month", "type": "number"},
            {"key": "exits_attrition", "label": "Exits/Attrition This Month", "type": "number"},
            {"key": "open_positions", "label": "Open Positions Unfilled", "type": "number"},
            {"key": "avg_days_to_fill", "label": "Avg Days to Fill Closed Positions", "type": "number"},
            {"key": "engagement_survey_done", "label": "Engagement Survey Conducted", "type": "boolean"},
            {"key": "engagement_score", "label": "Engagement Score (if conducted)", "type": "number"},
            {"key": "training_sessions", "label": "Training Sessions Conducted", "type": "number"},
            {"key": "employees_trained", "label": "Employees Trained This Month", "type": "number"},
            {"key": "disciplinary_actions", "label": "Disciplinary Actions Taken", "type": "number"},
            {"key": "grievances_received", "label": "Grievances Received", "type": "number"},
            {"key": "grievances_resolved", "label": "Grievances Resolved", "type": "number"},
            {"key": "kpi_evaluations_done_pct", "label": "KPI Evaluations Completed (% of total)", "type": "number"},
            {"key": "key_decisions", "label": "Key HR Decisions This Month", "type": "text"},
        ],
        "kpis": [],
    }
    
    EMPLOYEE_MIS["EMP8B9486DD"] = {
        "name": "Anup Kr Mishra",
        "role": "Accounts Head",
        "frequency": "monthly",
        "fields": [
            {"key": "actual_expense", "label": "Actual Expense This Month (INR)", "type": "number"},
            {"key": "budgeted_expense", "label": "Budgeted Expense This Month (INR)", "type": "number"},
            {"key": "budget_variance_pct", "label": "Budget Variance %", "type": "number"},
            {"key": "all_returns_filed_on_time", "label": "All Returns Filed On Time", "type": "boolean"},
            {"key": "all_taxes_paid_by_due", "label": "All Taxes Paid by Due Date", "type": "boolean"},
            {"key": "penalties_incurred", "label": "Penalties/Interest Incurred (INR)", "type": "number"},
            {"key": "gst_reconciliation_done", "label": "GST Reconciliation Completed", "type": "boolean"},
            {"key": "tds_tcs_reconciliation_done", "label": "TDS/TCS Reconciliation Completed", "type": "boolean"},
            {"key": "regulatory_notices_count", "label": "Regulatory Notices Received", "type": "number"},
            {"key": "avg_notice_response_days", "label": "Avg Response Time to Notices (Days)", "type": "number"},
            {"key": "cash_flow_position", "label": "Cash Flow Position (INR)", "type": "number"},
            {"key": "outstanding_receivables", "label": "Outstanding Receivables (INR)", "type": "number"},
            {"key": "outstanding_payables", "label": "Outstanding Payables (INR)", "type": "number"},
            {"key": "key_observations", "label": "Key Observations / Escalations", "type": "text"},
        ],
        "kpis": [],
    }
    
    EMPLOYEE_MIS["EMP8B117F26"] = {
        "name": "Manoj Kumar",
        "role": "Sales Head / GM Sales",
        "frequency": "monthly",
        "fields": [
            {"key": "monthly_revenue", "label": "Monthly Revenue Achieved (INR Cr)", "type": "number"},
            {"key": "revenue_target", "label": "Revenue Target for Month (INR Cr)", "type": "number"},
            {"key": "cost_of_sales", "label": "Cost of Sales (INR)", "type": "number"},
            {"key": "new_dealers_added", "label": "New Dealers/Customers Added", "type": "number"},
            {"key": "total_active_dealers", "label": "Total Active Dealer Network", "type": "number"},
            {"key": "market_share_pct", "label": "Market Share % (if available)", "type": "number"},
            {"key": "collection_vs_billing_pct", "label": "Collection vs Billing Ratio %", "type": "number"},
            {"key": "overdue_amount", "label": "Total Overdue Amount (INR)", "type": "number"},
            {"key": "top_lost_deals", "label": "Top 3 Lost Deals & Reasons", "type": "text"},
            {"key": "key_decisions", "label": "Key Sales Decisions This Month", "type": "text"},
        ],
        "kpis": [],
    }
    
    EMPLOYEE_MIS["EMP484529A4"] = {
        "name": "Umesh Chandra Prasad",
        "role": "Audit Head",
        "frequency": "monthly",
        "fields": [
            {"key": "cost_reduction_amount", "label": "Cost Reduction Achieved (INR)", "type": "number"},
            {"key": "cost_reduction_pct", "label": "Cost Reduction % vs Target", "type": "number"},
            {"key": "inventory_turnover_days", "label": "Current Inventory Turnover (Days)", "type": "number"},
            {"key": "departments_audited", "label": "Departments Audited This Month", "type": "number"},
            {"key": "ncs_found", "label": "Non-Conformances Found", "type": "number"},
            {"key": "ncs_closed", "label": "Non-Conformances Closed", "type": "number"},
            {"key": "nc_closure_rate_pct", "label": "NC Closure Rate %", "type": "number"},
            {"key": "internal_assessment_score", "label": "Internal Assessment Score % (if quarter-end)", "type": "number"},
            {"key": "action_plans_overdue", "label": "Action Plans Overdue (Count)", "type": "number"},
            {"key": "critical_findings", "label": "Critical Findings Requiring Escalation", "type": "text"},
            {"key": "key_decisions", "label": "Key Audit Decisions This Month", "type": "text"},
        ],
        "kpis": [],
    }
    
    EMPLOYEE_MIS["EMP5618F5FF"] = {
        "name": "KN Sinha",
        "role": "Production Head / GM Production",
        "frequency": "monthly",
        "fields": [
            {"key": "total_production_points", "label": "Total Production Points Achieved", "type": "number"},
            {"key": "production_target", "label": "Production Target (Points)", "type": "number"},
            {"key": "avg_production_cost", "label": "Avg Production Cost per Unit (INR)", "type": "number"},
            {"key": "total_production_cost", "label": "Total Production Cost (INR)", "type": "number"},
            {"key": "internal_audit_score", "label": "Internal Audit Score % (if available)", "type": "number"},
            {"key": "sops_completed", "label": "SOPs Completed", "type": "number"},
            {"key": "sops_in_progress", "label": "SOPs In-Progress", "type": "number"},
            {"key": "mom_meetings_held", "label": "MoMs Conducted with Nitesh/Saurav/Awdhesh", "type": "number"},
            {"key": "safety_incidents", "label": "Safety Incidents This Month", "type": "number"},
            {"key": "key_decisions", "label": "Key Production Decisions", "type": "text"},
            {"key": "production_bottlenecks", "label": "Production Bottlenecks / Escalations", "type": "text"},
        ],
        "kpis": [],
    }
    

    SENIOR_EXEC_KRAS = {
        "EMPC6B9A606": {
            "name": "Nandini Kumari",
            "kras": [
                {"name": "HR Cost vs Revenue", "description": "Track HR cost (company role + vendor) vs company revenue monthly. Company role: ~16-17L/month, Vendor: ~8-9L/month", "weight": 2.0},
                {"name": "Employee Retention Rate (%)", "description": "Formula: No. of employees retained / No. at start of year * 100. Target: >95%. Monthly tracking.", "weight": 1.5},
                {"name": "Average Time to Fill (Recruitment)", "description": "Formula: Total days to hire / No. of hires. Lower is better. Track monthly.", "weight": 1.2},
                {"name": "Employee Engagement Score", "description": "Formula: Average Engagement Survey Score / Total Responses * 100. Conduct periodic surveys.", "weight": 1.0},
                {"name": "Training & Development Participation Rate", "description": "Formula: Employees participating in training / Total Employees * 100. Track monthly.", "weight": 1.0},
                {"name": "Performance Evaluation Coverage", "description": "Formula: Employees hitting KPI targets / Total employees * 100. Ensure all employees have KPIs and are evaluated.", "weight": 1.5},
            ]
        },
        "EMP8B9486DD": {
            "name": "Anup Kr Mishra",
            "kras": [
                {"name": "Budget Variance %", "description": "Formula: (Actual - Budgeted) / Budgeted * 100. Target: Control under budget. Excludes salary, repair & maintenance.", "weight": 2.0},
                {"name": "Compliance Score - On-time Filing of Returns", "description": "Sub-weight: 0.30. Measure: % of returns filed on time. Target: 100%.", "weight": 1.5},
                {"name": "Compliance Score - Timely Tax Payments", "description": "Sub-weight: 0.25. Measure: % of taxes paid on or before due date (by 7th of next month). Target: 100%.", "weight": 1.2},
                {"name": "Compliance Score - No Penalties/Interest", "description": "Sub-weight: 0.20. Measure: Deduct points for each penalty incurred. Target: Zero penalties.", "weight": 1.0},
                {"name": "Compliance Score - GST/TDS/TCS Reconciliation Accuracy", "description": "Sub-weight: 0.15. Measure: Based on reconciliation reports. Target: Completed by 30th monthly.", "weight": 0.8},
                {"name": "Compliance Score - Regulatory Communication Responsiveness", "description": "Sub-weight: 0.10. Measure: Average response time to regulatory notices. Target: Quick response.", "weight": 0.5},
                {"name": "Cost Control", "description": "Monitor expense amounts and percentages monthly. Target: Keep expenses under control despite turnover fluctuations.", "weight": 1.5},
            ]
        },
        "EMP8B117F26": {
            "name": "Manoj Kumar",
            "kras": [
                {"name": "Revenue Target", "description": "Annual target: 111 Cr. Track monthly revenue.", "weight": 2.5},
                {"name": "Cost of Sales", "description": "Track quarterly. Aim for reducing cost of sales over time.", "weight": 1.5},
                {"name": "Market Share", "description": "Target: 25%. Track quarterly. Increase through dealer network and territory expansion.", "weight": 2.0},
                {"name": "Cross-Department Oversight - Production", "description": "Monitor Production dept KPIs: Production Efficiency, Cost of Production, Internal Audit Score.", "weight": 1.0},
                {"name": "Cross-Department Oversight - Finance & HR", "description": "Monitor Accounts KPIs (Budget Variance, Compliance, Cost Control) and HR KPIs (Retention, Recruitment, Training).", "weight": 1.0},
            ]
        },
        "EMP484529A4": {
            "name": "Umesh Chandra Prasad",
            "kras": [
                {"name": "Cost Reduction", "description": "Target: 0.25% annual reduction on total purchases. Track monthly savings.", "weight": 2.0},
                {"name": "Inventory Turnover (Days)", "description": "Target: 37 days. Track monthly. Lower is better.", "weight": 2.0},
                {"name": "Internal Assessment Score", "description": "Target: 80%. Conduct quarterly assessments across all departments.", "weight": 2.5},
                {"name": "Internal Assessment - Department Sub-Scores", "description": "Track per-department audit scores quarterly.", "weight": 1.5},
                {"name": "Audit Action Plan Closure", "description": "Track closure of non-conformances from internal assessments.", "weight": 1.5},
                {"name": "Cross-Department Monitoring", "description": "Monitor ALL department KPIs: Sales, Production, Finance, HR.", "weight": 1.0},
            ]
        },
        "EMP5618F5FF": {
            "name": "KN Sinha",
            "kras": [
                {"name": "Production Efficiency (Points)", "description": "Target: 300 points/month.", "weight": 2.5},
                {"name": "Cost of Production", "description": "Track monthly production cost. Aim for continuous reduction.", "weight": 2.0},
                {"name": "Internal Audit Score", "description": "Target: 85%. Based on audit conducted by Umesh sir's team.", "weight": 1.5},
                {"name": "SOP Implementation", "description": "Track SOP milestones.", "weight": 1.0},
                {"name": "Team Oversight - Nitesh, Saurav, Awdhesh", "description": "Conduct regular MoMs with direct reports: Nitesh (Production), Saurav (Quality), Awdhesh (Store).", "weight": 1.5},
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

        freq = data.get("frequency", "daily")
        freq_label = {"daily": "Daily", "monthly": "Monthly", "quarterly": "Quarterly"}.get(freq, "Daily")
        template = {
            "template_id": f"mist_{uuid.uuid4().hex[:12]}",
            "employee_id": emp_id,
            "employee_name": data["name"],
            "department_id": dept_id,
            "department_name": dept_name,
            "name": f"{data['name']} - {freq_label} MIS",
            "frequency": freq,
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
                "scoring_rubric": kpi_data.get("scoring_rubric", ""),
                "max_marks": kpi_data.get("max_marks", 100),
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
