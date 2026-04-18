import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { useAuthStore } from '../store';

export function AppLayout() {
  const { user } = useAuthStore();
  
  return (
    <div className="page-container">
      {/* Top Header */}
      <header className="page-header flex-between">
        <div className="flex-center gap-8">
          <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🛕
          </div>
          <span className="fw-700">KATTALAI</span>
        </div>
        
        {user && (
          <img 
            src={user.picture} 
            alt={user.name} 
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} 
            referrerPolicy="no-referrer"
          />
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
