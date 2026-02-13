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

### Payroll Engine v2 (Feb 13, 2026)
Complete refactoring of payroll calculation engine for statutory compliance:
- **PF**: `min(12% × Earned Basic+DA, ₹15,000 max deduction)` — cap on deduction, not base
- **ESI**: `0.75% × Total Salary Earned` — only when earned ≤ ₹21,000 (eligibility on earned gross)
- **SEWA**: `2% × FIXED Basic` (not earned, not basic+DA)
- **Component Proration**: Each component individually: `round(Fixed / CalendarDays × EarnedDays, 2)`
- **Late Deduction**: 3 lates = 1 day reduction from earned days (cumulative)
- **2nd Saturday**: Half working day but FULLY PAID — unattended 2nd Saturdays add 1.0 earned day
- **Earned Days**: `Office + Paid Sundays + Paid Holidays + Paid Leave + WFH×50% + 2ndSat(unattended) - LateDedDays`, capped at calendar days
- **Separate Basic & DA**: Split into individual earned components in payslip and export
- **Validation**: `|Net - (Earned - Deductions)| ≤ ₹0.01`, triggers alert on mismatch
- **Excel Export**: 34 columns including Basic(Earned), DA(Earned), Late Count, Late Deduction Days, Validation
- **Audit Trail**: Each payslip stores `config_used` with all rates used

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

## Prioritized Backlog

### P0 (Critical)
- [ ] SOP role-based access fix (employees see all SOPs instead of only assigned)
- [ ] Full E2E testing of new workflows (leave approval, CO, cancellations)

### P1 (High)
- [ ] Mobile app build fix (MainActivity.java errors, Gradle config)
- [ ] Mobile location permissions (runtime permission request)
- [ ] Finalize salary logic: deduct pay for leave without balance

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
