# Sharda HR - Product Requirements Document

## Original Problem Statement
Comprehensive HR management system with premium UI/UX, mobile app capabilities, and full payroll management. The system manages employees, attendance (biometric + remote check-in), leave, tours, payroll, SOPs, helpdesk, and more.

## Architecture
- **Frontend**: React + Shadcn/UI, glass-morphism theme
- **Backend**: Python FastAPI + MongoDB (async via Motor)
- **Mobile**: Capacitor.js wrapper
- **Auth**: JWT token-based (Authorization: Bearer)
- **DB**: MongoDB (`test_database`)

## What's Been Implemented

### Payroll Engine v2 - CORRECTED (Feb 13, 2026)
Complete refactoring of payroll calculation engine for statutory compliance:

#### Earned Days Formula (CORRECTED)
```
Earned Days = Office Days + Paid Sundays + Paid Holidays + Paid Leave - Late Deductions
```

Where:
- **Office Days**: Days physically present at work
  - 2nd Saturday: If attended, counts as 1.0 (full day for half day work)
  - If not attended, no pay (not in office_days)
- **Paid Sundays**: Based on weekly leave rule
  - Default: All 4 Sundays paid
  - If >2 leaves in a week, that week's Sunday becomes UNPAID
- **Paid Holidays**: All company holidays (e.g., Jan 14 Makar Sankranti, Jan 26 Republic Day)
- **Paid Leave**: CL, SL, EL, ML etc. added to earned days
- **Late Deductions**: 3 lates = 1 day deducted (cumulative: 6 lates = 2 days)

#### Statutory Deductions
- **PF**: `min(12% × Earned Basic+DA, ₹15,000 max deduction)` — cap on deduction, not base
- **ESI**: `0.75% × Total Salary Earned` — only when earned ≤ ₹21,000
- **SEWA**: `2% × FIXED Basic` (not earned, not basic+DA)

#### Component Proration
Each component prorated individually: `round(Fixed / CalendarDays × EarnedDays, 2)`

### Enhanced Leave Marking (Feb 13, 2026)
When HR marks an employee as "leave" in the attendance grid:
- **Leave Type Selection**: Choose CL, SL, EL, PL, or LOP
- **Backdated Leave Request**: Option to auto-create an approved leave request
- **Balance Deduction**: Option to automatically deduct from employee's leave balance
- This ensures payroll accuracy and proper leave balance tracking

### Data Fix Utilities (Feb 13, 2026)
- **Status Normalization Endpoint**: Fixes corrupted attendance status values
  - Maps `"t"` → `"tour"`, `"new year"` → `"holiday"`, etc.
- **Bulk Import Validation**: Enhanced to prevent truncated status values
- **Dev Tools Sync**: Sync preview environment with deployed data

### Previous Implementations
- UI/UX overhaul (glass-morphism light theme)
- Token-based auth across all pages (~11 pages updated)
- Mobile app scaffolding (Capacitor)
- Two-step leave approval (Dept Head → HR)
- Compensatory Off (CO) request/approval system
- Request cancellation (leave, tour, expense)
- HR remote check-in overrides
- Remote check-in admin view
- Biometric sync integration

## Known Issues Found (Feb 13, 2026)
1. **Corrupted Attendance Status**: Some records have `status: "t"` instead of `"tour"` (from bulk import)
2. **"new year" Holiday**: Some records have `status: "new year"` instead of `"holiday"`
3. **Need to run fix on deployed**: The data fix endpoint needs to be deployed and run on production

## Prioritized Backlog

### P0 (Critical)
- [x] Payroll earned days formula fix (COMPLETED)
- [x] Enhanced leave marking with type selection (COMPLETED)
- [ ] **Deploy and run data fix on production** to fix corrupted status values
- [ ] Full E2E testing of payroll with production data after fix

### P1 (High)
- [ ] SOP role-based access fix (employees see all SOPs instead of only assigned)
- [ ] Mobile app build fix (MainActivity.java errors, Gradle config)
- [ ] Mobile location permissions (runtime permission request)
- [ ] Finalize salary logic: deduct pay for leave without balance

### P2 (Medium)
- [ ] Tour attendance daily check automation
- [ ] Full E2E testing of new workflows (leave approval, CO, cancellations)

### P2 (Medium)
- [ ] Tour attendance automated daily check
- [ ] Biometric sync error handling improvements
- [ ] ESLint warnings cleanup (react-hooks/exhaustive-deps)

### P3 (Future)
- [ ] Helpdesk Phase 2 (360° feedback, survey analytics)
- [ ] Dynamic dashboard theming (celebrations)
- [ ] Push notifications wiring
- [ ] Bulk import improvements
- [ ] Employee deduplication

## Key Files
- `/app/backend/routes/payroll_v2.py` — Payroll calculation engine
- `/app/backend/routes/payroll.py` — Payroll API routes
- `/app/backend/models/payroll.py` — Payroll data models
- `/app/frontend/src/pages/PayrollPage.js` — Payroll UI
- `/app/backend/tests/test_payroll_engine.py` — Payroll test suite (31 tests)

## Key DB Schema
- **payslips**: `{payslip_id, payroll_id, employee_id, emp_code, employee_name, fixed_components{}, attendance{}, earnings{basic_earned, da_earned, ...}, deductions{epf, esi, sewa, ...}, validation{passed, difference}, net_salary, config_used{}}`
- **payroll_runs**: `{payroll_id, month, year, status, total_employees, ...}`
- **employee_salaries**: `{employee_id, fixed_components{basic, da, hra, ...}, deduction_config{epf_applicable, esi_applicable, sewa_applicable}}`

## Credentials
- Admin: admin@shardahr.com / Admin@123 (role: super_admin)
