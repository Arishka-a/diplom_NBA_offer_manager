import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Проверка роли, если требуется
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="access-denied-container">
        <div className="access-denied">
          <h2>⛔ Доступ запрещён</h2>
          <p>У вас нет прав для просмотра этой страницы.</p>
          <p>Требуется роль: <strong>{requiredRole}</strong></p>
          <p>Ваша роль: <strong>{user?.role || 'Не определена'}</strong></p>
          <button onClick={() => window.history.back()} className="btn-secondary">
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
