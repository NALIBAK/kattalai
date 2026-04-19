import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { AuthLayout } from '../components/AuthLayout';
import { logout } from '../auth';

export function PendingApproval() {
  const navigate = useNavigate();
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
      title="PENDING APPROVAL" 
      subtitle="Access verification required"
    >
      <div className="flex-col flex-center gap-16" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏳</div>
        
        <h3 className="text-amber">Account Not Verified</h3>
        <p className="text-2 text-sm">
          Your email <strong>{user.email}</strong> is not yet approved by the administrator, or your subscription has expired.
        </p>
        
        <div className="divider w-full" />
        
        <button className="btn btn-primary btn-full mb-8" onClick={handleContact}>
          <span style={{ fontSize: '1.25rem' }}>💬</span> Contact Admin on WhatsApp
        </button>
        
        <button className="btn btn-ghost btn-full" onClick={handleLogout}>
          Use a different account
        </button>
      </div>
    </AuthLayout>
  );
}
