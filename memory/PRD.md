# Sharda HR - Product Requirements Document

## Original Problem Statement
A comprehensive HR management system (HRMS) for Sharda Group with features including employee management, attendance tracking, payroll, leave management, performance reviews, asset management, and more.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + MongoDB
- **Mobile**: Capacitor 6 (Android APK) with HashRouter + CapacitorHttp
- **LLM Integration**: OpenAI GPT-4o-mini via emergentintegrations (Thought of the Day)
- **Auth**: JWT Bearer token (no cookies/credentials:include)

## What's Been Implemented

### April 2026 — Mobile APK Complete Fix (DONE)

**4 root causes identified and fixed:**

1. **BrowserRouter → HashRouter for Capacitor**
   - `BrowserRouter` uses `pushState` — fails on WebView reload (no server fallback). HashRouter uses hash fragment → always loads `index.html`.

2. **Fetch Proxy disabled in Capacitor**
   - The `Proxy(Response)` wrapper in `index.js` broke response reading in Android WebView. Skipped in Capacitor.

3. **CapacitorHttp + CapacitorCookies ENABLED**
   - Production backend is behind Cloudflare which sets `__cf_bm` bot management cookies. WebView fetch didn't handle these properly → Cloudflare served challenge pages (200 HTML) instead of JSON API responses → parse failure → "Server error".
   - With CapacitorHttp: API calls go through Android's native HTTP client (bypasses WebView entirely)
   - With CapacitorCookies: Cloudflare cookies are managed by native cookie store

4. **AuthContext simplified + robust response parsing**
   - Removed 6 complex refs that caused race conditions. `parseRes()` tries json() → clone+text → text with diagnostic logging.

**Files modified:**
- `capacitor.config.json` — Enabled CapacitorHttp + CapacitorCookies + androidScheme
- `App.js` — Conditional HashRouter/BrowserRouter
- `AuthContext.js` — Simplified auth, robust parseRes(), better error messages
- `LoginPage.js` — Clean login flow
- `index.js` — Capacitor-aware fetch patch

## Mobile App Build Steps
1. Set `REACT_APP_BACKEND_URL=https://sharda-hr-system.emergent.host` in local `.env`
2. `npm run build`
3. `npx cap sync android`
4. Open Android Studio → Build → Generate Signed APK

## Upcoming Tasks (P1)
- Employee Profile Popup on Org Chart
- MIS Compliance Alerts (automated notifications)
- 360 Feedback Reminders (automated nudges)

## Future/Backlog (P2-P3)
- Component splitting (AttendancePage, ContractLabourPage)
- React Hook dependency cleanup
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
