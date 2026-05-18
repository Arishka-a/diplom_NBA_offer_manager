import api from './api';

/**
 * Сервис для работы с условиями активации офферов
 */

/**
 * Типы условий
 */
export const CONDITION_TYPES = {
  TIME: 'time',
  TRIGGER: 'trigger',
  LIMIT: 'limit',
  CHANNEL: 'channel',
  FREQUENCY: 'frequency'
};

/**
 * Получить список условий для оффера
 */
export const getConditionsByOfferId = async (offerId) => {
  const response = await api.get(`/conditions/offer/${offerId}`);
  return response.data;
};

/**
 * Получить условие по ID
 */
export const getConditionById = async (id) => {
  const response = await api.get(`/conditions/${id}`);
  return response.data;
};

/**
 * Создать новое условие
 */
export const createCondition = async (conditionData) => {
  const response = await api.post('/conditions', conditionData);
  return response.data;
};

/**
 * Обновить условие
 */
export const updateCondition = async (id, conditionData) => {
  const response = await api.put(`/conditions/${id}`, conditionData);
  return response.data;
};

/**
 * Удалить условие
 */
export const deleteCondition = async (id) => {
  const response = await api.delete(`/conditions/${id}`);
  return response.data;
};

/**
 * Получить типы условий (справочник)
 */
export const getConditionTypes = async () => {
  const response = await api.get('/conditions/types');
  return response.data;
};

/**
 * Названия типов условий на русском
 */
export const getConditionTypeName = (type) => {
  const names = {
    [CONDITION_TYPES.TIME]: 'Временные рамки',
    [CONDITION_TYPES.TRIGGER]: 'Триггеры',
    [CONDITION_TYPES.LIMIT]: 'Лимиты',
    [CONDITION_TYPES.CHANNEL]: 'Каналы',
    [CONDITION_TYPES.FREQUENCY]: 'Частота'
  };
  return names[type] || type;
};

/**
 * Иконки для типов условий
 */
export const getConditionTypeIcon = (type) => {
  const icons = {
    [CONDITION_TYPES.TIME]: '',
    [CONDITION_TYPES.TRIGGER]: '',
    [CONDITION_TYPES.LIMIT]: '',
    [CONDITION_TYPES.CHANNEL]: '',
    [CONDITION_TYPES.FREQUENCY]: ''
  };
  return icons[type] || '';
};

/**
 * Форматирование значения условия для отображения
 */
export const formatConditionValue = (type, value) => {
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  switch (type) {
    case CONDITION_TYPES.TIME:
      const days = value.days ? value.days.map(d => getDayName(d)).join(', ') : 'Все дни';
      const hours = value.hours ? `${value.hours.start}:00 - ${value.hours.end}:00` : 'Весь день';
      return `${days}, ${hours}`;

    case CONDITION_TYPES.TRIGGER:
      return `Событие: ${value.event}${value.threshold ? `, порог: ${value.threshold}` : ''}`;

    case CONDITION_TYPES.LIMIT:
      const limits = [];
      if (value.max_shows) limits.push(`Макс. показов: ${value.max_shows}`);
      if (value.max_conversions) limits.push(`Макс. конверсий: ${value.max_conversions}`);
      return limits.join(', ');

    case CONDITION_TYPES.CHANNEL:
      return `Каналы: ${value.channels ? value.channels.join(', ') : 'не указаны'}`;

    case CONDITION_TYPES.FREQUENCY:
      return `${value.max_count} раз в ${getPeriodName(value.period)}`;

    default:
      return JSON.stringify(value);
  }
};

/**
 * Получить название дня недели
 */
function getDayName(dayNumber) {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return days[dayNumber] || dayNumber;
}

/**
 * Получить название периода
 */
function getPeriodName(period) {
  const periods = {
    hour: 'час',
    day: 'день',
    week: 'неделю',
    month: 'месяц'
  };
  return periods[period] || period;
}

/**
 * Получить шаблоны значений для разных типов условий
 */
export const getConditionValueTemplate = (type) => {
  switch (type) {
    case CONDITION_TYPES.TIME:
      return {
        days: [1, 2, 3, 4, 5], // Пн-Пт
        hours: { start: 9, end: 18 }
      };

    case CONDITION_TYPES.TRIGGER:
      return {
        event: 'purchase_completed',
        threshold: 1
      };

    case CONDITION_TYPES.LIMIT:
      return {
        max_shows: 5,
        max_conversions: 1
      };

    case CONDITION_TYPES.CHANNEL:
      return {
        channels: ['email', 'push']
      };

    case CONDITION_TYPES.FREQUENCY:
      return {
        period: 'day',
        max_count: 1
      };

    default:
      return {};
  }
};

/**
 * Валидация значения условия
 */
export const validateConditionValue = (type, value) => {
  if (!value || typeof value !== 'object') {
    return 'Значение условия должно быть объектом';
  }

  switch (type) {
    case CONDITION_TYPES.TIME:
      if (value.days && !Array.isArray(value.days)) {
        return 'days должен быть массивом';
      }
      if (value.hours && (!value.hours.start && value.hours.start !== 0 || !value.hours.end && value.hours.end !== 0)) {
        return 'hours должен содержать start и end';
      }
      break;

    case CONDITION_TYPES.TRIGGER:
      if (!value.event) {
        return 'Укажите событие (event)';
      }
      break;

    case CONDITION_TYPES.LIMIT:
      if (!value.max_shows && !value.max_conversions) {
        return 'Укажите хотя бы один лимит (max_shows или max_conversions)';
      }
      break;

    case CONDITION_TYPES.CHANNEL:
      if (!value.channels || !Array.isArray(value.channels) || value.channels.length === 0) {
        return 'Укажите хотя бы один канал';
      }
      break;

    case CONDITION_TYPES.FREQUENCY:
      if (!value.period) {
        return 'Укажите период (period)';
      }
      if (!value.max_count || value.max_count < 1) {
        return 'Укажите max_count (минимум 1)';
      }
      break;

    default:
      return 'Неизвестный тип условия';
  }

  return null; // Валидация прошла успешно
};

export default {
  getConditionsByOfferId,
  getConditionById,
  createCondition,
  updateCondition,
  deleteCondition,
  getConditionTypes,
  getConditionTypeName,
  getConditionTypeIcon,
  formatConditionValue,
  getConditionValueTemplate,
  validateConditionValue,
  CONDITION_TYPES
};
