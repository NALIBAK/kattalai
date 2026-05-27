import { Outlet, Link } from 'react-router-dom';
import { Navigation } from './Navigation';
import { useAuthStore } from '../store';

export function AppLayout() {
  const { user } = useAuthStore();
  
  return (
    <div className="page-container">
      {/* Top Header */}
      <header className="page-header flex-between">
        <Link to="/about" className="logo-link">
          <div className="logo-icon" style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000', transition: 'background 0.2s var(--ease), box-shadow 0.2s var(--ease)' }}>
            ॐ
          </div>
          <span className="fw-700 logo-text" style={{ transition: 'color 0.2s var(--ease)' }}>KATTALAI</span>
        </Link>
        
        {user && (
          <Link to="/profile">
            <img 
              src={user.picture} 
              alt={user.name} 
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} 
              referrerPolicy="no-referrer"
            />
          </Link>
        )}
      </header>
      
      {/* Main Page Content */}
      <main className="page">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <Navigation />
    </div>
  );
}
