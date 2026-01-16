# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, and insurance modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- Employee profiles with personal and professional details

### 2. Attendance Management (Enhanced)
- Organization-wide attendance view for HR users
- Attendance History with month/year filters and employee search
- Individual attendance tracking
- Bulk attendance import

### 3. Leave Management
- Configurable leave rules
- Leave balance management by HR
- Bulk leave balance import
- Leave request workflow

### 4. Payroll Management (Major Update - January 2026)

#### Salary Structure (Based on User's Excel Template)
**Fixed Components (Earnings):**
- BASIC
- DA (Dearness Allowance)
- HRA (House Rent Allowance)
- Conveyance
- GRADE PAY
- OTHER ALLOWANCE
- Medical/Special Allowance

**Deduction Configuration:**
- EPF Applicable (toggle, 12% of Basic)
- ESI Applicable (toggle, 0.75% of Gross if < ₹21,000)
- SEWA Applicable (toggle, configurable percentage)

**Fixed Deductions:**
- SEWA Advance
- Other Deduction

#### Employee Salary Edit Feature (NEW)
- HR can edit any employee's salary structure
- **Approval Workflow:**
  - Super Admin: Direct save
  - HR Admin/Finance: Creates change request for approval
- **Salary Change History:** All changes tracked with:
  - Previous salary
  - New salary
  - Changed by
  - Approved by
  - Reason for change

#### Salary Structures Tab (NEW)
- View all employees' salary data
- Search by name, code, email
- Edit button for each employee
- History button to view change log

#### Configurable Payroll Rules
- EPF percentage (default: 12%)
- ESI percentage (default: 0.75%)
- ESI wage ceiling (default: ₹21,000)
- SEWA percentage (default: 2%)
- LWF amounts
- Professional Tax slabs
- Working days configuration
- Late deduction rules
- WFH pay percentage

### 5. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab

### 6. Global Search & Employee 360 View
- Global search bar (Cmd+K)
- Comprehensive employee profile page
- 6 tabs: Attendance, Salary, Leaves, Payslips, Insurance, Assets

## Technical Stack
- **Frontend:** React + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + Google OAuth

## Key API Endpoints

### Salary Management APIs (NEW)
- `PUT /api/payroll/employee/{id}/salary` - Update employee salary (with approval workflow)
- `GET /api/payroll/salary-change-requests` - Get pending salary change requests
- `PUT /api/payroll/salary-change-requests/{id}/approve` - Approve salary change
- `PUT /api/payroll/salary-change-requests/{id}/reject` - Reject salary change
- `GET /api/payroll/employee/{id}/salary-history` - Get salary change history
- `GET /api/payroll/rules` - Get payroll rules
- `PUT /api/payroll/rules` - Update payroll rules (SEWA %, EPF %, etc.)

## Database Schema

### New/Updated Collections
- `employee_salaries` - Updated structure with fixed_components, deduction_config, fixed_deductions
- `salary_change_requests` - Pending approval requests
- `salary_change_history` - History of all salary changes
- `payroll_rules` - Configurable deduction percentages

## Completed Features (January 16, 2026)
1. ✅ Login fixed - admin@shardahr.com / Admin@123
2. ✅ Salary structure updated to match user's Excel format
3. ✅ Employee salary edit with all components
4. ✅ Approval workflow for salary changes
5. ✅ Salary change history tracking
6. ✅ SEWA deduction support
7. ✅ Configurable payroll rules (SEWA %, EPF %, ESI %, etc.)
8. ✅ Global Search for employees
9. ✅ Employee 360 comprehensive view
10. ✅ Attendance History with filters

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Test Employee:** EMP7A155FF6 (Test User)

## Recent Test Results
- Test iteration 20: Salary Edit Features - All 10 tests passed (100% success)
- Test iteration 19: Payroll/Attendance features - All 14 tests passed
- Test iteration 18: Global Search & Employee 360 - All 19 tests passed

## Future Tasks
1. Deploy to production
2. Biometric device integration (on hold)
3. AI-powered shift scheduling
4. Mobile application
