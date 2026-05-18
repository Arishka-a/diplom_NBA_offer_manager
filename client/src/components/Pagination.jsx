import './Pagination.css';

const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  if (!totalPages || totalPages <= 1) {
    return (
      <div className="pagination-bar pagination-bar--single">
        <div className="pagination-info">
          {total > 0 ? `Всего записей: ${total}` : ''}
        </div>
        {onLimitChange && total > Math.min(...pageSizeOptions) && (
          <PageSizeSelect limit={limit} options={pageSizeOptions} onChange={onLimitChange} />
        )}
      </div>
    );
  }

  const goTo = (p) => {
    const next = Math.max(1, Math.min(totalPages, p));
    if (next !== page) onPageChange(next);
  };

  const pages = buildPageList(page, totalPages);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Показано {from}–{to} из {total}
      </div>

      <div className="pagination-controls">
        <div className="pagination-arrows">
          <button
            className="pagination-btn"
            onClick={() => goTo(1)}
            disabled={page === 1}
            title="Первая"
          >
            ««
          </button>
          <button
            className="pagination-btn"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            title="Назад"
          >
            ‹
          </button>
        </div>

        <div className="pagination-numbers">
          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`gap-${idx}`} className="pagination-gap">…</span>
            ) : (
              <button
                key={p}
                className={`pagination-btn ${p === page ? 'pagination-btn--active' : ''}`}
                onClick={() => goTo(p)}
              >
                {p}
              </button>
            )
          )}
        </div>

        <div className="pagination-arrows">
          <button
            className="pagination-btn"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            title="Вперёд"
          >
            ›
          </button>
          <button
            className="pagination-btn"
            onClick={() => goTo(totalPages)}
            disabled={page === totalPages}
            title="Последняя"
          >
            »»
          </button>
        </div>
      </div>

      {onLimitChange && (
        <PageSizeSelect limit={limit} options={pageSizeOptions} onChange={onLimitChange} />
      )}
    </div>
  );
};

const PageSizeSelect = ({ limit, options, onChange }) => (
  <div className="pagination-page-size">
    <label>На странице:</label>
    <select value={limit} onChange={(e) => onChange(parseInt(e.target.value))}>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

function buildPageList(page, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // 3-страничное окно с зажатием по краям
  let start = Math.max(1, page - 1);
  let end   = Math.min(totalPages, page + 1);

  // Если упёрлись в край — расширяем окно в другую сторону, чтобы было ровно 3 номера
  if (end - start < 2) {
    if (start === 1) end = Math.min(totalPages, start + 2);
    else if (end === totalPages) start = Math.max(1, end - 2);
  }

  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  // Хвост: ... + последняя (если окно не доходит до конца)
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return pages;
}

export default Pagination;
