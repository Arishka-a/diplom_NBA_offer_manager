import api from './api';

const logService = {
  // Получить список логов
  getLogs: async (params = {}) => {
    const response = await api.get('/logs', { params });
    return response.data;
  },

  // Получить историю изменений сущности
  getEntityHistory: async (entityType, entityId) => {
    const response = await api.get(`/history/${entityType}/${entityId}`);
    return response.data;
  },
};

export default logService;
