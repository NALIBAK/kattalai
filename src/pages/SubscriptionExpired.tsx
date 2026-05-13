import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore } from '../store';
import { verifyAccess, isSubscriptionExpired, logout } from '../auth';
import { AuthLayout } from '../components/AuthLayout';

const ADMIN_WHATSAPP = '+916381367661';

export function SubscriptionExpired() {
  const navigate = useNavigate();
  const { user, cache, setCache, logout: storeLogout } = useAuthStore();
  const { showToast } = useToastStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!user?.email) return;
    try {
      setIsRefreshing(true);
      const newCache = await verifyAccess(user.email, user.name, user.picture);
      
      if (newCache) {
        setCache(newCache);
        if (!isSubscriptionExpired(newCache)) {
          showToast(`Welcome back! Plan: ${newCache.plan.toUpperCase()}`, 'success');
          navigate('/');
        } else {
          showToast('Subscription is still expired.', 'error');
        }
      } else {
        showToast('Account not found. Contact admin.', 'error');
      }
    } catch (e) {
      showToast('Connection error. Please try again.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleContact = () => {
    const message = encodeURIComponent(
      `Hi, my Kattalai subscription has expired.\n\nEmail: ${user?.email || 'N/A'}\nPlan: ${cache?.plan?.toUpperCase() || 'N/A'}\nExpired On: ${cache?.real_expiry || 'N/A'}\n\nPlease help me renew.`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP.replace('+', '')}?text=${message}`, '_blank');
  };

  const handleLogout = async () => {
    await logout();
    storeLogout();
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <AuthLayout 
      title="SUBSCRIPTION EXPIRED" 
      subtitle="Your plan needs renewal"
    >
      <div className="flex-col flex-center gap-16" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏰</div>
        
        <h3 style={{ color: 'var(--red, #e74c3c)' }}>Plan Expired</h3>
        <p className="text-2 text-sm" style={{ lineHeight: 1.6 }}>
          Your subscription has ended. Please contact the admin to renew your plan and continue using all features.
        </p>

        {/* Subscription Info Card */}
        <div style={{ 
          width: '100%', 
          background: 'var(--surface-2)', 
          padding: 16, 
          borderRadius: 8, 
          textAlign: 'left',
          border: '1px solid var(--border, #333)'
        }}>
          <div style={{ marginBottom: 12 }}>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>EMAIL</div>
            <div className="fw-600 truncate">{user.email}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>PLAN</div>
            <div className="fw-600" style={{ textTransform: 'uppercase', color: 'var(--gold)' }}>
              {cache?.plan || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>EXPIRED ON</div>
            <div className="fw-600" style={{ color: 'var(--red, #e74c3c)' }}>
              {cache?.real_expiry || 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="divider w-full" />
        
        <button className="btn btn-primary btn-full mb-8" onClick={handleContact}>
          <span style={{ fontSize: '1.25rem' }}>💬</span> Contact Admin on WhatsApp
        </button>

        <button 
          className="btn btn-full mb-8" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{ 
            background: 'var(--surface-2)', 
            color: 'var(--gold)', 
            border: '1px solid var(--gold)' 
          }}
        >
          {isRefreshing ? (
            <><span className="nav-icon animate-spin">⟳</span> Checking...</>
          ) : (
            '🔄 Refresh Subscription Status'
          )}
        </button>
        
        <button className="btn btn-ghost btn-full" onClick={handleLogout}>
          Use a different account
        </button>
      </div>
    </AuthLayout>
  );
}
