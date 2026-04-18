import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';
import { validateCachedAuth } from '../auth';

export function ProtectedRoute() {
  const { cache, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: '100dvh' }}>
        <div className="animate-spin" style={{ fontSize: '2rem', color: 'var(--gold)' }}>⏳</div>
      </div>
    );
  }

  // Not logged in or no cache
  if (!cache) {
    return <Navigate to="/login" replace />;
  }

  // Check cache validity (detect tampering or expiration)
  const status = validateCachedAuth(cache);
  
  if (status === 'expired') {
    return <Navigate to="/pending" replace />;
  }

  // Valid or Grace period — allow access
  return <Outlet />;
}
