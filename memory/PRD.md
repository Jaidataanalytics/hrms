# Sharda HR - Product Requirements Document

## Original Problem Statement
Overhaul the company's HR systems into a modern, full-featured HR management platform. The application is built with React (frontend) + FastAPI (backend) + MongoDB.

## Core Application
- Employee management, attendance tracking, leave management, payroll, performance reviews
- Document management, asset tracking, expense management
- Recruitment, onboarding, training, tours, helpdesk
- Internal meetings system, SOP management, announcements
- Calendar with tasks, meetings, events
- Role-based access (super_admin, hr_admin, hr_executive, employee)

## Authentication
- JWT-based custom auth + Emergent-managed Google Auth
- Credentials: admin@shardahr.com / Admin@123, employee@shardahr.com / Employee@123

## Tech Stack
- **Frontend:** React, TailwindCSS, Shadcn/UI, Framer Motion, Lucide icons
- **Backend:** FastAPI, Motor (async MongoDB), openpyxl, reportlab
- **Database:** MongoDB
- **3rd Party:** emergentintegrations (Emergent LLM Key for AI SOP parsing), Custom Biometric API

---

## What's Been Implemented (as of Feb 11, 2026)

### Premium UI/UX Overhaul (Eclipticon-inspired)
- Dark theme login page with animated SVG arc, radial gradient blobs, glassmorphism card
- Animated loading screen with logo sweep and progress bar on app startup
- Premium sidebar with `// ADMINISTRATION` monospace labels, sliding active indicators, glow effects
- Glass-morphism header with accent line
- Smooth page transitions (fade + slide + blur via Framer Motion)
- `section-pill` component with monospace styling for page headers
- Premium stat cards with hover lift + glow effects
- Stagger animation system for child elements
- Noise texture overlay for depth
- Premium scrollbar styling
- Modern button interactions (press scale, pill shapes)
- JetBrains Mono for accent text, Manrope for headings, Public Sans for body

### Employee Events & Celebrations System
- **Backend:** Full CRUD API for employee events (`/api/events`)
  - Create, update, delete events
  - Today's events matching by MM-DD (recurring annually)
  - Upcoming events within configurable days
  - Bulk upload from Excel template
  - Template download endpoint
  - Employee self-service for marriage anniversary/custom events
- **Frontend:** Events Management page (`/dashboard/events`)
  - Stats cards (total, birthdays, work anniv, marriage anniv, upcoming)
  - Searchable/filterable events list
  - Add Event dialog with employee selector
  - Bulk Upload dialog with template download
  - Delete functionality
- **Dashboard Integration:** CelebrationBanner component
  - Personalized banner for celebrating employee (confetti + themed gradient)
  - Compact card for other people's celebrations
  - Different themes: birthday (amber), work anniversary (blue), marriage (pink), custom (emerald)
- **Calendar Integration:** Events show as celebration markers on calendar days

### Calendar Fix
- Fixed "Add Task" crash: Changed `<SelectItem value="">` to `<SelectItem value="self">` (Radix UI doesn't allow empty string values)

### AI-Powered SOP Management
- Table view with Owner, Responsible Persons, Stakeholders columns
- AI parsing of Excel files to extract metadata + structured process flowcharts
- Flowchart visualization in edit dialog
- Re-parse AI feature for existing SOPs
- Fixed delete functionality

### Employee Profile Enhancements
- Documents tab: functional upload/view
- Assets tab: dual-schema fix (employee_assets + assets collections)
- Quick Overview consistency fix

### Documents Page
- Search, filter, delete functionality

### Internal Meeting System
- Complete meeting management feature

---

## Database Schema

### employee_events
```json
{
  "event_id": "evt_xxx",
  "emp_code": "EMP001",
  "event_type": "birthday|work_anniversary|marriage_anniversary|custom",
  "event_date": "1990-05-15",
  "label": "optional description",
  "recurring": true,
  "created_by": "user_id",
  "created_at": "ISO datetime"
}
```

---

## API Endpoints (Key)
- `POST/GET /api/events` - CRUD events
- `GET /api/events/today` - Today's celebrations (MM-DD match)
- `GET /api/events/upcoming?days=30` - Upcoming events
- `POST /api/events/bulk-upload` - Excel bulk upload
- `GET /api/events/template` - Download template
- `GET/POST /api/events/my-events` - Employee self-service
- `DELETE /api/events/{event_id}` - Delete event
- `POST /api/sops/{sop_id}/reparse` - Re-parse SOP
- `POST/GET/DELETE /api/documents/*` - Document management
- `GET /api/assets?emp_code=X` - Employee assets

---

## Prioritized Backlog

### P0 - High Priority
- [ ] App-wide UI/UX Overhaul Phase 2: Apply premium design to Employees, Attendance, Payroll, Onboarding pages
- [ ] Production deployment (recurring blocker - needs user approval)

### P1 - Medium Priority
- [ ] Helpdesk Enhancements Phase 2: Survey analytics dashboard, 360-degree feedback
- [ ] Admin "Unknown" name fix in meeting analytics (P2)

### P2 - Lower Priority
- [ ] Bulk import for contract workers
- [ ] Salary spreadsheet download
- [ ] Add 100+ missing employees
- [ ] Helpdesk Phase 3: In-app notifications and deadline reminders
- [ ] Dual asset schema migration (employee_assets -> assets collection)

---

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── events.py          # NEW: Employee events/celebrations
│   │   ├── sop.py             # AI-powered SOP parsing
│   │   ├── documents.py       # Document management
│   │   ├── calendar.py        # Calendar tasks & meetings
│   │   ├── meetings.py        # Internal meetings
│   │   └── ...
│   └── server.py
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── LoadingScreen.js     # NEW: Animated app loading
│       │   ├── CelebrationBanner.js # NEW: Dashboard celebrations
│       │   └── ui/                  # Shadcn components
│       ├── layouts/
│       │   └── DashboardLayout.js   # REWRITTEN: Premium sidebar & transitions
│       ├── pages/
│       │   ├── EventsManagementPage.js # NEW: Events CRUD page
│       │   ├── LoginPage.js            # REWRITTEN: Dark premium login
│       │   ├── Dashboard.js            # MODIFIED: Section pill, celebrations
│       │   ├── MyCalendarPage.js       # MODIFIED: Events integration, task fix
│       │   └── ...
│       └── index.css                   # REWRITTEN: Premium animation system
└── ...
```
