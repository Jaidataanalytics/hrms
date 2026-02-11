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

### Attendance Data Integrity Fixes
- Fixed duplicate records appearing for employees with multiple ID formats (EMP* vs S00*)
- Added robust name-based employee matching in attendance lookup (handles split-name differences)
- Added date-based deduplication in attendance API response
- Enhanced biometric sync to check both employee_id and emp_code for existing records
- Improved date formatting and monospace time display in employee profile
- Fixed employee profile attendance lookup with emp_code fallback

### Bug Fixes
- Calendar "Add Task" crash: Fixed `<SelectItem value="">` to `value="self"`

### Previous Implementations
- AI-Powered SOP Management (flowchart, re-parse, columns)
- Employee Profile Documents & Assets tab fixes
- Documents page search/filter/delete
- Internal Meeting System

---

## Key Database Issues
- **Duplicate employee records**: Some employees exist under multiple IDs (biometric ID like `EMP1709423C` and directory ID like `EMP0E3993E5`) with different name splits
- **Incomplete biometric data**: Some days only have IN or OUT punch, marked as "present"

## Prioritized Backlog
### P1
- [ ] Helpdesk Phase 2: Survey analytics, 360-degree feedback
- [ ] Production deployment
- [ ] Admin "Unknown" name in meeting analytics

### P2
- [ ] Bulk import for contract workers, salary download, add 100+ employees
- [ ] Helpdesk Phase 3, dual asset schema migration
- [ ] Employee record deduplication cleanup
