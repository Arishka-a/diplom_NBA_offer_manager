import api from './api';

const offerService = {
  // Получить список офферов
  getOffers: async (params = {}) => {
    const response = await api.get('/offers', { params });
    return response.data;
  },

  // Получить оффер по ID
  getOfferById: async (id) => {
    const response = await api.get(`/offers/${id}`);
    return response.data;
  },

  // Создать новый оффер
  createOffer: async (offerData) => {
    const response = await api.post('/offers', offerData);
    return response.data;
  },

  // Обновить оффер
  updateOffer: async (id, offerData) => {
    const response = await api.put(`/offers/${id}`, offerData);
    return response.data;
  },

  // Удалить оффер
  deleteOffer: async (id) => {
    const response = await api.delete(`/offers/${id}`);
    return response.data;
  },
};

export default offerService;
