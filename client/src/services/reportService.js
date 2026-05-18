import api from './api';

/**
 * Получить общую статистику для дашборда
 */
export const getDashboardStats = async () => {
  const response = await api.get('/reports/dashboard');
  return response.data;
};

/**
 * Получить отчет по эффективности офферов
 */
export const getOfferPerformanceReport = async (startDate, endDate) => {
  const response = await api.get('/reports/offers/performance', {
    params: {
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить отчет по типам офферов
 */
export const getOfferTypeReport = async (startDate, endDate) => {
  const response = await api.get('/reports/offers/by-type', {
    params: {
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить топ офферов по конверсии
 */
export const getTopOffersByConversion = async (limit = 10, startDate, endDate) => {
  const response = await api.get('/reports/offers/top-conversion', {
    params: {
      limit,
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить топ офферов по просмотрам
 */
export const getTopOffersByViews = async (limit = 10, startDate, endDate) => {
  const response = await api.get('/reports/offers/top-views', {
    params: {
      limit,
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить отчет по эффективности сегментов
 */
export const getSegmentPerformanceReport = async (startDate, endDate) => {
  const response = await api.get('/reports/segments/performance', {
    params: {
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить распределение клиентов по сегментам
 */
export const getCustomerSegmentDistribution = async () => {
  const response = await api.get('/reports/segments/distribution');
  return response.data;
};

/**
 * Получить тренд взаимодействий с офферами
 */
export const getInteractionsTrendReport = async (startDate, endDate, interval = 'day') => {
  const response = await api.get('/reports/interactions/trend', {
    params: {
      start_date: startDate,
      end_date: endDate,
      interval
    }
  });
  return response.data;
};

/**
 * Получить статистику по клиентам
 */
export const getCustomerStatsReport = async () => {
  const response = await api.get('/reports/customers/stats');
  return response.data;
};

/**
 * Получить отчет по активности пользователей системы
 */
export const getUserActivityReport = async (startDate, endDate) => {
  const response = await api.get('/reports/users/activity', {
    params: {
      start_date: startDate,
      end_date: endDate
    }
  });
  return response.data;
};

/**
 * Получить отчет по правилам NBA
 */
export const getRulesReport = async () => {
  const response = await api.get('/reports/rules');
  return response.data;
};

/**
 * Экспорт аналитического отчёта в PDF
 */
export const exportToPdf = async (startDate, endDate) => {
  try {
    const response = await api.get('/reports/export/pdf', {
      params: {
        start_date: startDate || undefined,
        end_date: endDate || undefined
      },
      responseType: 'blob'
    });

    // Проверяем, что получили PDF, а не JSON с ошибкой
    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      // Это JSON с ошибкой, читаем его
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.message || 'Error generating PDF');
    }

    // Создаём ссылку для скачивания файла
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nba_analytics_report_${new Date().toISOString().split('T')[0]}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
};
