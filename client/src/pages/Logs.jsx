import { useState, useEffect } from 'react';
import logService from '../services/logService';
import Pagination from '../components/Pagination';
import TableScroll from '../components/TableScroll';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import './DataPage.css';
import './Logs.css';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [filterRows, setFilterRows] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');
  const [appliedFilters, setAppliedFilters] = useState({});

  // Пагинация
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [appliedFilters, page, limit]);

  // Сбрасываем страницу при смене применённых фильтров
  useEffect(() => {
    setPage(1);
  }, [appliedFilters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await logService.getLogs({ page, limit, ...appliedFilters });
      setLogs(response.data || []);
      const pag = response.pagination || {};
      setTotal(pag.total || 0);
      setTotalPages(pag.totalPages || 0);
    } catch (err) {
      setError('Ошибка загрузки логов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
  };

  const toggleRowExpand = (logId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const formatDetails = (details) => {
    if (!details) return null;
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(details);
    }
  };

  const getActionBadgeClass = (action) => {
    const classes = {
      'CREATE': 'badge-create',
      'UPDATE': 'badge-update',
      'DELETE': 'badge-delete',
      'LOGIN': 'badge-login',
      'LOGOUT': 'badge-logout',
      'IMPORT': 'badge-import',
      'EXPORT': 'badge-export'
    };
    return classes[action] || 'badge-info';
  };

  const getActionLabel = (action) => {
    const labels = {
      'CREATE': 'Создание',
      'UPDATE': 'Изменение',
      'DELETE': 'Удаление',
      'LOGIN': 'Вход',
      'LOGOUT': 'Выход',
      'IMPORT': 'Импорт',
      'EXPORT': 'Экспорт'
    };
    return labels[action] || action;
  };

  const getEntityTypeLabel = (entityType) => {
    const labels = {
      'Offer': 'Оффер',
      'Segment': 'Сегмент',
      'User': 'Пользователь',
      'Rule': 'Правило',
      'Condition': 'Условие',
      'Customer': 'Клиент',
      'Auth': 'Авторизация'
    };
    return labels[entityType] || entityType;
  };

  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    {
      key: 'action',
      label: 'Действие',
      type: 'select',
      multi: false,
      options: [
        { value: 'CREATE', label: 'Создание' },
        { value: 'UPDATE', label: 'Изменение' },
        { value: 'DELETE', label: 'Удаление' },
        { value: 'LOGIN', label: 'Вход' },
        { value: 'LOGOUT', label: 'Выход' },
        { value: 'IMPORT', label: 'Импорт' },
        { value: 'EXPORT', label: 'Экспорт' },
      ],
    },
    {
      key: 'entity_type',
      label: 'Тип сущности',
      type: 'select',
      multi: false,
      options: [
        { value: 'Offer', label: 'Офферы' },
        { value: 'Segment', label: 'Сегменты' },
        { value: 'User', label: 'Пользователи' },
        { value: 'Rule', label: 'Правила' },
        { value: 'Condition', label: 'Условия' },
        { value: 'Customer', label: 'Клиенты' },
        { value: 'Auth', label: 'Авторизация' },
      ],
    },
    { key: 'entity_id', label: 'ID объекта', type: 'number' },
    { key: 'user_id', label: 'ID пользователя', type: 'number' },
    { key: 'created_at', label: 'Дата', type: 'date' },
  ];

  const applyFilters = (rows = filterRows) => {
    setAppliedFilters(toFlatParams(rows, filterFields));
  };

  const resetFilters = () => {
    setFilterRows([]);
    setAppliedFilters({});
  };

  if (loading && logs.length === 0) return <div className="page-loading">Загрузка логов...</div>;
  if (error && logs.length === 0) return <div className="page-error">{error}</div>;

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Журнал действий</h1>
      </div>

      <FilterBuilder
        fields={filterFields}
        value={filterRows}
        onChange={setFilterRows}
        logic={filterLogic}
        onLogicChange={setFilterLogic}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <div className="data-table-container">
        <TableScroll>
        <table className="data-table logs-table">
          <thead>
            <tr>
              <th style={{width: '50px'}}>ID</th>
              <th style={{width: '100px'}}>Действие</th>
              <th style={{width: '120px'}}>Тип</th>
              <th style={{width: '80px'}}>ID объекта</th>
              <th style={{width: '120px'}}>Пользователь</th>
              <th style={{width: '160px'}}>Дата и время</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  Логи не найдены
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className={expandedRows.has(log.id) ? 'expanded' : ''}>
                  <td>{log.id}</td>
                  <td>
                    <span className={`badge ${getActionBadgeClass(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td>{getEntityTypeLabel(log.entity_type)}</td>
                  <td>{log.entity_id || '-'}</td>
                  <td>
                    <span className="username">
                      {log.username || `ID: ${log.user_id}` || 'Система'}
                    </span>
                  </td>
                  <td>{new Date(log.created_at).toLocaleString('ru')}</td>
                  <td className="details-cell">
                    {log.details ? (
                      <div className="details-wrapper">
                        <button
                          className="btn-expand"
                          onClick={() => toggleRowExpand(log.id)}
                          title={expandedRows.has(log.id) ? 'Свернуть' : 'Развернуть'}
                        >
                          {expandedRows.has(log.id) ? '▼' : '▶'} Показать
                        </button>
                        {expandedRows.has(log.id) && (
                          <pre className="details-content">
                            {formatDetails(log.details)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <span className="no-details">—</span>
                    )}
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
    </div>
  );
};

export default Logs;
