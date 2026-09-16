import { useEffect, useMemo, useState } from 'react';
import { Alert, Spinner, Table } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faDownload, faMagnifyingGlass, faRotateRight, faCaretUp, faCaretDown, faUsers } from '@fortawesome/free-solid-svg-icons';
import TablePagination from './components/TablePagination';
import { personalSalesCsv, selectPersonalSales } from './utils/personalSales';
import './styles/ad_management.css';
import './styles/personal_sales.css';

const columns = [
  ['name', '이름'], ['department', '부서'], ['team', '팀'],
  ['approvedAmount', '승인금액'], ['netProfit', '순이익'], ['count', '건수'],
];
const formatNumber = value => Number(value || 0).toLocaleString('ko-KR');
const scopeLabels = { all: '전체 조회', department: '부서 조회', team: '팀 조회', own: '본인 조회' };

function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
}

export default function PersonalSales({ user, mode = 'personal' }) {
  const isTeam = mode === 'team';
  const title = isTeam ? '팀별 매출 통계' : '개인별 매출 통계';
  const visibleColumns = isTeam ? columns.filter(([key]) => key !== 'name') : columns;
  const subject = isTeam ? '팀' : '직원';
  const unit = isTeam ? '팀' : '명';
  const [month, setMonth] = useState(currentMonth);
  const [department, setDepartment] = useState('');
  const [team, setTeam] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState({ sort: 'approvedAmount', direction: 'desc' });
  const [pageIndex, setPageIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    const load = async () => {
      try {
        const response = await fetch(`/api/${isTeam ? 'team-sales' : 'personal-sales'}?${new URLSearchParams({ month })}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '매출 통계를 불러오지 못했습니다.');
        if (!Array.isArray(result.rows)) throw new Error('매출 통계 응답을 확인할 수 없습니다.');
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [month, user?.id, refresh, isTeam]);

  const departments = useMemo(() => [...new Set((data?.rows || []).map(row => row.department).filter(Boolean))].sort(), [data]);
  const teams = useMemo(() => [...new Set((data?.rows || []).filter(row => !department || row.department === department).map(row => row.team).filter(Boolean))].sort(), [data, department]);
  const rows = useMemo(() => selectPersonalSales(data?.rows || [], { department, team, search, ...sorting }), [data, department, team, search, sorting]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    approvedAmount: sum.approvedAmount + row.approvedAmount,
    netProfit: sum.netProfit + row.netProfit,
    count: sum.count + row.count,
  }), { approvedAmount: 0, netProfit: 0, count: 0 }), [rows]);
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageRows = rows.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);
  const rangeStart = rows.length ? safePageIndex * pageSize + 1 : 0;
  const rangeEnd = Math.min((safePageIndex + 1) * pageSize, rows.length);
  const pending = loading || (!error && data?.month !== month);

  useEffect(() => { setPageIndex(0); }, [month, department, team, search, pageSize, sorting]);

  useEffect(() => {
    if (!isTeam) return undefined;
    const refreshAccess = () => setRefresh(value => value + 1);
    window.addEventListener('focus', refreshAccess);
    window.addEventListener('account-permissions:updated', refreshAccess);
    return () => {
      window.removeEventListener('focus', refreshAccess);
      window.removeEventListener('account-permissions:updated', refreshAccess);
    };
  }, [isTeam]);

  function changeMonth(value) {
    if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)) setMonth(value);
  }

  function shiftMonth(offset) {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, number - 1 + offset, 1));
    changeMonth(date.toISOString().slice(0, 7));
  }

  function sortBy(sort) {
    setSorting(previous => ({ sort, direction: previous.sort === sort && previous.direction === 'desc' ? 'asc' : 'desc' }));
  }

  function download() {
    const url = URL.createObjectURL(new Blob([personalSalesCsv(rows, visibleColumns)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isTeam ? '팀별' : '개인별'}_매출통계_${month}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="ad_manage_block personal_sales">
      <div className="ad_manage_panel">
      <header className="personal_sales_heading">
        <div><h1>{title}</h1><p>{month.replace('-', '년 ')}월</p></div>
        <span className="personal_sales_scope">{scopeLabels[data?.scope] || ''}</span>
      </header>

      <form className="personal_sales_filters" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setRefresh(value => value + 1); }}>
        <div className="personal_sales_filter">
          <label htmlFor="sales_month">조회 연월</label>
          <div className="personal_sales_month">
            <button type="button" title="이전 달" aria-label="이전 달" disabled={month === '1900-01'} onClick={() => shiftMonth(-1)}><FontAwesomeIcon icon={faChevronLeft} /></button>
            <input id="sales_month" type="month" min="1900-01" max="2199-12" value={month} onChange={event => changeMonth(event.target.value)} required />
            <button type="button" title="다음 달" aria-label="다음 달" disabled={month === '2199-12'} onClick={() => shiftMonth(1)}><FontAwesomeIcon icon={faChevronRight} /></button>
          </div>
        </div>
        <div className="personal_sales_filter"><label htmlFor="sales_department">부서</label><select id="sales_department" value={department} onChange={event => { setDepartment(event.target.value); setTeam(''); }}>
          <option value="">전체 부서</option>{department && !departments.includes(department) && <option>{department}</option>}{departments.map(value => <option key={value}>{value}</option>)}
        </select></div>
        <div className="personal_sales_filter"><label htmlFor="sales_team">팀</label><select id="sales_team" value={team} onChange={event => setTeam(event.target.value)}>
          <option value="">전체 팀</option>{team && !teams.includes(team) && <option>{team}</option>}{teams.map(value => <option key={value}>{value}</option>)}
        </select></div>
        <div className="personal_sales_filter personal_sales_search"><label htmlFor="sales_search">통합검색</label><input id="sales_search" type="search" placeholder={isTeam ? '부서, 팀' : '이름, 부서, 팀'} value={query} onChange={event => setQuery(event.target.value)} /></div>
        <button className="personal_sales_primary" type="submit"><FontAwesomeIcon icon={faMagnifyingGlass} /> 검색</button>
        <button type="button" title="검색 조건 초기화" aria-label="검색 조건 초기화" onClick={() => { setMonth(currentMonth()); setDepartment(''); setTeam(''); setQuery(''); setSearch(''); setPageSize(10); setSorting({ sort: 'approvedAmount', direction: 'desc' }); setRefresh(value => value + 1); }}><FontAwesomeIcon icon={faRotateRight} /></button>
      </form>

      <div className="personal_sales_summary" aria-live="polite">
        <div><span>{isTeam ? '조회 팀' : '조회 인원'}</span><strong>{pending || error ? '-' : formatNumber(rows.length)}<small>{unit}</small></strong></div>
        <div><span>승인금액 합계</span><strong>{pending || error ? '-' : formatNumber(totals.approvedAmount)}<small>원</small></strong></div>
        <div><span>순이익 합계</span><strong>{pending || error ? '-' : formatNumber(totals.netProfit)}<small>원</small></strong></div>
        <div><span>광고 건수</span><strong>{pending || error ? '-' : formatNumber(totals.count)}<small>건</small></strong></div>
      </div>

      <div className="personal_sales_results_heading">
        <h2>{subject}별 실적</h2>
        <button type="button" disabled={pending || Boolean(error) || !rows.length} onClick={download}><FontAwesomeIcon icon={faDownload} /> CSV 다운로드</button>
      </div>
      {error && <Alert variant="danger"><span>{error}</span> <button type="button" onClick={() => setRefresh(value => value + 1)}>다시 시도</button></Alert>}
      <div className="ad_manage_table_wrap personal_sales_table_wrap" aria-busy={pending}>
        <Table className="ad_manage_table personal_sales_table" responsive={false}>
          <caption className="visually-hidden">{month} {title}</caption>
          <thead><tr>{visibleColumns.map(([key, label]) => <th key={key} scope="col" className={['approvedAmount', 'netProfit'].includes(key) ? 'personal_sales_amount_heading' : ''} aria-sort={sorting.sort === key ? sorting.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>
            <button type="button" onClick={() => sortBy(key)}>{label}{sorting.sort === key && <FontAwesomeIcon className="ad_manage_sort" icon={sorting.direction === 'desc' ? faCaretDown : faCaretUp} />}</button>
          </th>)}</tr></thead>
          <tbody>{pending ? <tr><td colSpan={visibleColumns.length} className="personal_sales_state"><Spinner animation="border" size="sm" /> 매출 통계를 불러오는 중입니다.</td></tr>
            : error ? <tr><td colSpan={visibleColumns.length} className="personal_sales_state">매출 통계를 불러오지 못했습니다.</td></tr>
              : !pageRows.length ? <tr><td colSpan={visibleColumns.length} className="personal_sales_state">조회 조건에 해당하는 {subject}이 없습니다.</td></tr>
                : pageRows.map(row => <tr key={row.id}>
                  {!isTeam && <td className="personal_sales_name">{row.name || '-'}</td>}<td>{row.department || '-'}</td><td>{row.team || '-'}</td>
                  <td className="personal_sales_number">{formatNumber(row.approvedAmount)}</td><td className="personal_sales_number">{formatNumber(row.netProfit)}</td><td className="personal_sales_number">{formatNumber(row.count)}</td>
                </tr>)}</tbody>
        </Table>
      </div>
      {!pending && !error && <footer className="ad_manage_footer">
        <select aria-label="페이지 크기" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPageIndex(0); }}>
          {[5, 10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
        <TablePagination pageIndex={safePageIndex} pageCount={pageCount} onPageChange={setPageIndex} className="ad_manage_pages" />
        <div className="ad_manage_count"><span>{rangeStart}-{rangeEnd}</span><span><FontAwesomeIcon icon={faUsers} aria-hidden="true" />{formatNumber(rows.length)}{unit}</span></div>
      </footer>}
      </div>
    </section>
  );
}
