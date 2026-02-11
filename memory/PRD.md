# Sharda HR - Product Requirements Document

## Original Problem Statement
Overhaul the company's HR systems into a modern, full-featured HR management platform. React/FastAPI/MongoDB stack.

## Authentication
- JWT + Emergent Google Auth
- Admin: admin@shardahr.com / Admin@123 | Employee: employee@shardahr.com / Employee@123

## Tech Stack
Frontend: React, TailwindCSS, Shadcn/UI, Framer Motion, Lucide icons
Backend: FastAPI, Motor (async MongoDB), openpyxl, reportlab
3rd Party: emergentintegrations (Emergent LLM Key for AI SOP parsing), Custom Biometric API, Emergent Google Auth

---

## What's Been Implemented (as of Feb 11, 2026)

### Premium UI/UX Overhaul (Eclipticon-Inspired)
- Global CSS overrides for ALL Shadcn components
- Section pills, dark login, animated loading screen, premium sidebar
- JetBrains Mono accents, Manrope headings, Public Sans body

### Employee Events & Celebrations System
- Backend: Full CRUD API at `/api/events` (today, upcoming, bulk upload, template, self-service)
- Events Management page, Dashboard CelebrationBanner with confetti

### Dynamic Dashboard Theming
- Dashboard appearance changes based on today's celebrations (birthday=amber, work anniversary=blue, marriage anniversary=pink, custom=emerald)

### Helpdesk Phase 2: 360-Degree Feedback + Survey Analytics (COMPLETE)
- Full CRUD feedback cycles, reviewer assignment, feedback submission, analytics
- Enhanced survey analytics with dept breakdown, response timeline, Excel export

### Employee Sidebar Access (NEW - Feb 11, 2026)
- Helpdesk, SOPs, Training, Tour Management now visible to ALL employee roles in sidebar
- Each page shows role-appropriate content (employees see their own data, HR sees all)

### Remote Check-in Dashboard Shortcut (NEW - Feb 11, 2026)
- Dashboard shows "Remote Check-in" card for eligible employees
- Fetches `/api/travel/my-active-tour` to check eligibility
- GPS-based Clock In/Clock Out same as Tour Management page
- Only visible when employee has active tour OR is marked as field employee

### Custom Domain CORS Fix (NEW - Feb 11, 2026)
- Replaced custom DynamicCORSMiddleware with Starlette native CORSMiddleware
- `shardahrms.com` and `www.shardahrms.com` explicitly listed in allowed origins
- Fixed wildcard `*` not working with `allow_credentials=true`

### Auth Headers Fix for Cross-Domain (NEW - Feb 11, 2026)
- 11 pages were missing `getAuthHeaders()` Bearer token in fetch calls
- Fixed: DataManagement, Training, Travel, Announcements, UserManagement, Performance, Reports, Grievance, Expenses, Recruitment, ReportBuilder
- Root cause of "users shows 0" and pages not working from custom domain

### Attendance Data Integrity Fixes
- Fixed duplicate records, robust name-based matching, date deduplication

### Previous Implementations
- AI-Powered SOP Management, Employee Profile, Documents, Internal Meetings
- Leave management, employee list endpoint, employee celebrations

---

## Key Database Issues
- Duplicate employee records with multiple IDs
- Incomplete biometric data (partial punches)

## Prioritized Backlog
### P0 - All completed

### P1
- [ ] Production deployment
- [ ] Admin "Unknown" name in meeting analytics

### P2
- [ ] Bulk import for contract workers, salary download, add 100+ employees
- [ ] Helpdesk Phase 3, dual asset schema migration
- [ ] Employee record deduplication cleanup
- [ ] HelpdeskPage.js refactoring (1500+ lines)
