import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import api from '../services/api';
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

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    segment_id: ''
  });

  useEffect(() => {
    loadCustomers();
    loadSegments();
  }, [filters]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 100, ...filters };
      const response = await api.get('/customers', { params });
      setCustomers(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
      setError(error.response?.data?.message || 'Ошибка загрузки данных');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
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
    if (score >= 0.7) return 'badge-danger';
    if (score >= 0.4) return 'badge-warning';
    return 'badge-success';
  };

  const getChurnLabel = (score) => {
    if (score >= 0.7) return 'Высокий риск';
    if (score >= 0.4) return 'Средний риск';
    return 'Низкий риск';
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Клиенты</h1>
        <button onClick={handleCreate} className="btn btn-primary">
          Добавить клиента
        </button>
      </div>

      {/* Filters */}
      <div className="filters-panel">
        <input
          type="text"
          placeholder="Поиск по имени, email..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="filter-input"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="filter-select"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="churned">Ушедшие</option>
        </select>
        <select
          value={filters.segment_id}
          onChange={(e) => setFilters({ ...filters, segment_id: e.target.value })}
          className="filter-select"
        >
          <option value="">Все сегменты</option>
          {segments.map((seg) => (
            <option key={seg.id} value={seg.id}>
              {seg.name}
            </option>
          ))}
        </select>
      </div>

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
                  <td className="text-right">{customer.arpu.toFixed(2)} ₽</td>
                  <td className="text-center">{customer.tenure_months}</td>
                  <td>
                    <span className={`badge ${getChurnBadgeClass(customer.churn_score)}`}>
                      {getChurnLabel(customer.churn_score)} ({(customer.churn_score * 100).toFixed(0)}%)
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
                      Ред.
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="btn-icon" title="Удалить">
                      Удал.
                    </button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
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
                  onChange={(e) => setFormData({ ...formData, arpu: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Стаж (месяцев)</label>
                <input
                  type="number"
                  value={formData.tenure_months}
                  onChange={(e) => setFormData({ ...formData, tenure_months: parseInt(e.target.value) })}
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
                onChange={(e) => setFormData({ ...formData, churn_score: parseFloat(e.target.value) })}
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
