"""Org Chart API - Returns hierarchical employee structure for org chart visualization"""
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/org-chart", tags=["Org Chart"])

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


@router.get("")
async def get_org_chart(request: Request):
    """Get the full org chart hierarchy"""
    user = await get_current_user(request)

    employees = await db.employees.find(
        {"is_active": True},
        {"_id": 0, "employee_id": 1, "emp_code": 1, "first_name": 1, "last_name": 1,
         "department": 1, "department_name": 1, "department_id": 1,
         "designation": 1, "designation_name": 1,
         "reporting_manager_id": 1, "picture": 1, "email": 1, "phone": 1}
    ).to_list(500)

    departments = await db.departments.find({}, {"_id": 0}).to_list(100)
    dept_map = {}
    for d in departments:
        dept_map[d.get("department_id")] = d.get("name", d.get("department_name", ""))

    emp_map = {}
    for e in employees:
        eid = e.get("employee_id")
        dept_name = e.get("department_name") or e.get("department") or dept_map.get(e.get("department_id"), "")
        emp_map[eid] = {
            "id": eid,
            "name": f"{e.get('first_name', '')} {e.get('last_name', '')}".strip(),
            "designation": e.get("designation_name") or e.get("designation") or "",
            "department": dept_name,
            "picture": e.get("picture"),
            "email": e.get("email"),
            "phone": e.get("phone"),
            "manager_id": e.get("reporting_manager_id"),
            "children": [],
        }

    roots = []
    for eid, node in emp_map.items():
        mid = node["manager_id"]
        if mid and mid in emp_map and mid != eid:
            emp_map[mid]["children"].append(node)
        else:
            roots.append(node)

    return {"roots": roots, "total_employees": len(employees)}
