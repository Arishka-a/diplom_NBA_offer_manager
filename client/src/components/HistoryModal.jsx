import { useState, useEffect } from 'react';
import logService from '../services/logService';
import './HistoryModal.css';

/**
 * Модальное окно для просмотра истории изменений объекта
 * @param {Object} props
 * @param {boolean} props.isOpen - Флаг открытия модального окна
 * @param {function} props.onClose - Функция закрытия
 * @param {string} props.entityType - Тип сущности (Offer, Segment, etc.)
 * @param {number} props.entityId - ID сущности
 * @param {string} props.entityTitle - Название сущности для отображения
 */
const HistoryModal = ({ isOpen, onClose, entityType, entityId, entityTitle }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());

  useEffect(() => {
    if (isOpen && entityType && entityId) {
      loadHistory();
    }
  }, [isOpen, entityType, entityId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await logService.getEntityHistory(entityType, entityId);
      setHistory(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setError('Не удалось загрузить историю изменений');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFieldName = (field) => {
    const fieldNames = {
      title: 'Название',
      description: 'Описание',
      offer_type: 'Тип оффера',
      status: 'Статус',
      priority: 'Приоритет',
      start_date: 'Дата начала',
      end_date: 'Дата окончания',
      name: 'Название',
      criteria: 'Критерии',
      client_count: 'Количество клиентов',
      is_active: 'Активен',
      segments: 'Сегменты'
    };
    return fieldNames[field] || field;
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const renderPreviousState = (previousState) => {
    if (!previousState) return null;

    let state;
    try {
      state = typeof previousState === 'string' ? JSON.parse(previousState) : previousState;
    } catch {
      return <pre className="state-raw">{String(previousState)}</pre>;
    }

    return (
      <div className="state-fields">
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="state-field">
            <span className="field-name">{formatFieldName(key)}:</span>
            <span className="field-value">
              {typeof value === 'object' ? (
                <pre className="field-json">{formatValue(value)}</pre>
              ) : (
                formatValue(value)
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  const getEntityTypeLabel = () => {
    const labels = {
      Offer: 'оффера',
      Segment: 'сегмента',
      Rule: 'правила',
      User: 'пользователя',
      Customer: 'клиента',
      Condition: 'условия'
    };
    return labels[entityType] || entityType;
  };

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={e => e.stopPropagation()}>
        <div className="history-modal-header">
          <h2>История изменений {getEntityTypeLabel()}</h2>
          <span className="entity-name">{entityTitle}</span>
          <button className="close-btn" onClick={onClose} title="Закрыть">×</button>
        </div>

        <div className="history-modal-content">
          {loading && (
            <div className="history-loading">
              Загрузка истории...
            </div>
          )}

          {error && (
            <div className="history-error">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="history-empty">
              <span className="empty-icon">📋</span>
              <p>История изменений пуста</p>
              <span className="empty-hint">Изменения объекта будут отображаться здесь</span>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="history-timeline">
              {history.map((item, index) => (
                <div key={item.id} className="history-item">
                  <div className="timeline-marker">
                    <div className="marker-dot"></div>
                    {index < history.length - 1 && <div className="marker-line"></div>}
                  </div>

                  <div className="history-card">
                    <div className="history-card-header">
                      <div className="history-meta">
                        <span className="history-date">{formatDate(item.created_at)}</span>
                        <span className="history-user">
                          {item.changed_by_username || 'Система'}
                        </span>
                      </div>
                      {item.change_reason && (
                        <span className="history-reason">{item.change_reason}</span>
                      )}
                    </div>

                    <div className="history-card-body">
                      <button
                        className="expand-state-btn"
                        onClick={() => toggleExpand(item.id)}
                      >
                        {expandedItems.has(item.id) ? '▼' : '▶'}
                        Предыдущее состояние
                      </button>

                      {expandedItems.has(item.id) && (
                        <div className="previous-state">
                          {renderPreviousState(item.previous_state)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="history-modal-footer">
          <span className="history-count">
            {history.length > 0 ? `Всего записей: ${history.length}` : ''}
          </span>
          <button className="btn-close" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
