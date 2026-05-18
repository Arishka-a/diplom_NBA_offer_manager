import { useState, useEffect } from 'react';
import {
  getConditionsByOfferId,
  createCondition,
  updateCondition,
  deleteCondition,
  getConditionTypes,
  getConditionTypeName,
  getConditionTypeIcon,
  formatConditionValue,
  getConditionValueTemplate,
  validateConditionValue,
  CONDITION_TYPES
} from '../services/conditionService';
import Modal from './Modal';
import { PencilIcon, TrashIcon } from './Icons';
import './ConditionManager.css';

const ConditionManager = ({ offerId }) => {
  const [conditions, setConditions] = useState([]);
  const [conditionTypes, setConditionTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Модальные окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [deletingCondition, setDeletingCondition] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    condition_type: CONDITION_TYPES.TIME,
    condition_value: {},
    is_active: true
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (offerId) {
      loadConditions();
    }
    loadConditionTypes();
  }, [offerId]);

  const loadConditions = async () => {
    try {
      setLoading(true);
      const response = await getConditionsByOfferId(offerId);
      setConditions(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading conditions:', err);
      setError('Ошибка загрузки условий');
    } finally {
      setLoading(false);
    }
  };

  const loadConditionTypes = async () => {
    try {
      const response = await getConditionTypes();
      setConditionTypes(response.data || []);
    } catch (err) {
      console.error('Error loading condition types:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingCondition(null);
    const initialType = conditionTypes.length > 0 ? conditionTypes[0].type : CONDITION_TYPES.TIME;
    setFormData({
      condition_type: initialType,
      condition_value: getConditionValueTemplate(initialType),
      is_active: true
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (condition) => {
    setEditingCondition(condition);
    setFormData({
      condition_type: condition.condition_type,
      condition_value: condition.condition_value,
      is_active: condition.is_active
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType) => {
    setFormData({
      ...formData,
      condition_type: newType,
      condition_value: getConditionValueTemplate(newType)
    });
  };

  const handleValueChange = (newValue) => {
    setFormData({
      ...formData,
      condition_value: newValue
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      // Валидация
      const validationError = validateConditionValue(formData.condition_type, formData.condition_value);
      if (validationError) {
        setFormError(validationError);
        setSubmitting(false);
        return;
      }

      const payload = {
        offer_id: offerId,
        condition_type: formData.condition_type,
        condition_value: formData.condition_value,
        is_active: formData.is_active
      };

      if (editingCondition) {
        await updateCondition(editingCondition.id, {
          condition_type: formData.condition_type,
          condition_value: formData.condition_value,
          is_active: formData.is_active
        });
        alert('Условие успешно обновлено');
      } else {
        await createCondition(payload);
        alert('Условие успешно создано');
      }

      setIsModalOpen(false);
      await loadConditions();
    } catch (err) {
      console.error('Submit error:', err);
      setFormError(err.response?.data?.message || 'Ошибка при сохранении условия');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (condition) => {
    setDeletingCondition(condition);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingCondition) return;

    setSubmitting(true);
    try {
      await deleteCondition(deletingCondition.id);
      alert('Условие успешно удалено');
      setIsDeleteModalOpen(false);
      await loadConditions();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || 'Ошибка при удалении условия');
    } finally {
      setSubmitting(false);
    }
  };

  if (!offerId) {
    return (
      <div className="condition-manager">
        <p className="condition-notice">
          Сохраните оффер, чтобы добавить условия активации
        </p>
      </div>
    );
  }

  return (
    <div className="condition-manager">
      <div className="condition-header">
        <h3>Условия активации</h3>
        <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
          + Добавить условие
        </button>
      </div>

      {error && <div className="condition-error">{error}</div>}

      {loading ? (
        <div className="condition-loading">Загрузка условий...</div>
      ) : conditions.length === 0 ? (
        <div className="condition-empty">
          <p>Условия активации не заданы</p>
          <p className="condition-hint">
            Условия определяют, когда и как оффер будет показан клиентам
          </p>
        </div>
      ) : (
        <div className="condition-list">
          {conditions.map((condition) => (
            <div key={condition.id} className="condition-card">
              <div className="condition-card-header">
                <div className="condition-type">
                  <span className="condition-icon">
                    {getConditionTypeIcon(condition.condition_type)}
                  </span>
                  <span className="condition-type-name">
                    {getConditionTypeName(condition.condition_type)}
                  </span>
                </div>
                <div className="condition-actions">
                  <span className={`condition-status ${condition.is_active ? 'active' : 'inactive'}`}>
                    {condition.is_active ? 'Активно' : 'Неактивно'}
                  </span>
                  <button
                    className="btn-icon"
                    onClick={() => handleOpenEdit(condition)}
                    title="Редактировать"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleOpenDelete(condition)}
                    title="Удалить"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              <div className="condition-value">
                {formatConditionValue(condition.condition_type, condition.condition_value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания/редактирования условия */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCondition ? 'Редактировать условие' : 'Добавить условие'}
      >
        <form onSubmit={handleSubmit} className="condition-form">
          {formError && <div className="form-error">{formError}</div>}

          <div className="form-group">
            <label htmlFor="condition_type">Тип условия *</label>
            <select
              id="condition_type"
              value={formData.condition_type}
              onChange={(e) => handleTypeChange(e.target.value)}
              required
            >
              {conditionTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {getConditionTypeIcon(type.type)} {type.name}
                </option>
              ))}
            </select>
            <small className="form-hint">
              {conditionTypes.find(t => t.type === formData.condition_type)?.description}
            </small>
          </div>

          <ConditionValueEditor
            conditionType={formData.condition_type}
            value={formData.condition_value}
            onChange={handleValueChange}
          />

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Условие активно</span>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно подтверждения удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Подтверждение удаления"
      >
        <div className="delete-confirmation">
          <p>
            Вы уверены, что хотите удалить условие{' '}
            <strong>{deletingCondition && getConditionTypeName(deletingCondition.condition_type)}</strong>?
          </p>

          <div className="form-actions">
            <button
              className="btn-secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/**
 * Редактор значения условия в зависимости от типа
 */
const ConditionValueEditor = ({ conditionType, value, onChange }) => {
  const handleChange = (field, newValue) => {
    onChange({
      ...value,
      [field]: newValue
    });
  };

  switch (conditionType) {
    case CONDITION_TYPES.TIME:
      return (
        <div className="condition-value-editor">
          <div className="form-group">
            <label>Дни недели</label>
            <div className="days-selector">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                <label key={index} className="day-checkbox">
                  <input
                    type="checkbox"
                    checked={value.days?.includes(index === 6 ? 0 : index + 1) || false}
                    onChange={(e) => {
                      const dayNum = index === 6 ? 0 : index + 1;
                      const newDays = e.target.checked
                        ? [...(value.days || []), dayNum]
                        : (value.days || []).filter(d => d !== dayNum);
                      handleChange('days', newDays);
                    }}
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Начало (час)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={value.hours?.start || 0}
                onChange={(e) => handleChange('hours', {
                  ...value.hours,
                  start: parseInt(e.target.value)
                })}
              />
            </div>
            <div className="form-group">
              <label>Окончание (час)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={value.hours?.end || 23}
                onChange={(e) => handleChange('hours', {
                  ...value.hours,
                  end: parseInt(e.target.value)
                })}
              />
            </div>
          </div>
        </div>
      );

    case CONDITION_TYPES.TRIGGER:
      return (
        <div className="condition-value-editor">
          <div className="form-group">
            <label>Событие *</label>
            <input
              type="text"
              value={value.event || ''}
              onChange={(e) => handleChange('event', e.target.value)}
              placeholder="Например: purchase_completed"
              required
            />
          </div>
          <div className="form-group">
            <label>Порог (опционально)</label>
            <input
              type="number"
              min="1"
              value={value.threshold || ''}
              onChange={(e) => handleChange('threshold', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Например: 3"
            />
          </div>
        </div>
      );

    case CONDITION_TYPES.LIMIT:
      return (
        <div className="condition-value-editor">
          <div className="form-group">
            <label>Максимум показов</label>
            <input
              type="number"
              min="1"
              value={value.max_shows || ''}
              onChange={(e) => handleChange('max_shows', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Например: 5"
            />
          </div>
          <div className="form-group">
            <label>Максимум конверсий</label>
            <input
              type="number"
              min="1"
              value={value.max_conversions || ''}
              onChange={(e) => handleChange('max_conversions', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Например: 1"
            />
          </div>
        </div>
      );

    case CONDITION_TYPES.CHANNEL:
      const availableChannels = ['email', 'push', 'sms', 'app', 'web'];
      return (
        <div className="condition-value-editor">
          <div className="form-group">
            <label>Каналы доставки *</label>
            <div className="channels-selector">
              {availableChannels.map((channel) => (
                <label key={channel} className="channel-checkbox">
                  <input
                    type="checkbox"
                    checked={value.channels?.includes(channel) || false}
                    onChange={(e) => {
                      const newChannels = e.target.checked
                        ? [...(value.channels || []), channel]
                        : (value.channels || []).filter(c => c !== channel);
                      handleChange('channels', newChannels);
                    }}
                  />
                  <span>{channel}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );

    case CONDITION_TYPES.FREQUENCY:
      return (
        <div className="condition-value-editor">
          <div className="form-group">
            <label>Период *</label>
            <select
              value={value.period || 'day'}
              onChange={(e) => handleChange('period', e.target.value)}
              required
            >
              <option value="hour">Час</option>
              <option value="day">День</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
            </select>
          </div>
          <div className="form-group">
            <label>Максимум показов *</label>
            <input
              type="number"
              min="1"
              value={value.max_count || 1}
              onChange={(e) => handleChange('max_count', parseInt(e.target.value))}
              required
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="form-group">
          <label>Значение условия (JSON)</label>
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch (err) {
                // Игнорируем ошибки парсинга при вводе
              }
            }}
            rows="5"
          />
        </div>
      );
  }
};

export default ConditionManager;
