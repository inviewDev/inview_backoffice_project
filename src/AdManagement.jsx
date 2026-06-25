import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCoins,
  faMagnifyingGlass,
  faSquarePlus,
} from '@fortawesome/free-solid-svg-icons';
import { Alert, Spinner, Table } from 'react-bootstrap';
import TablePagination from './components/TablePagination';
import './styles/ad_management.css';

const columnHelper = createColumnHelper();
const AD_MANAGEMENT_STATE_KEY = 'ad_management_list_state';
const DEFAULT_PAGINATION = {
  pageIndex: 0,
  pageSize: 10,
};

function getAdManagementStateKey(userId) {
  return `${AD_MANAGEMENT_STATE_KEY}:${userId || 'anonymous'}`;
}

function readAdManagementState(userId) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(getAdManagementStateKey(userId)) || '{}');
    const pageIndex = Math.max(Number(cached.pagination?.pageIndex) || 0, 0);
    const pageSize = [5, 10, 20, 50, 100].includes(Number(cached.pagination?.pageSize))
      ? Number(cached.pagination.pageSize)
      : DEFAULT_PAGINATION.pageSize;

    return {
      query: typeof cached.query === 'string' ? cached.query : '',
      globalFilter: typeof cached.globalFilter === 'string' ? cached.globalFilter : '',
      sorting: Array.isArray(cached.sorting) ? cached.sorting.slice(0, 1) : [],
      pagination: {
        pageIndex,
        pageSize,
      },
    };
  } catch {
    return {
      query: '',
      globalFilter: '',
      sorting: [],
      pagination: DEFAULT_PAGINATION,
    };
  }
}

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? number.toLocaleString('ko-KR') : '-';
}

function getStatusClass(value) {
  if (value === 'ON' || value === '결제승인' || value === '동의') return 'active';
  if (value === 'OFF' || value === '결제대기' || value === '미동의') return 'waiting';
  if (value === '부분취소' || value === '위약금') return 'partial';
  if (String(value || '').includes('취소')) return 'danger';
  return '';
}

function getPaymentRowClass(paymentStatus) {
  if (paymentStatus === '결제승인') return 'payment_approved';
  if (paymentStatus === '매출취소') return 'payment_cancelled';
  if (paymentStatus === '위약금' || paymentStatus === '부분취소') return 'payment_partial';
  return '';
}

function TextCell({ value }) {
  return value || '-';
}

function MoneyCell({ value }) {
  return formatMoney(value);
}

function ChipCell({ value }) {
  const displayValue = value === '위약금' ? '부분취소' : value || '-';
  return (
    <span className={`ad_manage_chip ${getStatusClass(displayValue)}`}>
      {displayValue}
    </span>
  );
}

const adColumns = [
  columnHelper.accessor('manager', { header: '담당자', size: 96, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('department', { header: '부서', size: 80, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('companyName', { header: '상호명', size: 180, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('ceoName', { header: '대표자', size: 108, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('businessRegNumber', { header: '사업자번호', size: 150, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('tel', { header: '전화', size: 140, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('mobile', { header: '휴대폰', size: 150, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('smsContractStatus', { header: 'SMS계약서', size: 120, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('agreementStatus', { header: '동의상태', size: 110, cell: info => <ChipCell value={info.getValue()} /> }),
  columnHelper.accessor('agreementAt', { header: '동의일시', size: 130, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor(row => {
    if (!row.contractStartDate && !row.contractEndDate) return '';
    return `${row.contractStartDate || '-'} ~ ${row.contractEndDate || '-'}`;
  }, { id: 'contractDate', header: '계약일', size: 190, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('productName', { header: '상품', size: 180, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('approvedAmount', { header: '결제금액', size: 130, cell: info => <MoneyCell value={info.getValue()} /> }),
  columnHelper.accessor('vat', { header: 'VAT', size: 110, cell: info => <MoneyCell value={info.getValue()} /> }),
  columnHelper.accessor('spendingCost', { header: '소진비', size: 120, cell: info => <MoneyCell value={info.getValue()} /> }),
  columnHelper.accessor('netProfit', { header: '순이익', size: 120, cell: info => <MoneyCell value={info.getValue()} /> }),
  columnHelper.accessor('paymentMethod', { header: '결제구분', size: 110, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('cardCompany', { header: '카드', size: 120, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('paymentStatus', { header: '상태', size: 110, cell: info => <ChipCell value={info.getValue()} /> }),
  columnHelper.accessor('production1', { header: '제작사항1', size: 120, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('production2', { header: '제작사항2', size: 120, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('adProgress', { header: '광고진행', size: 110, cell: info => <ChipCell value={info.getValue()} /> }),
  columnHelper.accessor('advertiserAccount', { header: '광고주계정', size: 160, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('approvalNumber', { header: '승인번호', size: 140, cell: info => <TextCell value={info.getValue()} /> }),
  columnHelper.accessor('createdAt', { header: '작성일', size: 130, cell: info => <TextCell value={info.getValue()} /> }),
];

function AdManagement({ user }) {
  const navigate = useNavigate();
  const [initialListState] = useState(() => readAdManagementState(user?.id));
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState(initialListState.query);
  const [globalFilter, setGlobalFilter] = useState(initialListState.globalFilter);
  const [sorting, setSorting] = useState(initialListState.sorting);
  const [pagination, setPagination] = useState(initialListState.pagination);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      sessionStorage.setItem(
        getAdManagementStateKey(user?.id),
        JSON.stringify({
          query,
          globalFilter,
          sorting,
          pagination,
        })
      );
    } catch (cacheError) {
      console.warn('Save ad management list state error:', cacheError);
    }
  }, [globalFilter, pagination, query, sorting, user?.id]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAds = async () => {
      setIsLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('access_token');
        const activeSort = sorting[0];
        const params = new URLSearchParams({
          page: String(pagination.pageIndex + 1),
          pageSize: String(pagination.pageSize),
        });

        if (globalFilter) params.set('search', globalFilter);
        if (activeSort) {
          params.set('sortBy', activeSort.id);
          params.set('sortOrder', activeSort.desc ? 'desc' : 'asc');
        }

        const res = await fetch(`/api/ads?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '광고 목록 조회에 실패했습니다.');
        }

        setAds(Array.isArray(data.ads) ? data.ads : []);
        setTotalCount(Number(data.total) || 0);
        setPageCount(Math.max(Number(data.pageCount) || 1, 1));
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Fetch ads error:', err);
        setError(err.message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchAds();
    return () => controller.abort();
  }, [globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  const table = useReactTable({
    data: ads,
    columns: adColumns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: updater => {
      setSorting(updater);
      setPagination(prev => ({ ...prev, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    pageCount,
  });

  const handleSearchSubmit = e => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setGlobalFilter(query.trim());
  };

  const rangeStart = totalCount > 0
    ? pagination.pageIndex * pagination.pageSize + 1
    : 0;
  const rangeEnd = Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount);

  const openAdDetail = (event, adId) => {
    const detailPath = `/contracts/ad-management/${adId}`;
    const shouldOpenNewTab = event.ctrlKey || event.metaKey || event.button === 1;

    if (shouldOpenNewTab) {
      event.preventDefault();
      const detailWindow = window.open(detailPath, '_blank');
      if (detailWindow) detailWindow.opener = null;
      return;
    }

    navigate(detailPath);
  };

  return (
    <section className="ad_manage_block">
      <div className="ad_manage_panel">
        <form className="ad_manage_toolbar" onSubmit={handleSearchSubmit}>
          <label>
            <span>통합검색</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="상호명, 담당자, 상품, 승인번호 검색"
            />
          </label>
          <button type="submit" className="ad_manage_search_button">
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            <span>검색</span>
          </button>
          <button
            type="button"
            className="ad_manage_add_button"
            onClick={() => navigate('/contracts/ad-detail')}
          >
            <FontAwesomeIcon icon={faSquarePlus} aria-hidden="true" />
            <span>추가</span>
          </button>
        </form>

        {error && <Alert variant="danger" className="ad_manage_alert">{error}</Alert>}

        {isLoading ? (
          <div className="ad_manage_state">
            <Spinner animation="border" size="sm" />
            <span>광고 목록을 불러오는 중입니다.</span>
          </div>
        ) : (
          <>
            <div className="ad_manage_table_wrap">
              <Table className="ad_manage_table" responsive={false}>
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          onClick={header.column.getToggleSortingHandler()}
                          className={header.column.getCanSort() ? 'sortable' : ''}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <span className="ad_manage_sort">▲</span>}
                          {header.column.getIsSorted() === 'desc' && <span className="ad_manage_sort">▼</span>}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={adColumns.length} className="ad_manage_empty">
                        등록된 광고가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        className={`ad_manage_clickable_row ${getPaymentRowClass(row.original.paymentStatus)}`.trim()}
                        tabIndex={0}
                        onClick={event => openAdDetail(event, row.original.id)}
                        onAuxClick={event => {
                          if (event.button === 1) {
                            openAdDetail(event, row.original.id);
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            openAdDetail(e, row.original.id);
                          }
                        }}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} style={{ width: cell.column.getSize() }} title={String(cell.getValue() || '')}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
            <div className="ad_manage_footer">
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => setPagination({
                  pageIndex: 0,
                  pageSize: Number(e.target.value),
                })}
                aria-label="페이지 크기"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <TablePagination
                pageIndex={table.getState().pagination.pageIndex}
                pageCount={table.getPageCount()}
                onPageChange={page => table.setPageIndex(page)}
                className="ad_manage_pages"
              />
              <div className="ad_manage_count">
                <span>{rangeStart}-{rangeEnd}</span>
                <span>
                  <FontAwesomeIcon icon={faCoins} aria-hidden="true" />
                  {totalCount.toLocaleString('ko-KR')}건
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default AdManagement;
