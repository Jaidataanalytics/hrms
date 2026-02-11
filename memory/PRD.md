# Sharda HR - Product Requirements Document

## Original Problem Statement
Overhaul the company's HR systems into a modern, full-featured HR management platform. React/FastAPI/MongoDB stack.

## Core Application
Full HR management: Employee management, attendance, leave, payroll, performance, documents, assets, expenses, recruitment, onboarding, training, tours, helpdesk, meetings, SOP management, announcements, calendar.

## Authentication
- JWT + Emergent Google Auth
- Admin: admin@shardahr.com / Admin@123 | Employee: employee@shardahr.com / Employee@123

## Tech Stack
Frontend: React, TailwindCSS, Shadcn/UI, Framer Motion, Lucide icons
Backend: FastAPI, Motor (async MongoDB), openpyxl, reportlab
3rd Party: emergentintegrations (Emergent LLM Key for AI SOP parsing), Custom Biometric API, Emergent Google Auth

---

## What's Been Implemented (as of Feb 11, 2026)

### App-Wide Premium UI/UX Overhaul (Eclipticon-Inspired)
**Global Design System (index.css):**
- Premium component overrides targeting ALL Shadcn components via CSS selectors ([data-slot='card'], [role='tablist'], [role='dialog'], tables)
- Cards: 14px radius, subtle shadows, hover lift + shadow deepening
- Buttons: Active press scale, primary glow, outline hover border color shift
- Inputs: 10px radius, focus glow ring + border color change
- Dialogs: Scale+fade animation on open, deeper shadow, backdrop blur
- Tables: Uppercase Manrope headers, subtle row hover, refined borders
- Tabs: Pill-style with active tab shadow
- Dropdowns: Smooth enter animation, rounded corners
- Custom scrollbar: 5px thin, transparent track

**Page-Level Upgrades (13+ pages):**
- Section pills on every page header (// CALENDAR, // EMPLOYEES, etc.) using JetBrains Mono
- Header accent lines with gradient animation
- Manrope font for all headings with -0.015em letter spacing
- Stagger animation system for child elements

**Login Page:** Dark theme with animated SVG arcs, radial gradient blobs, glassmorphism card, noise texture overlay

**Loading Screen:** Animated logo with sweep arc, progress bar, smooth transition to app

**Sidebar:** Dark gradient bg, glow-on-active indicator, `// ADMINISTRATION` monospace label, hover translate, link glow

**Header:** Glass morphism with backdrop blur, accent gradient line

**Calendar Page:** Complete redesign with premium-cal-grid CSS grid, premium-cal-cell rounded cells, colored status backgrounds, today glow indicator, event chip badges, refined legend dots

**Attendance Page:** Premium stat cards with colored top gradient bars, refined info bar

### Employee Events & Celebrations System
- **Backend API:** Full CRUD at `/api/events` - create, update, delete, today's events (MM-DD recurring match), upcoming (30 days), bulk Excel upload, template download, employee self-service
- **Events Management Page:** Stats cards, searchable/filterable list, add event dialog, bulk upload dialog, delete
- **Dashboard CelebrationBanner:** Personalized banner with confetti for self-celebration, compact cards for others. Themes: birthday (amber), work anniversary (blue), marriage (pink)
- **Calendar Integration:** Celebration markers on calendar day cells

### Bug Fixes
- Calendar "Add Task" crash: Fixed `<SelectItem value="">` to `value="self"` (Radix UI constraint)

### Previous Implementations
- AI-Powered SOP Management (flowchart visualization, re-parse, columns)
- Employee Profile Documents & Assets tab fixes
- Documents page search/filter/delete
- Internal Meeting System
- Light mode design foundation

---

## Database Schema

### employee_events
```json
{ "event_id": "evt_xxx", "emp_code": "EMP001", "event_type": "birthday|work_anniversary|marriage_anniversary|custom", "event_date": "1990-05-15", "label": "", "recurring": true, "created_by": "user_id", "created_at": "ISO" }
```

---

## Key API Endpoints
- `POST/GET /api/events` - CRUD events
- `GET /api/events/today` - Today's celebrations (MM-DD match)
- `GET /api/events/upcoming?days=30` - Upcoming events
- `POST /api/events/bulk-upload` - Excel bulk upload
- `GET /api/events/template` - Download template
- `GET/POST /api/events/my-events` - Employee self-service

---

## Prioritized Backlog

### P1
- [ ] Helpdesk Enhancements Phase 2: Survey analytics dashboard, 360-degree feedback
- [ ] Production deployment (needs user approval)
- [ ] Admin "Unknown" name fix in meeting analytics

### P2
- [ ] Bulk import for contract workers
- [ ] Salary spreadsheet download
- [ ] Add 100+ missing employees
- [ ] Helpdesk Phase 3: In-app notifications and deadline reminders
- [ ] Dual asset schema migration

---

## Architecture
```
/app/
├── backend/routes/
│   ├── events.py (NEW), sop.py, documents.py, calendar.py, meetings.py, attendance.py, ...
│   └── server.py
├── frontend/src/
│   ├── components/ LoadingScreen.js (NEW), CelebrationBanner.js (NEW), GlobalSearch, NotificationBell, ui/
│   ├── layouts/ DashboardLayout.js (REWRITTEN)
│   ├── pages/ EventsManagementPage.js (NEW), LoginPage.js (REWRITTEN), MyCalendarPage.js (REWRITTEN), AttendancePage.js, + 13 pages updated with pills
│   └── index.css (REWRITTEN - complete premium design system)
```
