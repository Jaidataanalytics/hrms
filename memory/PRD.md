# Sharda HR System - Product Requirements Document

## Overview
Comprehensive HR management system for Sharda Diesels with employee management, attendance tracking, payroll, leave management, insurance, and helpdesk modules.

## Core Modules

### 1. Employee Management
- Employee directory with search and filters
- Bulk import/export functionality
- Role-Based Access: Only HR/Admin can access Employees page

### 2. Attendance Management
- Organization-wide attendance view (HR/Admin only)
- Individual attendance tracking
- Late Marking: Arrival after 10:00 AM is marked as LATE
- Biometric API Integration: Auto-sync every 3 hours
- Calendar View: Daily attendance stats with drill-down

### 3. Leave Management
- Leave balance management
- Configurable Leave Policy Rules: Annual quotas, carry forward, Sunday penalty rules

### 4. Payroll Management (OVERHAULED - Jan 2026)

**Salary Structure Template Format:**
- Fixed Components: Basic, DA, HRA, Conveyance, Grade Pay, Other Allowance, Medical Allowance
- Calculation: Uses calendar days (28-31), pro-rates each component
- WFH at 50% (configurable)
- Late deduction: 2 lates in a week = half day deduction
- Deductions: EPF (12% capped at ₹15,000), ESI (0.75% if Gross ≤ ₹21,000), SEWA (2%)
- Professional Tax: EXCLUDED

**Features:**
- SEWA Advance Management
- One-time Deductions (Loan EMI, Advance Recovery, etc.)
- Payslip Editing Before Lock
- Export to Excel in Template Format
- **DELETE PAYROLL** - Can delete both processed AND locked payrolls (NEW)

### 5. Asset Management
- Asset Inventory with individual asset tracking
- Employee Assignment view
- Edit, Delete, Reassign, Unassign operations

### 6. Helpdesk Module (OVERHAULED - Jan 28, 2026)

**Tab 1: Complaints**
- Submit and track workplace issues
- Categories: General, Payroll, Leave, Harassment, Workplace, Benefits, IT Support, Policy
- Priority Levels: Low, Medium, High, Critical (NEW)
- Status tracking: Open, In Progress, Resolved, Closed
- Anonymous submission option

**Tab 2: Anonymous Suggestions (NEW)**
- Employees can submit suggestions/ideas
- Anonymous to HR (super_admin can see submitter identity)
- HR can respond (response visible only to submitter)
- Status: Submitted, Under Review, Acknowledged, Implemented, Rejected

**Tab 3: Surveys (NEW - Major Feature)**

*Survey Types:*
- Poll
- Text Survey
- Satisfaction Survey
- Employee Engagement
- Colleague/360 Feedback
- Pulse Check
- Custom

*Survey Targeting:*
- All Employees
- Select Individuals (searchable)
- By Department
- By Location

*Question Types:*
- Rating (1-5 scale)
- NPS (0-10 scale)
- Yes/No
- Single Choice
- Multiple Choice
- Short Text
- Long Text

*Built-in Templates:*
1. Employee Satisfaction Survey
2. Employee Engagement Survey
3. Weekly Pulse Check
4. New Employee Onboarding Survey
5. Exit Interview Survey
6. 360 Degree Feedback

*Features:*
- Anonymous or identified responses
- Deadline/due date
- Mandatory vs optional
- Allow editing responses until deadline
- In-app notifications
- Response tracking
- Analytics dashboard with charts

### 7. Insurance Module
- Employee Insurance Tab (ESIC, PMJJBY, Accidental)
- Business Insurance Tab

### 8. Global Search & Employee 360 View
- Global search bar (Cmd+K) - HR/Admin only
- Comprehensive employee profile page

## Authentication & Security

### Role-Based Access Control
| Feature | Admin/HR | Employee |
|---------|----------|----------|
| Employees Page | ✅ | ❌ |
| Organization Attendance | ✅ | ❌ |
| Survey Management | ✅ | ❌ (view assigned only) |
| Anonymous Suggestion Submitter | ✅ super_admin only | ❌ |
| SEWA Advances | ✅ | ❌ |
| Payslip Edit | ✅ Before lock | ❌ |
| Delete Payroll | ✅ | ❌ |

## Test Credentials
- **Admin:** admin@shardahr.com / Admin@123
- **Employee:** employee@shardahr.com / Employee@123

## Recent Changes

### Jan 28, 2026 - Helpdesk Overhaul (Phase 1)
1. ✅ **Complaints with Priority Levels** - Low, Medium, High, Critical badges
2. ✅ **Anonymous Suggestions** - Anonymous to HR, visible to super_admin
3. ✅ **Survey System** - Complete implementation with:
   - 7 survey types
   - 4 targeting options
   - 7 question types
   - 6 built-in templates
   - Analytics dashboard
4. ✅ **Delete Payroll** - Can delete processed AND locked payrolls

### Jan 22, 2026 - Payroll Overhaul
- New calculation logic using calendar days
- SEWA Advance Management
- One-time Deductions
- Payslip Editing
- Template format export

## Upcoming Tasks (Phase 2 & 3)

### Phase 2 - Advanced Surveys
1. 🟠 Colleague/360 Feedback with HR-assigned or employee-choice targets
2. 🟠 Survey Templates management (save/load custom templates)
3. 🟠 Scheduled Surveys (auto-send on specific dates)
4. 🟠 Recurring Surveys (weekly, monthly, quarterly pulse checks)

### Phase 3 - Analytics & Extras
1. 🟡 Pulse Surveys - Quick recurring check-ins
2. 🟡 Follow-up Actions - Link survey results to action items
3. 🟡 Benchmark Comparison - Compare results over time
4. 🟡 Conditional Questions - Show/hide based on previous answers
5. 🟡 Survey Drafts - Save incomplete surveys

## Future Tasks
1. Deploy to Production (CRITICAL - 3+ forks behind)
2. Add Missing Employees (100+ unmatched from biometric)
3. Employee payslip PDF download
4. Meeting Management & Task Tracking
5. AI-powered Shift Scheduling
6. Mobile application (limited scope)

## API Endpoints

### Helpdesk (NEW)
- `GET/POST /api/helpdesk/suggestions` - List/create suggestions
- `PUT /api/helpdesk/suggestions/{id}/respond` - HR responds to suggestion
- `GET/POST /api/helpdesk/surveys` - List/create surveys
- `POST /api/helpdesk/surveys/{id}/activate` - Activate draft survey
- `POST /api/helpdesk/surveys/{id}/close` - Close active survey
- `POST /api/helpdesk/surveys/{id}/respond` - Submit survey response
- `GET /api/helpdesk/surveys/{id}/analytics` - Get survey analytics
- `GET /api/helpdesk/survey-templates` - Get built-in templates
- `GET /api/helpdesk/departments` - Get departments for targeting
- `GET /api/helpdesk/locations` - Get locations for targeting
- `GET /api/helpdesk/employees-for-selection` - Get employees for targeting

### Payroll
- `DELETE /api/payroll/runs/{id}` - Delete payroll run and payslips (NEW)
