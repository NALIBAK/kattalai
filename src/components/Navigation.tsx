import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/i18n';

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', icon: '📖', label: t('nav_book') },
    { path: '/devotees', icon: '👥', label: t('nav_devotees') },
    { path: '/profile', icon: '👤', label: t('nav_profile') }
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

