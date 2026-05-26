import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore } from '../store';
import { verifyAccess, isSubscriptionExpired, logout } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { useTranslation } from '../utils/i18n';

const ADMIN_WHATSAPP = '+916381367661';

export function SubscriptionExpired() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          const welcomeMsg = t('save') === 'சேமி' ? `மீண்டும் நல்வரவு! திட்டம்: ${newCache.plan.toUpperCase()}` : `Welcome back! Plan: ${newCache.plan.toUpperCase()}`;
          showToast(welcomeMsg, 'success');
          navigate('/');
        } else {
          showToast(t('expired_still_expired'), 'error');
        }
      } else {
        const errorMsg = t('save') === 'சேமி' ? 'கணக்கு கண்டறியப்படவில்லை. நிர்வாகியைத் தொடர்பு கொள்ளவும்.' : 'Account not found. Contact admin.';
        showToast(errorMsg, 'error');
      }
    } catch {
      const errorMsg = t('save') === 'சேமி' ? 'இணைப்பு பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Connection error. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleContact = () => {
    const isTa = t('save') === 'சேமி';
    const message = encodeURIComponent(
      isTa
        ? `வணக்கம், எனது கட்டளை சந்தா காலம் முடிந்துவிட்டது.\n\nமின்னஞ்சல்: ${user?.email || 'N/A'}\nதிட்டம்: ${cache?.plan?.toUpperCase() || 'N/A'}\nகாலாவதியான நாள்: ${cache?.real_expiry || 'N/A'}\n\nதயவுசெய்து புதுப்பிக்க உதவவும்.`
        : `Hi, my Kattalai subscription has expired.\n\nEmail: ${user?.email || 'N/A'}\nPlan: ${cache?.plan?.toUpperCase() || 'N/A'}\nExpired On: ${cache?.real_expiry || 'N/A'}\n\nPlease help me renew.`
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
      title={t('expired_title')} 
      subtitle={t('expired_subtitle')}
    >
      <div className="flex-col flex-center gap-16" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏰</div>
        
        <h3 style={{ color: 'var(--red, #e74c3c)' }}>{t('expired_header')}</h3>
        <p className="text-2 text-sm" style={{ lineHeight: 1.6 }}>
          {t('expired_desc')}
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
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{t('expired_email')}</div>
            <div className="fw-600 truncate">{user.email}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{t('expired_plan')}</div>
            <div className="fw-600" style={{ textTransform: 'uppercase', color: 'var(--gold)' }}>
              {cache?.plan || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{t('expired_expired_on')}</div>
            <div className="fw-600" style={{ color: 'var(--red, #e74c3c)' }}>
              {cache?.real_expiry || 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="divider w-full" />
        
        <button 
          className="btn btn-primary btn-full mb-8" 
          onClick={handleContact}
          style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '10px 16px' }}
        >
          <span style={{ fontSize: '1.25rem' }}>💬</span> {t('pending_contact_whatsapp')}
        </button>

        <button 
          className="btn btn-full mb-8" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{ 
            background: 'var(--surface-2)', 
            color: 'var(--gold)', 
            border: '1px solid var(--gold)',
            whiteSpace: 'normal',
            height: 'auto',
            minHeight: '44px',
            padding: '10px 16px'
          }}
        >
          {isRefreshing ? (
            <><span className="nav-icon animate-spin">⟳</span> {t('expired_checking')}</>
          ) : (
            t('expired_refresh')
          )}
        </button>
        
        <button 
          className="btn btn-ghost btn-full" 
          onClick={handleLogout}
          style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '10px 16px' }}
        >
          {t('pending_different_account')}
        </button>
      </div>
    </AuthLayout>
  );
}
