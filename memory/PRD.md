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
- **Late Marking:** Arrival after 10:00 AM is marked as LATE (updated from 09:45)
- **Biometric API Integration:** Auto-sync every 3 hours from external biometric device
- **Time-based IN/OUT:** Before 12:00 = IN punch, After 12:00 = OUT punch
- **Calendar View:** Daily attendance stats with drill-down to employee lists

### 3. Leave Management
- Leave balance management
- **Duplicate Prevention:** Uses upsert during import
- **Configurable Leave Policy Rules:** Annual quotas, carry forward, Sunday penalty rules

### 4. Payroll Management (OVERHAULED - Jan 22, 2026)

**New Salary Structure Template Format:**

| Column | Component | Description |
|--------|-----------|-------------|
| C | BASIC | Base salary |
| D | DA | Dearness Allowance |
| E | HRA | House Rent Allowance |
| F | Conveyance | Transport allowance |
| G | GRADE PAY | Grade pay (usually 0) |
| H | OTHER ALLOW | Other allowances |
| I | Med./Spl. Allow | Medical/Special Allowance |
| J | Total Fixed | Sum of all above |

**New Calculation Logic:**
- Uses **calendar days** (28-31) instead of fixed 26 days
- **Pro-rates** each component: Earned = Fixed × (Earned Days / Total Days)
- **WFH counted at 50%** (configurable)
- **Late deduction**: 2 lates in a week = half day deduction
- **EPF**: 12% of Basic (capped at ₹15,000 ceiling)
- **ESI**: 0.75% of Gross (only if Gross ≤ ₹21,000)
- **SEWA**: 2% of Basic
- **Professional Tax (PT)**: EXCLUDED (not applicable)

**SEWA Advance Management (NEW):**
- Add employees who need to pay SEWA advance
- Set: Total amount, Monthly deduction, Duration
- Automatic tracking of paid vs remaining
- Auto-completes when fully paid

**One-time Deductions (NEW):**
- Add per-employee per-month deductions
- Categories: Loan EMI, Advance Recovery, Penalty, Other
- Applied during payroll processing

**Payslip Editing (NEW):**
- HR can edit individual payslips before payroll is locked
- Edit attendance inputs (office days, WFH, leave, late count)
- System recalculates salary automatically
- Edit button in payroll details modal

**Export to Excel:**
- Exports in **same format as salary structure template**
- All columns: Emp Code, Name, Fixed components, Attendance, Earned components, Deductions, NET PAYABLE
- Includes totals row

**API Endpoints:**
- `POST /api/payroll/sewa-advances` - Create SEWA advance
- `GET /api/payroll/sewa-advances` - List SEWA advances
- `DELETE /api/payroll/sewa-advances/{id}` - Cancel SEWA advance
- `POST /api/payroll/one-time-deductions` - Create one-time deduction
- `GET /api/payroll/one-time-deductions` - List deductions (filtered by month/year)
- `PUT /api/payroll/payslips/{id}` - Edit payslip (with recalculate option)
- `POST /api/payroll/import-salaries` - Bulk import from template

### 5. Asset Management (Enhanced)
- Asset Inventory with individual asset tracking
- Employee Assignment view
- NUMBER TAG parsing for bulk import
- Edit, Delete, Reassign, Unassign operations

### 6. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab

### 7. Global Search & Employee 360 View
- Global search bar (Cmd+K) - HR/Admin only
- Comprehensive employee profile page

### 8. Biometric API Integration
- Automatic sync on startup
- Scheduled sync every 3 hours
- Manual sync trigger for HR/Admin
- Historical sync (up to 1 year) for super_admin

## Authentication & Security

### Role-Based Access Control
| Feature | Admin/HR | Employee |
|---------|----------|----------|
| Employees Page | ✅ Visible | ❌ Hidden |
| Organization Attendance | ✅ Toggle visible | ❌ Hidden |
| Global Search | ✅ Available | ❌ Hidden |
| Salary Edit | ✅ Can edit | ❌ View only |
| Biometric Sync | ✅ Manual trigger | ❌ No access |
| SEWA Advances | ✅ Full access | ❌ No access |
| One-time Deductions | ✅ Full access | ❌ No access |
| Payslip Edit | ✅ Before lock | ❌ No access |

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / Employee@123
- **HR:** hr@shardahr.com / NewHRPass@123

## Recent Changes (Jan 22, 2026)
1. ✅ **Payroll Calculation Overhaul**:
   - New calculation logic using calendar days and pro-rated components
   - WFH at 50%, late deduction (2 lates = 0.5 day), PT excluded
   - Backend: `/app/backend/routes/payroll_v2.py` for calculation helpers
   
2. ✅ **SEWA Advance Management**:
   - New tab in Payroll page for managing employee SEWA advances
   - Track total amount, monthly deduction, paid vs remaining
   - Auto-complete when fully paid
   
3. ✅ **One-time Deductions**:
   - New tab for per-employee per-month deductions
   - Categories: Loan EMI, Advance Recovery, Penalty, Other
   
4. ✅ **Payslip Editing Before Lock**:
   - Edit button on each payslip in payroll details modal
   - Update attendance inputs and recalculate salary
   
5. ✅ **Export in Template Format**:
   - Excel export matches salary structure template
   - All columns: Fixed, Attendance, Earned, Deductions, Net

## Upcoming Tasks
1. 🔴 **P0: Test Payroll Processing** - Run payroll with new calculation to verify numbers
2. 🔴 **P1: Deploy to Production** - Production is critically outdated (3+ forks behind)
3. 🟠 **P1: Add Missing Employees** - 100+ unmatched employee codes from biometric
4. 🟡 **P2: Bulk Salary Import** - Test importing from salary structure template

## Future Tasks
1. Employee payslip PDF download
2. HR spreadsheet download of all salaries
3. Meeting Management & Task Tracking
4. AI-powered Shift Scheduling
5. AI-powered Performance Recommendations
6. Mobile application (limited scope)
