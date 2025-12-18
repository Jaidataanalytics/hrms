"""Documents, Assets & Expenses API Routes"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(tags=["Documents & Assets"])

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


async def get_current_user(request: Request) -> dict:
    from server import get_current_user as auth_get_user
    return await auth_get_user(request)


# ==================== DOCUMENTS ====================

@router.get("/documents")
async def list_documents(request: Request, employee_id: Optional[str] = None, type: Optional[str] = None):
    """List documents"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    
    if type:
        query["type"] = type
    
    docs = await db.documents.find(query, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return docs


@router.post("/documents")
async def upload_document(data: dict, request: Request):
    """Upload document metadata"""
    user = await get_current_user(request)
    
    data["document_id"] = f"doc_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = data.get("employee_id", user.get("employee_id"))
    data["uploaded_by"] = user["user_id"]
    data["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    data["is_verified"] = False
    
    await db.documents.insert_one(data)
    return data


@router.put("/documents/{document_id}/verify")
async def verify_document(document_id: str, data: dict, request: Request):
    """Verify document (HR only)"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.documents.update_one(
        {"document_id": document_id},
        {"$set": {
            "is_verified": True,
            "verified_by": user["user_id"],
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "remarks": data.get("remarks")
        }}
    )
    return {"message": "Document verified"}


@router.get("/document-types")
async def list_document_types(request: Request):
    """List document types"""
    await get_current_user(request)
    types = await db.document_types.find({"is_active": True}, {"_id": 0}).to_list(50)
    if not types:
        # Return default types
        return [
            {"type_id": "id_proof", "name": "ID Proof", "code": "ID", "is_mandatory": True},
            {"type_id": "address_proof", "name": "Address Proof", "code": "ADDR", "is_mandatory": True},
            {"type_id": "education", "name": "Education Certificate", "code": "EDU", "is_mandatory": False},
            {"type_id": "experience", "name": "Experience Letter", "code": "EXP", "is_mandatory": False},
            {"type_id": "offer_letter", "name": "Offer Letter", "code": "OL", "is_mandatory": False},
            {"type_id": "pan_card", "name": "PAN Card", "code": "PAN", "is_mandatory": True},
            {"type_id": "aadhaar", "name": "Aadhaar Card", "code": "AADH", "is_mandatory": True}
        ]
    return types


# ==================== ASSETS ====================

@router.get("/assets")
async def list_assets(request: Request, status: Optional[str] = None, category: Optional[str] = None):
    """List assets"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    assets = await db.assets.find(query, {"_id": 0}).to_list(500)
    return assets


@router.post("/assets")
async def create_asset(data: dict, request: Request):
    """Create asset"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data["asset_id"] = f"ast_{uuid.uuid4().hex[:12]}"
    data["status"] = "available"
    data["is_active"] = True
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.assets.insert_one(data)
    return data


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    """Get asset details"""
    user = await get_current_user(request)
    
    asset = await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Get assignment history
    history = await db.asset_assignments.find({"asset_id": asset_id}, {"_id": 0}).sort("assigned_date", -1).to_list(20)
    asset["assignment_history"] = history
    
    return asset


@router.put("/assets/{asset_id}/assign")
async def assign_asset(asset_id: str, data: dict, request: Request):
    """Assign asset to employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    asset = await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if asset["status"] != "available":
        raise HTTPException(status_code=400, detail="Asset is not available")
    
    employee_id = data.get("employee_id")
    
    # Update asset
    await db.assets.update_one(
        {"asset_id": asset_id},
        {"$set": {
            "status": "assigned",
            "assigned_to": employee_id,
            "assigned_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }}
    )
    
    # Create assignment record
    assignment = {
        "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
        "asset_id": asset_id,
        "employee_id": employee_id,
        "assigned_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "condition_at_assignment": asset.get("condition", "good"),
        "assigned_by": user["user_id"],
        "remarks": data.get("remarks"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.asset_assignments.insert_one(assignment)
    
    return {"message": "Asset assigned successfully"}


@router.put("/assets/{asset_id}/return")
async def return_asset(asset_id: str, data: dict, request: Request):
    """Return asset from employee"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    asset = await db.assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Update asset
    await db.assets.update_one(
        {"asset_id": asset_id},
        {"$set": {
            "status": "available",
            "assigned_to": None,
            "assigned_date": None,
            "condition": data.get("condition", asset.get("condition", "good"))
        }}
    )
    
    # Update assignment record
    await db.asset_assignments.update_one(
        {"asset_id": asset_id, "returned_date": None},
        {"$set": {
            "returned_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "condition_at_return": data.get("condition"),
            "returned_to": user["user_id"]
        }}
    )
    
    return {"message": "Asset returned successfully"}


@router.get("/my-assets")
async def get_my_assets(request: Request):
    """Get assets assigned to current user"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    assets = await db.assets.find({"assigned_to": employee_id}, {"_id": 0}).to_list(50)
    return assets


@router.get("/asset-requests")
async def list_asset_requests(request: Request, status: Optional[str] = None):
    """List asset requests"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "it_admin"]:
        query["employee_id"] = user.get("employee_id")
    if status:
        query["status"] = status
    
    requests = await db.asset_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@router.post("/asset-requests")
async def create_asset_request(data: dict, request: Request):
    """Create asset request"""
    user = await get_current_user(request)
    
    data["request_id"] = f"areq_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = user.get("employee_id")
    data["status"] = "pending"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.asset_requests.insert_one(data)
    return data


# ==================== EXPENSES ====================

@router.get("/expenses")
async def list_expenses(request: Request, status: Optional[str] = None, category: Optional[str] = None):
    """List expense claims"""
    user = await get_current_user(request)
    
    query = {}
    if user.get("role") not in ["super_admin", "hr_admin", "finance"]:
        query["employee_id"] = user.get("employee_id")
    
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return expenses


@router.post("/expenses")
async def create_expense(data: dict, request: Request):
    """Create expense claim"""
    user = await get_current_user(request)
    
    data["claim_id"] = f"exp_{uuid.uuid4().hex[:12]}"
    data["employee_id"] = user.get("employee_id")
    data["status"] = "pending"
    data["currency"] = "INR"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.expenses.insert_one(data)
    
    # Notify manager/HR
    # TODO: Add notification
    
    return data


@router.get("/expenses/{claim_id}")
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


@router.put("/expenses/{claim_id}/approve")
async def approve_expense(claim_id: str, data: dict, request: Request):
    """Approve expense claim"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expense = await db.expenses.find_one({"claim_id": claim_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    await db.expenses.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_amount": data.get("approved_amount", expense["amount"])
        }}
    )
    
    return {"message": "Expense approved"}


@router.put("/expenses/{claim_id}/reject")
async def reject_expense(claim_id: str, data: dict, request: Request):
    """Reject expense claim"""
    user = await get_current_user(request)
    if user.get("role") not in ["super_admin", "hr_admin", "finance", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.expenses.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "rejected",
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": data.get("reason")
        }}
    )
    
    return {"message": "Expense rejected"}


@router.get("/my-expenses")
async def get_my_expenses(request: Request):
    """Get current user's expenses"""
    user = await get_current_user(request)
    employee_id = user.get("employee_id")
    
    if not employee_id:
        return []
    
    expenses = await db.expenses.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return expenses


@router.get("/expense-categories")
async def list_expense_categories(request: Request):
    """List expense categories"""
    await get_current_user(request)
    return [
        {"code": "travel", "name": "Travel", "max_per_claim": 50000},
        {"code": "food", "name": "Food & Meals", "max_per_claim": 5000},
        {"code": "accommodation", "name": "Accommodation", "max_per_claim": 10000},
        {"code": "client_entertainment", "name": "Client Entertainment", "max_per_claim": 25000},
        {"code": "fuel", "name": "Fuel & Transport", "max_per_claim": 10000},
        {"code": "office_supplies", "name": "Office Supplies", "max_per_claim": 5000},
        {"code": "other", "name": "Other", "max_per_claim": 10000}
    ]
