"""Stationery Inventory Management API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/stationery", tags=["Stationery"])

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]

CATEGORIES = [
    "Pens", "Pencils", "Notebooks", "Paper/Reams", "Folders",
    "Staplers/Pins", "Sticky Notes", "Tape", "Scissors", "Markers",
    "Envelopes", "Whiteboard Items", "Registers", "Ink/Toner", "Other"
]

UNITS = ["pieces", "packs", "reams", "boxes", "rolls", "bottles", "sets"]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


def is_admin(role):
    return role in ["super_admin", "hr_admin", "hr_executive", "it_admin"]


# ==================== ITEMS CRUD ====================

@router.get("/categories")
async def get_categories(request: Request):
    await get_current_user(request)
    return {"categories": CATEGORIES, "units": UNITS}


@router.get("/items")
async def list_items(request: Request, category: Optional[str] = None, search: Optional[str] = None):
    await get_current_user(request)
    query = {"is_active": True}
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
        ]
    items = await db.stationery_items.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    # Compute totals
    total_items = len(items)
    total_value = sum((i.get("current_stock", 0) * i.get("purchase_price", 0)) for i in items)
    low_stock = sum(1 for i in items if i.get("current_stock", 0) <= i.get("min_stock_level", 0))
    return {
        "items": items,
        "total_items": total_items,
        "total_value": round(total_value, 2),
        "low_stock_count": low_stock
    }


@router.post("/items")
async def create_item(request: Request):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name is required")

    item = {
        "item_id": f"STN-{uuid.uuid4().hex[:8].upper()}",
        "name": name,
        "category": body.get("category", "Other"),
        "unit": body.get("unit", "pieces"),
        "purchase_price": float(body.get("purchase_price", 0)),
        "current_stock": int(body.get("opening_stock", 0)),
        "min_stock_level": int(body.get("min_stock_level", 5)),
        "is_active": True,
        "created_by": user.get("employee_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stationery_items.insert_one(item)
    item.pop("_id", None)

    # If opening stock > 0, create a purchase transaction
    if item["current_stock"] > 0:
        txn = {
            "txn_id": f"STXN-{uuid.uuid4().hex[:8].upper()}",
            "item_id": item["item_id"],
            "item_name": item["name"],
            "type": "purchase",
            "qty": item["current_stock"],
            "price_per_unit": item["purchase_price"],
            "total_cost": round(item["current_stock"] * item["purchase_price"], 2),
            "vendor": body.get("vendor", ""),
            "notes": "Opening stock",
            "date": datetime.now(timezone.utc).date().isoformat(),
            "created_by": user.get("employee_id", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.stationery_transactions.insert_one(txn)

    return item


@router.put("/items/{item_id}")
async def update_item(request: Request, item_id: str):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    updates = {}
    for field in ["name", "category", "unit", "purchase_price", "min_stock_level"]:
        if field in body:
            updates[field] = body[field]
    if "purchase_price" in updates:
        updates["purchase_price"] = float(updates["purchase_price"])
    if "min_stock_level" in updates:
        updates["min_stock_level"] = int(updates["min_stock_level"])
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.stationery_items.update_one({"item_id": item_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item updated"}


@router.delete("/items/{item_id}")
async def delete_item(request: Request, item_id: str):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.stationery_items.update_one({"item_id": item_id}, {"$set": {"is_active": False}})
    return {"message": "Item deleted"}


# ==================== STOCK IN (PURCHASE) ====================

@router.post("/purchase")
async def purchase_stock(request: Request):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    item_id = body.get("item_id")
    qty = int(body.get("qty", 0))
    if not item_id or qty <= 0:
        raise HTTPException(status_code=400, detail="item_id and qty > 0 required")

    item = await db.stationery_items.find_one({"item_id": item_id, "is_active": True})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    price = float(body.get("price_per_unit", item.get("purchase_price", 0)))

    # Update stock
    await db.stationery_items.update_one(
        {"item_id": item_id},
        {"$inc": {"current_stock": qty}, "$set": {"purchase_price": price, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    txn = {
        "txn_id": f"STXN-{uuid.uuid4().hex[:8].upper()}",
        "item_id": item_id,
        "item_name": item.get("name", ""),
        "type": "purchase",
        "qty": qty,
        "price_per_unit": price,
        "total_cost": round(qty * price, 2),
        "vendor": body.get("vendor", ""),
        "notes": body.get("notes", ""),
        "date": body.get("date", datetime.now(timezone.utc).date().isoformat()),
        "created_by": user.get("employee_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stationery_transactions.insert_one(txn)
    return {"message": f"Added {qty} units to {item.get('name')}", "new_stock": item.get("current_stock", 0) + qty}


# ==================== ISSUE ITEMS ====================

@router.post("/issue")
async def issue_item(request: Request):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    item_id = body.get("item_id")
    qty = int(body.get("qty", 0))
    employee_id = body.get("employee_id", "")
    if not item_id or qty <= 0:
        raise HTTPException(status_code=400, detail="item_id and qty > 0 required")

    item = await db.stationery_items.find_one({"item_id": item_id, "is_active": True})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.get("current_stock", 0) < qty:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {item.get('current_stock', 0)}")

    # Get employee name
    emp_name = body.get("employee_name", "")
    department = body.get("department", "")
    if employee_id and not emp_name:
        emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0, "first_name": 1, "last_name": 1, "department_name": 1})
        if emp:
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            department = emp.get("department_name", "")

    # Deduct stock
    await db.stationery_items.update_one(
        {"item_id": item_id},
        {"$inc": {"current_stock": -qty}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    txn = {
        "txn_id": f"STXN-{uuid.uuid4().hex[:8].upper()}",
        "item_id": item_id,
        "item_name": item.get("name", ""),
        "type": "issue",
        "qty": qty,
        "employee_id": employee_id,
        "employee_name": emp_name,
        "department": department,
        "notes": body.get("notes", ""),
        "date": body.get("date", datetime.now(timezone.utc).date().isoformat()),
        "created_by": user.get("employee_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stationery_transactions.insert_one(txn)
    return {"message": f"Issued {qty} {item.get('name')} to {emp_name}", "new_stock": item.get("current_stock", 0) - qty}


# ==================== RETURN ITEMS ====================

@router.post("/return")
async def return_item(request: Request):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    item_id = body.get("item_id")
    qty = int(body.get("qty", 0))
    if not item_id or qty <= 0:
        raise HTTPException(status_code=400, detail="item_id and qty > 0 required")

    item = await db.stationery_items.find_one({"item_id": item_id, "is_active": True})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    emp_name = body.get("employee_name", "")
    employee_id = body.get("employee_id", "")

    # Add back to stock
    await db.stationery_items.update_one(
        {"item_id": item_id},
        {"$inc": {"current_stock": qty}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    txn = {
        "txn_id": f"STXN-{uuid.uuid4().hex[:8].upper()}",
        "item_id": item_id,
        "item_name": item.get("name", ""),
        "type": "return",
        "qty": qty,
        "employee_id": employee_id,
        "employee_name": emp_name,
        "notes": body.get("notes", ""),
        "date": body.get("date", datetime.now(timezone.utc).date().isoformat()),
        "created_by": user.get("employee_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stationery_transactions.insert_one(txn)
    return {"message": f"Returned {qty} {item.get('name')}", "new_stock": item.get("current_stock", 0) + qty}


# ==================== TRANSACTIONS HISTORY ====================

@router.get("/transactions")
async def list_transactions(
    request: Request,
    item_id: Optional[str] = None,
    type: Optional[str] = None,
    employee_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200
):
    await get_current_user(request)
    query = {}
    if item_id:
        query["item_id"] = item_id
    if type and type != "all":
        query["type"] = type
    if employee_id:
        query["employee_id"] = employee_id
    if from_date:
        query.setdefault("date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("date", {})["$lte"] = to_date
    txns = await db.stationery_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return txns


# ==================== STATIONERY REQUESTS ====================

@router.post("/requests")
async def create_request(request: Request):
    """Employee requests stationery items"""
    user = await get_current_user(request)
    body = await request.json()
    items = body.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="At least one item required")

    emp = await db.employees.find_one({"employee_id": user["employee_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "department_name": 1, "department_id": 1})
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() if emp else ""

    req = {
        "request_id": f"SREQ-{uuid.uuid4().hex[:8].upper()}",
        "employee_id": user["employee_id"],
        "employee_name": emp_name,
        "department": emp.get("department_name", "") if emp else "",
        "items": items,
        "notes": body.get("notes", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stationery_requests.insert_one(req)
    req.pop("_id", None)
    return req


@router.get("/requests")
async def list_requests(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    query = {}
    if is_admin(user.get("role")):
        pass  # admin sees all
    else:
        query["employee_id"] = user["employee_id"]
    if status and status != "all":
        query["status"] = status
    reqs = await db.stationery_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return reqs


@router.put("/requests/{request_id}/approve")
async def approve_request(request: Request, request_id: str):
    """Admin approves and auto-issues requested items"""
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")

    req = await db.stationery_requests.find_one({"request_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    # Check stock and issue
    issues = []
    for ri in req.get("items", []):
        item = await db.stationery_items.find_one({"item_id": ri["item_id"], "is_active": True})
        if not item:
            continue
        qty = min(int(ri.get("qty", 0)), item.get("current_stock", 0))
        if qty <= 0:
            continue
        # Deduct stock
        await db.stationery_items.update_one({"item_id": ri["item_id"]}, {"$inc": {"current_stock": -qty}})
        txn = {
            "txn_id": f"STXN-{uuid.uuid4().hex[:8].upper()}",
            "item_id": ri["item_id"],
            "item_name": ri.get("item_name", item.get("name", "")),
            "type": "issue",
            "qty": qty,
            "employee_id": req["employee_id"],
            "employee_name": req.get("employee_name", ""),
            "department": req.get("department", ""),
            "notes": f"From request {request_id}",
            "date": datetime.now(timezone.utc).date().isoformat(),
            "created_by": user.get("employee_id", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.stationery_transactions.insert_one(txn)
        issues.append({"item_name": ri.get("item_name", ""), "qty_issued": qty})

    await db.stationery_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved", "approved_by": user.get("employee_id"), "approved_at": datetime.now(timezone.utc).isoformat(), "issued_items": issues}}
    )
    return {"message": "Request approved and items issued", "issued": issues}


@router.put("/requests/{request_id}/reject")
async def reject_request(request: Request, request_id: str):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    body = await request.json()
    await db.stationery_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "rejected", "rejected_by": user.get("employee_id"), "reject_reason": body.get("reason", ""), "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Request rejected"}


# ==================== EMPLOYEE LIST (for issue dropdown) ====================

@router.get("/employees")
async def get_employees_for_issue(request: Request):
    user = await get_current_user(request)
    if not is_admin(user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized")
    emps = await db.employees.find(
        {"is_active": True},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "department_name": 1}
    ).to_list(500)
    return [{"employee_id": e["employee_id"], "name": f"{e.get('first_name', '')} {e.get('last_name', '')}".strip(), "department": e.get("department_name", "")} for e in emps]
