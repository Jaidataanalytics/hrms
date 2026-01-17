# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- **Duplicate Prevention:** Rejects duplicate emp_code and email during import

### 2. Attendance Management
- Organization-wide attendance view for HR
- Attendance History with month/year filters
- **Duplicate Prevention:** Uses upsert (employee_id + date) during import

### 3. Leave Management
- Leave balance management
- **Duplicate Prevention:** Uses upsert (employee + leave_type + year) during import

### 4. Payroll Management (Major Update - January 2026)
**Salary Structure (Based on User's Excel Template):**
- Fixed Components: BASIC, DA, HRA, Conveyance, GRADE PAY, OTHER ALLOWANCE, Medical/Special Allowance
- Deduction Config: EPF, ESI, SEWA (toggles)
- Fixed Deductions: SEWA Advance, Other Deduction

**Employee Salary Edit:**
- HR can edit any employee's salary
- Approval workflow for non-super_admin
- Salary change history tracking

**Duplicate Prevention:** Deactivates existing active salary before inserting new

### 5. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab
- **Duplicate Prevention:** Updates existing record for same employee/policy

### 6. Assets Module
- Employee asset tracking
- **Duplicate Prevention:** Updates existing record for same emp_code

### 7. Global Search & Employee 360 View
- Global search bar (Cmd+K)
- Comprehensive employee profile page

## Duplicate Prevention Summary (Implemented January 2026)

| Module | Strategy | Key Field(s) |
|--------|----------|--------------|
| Employees | Reject if exists | emp_code, email |
| Insurance | Update existing | employee_id |
| Salary | Deactivate old, insert new | employee_id + is_active |
| Attendance | Upsert | employee_id + date |
| Leave Balance | Upsert | employee_id + leave_type_id + year |
| Business Insurance | Update existing | name + company + vehicle_no |
| Assets | Update existing | emp_code |

## Cleanup Performed
- **11 duplicate employee records** deleted
- **5 duplicate insurance records** deleted
- All collections verified clean with zero duplicates

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123

## Recent Test Results
- Test iteration 21: Duplicate Prevention - 13/13 tests passed (100%)
- Test iteration 20: Salary Edit Features - 10/10 tests passed
- Test iteration 19: Payroll/Attendance features - 14/14 tests passed
- Test iteration 18: Global Search & Employee 360 - 19/19 tests passed

## Database Stats (After Cleanup)
- Employees: 45 (reduced from 56)
- Insurance records: 1 (reduced from 6)
- Active salaries: 76
- No duplicate records in any collection

## Future Tasks
1. Deploy to production
2. Biometric device integration (on hold)
3. AI-powered shift scheduling
4. Mobile application
