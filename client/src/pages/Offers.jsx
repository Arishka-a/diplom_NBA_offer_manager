import { useState, useEffect } from 'react';
import offerService from '../services/offerService';
import segmentService from '../services/segmentService';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import FilterBuilder from '../components/FilterBuilder';
import { toFlatParams } from '../components/filterBuilderUtils';
import ConditionManager from '../components/ConditionManager';
import HistoryModal from '../components/HistoryModal';
import Pagination from '../components/Pagination';
import TableScroll from '../components/TableScroll';
import { PencilIcon, TrashIcon, ClockIcon } from '../components/Icons';
import './DataPage.css';

const Offers = () => {
  const [offers, setOffers] = useState([]);
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
  const [editingOffer, setEditingOffer] = useState(null);
  const [deletingOffer, setDeletingOffer] = useState(null);
  const [historyOffer, setHistoryOffer] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    offer_type: 'discount',
    status: 'draft',
    priority: 50,
    segment_ids: [],
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [searchTerm, filters, page, limit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        search: searchTerm || undefined,
        ...filters,
      };

      const [offersRes, segmentsRes] = await Promise.all([
        offerService.getOffers(params),
        segmentService.getSegments(),
      ]);
      setOffers(offersRes.data || []);
      setSegments(segmentsRes.data || []);
      const pag = offersRes.pagination || {};
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

  const handleSearch = (term) => {
    setPage(1);
    setSearchTerm(term);
  };

  const handleFilterApply = (rows = filterRows) => {
    setPage(1);
    setFilters(toFlatParams(rows, filterFields));
  };

  const handleFilterReset = () => {
    setPage(1);
    setFilterRows([]);
    setFilters({});
  };

  const handleLimitChange = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
  };

  const handleOpenCreate = () => {
    setEditingOffer(null);
    setFormData({
      title: '',
      description: '',
      offer_type: 'discount',
      status: 'draft',
      priority: 50,
      segment_ids: [],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description || '',
      offer_type: offer.offer_type,
      status: offer.status,
      priority: offer.priority,
      segment_ids: offer.segment_ids || [],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      const segmentId = parseInt(value);
      setFormData(prev => ({
        ...prev,
        segment_ids: checked
          ? [...prev.segment_ids, segmentId]
          : prev.segment_ids.filter(id => id !== segmentId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        priority: parseInt(formData.priority),
      };

      if (editingOffer) {
        await offerService.updateOffer(editingOffer.id, payload);
      } else {
        await offerService.createOffer(payload);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setFormError(err.response?.data?.message || 'Ошибка сохранения оффера');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (offer) => {
    setDeletingOffer(offer);
    setIsDeleteModalOpen(true);
  };

  const handleOpenHistory = (offer) => {
    setHistoryOffer(offer);
    setIsHistoryModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingOffer) return;

    try {
      await offerService.deleteOffer(deletingOffer.id);
      setIsDeleteModalOpen(false);
      setDeletingOffer(null);
      await loadData();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setFormError(err.response?.data?.message || 'Ошибка удаления оффера');
    }
  };

  const getOfferTypeLabel = (type) => {
    const types = {
      discount: 'Скидка',
      bonus: 'Бонус',
      recommendation: 'Рекомендация',
      upgrade: 'Апгрейд',
      retention: 'Удержание',
    };
    return types[type] || type;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      draft: 'Черновик',
      active: 'Активный',
      inactive: 'Неактивный',
      archived: 'Архивный',
    };
    return statuses[status] || status;
  };

  const channelLabels = {
    phone: 'Тел',
    push: 'Push',
    mail: 'Mail',
    sms: 'SMS',
    lm: 'ЛК',
    okc: 'ОКЦ',
    ltv: 'LTV',
  };

  const renderChannels = (channels) => {
    if (!channels || channels.length === 0) return <span className="muted">—</span>;
    return (
      <div className="channels-list">
        {channels.map((ch) => (
          <span key={ch} className="channel-chip" title={ch}>
            {channelLabels[ch] || ch}
          </span>
        ))}
      </div>
    );
  };

  const renderDiscount = (pct, months) => {
    if (pct == null || Number(pct) === 0) return <span className="muted">—</span>;
    const value = Number(pct).toFixed(0);
    return (
      <span className="discount-badge">
        −{value}%{months ? ` · ${months} мес` : ''}
      </span>
    );
  };

  if (loading && offers.length === 0) return <div className="page-loading">Загрузка офферов...</div>;
  if (error && offers.length === 0) return <div className="page-error">{error}</div>;

  const filterFields = [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'title', label: 'Название', type: 'string' },
    { key: 'product_code', label: 'Продукт', type: 'string' },
    {
      key: 'offer_type',
      label: 'Тип',
      type: 'select',
      multi: false,
      options: [
        { value: 'discount', label: 'Скидка' },
        { value: 'bonus', label: 'Бонус' },
        { value: 'recommendation', label: 'Рекомендация' },
        { value: 'upgrade', label: 'Апгрейд' },
        { value: 'retention', label: 'Удержание' },
      ],
    },
    {
      key: 'status',
      label: 'Статус',
      type: 'select',
      multi: false,
      options: [
        { value: 'draft', label: 'Черновик' },
        { value: 'active', label: 'Активный' },
        { value: 'inactive', label: 'Неактивный' },
        { value: 'archived', label: 'Архивный' },
      ],
    },
    { key: 'priority', label: 'Приоритет', type: 'number' },
    {
      key: 'channel',
      label: 'Канал',
      type: 'select',
      multi: false,
      options: [
        { value: 'phone', label: 'Тел' },
        { value: 'push', label: 'Push' },
        { value: 'mail', label: 'Mail' },
        { value: 'sms', label: 'SMS' },
        { value: 'lm', label: 'ЛК' },
        { value: 'okc', label: 'ОКЦ' },
        { value: 'ltv', label: 'LTV' },
      ],
    },
    { key: 'discount_pct', label: 'Скидка %', type: 'number' },
    { key: 'hardware_internet', label: 'Роутер', type: 'string' },
    { key: 'hardware_tv', label: 'ТВ-приставка', type: 'string' },
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
  ];

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Управление офферами</h1>
        <button className="btn-primary" onClick={handleOpenCreate}>
          + Создать оффер
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
              <th className="col-title">Название</th>
              <th>Продукт</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th className="col-channels">Каналы</th>
              <th>Скидка</th>
              <th className="col-hardware">Роутер</th>
              <th className="col-hardware">ТВ-приставка</th>
              <th>Сегменты</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {offers.length === 0 ? (
              <tr>
                <td colSpan="12" className="no-data">
                  Офферы не найдены
                </td>
              </tr>
            ) : (
              offers.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.id}</td>
                  <td className="col-title">{offer.title}</td>
                  <td>
                    {offer.product_code ? (
                      <span className="product-code" title={offer.product_name || ''}>
                        {offer.product_code}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {getOfferTypeLabel(offer.offer_type)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${offer.status}`}>
                      {getStatusLabel(offer.status)}
                    </span>
                  </td>
                  <td>{offer.priority}</td>
                  <td className="col-channels">{renderChannels(offer.channels)}</td>
                  <td>{renderDiscount(offer.discount_pct, offer.discount_period_months)}</td>
                  <td className="col-hardware">
                    {offer.hardware_internet ? (
                      <span className="hardware-code">{offer.hardware_internet}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="col-hardware">
                    {offer.hardware_tv ? (
                      <span className="hardware-code">{offer.hardware_tv}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {offer.segments && offer.segments.length > 0 ? (
                      <div className="channels-list">
                        {offer.segments.map((s) => (
                          <span key={s.id} className="channel-chip">{s.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => handleOpenHistory(offer)}
                      title="История изменений"
                    >
                      <ClockIcon />
                    </button>
                    <button
                      className="btn-action"
                      onClick={() => handleOpenEdit(offer)}
                      title="Редактировать"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => handleOpenDelete(offer)}
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
        title={editingOffer ? 'Редактировать оффер' : 'Создать оффер'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {formError && <div className="modal-error">{formError}</div>}

          <div className="modal-form-group">
            <label htmlFor="title">
              Название<span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Название оффера"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="description">Описание</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Описание оффера"
            />
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="offer_type">
                Тип оффера<span className="required">*</span>
              </label>
              <select
                id="offer_type"
                name="offer_type"
                value={formData.offer_type}
                onChange={handleChange}
                required
              >
                <option value="discount">Скидка</option>
                <option value="bonus">Бонус</option>
                <option value="recommendation">Рекомендация</option>
                <option value="upgrade">Апгрейд</option>
                <option value="retention">Удержание</option>
              </select>
            </div>

            <div className="modal-form-group">
              <label htmlFor="status">
                Статус<span className="required">*</span>
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="draft">Черновик</option>
                <option value="active">Активный</option>
                <option value="inactive">Неактивный</option>
                <option value="archived">Архивный</option>
              </select>
            </div>
          </div>

          <div className="modal-form-group">
            <label htmlFor="priority">
              Приоритет (1-100)<span className="required">*</span>
            </label>
            <input
              type="number"
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              min="1"
              max="100"
              required
            />
          </div>

          <div className="modal-form-group">
            <label>Целевые сегменты</label>
            <div className="checkbox-group">
              {segments.map((segment) => (
                <div key={segment.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`segment-${segment.id}`}
                    value={segment.id}
                    checked={formData.segment_ids.includes(segment.id)}
                    onChange={handleChange}
                  />
                  <label htmlFor={`segment-${segment.id}`}>
                    {segment.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Условия активации (только для существующих офферов) */}
          {editingOffer && (
            <ConditionManager offerId={editingOffer.id} />
          )}

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
                : editingOffer
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
            Вы уверены, что хотите удалить оффер{' '}
            <strong>{deletingOffer?.title}</strong>?
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
        entityType="Offer"
        entityId={historyOffer?.id}
        entityTitle={historyOffer?.title}
      />
    </div>
  );
};

export default Offers;
