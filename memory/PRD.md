# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, insurance, helpdesk, contract labour, SOP management, meetings, and tour modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- Role-Based Access: Only HR/Admin can access Employees page
- **Edit Profile** - HR can edit employee details via profile dialog

### 2. Attendance Management
- Organization-wide attendance view (HR/Admin only)
- Individual attendance tracking
- Late Marking: Arrival after 10:00 AM is marked as LATE
- Biometric API Integration: Auto-sync every 3 hours
- Calendar View: Daily attendance stats with drill-down
- **HR Attendance Editing** - Edit records tab, manual entry, audit trail
- **Attendance Grid View** - Matrix display with inline editing

### 3. Leave Management
- Leave balance management
- Configurable Leave Policy Rules: Annual quotas, carry forward, Sunday penalty rules

### 4. Payroll Management
**Features:**
- Fixed Components: Basic, DA, HRA, Conveyance, Grade Pay, Other Allowance, Medical Allowance
- WFH at 50% (configurable)
- Late deduction: 2 lates in a week = half day deduction
- Deductions: EPF (12% capped at ₹15,000), ESI (0.75% if Gross ≤ ₹21,000), SEWA (2%)
- Sunday Pay Rule: Sundays PAID unless >2 leaves that week
- SEWA Advance Management
- One-time Deductions (Loan EMI, Advance Recovery, etc.)
- Payslip Editing Before Lock
- Export to Excel in Template Format
- DELETE PAYROLL capability
- **PAYSLIP PDF DOWNLOAD** - Employees can download their payslips as PDF

### 5. Asset Management
- Asset Inventory with individual asset tracking
- Employee Assignment view
- Edit, Delete, Reassign, Unassign operations

### 6. Helpdesk Module
**Tab 1: Complaints** - Submit and track workplace issues with priority levels
**Tab 2: Anonymous Suggestions** - Anonymous to HR (visible to super_admin)
**Tab 3: Surveys** - Complete survey system with 7 types, 7 question types, and templates

### 7. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab

### 8. Global Search & Employee 360 View
- Global search bar (Cmd+K) - HR/Admin only
- Comprehensive employee profile page

### 9. Contract Labour Management
Mini HR System for Contract Workers:
- Contractors Master List
- Workers List with detail view (Profile, Attendance, Payroll, Documents tabs)

### 10. Tour Management & Remote Check-in
- Tour request submission and approval workflow
- GPS-based remote check-in for approved tours
- Field employee designation

### 11. SOP Management (AI-POWERED) ✅
**Standard Operating Procedures System:**
- Create SOPs with Excel file upload
- **AI-Powered Parsing** - Automatically extracts:
  - SOP Number, Title, Process Owner
  - Purpose, Scope, Procedure Summary
  - Responsible Persons, Stakeholders
  - Key Activities, Reports
  - Task Type/Category
  - **Process Flow Steps** with descriptions & responsibilities
- **Auto-match Process Owner** to employees in system
- Main Responsible (max 3) - Primary employees responsible
- Also Involved - Additional employees who follow the SOP
- Link to departments and/or designations
- Excel content parsed and shown as table preview
- Download original Excel file
- Draft/Published workflow
- **Notifications sent** on publish

**Advanced Features:**
- Full-text search across all fields
- Filter by Department, Status, Owner
- Group by Department, Owner, Task Type, Status
- Full editing of all SOP fields
- "My SOPs" card on employee dashboard
- **Re-parse AI** button to re-extract data with improved prompts
- **Process Flow Chart** visualization with step-by-step boxes

**Enhanced Table Columns:**
- SOP Number
- Title (with Task Type badge)
- Owner (blue badge)
- Responsible Persons (amber badges)
- Stakeholders (purple badges)
- Status

### 12. Meeting Management System ✅
**Purpose:** Track organizational meetings, discussions, and follow-ups

**Features:**
- Meeting CRUD with subject, date, time, location, participants
- Agenda / Things to Focus On
- Discussion Notes with edit tracking
- Follow-up Points with assignment & completion tracking
- Auto-Schedule Follow-up meeting
- Meeting series linking
- **In-App Notifications** via bell icon (invitations, reminders)
- **Analytics Dashboard** (HR/Admin) - totals, frequency, completion rate

### 13. UI/UX Overhaul (Light Mode) ✅
- Framer Motion animations
- Gradient backgrounds on Login
- Improved stat-card styling
- Skeleton loaders
- Clean white card design
- Manrope/Public Sans typography

## Authentication & Security

### Role-Based Access Control
| Feature | Admin/HR | Employee |
|---------|----------|----------|
| Employees Page | ✅ | ❌ |
| Organization Attendance | ✅ | ❌ |
| Edit Attendance Records | ✅ | ❌ |
| Survey Management | ✅ | ❌ (view assigned only) |
| SEWA Advances | ✅ | ❌ |
| Payslip Edit | ✅ Before lock | ❌ |
| Delete Payroll | ✅ | ❌ |
| Tour Approvals | ✅ | ❌ |
| SOP Management | ✅ | ❌ (view assigned only) |
| Contract Labour | ✅ | ❌ |
| Meeting Management | ✅ | ✅ (own meetings) |
| Meeting Analytics | ✅ | ❌ |

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / Employee@123

## Recent Changes

### Recent Changes - Feb 5, 2026

#### Bug Fixes
1. **Documents Tab in Employee Profile** - FIXED
   - Added file upload with actual file attachment
   - Delete button for each document
   - Backend endpoints: POST /documents/upload, DELETE /documents/{id}, GET /documents/{id}/download

2. **Documents Page** - Enhanced
   - Added search filter
   - Added delete button
   - Proper file upload with file input

3. **Assets in Employee Profile** - FIXED
   - Fetches from both `employee_assets` (boolean flags) and `assets` (individual records)
   - Shows "Assigned Items" for individual assets
   - Shows "Quick Overview" for boolean flags

### Feb 4, 2026 - SOP Improvements
1. ✅ Enhanced table with Responsible Persons & Stakeholders columns
2. ✅ Process Flow Chart visualization
3. ✅ Re-parse AI button for improved extraction
4. ✅ Fixed delete button
5. ✅ Fixed admin employee record for meeting analytics

## Upcoming Tasks

### Phase 2 - UI/UX Completion (P1)
1. 🟠 Apply light-mode design to remaining pages (Employees, Attendance, Payroll, Onboarding, SOP)

### Phase 2 - Helpdesk Enhancements (P1)
1. 🟠 Survey analytics dashboard
2. 🟠 360-degree colleague feedback surveys

## Future Tasks (Backlog)
1. 🔴 Deploy to Production (CRITICAL - 3+ forks behind)
2. Bulk import for contract workers
3. Salary spreadsheet download
4. Add 100+ missing employees from biometric
5. SOP version history tracking
6. Mobile application (limited scope)

## 3rd Party Integrations
- `emergentintegrations` with Emergent LLM Key (AI SOP parsing)
- Custom Biometric API
- Emergent-managed Google Auth
- `openpyxl` (Excel parsing)
- `reportlab` (PDF generation)
- `Framer Motion` (animations)

## Key API Endpoints

### SOP Management
- `POST /api/sop/create` - Upload SOP with AI parsing
- `GET /api/sop/list` - List with search, filters, grouping
- `GET /api/sop/{id}` - Get SOP with AI-extracted data
- `PUT /api/sop/{id}` - Update SOP
- `PUT /api/sop/{id}/publish` - Publish and notify
- `GET /api/sop/my-sops` - User's SOPs

### Meeting Management
- `POST /api/meetings` - Create meeting
- `GET /api/meetings/analytics` - Analytics dashboard
- `POST /api/meetings/{id}/schedule-followup` - Schedule follow-up

### Notifications
- `GET /api/notifications` - List notifications
- `POST /api/notifications/mark-all-read` - Mark all read
