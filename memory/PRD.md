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

### Latest Session (March 2026)
- **MIS Compliance Redesign**: Revamped UI with tabs and date navigator
- **Contract Worker Biometric Attendance**: Auto-sync via biometric API
- **Stationery Inventory Management**: Full CRUD under Assets page
- **LLM-Powered Thought of the Day**: Dynamic daily quote modal
- **Searchable Employee Dropdown**: In asset/stationery dialogs
- **Global CORS Fix**: Custom CORSEverythingMiddleware for all environments
- **Global Fetch Patch**: Proxy-based fix for "body stream already read" errors
- **Login Fix**: Single login call (eliminated double fetch)
- **SEWA Advance Bulk Upload**: Template download + bulk upload with validation (March 31, 2026)

## Key Technical Decisions
1. **Pure Bearer Token Auth**: No `credentials: 'include'` anywhere. All auth via `Authorization: Bearer <token>` header.
2. **Custom CORS Middleware**: `CORSEverythingMiddleware` in server.py handles CORS at application level, works in all environments.
3. **Global Fetch Patch**: `index.js` patches `window.fetch` with Proxy to prevent body-already-read errors from platform interceptors.
4. **APK Bundled Assets**: Removed `server.url` from capacitor.config.json. APK bundles frontend code locally, doesn't depend on production deployment.

## Pending Issues
- **P2**: Mobile APK build process (user building locally, guided step-by-step)
- **P2**: Frontend Routing Bug on `/payroll` page (intermittent)
- **P3**: Frontend ESLint Warnings

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
- `sewa_advances` (with `source: 'bulk_upload'` for bulk-uploaded ones)
- `stationery_items`, `stationery_transactions`
- `daily_thoughts` (LLM quote cache)
- `contract_worker_attendance`

## Credentials
- Admin: admin@shardahr.com / password
- HR: hr@shardahr.com / password
- Production Backend: https://sharda-hr-system.emergent.host
- Production Frontend: https://shardahrms.com
