const { query } = require('../config/database');

/**
 * NBA (Next Best Action) Service
 * Реализует алгоритм интеллектуальной приоритизации офферов
 * Основная функция: рекомендации для сегментов
 * Частный случай: рекомендации для отдельного клиента
 */

/**
 * Получить рекомендованные офферы для сегмента (основная функция)
 * @param {number} segmentId - ID сегмента (null для общих офферов)
 * @param {number} limit - Количество рекомендаций (по умолчанию 5)
 * @returns {Promise<Array>} - Массив рекомендованных офферов с объяснениями
 */
const getNextBestOffersForSegment = async (segmentId, limit = 5) => {
  // 1. Получаем информацию о сегменте
  let segmentInfo = {
    id: segmentId,
    name: 'Все клиенты',
    avg_arpu: 0,
    avg_tenure_months: 0,
    avg_churn_score: 0,
    customer_count: 0
  };

  if (segmentId) {
    const segmentResult = await query(
      `SELECT
        s.id,
        s.name,
        s.description,
        COUNT(c.id) as customer_count,
        COALESCE(AVG(c.arpu), 0) as avg_arpu,
        COALESCE(AVG(c.tenure_months), 0) as avg_tenure_months,
        COALESCE(AVG(c.churn_score), 0) as avg_churn_score
       FROM segments s
       LEFT JOIN customers c ON c.segment_id = s.id AND c.status = 'active'
       WHERE s.id = $1
       GROUP BY s.id, s.name, s.description`,
      [segmentId]
    );

    if (segmentResult.rows.length === 0) {
      throw new Error('Сегмент не найден');
    }

    const segment = segmentResult.rows[0];
    segmentInfo = {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      avg_arpu: parseFloat(segment.avg_arpu) || 0,
      avg_tenure_months: parseInt(segment.avg_tenure_months) || 0,
      avg_churn_score: parseFloat(segment.avg_churn_score) || 0,
      customer_count: parseInt(segment.customer_count) || 0
    };
  } else {
    // Для общих офферов берем средние показатели по всем клиентам
    const allCustomersResult = await query(
      `SELECT
        COUNT(id) as customer_count,
        COALESCE(AVG(arpu), 0) as avg_arpu,
        COALESCE(AVG(tenure_months), 0) as avg_tenure_months,
        COALESCE(AVG(churn_score), 0) as avg_churn_score
       FROM customers
       WHERE status = 'active'`
    );

    if (allCustomersResult.rows.length > 0) {
      const stats = allCustomersResult.rows[0];
      segmentInfo = {
        id: null,
        name: 'Все клиенты',
        avg_arpu: parseFloat(stats.avg_arpu) || 0,
        avg_tenure_months: parseInt(stats.avg_tenure_months) || 0,
        avg_churn_score: parseFloat(stats.avg_churn_score) || 0,
        customer_count: parseInt(stats.customer_count) || 0
      };
    }
  }

  // 2. Получаем активные офферы для сегмента
  const offersResult = await query(
    `SELECT
      o.id,
      o.title,
      o.description,
      o.offer_type,
      o.priority,
      o.start_date,
      o.end_date,
      COALESCE(
        (SELECT COUNT(*) FROM offer_channels oc WHERE oc.offer_id = o.id AND oc.is_actual),
        0
      ) as channel_count,
      (SELECT od.discount_pct FROM offer_details od WHERE od.offer_id = o.id) as discount_pct,
      (SELECT od.hardware_internet IS NOT NULL FROM offer_details od WHERE od.offer_id = o.id) as has_hardware,
      COALESCE(
        (SELECT json_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.id)
         FROM offer_segments os2
         JOIN segments s ON os2.segment_id = s.id
         WHERE os2.offer_id = o.id),
        '[]'
      ) as segments
     FROM offers o
     WHERE o.status = 'active'
       AND o.start_date <= NOW()
       AND (o.end_date IS NULL OR o.end_date > NOW())
       AND (
         $1::INTEGER IS NULL OR
         -- Оффер привязан к указанному сегменту
         EXISTS (
           SELECT 1 FROM offer_segments os
           WHERE os.offer_id = o.id AND os.segment_id = $1
         )
         OR
         -- Оффер не привязан ни к одному сегменту (общий оффер)
         NOT EXISTS (
           SELECT 1 FROM offer_segments os
           WHERE os.offer_id = o.id
         )
       )
     ORDER BY o.priority DESC`,
    [segmentId]
  );

  let offers = offersResult.rows;

  if (offers.length === 0) {
    return [];
  }

  // 3. Применяем NBA scoring для каждого оффера на основе профиля сегмента
  const scoredOffers = offers.map(offer => {
    let score = 0;
    const reasons = [];

    // Базовый приоритет оффера (0-100)
    score += offer.priority;
    reasons.push(`Базовый приоритет: ${offer.priority}`);

    // Бонусы на основе типа оффера и профиля сегмента
    const segmentProfile = {
      arpu: segmentInfo.avg_arpu,
      tenure_months: segmentInfo.avg_tenure_months,
      churn_score: segmentInfo.avg_churn_score
    };

    const offerTypeBonus = calculateOfferTypeBonus(offer.offer_type, segmentProfile);
    score += offerTypeBonus.score;
    if (offerTypeBonus.reason) {
      reasons.push(offerTypeBonus.reason);
    }

    // Бонус за соответствие сегменту
    if (segmentId && offer.segments.some(s => s.id === segmentId)) {
      score += 20;
      reasons.push(`Специально для сегмента: ${segmentInfo.name}`);
    }

    // Бонус на основе риска оттока сегмента
    if (segmentInfo.avg_churn_score >= 0.7 && offer.offer_type === 'retention') {
      score += 30;
      reasons.push('Критично важно для удержания клиентов сегмента');
    } else if (segmentInfo.avg_churn_score >= 0.5 && offer.offer_type === 'retention') {
      score += 20;
      reasons.push('Помогает снизить риск оттока в сегменте');
    }

    // Бонус на основе среднего ARPU сегмента
    if (segmentInfo.avg_arpu >= 1500 && offer.offer_type === 'upgrade') {
      score += 25;
      reasons.push('Премиум предложение для высокодоходного сегмента');
    } else if (segmentInfo.avg_arpu < 1000 && offer.offer_type === 'discount') {
      score += 20;
      reasons.push('Выгодное предложение для экономного сегмента');
    }

    // Бонус для сегментов с молодыми клиентами
    if (segmentInfo.avg_tenure_months <= 3 && offer.offer_type === 'bonus') {
      score += 15;
      reasons.push('Специальное предложение для новых клиентов');
    } else if (segmentInfo.avg_tenure_months >= 24 && offer.offer_type === 'bonus') {
      score += 15;
      reasons.push('Бонус за лояльность для постоянных клиентов');
    }

    // Бонус за охват каналов: больше каналов → выше эффективность доставки
    const channelCount = parseInt(offer.channel_count) || 0;
    if (channelCount >= 4) {
      score += 10;
      reasons.push(`Мультиканальный оффер (${channelCount} каналов)`);
    } else if (channelCount >= 2) {
      score += 5;
      reasons.push(`Доступен через ${channelCount} канала`);
    }

    // Бонус за крупную скидку
    const discountPct = parseFloat(offer.discount_pct) || 0;
    if (discountPct >= 30) {
      score += 10;
      reasons.push(`Большая скидка ${discountPct}%`);
    } else if (discountPct >= 15) {
      score += 5;
      reasons.push(`Скидка ${discountPct}%`);
    }

    // Бонус за оборудование для сегментов с молодыми клиентами
    if (offer.has_hardware && segmentInfo.avg_tenure_months <= 6) {
      score += 8;
      reasons.push('Включает оборудование — подходит для подключения');
    }

    return {
      ...offer,
      nba_score: Math.round(score),
      recommendation_reasons: reasons,
      segment_profile: {
        segment_name: segmentInfo.name,
        avg_arpu: Math.round(segmentInfo.avg_arpu),
        avg_tenure_months: Math.round(segmentInfo.avg_tenure_months),
        avg_churn_risk: getChurnRiskLabel(segmentInfo.avg_churn_score),
        customer_count: segmentInfo.customer_count
      }
    };
  });

  // 4. Сортируем по NBA score и возвращаем топ-N
  const topOffers = scoredOffers
    .sort((a, b) => b.nba_score - a.nba_score)
    .slice(0, limit);

  return topOffers;
};

/**
 * Получить рекомендованные офферы для клиента (частный случай)
 * @param {number} customerId - ID клиента
 * @param {number} limit - Количество рекомендаций (по умолчанию 3)
 * @returns {Promise<Array>} - Массив рекомендованных офферов с объяснениями
 */
const getNextBestOffers = async (customerId, limit = 3) => {
  // 1. Получаем информацию о клиенте
  const customerResult = await query(
    `SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.email,
      c.arpu,
      c.tenure_months,
      c.churn_score,
      c.status,
      c.segment_id,
      s.name as segment_name
     FROM customers c
     LEFT JOIN segments s ON c.segment_id = s.id
     WHERE c.id = $1`,
    [customerId]
  );

  if (customerResult.rows.length === 0) {
    throw new Error('Клиент не найден');
  }

  const customer = customerResult.rows[0];

  // Безопасное преобразование числовых полей
  customer.arpu = parseFloat(customer.arpu) || 0;
  customer.tenure_months = parseInt(customer.tenure_months) || 0;
  customer.churn_score = parseFloat(customer.churn_score) || 0;

  // 2. Получаем активные офферы для сегмента клиента
  // Показываем офферы, которые:
  // - привязаны к сегменту клиента OR
  // - не привязаны ни к одному сегменту (общие офферы)
  const offersResult = await query(
    `SELECT
      o.id,
      o.title,
      o.description,
      o.offer_type,
      o.priority,
      o.start_date,
      o.end_date,
      COALESCE(
        (SELECT COUNT(*) FROM offer_channels oc WHERE oc.offer_id = o.id AND oc.is_actual),
        0
      ) as channel_count,
      (SELECT od.discount_pct FROM offer_details od WHERE od.offer_id = o.id) as discount_pct,
      (SELECT od.hardware_internet IS NOT NULL FROM offer_details od WHERE od.offer_id = o.id) as has_hardware,
      COALESCE(
        (SELECT json_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.id)
         FROM offer_segments os2
         JOIN segments s ON os2.segment_id = s.id
         WHERE os2.offer_id = o.id),
        '[]'
      ) as segments
     FROM offers o
     WHERE o.status = 'active'
       AND o.start_date <= NOW()
       AND (o.end_date IS NULL OR o.end_date > NOW())
       AND (
         -- Оффер привязан к сегменту клиента
         EXISTS (
           SELECT 1 FROM offer_segments os
           WHERE os.offer_id = o.id AND os.segment_id = $1
         )
         OR
         -- Оффер не привязан ни к одному сегменту (общий оффер)
         NOT EXISTS (
           SELECT 1 FROM offer_segments os
           WHERE os.offer_id = o.id
         )
       )
     ORDER BY o.priority DESC`,
    [customer.segment_id]
  );

  let offers = offersResult.rows;

  // 3. Исключаем офферы, которые недавно показывались или были отклонены
  const recentHistoryResult = await query(
    `SELECT DISTINCT offer_id
     FROM offer_history
     WHERE customer_id = $1
       AND (
         status = 'rejected'
         OR (status = 'shown' AND shown_at > NOW() - INTERVAL '30 days')
       )`,
    [customerId]
  );

  const excludedOfferIds = recentHistoryResult.rows.map(row => row.offer_id);
  offers = offers.filter(offer => !excludedOfferIds.includes(offer.id));

  if (offers.length === 0) {
    return [];
  }

  // 4. Применяем NBA scoring для каждого оффера
  const scoredOffers = offers.map(offer => {
    let score = 0;
    const reasons = [];

    // Базовый приоритет оффера (0-100)
    score += offer.priority;
    reasons.push(`Базовый приоритет: ${offer.priority}`);

    // Бонусы на основе типа оффера и профиля клиента
    const offerTypeBonus = calculateOfferTypeBonus(offer.offer_type, customer);
    score += offerTypeBonus.score;
    if (offerTypeBonus.reason) {
      reasons.push(offerTypeBonus.reason);
    }

    // Бонус за соответствие сегменту
    if (customer.segment_id && offer.segments.some(s => s.id === customer.segment_id)) {
      score += 20;
      reasons.push(`Соответствует вашему сегменту: ${customer.segment_name}`);
    }

    // Бонус на основе риска оттока
    if (customer.churn_score >= 0.7 && offer.offer_type === 'retention') {
      score += 30;
      reasons.push('Специальное предложение для удержания клиента');
    } else if (customer.churn_score >= 0.5 && offer.offer_type === 'retention') {
      score += 20;
      reasons.push('Помогает снизить риск оттока');
    }

    // Бонус на основе ARPU
    if (customer.arpu >= 1500 && offer.offer_type === 'upgrade') {
      score += 25;
      reasons.push('Премиум предложение для VIP клиента');
    } else if (customer.arpu < 1000 && offer.offer_type === 'discount') {
      score += 20;
      reasons.push('Выгодное предложение с экономией');
    }

    // Бонус на основе стажа обслуживания
    if (customer.tenure_months <= 3 && offer.offer_type === 'bonus') {
      score += 15;
      reasons.push('Специальное предложение для новых клиентов');
    } else if (customer.tenure_months >= 24 && offer.offer_type === 'bonus') {
      score += 15;
      reasons.push('Бонус за лояльность для постоянных клиентов');
    }

    // Бонус за охват каналов
    const channelCount = parseInt(offer.channel_count) || 0;
    if (channelCount >= 4) {
      score += 10;
      reasons.push(`Мультиканальный оффер (${channelCount} каналов)`);
    } else if (channelCount >= 2) {
      score += 5;
      reasons.push(`Доступен через ${channelCount} канала`);
    }

    // Бонус за крупную скидку
    const discountPct = parseFloat(offer.discount_pct) || 0;
    if (discountPct >= 30) {
      score += 10;
      reasons.push(`Большая скидка ${discountPct}%`);
    } else if (discountPct >= 15) {
      score += 5;
      reasons.push(`Скидка ${discountPct}%`);
    }

    // Бонус за оборудование для новых клиентов
    if (offer.has_hardware && customer.tenure_months <= 6) {
      score += 8;
      reasons.push('Включает оборудование — подходит при подключении');
    }

    return {
      ...offer,
      nba_score: Math.round(score),
      recommendation_reasons: reasons,
      customer_profile: {
        segment: customer.segment_name || 'Без сегмента',
        arpu: customer.arpu,
        tenure_months: customer.tenure_months,
        churn_risk: getChurnRiskLabel(customer.churn_score)
      }
    };
  });

  // 5. Сортируем по NBA score и возвращаем топ-N
  const topOffers = scoredOffers
    .sort((a, b) => b.nba_score - a.nba_score)
    .slice(0, limit);

  return topOffers;
};

/**
 * Вычисляет бонус на основе соответствия типа оффера профилю клиента
 */
const calculateOfferTypeBonus = (offerType, customer) => {
  const { churn_score, arpu, tenure_months } = customer;

  switch (offerType) {
    case 'retention':
      if (churn_score >= 0.7) {
        return { score: 30, reason: 'Критически важно для удержания' };
      } else if (churn_score >= 0.4) {
        return { score: 15, reason: 'Помогает снизить риск оттока' };
      }
      return { score: 0 };

    case 'upgrade':
      if (arpu >= 2000) {
        return { score: 25, reason: 'Идеально подходит для вашего тарифа' };
      } else if (arpu >= 1000 && tenure_months >= 12) {
        return { score: 15, reason: 'Отличная возможность для улучшения тарифа' };
      }
      return { score: 5 };

    case 'discount':
      if (arpu < 1000) {
        return { score: 20, reason: 'Максимальная экономия для вашего тарифа' };
      } else if (churn_score >= 0.5) {
        return { score: 15, reason: 'Специальная скидка' };
      }
      return { score: 5 };

    case 'bonus':
      if (tenure_months <= 3) {
        return { score: 20, reason: 'Приветственный бонус для новых клиентов' };
      } else if (tenure_months >= 24) {
        return { score: 15, reason: 'Бонус за лояльность' };
      }
      return { score: 10 };

    case 'recommendation':
      if (tenure_months >= 6 && churn_score < 0.5) {
        return { score: 15, reason: 'Дополнительная услуга для активных клиентов' };
      }
      return { score: 5 };

    default:
      return { score: 0 };
  }
};

/**
 * Получить текстовую метку риска оттока
 */
const getChurnRiskLabel = (churnScore) => {
  if (churnScore >= 0.7) return 'Высокий риск';
  if (churnScore >= 0.4) return 'Средний риск';
  return 'Низкий риск';
};

/**
 * Записать показ оффера в историю
 * @param {number} customerId - ID клиента
 * @param {number} offerId - ID оффера
 * @param {string} channel - Канал показа (web, mobile, email и т.д.)
 */
const recordOfferShown = async (customerId, offerId, channel = 'web') => {
  const result = await query(
    `INSERT INTO offer_history (customer_id, offer_id, status, channel, shown_at)
     VALUES ($1, $2, 'shown', $3, NOW())
     RETURNING *`,
    [customerId, offerId, channel]
  );
  return result.rows[0];
};

/**
 * Обновить статус оффера в истории (принят/отклонен)
 * @param {number} historyId - ID записи в истории
 * @param {string} status - Новый статус ('accepted' или 'rejected')
 */
const updateOfferStatus = async (historyId, status) => {
  const validStatuses = ['accepted', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new Error('Недопустимый статус');
  }

  const updateField = status === 'accepted' ? 'accepted_at' : 'rejected_at';

  const result = await query(
    `UPDATE offer_history
     SET status = $1, ${updateField} = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, historyId]
  );

  if (result.rows.length === 0) {
    throw new Error('Запись в истории не найдена');
  }

  return result.rows[0];
};

/**
 * Получить статистику эффективности NBA для клиента
 */
const getCustomerNBAStats = async (customerId) => {
  const result = await query(
    `SELECT
      COUNT(*) as total_offers_shown,
      COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
      COUNT(*) FILTER (WHERE status = 'shown') as pending_count,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'accepted')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected'))::numeric, 0) * 100,
        2
      ) as conversion_rate
     FROM offer_history
     WHERE customer_id = $1`,
    [customerId]
  );

  return result.rows[0];
};

/**
 * Получить статистику эффективности NBA для сегмента
 * @param {number} segmentId - ID сегмента
 * @returns {Promise<Object>} - Статистика по сегменту
 */
const getSegmentNBAStats = async (segmentId) => {
  // Получаем информацию о сегменте
  const segmentResult = await query(
    `SELECT id, name, description FROM segments WHERE id = $1`,
    [segmentId]
  );

  if (segmentResult.rows.length === 0) {
    throw new Error('Сегмент не найден');
  }

  const segment = segmentResult.rows[0];

  // Получаем агрегированную статистику по всем клиентам сегмента
  const statsResult = await query(
    `SELECT
      COUNT(DISTINCT oh.customer_id) as customers_engaged,
      COUNT(*) as total_offers_shown,
      COUNT(*) FILTER (WHERE oh.status = 'accepted') as accepted_count,
      COUNT(*) FILTER (WHERE oh.status = 'rejected') as rejected_count,
      COUNT(*) FILTER (WHERE oh.status = 'shown') as pending_count,
      ROUND(
        COUNT(*) FILTER (WHERE oh.status = 'accepted')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE oh.status IN ('accepted', 'rejected'))::numeric, 0) * 100,
        2
      ) as conversion_rate,
      COUNT(DISTINCT oh.offer_id) as unique_offers_shown
     FROM offer_history oh
     JOIN customers c ON oh.customer_id = c.id
     WHERE c.segment_id = $1`,
    [segmentId]
  );

  const stats = statsResult.rows[0];

  // Получаем количество клиентов в сегменте
  const customerCountResult = await query(
    `SELECT COUNT(*) as total_customers
     FROM customers
     WHERE segment_id = $1 AND status = 'active'`,
    [segmentId]
  );

  const totalCustomers = parseInt(customerCountResult.rows[0].total_customers) || 0;

  // Топ-5 самых успешных офферов для сегмента
  const topOffersResult = await query(
    `SELECT
      o.id,
      o.title,
      o.offer_type,
      COUNT(*) as shown_count,
      COUNT(*) FILTER (WHERE oh.status = 'accepted') as accepted_count,
      ROUND(
        COUNT(*) FILTER (WHERE oh.status = 'accepted')::numeric /
        NULLIF(COUNT(*), 0) * 100,
        2
      ) as conversion_rate
     FROM offer_history oh
     JOIN customers c ON oh.customer_id = c.id
     JOIN offers o ON oh.offer_id = o.id
     WHERE c.segment_id = $1
     GROUP BY o.id, o.title, o.offer_type
     ORDER BY accepted_count DESC, conversion_rate DESC
     LIMIT 5`,
    [segmentId]
  );

  return {
    segment: {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      total_customers: totalCustomers
    },
    overall_stats: {
      customers_engaged: parseInt(stats.customers_engaged) || 0,
      total_offers_shown: parseInt(stats.total_offers_shown) || 0,
      accepted_count: parseInt(stats.accepted_count) || 0,
      rejected_count: parseInt(stats.rejected_count) || 0,
      pending_count: parseInt(stats.pending_count) || 0,
      conversion_rate: parseFloat(stats.conversion_rate) || 0,
      unique_offers_shown: parseInt(stats.unique_offers_shown) || 0,
      engagement_rate: totalCustomers > 0
        ? parseFloat(((parseInt(stats.customers_engaged) || 0) / totalCustomers * 100).toFixed(2))
        : 0
    },
    top_offers: topOffersResult.rows
  };
};

module.exports = {
  getNextBestOffers,
  getNextBestOffersForSegment,
  recordOfferShown,
  updateOfferStatus,
  getCustomerNBAStats,
  getSegmentNBAStats
};
