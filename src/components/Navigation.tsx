import { useNavigate, useLocation } from 'react-router-dom';

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '📖', label: 'Book' },
    { path: '/devotees', icon: '👥', label: 'Devotees' },
    { path: '/profile', icon: '👤', label: 'Profile' }
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
          </div>
        );
      })}
    </div>
  );
}

