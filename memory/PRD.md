# Sharda HR - Product Requirements Document

## Original Problem Statement
A comprehensive HR management system (HRMS) for Sharda Group with features including employee management, attendance tracking, payroll, leave management, performance reviews, asset management, and more.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + MongoDB
- **Mobile**: Capacitor 6 (Android APK) — HashRouter + standard fetch (CapacitorHttp/Cookies DISABLED)
- **LLM**: OpenAI GPT-4o-mini via emergentintegrations (Thought of the Day)
- **Auth**: JWT Bearer token

## April 2026 — Mobile APK Fixes (DONE)

**Root cause chain (login failures):**
1. `CapacitorHttp` corrupts HTTP 401/403 → 200, hiding auth errors
2. `CapacitorCookies` consumes fetch response bodies, breaking `.json()` parsing
3. ~52 files used `process.env.REACT_APP_BACKEND_URL` which resolves to `undefined` in APK
4. `BrowserRouter` breaks on Android WebView reload (virtual paths vs localhost)

**Fixes applied:**
- Disabled `CapacitorHttp` and `CapacitorCookies` in `capacitor.config.json` (MUST stay false)
- Switched to `HashRouter` for Capacitor builds
- Created `src/config.js` centralizing API URL with native Capacitor fallback
- Created `.env.production` baking URL into builds
- **Refactored all 51 files** to import `API_URL`/`BACKEND_BASE` from `config.js` instead of `process.env.REACT_APP_BACKEND_URL`
- `utils/api.js`: Standard fetch wrapper, no Capacitor plugins
- `AuthContext.js`: All auth calls use `apiRequest()` via config.js URL

## Mobile App Build Steps
1. Set `REACT_APP_BACKEND_URL=https://sharda-hr-system.emergent.host` in local `.env`
2. `npm run build`
3. `npx cap sync android`
4. Android Studio → Build → Generate Signed APK

## Upcoming Tasks (P1)
- Employee Profile Popup on Org Chart
- MIS Compliance Alerts (automated notifications)
- 360 Feedback Reminders (automated nudges)

## Future/Backlog (P2-P3)
- Component splitting (AttendancePage, ContractLabourPage)
- React Hook dependency cleanup
- Fully automated payroll integration
- AI-Powered HR Chatbot, Mood Tracker, Gamification

## Credentials
- Admin: admin@shardahr.com / Sharda@2026!
- HR: hr@shardahr.com / HrAdmin@2026!
- Jai: jai@j.com / Jai@Sharda2026!
- Production Backend: https://sharda-hr-system.emergent.host
- Production Frontend: https://shardahrms.com
