import api from './api';

/**
 * Получить рекомендованные офферы для клиента
 * @param {number} customerId - ID клиента
 * @param {number} limit - Количество рекомендаций
 */
export const getRecommendations = async (customerId, limit = 3) => {
  const response = await api.get(`/nba/recommendations/${customerId}`, {
    params: { limit }
  });
  return response.data;
};

/**
 * Записать показ оффера
 * @param {number} customerId - ID клиента
 * @param {number} offerId - ID оффера
 * @param {string} channel - Канал показа
 */
export const recordOfferShown = async (customerId, offerId, channel = 'web') => {
  const response = await api.post('/nba/record-shown', {
    customer_id: customerId,
    offer_id: offerId,
    channel
  });
  return response.data;
};

/**
 * Обновить статус оффера (принят/отклонен)
 * @param {number} historyId - ID записи в истории
 * @param {string} status - Статус ('accepted' или 'rejected')
 */
export const updateOfferStatus = async (historyId, status) => {
  const response = await api.put(`/nba/update-status/${historyId}`, { status });
  return response.data;
};

/**
 * Получить статистику NBA для клиента
 * @param {number} customerId - ID клиента
 */
export const getCustomerStats = async (customerId) => {
  const response = await api.get(`/nba/stats/${customerId}`);
  return response.data;
};

/**
 * Получить рекомендованные офферы для сегмента
 * @param {number|null} segmentId - ID сегмента (null для всех клиентов)
 * @param {number} limit - Количество рекомендаций
 */
export const getSegmentRecommendations = async (segmentId, limit = 5) => {
  const segmentParam = segmentId === null ? 'null' : segmentId;
  const response = await api.get(`/nba/recommendations/segment/${segmentParam}`, {
    params: { limit }
  });
  return response.data;
};

/**
 * Получить статистику NBA для сегмента
 * @param {number} segmentId - ID сегмента
 */
export const getSegmentStats = async (segmentId) => {
  const response = await api.get(`/nba/stats/segment/${segmentId}`);
  return response.data;
};

export default {
  getRecommendations,
  recordOfferShown,
  updateOfferStatus,
  getCustomerStats,
  getSegmentRecommendations,
  getSegmentStats
};
