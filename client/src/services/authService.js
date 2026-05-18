import api from './api';

const authService = {
  // Регистрация нового пользователя
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.data?.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Вход пользователя
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.data?.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Выход пользователя
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  // Получить профиль пользователя
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Проверить авторизацию
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Получить текущего пользователя
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

export default authService;
