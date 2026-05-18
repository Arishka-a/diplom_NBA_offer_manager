import { useState, useEffect } from 'react';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  RULE_TYPES,
  getRuleTypeName
} from '../services/ruleService';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import Pagination from '../components/Pagination';
import TableScroll from '../components/TableScroll';
import { PencilIcon, TrashIcon } from '../components/Icons';
import './DataPage.css';
import './RulesStatistics.css';

const Rules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Режим отображения: 'table' или 'statistics'
  const [viewMode, setViewMode] = useState('table');
  const [statistics, setStatistics] = useState({
    rules: [],
    typeStatistics: [],
    activityByDate: []
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Поиск и фильтрация
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRows, setFilterRows] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');
  const [filters, setFilters] = useState({});

  // Пагинация
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Модальные окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deletingRule, setDeletingRule] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rule_type: 'priority_boost',
    is_active: true,
    priority: 50,
    weight: 0.5,
    rule_definition: '{}',
    apply_conditions: '{}',
    target_segments: '',
    target_offer_types: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [searchTerm, filters, page, limit]);

  // Сбрасываем страницу при изменении фильтров/поиска
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        search: searchTerm || undefined,
        ...filters,
      };
      const data = await getRules(params);
      setRules(data.rules || []);
      const pag = data.pagination || {};
      setTotal(pag.total || 0);
      setTotalPages(pag.totalPages || 0);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
  };

  const loadStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await api.get('/rules/statistics/all');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'statistics' && statistics.rules.length === 0) {
      loadStatistics();
    }
  };

  // Цвета для графиков
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Подсчет общей статистики
  const totalExecutions = statistics.rules.reduce((sum, rule) => sum + parseInt(rule.total_executions || 0), 0);
  const totalApplied = statistics.rules.reduce((sum, rule) => sum + parseInt(rule.applied_count || 0), 0);
  const avgSuccessRate = statistics.rules.length > 0
    ? (statistics.rules.reduce((sum, rule) => sum + parseFloat(rule.success_rate || 0), 0) / statistics.rules.length).toFixed(2)
    : 0;

  // Подготовка данных для графиков
  const activityData = statistics.activityByDate.map(item => ({
    date: new Date(item.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
    'Всего выполнений': parseInt(item.executions),
    'Применено': parseInt(item.applied)
  })).reverse();

  const typeData = statistics.typeStatistics.map(item => ({
    name: item.rule_type,
    value: parseInt(item.total_executions || 0)
  }));

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleFilterApply = (rows = filterRows) => {
    setFilters(toFlatParams(rows, filterFields));
  };

  const handleFilterReset = () => {
    setFilterRows([]);
    setFilters({});
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      rule_type: 'priority_boost',
      is_active: true,
      priority: 50,
      weight: 0.5,
      rule_definition: '{}',
      apply_conditions: '{}',
      target_segments: '',
      target_offer_types: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      is_active: rule.is_active,
      priority: rule.priority,
      weight: rule.weight,
      rule_definition: JSON.stringify(rule.rule_definition, null, 2),
      apply_conditions: rule.apply_conditions ? JSON.stringify(rule.apply_conditions, null, 2) : '{}',
      target_segments: rule.target_segments ? rule.target_segments.join(',') : '',
      target_offer_types: rule.target_offer_types ? rule.target_offer_types.join(',') : ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenDelete = (rule) => {
    setDeletingRule(rule);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      // Валидация и парсинг JSON
      let ruleDefinition, applyConditions;
      try {
        ruleDefinition = JSON.parse(formData.rule_definition);
      } catch {
        throw new Error('Некорректный JSON в поле "Определение правила"');
      }

      try {
        applyConditions = formData.apply_conditions ? JSON.parse(formData.apply_conditions) : null;
      } catch {
        throw new Error('Некорректный JSON в поле "Условия применения"');
      }

      // Парсинг массивов
      const targetSegments = formData.target_segments
        ? formData.target_segments.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : null;

      const targetOfferTypes = formData.target_offer_types
        ? formData.target_offer_types.split(',').map(type => type.trim()).filter(type => type)
        : null;

      const ruleData = {
        name: formData.name,
        description: formData.description,
        rule_type: formData.rule_type,
        is_active: formData.is_active,
        priority: parseInt(formData.priority),
        weight: parseFloat(formData.weight),
        rule_definition: ruleDefinition,
        apply_conditions: applyConditions,
        target_segments: targetSegments,
        target_offer_types: targetOfferTypes
      };

      if (editingRule) {
        await updateRule(editingRule.id, ruleData);
      } else {
        await createRule(ruleData);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setFormError(err.response?.data?.error || err.message || 'Ошибка сохранения правила');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteRule(deletingRule.id);
      setIsDeleteModalOpen(false);
      setDeletingRule(null);
      await loadData();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setFormError(err.response?.data?.error || 'Ошибка удаления правила');
    }
  };

  if (loading && rules.length === 0) return <div className="page-loading">Загрузка правил...</div>;
  if (error && rules.length === 0) return <div className="page-error">{error}</div>;

  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'name', label: 'Название', type: 'string' },
    { key: 'description', label: 'Описание', type: 'string' },
    {
      key: 'rule_type',
      label: 'Тип правила',
      type: 'select',
      multi: false,
      options: RULE_TYPES.map((type) => ({
        value: type.value,
        label: type.label,
      })),
    },
    {
      key: 'is_active',
      label: 'Статус',
      type: 'select',
      multi: false,
      options: [
        { value: 'true', label: 'Активные' },
        { value: 'false', label: 'Неактивные' },
      ],
    },
    { key: 'priority', label: 'Приоритет', type: 'number' },
    { key: 'weight', label: 'Вес', type: 'number' },
    { key: 'created_at', label: 'Создано', type: 'date' },
  ];

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Управление правилами</h1>
        <div className="page-header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('table')}
            >
              📋 Таблица
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'statistics' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('statistics')}
            >
              📊 Статистика
            </button>
          </div>
          {viewMode === 'table' && (
            <button className="btn-primary" onClick={handleOpenCreate}>
              + Создать правило
            </button>
          )}
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          <SearchBar
        placeholder="Поиск по названию или описанию..."
        onSearch={handleSearch}
        initialValue={searchTerm}
      />

      <FilterBuilder
        fields={filterFields}
        value={filterRows}
        onChange={setFilterRows}
        logic={filterLogic}
        onLogicChange={setFilterLogic}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
      />

      <div className="data-table-container">
        <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Вес</th>
              <th>Создано</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  Правила не найдены
                </td>
              </tr>
            ) : (
              rules.map(rule => (
                <tr key={rule.id}>
                  <td>{rule.id}</td>
                  <td>
                    <strong>{rule.name}</strong>
                    {rule.description && (
                      <div className="description">{rule.description}</div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {getRuleTypeName(rule.rule_type)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${rule.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {rule.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </td>
                  <td>
                    <span className="priority-badge">{rule.priority}</span>
                  </td>
                  <td>{Number(rule.weight).toFixed(2)}</td>
                  <td>{new Date(rule.created_at).toLocaleDateString('ru')}</td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => handleOpenEdit(rule)}
                      title="Редактировать"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => handleOpenDelete(rule)}
                      title="Удалить"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </TableScroll>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={handleLimitChange}
        />
      </div>
        </>
      ) : (
        /* Режим статистики */
        <div className="rules-statistics">
          {statsLoading ? (
            <div className="loading">Загрузка статистики...</div>
          ) : (
            <>
              {/* Сводные метрики */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{statistics.rules.length}</div>
                  <div className="metric-label">Всего правил</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{statistics.rules.filter(r => r.is_active).length}</div>
                  <div className="metric-label">Активных правил</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{totalExecutions.toLocaleString()}</div>
                  <div className="metric-label">Всего выполнений</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{totalApplied.toLocaleString()}</div>
                  <div className="metric-label">Применено</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{avgSuccessRate}%</div>
                  <div className="metric-label">Средний Success Rate</div>
                </div>
              </div>

              {/* График активности */}
              {activityData.length > 0 && (
                <div className="chart-container">
                  <h2>Активность правил за последние 30 дней</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Всего выполнений" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="Применено" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Графики по типам */}
              <div className="charts-row">
                {typeData.length > 0 && (
                  <div className="chart-container half-width">
                    <h2>Выполнения по типам правил</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {statistics.typeStatistics.length > 0 && (
                  <div className="chart-container half-width">
                    <h2>Статистика по типам</h2>
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Тип правила</th>
                          <th>Кол-во</th>
                          <th>Выполнений</th>
                          <th>Применено</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.typeStatistics.map((type, index) => (
                          <tr key={index}>
                            <td>{type.rule_type}</td>
                            <td>{type.rules_count}</td>
                            <td>{parseInt(type.total_executions || 0).toLocaleString()}</td>
                            <td>{parseInt(type.applied_count || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Детальная таблица */}
              <div className="rules-detail-section">
                <h2>Детальная статистика правил</h2>
                <div className="table-responsive">
                  <table className="rules-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Выполнений</th>
                        <th>Применено</th>
                        <th>Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.rules.map((rule) => (
                        <tr key={rule.id}>
                          <td>{rule.id}</td>
                          <td className="rule-name">{rule.name}</td>
                          <td>
                            <span className={`badge badge-${rule.rule_type}`}>
                              {rule.rule_type}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${rule.is_active ? 'active' : 'inactive'}`}>
                              {rule.is_active ? 'Активно' : 'Неактивно'}
                            </span>
                          </td>
                          <td>{parseInt(rule.total_executions || 0).toLocaleString()}</td>
                          <td className="text-success">{parseInt(rule.applied_count || 0).toLocaleString()}</td>
                          <td>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${rule.success_rate || 0}%` }}
                              ></div>
                              <span className="progress-text">{parseFloat(rule.success_rate || 0).toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? 'Редактировать правило' : 'Создать правило'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {formError && <div className="modal-error">{formError}</div>}

          <div className="modal-form-group">
            <label htmlFor="name">
              Название<span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              minLength={3}
              maxLength={100}
              placeholder="Например: Приоритет для VIP клиентов"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="description">Описание</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Подробное описание правила..."
            />
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="rule_type">
                Тип правила<span className="required">*</span>
              </label>
              <select
                id="rule_type"
                name="rule_type"
                value={formData.rule_type}
                onChange={handleInputChange}
                required
              >
                {RULE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                {RULE_TYPES.find(t => t.value === formData.rule_type)?.description}
              </small>
            </div>

            <div className="modal-form-group">
              <label htmlFor="is_active">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                />
                {' '}Активно
              </label>
            </div>
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="priority">
                Приоритет (1-100)<span className="required">*</span>
              </label>
              <input
                type="number"
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                required
                min={1}
                max={100}
              />
              <small className="form-hint">Чем выше, тем важнее правило</small>
            </div>

            <div className="modal-form-group">
              <label htmlFor="weight">
                Вес (0.0-1.0)<span className="required">*</span>
              </label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                required
                min={0}
                max={1}
                step={0.01}
              />
              <small className="form-hint">Влияние на итоговый score</small>
            </div>
          </div>

          <div className="modal-form-group">
            <label htmlFor="rule_definition">
              Определение правила (JSON)<span className="required">*</span>
            </label>
            <textarea
              id="rule_definition"
              name="rule_definition"
              value={formData.rule_definition}
              onChange={handleInputChange}
              rows={6}
              required
              placeholder='{"boost_value": 20, "boost_type": "percentage"}'
              className="json-editor"
            />
            <small className="form-hint">JSON объект с параметрами правила</small>
          </div>

          <div className="modal-form-group">
            <label htmlFor="apply_conditions">Условия применения (JSON)</label>
            <textarea
              id="apply_conditions"
              name="apply_conditions"
              value={formData.apply_conditions}
              onChange={handleInputChange}
              rows={4}
              placeholder='{"min_arpu": 1500}'
              className="json-editor"
            />
            <small className="form-hint">Условия, при которых правило применяется</small>
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="target_segments">Целевые сегменты (ID через запятую)</label>
              <input
                type="text"
                id="target_segments"
                name="target_segments"
                value={formData.target_segments}
                onChange={handleInputChange}
                placeholder="1, 2, 3"
              />
              <small className="form-hint">Пусто = все сегменты</small>
            </div>

            <div className="modal-form-group">
              <label htmlFor="target_offer_types">Целевые типы офферов (через запятую)</label>
              <input
                type="text"
                id="target_offer_types"
                name="target_offer_types"
                value={formData.target_offer_types}
                onChange={handleInputChange}
                placeholder="discount, bonus"
              />
              <small className="form-hint">Пусто = все типы</small>
            </div>
          </div>

          <div className="modal-form-actions">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Сохранение...' : (editingRule ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удалить правило"
        size="small"
      >
        <div className="delete-confirmation">
          <p>Вы уверены, что хотите удалить правило?</p>
          {deletingRule && (
            <div className="delete-item-info">
              <strong>{deletingRule.name}</strong>
              {deletingRule.description && (
                <div className="description">{deletingRule.description}</div>
              )}
            </div>
          )}
          <p className="warning">Это действие нельзя отменить!</p>

          <div className="modal-form-actions">
            <button onClick={() => setIsDeleteModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button onClick={handleDeleteConfirm} className="btn-danger">
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Rules;
