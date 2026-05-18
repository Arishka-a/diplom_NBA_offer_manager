import api from './api';

/**
 * Импорт офферов из файла
 */
export const importOffers = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/import/offers', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * Импорт сегментов из файла
 */
export const importSegments = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/import/segments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * Экспорт офферов
 */
export const exportOffers = async (format = 'csv') => {
  const response = await api.get('/export/offers', {
    params: { format },
    responseType: 'blob'
  });

  return response.data;
};

/**
 * Экспорт сегментов
 */
export const exportSegments = async (format = 'csv') => {
  const response = await api.get('/export/segments', {
    params: { format },
    responseType: 'blob'
  });

  return response.data;
};

/**
 * Экспорт правил
 */
export const exportRules = async (format = 'csv') => {
  const response = await api.get('/export/rules', {
    params: { format },
    responseType: 'blob'
  });

  return response.data;
};

/**
 * Экспорт логов
 */
export const exportLogs = async (format = 'csv', filters = {}) => {
  const response = await api.get('/export/logs', {
    params: { format, ...filters },
    responseType: 'blob'
  });

  return response.data;
};

/**
 * Скачивание файла
 */
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
