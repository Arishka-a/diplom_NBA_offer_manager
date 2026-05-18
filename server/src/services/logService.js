const { query } = require('../config/database');

// Запись в журнал операций
const logAction = async (userId, action, entityType, entityId, details = null, req = null) => {
  try {
    const ipAddress = req ? (req.ip || req.connection.remoteAddress) : null;
    const userAgent = req ? req.get('User-Agent') : null;

    await query(
      `INSERT INTO logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
    );
  } catch (err) {
    console.error('❌ Ошибка логирования:', err.message);
  }
};

// Сохранение истории изменений
const saveHistory = async (entityType, entityId, previousState, changedBy, reason = null) => {
  try {
    await query(
      `INSERT INTO history (entity_type, entity_id, previous_state, changed_by, change_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [entityType, entityId, JSON.stringify(previousState), changedBy, reason]
    );
  } catch (err) {
    console.error('❌ Ошибка сохранения истории:', err.message);
  }
};

// Получение логов
const getLogs = async (filters = {}) => {
  let sql = `
    SELECT l.*, u.username 
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (filters.entityType) {
    sql += ` AND l.entity_type = $${paramIndex++}`;
    params.push(filters.entityType);
  }

  if (filters.entityId) {
    sql += ` AND l.entity_id = $${paramIndex++}`;
    params.push(filters.entityId);
  }

  if (filters.userId) {
    sql += ` AND l.user_id = $${paramIndex++}`;
    params.push(filters.userId);
  }

  if (filters.action) {
    sql += ` AND l.action = $${paramIndex++}`;
    params.push(filters.action);
  }

  if (filters.dateFrom) {
    sql += ` AND l.created_at >= $${paramIndex++}`;
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    sql += ` AND l.created_at <= $${paramIndex++}`;
    params.push(filters.dateTo);
  }

  sql += ` ORDER BY l.created_at DESC`;

  if (filters.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(filters.offset);
  }

  const result = await query(sql, params);
  return result.rows;
};

module.exports = {
  logAction,
  saveHistory,
  getLogs
};
