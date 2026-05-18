import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import './Layout.css';

const STORAGE_KEY = 'nba_sidebar_collapsed';

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      <Navbar collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      <main className="layout-content">{children}</main>
    </div>
  );
};

export default Layout;
