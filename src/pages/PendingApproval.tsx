import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { AuthLayout } from '../components/AuthLayout';
import { logout } from '../auth';
import { useTranslation } from '../utils/i18n';

export function PendingApproval() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const handleContact = () => {
    navigate('/contact');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <AuthLayout 
      title={t('pending_title')} 
      subtitle={t('pending_subtitle')}
    >
      <div className="flex-col flex-center gap-16" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏳</div>
        
        <h3 className="text-amber">{t('pending_not_verified')}</h3>
        <p className="text-2 text-sm" style={{ lineHeight: 1.5 }}>
          {t('pending_desc').replace('{email}', user.email)}
        </p>
        
        <div className="divider w-full" />
        
        <button 
          className="btn btn-primary btn-full mb-8" 
          onClick={handleContact}
          style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '10px 16px' }}
        >
          {t('pending_contact_whatsapp')}
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
