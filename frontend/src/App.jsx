import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { RouteLoader } from './components/layout/Topbar';
import { ProtectedRoute, PublicOnlyRoute } from './components/routing/RouteGuards';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

// Feature routes are split so the public pages load without pulling in the
// whole authenticated application (and its chart bundle).
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Support = lazy(() => import('./pages/Support'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const Team = lazy(() => import('./pages/Team'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Activity = lazy(() => import('./pages/Activity'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <ThemeSync />
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                {/* Public */}
                <Route element={<PublicOnlyRoute />}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                {/* Authenticated */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<AppShell />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />

                    <Route path="leads" element={<Leads />} />
                    <Route path="leads/:id" element={<LeadDetail />} />

                    <Route path="customers" element={<Customers />} />
                    <Route path="customers/:id" element={<CustomerDetail />} />

                    <Route path="tasks" element={<Tasks />} />

                    <Route path="support" element={<Support />} />
                    <Route path="support/:id" element={<TicketDetail />} />

                    <Route path="analytics" element={<Analytics />} />
                    <Route path="team" element={<Team />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="activity" element={<Activity />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

/**
 * Adopts the theme saved on the account the first time a user signs in on a
 * device. An explicit choice already in localStorage always wins, so switching
 * themes locally is never silently overwritten.
 */
function ThemeSync() {
  const { user, status } = useAuth();
  const { mode, setTheme } = useTheme();

  useEffect(() => {
    if (status !== 'ready' || !user?.theme_preference) return;

    let hasLocalChoice = false;
    try {
      hasLocalChoice = Boolean(localStorage.getItem('nexora.theme'));
    } catch {
      hasLocalChoice = false;
    }

    if (!hasLocalChoice) setTheme(user.theme_preference);
  }, [user, status, mode, setTheme]);

  return null;
}