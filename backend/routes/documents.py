"""Documents, Assets & Expenses API Routes"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone
import uuid
import base64
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
    
    if type and type != 'all':
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
    data.pop('_id', None)
    return data


@router.post("/documents/upload")
async def upload_document_with_file(
    request: Request,
    name: str = Form(...),
    type: str = Form(...),
    description: str = Form(None),
    employee_id: str = Form(None),
    file: UploadFile = File(None)
):
    """Upload document with file attachment"""
    user = await get_current_user(request)
    
    doc_data = {
        "document_id": f"doc_{uuid.uuid4().hex[:12]}",
        "name": name,
        "type": type,
        "description": description or "",
        "employee_id": employee_id or user.get("employee_id"),
        "uploaded_by": user["user_id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "is_verified": False
    }
    
    if file:
        # Read and store file content as base64
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        doc_data["file_name"] = file.filename
        doc_data["file_type"] = file.content_type
        doc_data["file_data"] = base64.b64encode(content).decode('utf-8')
        doc_data["file_size"] = len(content)
    
    await db.documents.insert_one(doc_data)
    doc_data.pop('_id', None)
    doc_data.pop('file_data', None)  # Don't return file data in response
    return doc_data


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, request: Request):
    """Delete a document"""
    user = await get_current_user(request)
    
    # Find the document first
    doc = await db.documents.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check permissions - only owner or HR can delete
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        if doc.get("employee_id") != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized to delete this document")
    
    await db.documents.delete_one({"document_id": document_id})
    return {"message": "Document deleted"}


@router.get("/documents/{document_id}/download")
async def download_document(document_id: str, request: Request):
    """Download document file"""
    user = await get_current_user(request)
    
    doc = await db.documents.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check permissions
    if user.get("role") not in ["super_admin", "hr_admin", "hr_executive"]:
        if doc.get("employee_id") != user.get("employee_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not doc.get("file_data"):
        raise HTTPException(status_code=404, detail="No file attached")
    
    from fastapi.responses import Response
    content = base64.b64decode(doc["file_data"])
    return Response(
        content=content,
        media_type=doc.get("file_type", "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename={doc.get('file_name', 'document')}"}
    )


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


# NOTE: Asset routes moved to /app/backend/routes/assets.py
# NOTE: Expense routes moved to /app/backend/routes/expenses.py
