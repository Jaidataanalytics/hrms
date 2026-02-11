# Sharda HR - Product Requirements Document

## Original Problem Statement
Overhaul the company's HR systems into a modern, full-featured HR management platform with premium dark glass-morphism UI.

## Authentication
- JWT + Emergent Google Auth
- Admin: admin@shardahr.com / Admin@123 | Employee: employee@shardahr.com / Employee@123

## Tech Stack
Frontend: React, TailwindCSS, Shadcn/UI, Framer Motion, Lucide icons
Backend: FastAPI, Motor (async MongoDB), openpyxl, reportlab
3rd Party: emergentintegrations (Emergent LLM Key for AI SOP parsing), Custom Biometric API, Emergent Google Auth

---

## What's Been Implemented (as of Feb 11, 2026)

### Dark Glass-Morphism UI Overhaul (NEW - Feb 11, 2026)
- Complete dark mode CSS variable overhaul (hsl(240 20% 5%) background)
- Glass-morphism cards: backdrop-blur, translucent backgrounds, subtle borders, neon glow
- Dark glass tabs, inputs, dialogs, dropdowns, tooltips, tables
- Neon glow effects on primary buttons and accent elements
- Global dark mode overrides for ALL Tailwind utility classes (text, bg, border, hover)
- Dark header bar with glass blur effect
- Section pills with glow, premium stat cards with dark glass
- Works across all 20+ pages via global CSS — no per-page changes needed
- Sidebar remains dark anchor (unchanged by design)

### Employee Sidebar Access (NEW - Feb 11, 2026)
- Helpdesk, SOPs, Training, Tour Management visible to ALL roles
- Each page shows role-appropriate content

### Remote Check-in Dashboard Shortcut (NEW - Feb 11, 2026)
- GPS Clock In/Out card on dashboard for eligible employees (field employees / active tours)

### Custom Domain CORS + Auth Fix (NEW - Feb 11, 2026)
- Starlette native CORSMiddleware with shardahrms.com explicitly listed
- 11 pages fixed with Bearer token auth headers (getAuthHeaders)

### Previous Implementations
- Helpdesk Phase 2: 360 Feedback + Survey Analytics (COMPLETE)
- Dynamic Dashboard Theming for celebrations
- Employee Events & Celebrations System
- AI-Powered SOP Management
- Attendance Data Integrity Fixes
- Leave management, meetings, payroll, performance, etc.

---

## Prioritized Backlog
### P1
- [ ] Production deployment (MUST redeploy for CORS fix on custom domain)
- [ ] Admin "Unknown" name in meeting analytics

### P2
- [ ] Bulk import for contract workers, salary download
- [ ] Helpdesk Phase 3
- [ ] Employee record deduplication cleanup
- [ ] HelpdeskPage.js refactoring (1500+ lines)
