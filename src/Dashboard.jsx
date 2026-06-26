import { useEffect, useMemo, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCoins,
  faMagnifyingGlass,
  faSquareCheck,
} from '@fortawesome/free-solid-svg-icons';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import TablePagination from './components/TablePagination';
import './styles/dashboard.css';
import './styles/date_select_picker.css';

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
  { id: 9, title: '추후 연동 예정', author: '-', date: '-' },
];

const months = ['01월', '02월', '03월', '04월', '05월', '06월', '07월', '08월', '09월', '10월', '11월', '12월'];
const salesSeriesColors = ['#1962fc', '#ff3b5c', '#20b26b'];

function getKoreanCurrentYear() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date()));
}

function getSalesSeriesColor(year, currentYear = getKoreanCurrentYear()) {
  const yearOffset = Math.max(0, Math.min(currentYear - Number(year), salesSeriesColors.length - 1));
  return salesSeriesColors[yearOffset];
}

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

const sales_excluded_status_markers = ['\uCDE8\uC18C', '\uB300\uAE30'];

function isCompletedSalesStatus(status) {
  const text = String(status || '').trim();
  return text.length > 0 && !sales_excluded_status_markers.some(marker => text.includes(marker));
}

function getYearMonth(value) {
  const text = String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})/);

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
    }).format(date)),
    month: Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
    }).format(date)),
  };
}

function getKoreanDateParts(value = new Date()) {
  const text = String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      date: `${match[1]}-${match[2]}-${match[3]}`,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    date: `${values.year}-${String(values.month).padStart(2, '0')}-${String(values.day).padStart(2, '0')}`,
  };
}

function parseDateInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

const dashboardDateYears = Array.from({ length: 101 }, (_, index) => 2000 + index);

function renderDashboardDateHeader({ date, changeYear, changeMonth }) {
  return (
    <div className="date_select_header">
      <select
        value={date.getFullYear()}
        onChange={event => changeYear(Number(event.target.value))}
        aria-label="조회 연도"
      >
        {dashboardDateYears.map(year => (
          <option value={year} key={year}>{year}년</option>
        ))}
      </select>
      <select
        value={date.getMonth()}
        onChange={event => changeMonth(Number(event.target.value))}
        aria-label="조회 월"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <option value={index} key={index}>{String(index + 1).padStart(2, '0')}월</option>
        ))}
      </select>
    </div>
  );
}

function createEmptySalesYears(currentYear) {
  return Array.from({ length: 3 }, (_, index) => {
    const year = currentYear - index;
    const monthsData = Array.from({ length: 12 }, (_, monthIndex) => ({
      month: monthIndex + 1,
      total: 0,
      count: 0,
    }));

    return {
      year,
      total: 0,
      count: 0,
      months: monthsData,
    };
  });
}

function buildSalesSummaryFromAds(ads) {
  const currentYear = getKoreanCurrentYear();
  const years = createEmptySalesYears(currentYear);
  const yearMap = new Map(years.map(item => [item.year, item]));

  ads.forEach(ad => {
    if (!isCompletedSalesStatus(ad.paymentStatus)) return;

    const date = getYearMonth(ad.createdAt || ad.contractStartDate);
    if (!date || !yearMap.has(date.year) || date.month < 1 || date.month > 12) return;

    const yearBucket = yearMap.get(date.year);
    const monthBucket = yearBucket.months[date.month - 1];
    const amount = Number(ad.approvedAmount) || 0;

    monthBucket.total += amount;
    monthBucket.count += 1;
    yearBucket.total += amount;
    yearBucket.count += 1;
  });

  return {
    currentYear,
    startYear: currentYear - 2,
    excludedStatuses: ['취소', '대기'],
    years,
  };
}

function buildTopSalesSummaryFromAds(ads) {
  const currentDate = getKoreanDateParts();
  const todayMap = new Map();
  const monthMap = new Map();
  const addToManager = (targetMap, ad) => {
    const manager = String(ad.manager || '미지정').trim() || '미지정';
    const existing = targetMap.get(manager) || { manager, total: 0, count: 0 };
    existing.total += Number(ad.approvedAmount) || 0;
    existing.count += 1;
    targetMap.set(manager, existing);
  };
  const toTopTen = targetMap => [...targetMap.values()]
    .sort((a, b) => b.total - a.total || b.count - a.count || a.manager.localeCompare(b.manager, 'ko'))
    .slice(0, 10);

  ads.forEach(ad => {
    if (!isCompletedSalesStatus(ad.paymentStatus)) return;

    const date = getKoreanDateParts(ad.createdAt || ad.contractStartDate);
    if (!date || date.year !== currentDate.year || date.month !== currentDate.month) return;

    addToManager(monthMap, ad);
    if (date.date === currentDate.date) addToManager(todayMap, ad);
  });

  return {
    currentDate: currentDate.date,
    today: toTopTen(todayMap),
    month: toTopTen(monthMap),
  };
}

function getMaxValue(values) {
  return Math.max(...values.map(value => Number(value) || 0), 1);
}

function getNiceScaleMax(values) {
  const maxValue = getMaxValue(values);
  if (!values.some(value => Number(value) > 0)) return 1000000;

  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const increment = magnitude / 2;

  return Math.ceil(maxValue / increment) * increment;
}

function MiniLineChart({ series, yearOptions, selectedYears, onYearToggle }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const maxValue = getMaxValue(series.flatMap(item => item.values));
  const width = 910;
  const height = 186;
  const left = 44;
  const right = 44;
  const top = 16;
  const bottom = 2;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const getPoint = (value, index) => {
    const x = left + (chartWidth / 11) * index;
    const y = top + chartHeight - ((Number(value) || 0) / maxValue) * chartHeight;
    return { x, y };
  };
  const pointsToString = values => values
    .map((value, index) => {
      const point = getPoint(value, index);
      return `${point.x},${point.y}`;
    })
    .join(' ');
  const tooltipPoint = hoveredPoint
    ? getPoint(hoveredPoint.value, hoveredPoint.monthIndex)
    : null;
  const tooltipWidth = 170;
  const tooltipHeight = 48;
  const tooltipX = tooltipPoint
    ? Math.min(Math.max(tooltipPoint.x - tooltipWidth / 2, 4), width - tooltipWidth - 4)
    : 0;
  const tooltipY = tooltipPoint
    ? Math.max(tooltipPoint.y - tooltipHeight - 12, 4)
    : 0;

  return (
    <div className="dash_line_chart">
      <div className="dash_chart_legend" aria-label="매출 연도 선택">
        {yearOptions.map(item => {
          const isActive = selectedYears.includes(Number(item.year));
          const color = getSalesSeriesColor(item.year);

          return (
            <button
              type="button"
              key={item.year}
              className={isActive ? 'active' : ''}
              aria-pressed={isActive}
              style={{ '--series-color': color }}
              onClick={() => onYearToggle(item.year)}
            >
              <i aria-hidden="true" />
              {item.year}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="연도별 매출 차트">
        <defs>
          {series.map(item => (
            <linearGradient key={item.year} id={`salesAreaGradient-${item.year}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {[0, 1, 2, 3, 4].map(index => (
          <line
            key={index}
            x1="0"
            x2={width}
            y1={(height - bottom) / 4 * index}
            y2={(height - bottom) / 4 * index}
            className={index === 4 ? 'dash_axis_line' : 'dash_grid_line'}
          />
        ))}
        {[...series].reverse().map(item => {
          const areaPoints = `${left},${top + chartHeight} ${pointsToString(item.values)} ${left + chartWidth},${top + chartHeight}`;

          return (
            <g key={`series-${item.year}`}>
              <polygon points={areaPoints} fill={`url(#salesAreaGradient-${item.year})`} />
              <polyline
                points={pointsToString(item.values)}
                className="dash_sales_line"
                style={{ stroke: item.color }}
              />
              {item.values.map((value, monthIndex) => {
                const point = getPoint(value, monthIndex);
                const hoverValue = {
                  year: item.year,
                  monthIndex,
                  value,
                  color: item.color,
                };

                return (
                  <g
                    key={`${item.year}_${monthIndex}`}
                    className="dash_line_point_group"
                    aria-label={`${item.year}년 ${months[monthIndex]} 총 매출 ${formatCurrency(value)}`}
                    onPointerEnter={() => setHoveredPoint(hoverValue)}
                    onPointerLeave={() => setHoveredPoint(null)}
                    onFocus={() => setHoveredPoint(hoverValue)}
                    onBlur={() => setHoveredPoint(null)}
                    tabIndex={0}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="4.5"
                      className="dash_line_point"
                      style={{ fill: item.color }}
                    />
                    <circle cx={point.x} cy={point.y} r="20" className="dash_line_hit" />
                  </g>
                );
              })}
            </g>
          );
        })}
        {tooltipPoint && hoveredPoint && (
          <g className="dash_chart_tooltip">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="8" />
            <text x={tooltipX + 12} y={tooltipY + 19}>{`${hoveredPoint.year}년 ${months[hoveredPoint.monthIndex]}`}</text>
            <text x={tooltipX + 12} y={tooltipY + 38} style={{ fill: hoveredPoint.color }}>
              {formatCurrency(hoveredPoint.value)}
            </text>
          </g>
        )}
      </svg>
      <div className="dash_month_axis">
        {months.map(month => <span key={month}>{month}</span>)}
      </div>
    </div>
  );
}

function TopBarChart({ title, values, color }) {
  const scaleMax = getNiceScaleMax(values.map(item => item.total));
  const colorValue = color === 'blue' ? '#1962fc' : '#ff2174';
  const scaleValues = [1, 0.75, 0.5, 0.25, 0];

  return (
    <section className="dash_bar_section">
      <h2 className="dash_section_title">{title}</h2>
      <div className="dash_panel dash_bar_panel">
        <div className="dash_bar_chart">
          <div className="dash_bar_scale">
            {scaleValues.map(scale => (
              <span key={scale}>{formatNumber(scaleMax * scale)}</span>
            ))}
          </div>
          <div className="dash_bar_plot">
            {scaleValues.map(scale => <span key={scale} className="dash_bar_grid" />)}
            <div className="dash_bar_items">
              {values.length > 0 ? values.map((item, index) => {
                const height = Math.max((Number(item.total) / scaleMax) * 178, 4);

                return (
                  <button
                    type="button"
                    className="dash_bar_item"
                    key={`${item.manager}_${index}`}
                    aria-label={`${item.manager} 총 매출 ${formatCurrency(item.total)}, ${item.count}건`}
                  >
                    <span className="dash_bar_track">
                      <span
                        className={`dash_bar ${color === 'blue' ? 'blue' : 'pink'}`}
                        style={{ height: `${height}px` }}
                      >
                        <span className="dash_bar_tooltip" style={{ '--bar-color': colorValue }}>
                          <strong>{item.manager}</strong>
                          <span>{formatCurrency(item.total)}</span>
                        </span>
                      </span>
                    </span>
                    <span className="dash_bar_label" title={item.manager}>{item.manager}</span>
                  </button>
                );
              }) : (
                <div className="dash_empty_chart">표시할 매출 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [myMonthlySales, setMyMonthlySales] = useState({ totalSales: 0, count: 0 });
  const [myMonthlySalesError, setMyMonthlySalesError] = useState('');
  const [salesSummary, setSalesSummary] = useState(null);
  const [salesSummaryError, setSalesSummaryError] = useState('');
  const [isSalesSummaryLoading, setIsSalesSummaryLoading] = useState(true);
  const [selectedSalesYears, setSelectedSalesYears] = useState(() => [getKoreanCurrentYear()]);
  const [topSalesSummary, setTopSalesSummary] = useState({ today: [], month: [] });
  const [topSalesError, setTopSalesError] = useState('');
  const [isTopSalesLoading, setIsTopSalesLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [salesPageIndex, setSalesPageIndex] = useState(0);
  const [salesPageSize, setSalesPageSize] = useState(10);
  const [salesRows, setSalesRows] = useState([]);
  const [salesTotalCount, setSalesTotalCount] = useState(0);
  const [salesTablePageCount, setSalesTablePageCount] = useState(1);
  const [salesTotals, setSalesTotals] = useState({
    totalSales: 0,
    totalCancellations: 0,
  });
  const [salesTableError, setSalesTableError] = useState('');
  const [isSalesTableLoading, setIsSalesTableLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchMyMonthlySales = async () => {
      setMyMonthlySalesError('');

      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/dashboard/my-monthly-sales', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data.error || '개인 월 매출 정보를 불러오지 못했습니다.');
        }

        setMyMonthlySales({
          totalSales: Number(data.totalSales) || 0,
          count: Number(data.count) || 0,
        });
      } catch (err) {
        console.error('Fetch dashboard personal monthly sales error:', err);
        setMyMonthlySalesError(err.message);
      }
    };

    if (user?.id) {
      fetchMyMonthlySales();
    }
  }, [user.id]);

  useEffect(() => {
    const fetchTopSales = async () => {
      setIsTopSalesLoading(true);
      setTopSalesError('');
      const token = localStorage.getItem('access_token');

      try {
        const res = await fetch('/api/dashboard/top-sales', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data.error || '실적 Top 10 정보를 불러오지 못했습니다.');
        }

        setTopSalesSummary(data);
      } catch (error) {
        console.error('Fetch dashboard top sales error:', error);
        try {
          const fallbackRes = await fetch('/api/ads', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const fallbackData = await parseResponse(fallbackRes);

          if (!fallbackRes.ok) {
            throw new Error(fallbackData.error || '실적 Top 10 정보를 불러오지 못했습니다.');
          }

          setTopSalesSummary(buildTopSalesSummaryFromAds(Array.isArray(fallbackData.ads) ? fallbackData.ads : []));
        } catch (fallbackError) {
          console.error('Fetch dashboard top sales fallback error:', fallbackError);
          setTopSalesError('실적 Top 10 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsTopSalesLoading(false);
      }
    };

    if (user?.id) {
      fetchTopSales();
    }
  }, [user.id]);

  useEffect(() => {
    const fetchSalesSummary = async () => {
      setIsSalesSummaryLoading(true);
      setSalesSummaryError('');
      const token = localStorage.getItem('access_token');

      try {
        const res = await fetch('/api/dashboard/monthly-sales', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data.error || '월별 매출 정보를 불러오지 못했습니다.');
        }

        setSalesSummary(data);
        setSelectedSalesYears([Number(data?.currentYear) || getKoreanCurrentYear()]);
      } catch (err) {
        console.error('Fetch dashboard monthly sales error:', err);
        try {
          const fallbackRes = await fetch('/api/ads', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const fallbackData = await parseResponse(fallbackRes);

          if (!fallbackRes.ok) {
            throw new Error(fallbackData.error || '월별 매출 정보를 불러오지 못했습니다.');
          }

          const fallbackSummary = buildSalesSummaryFromAds(Array.isArray(fallbackData.ads) ? fallbackData.ads : []);
          setSalesSummary(fallbackSummary);
          setSelectedSalesYears([fallbackSummary.currentYear]);
        } catch (fallbackError) {
          console.error('Fetch dashboard monthly sales fallback error:', fallbackError);
          setSalesSummaryError('월별 매출 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsSalesSummaryLoading(false);
      }
    };

    if (user?.id) {
      fetchSalesSummary();
    }
  }, [user.id]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSalesTable = async () => {
      setIsSalesTableLoading(true);
      setSalesTableError('');

      try {
        const token = localStorage.getItem('access_token');
        const params = new URLSearchParams({
          page: String(salesPageIndex + 1),
          pageSize: String(salesPageSize),
          range: selectedDateRange || 'custom',
        });

        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (salesSearch) params.set('search', salesSearch);

        const res = await fetch(`/api/dashboard/sales?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data.error || '매출현황 데이터를 불러오지 못했습니다.');
        }

        setSalesRows(Array.isArray(data.rows) ? data.rows : []);
        setSalesTotalCount(Number(data.total) || 0);
        setSalesTablePageCount(Math.max(Number(data.pageCount) || 1, 1));
        setSalesTotals({
          totalSales: Number(data.totalSales) || 0,
          totalCancellations: Number(data.totalCancellations) || 0,
        });
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Fetch dashboard sales table error:', error);
        setSalesRows([]);
        setSalesTableError(error.message);
      } finally {
        if (!controller.signal.aborted) {
          setIsSalesTableLoading(false);
        }
      }
    };

    if (user?.id) {
      fetchSalesTable();
    }

    return () => controller.abort();
  }, [
    dateFrom,
    dateTo,
    salesPageIndex,
    salesPageSize,
    salesSearch,
    selectedDateRange,
    user?.id,
  ]);

  const userTeam = user.team || '미지정';
  const isDevelopmentManagementTeam = userTeam === '개발관리부';

  const salesYearOptions = useMemo(() => salesSummary?.years || [], [salesSummary?.years]);
  const selectedSalesSeries = useMemo(() => {
    return salesYearOptions
      .map(item => {
        const monthMap = new Map((item.months || []).map(month => [Number(month.month), Number(month.total) || 0]));

        return {
          year: Number(item.year),
          color: getSalesSeriesColor(item.year, salesSummary?.currentYear),
          values: Array.from({ length: 12 }, (_, monthIndex) => monthMap.get(monthIndex + 1) || 0),
        };
      })
      .filter(item => selectedSalesYears.includes(item.year));
  }, [salesSummary?.currentYear, salesYearOptions, selectedSalesYears]);
  const toggleSalesYear = year => {
    const numericYear = Number(year);
    setSelectedSalesYears(current =>
      current.includes(numericYear)
        ? current.filter(item => item !== numericYear)
        : [...current, numericYear]
    );
  };

  const salesRangeStart = salesTotalCount ? salesPageIndex * salesPageSize + 1 : 0;
  const salesRangeEnd = Math.min((salesPageIndex + 1) * salesPageSize, salesTotalCount);

  const openSalesDetail = (event, paymentId) => {
    const detailPath = `/contracts/ad-management/${paymentId}`;
    const shouldOpenNewTab = event.ctrlKey || event.metaKey || event.button === 1;

    if (shouldOpenNewTab) {
      event.preventDefault();
      const detailWindow = window.open(detailPath, '_blank');
      if (detailWindow) detailWindow.opener = null;
      return;
    }

    navigate(detailPath);
  };

  useEffect(() => {
    setSalesPageIndex(0);
  }, [dateFrom, dateTo, salesPageSize, salesSearch, selectedDateRange]);

  useEffect(() => {
    if (salesPageIndex >= salesTablePageCount) {
      setSalesPageIndex(salesTablePageCount - 1);
    }
  }, [salesPageIndex, salesTablePageCount]);

  const formattedDate = currentTime.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const formattedTime = currentTime.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
  const currentSalesYear = salesSummary?.currentYear || getKoreanCurrentYear();
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
                    <dd>{formatNumber(myMonthlySales.totalSales)}</dd>
                  </div>
                  <div>
                    <dt>건수</dt>
                    <dd>{myMonthlySales.count}</dd>
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
            <h1>{currentSalesYear}년도 매출정보</h1>
          </div>
          <section className="dash_card dash_year_card">
            {isSalesSummaryLoading ? (
              <div className="dash_center_state"><Spinner animation="border" size="sm" /> 매출 데이터를 불러오는 중...</div>
            ) : salesSummaryError ? (
              <div className="dash_center_state">{salesSummaryError}</div>
            ) : (
              <MiniLineChart
                series={selectedSalesSeries}
                yearOptions={salesYearOptions}
                selectedYears={selectedSalesYears}
                onYearToggle={toggleSalesYear}
              />
            )}
          </section>
        </div>
      </div>

      {myMonthlySalesError && (
        <Alert variant="warning" className="dash_payroll_error">{myMonthlySalesError}</Alert>
      )}

      <div className="dashboard_middle_grid">
        <div className="dashboard_chart_stack">
          {topSalesError && <Alert variant="warning" className="dash_top_sales_error">{topSalesError}</Alert>}
          {isTopSalesLoading ? (
            <div className="dash_panel dash_bar_loading">
              <Spinner animation="border" size="sm" /> 실적 데이터를 불러오는 중...
            </div>
          ) : (
            <>
              <TopBarChart title="오늘 실적 Top 10" values={topSalesSummary.today || []} color="pink" />
              <TopBarChart title="이번 달 실적 Top 10" values={topSalesSummary.month || []} color="blue" />
            </>
          )}
        </div>

        <aside className="dashboard_side_stack">
          <section className="dash_notice_section">
            <h2 className="dash_section_title">공지사항</h2>
            <div className="dash_panel dash_notice_panel">
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
            </div>
          </section>

          <section className="dash_calendar_section">
            <h2 className="dash_section_title">일정</h2>
            <div className="dash_panel dash_calendar_panel">
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
            </div>
          </section>
        </aside>
      </div>

      <section className="dash_sales_section">
        <h2 className="dash_section_title">매출현황</h2>
        <div className="dash_sales_card">
          <div className="dash_filter_grid">
            <div className="dash_filter_left">
              <label>
                등록일
                <div className="dash_date_range">
                  <DatePicker
                    selected={parseDateInput(dateFrom)}
                    onChange={date => {
                      setDateFrom(date ? getKoreanDateParts(date).date : '');
                      setSelectedDateRange('custom');
                    }}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    minDate={new Date(2000, 0, 1)}
                    maxDate={new Date(2100, 11, 31)}
                    placeholderText="시작일"
                    className="dash_date_input"
                    wrapperClassName="dash_date_picker"
                    popperClassName="date_select_calendar dash_date_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderDashboardDateHeader}
                  />
                  <span>~</span>
                  <DatePicker
                    selected={parseDateInput(dateTo)}
                    onChange={date => {
                      setDateTo(date ? getKoreanDateParts(date).date : '');
                      setSelectedDateRange('custom');
                    }}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    minDate={parseDateInput(dateFrom) || new Date(2000, 0, 1)}
                    maxDate={new Date(2100, 11, 31)}
                    placeholderText="종료일"
                    className="dash_date_input"
                    wrapperClassName="dash_date_picker"
                    popperClassName="date_select_calendar dash_date_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderDashboardDateHeader}
                  />
                </div>
              </label>
              <div className="dash_range_buttons">
                <button type="button" className={selectedDateRange === 'today' ? 'active' : ''} onClick={() => {
                  const today = getKoreanDateParts().date;
                  setDateFrom(today);
                  setDateTo(today);
                  setSelectedDateRange('today');
                }}>오늘</button>
                <button type="button" className={selectedDateRange === 'week' ? 'active' : ''} onClick={() => {
                  const now = new Date();
                  const weekAgo = new Date(now);
                  weekAgo.setDate(now.getDate() - 6);
                  setDateFrom(getKoreanDateParts(weekAgo).date);
                  setDateTo(getKoreanDateParts(now).date);
                  setSelectedDateRange('week');
                }}>1주</button>
                <button type="button" className={selectedDateRange === 'month' ? 'active' : ''} onClick={() => {
                  const now = new Date();
                  const monthAgo = new Date(now);
                  monthAgo.setMonth(now.getMonth() - 1);
                  setDateFrom(getKoreanDateParts(monthAgo).date);
                  setDateTo(getKoreanDateParts(now).date);
                  setSelectedDateRange('month');
                }}>한달</button>
                <button type="button" className={selectedDateRange === 'all' ? 'active' : ''} onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSelectedDateRange('all');
                }}>전체</button>
              </div>
            </div>
            <label className="dash_search_filter">
              통합검색
              <div className="dash_search_box">
                <input
                  type="search"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setSalesPageIndex(0);
                      setSalesSearch(searchText.trim());
                    }
                  }}
                  placeholder="상품명, 담당자, 팀 검색"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSalesPageIndex(0);
                    setSalesSearch(searchText.trim());
                  }}
                >
                  <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
                  검색
                </button>
              </div>
            </label>
          </div>

          <div className="dash_total_row">
            <div className="dash_total_sales">
              <span><FontAwesomeIcon icon={faSquareCheck} aria-hidden="true" />총 매출</span>
              <strong>{formatCurrency(salesTotals.totalSales)}</strong>
            </div>
            <div className="dash_total_cancel">
              <span><FontAwesomeIcon icon={faSquareCheck} aria-hidden="true" />총 취소매출</span>
              <strong>{formatCurrency(salesTotals.totalCancellations)}</strong>
            </div>
          </div>

          {salesTableError && (
            <Alert variant="danger" className="dash_sales_table_alert">
              {salesTableError}
            </Alert>
          )}

          <div className="dash_table_wrap">
            <table className="dash_sales_table">
              <colgroup>
                <col style={{ width: 50 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 140 }} />
              </colgroup>
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
                  <th>팀</th>
                  <th>담당자</th>
                  <th>계약기간</th>
                </tr>
              </thead>
              <tbody>
                {isSalesTableLoading ? (
                  <tr>
                    <td colSpan="12" className="dash_table_empty">
                      <Spinner animation="border" size="sm" /> 매출현황을 불러오는 중입니다.
                    </td>
                  </tr>
                ) : salesRows.length > 0 ? salesRows.map(row => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={event => openSalesDetail(event, row.id)}
                    onAuxClick={event => {
                      if (event.button === 1) {
                        openSalesDetail(event, row.id);
                      }
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        openSalesDetail(event, row.id);
                      }
                    }}
                    className={
                      `dash_sales_clickable ${
                        row.paymentStatus === '위약금' || row.paymentStatus === '부분취소'
                          ? 'status_partial'
                          : row.paymentStatus.includes('취소')
                            ? 'status_cancel'
                            : row.paymentStatus === '결제승인'
                              ? 'status_approved'
                              : ''
                      }`.trim()
                    }
                  >
                    <td>{row.sequence}</td>
                    <td>{row.registrationDate}</td>
                    <td>{row.product}</td>
                    <td>{row.companyName}</td>
                    <td>{row.ceoName}</td>
                    <td>{row.approvedCompany}</td>
                    <td>{row.paymentMethod}</td>
                    <td>{formatNumber(row.approvedAmount)}</td>
                    <td>{row.paymentStatus}</td>
                    <td>{row.team}</td>
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
            <select
              value={salesPageSize}
              onChange={event => setSalesPageSize(Number(event.target.value))}
              aria-label="페이지당 표시 개수"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <TablePagination
              pageIndex={salesPageIndex}
              pageCount={salesTablePageCount}
              onPageChange={setSalesPageIndex}
              className="dash_pagination"
            />
            <span className="dash_table_count">
              <em>{salesRangeStart}-{salesRangeEnd}</em>
              <strong><FontAwesomeIcon icon={faCoins} aria-hidden="true" />{salesTotalCount}건</strong>
            </span>
          </div>
        </div>
      </section>
    </section>
  );
}

export default Dashboard;
