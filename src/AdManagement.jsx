import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Alert, Spinner, Table } from 'react-bootstrap';
import TablePagination from './components/TablePagination';
import './styles/ad_management.css';

const columnHelper = createColumnHelper();

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
  columnHelper.accessor('department', { header: '부서', size: 120, cell: info => <TextCell value={info.getValue()} /> }),
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

function AdManagement() {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <section className="ad_manage_block">
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
        <button type="submit" className="ad_manage_search_button">검색</button>
        <button
          type="button"
          className="ad_manage_add_button"
          onClick={() => navigate('/contracts/ad-detail')}
        >
          추가
        </button>
      </form>

      {error && <Alert variant="danger" className="ad_manage_alert">{error}</Alert>}

      <div className="ad_manage_panel">
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
                        onClick={() => navigate(`/contracts/ad-management/${row.original.id}`)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            navigate(`/contracts/ad-management/${row.original.id}`);
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
              <span>{totalCount.toLocaleString('ko-KR')}건</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default AdManagement;
