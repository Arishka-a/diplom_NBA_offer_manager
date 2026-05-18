import api from './api';

/**
 * Сервис для работы с пользователями
 */

/**
 * Получить список всех пользователей
 */
export const getUsers = async (params = {}) => {
  const response = await api.get('/users', { params });
  return response.data;
};

/**
 * Получить пользователя по ID
 */
export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

/**
 * Создать нового пользователя (только администратор)
 */
export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};

/**
 * Обновить данные пользователя
 */
export const updateUser = async (id, userData) => {
  const response = await api.put(`/users/${id}`, userData);
  return response.data;
};

/**
 * Изменить роль пользователя
 */
export const changeUserRole = async (id, roleId) => {
  const response = await api.patch(`/users/${id}/role`, { role_id: roleId });
  return response.data;
};

/**
 * Активировать/деактивировать пользователя
 */
export const toggleUserStatus = async (id) => {
  const response = await api.patch(`/users/${id}/status`);
  return response.data;
};

/**
 * Удалить пользователя
 */
export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

/**
 * Получить список доступных ролей
 */
export const getRoles = async () => {
  const response = await api.get('/roles');
  return response.data;
};

/**
 * Константы для ролей
 */
export const ROLES = {
  OPERATOR: 'Operator',
  ADMINISTRATOR: 'Administrator'
};

/**
 * Функция для отображения имени роли на русском
 */
export const getRoleDisplayName = (roleName) => {
  const roleNames = {
    'Operator': 'Оператор',
    'Administrator': 'Администратор'
  };
  return roleNames[roleName] || roleName;
};

/**
 * Функция для получения бейджа статуса пользователя
 */
export const getUserStatusBadge = (isActive) => {
  return isActive ? 'Активен' : 'Деактивирован';
};

/**
 * Функция для форматирования даты последнего входа
 */
export const formatLastLogin = (lastLogin) => {
  if (!lastLogin) return 'Никогда';

  const date = new Date(lastLogin);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;

  return date.toLocaleDateString('ru-RU');
};

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserRole,
  toggleUserStatus,
  deleteUser,
  getRoles,
  getRoleDisplayName,
  getUserStatusBadge,
  formatLastLogin
};
