# Sharda HR - Product Requirements Document

## Original Problem Statement
A comprehensive HR management system (HRMS) for Sharda Group with features including employee management, attendance tracking, payroll, leave management, performance reviews, asset management, and more.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + MongoDB
- **Mobile**: Capacitor 6 (Android APK) with HashRouter
- **LLM Integration**: OpenAI GPT-4o-mini via emergentintegrations (Thought of the Day)
- **Auth**: JWT Bearer token (no cookies/credentials:include)

## What's Been Implemented

### Session 1-N (Previous Sessions)
- Full employee CRUD, attendance, payroll, leave, performance management
- Biometric sync, org chart, helpdesk, SOPs, training, tour management
- Bulk import/export, announcements, meetings, calendar
- MIS compliance, contract labour management, assets management
- 360 feedback, salary structures, one-time deductions, payroll rules

### March 2026
- MIS Compliance Redesign, Contract Worker Biometric, Stationery Inventory
- LLM Thought of the Day, Searchable Employee Dropdown, Global CORS Fix
- SEWA Advance Bulk Upload, Sidebar Grouping, Org Chart Redesign, Code Quality

### Security Hardening (March 2026)
- Security Headers, Rate Limiting, IP Blocking, Strong Password Policy
- Account Lockout, JWT 24hr Expiry, Token Invalidation, Audit Logging

### April 2026 — Mobile APK Complete Rewrite (DONE)
**Root causes identified and fixed:**

1. **BrowserRouter in Capacitor → HashRouter**
   - `BrowserRouter` uses `history.pushState` to navigate (e.g., `/dashboard`). When Android WebView reloads (background/memory pressure), it tries to load `https://localhost/dashboard` — which doesn't exist as a file. Result: blank page.
   - Fix: `App.js` now detects Capacitor native (`window.Capacitor.isNativePlatform()`) and uses `HashRouter`. URLs become `/#/dashboard` — the WebView always loads `index.html` and React handles the hash route.

2. **Fetch Proxy breaking Android WebView**
   - `index.js` wrapped all fetch responses in a `Proxy` (needed for Emergent platform's analytics interceptor). In Capacitor's WebView, the Proxy interfered with `Response.clone()` and body reading.
   - Fix: The fetch Proxy now skips entirely in Capacitor native. Mobile fetch works directly.

3. **AuthContext race conditions**
   - Complex ref chains (`authCheckInProgress`, `initialCheckDone`, `justLoggedInRef`, `isRefreshing`, `lastActivityRef`) created race conditions where `refreshToken` could fire immediately after login and log the user out.
   - Fix: Complete rewrite with minimal state. One `useEffect` for initial auth check, one for refresh interval. `parseRes()` with 3-strategy fallback (clone+text → json → text) works in all environments.

**Files rewritten from scratch:**
- `App.js` — Conditional HashRouter/BrowserRouter
- `AuthContext.js` — Simplified auth with robust response parsing
- `LoginPage.js` — Clean login flow
- `index.js` — Capacitor-aware fetch patch

## Key Technical Decisions
1. **Pure Bearer Token Auth**: No `credentials: 'include'`. All auth via `Authorization: Bearer <token>`.
2. **Conditional Router**: HashRouter for Capacitor (survives WebView reload), BrowserRouter for web (clean URLs).
3. **Conditional Fetch Patch**: Proxy only on web (for platform interceptor). Skipped in Capacitor.
4. **3-Strategy Response Parsing**: `parseRes()` tries clone+text → direct json → direct text. Works with Proxy, without Proxy, and in WebView.
5. **No Immediate Token Refresh**: Token refresh runs on interval only, never immediately after login. Prevents race conditions.

## Mobile App Setup
- **Capacitor 6** with `androidScheme: "https"` (serves from `https://localhost`)
- **Geolocation**: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` in AndroidManifest. Capacitor Geolocation plugin in `nativeServices.js`.
- **Build steps**: `npm run build` → `npx cap sync android` → Android Studio Build
- **REACT_APP_BACKEND_URL** must point to production backend in local `.env` before build

## Upcoming Tasks (P1)
- Employee Profile Popup on Org Chart
- MIS Compliance Alerts (automated notifications)
- 360 Feedback Reminders (automated nudges)

## Future/Backlog (P2-P3)
- Component splitting (AttendancePage, ContractLabourPage)
- React Hook dependency cleanup (85 instances)
- Fully automated payroll integration
- AI-Powered HR Chatbot
- Employee Mood Tracker
- Gamification & Recognition Wall

## Credentials
- Admin: admin@shardahr.com / Sharda@2026!
- HR: hr@shardahr.com / HrAdmin@2026!
- Jai: jai@j.com / Jai@Sharda2026!
- Production Backend: https://sharda-hr-system.emergent.host
- Production Frontend: https://shardahrms.com
