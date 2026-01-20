# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- **Role-Based Access:** Only HR/Admin can access Employees page (employees cannot see this menu)
- **Duplicate Prevention:** Rejects duplicate emp_code and email during import

### 2. Attendance Management
- Organization-wide attendance view (HR/Admin only)
- Individual attendance tracking
- **Role-Based Access:** 
  - HR/Admin: See Organization toggle and can view all employees
  - Employees: Only see "My Attendance" view (no Organization toggle)
- Attendance History with month/year filters
- **Duplicate Prevention:** Uses upsert during import
- **Biometric API Integration:** Auto-sync every 3 hours from external biometric device

### 3. Leave Management
- Leave balance management
- **Duplicate Prevention:** Uses upsert during import

### 4. Payroll Management (Enhanced)
**Salary Structure:**
- Fixed Components: BASIC, DA, HRA, Conveyance, GRADE PAY, OTHER ALLOWANCE, Medical/Special Allowance
- Deduction Config: EPF, ESI, SEWA (toggles)
- Fixed Deductions: SEWA Advance, Other Deduction

**Employee Salary Edit:**
- HR can edit any employee's salary
- Approval workflow for non-super_admin
- Salary change history tracking

### 5. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab

### 6. Global Search & Employee 360 View
- Global search bar (Cmd+K) - HR/Admin only
- Comprehensive employee profile page

### 7. Biometric API Integration (NEW - Jan 2026)
**Features:**
- Automatic sync every 3 hours via APScheduler
- Manual sync trigger for HR/Admin
- Historical sync (up to 1 year) for super_admin
- Sync status dashboard and logs

**API Endpoints:**
- `POST /api/biometric/sync` - Manual sync (admin only)
- `POST /api/biometric/sync/historical` - Historical sync (super_admin only)
- `GET /api/biometric/sync/status` - Get sync logs and stats
- `GET /api/biometric/sync/unmatched-codes` - List unmatched employee codes

**Technical Details:**
- External API: `http://115.245.227.203:81/api/v2/WebAPI/GetDeviceLogs`
- Mapping: `EmployeeCode` (API) → `emp_code` (DB)
- Punch types: `in` → IN, `out` → OUT
- Scheduler: APScheduler with 3-hour interval

**Sync Statistics (Initial Run):**
- Total API records: 64,381
- Matched employees: 10,212
- Unmatched (F/C prefix): 54,169

## Authentication & Security

### First Login Password Change
- All new employees imported with `must_change_password: true`
- On first login:
  1. User enters email/password
  2. System checks `must_change_password` flag
  3. If true, shows password change dialog (cannot be dismissed)
  4. User must enter new password (min 6 characters)
  5. After change, redirected to dashboard
  6. `must_change_password` set to false

### Role-Based Access Control
| Feature | Admin/HR | Employee |
|---------|----------|----------|
| Employees Page | ✅ Visible | ❌ Hidden |
| Organization Attendance | ✅ Toggle visible | ❌ Hidden |
| Global Search | ✅ Available | ❌ Hidden |
| Salary Edit | ✅ Can edit | ❌ View only |
| Biometric Sync | ✅ Manual trigger | ❌ No access |

## Admin Endpoints
- `POST /api/admin/cleanup-duplicates` - Removes duplicate records (super_admin only)

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / NewPass@123
- **HR:** hr@shardahr.com / NewHRPass@123

## Recent Test Results
- Test iteration 23: Biometric API Integration - 13/13 tests passed (100%)
- Test iteration 22: Employee Role Restrictions - 11/11 tests passed (100%)
- Test iteration 21: Duplicate Prevention - 13/13 tests passed
- Test iteration 20: Salary Edit Features - 10/10 tests passed

## Upcoming Tasks
1. Add F-prefix and C-prefix employees to database (currently unmatched)
2. Deploy to production + run cleanup
3. Build Payroll Rules UI for admins
4. Validate end-to-end payroll calculation

## Future Tasks
1. AI-powered shift scheduling
2. AI-powered performance recommendations
3. Mobile application
4. Export employee salaries to spreadsheet
