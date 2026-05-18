const { query } = require('../config/database');
const { logAction } = require('../services/logService');

/**
 * Типы условий активации офферов
 */
const CONDITION_TYPES = {
  TIME: 'time',           // Временные рамки (дни недели, часы)
  TRIGGER: 'trigger',     // Триггеры активации (события клиента)
  LIMIT: 'limit',         // Лимиты использования
  CHANNEL: 'channel',     // Каналы доставки
  FREQUENCY: 'frequency'  // Частота показа
};

/**
 * Получить все условия для оффера
 */
const getConditionsByOfferId = async (req, res) => {
  try {
    const { offerId } = req.params;

    // Проверка существования оффера
    const offerCheck = await query('SELECT id FROM offers WHERE id = $1', [offerId]);
    if (offerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    const result = await query(
      `SELECT
        id,
        offer_id,
        condition_type,
        condition_value,
        is_active,
        created_at
       FROM conditions
       WHERE offer_id = $1
       ORDER BY created_at DESC`,
      [offerId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Ошибка получения условий:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении условий'
    });
  }
};

/**
 * Получить условие по ID
 */
const getConditionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        id,
        offer_id,
        condition_type,
        condition_value,
        is_active,
        created_at
       FROM conditions
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Условие не найдено'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения условия:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении условия'
    });
  }
};

/**
 * Создать новое условие
 */
const createCondition = async (req, res) => {
  try {
    const { offer_id, condition_type, condition_value, is_active = true } = req.body;

    // Валидация типа условия
    if (!Object.values(CONDITION_TYPES).includes(condition_type)) {
      return res.status(400).json({
        success: false,
        message: `Недопустимый тип условия. Допустимые типы: ${Object.values(CONDITION_TYPES).join(', ')}`
      });
    }

    // Проверка существования оффера
    const offerCheck = await query('SELECT id, title FROM offers WHERE id = $1', [offer_id]);
    if (offerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    // Валидация condition_value в зависимости от типа
    const validationError = validateConditionValue(condition_type, condition_value);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // Создание условия
    const result = await query(
      `INSERT INTO conditions (offer_id, condition_type, condition_value, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, offer_id, condition_type, condition_value, is_active, created_at`,
      [offer_id, condition_type, JSON.stringify(condition_value), is_active]
    );

    const condition = result.rows[0];

    // Логирование
    await logAction(
      req.user.id,
      'CREATE',
      'Condition',
      condition.id,
      {
        offer_id,
        offer_title: offerCheck.rows[0].title,
        condition_type,
        condition_value
      },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Условие успешно создано',
      data: condition
    });
  } catch (err) {
    console.error('❌ Ошибка создания условия:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании условия'
    });
  }
};

/**
 * Обновить условие
 */
const updateCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition_type, condition_value, is_active } = req.body;

    // Проверка существования условия
    const conditionCheck = await query(
      'SELECT id, offer_id, condition_type, condition_value FROM conditions WHERE id = $1',
      [id]
    );
    if (conditionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Условие не найдено'
      });
    }

    const oldCondition = conditionCheck.rows[0];

    // Валидация типа условия (если передан)
    if (condition_type && !Object.values(CONDITION_TYPES).includes(condition_type)) {
      return res.status(400).json({
        success: false,
        message: `Недопустимый тип условия. Допустимые типы: ${Object.values(CONDITION_TYPES).join(', ')}`
      });
    }

    // Валидация condition_value (если передан)
    const typeToValidate = condition_type || oldCondition.condition_type;
    const valueToValidate = condition_value !== undefined ? condition_value : oldCondition.condition_value;

    const validationError = validateConditionValue(typeToValidate, valueToValidate);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // Подготовка значений для обновления
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (condition_type !== undefined) {
      updates.push(`condition_type = $${paramIndex}`);
      values.push(condition_type);
      paramIndex++;
    }

    if (condition_value !== undefined) {
      updates.push(`condition_value = $${paramIndex}`);
      values.push(JSON.stringify(condition_value));
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Нет данных для обновления'
      });
    }

    // Обновление
    values.push(id);
    const result = await query(
      `UPDATE conditions
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, offer_id, condition_type, condition_value, is_active, created_at`,
      values
    );

    const updatedCondition = result.rows[0];

    // Логирование
    await logAction(
      req.user.id,
      'UPDATE',
      'Condition',
      id,
      {
        offer_id: oldCondition.offer_id,
        old: { condition_type: oldCondition.condition_type, condition_value: oldCondition.condition_value },
        new: { condition_type: updatedCondition.condition_type, condition_value: updatedCondition.condition_value }
      },
      req
    );

    res.json({
      success: true,
      message: 'Условие успешно обновлено',
      data: updatedCondition
    });
  } catch (err) {
    console.error('❌ Ошибка обновления условия:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении условия'
    });
  }
};

/**
 * Удалить условие
 */
const deleteCondition = async (req, res) => {
  try {
    const { id } = req.params;

    // Проверка существования условия
    const conditionCheck = await query(
      'SELECT id, offer_id, condition_type FROM conditions WHERE id = $1',
      [id]
    );
    if (conditionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Условие не найдено'
      });
    }

    const condition = conditionCheck.rows[0];

    // Удаление
    await query('DELETE FROM conditions WHERE id = $1', [id]);

    // Логирование
    await logAction(
      req.user.id,
      'DELETE',
      'Condition',
      id,
      {
        offer_id: condition.offer_id,
        condition_type: condition.condition_type
      },
      req
    );

    res.json({
      success: true,
      message: 'Условие успешно удалено'
    });
  } catch (err) {
    console.error('❌ Ошибка удаления условия:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении условия'
    });
  }
};

/**
 * Валидация значения условия в зависимости от типа
 */
function validateConditionValue(condition_type, condition_value) {
  if (!condition_value || typeof condition_value !== 'object') {
    return 'condition_value должно быть объектом';
  }

  switch (condition_type) {
    case CONDITION_TYPES.TIME:
      // Временные рамки: дни недели, часы
      // Пример: { days: [1,2,3,4,5], hours: { start: 9, end: 18 } }
      if (condition_value.days && !Array.isArray(condition_value.days)) {
        return 'days должен быть массивом';
      }
      if (condition_value.days && !condition_value.days.every(d => d >= 0 && d <= 6)) {
        return 'days должен содержать числа от 0 (воскресенье) до 6 (суббота)';
      }
      if (condition_value.hours) {
        if (typeof condition_value.hours.start !== 'number' || typeof condition_value.hours.end !== 'number') {
          return 'hours должен содержать start и end (числа от 0 до 23)';
        }
        if (condition_value.hours.start < 0 || condition_value.hours.start > 23 ||
            condition_value.hours.end < 0 || condition_value.hours.end > 23) {
          return 'hours.start и hours.end должны быть от 0 до 23';
        }
      }
      break;

    case CONDITION_TYPES.TRIGGER:
      // Триггеры: события клиента
      // Пример: { event: 'purchase_completed', threshold: 3 }
      if (!condition_value.event || typeof condition_value.event !== 'string') {
        return 'trigger должен содержать event (строка)';
      }
      break;

    case CONDITION_TYPES.LIMIT:
      // Лимиты использования
      // Пример: { max_shows: 5, max_conversions: 1 }
      if (condition_value.max_shows !== undefined && typeof condition_value.max_shows !== 'number') {
        return 'max_shows должен быть числом';
      }
      if (condition_value.max_conversions !== undefined && typeof condition_value.max_conversions !== 'number') {
        return 'max_conversions должен быть числом';
      }
      if (!condition_value.max_shows && !condition_value.max_conversions) {
        return 'limit должен содержать хотя бы max_shows или max_conversions';
      }
      break;

    case CONDITION_TYPES.CHANNEL:
      // Каналы доставки
      // Пример: { channels: ['email', 'push', 'sms'] }
      if (!condition_value.channels || !Array.isArray(condition_value.channels)) {
        return 'channel должен содержать массив channels';
      }
      const validChannels = ['email', 'push', 'sms', 'app', 'web'];
      if (!condition_value.channels.every(c => validChannels.includes(c))) {
        return `channel должен содержать допустимые каналы: ${validChannels.join(', ')}`;
      }
      break;

    case CONDITION_TYPES.FREQUENCY:
      // Частота показа
      // Пример: { period: 'day', max_count: 1 }
      if (!condition_value.period || typeof condition_value.period !== 'string') {
        return 'frequency должен содержать period (строка)';
      }
      const validPeriods = ['hour', 'day', 'week', 'month'];
      if (!validPeriods.includes(condition_value.period)) {
        return `frequency.period должен быть одним из: ${validPeriods.join(', ')}`;
      }
      if (typeof condition_value.max_count !== 'number' || condition_value.max_count < 1) {
        return 'frequency.max_count должен быть положительным числом';
      }
      break;

    default:
      return 'Неизвестный тип условия';
  }

  return null; // Валидация прошла успешно
}

/**
 * Получить типы условий (справочная информация)
 */
const getConditionTypes = async (req, res) => {
  try {
    const types = [
      {
        type: CONDITION_TYPES.TIME,
        name: 'Временные рамки',
        description: 'Показывать оффер только в определённые дни недели и часы',
        example: {
          days: [1, 2, 3, 4, 5],
          hours: { start: 9, end: 18 }
        }
      },
      {
        type: CONDITION_TYPES.TRIGGER,
        name: 'Триггеры',
        description: 'Показывать оффер при наступлении определённого события',
        example: {
          event: 'purchase_completed',
          threshold: 3
        }
      },
      {
        type: CONDITION_TYPES.LIMIT,
        name: 'Лимиты',
        description: 'Ограничить количество показов или конверсий',
        example: {
          max_shows: 5,
          max_conversions: 1
        }
      },
      {
        type: CONDITION_TYPES.CHANNEL,
        name: 'Каналы',
        description: 'Показывать оффер только через определённые каналы',
        example: {
          channels: ['email', 'push', 'app']
        }
      },
      {
        type: CONDITION_TYPES.FREQUENCY,
        name: 'Частота',
        description: 'Ограничить частоту показа оффера',
        example: {
          period: 'day',
          max_count: 1
        }
      }
    ];

    res.json({
      success: true,
      data: types
    });
  } catch (err) {
    console.error('❌ Ошибка получения типов условий:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении типов условий'
    });
  }
};

module.exports = {
  getConditionsByOfferId,
  getConditionById,
  createCondition,
  updateCondition,
  deleteCondition,
  getConditionTypes,
  CONDITION_TYPES
};
