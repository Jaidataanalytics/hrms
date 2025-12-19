"""Expense & Reimbursement API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/expenses", tags=["Expenses"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# Seed expense categories if not exist
async def seed_expense_categories():
    existing = await db.expense_categories.find_one()
    if not existing:
        categories = [
            {"code": "travel", "name": "Travel", "limit": 50000, "requires_receipt": True},
            {"code": "food", "name": "Food & Meals", "limit": 10000, "requires_receipt": True},
            {"code": "accommodation", "name": "Accommodation", "limit": 25000, "requires_receipt": True},
            {"code": "client_entertainment", "name": "Client Entertainment", "limit": 20000, "requires_receipt": True},
            {"code": "fuel", "name": "Fuel", "limit": 15000, "requires_receipt": True},
            {"code": "office_supplies", "name": "Office Supplies", "limit": 5000, "requires_receipt": False},
            {"code": "communication", "name": "Communication", "limit": 5000, "requires_receipt": True},
            {"code": "other", "name": "Other", "limit": 10000, "requires_receipt": True}
        ]
        await db.expense_categories.insert_many(categories)


# ==================== CATEGORIES ====================

@router.get("/categories")
async def list_expense_categories(request: Request):
    """List expense categories"""
    await get_current_user(request)
    await seed_expense_categories()
    categories = await db.expense_categories.find({}, {"_id": 0}).to_list(50)
    return categories


# ==================== EXPENSES ====================

@router.get("")
async def list_expenses(
    request: Request,
    status: Optional[str] = None,
    category: Optional[str] = None,
    employee_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List expenses"""
    user = await get_current_user(request)
    
    query = {}
    
    # Regular employees see only their own
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id and employee_id != "all":
        # HR/Manager can filter by specific employee
        query["employee_id"] = employee_id
    
    if status and status != "all":
        query["status"] = status
    if category and category != "all":
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with employee names for HR/Manager
    if user.get("role") in ["super_admin", "hr_admin", "finance", "manager"]:
        for exp in expenses:
            if exp.get("employee_id"):
                emp = await db.employees.find_one({"employee_id": exp["employee_id"]}, {"_id": 0})
                if emp:
                    exp["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    
    return expenses


@router.post("")
async def create_expense(data: dict, request: Request):
    """Submit expense claim"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    
    expense = {
        "claim_id": f"exp_{uuid.uuid4().hex[:12]}",
        "employee_id": employee_id,
        "title": data.get("title"),
        "category": data.get("category", "other"),
        "amount": float(data.get("amount", 0)),
        "expense_date": data.get("expense_date"),
        "description": data.get("description"),
        "receipt_url": data.get("receipt_url"),
        "project_id": data.get("project_id"),
        "status": "pending",
        "approved_amount": None,
        "approved_by": None,
        "approved_at": None,
        "rejection_reason": None,
        "reimbursed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expenses.insert_one(expense)
    expense.pop('_id', None)
    return expense


@router.get("/{claim_id}")
async def get_expense(claim_id: str, request: Request):
    """Get expense details"""
    user = await get_current_user(request)
    
    expense = await db.expenses.find_one({"claim_id": claim_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check access
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        if expense["employee_id"] != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return expense


@router.put("/{claim_id}")
async def update_expense(claim_id: str, data: dict, request: Request):
    """Update expense (only if pending)"""
    user = await get_current_user(request)
    
    expense = await db.expenses.find_one({"claim_id": claim_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense["employee_id"] != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if expense["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot modify non-pending expense")
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_one({"claim_id": claim_id}, {"$set": data})
    return await db.expenses.find_one({"claim_id": claim_id}, {"_id": 0})


@router.put("/{claim_id}/approve")
async def approve_expense(claim_id: str, data: dict, request: Request):
    """Approve expense"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expense = await db.expenses.find_one({"claim_id": claim_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense["status"] != "pending":
        raise HTTPException(status_code=400, detail="Expense is not pending")
    
    approved_amount = data.get("approved_amount", expense["amount"])
    
    await db.expenses.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "approved",
            "approved_amount": approved_amount,
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approver_remarks": data.get("remarks")
        }}
    )
    return {"message": "Expense approved", "approved_amount": approved_amount}


@router.put("/{claim_id}/reject")
async def reject_expense(claim_id: str, data: dict, request: Request):
    """Reject expense"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.expenses.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.get("reason"),
            "rejected_by": user["user_id"],
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Expense rejected"}


@router.put("/{claim_id}/reimburse")
async def mark_reimbursed(claim_id: str, data: dict, request: Request):
    """Mark expense as reimbursed"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.expenses.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "reimbursed",
            "reimbursed_at": datetime.now(timezone.utc).isoformat(),
            "reimbursed_by": user["user_id"],
            "payment_ref": data.get("payment_ref")
        }}
    )
    return {"message": "Expense marked as reimbursed"}
