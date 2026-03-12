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

### Two-Step Leave Approval Flow Fix (Mar 5, 2026)
- Root cause: (1) No reporting_manager_id set on any employee, (2) departments had no head_employee_id, (3) Code mismatch between apply_leave (using dept head) and pending-approvals (using reporting_manager_id)
- Fix: apply_leave now checks reporting_manager_id first, then falls back to department head
- pending-approvals now shows leaves to both reporting managers AND department heads
- approve_leave and reject_leave recognize managers via reporting_manager_id (not just stored dept_head_id)
- Added Reporting Manager dropdown to Employee Profile edit and Employee Directory add forms
- Frontend Approvals tab now appears dynamically for any user with pending approvals (not role-gated)
- HR is notified after manager approves (two-step notification chain)
- Test: 9/9 backend + 100% frontend (iteration_46)

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

### Performance Management System Overhaul (Mar 9, 2026)
- Complete rebuild of the Performance page with employee-specific architecture
- **Backend** (`/app/backend/routes/performance.py`): 1000+ lines with 20+ API endpoints
  - MIS Templates CRUD (employee-specific daily MIS sheets)
  - MIS Entries (submit, verify, reject with manager remarks)
  - MIS Compliance tracking (who has/hasn't submitted)
  - MIS Summary aggregation (sums, averages, compliance rates by period)
  - KPI Definitions CRUD (with auto-calculation types: sum, average, compliance%, ratio%, inverse)
  - KPI Scores auto-calculation from MIS entries + manual override support
  - KRA Definitions CRUD (for senior executives and employees)
  - Evaluations CRUD (quarterly/half-yearly/annual cycles with self/manager/HR ratings)
  - Company Dashboard (department summaries, cross-department verification)
  - Manager Team endpoints (my-team, my-team-compliance, my-team-entries)
  - Seed Data endpoint (populates demo data for Accounts dept + 5 Senior Executives)
- **Frontend** broken into 7 sub-components:
  - `OverviewTab`: KPI score, MIS entries, KRA, evaluations stat cards + KPI/KRA details
  - `MisEntryTab`: Daily MIS form (number, boolean, dropdown, text fields) + entry history
  - `KpiTab`: KPI scores table with weighted score, target vs actual, source indicator
  - `EvaluationsTab`: Evaluation list, create (HR), self-assessment (employee), status tracking
  - `AdminTab`: Seed data, MIS compliance, template management, KPI/KRA definitions by employee
  - `ManagerTab`: Team compliance, MIS entry review, verify/reject workflow
  - `CompanyDashboard`: Company-wide stats, senior exec KRAs, cross-dept verification
- **DB Collections**: mis_templates, mis_entries, kpi_definitions, kpi_scores, kra_definitions, evaluations
- **Test**: 100% backend (25/25) + 100% frontend (iteration_47)

**Real Employee MIS/KPI Data Seeded (Mar 9, 2026):**
- **Awdhesh Kumar** (Store) — Quarterly MIS, 18 fields, 7 KPIs (Back Order, Stock Out, Inspection, FIFO, Utilisation, Housekeeping, Kaizen)
- **Chandan Sharma** (Sales) — Monthly MIS, 12 fields, 6 KPIs (Sales Forecast Accuracy, Order Processing, Backorder Rate, Dealer Satisfaction, Reporting Adherence, Overdue Collection)
- **Prashant Kumar Gupta** (Marketing) — Monthly MIS, 17 fields, 6 KPIs (CSR, CPL, GEM Participation, Enquiry Generation, DMS Compliance, Website CTR)
- **Rajiv Ranjan** (Purchase) — Daily MIS, 14 fields, 8 KPIs (Inventory Turnover, Material Shortages, Excess Inventory, Order Cycle Time, PO Accuracy, OTD, Supplier Defect, Cost Saving)
- **Rahul Balbhadra** (Purchase) — Daily MIS, 17 fields, 8 KPIs (same structure as Rajiv)
- 5 Senior Exec KRAs: Nandini (HR), Anup (Accounts), Manoj (Sales), Umesh (Audit), KN Sinha (Production)
- KPIs now include `scoring_rubric` and `max_marks` from the original Excel documents

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
- [x] Two-step leave approval: Employee → Manager → HR (DONE - Mar 5, 2026)
- [x] Sync from production pulls ALL collections dynamically (DONE - Feb 19, 2026)
- [x] Performance Management System Overhaul (DONE - Mar 9, 2026)

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

### Performance Insights Dashboard (Mar 9, 2026)
- Added "Insights" tab to Performance page (visible to HR/super_admin only)
- Backend API: `/api/performance/insights?period=monthly` with complex MongoDB aggregation
- Summary cards: total employees, KPIs, auto %, MIS entries, departments, red flags, manual KPIs
- Red Flag Alerts: identifies employees with no MIS submissions in last 3 days
- Department Health Overview: KPI coverage and MIS activity by department with progress bars
- MIS Compliance Heatmap: 14-day grid showing daily submission status per employee
- Executive KRA Tracker: 5 senior executives with KRA details and weights
- Employee Performance Rankings: sorted by MIS engagement and KPI coverage
- KPI Automation Summary: 104 auto-calculated, 5 manual, 95% automation rate
- Period selector (Monthly/Weekly/Quarterly) filters all insights data
- Tested: 100% backend (16/16) and frontend pass rate

### Contract Worker Template Upload/Download (Mar 10, 2026)
- Added Excel template download matching user's exact format: Sl No, Employee Code, Name, Designation, Date of Joining, Ph.no, Adhar no, Contractor name
- Added bulk export of all existing contract workers in the same template format
- Added bulk upload from Excel with smart features: auto-create contractors, duplicate detection by Employee Code, flexible date parsing, column name fuzzy matching
- Backend APIs: `GET /api/labour/workers/template/download`, `GET /api/labour/workers/export`, `POST /api/labour/workers/bulk-upload`
- Frontend: Template, Export, Upload buttons added to Contract Labour workers tab

### Work From Home (WFH) Request/Approval Flow (Mar 12, 2026)
- Full WFH request lifecycle: Apply -> Manager Approve -> HR Approve -> Auto-mark attendance as WFH
- Backend APIs: POST /api/wfh/apply, GET /api/wfh/my-requests, GET /api/wfh/pending-approvals, PUT /api/wfh/{id}/approve, PUT /api/wfh/{id}/reject, PUT /api/wfh/{id}/cancel
- Two-step approval flow mirroring leave: Manager first, then HR
- When fully approved, attendance auto-marked as 'wfh' for all dates in the range
- Frontend: "Work From Home" tab on Leave page with apply dialog (calendar date pickers), requests table, cancel button
- WFH approvals shown in Pending Approvals tab with blue styling to differentiate from leaves
- Notifications sent to manager on apply, HR after manager approval, employee on approve/reject
- Tested: 100% backend (14/14), 100% frontend pass rate

## Key Files
- `/app/backend/routes/payroll.py` - Payroll API routes + Sunday-as-leave orchestration
- `/app/backend/routes/payroll_v2.py` - Payroll calculation engine
- `/app/backend/routes/sop.py` - SOP management with role-based access
- `/app/backend/routes/data_management.py` - Data sync endpoints
- `/app/backend/routes/performance.py` - Performance Management APIs (MIS, KPI, KRA, Evaluations)
- `/app/backend/server.py` - Auth, attendance endpoints
- `/app/frontend/src/pages/PerformancePage.js` - Performance page orchestrator
- `/app/frontend/src/pages/performance/` - Sub-components (OverviewTab, MisEntryTab, KpiTab, EvaluationsTab, AdminTab, ManagerTab, CompanyDashboard, InsightsTab)
- `/app/frontend/src/pages/SOPPage.js` - SOP UI with role-based views

## Credentials
- Admin: admin@shardahr.com / password
- Employee: employee@shardahr.com / password
- Deployed sync: jai@j.com / j
