import { useState, useEffect } from 'react';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getRoles,
  getRoleDisplayName,
  formatLastLogin
} from '../services/userService';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import Pagination from '../components/Pagination';
import TableScroll from '../components/TableScroll';
import { PencilIcon, TrashIcon } from '../components/Icons';
import './DataPage.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  const [editingUser, setEditingUser] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role_id: 1
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [searchTerm, filters, page, limit]);

  useEffect(() => {
    loadRoles();
  }, []);

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

      const response = await getUsers(params);
      setUsers(response.data || []);
      const pag = response.pagination || {};
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

  const loadRoles = async () => {
    try {
      const response = await getRoles();
      setRoles(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки ролей:', err);
    }
  };

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

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role_id: roles.length > 0 ? roles[0].id : 1
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // пароль не передаём при редактировании
      role_id: user.role_id,
      is_active: user.is_active
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      // Валидация
      if (!formData.username || formData.username.length < 3) {
        setFormError('Логин должен содержать минимум 3 символа');
        setSubmitting(false);
        return;
      }

      if (!formData.email || !formData.email.includes('@')) {
        setFormError('Введите корректный email');
        setSubmitting(false);
        return;
      }

      if (!editingUser && (!formData.password || formData.password.length < 6)) {
        setFormError('Пароль должен содержать минимум 6 символов');
        setSubmitting(false);
        return;
      }

      const payload = {
        username: formData.username,
        email: formData.email,
        role_id: parseInt(formData.role_id)
      };

      // Пароль включаем только если он указан
      if (formData.password) {
        payload.password = formData.password;
      }

      // При редактировании добавляем is_active
      if (editingUser) {
        payload.is_active = formData.is_active;
      }

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        alert('Пользователь успешно обновлён');
      } else {
        await createUser(payload);
        alert('Пользователь успешно создан');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Submit error:', err);
      setFormError(
        err.response?.data?.message ||
        'Ошибка при сохранении пользователя'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'деактивировать' : 'активировать';
    const warning = user.is_active
      ? `\n\nВнимание: деактивированный пользователь будет автоматически удалён через 60 дней!`
      : '';

    if (!window.confirm(`Вы уверены, что хотите ${action} пользователя "${user.username}"?${warning}`)) {
      return;
    }

    try {
      await toggleUserStatus(user.id);
      const message = user.is_active
        ? 'Пользователь деактивирован. Он будет автоматически удалён через 60 дней.'
        : 'Пользователь активирован.';
      alert(message);
      await loadData();
    } catch (err) {
      console.error('Toggle status error:', err);
      alert(err.response?.data?.message || 'Ошибка при изменении статуса');
    }
  };

  // Определение фильтров
  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'username', label: 'Логин', type: 'string' },
    { key: 'email', label: 'Email', type: 'string' },
    {
      key: 'role',
      label: 'Роль',
      type: 'select',
      multi: false,
      options: roles.map((role) => ({
        value: role.name,
        label: getRoleDisplayName(role.name),
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
    { key: 'last_login', label: 'Последний вход', type: 'date' },
    { key: 'created_at', label: 'Дата создания', type: 'date' },
  ];

  if (loading && users.length === 0) {
    return <div className="data-page"><div className="loading">Загрузка...</div></div>;
  }

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Управление пользователями</h1>
        <button className="btn-primary" onClick={handleOpenCreate}>
          + Создать пользователя
        </button>
      </div>

      {/* Поиск и фильтры */}
      <SearchBar
        placeholder="Поиск по логину или email..."
        onSearch={handleSearch}
      />

      {roles.length > 0 && (
        <FilterBuilder
          fields={filterFields}
          value={filterRows}
          onChange={setFilterRows}
          logic={filterLogic}
          onLogicChange={setFilterLogic}
          onApply={handleFilterApply}
          onReset={handleFilterReset}
        />
      )}

      {error && <div className="page-error">{error}</div>}

      {/* Таблица пользователей */}
      <div className="table-container">
        <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Логин</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Последний вход</th>
              <th>Дата создания</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge badge-${user.role === 'Administrator' ? 'admin' : 'operator'}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Активен' : 'Деактивирован'}
                    </span>
                  </td>
                  <td>{formatLastLogin(user.last_login)}</td>
                  <td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => handleOpenEdit(user)}
                        title="Редактировать"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleToggleStatus(user)}
                        title={user.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        <TrashIcon />
                      </button>
                    </div>
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

      {/* Модальное окно создания/редактирования пользователя */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Редактировать пользователя' : 'Создать пользователя'}
      >
        <form onSubmit={handleSubmit} className="form">
          {formError && <div className="form-error">{formError}</div>}

          <div className="form-group">
            <label htmlFor="username">Логин *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength="3"
              placeholder="Введите логин (минимум 3 символа)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="user@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Пароль {!editingUser && '*'}
              {editingUser && ' (оставьте пустым, если не хотите менять)'}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!editingUser}
              minLength="6"
              placeholder={editingUser ? 'Оставьте пустым для сохранения текущего' : 'Минимум 6 символов'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role_id">Роль *</label>
            <select
              id="role_id"
              name="role_id"
              value={formData.role_id}
              onChange={handleChange}
              required
            >
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {getRoleDisplayName(role.name)}
                </option>
              ))}
            </select>
          </div>

          {editingUser && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Активен
              </label>
              <small className="form-hint">
                При деактивации пользователь будет автоматически удалён через 60 дней
              </small>
            </div>
          )}

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

      <style jsx>{`
        .badge-admin {
          background: #f9f0ff;
          color: #531dab;
          border: 1px solid #d3adf7;
        }

        .badge-operator {
          background: #e6f4ff;
          color: #0958d9;
          border: 1px solid #91caff;
        }

        .badge-active {
          background: var(--status-active-bg);
          color: #237804;
          border: 1px solid var(--status-active-border);
        }

        .badge-inactive {
          background: var(--status-error-bg);
          color: var(--status-error);
          border: 1px solid var(--status-error-border);
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .btn-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-color);
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          transition: all 0.2s;
          color: var(--text-medium);
        }

        .btn-icon:hover {
          color: var(--text-dark);
          border-color: var(--text-medium);
          background: var(--background-light);
        }

        .btn-icon svg {
          display: block;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 400;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--primary-blue);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-light);
        }
      `}</style>
    </div>
  );
};

export default Users;
