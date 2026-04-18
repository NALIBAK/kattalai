import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore } from '../store';
import { initGoogleAuth, signInWithGoogle, verifyAccess, validateCachedAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';

export function Login() {
  const navigate = useNavigate();
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
      showToast('Failed to load Google Sign-In', 'error');
    });
  }, [cache, navigate, showToast]);

  const handleLogin = async () => {
    try {
      setIsSigningIn(true);
      const user = await signInWithGoogle();
      setUser(user);
      
      const newCache = await verifyAccess(user.email);
      if (newCache) {
        setCache(newCache);
        showToast(`Welcome back, ${user.name}!`, 'success');
        navigate('/');
      } else {
        navigate('/pending');
      }
    } catch (error: any) {
      if (error.message !== 'No credential') {
        showToast(error.message || 'Login failed', 'error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <AuthLayout 
      title="LOGIN" 
      subtitle="Chidambaram Natarajar Temple Pooja Management"
    >
      <div className="flex-col gap-16">
        <div id="google-signin-btn" className="flex-center w-full min-h-[44px]"></div>
        
        <button 
          className="btn btn-primary btn-full btn-lg" 
          onClick={handleLogin}
          disabled={isSigniningIn}
        >
          {isSigniningIn ? (
            <><span className="nav-icon animate-spin">⟳</span> Signing in...</>
          ) : (
            'Sign In with Google'
          )}
        </button>
      </div>
    </AuthLayout>
  );
}
