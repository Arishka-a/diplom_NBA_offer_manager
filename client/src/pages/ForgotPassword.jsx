import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email адрес');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/request-password-reset`,
        { email }
      );

      if (response.data.success) {
        setMessage(response.data.message);
        setEmailSent(true);
        setEmail('');
      }
    } catch (err) {
      console.error('Password reset request error:', err);
      setError(
        err.response?.data?.message ||
        'Ошибка при отправке запроса. Попробуйте позже.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Восстановление пароля</h1>
        <p className="auth-subtitle">Введите ваш email для получения ссылки восстановления</p>

        {emailSent ? (
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
            <h2 style={{ marginBottom: '10px' }}>Письмо отправлено!</h2>
            <p style={{ marginBottom: '10px' }}>{message}</p>
            <p style={{ color: '#6c757d', fontSize: '14px', marginTop: '10px' }}>
              Проверьте папку "Спам", если письмо не пришло в течение нескольких минут.
            </p>
            <div className="auth-footer">
              <Link to="/login">← Вернуться на страницу входа</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="form-group">
              <label htmlFor="email">Email адрес</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </button>

            <div className="auth-footer">
              <Link to="/login">← Вернуться на страницу входа</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
