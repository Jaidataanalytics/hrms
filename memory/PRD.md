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
- **Automatic sync on startup** - Checks if data exists, runs historical sync if not
- Scheduled sync every 3 hours via APScheduler
- Manual sync trigger for HR/Admin
- Historical sync (up to 1 year) for super_admin
- Sync status dashboard and logs
- Smart IN/OUT detection based on time

**How it works:**
1. On app startup, checks if biometric attendance data exists
2. If NO data → automatically runs 1-year historical sync
3. If data exists → runs regular 2-day sync
4. Scheduler runs every 3 hours for ongoing updates

**This fixes the production sync issue** - deployed version will now auto-sync on first startup.

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
- **Employee:** employee@shardahr.com / Employee@123
- **HR:** hr@shardahr.com / NewHRPass@123

## Recent Changes (Jan 20-21, 2026)
1. ✅ Biometric API Integration - Auto-sync every 3 hours
2. ✅ Smart IN/OUT detection based on time (before noon = IN, after noon = OUT)
3. ✅ **Late marking threshold changed from 09:45 to 10:00 AM**
4. ✅ Date range filters for attendance (Current Month, Last Month, Last 3 Months, Custom)
5. ✅ Attendance Summary & Analytics tab with rankings
6. ✅ **Role-Based Attendance Views (Jan 20, 2026)**:
   - Admin/HR: Full "Attendance Analytics" dashboard with tabs (Overview, Patterns, Employee Insights, Department), metrics, rankings, Export button, All Employees filter
   - Employee: Simplified "My Attendance" view with personal stats only (Present Days, Absent Days, Late, WFH, Leave)
   - Employee blocked from `/api/attendance/summary` endpoint (403)
   - Dashboard text updated to "Your attendance will be synced from the biometric system"
7. ✅ Manual punch-in/out buttons removed from dashboard (biometric sync handles attendance)
8. ✅ **Payroll Details View & Export (Jan 20, 2026)**:
   - Click on processed payroll to view full details in a modal
   - Summary cards: Total Gross, Total Deductions, Total Net Pay, PF+ESI+PT
   - Detailed table with all employee payslips (Emp Code, Name, Department, Days, Gross, Deductions, Net Pay)
   - Export to Excel button exports complete payroll data with summary row
   - Backend endpoint: `GET /api/payroll/runs/{payroll_id}`
9. ✅ **Attendance Calendar View (Jan 20, 2026)**:
   - New Calendar tab as the default/first tab in Attendance Analytics
   - Calendar grid showing each day with:
     - 🟢 Green indicator: Present employee count
     - 🟡 Amber indicator: Late employee count
     - 🔴 Red indicator: Absent employee count
   - Sundays greyed out, Holidays show holiday name
   - Click on any date to see detailed breakdown in right panel:
     - Present employees with in/out times
     - Late employees with in/out times
     - Absent employees list
   - Backend endpoint: `GET /api/attendance/calendar-data`
10. ✅ **Bulk Import Assets Now Visible (Jan 21, 2026)**:
    - Fixed: Asset data imported through bulk import now shows on Assets page
    - New "Employee Assignments" tab added (default tab for admins)
    - Shows: Emp Code, Employee Name, SDPL Number, Tag, Mobile/Charger, Laptop, System, Printer, SIM/Mobile No
    - Search functionality for filtering by name, code, SDPL
    - Backend endpoint: `GET /api/assets/employee-assignments`

## Upcoming Tasks
1. 🔴 **P1: Deploy to Production** - Production is critically outdated
2. 🟠 **P1: Add Missing Employees** - 100+ unmatched employee codes (F-prefix, C-prefix) from biometric
3. 🟡 **P2: Build Payroll Rules UI** - Admin interface for EPF/ESI percentages
4. 🟡 **P2: Validate end-to-end payroll calculation**

## Future Tasks
1. AI-powered shift scheduling
2. AI-powered performance recommendations
3. Mobile application
4. Export employee salaries to spreadsheet
5. Meeting Management & Task Tracking
