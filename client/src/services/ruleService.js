import api from './api';

/**
 * Получить список правил с фильтрацией и пагинацией
 */
export const getRules = async (params = {}) => {
  const response = await api.get('/rules', { params });
  return response.data;
};

/**
 * Получить правило по ID
 */
export const getRuleById = async (id) => {
  const response = await api.get(`/rules/${id}`);
  return response.data;
};

/**
 * Создать новое правило
 */
export const createRule = async (ruleData) => {
  const response = await api.post('/rules', ruleData);
  return response.data;
};

/**
 * Обновить правило
 */
export const updateRule = async (id, ruleData) => {
  const response = await api.put(`/rules/${id}`, ruleData);
  return response.data;
};

/**
 * Удалить правило
 */
export const deleteRule = async (id) => {
  const response = await api.delete(`/rules/${id}`);
  return response.data;
};

/**
 * Получить статистику по правилу
 */
export const getRuleStatistics = async (id) => {
  const response = await api.get(`/rules/${id}/statistics`);
  return response.data;
};

/**
 * Получить историю выполнения правила
 */
export const getRuleExecutions = async (id, params = {}) => {
  const response = await api.get(`/rules/${id}/executions`, { params });
  return response.data;
};

/**
 * Типы правил
 */
export const RULE_TYPES = [
  { value: 'priority_boost', label: 'Повышение приоритета', description: 'Увеличивает score при определенных условиях' },
  { value: 'scoring', label: 'Формулы расчета', description: 'Применяет математические формулы для расчета score' },
  { value: 'filtering', label: 'Фильтрация', description: 'Исключает офферы из показа при определенных условиях' },
  { value: 'segmentation', label: 'Сегментация', description: 'Правила для определения принадлежности к сегменту' },
  { value: 'timing', label: 'Временные правила', description: 'Изменяет score в зависимости от времени' },
  { value: 'budget', label: 'Бюджетные ограничения', description: 'Управляет показом офферов на основе бюджета' },
  { value: 'frequency', label: 'Частота показа', description: 'Ограничивает частоту показа офферов' },
  { value: 'conversion', label: 'На основе конверсии', description: 'Повышает score для высококонверсионных офферов' }
];

/**
 * Получить название типа правила
 */
export const getRuleTypeName = (ruleType) => {
  const type = RULE_TYPES.find(t => t.value === ruleType);
  return type ? type.label : ruleType;
};

/**
 * Получить описание типа правила
 */
export const getRuleTypeDescription = (ruleType) => {
  const type = RULE_TYPES.find(t => t.value === ruleType);
  return type ? type.description : '';
};
