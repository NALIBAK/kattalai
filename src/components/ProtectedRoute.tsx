import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';
import { validateCachedAuth, isSubscriptionExpired } from '../auth';

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

  // Check cache validity (detect tampering or offline too long)
  const status = validateCachedAuth(cache);
  
  if (status === 'expired') {
    // Cache itself is invalid (tampered or 37+ days offline) — re-login
    return <Navigate to="/login" replace />;
  }

  // Check if the actual subscription from the sheet has expired (plus/pro only)
  if (isSubscriptionExpired(cache)) {
    return <Navigate to="/expired" replace />;
  }

  // Valid or Grace period — allow access
  return <Outlet />;
}
