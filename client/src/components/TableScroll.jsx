import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './TableScroll.css';

const TOPBAR_HEIGHT = 64;
const TOP_SCROLL_HEIGHT = 16;
const STICKY_HEADER_TOP = TOPBAR_HEIGHT + TOP_SCROLL_HEIGHT;

const buildStickyContent = (stickyEl, bottomEl) => {
  if (!stickyEl || !bottomEl) return;
  const originalTable = bottomEl.querySelector('table');
  const originalThead = originalTable?.querySelector('thead');
  if (!originalTable || !originalThead) {
    stickyEl.innerHTML = '';
    return;
  }

  stickyEl.innerHTML = '';
  const tableClone = document.createElement('table');
  tableClone.className = originalTable.className;
  tableClone.style.tableLayout = 'fixed';
  tableClone.style.width = originalTable.offsetWidth + 'px';
  tableClone.style.borderCollapse = 'collapse';

  const colgroup = document.createElement('colgroup');
  const headerCells = originalThead.querySelectorAll(
    'tr:first-child > th, tr:first-child > td'
  );
  headerCells.forEach((cell) => {
    const col = document.createElement('col');
    col.style.width = cell.getBoundingClientRect().width + 'px';
    colgroup.appendChild(col);
  });
  tableClone.appendChild(colgroup);
  tableClone.appendChild(originalThead.cloneNode(true));

  stickyEl.appendChild(tableClone);
  stickyEl.scrollLeft = bottomEl.scrollLeft;
};

const TableScroll = ({ children }) => {
  const wrapperRef = useRef(null);
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const stickyRef = useRef(null);
  const syncingRef = useRef(false);

  const [contentWidth, setContentWidth] = useState(0);
  const [overflow, setOverflow] = useState(false);
  const [sticky, setSticky] = useState({ visible: false, left: 0, width: 0 });

  // ширина «донора» верхнего скроллбара = scrollWidth таблицы
  useLayoutEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const update = () => {
      setContentWidth(bottom.scrollWidth);
      setOverflow(bottom.scrollWidth > bottom.clientWidth + 1);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(bottom);
    Array.from(bottom.children).forEach((child) => ro.observe(child));

    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [children]);

  const syncScroll = (left) => {
    if (bottomRef.current && bottomRef.current.scrollLeft !== left) {
      bottomRef.current.scrollLeft = left;
    }
    if (topRef.current && topRef.current.scrollLeft !== left) {
      topRef.current.scrollLeft = left;
    }
    if (stickyRef.current && stickyRef.current.scrollLeft !== left) {
      stickyRef.current.scrollLeft = left;
    }
  };

  const handleTopScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    syncScroll(topRef.current.scrollLeft);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  const handleBottomScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    syncScroll(bottomRef.current.scrollLeft);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  // Слежение за положением таблицы в окне → показываем/прячем оверлей шапки
  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const update = () => {
      const rect = bottom.getBoundingClientRect();
      const headerEl = bottom.querySelector('thead');
      const headerH = headerEl?.offsetHeight || 40;
      const visible =
        rect.top < STICKY_HEADER_TOP && rect.bottom > STICKY_HEADER_TOP + headerH;

      setSticky((prev) => {
        const next = {
          visible,
          left: rect.left,
          width: rect.width,
        };
        if (
          prev.visible === next.visible &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const ro = new ResizeObserver(update);
    ro.observe(bottom);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [children]);

  // Когда оверлей становится видимым (или меняется ширина) — пересобираем шапку
  useEffect(() => {
    if (!stickyRef.current) return;
    if (sticky.visible) {
      buildStickyContent(stickyRef.current, bottomRef.current);
    } else {
      stickyRef.current.innerHTML = '';
    }
  }, [sticky.visible, sticky.width, contentWidth]);

  return (
    <div className="table-scroll-wrapper" ref={wrapperRef}>
      <div
        className="table-scroll-top"
        ref={topRef}
        onScroll={handleTopScroll}
        aria-hidden="true"
        style={{ visibility: overflow ? 'visible' : 'hidden' }}
      >
        <div className="table-scroll-spacer" style={{ width: contentWidth }} />
      </div>
      <div
        className="data-table-scroll"
        ref={bottomRef}
        onScroll={handleBottomScroll}
      >
        {children}
      </div>
      <div
        className="table-sticky-header"
        ref={stickyRef}
        aria-hidden="true"
        style={{
          display: sticky.visible ? 'block' : 'none',
          position: 'fixed',
          top: STICKY_HEADER_TOP,
          left: sticky.left,
          width: sticky.width,
        }}
      />
    </div>
  );
};

export default TableScroll;
