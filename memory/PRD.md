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
- Global CSS overrides for ALL Shadcn components (cards, buttons, inputs, dialogs, tabs, tables, dropdowns)
- Section pills (`// CALENDAR`, `// ATTENDANCE`) on 13+ pages
- Dark login page with animated SVG arcs, glassmorphism
- Animated loading screen, premium sidebar, glass-morphism header
- Premium calendar with refined cells, colored status backgrounds
- JetBrains Mono accents, Manrope headings, Public Sans body

### Employee Events & Celebrations System
- Backend: Full CRUD API at `/api/events` (today, upcoming, bulk upload, template, self-service)
- Events Management page at `/dashboard/events`
- Dashboard CelebrationBanner with confetti + themed banners
- Calendar integration showing celebration markers

### Dynamic Dashboard Theming (NEW - Feb 11, 2026)
- Dashboard appearance dynamically changes based on today's employee celebration events
- Birthday theme: Warm amber/gold shimmer bar + card accents
- Work Anniversary theme: Blue/indigo shimmer bar + card accents
- Marriage Anniversary theme: Rose/pink shimmer bar + card accents
- Custom Event theme: Emerald/teal shimmer bar + card accents
- CelebrationBanner communicates theme type via `onThemeDetected` callback

### Helpdesk Phase 2: 360-Degree Feedback System (COMPLETE - Feb 11, 2026)
- **Backend**: Full CRUD for feedback cycles (`/api/helpdesk/feedback-cycles`)
- **Backend**: Assignment system, submission, analytics endpoints
- **Backend**: My feedback summary, per-employee analytics
- **Frontend**: FeedbackTab component with:
  - Create/manage feedback cycles (HR)
  - Assign reviewers with employee picker dialog
  - Feedback submission dialog with rating + text responses
  - Analytics dialog with category scores, employee rankings, text responses
- **Frontend**: Integrated as "360 Feedback" tab in HelpdeskPage

### Helpdesk Phase 2: Enhanced Survey Analytics (COMPLETE - Feb 11, 2026)
- **Backend**: Detailed analytics endpoint with department breakdown, timeline
- **Backend**: Excel export for survey responses
- **Frontend**: SurveyAnalyticsDashboard component with:
  - Summary cards (Recipients, Responses, Rate, Score)
  - SVG response rate gauge
  - Department response breakdown with animated bars
  - Question-level analytics (rating distributions, choice counts, text responses)
  - Response timeline chart
  - Export to Excel button

### Attendance Data Integrity Fixes
- Fixed duplicate records for employees with multiple ID formats
- Robust name-based employee matching with fallbacks
- Date-based deduplication in attendance API

### Previous Implementations
- AI-Powered SOP Management (flowchart, re-parse, columns)
- Employee Profile Documents & Assets tab fixes
- Documents page search/filter/delete
- Internal Meeting System
- Leave management with employee name enrichment
- Dynamic CORS for custom domains
- Full employee list endpoint for selection dropdowns

---

## Key Database Issues
- **Duplicate employee records**: Some employees exist under multiple IDs
- **Incomplete biometric data**: Some days only have IN or OUT punch

## Prioritized Backlog
### P0
- All P0 items completed

### P1
- [ ] Production deployment
- [ ] Admin "Unknown" name in meeting analytics

### P2
- [ ] Bulk import for contract workers, salary download, add 100+ employees
- [ ] Helpdesk Phase 3, dual asset schema migration
- [ ] Employee record deduplication cleanup
- [ ] HelpdeskPage.js refactoring (1500+ lines, break into smaller components)
