# Sharda HR - Product Requirements Document

## Original Problem Statement
A comprehensive HR management system (HRMS) for Sharda Group with features including employee management, attendance tracking, payroll, leave management, performance reviews, asset management, and more.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + MongoDB
- **Mobile**: Capacitor 6 (Android APK) — HashRouter + CapacitorHttp (native HTTP)
- **LLM**: OpenAI GPT-4o-mini via emergentintegrations (Thought of the Day)
- **Auth**: JWT Bearer token

## April 2026 — Mobile APK Definitive Fix (DONE)

**Root cause chain:**
1. Production backend behind Cloudflare → sets `__cf_bm` bot management cookie
2. Capacitor WebView's `fetch` doesn't handle Cloudflare cookies properly
3. Cloudflare serves HTML challenge pages (200 status) instead of JSON API responses
4. `response.json()` / `response.clone().text()` fails on HTML → parse returns null
5. Login code sees `data = null` → "Server error" / "Unexpected server response"

**Definitive solution — Universal API Client (`utils/api.js`):**
- **Capacitor native**: Uses `CapacitorHttp.request()` directly from `@capacitor/core`. This calls Android's native HTTP client (OkHttp). No WebView, no CORS, no fetch, no Response objects. Response data is already parsed.
- **Web browser**: Uses standard `fetch` with robust clone+text→json parsing.
- **AuthContext.js**: All auth calls (`login`, `register`, `me`, `refresh`, `logout`) use `apiRequest()` — zero direct `fetch` calls.

**Supporting changes:**
- `App.js`: HashRouter for Capacitor (survives WebView reload), BrowserRouter for web
- `index.js`: Fetch Proxy skipped in Capacitor
- `capacitor.config.json`: CapacitorHttp=true, CapacitorCookies=true, androidScheme=https
- `AndroidManifest.xml`: Added ACCESS_NETWORK_STATE, networkSecurityConfig
- `network_security_config.xml`: HTTPS-only for production domains

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
