import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore } from '../store';
import { initGoogleAuth, signInWithGoogle, verifyAccess, validateCachedAuth, isSubscriptionExpired } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { useTranslation } from '../utils/i18n';

export function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setUser, setCache, cache } = useAuthStore();
  const { showToast } = useToastStore();
  const [isSigniningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // Check if valid cache exists
    if (cache) {
      const status = validateCachedAuth(cache);
      if (status === 'valid' || status === 'grace') {
        navigate('/');
        return;
      }
    }
    
    initGoogleAuth().catch(e => {
      console.error('Failed to load Google Auth API', e);
      showToast(t('login_failed'), 'error');
    });
  }, [cache, navigate, showToast, t]);

  const handleLogin = async () => {
    try {
      setIsSigningIn(true);
      const user = await signInWithGoogle();
      setUser(user);
      
      const newCache = await verifyAccess(user.email, user.name, user.picture);
      if (newCache) {
        setCache(newCache);
        if (isSubscriptionExpired(newCache)) {
          navigate('/expired');
        } else {
          const welcomeMsg = t('save') === 'சேமி' ? `நல்வரவு, ${user.name}!` : `Welcome back, ${user.name}!`;
          showToast(welcomeMsg, 'success');
          navigate('/');
        }
      } else {
        navigate('/pending');
      }
    } catch (error) {
      const err = error as { message?: string };
      if (err.message !== 'No credential') {
        showToast(err.message || t('login_failed'), 'error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <AuthLayout 
      title={t('login_title')} 
      subtitle={t('login_subtitle')}
    >
      <div className="flex-col gap-16">
        <div id="google-signin-btn" className="flex-center w-full min-h-[44px]"></div>
        
        <button 
          className="btn btn-primary btn-full btn-lg" 
          onClick={handleLogin}
          disabled={isSigniningIn}
          style={{ whiteSpace: 'normal', height: 'auto', minHeight: '52px', padding: '12px' }}
        >
          {isSigniningIn ? (
            <><span className="nav-icon animate-spin">⟳</span> {t('login_signing_in')}</>
          ) : (
            t('login_btn')
          )}
        </button>
      </div>
    </AuthLayout>
  );
}
