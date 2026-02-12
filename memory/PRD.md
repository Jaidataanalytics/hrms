# Sharda HR - Product Requirements Document

## Authentication
- Admin: admin@shardahr.com / Admin@123 | Employee: employee@shardahr.com / Employee@123

## Tech Stack
- Frontend: React, TailwindCSS, Shadcn/UI, Framer Motion, Capacitor 6
- Backend: FastAPI, Motor (async MongoDB)
- Mobile: Capacitor (Android WebView), Firebase FCM ready

---

## Implemented (Feb 12, 2026)

### Bug Fixes
- **Expense receipt upload** — was non-functional div, now has actual file input with base64 upload
- **Remote check-in data mismatch** — Dashboard sent `location.lat/lng`, backend expected `latitude/longitude` — fixed
- **Meeting notifications** — looked up `user_id` on employee record (doesn't exist), now correctly looks up users collection by `employee_id`
- **Task assignment notifications** — added notification to assignee when task is created by someone else
- **Payroll hidden from employees** — removed from employee sidebar, HR-only

### Two-Step Leave Approval (Dept Head → HR)
- Leave applications now route to department head first, then HR
- `dept_head_status` and `hr_status` tracked separately
- Notifications sent to dept head on application

### Compensatory Off (CO) System
- `POST /api/co-requests` — Employee requests CO for worked weekends/holidays
- Two-step approval (dept head → HR)
- On HR approval, CO days auto-added to leave balance
- Cancel own pending CO requests

### Employee Cancel/Edit Pending Requests
- `PUT /api/leave/{id}/cancel` — Cancel pending leave
- `PUT /api/leave/{id}/edit` — Edit pending leave (dates, reason)
- `PUT /api/travel/requests/{id}/cancel` — Cancel pending tour
- `PUT /api/expenses/{id}/cancel` — Cancel pending expense

### HR Remote Check-in Override
- `POST /api/travel/remote-checkin-override` — Allow check-in for employee(s) or department for a day
- Integrated into remote check-in eligibility check
- Shows in `my-active-tour` status

### Auto User Creation on Employee Add
- Single employee creation now auto-creates user with `Welcome@123` default password
- `must_change_password: true` forces password change on first login

### Previous: Mobile bottom nav, Capacitor setup, Glass-morphism UI, Helpdesk Phase 2, etc.

---

## Still Pending (Next Session)
### P0
- [ ] **Login fix for asmbihar@shardadiesels.in** — user not in DB, needs re-import
- [ ] **Frontend UI for CO requests** — backend done, need page/tab in Leave section
- [ ] **Frontend UI for cancel/edit buttons** on leave, tour, expense pages
- [ ] **Frontend UI for HR remote override** in Tour Management page
- [ ] **Salary calculation fixes** — tour days count as present, LOP deduction for no-balance leaves
- [ ] **Tour attendance popup** — daily check for unrecorded tour attendance

### P1
- [ ] Wire push notifications into event handlers
- [ ] Admin "Unknown" name in meeting analytics
- [ ] HelpdeskPage.js refactoring
