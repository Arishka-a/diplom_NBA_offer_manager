const pool = require('../config/database');
const { logAction } = require('../services/logService');
const { buildWhere } = require('../utils/filterBuilder');

const RULE_FILTER_FIELDS = {
  id: 'id',
  name: 'name',
  description: 'description',
  rule_type: 'rule_type',
  is_active: 'is_active',
  priority: 'priority',
  weight: 'weight',
  created_at: 'created_at',
};

/**
 * Получить список всех правил с фильтрацией и пагинацией
 */
const getRules = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sort_by = 'priority',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    const generic = buildWhere(RULE_FILTER_FIELDS, req.query, params.length);
    if (generic.whereSql) {
      conditions.push(generic.whereSql);
      params.push(...generic.params);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Валидация сортировки
    const allowedSortFields = ['id', 'name', 'rule_type', 'priority', 'weight', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'priority';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Подсчет общего количества
    const countQuery = `SELECT COUNT(*) FROM rules ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Получение правил
    params.push(limit, offset);
    const query = `
      SELECT
        r.id,
        r.name,
        r.description,
        r.rule_type,
        r.is_active,
        r.priority,
        r.weight,
        r.rule_definition,
        r.apply_conditions,
        r.target_segments,
        r.target_offer_types,
        r.created_at,
        r.updated_at,
        u.username as created_by_username
      FROM rules r
      LEFT JOIN users u ON r.created_by = u.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);

    res.json({
      rules: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Получить правило по ID
 */
const getRuleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        r.*,
        u.username as created_by_username
      FROM rules r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Создать новое правило
 */
const createRule = async (req, res, next) => {
  try {
    const {
      name,
      description,
      rule_type,
      is_active = true,
      priority = 50,
      weight = 0.5,
      rule_definition,
      apply_conditions,
      target_segments,
      target_offer_types
    } = req.body;

    // Валидация обязательных полей
    if (!name || !rule_type || !rule_definition) {
      return res.status(400).json({
        error: 'Не указаны обязательные поля: name, rule_type, rule_definition'
      });
    }

    // Валидация типа правила
    const validRuleTypes = [
      'priority_boost',
      'scoring',
      'filtering',
      'segmentation',
      'timing',
      'budget',
      'frequency',
      'conversion'
    ];

    if (!validRuleTypes.includes(rule_type)) {
      return res.status(400).json({
        error: `Недопустимый тип правила. Допустимые типы: ${validRuleTypes.join(', ')}`
      });
    }

    // Валидация приоритета и веса
    if (priority < 1 || priority > 100) {
      return res.status(400).json({ error: 'Приоритет должен быть от 1 до 100' });
    }

    if (weight < 0 || weight > 1) {
      return res.status(400).json({ error: 'Вес должен быть от 0.0 до 1.0' });
    }

    const query = `
      INSERT INTO rules (
        name, description, rule_type, is_active, priority, weight,
        rule_definition, apply_conditions, target_segments, target_offer_types,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      name,
      description,
      rule_type,
      is_active,
      priority,
      weight,
      JSON.stringify(rule_definition),
      apply_conditions ? JSON.stringify(apply_conditions) : null,
      target_segments,
      target_offer_types,
      req.user.userId
    ];

    const result = await pool.query(query, values);
    const newRule = result.rows[0];

    // Логирование
    await logAction(
      req.user.userId,
      'CREATE',
      'rule',
      newRule.id,
      { rule: newRule },
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json(newRule);
  } catch (error) {
    next(error);
  }
};

/**
 * Обновить правило
 */
const updateRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      rule_type,
      is_active,
      priority,
      weight,
      rule_definition,
      apply_conditions,
      target_segments,
      target_offer_types
    } = req.body;

    // Проверка существования правила
    const checkQuery = 'SELECT * FROM rules WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }

    const oldRule = checkResult.rows[0];

    // Валидация типа правила (если изменяется)
    if (rule_type) {
      const validRuleTypes = [
        'priority_boost', 'scoring', 'filtering', 'segmentation',
        'timing', 'budget', 'frequency', 'conversion'
      ];

      if (!validRuleTypes.includes(rule_type)) {
        return res.status(400).json({
          error: `Недопустимый тип правила. Допустимые типы: ${validRuleTypes.join(', ')}`
        });
      }
    }

    // Валидация приоритета и веса
    if (priority !== undefined && (priority < 1 || priority > 100)) {
      return res.status(400).json({ error: 'Приоритет должен быть от 1 до 100' });
    }

    if (weight !== undefined && (weight < 0 || weight > 1)) {
      return res.status(400).json({ error: 'Вес должен быть от 0.0 до 1.0' });
    }

    // Построение динамического UPDATE
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (rule_type !== undefined) {
      updates.push(`rule_type = $${paramCount}`);
      values.push(rule_type);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (weight !== undefined) {
      updates.push(`weight = $${paramCount}`);
      values.push(weight);
      paramCount++;
    }

    if (rule_definition !== undefined) {
      updates.push(`rule_definition = $${paramCount}`);
      values.push(JSON.stringify(rule_definition));
      paramCount++;
    }

    if (apply_conditions !== undefined) {
      updates.push(`apply_conditions = $${paramCount}`);
      values.push(apply_conditions ? JSON.stringify(apply_conditions) : null);
      paramCount++;
    }

    if (target_segments !== undefined) {
      updates.push(`target_segments = $${paramCount}`);
      values.push(target_segments);
      paramCount++;
    }

    if (target_offer_types !== undefined) {
      updates.push(`target_offer_types = $${paramCount}`);
      values.push(target_offer_types);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    values.push(id);
    const query = `
      UPDATE rules
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const updatedRule = result.rows[0];

    // Сохранение истории
    const historyQuery = `
      INSERT INTO history (entity_type, entity_id, previous_state, changed_by)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(historyQuery, ['rule', id, JSON.stringify(oldRule), req.user.userId]);

    // Логирование
    await logAction(
      req.user.userId,
      'UPDATE',
      'rule',
      id,
      { before: oldRule, after: updatedRule },
      req.ip,
      req.get('user-agent')
    );

    res.json(updatedRule);
  } catch (error) {
    next(error);
  }
};

/**
 * Удалить правило
 */
const deleteRule = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Проверка существования правила
    const checkQuery = 'SELECT * FROM rules WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }

    const rule = checkResult.rows[0];

    // Удаление правила (каскадно удалятся и executions)
    const deleteQuery = 'DELETE FROM rules WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    // Логирование
    await logAction(
      req.user.userId,
      'DELETE',
      'rule',
      id,
      { deletedRule: rule },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: 'Правило успешно удалено', deletedRule: rule });
  } catch (error) {
    next(error);
  }
};

/**
 * Получить статистику по правилу
 */
const getRuleStatistics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT * FROM v_rule_statistics WHERE rule_id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Статистика для правила не найдена' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Получить историю выполнения правила
 */
const getRuleExecutions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const query = `
      SELECT
        re.*,
        o.title as offer_title,
        s.name as segment_name
      FROM rule_executions re
      LEFT JOIN offers o ON re.offer_id = o.id
      LEFT JOIN segments s ON re.client_segment_id = s.id
      WHERE re.rule_id = $1
      ORDER BY re.executed_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = 'SELECT COUNT(*) FROM rule_executions WHERE rule_id = $1';
    const countResult = await pool.query(countQuery, [id]);
    const totalCount = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, [id, limit, offset]);

    res.json({
      executions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Получить общую статистику всех правил
 */
const getAllRulesStatistics = async (req, res, next) => {
  try {
    // Получить статистику из view для всех правил
    const statsQuery = `
      SELECT
        r.id,
        r.name,
        r.rule_type,
        r.is_active,
        r.priority,
        r.weight,
        COALESCE(stats.total_executions, 0) as total_executions,
        COALESCE(stats.successful_applications, 0) as applied_count,
        COALESCE(stats.total_executions - stats.successful_applications, 0) as skipped_count,
        COALESCE(stats.avg_score_impact, 0) as avg_score_impact,
        COALESCE(stats.application_rate_percent, 0) as success_rate,
        stats.last_execution
      FROM rules r
      LEFT JOIN v_rule_statistics stats ON r.id = stats.rule_id
      ORDER BY r.priority DESC, r.id ASC
    `;

    const result = await pool.query(statsQuery);

    // Получить общую статистику по типам правил
    const typeStatsQuery = `
      SELECT
        r.rule_type,
        COUNT(DISTINCT r.id) as rules_count,
        SUM(COALESCE(stats.total_executions, 0)) as total_executions,
        SUM(COALESCE(stats.successful_applications, 0)) as applied_count,
        AVG(COALESCE(stats.avg_score_impact, 0)) as avg_score_impact
      FROM rules r
      LEFT JOIN v_rule_statistics stats ON r.id = stats.rule_id
      GROUP BY r.rule_type
      ORDER BY rules_count DESC
    `;

    const typeStatsResult = await pool.query(typeStatsQuery);

    // Получить активность правил по времени (последние 30 дней)
    const activityQuery = `
      SELECT
        DATE(executed_at) as date,
        COUNT(*) as executions,
        COUNT(CASE WHEN was_applied = true THEN 1 END) as applied,
        AVG(score_delta) as avg_impact
      FROM rule_executions
      WHERE executed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(executed_at)
      ORDER BY date DESC
    `;

    const activityResult = await pool.query(activityQuery);

    res.json({
      success: true,
      data: {
        rules: result.rows,
        typeStatistics: typeStatsResult.rows,
        activityByDate: activityResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  getRuleStatistics,
  getRuleExecutions,
  getAllRulesStatistics
};
