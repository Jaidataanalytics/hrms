# Nexus HR - HRMS Application

## Original Problem Statement
Build a production-grade HRMS for an Indian company with:
- Employee Directory & Profiles
- Attendance Management (Biometric mock, WFH, Tour)
- Leave Management with configurable policies
- Payroll Processing with India compliance (PF/ESI/PT/TDS)
- Performance/KPI Module
- Social Feed/Announcements
- Role-based access control with audit trails
- In-app notifications
- Single session login

## User Choices
- Authentication: Both JWT + Google OAuth
- Scope: Full MVP all modules
- Mobile: Responsive web app
- Biometric: Mock data (can integrate later)
- Theme: Modern professional light theme with dark sidebar
- Multi-tenancy: Single company HRMS
- Language: English only
- Currency/Date: INR + DD/MM/YYYY
- Reports: In-app only (no email)
- Scale: <500 employees

## Completed Tasks (Phase 1)

### Backend (FastAPI + MongoDB)
- ✅ Authentication system (JWT + Emergent Google OAuth)
- ✅ Role-based access control with permissions
- ✅ Audit logging for sensitive actions
- ✅ Employee CRUD operations
- ✅ Master data: Departments, Designations, Locations
- ✅ Attendance marking (manual/WFH/tour with timestamps)
- ✅ Leave types and policies
- ✅ Leave application and approval workflow
- ✅ Leave balance tracking
- ✅ Dashboard stats and metrics
- ✅ Announcements with acknowledgment
- ✅ Notifications system
- ✅ Seed data with default roles, leave types, admin user

### Frontend (React + Shadcn UI)
- ✅ Direct login page (no landing page for in-house use)
- ✅ Google OAuth integration
- ✅ Dashboard with stats, attendance, leave balance
- ✅ Employee Directory with search/filter
- ✅ Employee Profile pages
- ✅ Attendance page with calendar and punch in/out
- ✅ Leave Management with apply/approve workflow
- ✅ Announcements page with create/acknowledge
- ✅ Settings page
- ✅ Dark sidebar enterprise layout
- ✅ Responsive design

## Next Tasks (Phase 2)

### Core Modules to Complete
1. **Payroll Module**
   - Salary components (Basic, HRA, allowances)
   - Deductions (PF, ESI, PT, TDS)
   - Payroll processing flow
   - Payslip generation (PDF)
   - Rules engine for calculations

2. **Performance/KPI Module**
   - KPI templates by role
   - Employee KPI forms
   - Manager reviews
   - Scoring and ratings
   - Trend analysis

3. **Additional Modules**
   - Document Management
   - Asset Management
   - Expense Claims
   - Recruitment Pipeline
   - Onboarding Checklists
   - Exit Management
   - Grievance/Helpdesk

### Admin Configuration
- Rules engine UI for leave/attendance/payroll policies
- Approval workflow builder
- Shift templates and rosters
- Holiday calendar management
- Contractor management

### Reports & Analytics
- Custom report builder
- Dashboard widgets customization
- Export to PDF/Excel

## Demo Credentials
- Email: admin@nexushr.com
- Password: Admin@123
- Role: Super Admin

## Tech Stack
- Backend: FastAPI + MongoDB
- Frontend: React + Tailwind + Shadcn UI
- Auth: JWT + Emergent Google OAuth
- Design: "Soft Utility" theme with Manrope + Public Sans fonts
