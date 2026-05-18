import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError('Токен восстановления не найден в URL. Проверьте ссылку из email.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Валидация пароля
    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!token) {
      setError('Токен восстановления отсутствует');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/reset-password`,
        {
          token,
          newPassword
        }
      );

      if (response.data.success) {
        setMessage(response.data.message);
        setPasswordReset(true);

        // Перенаправление на страницу входа через 3 секунды
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(
        err.response?.data?.message ||
        'Ошибка при сбросе пароля. Токен может быть недействительным или истёкшим.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (password.length === 0) return { strength: 0, text: '' };
    if (password.length < 6) return { strength: 1, text: 'Слабый', color: '#dc3545' };
    if (password.length < 10) return { strength: 2, text: 'Средний', color: '#ffc107' };
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { strength: 3, text: 'Сильный', color: '#28a745' };
    }
    return { strength: 2, text: 'Средний', color: '#ffc107' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Установка нового пароля</h1>
        <p className="auth-subtitle">Введите новый пароль для вашей учетной записи</p>

        {passwordReset ? (
          <div className="success-message" style={{ textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              background: '#28a745',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              margin: '0 auto 20px'
            }}>✓</div>
            <h2 style={{ marginBottom: '10px' }}>Пароль успешно изменён!</h2>
            <p style={{ marginBottom: '10px' }}>{message}</p>
            <p style={{ color: '#6c757d', fontSize: '14px', marginTop: '10px' }}>
              Вы будете перенаправлены на страницу входа через несколько секунд...
            </p>
            <div className="auth-footer">
              <Link to="/login">Войти сейчас →</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="newPassword">Новый пароль</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                disabled={loading || !token}
              />
              {newPassword && (
                <div className="password-strength">
                  <div
                    className="password-strength-bar"
                    style={{
                      width: `${(passwordStrength.strength / 3) * 100}%`,
                      backgroundColor: passwordStrength.color
                    }}
                  />
                  <span style={{ color: passwordStrength.color }}>
                    {passwordStrength.text}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Подтвердите пароль</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                required
                disabled={loading || !token}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="field-error">Пароли не совпадают</span>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !token || newPassword !== confirmPassword}
              style={{ width: '100%' }}
            >
              {loading ? 'Сохранение...' : 'Установить новый пароль'}
            </button>

            <div className="auth-footer">
              <Link to="/login">← Вернуться на страницу входа</Link>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .password-strength {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .password-strength-bar {
          height: 4px;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .password-strength span {
          font-size: 12px;
          font-weight: 500;
        }

        .field-error {
          color: var(--status-error);
          font-size: 12px;
          margin-top: 4px;
          display: block;
        }

        .success-icon {
          width: 56px;
          height: 56px;
          background: var(--status-active);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 20px;
        }

        .info-text {
          color: var(--text-medium);
          font-size: 14px;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
