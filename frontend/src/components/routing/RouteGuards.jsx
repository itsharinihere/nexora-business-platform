import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { RouteLoader } from '../layout/Topbar';
import { Logo } from '../layout/Logo';

/**
 * Gate for authenticated routes.
 *
 * While the stored token is still being verified it shows a loader rather than
 * redirecting, otherwise a page refresh would bounce a signed-in user to the
 * login screen on every visit.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Inverse gate: keeps a signed-in user out of login/register. */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
}

/** Restricts a route to specific roles; everyone else goes to the dashboard. */
export function RoleGate({ roles = [] }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user.role_name)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <Logo to={null} size="lg" />
      <RouteLoader />
    </div>
  );
}