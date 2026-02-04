import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

// Pages
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import EmployeeProfile from "./pages/EmployeeProfile";
import Employee360Page from "./pages/Employee360Page";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import SettingsPage from "./pages/SettingsPage";
import PayrollPage from "./pages/PayrollPage";
import PerformancePage from "./pages/PerformancePage";
import AssetsPage from "./pages/AssetsPage";
import ExpensesPage from "./pages/ExpensesPage";
import BulkImportPage from "./pages/BulkImportPage";
import MasterSetupPage from "./pages/MasterSetupPage";
import HelpdeskPage from "./pages/HelpdeskPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import OnboardingPage from "./pages/OnboardingPage";
import ReportsPage from "./pages/ReportsPage";
import ContractLabourPage from "./pages/ContractLabourPage";
import DocumentsPage from "./pages/DocumentsPage";
import ReportBuilderPage from "./pages/ReportBuilderPage";
import UserManagementPage from "./pages/UserManagementPage";
import TrainingPage from "./pages/TrainingPage";
import TravelPage from "./pages/TravelPage";
import TourManagementPage from "./pages/TourManagementPage";
import DataManagementPage from "./pages/DataManagementPage";
import BiometricPage from "./pages/BiometricPage";
import InsurancePage from "./pages/InsurancePage";
import HolidayManagementPage from "./pages/HolidayManagementPage";
import SOPPage from "./pages/SOPPage";
import MyCalendarPage from "./pages/MyCalendarPage";

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// App Router - Handles session_id detection synchronously
function AppRouter() {
  const location = useLocation();

  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions with ProtectedRoute
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Login as default - redirect to dashboard if authenticated */}
      <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      
      {/* Protected Routes with Dashboard Layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<EmployeeDirectory />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="employee/:employeeId" element={<Employee360Page />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="import" element={<BulkImportPage />} />
        <Route path="master-setup" element={<MasterSetupPage />} />
        <Route path="helpdesk" element={<HelpdeskPage />} />
        <Route path="recruitment" element={<RecruitmentPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="labour" element={<ContractLabourPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="report-builder" element={<ReportBuilderPage />} />
        <Route path="user-management" element={<UserManagementPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="travel" element={<TravelPage />} />
        <Route path="tours" element={<TourManagementPage />} />
        <Route path="tour-management" element={<TourManagementPage />} />
        <Route path="data-management" element={<DataManagementPage />} />
        <Route path="biometric" element={<BiometricPage />} />
        <Route path="insurance" element={<InsurancePage />} />
        <Route path="holidays" element={<HolidayManagementPage />} />
        <Route path="sop" element={<SOPPage />} />
        <Route path="my-calendar" element={<MyCalendarPage />} />
        <Route path="calendar" element={<MyCalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
