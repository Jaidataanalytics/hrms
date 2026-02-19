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
            + (WFH Days x WFH%) + (Half Days x 0.5)
            - Late Deduction Days
```

#### Sunday-as-Leave Rule
- If employee takes >2 leaves in a week (Mon-Sun), that week's Sunday is converted to a leave day
- System creates a `leave_request` record for audit trail (`is_system_generated: true`)
- Leave balance deducted following priority: **EL -> CL -> SL** (leave_type_ids: `lt_el -> lt_cl -> lt_sl`)
- If no balance available, Sunday becomes **LOP** (Loss of Pay)
- Balance reads from `available` field in `leave_balances` collection

#### Status Normalization
On-the-fly normalization during payroll processing:
- `"t"` -> `"tour"` (counted as present/office day)
- `"new year"` -> `"holiday"` (not counted as absent)

#### Statutory Deductions
- **PF**: `min(12% x Earned Basic+DA, 15000 max deduction)`
- **ESI**: `0.75% x Total Salary Earned` only when earned <= 21000
- **SEWA**: `2% x FIXED Basic` (not earned, not basic+DA)

### SOP Role-Based Access Fix (Feb 13, 2026)
- Fixed /my-sops endpoint that was showing ALL SOPs to employees
- Removed catch-all condition matching SOPs with empty assignment arrays
- Employees now only see SOPs assigned via: main_responsible, also_involved, designation, or department
- Admin /list endpoint unchanged (shows all SOPs)

### Code Quality Improvements (Feb 13, 2026)
- Fixed bare `except` clauses in server.py (4 instances) and bulk_import.py (2 instances)
- Changed to `except Exception:` or `except (ValueError, TypeError):`

### Biometric Employee Code Feature (Feb 13, 2026)
- Added `emp_code` to `EmployeeCreate` model so HR can set biometric code during manual employee creation
- Added "Biometric Code" input field to Add Employee dialog (EmployeeDirectory.js)
- Added "Biometric Code" input field to Edit Employee dialog (EmployeeProfile.js)
- Field is optional, with placeholder "e.g. F0001, S0019" and helper text

### Celebration Dashboard Theming (Feb 13, 2026)
- Enhanced CSS for celebration-based dashboard theming (birthday, work anniversary, marriage anniversary, custom events)
- Added themed backgrounds to stat-cards, dashboard-welcome section, and quick-action-card
- Added `dashboard-welcome` class to Dashboard welcome section, `quick-action-card` class to quick actions card
- Themes include: amber/gold (birthday), blue/indigo (work anniversary), rose/pink (marriage anniversary), emerald/teal (custom)

### Biometric Sync & Late Deadline Update (Feb 13, 2026)
- Biometric API sync: every 3 hours (IntervalTrigger) + mandatory daily at 10:00 AM IST (CronTrigger hour=4 minute=30 UTC)
- Manual sync options remain available on the Biometric page
- Updated late threshold display on BiometricPage to 10:00 AM

### Mobile Check-in/Check-out Time Fix (Feb 14, 2026)
- Fixed wrong time recording: was using UTC, now uses IST (UTC+5:30) for punch times and dates
- Affected: /api/attendance/mark endpoint - `today` date and `now_time` punch time now use IST

### Biometric Sync Missing Punch-Out Fix (Feb 19, 2026)
- Root cause: The old sync processed records one-by-one and used flawed direction logic that converted all morning "out" punches to "IN" (before-noon = IN override)
- Fix: Rewrote sync to batch all API records by employee+date, sort by time, then assign first punch = IN, last punch = OUT
- New `update_attendance_batch` function replaces old per-record approach, merges with manual punches, de-duplicates
- Result: Feb 14 went from 0% punch-out coverage to 93% (remaining are genuine single-punch employees)
- Re-synced Feb 1-19: 930 records corrected with 0 errors

### User Role Change Bug Fix (Feb 19, 2026)
- Root cause: Roles list endpoint returned both hardcoded roles (`hr_admin`) and DB roles (`role_9ac26a10a22a` with `code: "hr_admin"`). When admin selected the DB-based role, the user's `role` field was set to the UUID-based ID, which the frontend didn't recognize as `hr_admin`
- Fix: Roles list now always returns canonical role IDs (hr_admin, employee, etc.)
- Also fixed password field consistency in create/reset/change password endpoints (write to both `password` and `password_hash`)
- Added "Link to Employee" dropdown in Add User form for easy user account creation from existing employees
- Fixed "Failed to update user status" — missing auth headers in handleToggleStatus
- Fixed "Failed to delete user" — missing auth headers in handleDeleteUser
- Fixed "Deleted users still showing" — changed delete to permanent (delete_one) instead of soft delete (email mangling)
- Excluded `password` field from user list API response

### Training Program Management (Feb 13, 2026)
- Added Edit and Delete buttons for training programs (pencil/trash icons on program cards)
- Added program detail dialog showing enrolled employees with enrollment dates and status
- Added ability to add employees to a training program from the detail dialog
- Added ability to remove employees from a training program
- Backend: Added DELETE /api/training/enrollments/{enrollment_id} endpoint
- Full CRUD for training programs with role-based access (HR/Admin only)

### SEWA Advance Calculation Bug Fix (Feb 19, 2026)
- Root cause 1: Payroll engine didn't check `start_month`/`start_year` before applying SEWA advance deduction — advances were deducted before their start date
- Root cause 2: When payroll was deleted and re-run, SEWA advance `total_paid` accumulated without reversal (4 re-runs × ₹5,000 = ₹20,000 for Rudra)
- Fix 1: Added start_month/year gate in `payroll_v2.py` — advance only deducts when `current month >= start month`
- Fix 2: Added SEWA advance reversal in `delete_payroll_run` in `payroll.py` — deleting payroll now reverses advance tracking
- Data fix: Reset Rudra (EMP31088E46) and Rahul (EMP2CD56E12) SEWA advance records to correct state

### Complete Sync from Production Fix (Feb 19, 2026)
- Root cause: `SYNC_COLLECTIONS` was hardcoded to ~15 collections while the DB has 68+ collections
- Fix: Replaced static dict with dynamic `get_all_collection_names()` that queries `db.list_collection_names()` at runtime
- `export-all` now exports ALL collections dynamically
- Added `import-all` endpoint for bulk data import
- `sync/from-deployed` now uses export-all approach for comprehensive sync instead of per-endpoint fetching
- Frontend Dev Tools tab updated: shows "Pull Data from Production" with live collection count, clearer labels
- Test: 17/17 backend + 100% frontend (iteration_45)

### Previous Implementations
- UI/UX overhaul (glass-morphism light theme)
- Token-based auth across all pages
- Mobile app scaffolding (Capacitor)
- Two-step leave approval (Dept Head -> HR)
- Compensatory Off (CO) request/approval system
- Request cancellation (leave, tour, expense)
- HR remote check-in overrides
- Biometric sync integration
- Enhanced manual leave marking with type selection
- Dev Tools data sync feature
- Data sync from deployed environment
- Tour attendance daily check (dashboard alert)

## Testing Status
- **Payroll Engine**: 21/21 backend tests passed (iteration_39)
- **SOP Visibility**: 11/11 tests passed - backend + frontend (iteration_40)
- **Employee Biometric Code + Celebration Theming**: 100% pass rate backend (7/7) + frontend (iteration_41)
- **Training CRUD + Employee Status + Biometric Schedule**: 100% pass rate backend (15/15) + frontend (iteration_42)
- **User Management Bug Fixes**: 100% pass rate backend (8/8) + frontend (iteration_43)
- Test files: `/app/backend/tests/test_payroll_sunday_rule.py`, `/app/backend/tests/test_sop_visibility.py`, `/app/backend/tests/test_emp_code_biometric.py`, `/app/backend/tests/test_training_employee_features.py`

## Prioritized Backlog

### P0 (Critical)
- [x] Payroll "Sunday as leave" rule (DONE)
- [x] Status normalization (DONE)
- [x] Jan 1 holiday addition (DONE)
- [x] Leave balance priority/field fixes (DONE)
- [x] SOP visibility fix (DONE)
- [x] Biometric employee code in manual employee creation & edit (DONE - Feb 13, 2026)
- [x] Sync from production pulls ALL collections dynamically (DONE - Feb 19, 2026)

### P1 (High)
- [x] Dynamic dashboard celebration theming (DONE - Feb 13, 2026)
- [ ] Full E2E testing of leave approvals, CO requests, cancellations
- [ ] Mobile app build fix (MainActivity.java + Gradle config)
- [ ] Mobile location permissions

### P2 (Medium)
- [x] ESLint bare-except cleanup (DONE)
- [ ] Tour attendance automation (backend exists, needs scheduler)
- [ ] Biometric sync error handling improvements
- [ ] Frontend routing bug (/payroll occasionally shows dashboard - intermittent, no repro)
- [ ] React hooks exhaustive-deps warnings

### P3 (Future)
- [ ] Helpdesk Phase 2 (360 feedback, survey analytics)
- [ ] Push notifications wiring
- [ ] Bulk import improvements
- [ ] Employee deduplication

## Key Files
- `/app/backend/routes/payroll.py` - Payroll API routes + Sunday-as-leave orchestration
- `/app/backend/routes/payroll_v2.py` - Payroll calculation engine
- `/app/backend/routes/sop.py` - SOP management with role-based access
- `/app/backend/routes/data_management.py` - Data sync endpoints
- `/app/backend/server.py` - Auth, attendance endpoints
- `/app/frontend/src/pages/SOPPage.js` - SOP UI with role-based views

## Credentials
- Admin: admin@shardahr.com / Admin@123
- Employee: employee@shardahr.com / Admin@123
- Deployed sync: jai@j.com / j
