import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShell } from '../context/ShellContext';

export default function ProtectedRoute({
  allowedRoles = [],
  requiredWorkPart = '',
  children,
}) {
  const location = useLocation();
  const { isAuthenticated, isLoading, hasRole, hasWorkPart, getRoleHomeRoute } = useAuth();
  const { addToast } = useShell();
  const lastDeniedPathRef = useRef('');

  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const hasRequirements = allowedRoles.length > 0 || Boolean(requiredWorkPart);
  const roleAllowed = hasRole(...allowedRoles);
  const workPartAllowed = requiredWorkPart ? hasWorkPart(requiredWorkPart) : false;
  const isAuthorized =
    isAuthenticated &&
    (!hasRequirements || isSuperAdmin || (requiredWorkPart ? roleAllowed || workPartAllowed : roleAllowed));

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAuthorized) {
      if (lastDeniedPathRef.current !== location.pathname) {
        lastDeniedPathRef.current = location.pathname;
        addToast({
          type: 'warning',
          title: 'Access restricted',
          message: 'You were redirected to your assigned workspace.',
        });
      }
    }
  }, [isLoading, isAuthenticated, isAuthorized, location.pathname, addToast]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)]" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (!isAuthorized) {
    return <Navigate to={getRoleHomeRoute()} replace />;
  }

  return children || <Outlet />;
}
