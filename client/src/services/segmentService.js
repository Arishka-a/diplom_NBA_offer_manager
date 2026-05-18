import api from './api';

const segmentService = {
  // Получить список сегментов
  getSegments: async (params = {}) => {
    const response = await api.get('/segments', { params });
    return response.data;
  },

  // Получить сегмент по ID
  getSegmentById: async (id) => {
    const response = await api.get(`/segments/${id}`);
    return response.data;
  },

  // Создать новый сегмент
  createSegment: async (segmentData) => {
    const response = await api.post('/segments', segmentData);
    return response.data;
  },

  // Обновить сегмент
  updateSegment: async (id, segmentData) => {
    const response = await api.put(`/segments/${id}`, segmentData);
    return response.data;
  },

  // Удалить сегмент
  deleteSegment: async (id) => {
    const response = await api.delete(`/segments/${id}`);
    return response.data;
  },
};

export default segmentService;
