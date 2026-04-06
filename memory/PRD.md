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
- MIS Compliance Redesign, Contract Worker Biometric, Stationery Inventory
- LLM-Powered Thought of the Day, Searchable Employee Dropdown
- Global CORS Fix, Global Fetch Patch, Login Fix (single call)
- SEWA Advance Bulk Upload, Asset Employee List Fix
- Sidebar Navigation Grouping, Org Chart Redesign, Code Quality Fixes

### Security Hardening (March 2026)
- Security Headers, Rate Limiting, IP Blocking
- Strong Password Policy, Account-Level Lockout, JWT 24hr Expiry
- Token Invalidation on Password Change, Security Audit Logging
- Frontend Password Requirements UI, Admin Security Dashboard

### April 2026 — Mobile APK Login Fix (COMPLETE)
**Root cause**: Global fetch Proxy in `index.js` wrapped Response objects for emergent-main.js compatibility. In Android WebView (Capacitor), the Proxy broke `response.clone()` chain → `safeParseJson` returned null → "Invalid login response" error.

**Fixes applied:**
1. **`index.js`**: Skip fetch Proxy in Capacitor (`window.Capacitor?.isNativePlatform?.()` check)
2. **`AuthContext.js`**: `safeParseJson` now tries `response.json()` directly first (works in WebView), falls back to clone+text only if needed
3. **`AuthContext.js`**: Login validates response before proceeding; `refreshToken` doesn't immediately logout on 401 if token exists; `justLoggedInRef` skips post-login refresh race condition
4. **`LoginPage.js`**: `setTimeout(100ms)` + `replace: true` for navigation; validates user+token before redirect
5. **`backend/.env`**: Added `https://localhost`, `capacitor://localhost`, `http://localhost` to CORS_ORIGINS
6. **`capacitor.config.json`**: Added `androidScheme: "https"` for consistent WebView origin

## Key Technical Decisions
1. **Pure Bearer Token Auth**: No `credentials: 'include'` anywhere. All auth via `Authorization: Bearer <token>` header.
2. **Custom CORS Middleware**: `CORSEverythingMiddleware` in server.py handles CORS at application level.
3. **Conditional Fetch Patch**: `index.js` patches `window.fetch` with Proxy ONLY on web (skips Capacitor). Prevents body-already-read errors from platform interceptor without breaking mobile WebView.
4. **APK Bundled Assets**: No `server.url` in capacitor.config.json. APK bundles frontend locally.
5. **Mobile Login Safety**: `justLoggedInRef` prevents race condition; `safeParseJson` uses direct json() first.

## Deferred Code Quality Items
- **React Hook Dependencies**: 85 instances
- **Component Splitting**: AttendancePage (1614), ContractLabourPage (1386), AssetsPage (1043), Dashboard (923 lines)
- **Function Complexity**: 331 flagged functions
- **Nested Ternaries**: 295 instances

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
