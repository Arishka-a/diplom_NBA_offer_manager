const { query } = require('../config/database');
const { logAction, saveHistory } = require('../services/logService');
const { buildWhere } = require('../utils/filterBuilder');

const SEGMENT_FILTER_FIELDS = {
  id: 's.id',
  name: 's.name',
  description: 's.description',
  client_count: 's.client_count',
  is_active: 's.is_active',
};

// Получение списка сегментов (пагинация opt-in: только если передан page)
const getSegments = async (req, res) => {
  try {
    const { search, page, limit = 25 } = req.query;
    const usePagination = page !== undefined;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const generic = buildWhere(SEGMENT_FILTER_FIELDS, req.query, paramIndex - 1);
    if (generic.whereSql) {
      whereClause += ' AND ' + generic.whereSql;
      params.push(...generic.params);
      paramIndex += generic.params.length;
    }

    const baseSql = `
      SELECT s.*,
        (SELECT COUNT(*) FROM offer_segments os WHERE os.segment_id = s.id) as offers_count
      FROM segments s
      ${whereClause}
      ORDER BY s.name ASC
    `;

    if (!usePagination) {
      const result = await query(baseSql, params);
      return res.json({ success: true, data: result.rows });
    }

    // Пагинированный режим
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 25);
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query(
      `SELECT COUNT(*) FROM segments s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `${baseSql} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('❌ Ошибка получения сегментов:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получение сегмента по ID
const getSegmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object('id', o.id, 'title', o.title, 'status', o.status)
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) as offers
       FROM segments s
       LEFT JOIN offer_segments os ON s.id = os.segment_id
       LEFT JOIN offers o ON os.offer_id = o.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Сегмент не найден'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения сегмента:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Создание сегмента
const createSegment = async (req, res) => {
  try {
    const { name, description, criteria, client_count } = req.body;

    const result = await query(
      `INSERT INTO segments (name, description, criteria, client_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, criteria ? JSON.stringify(criteria) : null, client_count || 0]
    );

    const segment = result.rows[0];

    await logAction(req.user.id, 'CREATE', 'Segment', segment.id, { name }, req);

    res.status(201).json({
      success: true,
      message: 'Сегмент успешно создан',
      data: segment
    });
  } catch (err) {
    console.error('❌ Ошибка создания сегмента:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при создании сегмента'
    });
  }
};

// Обновление сегмента
const updateSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, criteria, client_count, is_active } = req.body;

    // Получаем текущее состояние для сохранения в историю
    const currentResult = await query('SELECT * FROM segments WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Сегмент не найден'
      });
    }
    const currentSegment = currentResult.rows[0];

    // Сохраняем текущее состояние в историю
    await saveHistory('Segment', id, currentSegment, req.user.id);

    const result = await query(
      `UPDATE segments SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        criteria = COALESCE($3, criteria),
        client_count = COALESCE($4, client_count),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, description, criteria ? JSON.stringify(criteria) : null, client_count, is_active, id]
    );

    await logAction(req.user.id, 'UPDATE', 'Segment', id, req.body, req);

    res.json({
      success: true,
      message: 'Сегмент успешно обновлён',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления сегмента:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Удаление сегмента
const deleteSegment = async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, есть ли связанные офферы
    const offersCheck = await query(
      'SELECT COUNT(*) FROM offer_segments WHERE segment_id = $1',
      [id]
    );

    if (parseInt(offersCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Невозможно удалить сегмент, связанный с офферами'
      });
    }

    // Получаем текущее состояние для сохранения в историю
    const currentResult = await query('SELECT * FROM segments WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Сегмент не найден'
      });
    }
    const currentSegment = currentResult.rows[0];

    // Сохраняем состояние в историю перед удалением
    await saveHistory('Segment', id, currentSegment, req.user.id, 'Удаление сегмента');

    const result = await query(
      'DELETE FROM segments WHERE id = $1 RETURNING id, name',
      [id]
    );

    await logAction(req.user.id, 'DELETE', 'Segment', id, { name: result.rows[0].name }, req);

    res.json({
      success: true,
      message: 'Сегмент успешно удалён'
    });
  } catch (err) {
    console.error('❌ Ошибка удаления сегмента:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

module.exports = {
  getSegments,
  getSegmentById,
  createSegment,
  updateSegment,
  deleteSegment
};
