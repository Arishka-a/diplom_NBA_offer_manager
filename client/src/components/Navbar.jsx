import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = ({ collapsed = false, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = (user?.username || '?').charAt(0).toUpperCase();

  return (
    <>
      <aside className="sidebar">
        <NavLink to="/dashboard" className="sidebar-logo">
          {collapsed ? 'N' : <>NBA <span>Offers</span></>}
        </NavLink>

        <nav className="sidebar-menu">
          <NavLink to="/dashboard" className="sidebar-link" title="Дашборд">
            <span className="sidebar-icon">▤</span>
            <span className="sidebar-label">Дашборд</span>
          </NavLink>
          <NavLink to="/offers" className="sidebar-link" title="Офферы">
            <span className="sidebar-icon">◈</span>
            <span className="sidebar-label">Офферы</span>
          </NavLink>
          <NavLink to="/segments" className="sidebar-link" title="Сегменты">
            <span className="sidebar-icon">◐</span>
            <span className="sidebar-label">Сегменты</span>
          </NavLink>
          <NavLink to="/customers" className="sidebar-link" title="Клиенты">
            <span className="sidebar-icon">◉</span>
            <span className="sidebar-label">Клиенты</span>
          </NavLink>
          <NavLink to="/nba" className="sidebar-link" title="NBA Рекомендации">
            <span className="sidebar-icon">★</span>
            <span className="sidebar-label">NBA Рекомендации</span>
          </NavLink>
          <NavLink to="/rules" className="sidebar-link" title="Правила">
            <span className="sidebar-icon">⚙</span>
            <span className="sidebar-label">Правила</span>
          </NavLink>
          <NavLink to="/reports" className="sidebar-link" title="Отчёты">
            <span className="sidebar-icon">▦</span>
            <span className="sidebar-label">Отчёты</span>
          </NavLink>
          <NavLink to="/import" className="sidebar-link" title="Импорт">
            <span className="sidebar-icon">↧</span>
            <span className="sidebar-label">Импорт</span>
          </NavLink>
          <NavLink to="/export" className="sidebar-link" title="Экспорт">
            <span className="sidebar-icon">↥</span>
            <span className="sidebar-label">Экспорт</span>
          </NavLink>
          <NavLink to="/logs" className="sidebar-link" title="Логи">
            <span className="sidebar-icon">▣</span>
            <span className="sidebar-label">Логи</span>
          </NavLink>
          {user?.role === 'Administrator' && (
            <NavLink
              to="/users"
              className="sidebar-link sidebar-link-admin"
              title="Пользователи"
            >
              <span className="sidebar-icon">◆</span>
              <span className="sidebar-label">Пользователи</span>
            </NavLink>
          )}
        </nav>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <span className="sidebar-collapse-icon">{collapsed ? '»' : '«'}</span>
          {!collapsed && <span className="sidebar-collapse-label">Свернуть</span>}
        </button>
      </aside>

      <header className="topbar">
        <div className="topbar-spacer" />
        <div className="topbar-user" ref={userMenuRef}>
          <button
            type="button"
            className="topbar-user-btn"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            <span className="topbar-avatar">{initial}</span>
            <span className="topbar-username">{user?.username}</span>
            <span className="topbar-caret">▾</span>
          </button>
          {userMenuOpen && (
            <div className="topbar-dropdown">
              <div className="topbar-dropdown-info">
                Роль: <strong>{user?.role || '—'}</strong>
              </div>
              <div className="topbar-dropdown-divider" />
              <button
                type="button"
                className="topbar-dropdown-item"
                onClick={handleLogout}
              >
                <span className="topbar-dropdown-icon">⎋</span>
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
