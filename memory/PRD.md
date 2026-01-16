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
- Supports multiple salary data structures (gross, fixed_components, ctc)

### 5. Insurance Module
**Two-tab structure:**

#### Employee Insurance Tab
- **ESIC** coverage tracking (checkbox)
- **PMJJBY** (Pradhan Mantri Jeevan Jyoti Bima Yojana) coverage tracking (checkbox)
- **Accidental Insurance** coverage tracking (checkbox)
- All fields optional except Employee Code
- Bulk import with ESIC, PMJJBY, Accidental columns support

#### Business Insurance Tab
- Policy tracking for business assets
- Fields: Name of Insurance, Vehicle No. (optional), Insurance Company, Date of Issuance, Due Date
- Bulk import functionality
- Status tracking (Active, Due Soon, Expired)

### 6. Global Search & Employee 360 View (NEW - January 2026)
**Global Search:**
- Accessible via search button in header (HR/Admin only)
- Keyboard shortcut: Cmd+K / Ctrl+K
- Search by name, email, emp_code, department
- Real-time search with debouncing
- Click result to navigate to Employee 360 page

**Employee 360 View:**
- Comprehensive employee profile page
- Header showing basic info, contact, status badges
- 6 tabs: Attendance, Salary, Leaves, Payslips, Insurance, Assets
- Month/Year filtering for attendance
- Full salary breakdown with earnings and deductions
- Leave balances and request history

### 7. Data Management
- Bulk data deletion for all modules
- Contract labour data management

## Technical Stack
- **Frontend:** React + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + Google OAuth (Emergent-managed)

## Key API Endpoints

### Employee Search & 360 APIs (NEW)
- `GET /api/employees/search?q={query}&limit={n}` - Search employees
- `GET /api/employees/{employee_id}` - Get employee details
- `GET /api/attendance?employee_id={id}&month={m}&year={y}` - Get employee attendance
- `GET /api/leave/balances?employee_id={id}` - Get leave balances
- `GET /api/leave/requests?employee_id={id}&limit={n}` - Get leave requests
- `GET /api/payroll/employee/{employee_id}` - Get salary structure
- `GET /api/payroll/payslips?employee_id={id}&limit={n}` - Get payslips
- `GET /api/insurance?employee_id={id}` - Get insurance status
- `GET /api/employee-assets/{identifier}` - Get assigned assets

### Insurance APIs
- `GET /api/insurance` - List employee insurance
- `POST /api/insurance` - Create employee insurance
- `GET /api/business-insurance` - List business insurance
- `POST /api/business-insurance` - Create business insurance

## Database Schema

### Key Collections
- `employees` - Employee records
- `employee_salaries` - Salary structures (new format with fixed_components)
- `salary_structures` - Legacy salary data (ctc-based)
- `attendance` - Daily attendance records
- `leave_balances` - Employee leave balances
- `leave_requests` - Leave applications
- `insurance` - Employee insurance records
- `business_insurance` - Company insurance policies
- `employee_assets` - Assigned assets

## Completed Features (January 16, 2026)
1. ✅ Global Search for employees (HR/Admin)
2. ✅ Employee 360 comprehensive profile view
3. ✅ Backend APIs for Employee 360 data fetching
4. ✅ Salary tab supports new fixed_components structure
5. ✅ Insurance page with two tabs (Employee + Business)
6. ✅ Contract Labour simplified tracker
7. ✅ Bulk import fixes for large Excel files

## Pending/In Progress Tasks
1. **P1: Fix Payroll Calculation Bug** - Investigate why payroll calculation is not working. Two collections exist (employee_salaries, salary_structures) with different schemas.
2. **P1: Enhance Attendance Page** - Add month/year filters and employee search for HR/Admin
3. **P1: Salary Structure View for HR** - Allow HR to view all employees' salary structures

## Future/Backlog Tasks
1. Deploy to production (all changes are in preview)
2. Biometric device integration (on hold by user)
3. AI-powered shift scheduling
4. AI-powered performance recommendations
5. Mobile application development

## Test Credentials
- **Admin:** admin@shardahr.com / Welcome@123
- **Test Employee:** EMP7A155FF6 (Test User)

## Recent Test Results
- Test file: `/app/test_reports/iteration_18.json`
- All 19 backend tests passed
- All frontend tests passed
- Global Search and Employee 360 fully functional
