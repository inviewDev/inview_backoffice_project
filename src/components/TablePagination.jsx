import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAnglesLeft,
  faAnglesRight,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import '../styles/table_pagination.css';

function getVisiblePages(pageIndex, pageCount, maxVisible) {
  const visibleCount = Math.min(maxVisible, pageCount);
  const half = Math.floor(visibleCount / 2);
  let start = Math.max(0, pageIndex - half);

  if (start + visibleCount > pageCount) {
    start = Math.max(0, pageCount - visibleCount);
  }

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function TablePagination({
  pageIndex,
  pageCount,
  onPageChange,
  maxVisible = 5,
  className = '',
}) {
  const safePageCount = Math.max(Number(pageCount) || 0, 1);
  const safePageIndex = Math.min(Math.max(Number(pageIndex) || 0, 0), safePageCount - 1);
  const pages = getVisiblePages(safePageIndex, safePageCount, maxVisible);

  return (
    <nav className={`table_pagination ${className}`.trim()} aria-label="페이지 이동">
      <button
        type="button"
        onClick={() => onPageChange(0)}
        disabled={safePageIndex === 0}
        aria-label="첫 페이지"
      >
        <FontAwesomeIcon icon={faAnglesLeft} />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(safePageIndex - 1)}
        disabled={safePageIndex === 0}
        aria-label="이전 페이지"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>

      {pages.map(page => (
        <button
          type="button"
          key={page}
          className={page === safePageIndex ? 'active' : ''}
          onClick={() => onPageChange(page)}
          aria-current={page === safePageIndex ? 'page' : undefined}
          aria-label={`${page + 1} 페이지`}
        >
          {page + 1}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(safePageIndex + 1)}
        disabled={safePageIndex >= safePageCount - 1}
        aria-label="다음 페이지"
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(safePageCount - 1)}
        disabled={safePageIndex >= safePageCount - 1}
        aria-label="마지막 페이지"
      >
        <FontAwesomeIcon icon={faAnglesRight} />
      </button>
    </nav>
  );
}

export default TablePagination;
