import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import nbaService from '../services/nbaService';
import segmentService from '../services/segmentService';
import './NBARecommendations.css';

const NBARecommendations = () => {
  const { user } = useAuth();

  // Режим работы: 'segment' или 'customer'
  const [mode, setMode] = useState('segment');

  // Данные для режима сегментов
  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentStats, setSegmentStats] = useState(null);

  // Данные для режима клиентов
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerStats, setCustomerStats] = useState(null);

  // Общие данные
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode === 'segment') {
      loadSegments();
    } else {
      loadCustomers();
    }
  }, [mode]);

  const loadSegments = async () => {
    try {
      const response = await segmentService.getSegments({ limit: 100 });
      setSegments(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки сегментов:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await api.get('/customers', { params: { limit: 100 } });
      setCustomers(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setRecommendations([]);
    setSelectedSegment(null);
    setSelectedCustomer(null);
    setSegmentStats(null);
    setCustomerStats(null);
    setError(null);
  };

  const handleSegmentSelect = async (e) => {
    const segmentId = e.target.value === '' ? null : parseInt(e.target.value);

    if (segmentId === null) {
      setSelectedSegment(null);
      setRecommendations([]);
      setSegmentStats(null);
      return;
    }

    const segment = segments.find(s => s.id === segmentId);
    setSelectedSegment(segment);
    await loadSegmentRecommendations(segmentId);
    await loadSegmentStats(segmentId);
  };

  const loadSegmentRecommendations = async (segmentId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await nbaService.getSegmentRecommendations(segmentId, 5);
      setRecommendations(data.data.recommendations || []);
    } catch (error) {
      console.error('Ошибка получения рекомендаций:', error);
      setError(error.response?.data?.message || 'Ошибка получения рекомендаций');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSegmentStats = async (segmentId) => {
    try {
      const data = await nbaService.getSegmentStats(segmentId);
      setSegmentStats(data.data);
    } catch (error) {
      console.error('Ошибка получения статистики сегмента:', error);
    }
  };

  const handleCustomerSelect = async (e) => {
    const customerId = parseInt(e.target.value);
    if (!customerId) {
      setSelectedCustomer(null);
      setRecommendations([]);
      setCustomerStats(null);
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    await loadCustomerRecommendations(customerId);
    await loadCustomerStats(customerId);
  };

  const loadCustomerRecommendations = async (customerId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await nbaService.getRecommendations(customerId, 5);
      setRecommendations(data.data.recommendations || []);
    } catch (error) {
      console.error('Ошибка получения рекомендаций:', error);
      setError(error.response?.data?.message || 'Ошибка получения рекомендаций');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerStats = async (customerId) => {
    try {
      const data = await nbaService.getCustomerStats(customerId);
      setCustomerStats(data.data);
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
    }
  };

  const handleRecordShown = async (offerId) => {
    if (mode === 'customer' && selectedCustomer) {
      try {
        await nbaService.recordOfferShown(selectedCustomer.id, offerId);
        alert('Показ оффера записан');
        loadCustomerStats(selectedCustomer.id);
      } catch (error) {
        console.error('Ошибка записи показа:', error);
        alert('Ошибка записи показа оффера');
      }
    }
  };

  const getOfferTypeLabel = (type) => {
    const types = {
      'discount': 'Скидка',
      'bonus': 'Бонус',
      'upgrade': 'Апгрейд',
      'retention': 'Удержание',
      'recommendation': 'Рекомендация'
    };
    return types[type] || type;
  };

  const getScoreColor = (score) => {
    if (score >= 100) return '#28a745';
    if (score >= 80) return '#5cb85c';
    if (score >= 60) return '#f0ad4e';
    return '#999';
  };

  return (
    <div className="nba-page">
      <div className="page-header">
        <h1>NBA - Рекомендации офферов</h1>
        <p className="page-description">
          Интеллектуальная система подбора следующего лучшего действия (Next Best Action)
        </p>
      </div>

      {/* Переключатель режимов */}
      <div className="mode-switcher">
        <button
          className={`mode-btn ${mode === 'segment' ? 'active' : ''}`}
          onClick={() => handleModeChange('segment')}
        >
          По сегментам
        </button>
        <button
          className={`mode-btn ${mode === 'customer' ? 'active' : ''}`}
          onClick={() => handleModeChange('customer')}
        >
          По клиентам
        </button>
      </div>

      {/* Режим сегментов */}
      {mode === 'segment' && (
        <>
          <div className="selector-container">
            <label htmlFor="segment-select">Выберите сегмент:</label>
            <select
              id="segment-select"
              onChange={handleSegmentSelect}
              className="selector"
            >
              <option value="">-- Выберите сегмент --</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name} ({segment.client_count || 0} клиентов)
                </option>
              ))}
            </select>
          </div>

          {/* Информация о сегменте */}
          {selectedSegment && (
            <div className="info-card segment-info-card">
              <h2>Профиль сегмента</h2>
              <div className="info-details">
                <div className="detail-item">
                  <span className="label">Название:</span>
                  <span className="value">{selectedSegment.name}</span>
                </div>
                {selectedSegment.description && (
                  <div className="detail-item">
                    <span className="label">Описание:</span>
                    <span className="value">{selectedSegment.description}</span>
                  </div>
                )}
                {segmentStats && (
                  <>
                    <div className="detail-item">
                      <span className="label">Клиентов в сегменте:</span>
                      <span className="value">{segmentStats.segment.total_customers}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Статистика сегмента */}
              {segmentStats && (
                <div className="stats-section">
                  <h3>Статистика взаимодействия с офферами</h3>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{segmentStats.overall_stats.total_offers_shown || 0}</div>
                      <div className="stat-label">Показано офферов</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{segmentStats.overall_stats.customers_engaged || 0}</div>
                      <div className="stat-label">Вовлечено клиентов</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{segmentStats.overall_stats.accepted_count || 0}</div>
                      <div className="stat-label">Принято</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{segmentStats.overall_stats.conversion_rate || 0}%</div>
                      <div className="stat-label">Конверсия</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{segmentStats.overall_stats.engagement_rate || 0}%</div>
                      <div className="stat-label">Вовлеченность</div>
                    </div>
                  </div>

                  {segmentStats.top_offers && segmentStats.top_offers.length > 0 && (
                    <div className="top-offers-section">
                      <h4>Топ-5 офферов для сегмента</h4>
                      <table className="top-offers-table">
                        <thead>
                          <tr>
                            <th>Оффер</th>
                            <th>Тип</th>
                            <th>Показано</th>
                            <th>Принято</th>
                            <th>Конверсия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segmentStats.top_offers.map((offer) => (
                            <tr key={offer.id}>
                              <td>{offer.title}</td>
                              <td>{getOfferTypeLabel(offer.offer_type)}</td>
                              <td>{offer.shown_count}</td>
                              <td>{offer.accepted_count}</td>
                              <td>{offer.conversion_rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Режим клиентов */}
      {mode === 'customer' && (
        <>
          <div className="selector-container">
            <label htmlFor="customer-select">Выберите клиента:</label>
            <select
              id="customer-select"
              onChange={handleCustomerSelect}
              className="selector"
            >
              <option value="">-- Выберите клиента --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name} ({customer.email})
                  {customer.segment_name ? ` - ${customer.segment_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Информация о клиенте */}
          {selectedCustomer && (
            <div className="info-card customer-info-card">
              <h2>Профиль клиента</h2>
              <div className="info-details">
                <div className="detail-item">
                  <span className="label">Имя:</span>
                  <span className="value">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Сегмент:</span>
                  <span className="value">{selectedCustomer.segment_name || 'Без сегмента'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">ARPU:</span>
                  <span className="value">{parseFloat(selectedCustomer.arpu || 0).toFixed(2)} ₽/мес</span>
                </div>
                <div className="detail-item">
                  <span className="label">Стаж:</span>
                  <span className="value">{selectedCustomer.tenure_months || 0} мес</span>
                </div>
                <div className="detail-item">
                  <span className="label">Риск оттока:</span>
                  <span className={`value churn-${parseFloat(selectedCustomer.churn_score || 0) >= 0.7 ? 'high' : parseFloat(selectedCustomer.churn_score || 0) >= 0.4 ? 'medium' : 'low'}`}>
                    {(parseFloat(selectedCustomer.churn_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Статистика клиента */}
              {customerStats && (
                <div className="stats-section">
                  <h3>Статистика взаимодействия с офферами</h3>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{customerStats.total_offers_shown || 0}</div>
                      <div className="stat-label">Показано офферов</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{customerStats.accepted_count || 0}</div>
                      <div className="stat-label">Принято</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{customerStats.rejected_count || 0}</div>
                      <div className="stat-label">Отклонено</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{customerStats.conversion_rate || 0}%</div>
                      <div className="stat-label">Конверсия</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Ошибка */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="loading">Загрузка рекомендаций...</div>
      )}

      {/* Рекомендации */}
      {!loading && recommendations.length > 0 && (
        <div className="recommendations-section">
          <h2>Рекомендованные офферы</h2>
          <p className="recommendations-hint">
            {mode === 'segment'
              ? 'Офферы отсортированы по релевантности для данного сегмента'
              : 'Офферы отсортированы по релевантности для данного клиента'
            }
          </p>

          <div className="recommendations-list">
            {recommendations.map((rec, index) => (
              <div key={rec.id} className="recommendation-card">
                <div className="card-header">
                  <div className="rank">#{index + 1}</div>
                  <div className="score" style={{ color: getScoreColor(rec.nba_score) }}>
                    <div className="score-value">{rec.nba_score}</div>
                    <div className="score-label">NBA Score</div>
                  </div>
                </div>

                <div className="card-body">
                  <h3 className="offer-title">{rec.title}</h3>
                  <p className="offer-description">{rec.description}</p>

                  <div className="offer-meta">
                    <span className={`offer-type type-${rec.offer_type}`}>
                      {getOfferTypeLabel(rec.offer_type)}
                    </span>
                    <span className="offer-priority">
                      Приоритет: {rec.priority}
                    </span>
                  </div>

                  {/* Причины рекомендации */}
                  <div className="recommendation-reasons">
                    <h4>Почему рекомендуется:</h4>
                    <ul>
                      {rec.recommendation_reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Профиль */}
                  {mode === 'segment' && rec.segment_profile && (
                    <div className="profile-tags">
                      <span className="tag">{rec.segment_profile.segment_name}</span>
                      <span className="tag">Ср. ARPU: {rec.segment_profile.avg_arpu} ₽</span>
                      <span className="tag">Ср. стаж: {rec.segment_profile.avg_tenure_months} мес</span>
                      <span className="tag">{rec.segment_profile.avg_churn_risk}</span>
                      <span className="tag">{rec.segment_profile.customer_count} клиентов</span>
                    </div>
                  )}

                  {mode === 'customer' && rec.customer_profile && (
                    <div className="profile-tags">
                      <span className="tag">{rec.customer_profile.segment}</span>
                      <span className="tag">ARPU: {rec.customer_profile.arpu} ₽</span>
                      <span className="tag">Стаж: {rec.customer_profile.tenure_months} мес</span>
                      <span className="tag">{rec.customer_profile.churn_risk}</span>
                    </div>
                  )}
                </div>

                {mode === 'customer' && (
                  <div className="card-footer">
                    <button
                      onClick={() => handleRecordShown(rec.id)}
                      className="btn btn-primary"
                    >
                      Показать клиенту
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Нет рекомендаций */}
      {!loading && (selectedSegment || selectedCustomer) && recommendations.length === 0 && !error && (
        <div className="no-recommendations">
          <p>Для данного {mode === 'segment' ? 'сегмента' : 'клиента'} нет доступных рекомендаций</p>
          <p className="hint">Возможно, все актуальные офферы уже были показаны</p>
        </div>
      )}
    </div>
  );
};

export default NBARecommendations;
