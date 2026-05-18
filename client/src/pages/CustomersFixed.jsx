import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import api from '../services/api';
import TableScroll from '../components/TableScroll';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import { PencilIcon, TrashIcon } from '../components/Icons';
import './Customers.css';

const Customers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    arpu: 0,
    tenure_months: 0,
    churn_score: 0,
    segment_id: '',
    status: 'active'
  });

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRows, setFilterRows] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');
  const [filters, setFilters] = useState({});

  // Пагинация
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, [searchTerm, filters, page, limit]);

  useEffect(() => {
    loadSegments();
  }, []);

  // Сбрасываем страницу при изменении фильтров/поиска
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filters]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit,
        search: searchTerm || undefined,
        ...filters,
      };
      const response = await api.get('/customers', { params });
      setCustomers(response.data.data || []);
      const pag = response.data.pagination || {};
      setTotal(pag.total || 0);
      setTotalPages(pag.totalPages || pag.pages || 0);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
      setError(error.response?.data?.message || 'Ошибка загрузки данных');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
  };

  const loadSegments = async () => {
    try {
      const response = await api.get('/segments', { params: { limit: 100 } });
      setSegments(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки сегментов:', error);
    }
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      arpu: 0,
      tenure_months: 0,
      churn_score: 0,
      segment_id: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone || '',
      arpu: customer.arpu,
      tenure_months: customer.tenure_months,
      churn_score: customer.churn_score,
      segment_id: customer.segment_id || '',
      status: customer.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setShowModal(false);
      loadCustomers();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert(error.response?.data?.message || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить клиента?')) return;
    try {
      await api.delete(`/customers/${id}`);
      loadCustomers();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка удаления клиента');
    }
  };

  const getChurnBadgeClass = (score) => {
    if (!score && score !== 0) return 'badge-success';
    if (score >= 0.7) return 'badge-danger';
    if (score >= 0.4) return 'badge-warning';
    return 'badge-success';
  };

  const getChurnLabel = (score) => {
    if (!score && score !== 0) return 'Н/Д';
    if (score >= 0.7) return 'Высокий риск';
    if (score >= 0.4) return 'Средний риск';
    return 'Низкий риск';
  };

  const formatArpu = (arpu) => {
    if (!arpu && arpu !== 0) return '0.00';
    return Number(arpu).toFixed(2);
  };

  const formatChurnScore = (score) => {
    if (!score && score !== 0) return '0';
    return (Number(score) * 100).toFixed(0);
  };

  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'first_name', label: 'Имя', type: 'string' },
    { key: 'last_name', label: 'Фамилия', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    { key: 'phone', label: 'Телефон', type: 'string' },
    { key: 'arpu', label: 'ARPU', type: 'number' },
    { key: 'tenure_months', label: 'Стаж (мес.)', type: 'number' },
    { key: 'churn_score', label: 'Риск оттока', type: 'number' },
    {
      key: 'segment_id',
      label: 'Сегмент',
      type: 'select',
      multi: false,
      options: segments.map((seg) => ({
        value: String(seg.id),
        label: seg.name,
      })),
    },
    {
      key: 'status',
      label: 'Статус',
      type: 'select',
      multi: false,
      options: [
        { value: 'active', label: 'Активные' },
        { value: 'inactive', label: 'Неактивные' },
        { value: 'churned', label: 'Ушедшие' },
      ],
    },
  ];

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Клиенты</h1>
        <button onClick={handleCreate} className="btn btn-primary">
          Добавить клиента
        </button>
      </div>

      <div className="filters-panel">
        <input
          type="text"
          placeholder="Поиск по имени, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="filter-input"
        />
      </div>

      <FilterBuilder
        fields={filterFields}
        value={filterRows}
        onChange={setFilterRows}
        logic={filterLogic}
        onLogicChange={setFilterLogic}
        onApply={(rows = filterRows) => setFilters(toFlatParams(rows, filterFields))}
        onReset={() => {
          setFilterRows([]);
          setFilters({});
        }}
      />

      {/* Error message */}
      {error && (
        <div className="error-message" style={{
          padding: '15px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="table-container">
          <TableScroll>
          <table className="customers-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>ARPU</th>
                <th>Стаж (мес)</th>
                <th>Риск оттока</th>
                <th>Сегмент</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>
                    Нет данных
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.id}</td>
                    <td>{customer.first_name} {customer.last_name}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone || '-'}</td>
                    <td className="text-right">{formatArpu(customer.arpu)} ₽</td>
                    <td className="text-center">{customer.tenure_months || 0}</td>
                    <td>
                      <span className={`badge ${getChurnBadgeClass(customer.churn_score)}`}>
                        {getChurnLabel(customer.churn_score)} ({formatChurnScore(customer.churn_score)}%)
                      </span>
                    </td>
                    <td>{customer.segment_name || '-'}</td>
                    <td>
                      <span className={`status-badge status-${customer.status}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleEdit(customer)} className="btn-icon" title="Редактировать">
                        <PencilIcon />
                      </button>
                      <button onClick={() => handleDelete(customer.id)} className="btn-icon" title="Удалить">
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
      )}

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editingCustomer ? 'Редактировать клиента' : 'Новый клиент'}>
          <form onSubmit={handleSubmit} className="customer-form">
            <div className="form-row">
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Фамилия *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Телефон</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>ARPU (₽/мес)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.arpu}
                  onChange={(e) => setFormData({ ...formData, arpu: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Стаж (месяцев)</label>
                <input
                  type="number"
                  value={formData.tenure_months}
                  onChange={(e) => setFormData({ ...formData, tenure_months: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Риск оттока (0.00 - 1.00)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.churn_score}
                onChange={(e) => setFormData({ ...formData, churn_score: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Сегмент</label>
                <select
                  value={formData.segment_id}
                  onChange={(e) => setFormData({ ...formData, segment_id: e.target.value })}
                >
                  <option value="">Без сегмента</option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Статус</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Активный</option>
                  <option value="inactive">Неактивный</option>
                  <option value="churned">Ушел</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                {editingCustomer ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Customers;
