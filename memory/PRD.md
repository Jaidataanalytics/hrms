# Sharda HR - Product Requirements Document

## Authentication
- Admin: admin@shardahr.com / Admin@123

## What's Been Implemented (as of Feb 12, 2026)

### Batch 3 — Salary, Tour Attendance, Leave Display
- **Tour attendance daily check** — Backend: `/api/travel/tour-attendance-check` finds tour/field employees without check-in. `/api/travel/mark-tour-attendance` lets HR mark them present/absent. Dashboard shows alert card for HR.
- **Two-step leave approval display** — Leave request cards now show dept head and HR approval status with colored pills
- **Salary calculation confirmed** — tour days already count as present (line 313), LOP/absent as unpaid (line 326)

### Batch 2 — Frontend UI
- CO Request system (Leave page tab + dialog)
- Cancel buttons on leave, tour, expense (pending only)
- HR Remote Check-in Override UI (Tour Management "Daily Override" tab)
- Holiday calendar off-by-one fix (timezone)
- Events name lookup fix (emp_code + employee_id)
- Excel serial date conversion in bulk upload

### Batch 1 — Backend Features
- Two-step leave approval (dept head → HR)
- CO system with two-step approval
- Cancel/edit pending requests
- HR remote check-in overrides
- Meeting/task notifications fixed
- Expense receipt upload fixed
- Remote check-in data format fixed
- Payroll hidden from employees

### Previous
- Mobile bottom nav, Capacitor setup, Glass-morphism UI
- Helpdesk Phase 2, Employee celebrations, Attendance fixes, etc.

---

## Pending
### P0
- [ ] `asmbihar@shardadiesels.in` — re-import employee
### P1  
- [ ] Wire push notifications
- [ ] HelpdeskPage.js refactoring
### P2
- [ ] Bulk import improvements
- [ ] Employee deduplication
