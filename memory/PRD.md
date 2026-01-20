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

## Authentication & Security

### First Login Password Change (NEW)
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

## Admin Cleanup Endpoint
POST `/api/admin/cleanup-duplicates` - Removes duplicate records (super_admin only)
- Cleans duplicate employees (by emp_code)
- Cleans duplicate insurance (by employee_id)
- Deactivates duplicate salaries (by employee_id)

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / NewPass@123
- **HR:** hr@shardahr.com / NewHRPass@123

## Recent Test Results
- Test iteration 22: Employee Role Restrictions - 11/11 tests passed (100%)
- Test iteration 21: Duplicate Prevention - 13/13 tests passed
- Test iteration 20: Salary Edit Features - 10/10 tests passed

## Pending: Production Deployment
After deployment, run cleanup on production:
```javascript
// In browser console after logging in as admin
fetch('/api/admin/cleanup-duplicates', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

## Future Tasks
1. Deploy to production + run cleanup
2. Biometric device integration (on hold)
3. AI-powered shift scheduling
4. Mobile application
