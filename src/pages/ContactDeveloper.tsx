import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export function ContactDeveloper() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="flex-col flex-center p-24" style={{ minHeight: '80dvh', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>👨‍💻</div>
      
      <h2 className="mb-16">Contact Developer</h2>
      
      <div className="card w-full" style={{ maxWidth: 400, border: '1px solid var(--gold)' }}>
        <p className="text-2 mb-20" style={{ lineHeight: 1.6 }}>
          To upgrade your plan, approve your account, or request technical support, please contact:
        </p>
        
        <h3 className="text-gold mb-8">S.S.Kabilan Deekshithar</h3>
        
        <div className="divider" style={{ margin: '20px 0' }} />
        
        <div style={{ textAlign: 'left', background: 'var(--surface-2)', padding: 16, borderRadius: 8 }}>
          <div className="text-xs text-muted mb-4">YOUR REGISTERED EMAIL</div>
          <div className="fw-600 truncate" style={{ fontSize: '1.1rem' }}>
            {user?.email || 'Not Logged In'}
          </div>
          <p className="text-xs text-muted mt-8">
            Please provide this email to the developer for account identification.
          </p>
        </div>
      </div>

      <button 
        className="btn btn-ghost mt-24" 
        onClick={() => navigate(-1)}
      >
        ← Go Back
      </button>
    </div>
  );
}
