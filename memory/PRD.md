# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- Employee profiles with personal and professional details
- Mandatory emp_code field for bulk imports

### 2. Attendance Management (ENHANCED - January 2026)
- Organization-wide attendance view for HR users
- **NEW: Attendance History Section**
  - Month/Year dropdown filters
  - Employee search/filter dropdown
  - Historical attendance table with: Date, Employee, Status, Punch In, Punch Out, Hours, Late indicator
  - Refresh button for data reload
- Individual attendance tracking (My Attendance view)
- Bulk attendance import
- Biometric device integration (webhook-based)

### 3. Leave Management
- Configurable leave rules (accrual, carry-forward, etc.)
- Leave balance management by HR
- Bulk leave balance import
- Leave request workflow

### 4. Payroll Management (ENHANCED - January 2026)
- Salary structure configuration
- Bulk salary import
- **NEW: Salary Structures Tab** - HR can view all employees' salary data
  - Table columns: Emp Code, Employee Name, Department, Designation, Gross Salary, Basic, Annual CTC, Data Source
  - Search by name, code, email
  - Shows data source badge (fixed_components, gross, ctc, No Data)
- **BUG FIX: Payroll Calculation** - Now merges data from both `employee_salaries` and `salary_structures` collections
- Payroll rules and calculations

### 5. Insurance Module
**Two-tab structure:**

#### Employee Insurance Tab
- ESIC, PMJJBY, Accidental Insurance coverage tracking
- All fields optional except Employee Code
- Bulk import support

#### Business Insurance Tab
- Policy tracking for business assets
- Bulk import functionality

### 6. Global Search & Employee 360 View (January 2026)
**Global Search:**
- Accessible via search button in header (HR/Admin only)
- Keyboard shortcut: Cmd+K / Ctrl+K
- Search by name, email, emp_code, department
- Real-time search with debouncing

**Employee 360 View:**
- Comprehensive employee profile page
- 6 tabs: Attendance, Salary, Leaves, Payslips, Insurance, Assets
- Month/Year filtering for attendance

## Technical Stack
- **Frontend:** React + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + Google OAuth (Emergent-managed)

## Key API Endpoints

### New/Updated APIs (January 16, 2026)
- `GET /api/payroll/all-salary-structures` - Get all employees' salary data with search
- `GET /api/attendance?month={m}&year={y}&employee_id={id}` - Enhanced attendance with filters
- `GET /api/employees/search?q={query}` - Employee search
- `GET /api/leave/balances?employee_id={id}` - Get leave balances
- `GET /api/leave/requests?employee_id={id}` - Get leave requests

## Database Schema

### Key Collections
- `employees` - Employee records (56 active)
- `employee_salaries` - Salary structures with `gross` field (76 records)
- `salary_structures` - Legacy salary data with `ctc` field (56 records)
- `attendance` - Daily attendance records
- `leave_balances` - Employee leave balances
- `leave_requests` - Leave applications
- `insurance` - Employee insurance records
- `business_insurance` - Company insurance policies
- `employee_assets` - Assigned assets

## Completed Features (January 16, 2026)
1. ✅ Global Search for employees (HR/Admin)
2. ✅ Employee 360 comprehensive profile view
3. ✅ Salary Structures tab in Payroll page
4. ✅ Attendance History with month/year/employee filters
5. ✅ Payroll calculation bug fix (merges both salary collections)
6. ✅ Insurance page with two tabs (Employee + Business)
7. ✅ Contract Labour simplified tracker
8. ✅ Bulk import fixes for large Excel files

## Pending Tasks
1. **Deploy to Production** - All changes are in preview environment only

## Future/Backlog Tasks
1. Biometric device integration (on hold by user)
2. AI-powered shift scheduling
3. AI-powered performance recommendations
4. Mobile application development

## Test Credentials
- **Admin:** admin@shardahr.com / Welcome@123
- **Test Employee:** EMP7A155FF6 (Test User)

## Recent Test Results
- Test iteration 18: Global Search & Employee 360 - All 19 tests passed
- Test iteration 19: Payroll/Attendance features - All 14 tests passed
