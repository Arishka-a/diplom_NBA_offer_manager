const { query, getClient } = require('../config/database');
const { logAction, saveHistory } = require('../services/logService');
const { buildWhere } = require('../utils/filterBuilder');

const OFFER_FILTER_FIELDS = {
  id: 'o.id',
  title: 'o.title',
  description: 'o.description',
  offer_type: 'o.offer_type',
  priority: 'o.priority',
  start_date: 'o.start_date',
  end_date: 'o.end_date',
  created_at: 'o.created_at',
  product_id: 'o.product_id',
  // joined tables
  product_code: 'p.code',
  product_name: 'p.name',
  product_category: 'p.category',
  discount_pct: 'od.discount_pct',
  discount_period_months: 'od.discount_period_months',
  trial_days: 'od.trial_days',
  hardware_internet: 'od.hardware_internet',
  hardware_tv: 'od.hardware_tv',
};

// Joins required by OFFER_FILTER_FIELDS — must be present in both count and
// data queries so the filter columns resolve. products and offer_details are
// 1:1 with offers, so adding them does not multiply rows.
const OFFER_FILTER_JOINS = `
  LEFT JOIN products p ON o.product_id = p.id
  LEFT JOIN offer_details od ON o.id = od.offer_id
`;

/**
 * Safely build ORDER BY clause using whitelist validation
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort direction (ASC/DESC)
 * @returns {object} - Object with safe sortField and sortDir
 */
const buildSafeOrderBy = (sortBy, sortOrder, tableAlias = 'o') => {
  const allowedSortFields = {
    'created_at': `${tableAlias}.created_at`,
    'updated_at': `${tableAlias}.updated_at`,
    'title': `${tableAlias}.title`,
    'priority': `${tableAlias}.priority`,
    'start_date': `${tableAlias}.start_date`,
    'status': `${tableAlias}.status`
  };

  const sortField = allowedSortFields[sortBy] || allowedSortFields['created_at'];
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { sortField, sortDir };
};

// Получение списка офферов с пагинацией и фильтрацией
const getOffers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      segment_id,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let paramIndex = 1;

    let whereClause = 'WHERE 1=1';

    // Эффективный статус: 'active' только если у оффера есть хотя бы один канал.
    // Если каналов нет — оффер считается 'inactive', даже если в БД статус 'active'.
    if (status) {
      if (status === 'active') {
        whereClause += ` AND o.status = 'active' AND EXISTS (SELECT 1 FROM offer_channels oc WHERE oc.offer_id = o.id)`;
      } else if (status === 'inactive') {
        whereClause += ` AND (o.status = 'inactive' OR (o.status = 'active' AND NOT EXISTS (SELECT 1 FROM offer_channels oc WHERE oc.offer_id = o.id)))`;
      } else {
        whereClause += ` AND o.status = $${paramIndex++}`;
        params.push(status);
      }
    }

    if (search) {
      whereClause += ` AND (o.title ILIKE $${paramIndex} OR o.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (segment_id) {
      whereClause += ` AND EXISTS (SELECT 1 FROM offer_segments os WHERE os.offer_id = o.id AND os.segment_id = $${paramIndex++})`;
      params.push(segment_id);
    }

    // Channel filter — offer_channels is multi-row per offer, so use EXISTS.
    if (req.query.channel) {
      whereClause += ` AND EXISTS (SELECT 1 FROM offer_channels oc WHERE oc.offer_id = o.id AND oc.channel = $${paramIndex++})`;
      params.push(req.query.channel);
    }

    // Generic filters for the rest. Skip the keys handled by special-case logic.
    const genericQuery = { ...req.query };
    delete genericQuery.status;
    delete genericQuery.segment_id;
    delete genericQuery.channel;
    const generic = buildWhere(OFFER_FILTER_FIELDS, genericQuery, paramIndex - 1);
    if (generic.whereSql) {
      whereClause += ' AND ' + generic.whereSql;
      params.push(...generic.params);
      paramIndex += generic.params.length;
    }

    // Безопасная валидация сортировки
    const { sortField, sortDir } = buildSafeOrderBy(sort_by, sort_order, 'o');

    // Подсчёт общего количества (с теми же 1:1 джойнами, что и в data-запросе,
    // чтобы фильтр по p.code / od.discount_pct и т.п. находил столбец)
    const countResult = await query(
      `SELECT COUNT(*) FROM offers o ${OFFER_FILTER_JOINS} ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Получение офферов с сегментами, каналами, деталями и продуктом.
    // Статус приводится к 'inactive', если у оффера нет ни одного канала.
    const offersResult = await query(
      `SELECT
        o.id, o.title, o.description, o.offer_type,
        CASE
          WHEN o.status = 'active' AND NOT EXISTS (
            SELECT 1 FROM offer_channels oc WHERE oc.offer_id = o.id
          ) THEN 'inactive'
          ELSE o.status
        END as status,
        o.priority,
        o.start_date, o.end_date, o.created_at, o.updated_at, o.product_id,
        u.username as created_by_username,
        p.code as product_code,
        p.name as product_name,
        p.category as product_category,
        COALESCE(
          json_agg(
            json_build_object('id', s.id, 'name', s.name)
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as segments,
        (SELECT COUNT(*) FROM offer_channels oc WHERE oc.offer_id = o.id) as channel_count,
        (SELECT COALESCE(json_agg(oc.channel ORDER BY oc.channel), '[]'::json)
           FROM offer_channels oc WHERE oc.offer_id = o.id) as channels,
        (SELECT od.discount_pct FROM offer_details od WHERE od.offer_id = o.id) as discount_pct,
        (SELECT od.discount_period_months FROM offer_details od WHERE od.offer_id = o.id) as discount_period_months,
        (SELECT od.trial_days FROM offer_details od WHERE od.offer_id = o.id) as trial_days,
        (SELECT od.hardware_internet FROM offer_details od WHERE od.offer_id = o.id) as hardware_internet,
        (SELECT od.hardware_tv FROM offer_details od WHERE od.offer_id = o.id) as hardware_tv
       FROM offers o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN offer_details od ON o.id = od.offer_id
       LEFT JOIN offer_segments os ON o.id = os.offer_id
       LEFT JOIN segments s ON os.segment_id = s.id
       ${whereClause}
       GROUP BY o.id, u.username, p.code, p.name, p.category,
                od.discount_pct, od.discount_period_months, od.trial_days,
                od.hardware_internet, od.hardware_tv
       ORDER BY ${sortField} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: offersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('❌ Ошибка получения офферов:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении офферов'
    });
  }
};

// Получение оффера по ID
const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        o.id, o.title, o.description, o.offer_type, o.priority,
        o.start_date, o.end_date, o.created_at, o.updated_at, o.created_by,
        o.product_id, o.economic_id,
        CASE
          WHEN o.status = 'active' AND NOT EXISTS (
            SELECT 1 FROM offer_channels oc WHERE oc.offer_id = o.id
          ) THEN 'inactive'
          ELSE o.status
        END as status,
        u.username as created_by_username,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) 
          FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as segments,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', c.id, 
            'condition_type', c.condition_type, 
            'condition_value', c.condition_value,
            'is_active', c.is_active
          )) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as conditions
       FROM offers o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN offer_segments os ON o.id = os.offer_id
       LEFT JOIN segments s ON os.segment_id = s.id
       LEFT JOIN conditions c ON o.id = c.offer_id
       WHERE o.id = $1
       GROUP BY o.id, u.username`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения оффера:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Создание оффера
const createOffer = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const {
      title,
      description,
      offer_type,
      status = 'draft',
      priority = 50,
      start_date,
      end_date,
      segment_ids = [],
      conditions = []
    } = req.body;

    // Создание оффера. start_date больше не вводится в UI — дефолтим текущим временем.
    const offerResult = await client.query(
      `INSERT INTO offers (title, description, offer_type, status, priority, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, offer_type, status, priority, start_date || new Date(), end_date || null, req.user.id]
    );

    const offer = offerResult.rows[0];

    // Привязка сегментов
    if (segment_ids.length > 0) {
      const segmentValues = segment_ids.map((segId, idx) => `($1, $${idx + 2})`).join(', ');
      await client.query(
        `INSERT INTO offer_segments (offer_id, segment_id) VALUES ${segmentValues}`,
        [offer.id, ...segment_ids]
      );
    }

    // Создание условий
    for (const condition of conditions) {
      await client.query(
        `INSERT INTO conditions (offer_id, condition_type, condition_value)
         VALUES ($1, $2, $3)`,
        [offer.id, condition.condition_type, JSON.stringify(condition.condition_value)]
      );
    }

    await client.query('COMMIT');

    // Логирование
    await logAction(req.user.id, 'CREATE', 'Offer', offer.id, { title, offer_type, status }, req);

    res.status(201).json({
      success: true,
      message: 'Оффер успешно создан',
      data: offer
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('❌ Ошибка отката транзакции:', rollbackErr);
    }
    console.error('❌ Ошибка создания оффера:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при создании оффера'
    });
  } finally {
    client.release();
  }
};

// Обновление оффера
const updateOffer = async (req, res) => {
  const client = await getClient();
  
  try {
    const { id } = req.params;

    // Получаем текущее состояние для истории
    const currentResult = await client.query('SELECT * FROM offers WHERE id = $1', [id]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    const currentOffer = currentResult.rows[0];

    const {
      title,
      description,
      offer_type,
      status,
      priority,
      start_date,
      end_date,
      segment_ids
    } = req.body;

    await client.query('BEGIN');

    // Сохраняем историю
    await saveHistory('Offer', id, currentOffer, req.user.id);

    // Обновление оффера
    const updateResult = await client.query(
      `UPDATE offers SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        offer_type = COALESCE($3, offer_type),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        start_date = COALESCE($6, start_date),
        end_date = $7,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [title, description, offer_type, status, priority, start_date, end_date, id]
    );

    // Обновление сегментов если переданы
    if (segment_ids !== undefined) {
      await client.query('DELETE FROM offer_segments WHERE offer_id = $1', [id]);
      
      if (segment_ids.length > 0) {
        const segmentValues = segment_ids.map((segId, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(
          `INSERT INTO offer_segments (offer_id, segment_id) VALUES ${segmentValues}`,
          [id, ...segment_ids]
        );
      }
    }

    await client.query('COMMIT');

    // Логирование
    await logAction(req.user.id, 'UPDATE', 'Offer', id, { 
      changes: req.body,
      previous: { title: currentOffer.title, status: currentOffer.status }
    }, req);

    res.json({
      success: true,
      message: 'Оффер успешно обновлён',
      data: updateResult.rows[0]
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('❌ Ошибка отката транзакции:', rollbackErr);
    }
    console.error('❌ Ошибка обновления оффера:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении оффера'
    });
  } finally {
    client.release();
  }
};

// Удаление оффера
const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем оффер для логирования
    const offerResult = await query('SELECT * FROM offers WHERE id = $1', [id]);
    
    if (offerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    const offer = offerResult.rows[0];

    // Сохраняем историю перед удалением
    await saveHistory('Offer', id, offer, req.user.id, 'Удаление оффера');

    // Удаление (каскадно удалит offer_segments и conditions)
    await query('DELETE FROM offers WHERE id = $1', [id]);

    // Логирование
    await logAction(req.user.id, 'DELETE', 'Offer', id, { title: offer.title }, req);

    res.json({
      success: true,
      message: 'Оффер успешно удалён'
    });
  } catch (err) {
    console.error('❌ Ошибка удаления оффера:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении оффера'
    });
  }
};

module.exports = {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer
};
