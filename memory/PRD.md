# Sharda HR - Product Requirements Document

## Original Problem Statement
A comprehensive HR management system (HRMS) for Sharda Group with features including employee management, attendance tracking, payroll, leave management, performance reviews, asset management, and more.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + MongoDB
- **Mobile**: Capacitor (Android APK)
- **LLM Integration**: OpenAI GPT-4o-mini via emergentintegrations (Thought of the Day)
- **Auth**: JWT Bearer token (no cookies/credentials:include)

## What's Been Implemented

### Session 1-N (Previous Sessions)
- Full employee CRUD, attendance, payroll, leave, performance management
- Biometric sync, org chart, helpdesk, SOPs, training, tour management
- Bulk import/export, announcements, meetings, calendar
- MIS compliance, contract labour management, assets management
- 360 feedback, salary structures, one-time deductions, payroll rules

### March 2026 Session
- **MIS Compliance Redesign**: Revamped UI with tabs and date navigator
- **Contract Worker Biometric Attendance**: Auto-sync via biometric API
- **Stationery Inventory Management**: Full CRUD under Assets page
- **LLM-Powered Thought of the Day**: Dynamic daily quote modal
- **Searchable Employee Dropdown**: In asset/stationery dialogs
- **Global CORS Fix**: Custom CORSEverythingMiddleware for all environments
- **Global Fetch Patch**: Proxy-based fix for "body stream already read" errors
- **Login Fix**: Single login call (eliminated double fetch)
- **SEWA Advance Bulk Upload**: Template download + bulk upload with validation
- **Asset Employee List Fix**: Removed 50-employee limit, now returns all employees
- **Sidebar Navigation Grouping**: Organized 17+ flat items into labeled sections
- **Org Chart Redesign**: Modern animated tree with depth-colored nodes
- **Code Quality Fixes**: eval() removal, secret migration, circular import fix

### Security Hardening (March 2026)
- Security Headers, Rate Limiting, IP Blocking
- Strong Password Policy (8+ chars, upper/lower/number/special)
- Account-Level Lockout (30 min after 5 failed attempts)
- JWT Token Expiry reduced to 24 hours
- Token Invalidation on Password Change
- Security Audit Logging
- Frontend Password Requirements UI
- Admin Security Dashboard

### April 2026 - Mobile Login Fix
- **Fixed mobile app login redirect failure** (login showed "successful" but didn't open dashboard)
  - Root cause: `refreshToken()` fired immediately after login, causing race condition in Capacitor WebView
  - Added `justLoggedInRef` flag to skip immediate token refresh after login
  - Hardened `refreshToken` to not clear user state on 401 if token exists in localStorage
  - Added `setTimeout(100ms)` for navigate to ensure React state flush before routing
  - Added response validation (checks for user + token before navigating)
  - Added `replace: true` to navigate to prevent back-button returning to login

## Key Technical Decisions
1. **Pure Bearer Token Auth**: No `credentials: 'include'` anywhere. All auth via `Authorization: Bearer <token>` header.
2. **Custom CORS Middleware**: `CORSEverythingMiddleware` in server.py handles CORS at application level.
3. **Global Fetch Patch**: `index.js` patches `window.fetch` with Proxy to prevent body-already-read errors.
4. **APK Bundled Assets**: Removed `server.url` from capacitor.config.json. APK bundles frontend locally.
5. **Mobile Login Safety**: `justLoggedInRef` prevents race condition where token refresh could log user out immediately after login.

## Deferred Code Quality Items
- **React Hook Dependencies**: 85 instances — needs case-by-case analysis
- **Component Splitting**: AttendancePage (1614 lines), ContractLabourPage (1386 lines), AssetsPage (1043 lines), Dashboard (923 lines)
- **Function Complexity**: 331 flagged functions
- **Nested Ternaries**: 295 instances across frontend
- **useMemo Optimization**: 81 instances
- **Unused Imports**: 66+ files

## Upcoming Tasks (P1)
- Employee Profile Popup on Org Chart
- MIS Compliance Alerts (automated notifications)
- 360 Feedback Reminders (automated nudges)

## Future/Backlog (P2-P3)
- Fully automated payroll integration
- AI-Powered HR Chatbot
- Employee Mood Tracker
- Gamification & Recognition Wall

## Key Collections (MongoDB)
- `employees`, `attendance`, `payroll_runs`, `salary_structures`
- `sewa_advances`, `stationery_items`, `stationery_transactions`
- `daily_thoughts`, `contract_worker_attendance`, `security_audit_log`

## Credentials
- Admin: admin@shardahr.com / Sharda@2026!
- HR: hr@shardahr.com / HrAdmin@2026!
- Jai: jai@j.com / Jai@Sharda2026!
- All other 94 flagged users: temp password `Sharda@2026!` (must change on login)
- Production Backend: https://sharda-hr-system.emergent.host
- Production Frontend: https://shardahrms.com
