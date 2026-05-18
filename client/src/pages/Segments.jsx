import { useState, useEffect } from 'react';
import segmentService from '../services/segmentService';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import HistoryModal from '../components/HistoryModal';
import Pagination from '../components/Pagination';
import TableScroll from '../components/TableScroll';
import { PencilIcon, TrashIcon, ClockIcon } from '../components/Icons';
import './DataPage.css';

const Segments = () => {
  const [segments, setSegments] = useState([]);
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [deletingSegment, setDeletingSegment] = useState(null);
  const [historySegment, setHistorySegment] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    criteria: '',
    client_count: 0,
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSegments();
  }, [searchTerm, filters, page, limit]);

  // Сбрасываем страницу при изменении фильтров/поиска
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filters]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        search: searchTerm || undefined,
        ...filters,
      };
      const response = await segmentService.getSegments(params);
      setSegments(response.data || []);
      const pag = response.pagination || {};
      setTotal(pag.total || 0);
      setTotalPages(pag.totalPages || 0);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки сегментов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
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
    setEditingSegment(null);
    setFormData({
      name: '',
      description: '',
      criteria: '',
      client_count: 0,
      is_active: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || '',
      criteria: segment.criteria ? JSON.stringify(segment.criteria, null, 2) : '',
      client_count: segment.client_count || 0,
      is_active: segment.is_active,
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
      // Парсим criteria если есть
      let criteriaObj = null;
      if (formData.criteria.trim()) {
        try {
          criteriaObj = JSON.parse(formData.criteria);
        } catch (err) {
          setFormError('Неверный формат JSON в критериях');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        criteria: criteriaObj,
        client_count: parseInt(formData.client_count),
        is_active: formData.is_active,
      };

      if (editingSegment) {
        await segmentService.updateSegment(editingSegment.id, payload);
      } else {
        await segmentService.createSegment(payload);
      }

      setIsModalOpen(false);
      await loadSegments();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setFormError(err.response?.data?.message || 'Ошибка сохранения сегмента');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (segment) => {
    setDeletingSegment(segment);
    setIsDeleteModalOpen(true);
  };

  const handleOpenHistory = (segment) => {
    setHistorySegment(segment);
    setIsHistoryModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSegment) return;

    try {
      await segmentService.deleteSegment(deletingSegment.id);
      setIsDeleteModalOpen(false);
      setDeletingSegment(null);
      await loadSegments();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setFormError(err.response?.data?.message || 'Ошибка удаления сегмента');
      // Показываем ошибку пользователю
      alert(err.response?.data?.message || 'Ошибка удаления сегмента');
    }
  };

  if (loading && segments.length === 0) return <div className="page-loading">Загрузка сегментов...</div>;
  if (error && segments.length === 0) return <div className="page-error">{error}</div>;

  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'name', label: 'Название', type: 'string' },
    { key: 'description', label: 'Описание', type: 'string' },
    { key: 'client_count', label: 'Клиентов', type: 'number' },
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
  ];

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Сегменты клиентов</h1>
        <button className="btn-primary" onClick={handleOpenCreate}>
          + Создать сегмент
        </button>
      </div>

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
              <th>Описание</th>
              <th>Клиентов</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  Сегменты не найдены
                </td>
              </tr>
            ) : (
              segments.map((segment) => (
                <tr key={segment.id}>
                  <td>{segment.id}</td>
                  <td>{segment.name}</td>
                  <td>{segment.description || '-'}</td>
                  <td>{segment.client_count || 0}</td>
                  <td>
                    <span
                      className={`badge ${
                        segment.is_active ? 'badge-active' : 'badge-inactive'
                      }`}
                    >
                      {segment.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => handleOpenHistory(segment)}
                      title="История изменений"
                    >
                      <ClockIcon />
                    </button>
                    <button
                      className="btn-action"
                      onClick={() => handleOpenEdit(segment)}
                      title="Редактировать"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => handleOpenDelete(segment)}
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

      {/* Модальное окно создания/редактирования */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSegment ? 'Редактировать сегмент' : 'Создать сегмент'}
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
              onChange={handleChange}
              required
              placeholder="Название сегмента"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="description">Описание</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Описание сегмента"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="criteria">
              Критерии (JSON)
            </label>
            <textarea
              id="criteria"
              name="criteria"
              value={formData.criteria}
              onChange={handleChange}
              placeholder='{"age": {"min": 25, "max": 45}, "location": "Moscow"}'
              style={{ fontFamily: 'monospace', minHeight: '120px' }}
            />
            <small style={{ color: '#718096', fontSize: '12px' }}>
              Введите критерии в формате JSON (например: {`{"age": {"min": 25, "max": 45}}`})
            </small>
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="client_count">
                Количество клиентов
              </label>
              <input
                type="number"
                id="client_count"
                name="client_count"
                value={formData.client_count}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="modal-form-group">
              <label htmlFor="is_active" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  style={{ width: '18px', height: '18px', margin: 0 }}
                />
                Активен
              </label>
            </div>
          </div>

          <div className="modal-form-actions">
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
              {submitting
                ? 'Сохранение...'
                : editingSegment
                ? 'Сохранить'
                : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно подтверждения удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Подтверждение удаления"
        size="small"
      >
        <div>
          <p style={{ marginBottom: '20px' }}>
            Вы уверены, что хотите удалить сегмент{' '}
            <strong>{deletingSegment?.name}</strong>?
          </p>
          <p style={{ color: '#c53030', fontSize: '14px' }}>
            Это действие нельзя отменить.
          </p>
          <div className="modal-form-actions">
            <button
              className="btn-secondary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Отмена
            </button>
            <button
              className="btn-primary"
              onClick={handleDelete}
              style={{ background: '#e53e3e' }}
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно истории изменений */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        entityType="Segment"
        entityId={historySegment?.id}
        entityTitle={historySegment?.name}
      />
    </div>
  );
};

export default Segments;
