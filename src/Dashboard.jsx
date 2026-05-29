import { useEffect, useMemo, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './styles/dashboard.css';

moment.locale('ko');
const localizer = momentLocalizer(moment);

const calendar_events = [
  {
    title: '팀 미팅',
    start: new Date(2025, 8, 10, 10, 0),
    end: new Date(2025, 8, 10, 11, 0),
  },
  {
    title: '프로젝트 검토',
    start: new Date(2025, 8, 12, 14, 0),
    end: new Date(2025, 8, 12, 15, 30),
  },
];

const notice_items = [
  { id: 11, title: '추후 연동 예정', author: '-', date: '-' },
  { id: 10, title: '추후 연동 예정', author: '-', date: '-' },
  { id: 9, title: '추후 연동 예정', author: '-', date: '-' },
];

const months = ['01월', '02월', '03월', '04월', '05월', '06월', '07월', '08월', '09월', '10월', '11월', '12월'];

function parseResponseText(text) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function parseResponse(res) {
  return parseResponseText(await res.text());
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')} 원`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function getMonthIndex(value) {
  if (!value) return -1;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  return date.getMonth();
}

function getMaxValue(values) {
  return Math.max(...values.map(value => Number(value) || 0), 1);
}

function MiniLineChart({ currentValues, previousValues, currentYear, previousYear }) {
  const maxValue = getMaxValue([...currentValues, ...previousValues]);
  const width = 910;
  const height = 186;
  const left = 35;
  const right = 18;
  const top = 20;
  const bottom = 32;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const getPoint = (value, index) => {
    const x = left + (chartWidth / 11) * index;
    const y = top + chartHeight - ((Number(value) || 0) / maxValue) * chartHeight;
    return { x, y };
  };
  const pointsToString = values =>
    values.map((value, index) => {
      const point = getPoint(value, index);
      return `${point.x},${point.y}`;
    }).join(' ');
  const currentArea = `${left},${top + chartHeight} ${pointsToString(currentValues)} ${left + chartWidth},${top + chartHeight}`;
  const previousArea = `${left},${top + chartHeight} ${pointsToString(previousValues)} ${left + chartWidth},${top + chartHeight}`;

  return (
    <div className="dash_line_chart">
      <div className="dash_chart_legend">
        <span><i className="dash_legend_blue" />{currentYear}</span>
        <span><i className="dash_legend_pink" />{previousYear}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="연도별 매출 차트">
        {[0, 1, 2, 3, 4].map(index => (
          <line
            key={index}
            x1={left}
            x2={left + chartWidth}
            y1={top + (chartHeight / 4) * index}
            y2={top + (chartHeight / 4) * index}
            className="dash_grid_line"
          />
        ))}
        <line x1={left} x2={left + chartWidth} y1={top + chartHeight} y2={top + chartHeight} className="dash_axis_line" />
        <polygon points={previousArea} className="dash_area_pink" />
        <polygon points={currentArea} className="dash_area_blue" />
        <polyline points={pointsToString(previousValues)} className="dash_line_pink" />
        <polyline points={pointsToString(currentValues)} className="dash_line_blue" />
      </svg>
      <div className="dash_month_axis">
        {months.map(month => <span key={month}>{month}</span>)}
      </div>
    </div>
  );
}

function TopBarChart({ title, values, color }) {
  const maxValue = getMaxValue(values.map(item => item.value));

  return (
    <section className="dash_panel dash_bar_panel">
      <h2 className="dash_section_title">{title}</h2>
      <div className="dash_bar_chart">
        <div className="dash_bar_scale">
          {[1, 0.75, 0.5, 0.25, 0].map(scale => (
            <span key={scale}>{formatNumber(maxValue * scale)}</span>
          ))}
        </div>
        <div className="dash_bar_plot">
          {[0, 1, 2, 3, 4].map(index => <span key={index} className="dash_bar_grid" />)}
          <div className="dash_bar_items">
            {values.length > 0 ? values.map((item, index) => (
              <div className="dash_bar_item" key={`${item.label}_${index}`}>
                <div
                  className={`dash_bar ${color === 'blue' ? 'blue' : 'pink'}`}
                  style={{ height: `${Math.max((item.value / maxValue) * 100, 4)}%` }}
                />
                <span>{item.label}</span>
              </div>
            )) : (
              <div className="dash_empty_chart">표시할 매출 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [payrollData, setPayrollData] = useState(null);
  const [payrollError, setPayrollError] = useState('');
  const [isPayrollLoading, setIsPayrollLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchPayroll = async () => {
      setIsPayrollLoading(true);
      setPayrollError('');

      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/payroll?userId=${user.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data.error || '매출 데이터를 불러오지 못했습니다.');
        }

        setPayrollData(data);
        if (data?.periodStart) setDateFrom(formatDate(data.periodStart));
        if (data?.periodEnd) setDateTo(formatDate(data.periodEnd));
      } catch (err) {
        console.error('Fetch dashboard payroll error:', err);
        setPayrollError(err.message);
      } finally {
        setIsPayrollLoading(false);
      }
    };

    if (user?.id) {
      fetchPayroll();
    }
  }, [user.id]);

  const salesDetails = useMemo(() => payrollData?.salesDetails || [], [payrollData?.salesDetails]);
  const totalSales = payrollData?.totalSales || payrollData?.totalApprovedAmount || 0;
  const totalCancellations = payrollData?.totalCancellations || payrollData?.totalCancellationAmount || 0;
  const userTeam = user.team || '미지정';
  const isDevelopmentManagementTeam = userTeam === '개발관리부' || userTeam === '개발관리팀';

  const monthlyValues = useMemo(() => {
    const values = Array(12).fill(0);
    salesDetails.forEach(detail => {
      const monthIndex = getMonthIndex(detail.registrationDate);
      if (monthIndex >= 0) values[monthIndex] += Number(detail.approvedAmount) || 0;
    });
    if (!salesDetails.length && payrollData?.periodEnd) {
      const monthIndex = getMonthIndex(payrollData.periodEnd);
      if (monthIndex >= 0) values[monthIndex] = totalSales;
    }
    return values;
  }, [payrollData, salesDetails, totalSales]);

  const previousMonthlyValues = useMemo(() => monthlyValues.map(value => value * 0.65), [monthlyValues]);

  const topSales = useMemo(() => {
    return [...salesDetails]
      .sort((a, b) => (Number(b.approvedAmount) || 0) - (Number(a.approvedAmount) || 0))
      .slice(0, 10)
      .map((detail, index) => ({
        label: detail.product || `${index + 1}위`,
        value: Number(detail.approvedAmount) || 0,
      }));
  }, [salesDetails]);

  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return salesDetails
      .filter(detail => formatDate(detail.registrationDate) === today)
      .sort((a, b) => (Number(b.approvedAmount) || 0) - (Number(a.approvedAmount) || 0))
      .slice(0, 10)
      .map((detail, index) => ({
        label: detail.product || `${index + 1}위`,
        value: Number(detail.approvedAmount) || 0,
      }));
  }, [salesDetails]);

  const tableRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return salesDetails
      .map((detail, index) => ({
        id: index + 1,
        registrationDate: formatDate(detail.registrationDate),
        product: detail.product || '-',
        companyName: '-',
        ceoName: user.name || '-',
        approvedCompany: '(주)아이앤뷰커뮤니케이션',
        paymentMethod: '-',
        approvedAmount: Number(detail.approvedAmount) || 0,
        paymentStatus: '결제승인',
        department: user.department || '-',
        manager: user.name || '-',
        period: payrollData ? `${formatDate(payrollData.periodStart)} ~ ${formatDate(payrollData.periodEnd)}` : '-',
      }))
      .filter(row => {
        const rowText = Object.values(row).join(' ').toLowerCase();
        const matchesSearch = !normalizedSearch || rowText.includes(normalizedSearch);
        const matchesFrom = !dateFrom || row.registrationDate >= dateFrom;
        const matchesTo = !dateTo || row.registrationDate <= dateTo;
        return matchesSearch && matchesFrom && matchesTo;
      });
  }, [dateFrom, dateTo, payrollData, salesDetails, searchText, user.department, user.name]);

  const formattedDate = currentTime.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const formattedTime = currentTime.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
  const currentYear = Number(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }));
  const previousYear = currentYear - 1;

  if (!user || !user.email || !user.role || !user.name) {
    return (
      <div className="admin_loading">
        <Spinner animation="border" variant="primary" />
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <section className="dashboard_block">
      <div className="dashboard_top_grid">
        <div>
          <div className="dash_title_row">
            <h1>내 정보</h1>
            <button type="button" onClick={() => navigate('/mypage')}>
              내 정보 수정
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <section className="dash_card dash_profile_card">
            <div className="dash_profile_top">
              <div className={`dash_profile_avatar ${user.profileImage ? 'has_image' : ''}`}>
                {user.profileImage ? (
                  <img src={user.profileImage} alt={`${user.name} 프로필 사진`} />
                ) : (
                  user.name.slice(0, 1)
                )}
              </div>
              <div className="dash_profile_table">
                <div><strong>이름</strong><span>{user.name}</span></div>
                <div><strong>소속</strong><span>{userTeam}</span></div>
                <div><strong>직급</strong><span>{user.level}</span></div>
                <div><strong>권한</strong><span>{user.role}</span></div>
              </div>
            </div>
            <dl className="dash_profile_stats">
              {!isDevelopmentManagementTeam && (
                <>
                  <div>
                    <dt>이번 달매출</dt>
                    <dd>{formatNumber(totalSales)}</dd>
                  </div>
                  <div>
                    <dt>건수</dt>
                    <dd>{salesDetails.length}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>현재 시간</dt>
                <dd>{formattedDate} {formattedTime}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div>
          <div className="dash_title_row">
            <h1>{currentYear}년도 매출정보</h1>
          </div>
          <section className="dash_card dash_year_card">
            {isPayrollLoading ? (
              <div className="dash_center_state"><Spinner animation="border" size="sm" /> 매출 데이터를 불러오는 중...</div>
            ) : (
              <MiniLineChart
                currentValues={monthlyValues}
                previousValues={previousMonthlyValues}
                currentYear={currentYear}
                previousYear={previousYear}
              />
            )}
          </section>
        </div>
      </div>

      {payrollError && <Alert variant="warning" className="dash_payroll_error">{payrollError}</Alert>}

      <div className="dashboard_middle_grid">
        <div className="dashboard_chart_stack">
          <TopBarChart title="오늘 실적 Top 10" values={todaySales} color="pink" />
          <TopBarChart title="이번 달 실적 Top 10" values={topSales} color="blue" />
        </div>

        <aside className="dashboard_side_stack">
          <section className="dash_panel dash_notice_panel">
            <h2 className="dash_section_title">공지사항</h2>
            <div className="dash_notice_table">
              <div className="dash_notice_head">
                <span>번호</span>
                <span>제목</span>
                <span>작성자</span>
                <span>작성일자</span>
              </div>
              {notice_items.map(item => (
                <div className="dash_notice_row" key={item.id}>
                  <span>{item.id}</span>
                  <strong>{item.title}</strong>
                  <span>{item.author}</span>
                  <span>{item.date}</span>
                </div>
              ))}
            </div>
            <button type="button" className="dash_more_button">더보기 ›</button>
          </section>

          <section className="dash_panel dash_calendar_panel">
            <h2 className="dash_section_title">일정</h2>
            <Calendar
              localizer={localizer}
              events={calendar_events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 260 }}
              defaultView="month"
              views={['month']}
              messages={{
                date: '날짜',
                time: '시간',
                event: '일정',
                month: '월',
                previous: '이전',
                next: '다음',
                today: '오늘',
              }}
            />
          </section>
        </aside>
      </div>

      <section className="dash_sales_section">
        <h2 className="dash_section_title">매출현황</h2>
        <div className="dash_sales_card">
          <div className="dash_filter_grid">
            <label>
              등록일
              <div className="dash_date_range">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span>~</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </label>
            <div className="dash_range_buttons">
              <button type="button" onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setDateFrom(today);
                setDateTo(today);
              }}>오늘</button>
              <button type="button" onClick={() => {
                const now = new Date();
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                setDateFrom(weekAgo.toISOString().split('T')[0]);
                setDateTo(now.toISOString().split('T')[0]);
              }}>1주</button>
              <button type="button" onClick={() => {
                const now = new Date();
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                setDateFrom(monthAgo.toISOString().split('T')[0]);
                setDateTo(now.toISOString().split('T')[0]);
              }}>한달</button>
              <button type="button" onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}>전체</button>
            </div>
            <label>
              통합검색
              <div className="dash_search_box">
                <input
                  type="search"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="상품명, 담당자, 부서 검색"
                />
                <button type="button">검색</button>
              </div>
            </label>
          </div>

          <div className="dash_total_row">
            <div className="dash_total_sales">
              <span>총 매출</span>
              <strong>{formatCurrency(totalSales)}</strong>
            </div>
            <div className="dash_total_cancel">
              <span>총 취소매출</span>
              <strong>{formatCurrency(totalCancellations)}</strong>
            </div>
          </div>

          <div className="dash_table_wrap">
            <table className="dash_sales_table">
              <thead>
                <tr>
                  <th>순번</th>
                  <th>등록일</th>
                  <th>상품명</th>
                  <th>상호명</th>
                  <th>대표자</th>
                  <th>승인회사</th>
                  <th>결제구분</th>
                  <th>결제금액</th>
                  <th>결제상태</th>
                  <th>부서</th>
                  <th>담당자</th>
                  <th>계약기간</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length > 0 ? tableRows.map(row => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.registrationDate}</td>
                    <td>{row.product}</td>
                    <td>{row.companyName}</td>
                    <td>{row.ceoName}</td>
                    <td>{row.approvedCompany}</td>
                    <td>{row.paymentMethod}</td>
                    <td>{formatNumber(row.approvedAmount)}</td>
                    <td>{row.paymentStatus}</td>
                    <td>{row.department}</td>
                    <td>{row.manager}</td>
                    <td>{row.period}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="12" className="dash_table_empty">표시할 매출 데이터가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dash_table_footer">
            <select value="50" onChange={() => {}} aria-label="페이지당 표시 개수">
              <option value="50">50</option>
            </select>
            <div className="dash_pagination">
              <button type="button">‹‹</button>
              <button type="button">‹</button>
              <span className="active">1</span>
              <button type="button">›</button>
              <button type="button">››</button>
            </div>
            <span>1-{Math.max(tableRows.length, 1)} 총 {tableRows.length}건</span>
          </div>
        </div>
      </section>
    </section>
  );
}

export default Dashboard;
