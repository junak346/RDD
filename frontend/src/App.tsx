import { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { PublicLayout } from './components/layout/PublicLayout';
import { Spinner } from './components/ui/Spinner';
import { OfficialAuthProvider, useOfficialAuth } from './stores/officialAuth';
import { useAuth } from './stores/auth';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AnalyzePage } from './pages/AnalyzePage';
import { CameraReportPage } from './pages/CameraReportPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HistoryPage } from './pages/HistoryPage';
import { InspectionDetailPage } from './pages/InspectionDetailPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OfficialAdminPage, OfficialDepartmentsPage, OfficialOfficialsPage } from './pages/OfficialAdminPage';
import { OfficialAnalyticsPage } from './pages/OfficialAnalyticsPage';
import { OfficialAuditPage } from './pages/OfficialAuditPage';
import { OfficialDashboardPage } from './pages/OfficialDashboardPage';
import { OfficialHotspotsPage, OfficialMapPage } from './pages/OfficialMapPage';
import { OfficialIncidentsPage } from './pages/OfficialIncidentsPage';
import { OfficialLoginPage } from './pages/OfficialLoginPage';
import { OfficialNotificationsPage } from './pages/OfficialNotificationsPage';
import { OfficialReportDetailPage } from './pages/OfficialReportDetailPage';
import { OfficialReportsPage } from './pages/OfficialReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportSuccessPage } from './pages/ReportSuccessPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TrackPage } from './pages/TrackPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Loading session" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <AppShell>{children}</AppShell>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Loading session" />
      </div>
    );
  }
  if (user) return <Navigate to="/app" replace />;
  return <PublicLayout>{children}</PublicLayout>;
}

/** Frontend guard only — every official API independently re-checks the server-side session/RBAC. */
function OfficialProtected({ children }: { children: ReactNode }) {
  const { official, loading } = useOfficialAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Checking official session" />
      </div>
    );
  }
  if (!official) {
    return <Navigate to="/official-access" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function App() {
  const location = useLocation();
  const officialArea =
    location.pathname === '/official-access' ||
    location.pathname === '/official' ||
    location.pathname.startsWith('/official/');

  return (
    <OfficialAuthProvider enabled={officialArea}>
      <Routes>
        {/* Anonymous citizen flow — no login or account required. */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/report" element={<CameraReportPage />} />
        <Route path="/report/success/:publicId" element={<ReportSuccessPage />} />
        <Route path="/track" element={<TrackPage />} />

        {/* Legacy authenticated tooling kept temporarily for API compatibility. */}
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicLayout>
              <ForgotPasswordPage />
            </PublicLayout>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicLayout>
              <ResetPasswordPage />
            </PublicLayout>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/analyze"
          element={
            <ProtectedRoute>
              <AnalyzePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/inspections/:id"
          element={
            <ProtectedRoute>
              <InspectionDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Private portal: unadvertised route + mandatory server-side auth/RBAC. */}
        <Route path="/official-access" element={<OfficialLoginPage />} />
        <Route path="/official" element={<OfficialProtected><OfficialDashboardPage /></OfficialProtected>} />
        <Route path="/official/reports" element={<OfficialProtected><OfficialReportsPage /></OfficialProtected>} />
        <Route path="/official/reports/:id" element={<OfficialProtected><OfficialReportDetailPage /></OfficialProtected>} />
        <Route path="/official/map" element={<OfficialProtected><OfficialMapPage /></OfficialProtected>} />
        <Route path="/official/hotspots" element={<OfficialProtected><OfficialHotspotsPage /></OfficialProtected>} />
        <Route path="/official/incidents" element={<OfficialProtected><OfficialIncidentsPage /></OfficialProtected>} />
        <Route path="/official/analytics" element={<OfficialProtected><OfficialAnalyticsPage /></OfficialProtected>} />
        <Route path="/official/notifications" element={<OfficialProtected><OfficialNotificationsPage /></OfficialProtected>} />
        <Route path="/official/audit" element={<OfficialProtected><OfficialAuditPage /></OfficialProtected>} />
        <Route path="/official/admin" element={<OfficialProtected><OfficialAdminPage /></OfficialProtected>} />
        <Route path="/official/departments" element={<OfficialProtected><OfficialDepartmentsPage /></OfficialProtected>} />
        <Route path="/official/officials" element={<OfficialProtected><OfficialOfficialsPage /></OfficialProtected>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </OfficialAuthProvider>
  );
}
