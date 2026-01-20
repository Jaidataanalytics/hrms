# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- **Role-Based Access:** Only HR/Admin can access Employees page (employees cannot see this menu)
- **Duplicate Prevention:** Rejects duplicate emp_code and email during import

### 2. Attendance Management (Enhanced - Jan 2026)
- Organization-wide attendance view (HR/Admin only)
- Individual attendance tracking
- **Role-Based Access:** 
  - HR/Admin: See Organization toggle and can view all employees
  - Employees: Only see "My Attendance" view (no Organization toggle)
- **Date Range Filters:**
  - Presets: Current Month, Last Month, Last 3 Months, Year to Date
  - Custom date range with from/to date pickers
- **Summary & Analytics Tab:**
  - Total Present Days, Absent Days, Late Instances, WFH Days
  - Perfect Attendance count
  - Rankings: Most Late (Top 10), Most Absent (Top 10)
  - Perfect Attendance list
  - Most Hours Worked (Top 10)
  - All Employee Statistics table
- **Late Marking:** Arrival after 09:45 is marked as LATE
- **Biometric API Integration:** Auto-sync every 3 hours from external biometric device
- **Time-based IN/OUT:** Before 12:00 = IN punch, After 12:00 = OUT punch

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

### 7. Biometric API Integration (Jan 2026)
**Features:**
- Automatic sync every 3 hours via APScheduler
- Manual sync trigger for HR/Admin
- Historical sync (up to 1 year) for super_admin
- Sync status dashboard and logs
- Smart IN/OUT detection based on time

**API Endpoints:**
- `POST /api/biometric/sync` - Manual sync (admin only)
- `POST /api/biometric/sync/historical` - Historical sync (super_admin only)
- `POST /api/biometric/sync/refresh-all` - Clear and re-sync all attendance
- `POST /api/biometric/sync/recalculate-late` - Recalculate late status for all records
- `GET /api/biometric/sync/status` - Get sync logs and stats
- `GET /api/biometric/sync/unmatched-codes` - List unmatched employee codes
- `GET /api/attendance/summary` - Get attendance summary and analytics for date range

## Authentication & Security

### First Login Password Change
- All new employees imported with `must_change_password: true`
- On first login, user must change password before accessing dashboard

### Role-Based Access Control
| Feature | Admin/HR | Employee |
|---------|----------|----------|
| Employees Page | ✅ Visible | ❌ Hidden |
| Organization Attendance | ✅ Toggle visible | ❌ Hidden |
| Global Search | ✅ Available | ❌ Hidden |
| Salary Edit | ✅ Can edit | ❌ View only |
| Biometric Sync | ✅ Manual trigger | ❌ No access |
| Attendance Summary | ✅ Full analytics | ❌ My attendance only |

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / NewPass@123
- **HR:** hr@shardahr.com / NewHRPass@123

## Recent Changes (Jan 20, 2026)
1. ✅ Biometric API Integration - Auto-sync every 3 hours
2. ✅ Smart IN/OUT detection based on time (before noon = IN, after noon = OUT)
3. ✅ Late marking (after 09:45 = LATE)
4. ✅ Date range filters for attendance (Current Month, Last Month, Last 3 Months, Custom)
5. ✅ Attendance Summary & Analytics tab with rankings

## Upcoming Tasks
1. Add F-prefix and C-prefix employees to database (currently unmatched in biometric)
2. Deploy to production
3. Build Payroll Rules UI for admins
4. Validate end-to-end payroll calculation

## Future Tasks
1. AI-powered shift scheduling
2. AI-powered performance recommendations
3. Mobile application
4. Export employee salaries to spreadsheet
