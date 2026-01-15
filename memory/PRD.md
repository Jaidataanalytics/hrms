# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- Employee profiles with personal and professional details
- Mandatory emp_code field for bulk imports

### 2. Attendance Management
- Organization-wide attendance view for HR users
- Individual attendance tracking
- Bulk attendance import
- Biometric device integration (webhook-based)

### 3. Leave Management
- Configurable leave rules (accrual, carry-forward, etc.)
- Leave balance management by HR
- Bulk leave balance import
- Leave request workflow

### 4. Payroll Management
- Salary structure configuration
- Bulk salary import
- Payroll rules and calculations

### 5. Insurance Module (LATEST - January 2026)
**Two-tab structure:**

#### Employee Insurance Tab
- **ESIC** coverage tracking (checkbox)
- **PMJJBY** (Pradhan Mantri Jeevan Jyoti Bima Yojana) coverage tracking (checkbox)
- **Accidental Insurance** coverage tracking (checkbox)
- All fields optional except Employee Code
- Bulk import with ESIC, PMJJBY, Accidental columns support
- Template download

#### Business Insurance Tab
- Policy tracking for business assets
- Fields: Name of Insurance, Vehicle No. (optional), Insurance Company, Date of Issuance, Due Date
- Bulk import functionality
- Template download matching user's format
- Status tracking (Active, Due Soon, Expired)

### 6. Data Management
- Bulk data deletion for all modules
- Contract labour data management

## Technical Stack
- **Frontend:** React + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + Google OAuth (Emergent-managed)

## Key API Endpoints

### Insurance APIs
- `GET /api/insurance` - List employee insurance
- `POST /api/insurance` - Create employee insurance
- `PUT /api/insurance/{id}` - Update employee insurance
- `DELETE /api/insurance/{id}` - Delete employee insurance
- `GET /api/business-insurance` - List business insurance
- `POST /api/business-insurance` - Create business insurance
- `PUT /api/business-insurance/{id}` - Update business insurance
- `DELETE /api/business-insurance/{id}` - Delete business insurance
- `GET /api/import/templates/insurance` - Download employee insurance template
- `GET /api/import/templates/business-insurance` - Download business insurance template
- `POST /api/import/insurance` - Bulk import employee insurance
- `POST /api/import/business-insurance` - Bulk import business insurance

## Database Schema

### insurance (Employee Insurance)
```json
{
  "insurance_id": "string",
  "employee_id": "string",
  "emp_code": "string",
  "employee_name": "string",
  "esic": "boolean",
  "pmjjby": "boolean",
  "accidental_insurance": "boolean",
  "insurance_date": "string|null",
  "amount": "number|null",
  "insurance_company": "string|null",
  "policy_number": "string|null",
  "coverage_type": "string|null",
  "status": "string",
  "notes": "string|null"
}
```

### business_insurance
```json
{
  "business_insurance_id": "string",
  "name_of_insurance": "string",
  "vehicle_no": "string|null",
  "insurance_company": "string",
  "date_of_issuance": "string|null",
  "due_date": "string|null",
  "notes": "string|null"
}
```

## Completed Features (January 2026)
1. Insurance page with two tabs (Employee Insurance + Business Insurance)
2. ESIC column and functionality for employee insurance
3. Business insurance CRUD with user-specified template format
4. Bulk upload for both insurance types
5. Template download for both types

## Pending/Future Tasks
1. **P0: Deploy to Production** - All new features are in preview only
2. **P1: Implement New Payroll Calculation Logic**
3. **P1: Meeting Management & Task Tracking**
4. **P2: Fix /api/leave 404 error**
5. **P2: Biometric device integration testing**
6. Refactor server.py into smaller route files
7. AI-powered shift scheduling
8. Mobile application development
