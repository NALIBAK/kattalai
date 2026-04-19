import { useNavigate, useLocation } from 'react-router-dom';

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '📊', label: 'Home' },
    { path: '/devotees', icon: '👥', label: 'Devotees' },
    { path: '/broadcast', icon: '📢', label: 'Broadcast' },
    { path: '/print', icon: '🖨️', label: 'Print' },
    { path: '/settings', icon: '⚙️', label: 'Settings' }
  ];

  return (
    <div className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <div 
            key={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <div className="nav-icon">{item.icon}</div>
            <span>{item.label}</span>
            {/* Optional badge placeholder: {item.path === '/devotees' && <div className="nav-badge">3</div>} */}
          </div>
        );
      })}
    </div>
  );
}
