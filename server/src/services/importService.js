const pool = require('../config/database');
const { logAction } = require('./logService');

/**
 * Валидация и импорт офферов
 * @param {Array} data - Массив данных из CSV/Excel
 * @param {Number} userId - ID пользователя, выполняющего импорт
 * @param {String} userIp - IP адрес пользователя
 * @param {String} userAgent - User agent пользователя
 */
const importOffers = async (data, userId, userIp, userAgent) => {
  const results = {
    total: data.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      // Валидация обязательных полей
      if (!row.title || !row.offer_type) {
        throw new Error('Не указаны обязательные поля: title, offer_type');
      }

      // Валидация типа оффера
      const validTypes = ['discount', 'bonus', 'recommendation', 'upgrade', 'retention'];
      if (!validTypes.includes(row.offer_type)) {
        throw new Error(`Недопустимый тип оффера: ${row.offer_type}`);
      }

      // Валидация статуса
      const validStatuses = ['draft', 'active', 'inactive', 'archived'];
      const status = row.status || 'draft';
      if (!validStatuses.includes(status)) {
        throw new Error(`Недопустимый статус: ${status}`);
      }

      // Валидация приоритета
      const priority = parseInt(row.priority) || 50;
      if (priority < 1 || priority > 100) {
        throw new Error('Приоритет должен быть от 1 до 100');
      }

      // Парсинг дат
      const startDate = row.start_date ? new Date(row.start_date) : null;
      const endDate = row.end_date ? new Date(row.end_date) : null;

      // Парсинг segment_ids (может быть строкой "1,2,3")
      let segmentIds = null;
      if (row.segment_ids) {
        if (typeof row.segment_ids === 'string') {
          segmentIds = row.segment_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (Array.isArray(row.segment_ids)) {
          segmentIds = row.segment_ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        }
      }

      // Вставка оффера
      const query = `
        INSERT INTO offers (
          title, description, offer_type, status, priority,
          start_date, end_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const values = [
        row.title,
        row.description || null,
        row.offer_type,
        status,
        priority,
        startDate,
        endDate,
        userId
      ];

      const result = await pool.query(query, values);
      const offerId = result.rows[0].id;

      // Связь с сегментами
      if (segmentIds && segmentIds.length > 0) {
        for (const segmentId of segmentIds) {
          await pool.query(
            'INSERT INTO offer_segments (offer_id, segment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [offerId, segmentId]
          );
        }
      }

      // Логирование
      await logAction(
        userId,
        'IMPORT',
        'offer',
        offerId,
        { imported: row },
        userIp,
        userAgent
      );

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        row: i + 1,
        data: row,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Валидация и импорт сегментов
 */
const importSegments = async (data, userId, userIp, userAgent) => {
  const results = {
    total: data.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      // Валидация обязательных полей
      if (!row.name) {
        throw new Error('Не указано обязательное поле: name');
      }

      // Валидация is_active
      const isActive = row.is_active !== undefined
        ? (row.is_active === true || row.is_active === 'true' || row.is_active === 1)
        : true;

      // Парсинг criteria (JSON)
      let criteria = null;
      if (row.criteria) {
        if (typeof row.criteria === 'string') {
          try {
            criteria = JSON.parse(row.criteria);
          } catch (e) {
            throw new Error('Некорректный JSON в поле criteria');
          }
        } else if (typeof row.criteria === 'object') {
          criteria = row.criteria;
        }
      }

      // Вставка сегмента
      const query = `
        INSERT INTO segments (
          name, description, criteria, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const values = [
        row.name,
        row.description || null,
        criteria ? JSON.stringify(criteria) : null,
        isActive,
        userId
      ];

      const result = await pool.query(query, values);
      const segmentId = result.rows[0].id;

      // Логирование
      await logAction(
        userId,
        'IMPORT',
        'segment',
        segmentId,
        { imported: row },
        userIp,
        userAgent
      );

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        row: i + 1,
        data: row,
        error: error.message
      });
    }
  }

  return results;
};

module.exports = {
  importOffers,
  importSegments
};
