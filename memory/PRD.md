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

### Payroll Engine v2 - FINAL (Feb 13, 2026)
Complete refactoring of payroll calculation engine for statutory compliance:

#### Earned Days Formula
```
Earned Days = Office Days + Paid Sundays + Paid Holidays + Paid Leave Days
            + (WFH Days × WFH%) + (Half Days × 0.5)
            - Late Deduction Days
```

#### Sunday-as-Leave Rule (IMPLEMENTED Feb 13, 2026)
- If employee takes >2 leaves in a week (Mon-Sun), that week's Sunday is converted to a leave day
- System creates a `leave_request` record for audit trail (`is_system_generated: true`)
- Leave balance deducted following priority: **EL → CL → SL** (leave_type_ids: `lt_el → lt_cl → lt_sl`)
- If no balance available, Sunday becomes **LOP** (Loss of Pay)
- Balance reads from `available` field in `leave_balances` collection

#### Status Normalization (IMPLEMENTED Feb 13, 2026)
On-the-fly normalization during payroll processing:
- `"t"` → `"tour"` (counted as present/office day)
- `"new year"` → `"holiday"` (not counted as absent)
- `"p"` → `"present"`, `"a"` → `"absent"`, etc.

#### Statutory Deductions
- **PF**: `min(12% × Earned Basic+DA, ₹15,000 max deduction)` — cap on deduction, not base
- **ESI**: `0.75% × Total Salary Earned` — only when earned ≤ ₹21,000
- **SEWA**: `2% × FIXED Basic` (not earned, not basic+DA)

#### Component Proration
Each component prorated individually: `round(Fixed / CalendarDays × EarnedDays, 2)`

#### Legacy Salary Format Support (ADDED Feb 13, 2026)
Payroll engine now handles both:
- Full `fixed_components` structure (basic, da, hra, conveyance, grade_pay, other_allowance, medical_allowance)
- Flat format (`gross_salary`, `basic_salary`) with automatic component estimation

### Data Sync & Fixes (Feb 13, 2026)
- Re-synced `employee_salaries` with full `fixed_components` from deployed
- Re-synced `leave_balances` (201 records) 
- Jan 1 (New Year) added as holiday alongside existing Jan 14 and Jan 26
- Admin password reset to `Admin@123`

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
- Enhanced manual leave marking with type selection
- Dev Tools data sync feature

## Testing Status
- **Payroll Engine**: 21/21 backend tests passed (Feb 13, 2026)
- Test file: `/app/backend/tests/test_payroll_sunday_rule.py`
- Verified: Manoj Kumar (S0013) — office=11, sundays=4, holidays=3, leave=1, earned=19

## Prioritized Backlog

### P0 (Critical)
- [x] Payroll "Sunday as leave" rule implementation (COMPLETED)
- [x] Status normalization in payroll (COMPLETED)
- [x] Jan 1 holiday addition (COMPLETED)
- [x] Leave balance priority order fix (lt_el/lt_cl/lt_sl) (COMPLETED)
- [x] Leave balance field fix (available, not balance) (COMPLETED)
- [ ] **Data completeness**: Preview attendance data only has ~16/31 records for Manoj Kumar. Production has more. Need to investigate deployed attendance data completeness for accurate payroll verification.

### P1 (High)
- [ ] SOP role-based access fix (employees see all SOPs instead of only assigned)
- [ ] Mobile app build fix (MainActivity.java errors, Gradle config)
- [ ] Mobile location permissions (runtime permission request)
- [ ] Full E2E testing of new workflows (leave approval, CO, cancellations)

### P2 (Medium)
- [ ] Tour attendance daily check automation
- [ ] Biometric sync error handling improvements
- [ ] ESLint warnings cleanup (react-hooks/exhaustive-deps)
- [ ] Frontend routing bug (/payroll occasionally shows dashboard)

### P3 (Future)
- [ ] Helpdesk Phase 2 (360° feedback, survey analytics)
- [ ] Dynamic dashboard theming (celebrations)
- [ ] Push notifications wiring
- [ ] Bulk import improvements
- [ ] Employee deduplication

## Key Files
- `/app/backend/routes/payroll.py` — Payroll API routes + Sunday-as-leave orchestration
- `/app/backend/routes/payroll_v2.py` — Payroll calculation engine
- `/app/backend/routes/data_management.py` — Data sync endpoints
- `/app/backend/server.py` — Auth, attendance edit endpoints
- `/app/frontend/src/pages/PayrollPage.js` — Payroll UI
- `/app/backend/tests/test_payroll_sunday_rule.py` — Payroll test suite

## Key DB Schema
- **employee_salaries**: `{salary_id, employee_id, fixed_components{basic, da, hra, conveyance, grade_pay, other_allowance, medical_allowance}, total_fixed, deduction_config{epf_applicable, esi_applicable, sewa_applicable}, is_active}`
- **payslips**: `{payslip_id, payroll_id, employee_id, fixed_components{}, attendance{office_days, paid_sundays, paid_holidays, paid_leave_days, total_earned_days, ...}, earnings{}, deductions{epf, esi, sewa}, validation{passed, difference}}`
- **leave_balances**: `{employee_id, leave_type_id, available, used, year}`
- **leave_requests**: `{leave_request_id, employee_id, leave_type_id, is_system_generated, generation_rule}`
- **holidays**: `{holiday_id, date, name, type, is_half_day}`

## Credentials
- Admin: admin@shardahr.com / Admin@123 (role: super_admin)
- Deployed: jai@j.com / j
