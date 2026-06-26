import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoins } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import TablePagination from './components/TablePagination';
import './styles/ad_management_detail.css';
import './styles/date_select_picker.css';

const PRODUCTS = [
  'G패키지',
  'N바이럴마케팅',
  'INVIEWCC패키지',
  'SNS 페이지 기자단',
  '홈페이지 제작',
  '모바일 홈페이지 제작',
  '언론뉴스 송출',
  '온라인 광고 교육 패키지',
  '온라인 광고 환불대행',
  '블로그 마케팅',
  '인플루언서 마케팅',
  'GDN 패키지',
  'NAVER 대대행',
];

const orderedProductIndexes = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9];
const PAYMENT_STATUSES = ['결제대기', '결제승인', '매출취소', '위약금'];
const TAX_INVOICE_OPTIONS = ['발행', '미발행'];
const PAYMENT_METHOD_OPTIONS = ['카드', '현금'];
const CARD_COMPANY_OPTIONS = [
  '롯데카드',
  '신한카드',
  'KB국민카드',
  '삼성카드',
  '현대카드',
  'BC카드',
  '우리카드',
  '하나카드',
  'NH농협카드',
  '씨티카드',
  '카카오뱅크카드',
  '토스카드',
];
const INSTALLMENT_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => `${index + 1}개월`);
const CARD_NUMBER_SEGMENTS = [4, 4, 4, 4];
const MAX_SELECTED_PRODUCT_COUNT = 2;
const TEAM_LEAD_LEVELS = new Set(['파트장', '팀장']);
const DEPARTMENT_HEAD_LEVELS = new Set(['대표', '파트장']);
const currentYear = new Date().getFullYear();
const contractYearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
const COMMENT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_COMMENT_PAGINATION = {
  pageIndex: 0,
  pageSize: 5,
  pageCount: 1,
  total: 0,
};

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '-';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ko-KR') : '-';
}

function getMoneyNumber(value) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function getDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function getSelectOptions(options, currentValue) {
  const value = String(currentValue || '').trim();
  if (!value || options.includes(value)) return options;
  return [...options, value];
}

function getProductNames(value) {
  return String(value || '')
    .split(',')
    .map(product => product.trim())
    .filter(Boolean);
}

function getStaffIdByName(staffOptions, name) {
  const targetName = String(name || '').trim();
  if (!targetName) return '';
  const staff = staffOptions.find(item => item.name === targetName);
  return staff ? String(staff.id) : '';
}

function createDetailEditForm(ad = {}) {
  return {
    productNames: getProductNames(ad.productName),
    managerUserId: ad.userId ? String(ad.userId) : '',
    manager: ad.manager || '',
    managerTeam: ad.team || '',
    teamLeadUserId: '',
    teamLead: ad.teamLead || '',
    departmentHeadUserId: '',
    departmentHead: ad.departmentHead || '',
    production1: ad.production1 || '',
    production2: ad.production2 || '',
    adProgress: ad.adProgress || '',
    productItems: Array.from({ length: 10 }, (_, index) => ad.productItems?.[index] || ''),
    registrationUrl: ad.registrationUrl || '',
    titleText: ad.titleText || '',
    descriptionText: ad.descriptionText || '',
    advertiserAccount: ad.advertiserAccount || '',
    memo: ad.memo || '',
    fileName: ad.fileName || '',
  };
}

function splitSegmentedValue(value, segments) {
  const text = String(value || '');
  const parts = text.includes('-') ? text.split('-') : [];

  if (parts.length > 1) {
    return segments.map((_, index) => parts[index] || '');
  }

  const digits = getDigits(text);
  let cursor = 0;
  return segments.map(length => {
    const part = digits.slice(cursor, cursor + length);
    cursor += length;
    return part;
  });
}

function joinSegmentedValue(parts) {
  const normalizedParts = [...parts];
  while (normalizedParts.length > 0 && !normalizedParts[normalizedParts.length - 1]) {
    normalizedParts.pop();
  }
  return normalizedParts.length ? normalizedParts.join('-') : '';
}

function renderContractDateHeader({ date, changeYear, changeMonth }) {
  return (
    <div className="date_select_header ad_payment_edit_date_header">
      <select
        value={date.getFullYear()}
        onChange={event => changeYear(Number(event.target.value))}
        aria-label="계약기간 연도"
      >
        {contractYearOptions.map(year => (
          <option value={year} key={year}>{year}년</option>
        ))}
      </select>
      <select
        value={date.getMonth()}
        onChange={event => changeMonth(Number(event.target.value))}
        aria-label="계약기간 월"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <option value={index} key={index}>{pad(index + 1)}월</option>
        ))}
      </select>
    </div>
  );
}

function getFullAddress(ad) {
  return [ad.postcode && `(${ad.postcode})`, ad.address, ad.detailAddress]
    .filter(Boolean)
    .join(' ');
}

function Field({ label, value, wide = false, action }) {
  return (
    <div className={`ad_view_field ${wide ? 'wide' : ''}`}>
      <span className="ad_view_label">{label}</span>
      <span className={`ad_view_value ${action ? 'has_action' : ''}`}>
        <span>{value || '-'}</span>
        {action}
      </span>
    </div>
  );
}

function EditableField({ label, children, wide = false }) {
  return (
    <div className={`ad_view_field ${wide ? 'wide' : ''}`}>
      <span className="ad_view_label">{label}</span>
      <div className="ad_view_value editable">{children}</div>
    </div>
  );
}

function SegmentedInput({ value, segments, className = '', disabled, onChange }) {
  const inputRefs = useRef([]);
  const parts = splitSegmentedValue(value, segments);

  const focusInput = index => {
    window.requestAnimationFrame(() => {
      inputRefs.current[index]?.focus();
    });
  };

  return (
    <div className={`ad_view_segmented_control ${className}`.trim()}>
      {segments.map((length, index) => (
        <Fragment key={index}>
          <IMaskInput
            inputRef={input => {
              inputRefs.current[index] = input;
            }}
            mask={'0'.repeat(length)}
            value={parts[index]}
            onAccept={partValue => {
              const digits = getDigits(partValue);
              const nextParts = [...parts];
              nextParts[index] = digits;
              onChange(joinSegmentedValue(nextParts));
              if (!disabled && digits.length >= length && index < segments.length - 1) {
                focusInput(index + 1);
              }
            }}
            onKeyDown={event => {
              if (event.key === '-' && index < segments.length - 1) {
                event.preventDefault();
                focusInput(index + 1);
              }
              if (event.key === 'Backspace' && !parts[index] && index > 0) {
                focusInput(index - 1);
              }
            }}
            disabled={disabled}
          />
          {index < segments.length - 1 && <span aria-hidden="true">-</span>}
        </Fragment>
      ))}
    </div>
  );
}

function Chip({ active, children, onClick, disabled }) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`ad_view_product_chip ${active ? 'active' : ''}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return <span className={`ad_view_product_chip ${active ? 'active' : ''}`}>{children}</span>;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
}

function formatCommentDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

function CommentSection({
  title,
  emptyText,
  comments,
  pagination,
  isLoading,
  error,
  text,
  onTextChange,
  isCreating,
  actionId,
  editingId,
  editingText,
  onEditingTextChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onPageChange,
  className = '',
}) {
  const rangeStart = pagination.total > 0
    ? pagination.pageIndex * pagination.pageSize + 1
    : 0;
  const rangeEnd = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    pagination.total
  );

  return (
    <section className={`ad_view_panel comments ${className}`.trim()}>
      <h2>{title}</h2>
      <div className="ad_view_comment_list">
        {isLoading ? (
          <div className="ad_view_comment_empty">
            <Spinner animation="border" size="sm" />
            <span>댓글을 불러오는 중입니다.</span>
          </div>
        ) : comments.length > 0 ? comments.map(comment => {
          const isEditing = editingId === comment.id;
          const isProcessing = actionId === comment.id;

          return (
            <div className="ad_view_comment" key={comment.id}>
              <div className="ad_view_comment_author">
                <span className="ad_view_comment_avatar">
                  {comment.authorProfileImage ? (
                    <img src={comment.authorProfileImage} alt="" />
                  ) : (
                    comment.author?.slice(0, 1) || 'I'
                  )}
                </span>
                <strong title={comment.author}>{comment.author}</strong>
              </div>
              <div className={`ad_view_comment_bubble ${comment.canManage ? 'manageable' : ''}`}>
                {isEditing ? (
                  <div className="ad_view_comment_edit">
                    <input
                      type="text"
                      value={editingText}
                      onChange={event => onEditingTextChange(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                          onUpdate(comment.id);
                        }
                        if (event.key === 'Escape') {
                          onCancelEdit();
                        }
                      }}
                      aria-label="댓글 수정"
                      maxLength={1000}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="save"
                      onClick={() => onUpdate(comment.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '저장 중' : '저장'}
                    </button>
                    <button type="button" onClick={onCancelEdit} disabled={isProcessing}>
                      취소
                    </button>
                  </div>
                ) : (
                  <p title={comment.content}>{comment.content}</p>
                )}
                {!isEditing && (
                  <div className="ad_view_comment_meta">
                    {comment.canManage && (
                      <div className="ad_view_comment_actions">
                        <button type="button" onClick={() => onStartEdit(comment)}>
                          수정
                        </button>
                        <button
                          type="button"
                          className="delete"
                          onClick={() => onDelete(comment.id)}
                          disabled={isProcessing}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                    <time>{formatCommentDateTime(comment.createdAt)}</time>
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="ad_view_comment_empty">{emptyText}</div>
        )}
      </div>
      <div className="ad_view_comment_footer">
        <select
          value={pagination.pageSize}
          onChange={event => onPageChange(0, Number(event.target.value))}
          aria-label="댓글 페이지당 표시 개수"
          disabled={isLoading}
        >
          {COMMENT_PAGE_SIZE_OPTIONS.map(size => (
            <option value={size} key={size}>{size}개</option>
          ))}
        </select>
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageCount={pagination.pageCount}
          onPageChange={pageIndex => onPageChange(pageIndex, pagination.pageSize)}
          className="ad_view_comment_pages"
        />
        <div className="ad_view_comment_count">
          <span>{rangeStart}-{rangeEnd}</span>
          <strong>
            <FontAwesomeIcon icon={faCoins} aria-hidden="true" />
            {pagination.total}건
          </strong>
        </div>
      </div>
      <form className="ad_view_comment_form" onSubmit={onSubmit}>
        <input
          type="text"
          value={text}
          onChange={event => onTextChange(event.target.value)}
          aria-label={`${title} 입력`}
          placeholder="댓글을 입력해주세요."
          maxLength={1000}
        />
        <button type="submit" disabled={isCreating}>
          {isCreating ? '등록 중' : '등록'}
        </button>
      </form>
      {error && <p className="ad_view_comment_error">{error}</p>}
    </section>
  );
}

function AdManagementDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [error, setError] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsError, setSmsError] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [paymentEditForm, setPaymentEditForm] = useState({
    approvedAmount: '',
    contractStartDate: null,
    contractEndDate: null,
    taxInvoice: '발행',
    approvalNumber: '',
    spendingCost: '',
    paymentMethod: '',
    cardCompany: '',
    cardExpiryMonth: '',
    cardExpiryYear: '',
    cardNumber: '',
    paymentStatus: '결제대기',
    installmentMonths: '',
  });
  const [detailEditForm, setDetailEditForm] = useState(() => createDetailEditForm());
  const [updateModal, setUpdateModal] = useState({
    show: false,
    mode: 'confirm',
    title: '',
    message: '',
    variant: 'warning',
  });
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [commentActionId, setCommentActionId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentPagination, setCommentPagination] = useState(() => ({ ...DEFAULT_COMMENT_PAGINATION }));
  const [adminCommentText, setAdminCommentText] = useState('');
  const [adminCommentError, setAdminCommentError] = useState('');
  const [isCreatingAdminComment, setIsCreatingAdminComment] = useState(false);
  const [adminCommentActionId, setAdminCommentActionId] = useState(null);
  const [editingAdminCommentId, setEditingAdminCommentId] = useState(null);
  const [editingAdminCommentText, setEditingAdminCommentText] = useState('');
  const [isLoadingAdminComments, setIsLoadingAdminComments] = useState(false);
  const [adminCommentPagination, setAdminCommentPagination] = useState(() => ({ ...DEFAULT_COMMENT_PAGINATION }));
  const canEditPayment = user?.role === '전체관리자' || user?.role === '대표' || user?.level === '대표';

  const fetchAd = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '광고 상세 조회에 실패했습니다.');
      }

      setAd(data.ad);
      setDetailEditForm(createDetailEditForm(data.ad));
      setCommentPagination({
        pageIndex: Math.max((data.ad.commentPagination?.page || 1) - 1, 0),
        pageSize: data.ad.commentPagination?.pageSize || 5,
        pageCount: data.ad.commentPagination?.pageCount || 1,
        total: data.ad.commentPagination?.total || 0,
      });
      setAdminCommentPagination({
        pageIndex: Math.max((data.ad.adminCommentPagination?.page || 1) - 1, 0),
        pageSize: data.ad.adminCommentPagination?.pageSize || 5,
        pageCount: data.ad.adminCommentPagination?.pageCount || 1,
        total: data.ad.adminCommentPagination?.total || 0,
      });
      setPaymentEditForm({
        approvedAmount: String(data.ad.approvedAmount ?? ''),
        contractStartDate: parseDateValue(data.ad.contractStartDate),
        contractEndDate: parseDateValue(data.ad.contractEndDate),
        taxInvoice: data.ad.taxInvoice || '발행',
        approvalNumber: data.ad.approvalNumber || '',
        spendingCost: String(data.ad.spendingCost ?? ''),
        paymentMethod: data.ad.paymentMethod || '',
        cardCompany: data.ad.cardCompany || '',
        cardExpiryMonth: data.ad.cardExpiryMonth || '',
        cardExpiryYear: data.ad.cardExpiryYear || '',
        cardNumber: data.ad.cardNumber || '',
        paymentStatus: PAYMENT_STATUSES.includes(data.ad.paymentStatus)
          ? data.ad.paymentStatus
          : '결제대기',
        installmentMonths: data.ad.installmentMonths || '',
      });
    } catch (err) {
      console.error('Fetch ad detail error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAd();
  }, [fetchAd]);

  useEffect(() => {
    const loadStaffOptions = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/staff-options', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (res.ok && Array.isArray(data.staff)) {
          setStaffOptions(data.staff);
        }
      } catch (err) {
        console.error('Load staff options error:', err);
      }
    };

    loadStaffOptions();
  }, []);

  const fetchComments = useCallback(async (pageIndex, pageSize, scope = 'public') => {
    const isAdminScope = scope === 'admin';
    const setLoading = isAdminScope ? setIsLoadingAdminComments : setIsLoadingComments;
    const setErrorMessage = isAdminScope ? setAdminCommentError : setCommentError;

    setLoading(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        pageSize: String(pageSize),
        scope,
      });
      const res = await fetch(`/api/ads/${id}/comments?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 목록 조회에 실패했습니다.');
      }

      setAd(prev => ({
        ...(prev || {}),
        [isAdminScope ? 'adminComments' : 'comments']: data.comments,
      }));
      const nextPagination = {
        pageIndex: Math.max(data.page - 1, 0),
        pageSize: data.pageSize,
        pageCount: data.pageCount,
        total: data.total,
      };
      if (isAdminScope) {
        setAdminCommentPagination(nextPagination);
      } else {
        setCommentPagination(nextPagination);
      }
      return true;
    } catch (err) {
      console.error('Fetch ad comments error:', err);
      setErrorMessage(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]);

  const contractPeriod = useMemo(() => {
    if (!ad) return '';
    return `${ad.contractStartDate || '-'} ~ ${ad.contractEndDate || '-'}`;
  }, [ad]);

  const agreementText = useMemo(() => {
    if (!ad) return '';
    return ad.agreementAt ? `${ad.agreementStatus} (${ad.agreementAt})` : ad.agreementStatus;
  }, [ad]);

  const paymentPreview = useMemo(() => {
    const approvedAmount = getMoneyNumber(paymentEditForm.approvedAmount);
    const spendingCost = getMoneyNumber(paymentEditForm.spendingCost);
    const vat = Math.round(approvedAmount / 11);
    const salesAmount = Math.max(approvedAmount - vat, 0);
    const netProfit = Math.max(salesAmount - spendingCost, 0);

    return {
      approvedAmount,
      spendingCost,
      vat,
      salesAmount,
      netProfit,
    };
  }, [paymentEditForm.approvedAmount, paymentEditForm.spendingCost]);

  const handleDetailProductToggle = product => {
    const isSelected = detailEditForm.productNames.includes(product);
    const nextProducts = isSelected
      ? detailEditForm.productNames.filter(selectedProduct => selectedProduct !== product)
      : [...detailEditForm.productNames, product];

    if (!isSelected && detailEditForm.productNames.length >= MAX_SELECTED_PRODUCT_COUNT) {
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '입력 확인',
        message: '상품군은 최대 2개까지 선택할 수 있습니다.',
        variant: 'warning',
      });
      return;
    }

    setDetailEditForm(prev => ({
      ...prev,
      productNames: nextProducts,
      production1: nextProducts[0] || '',
      production2: nextProducts[1] || '',
    }));
  };

  const updateDetailProductItem = (index, value) => {
    setDetailEditForm(prev => ({
      ...prev,
      productItems: prev.productItems.map((item, itemIndex) => (
        itemIndex === index ? value : item
      )),
    }));
  };

  const handleManagerChange = value => {
    const staff = staffOptions.find(item => String(item.id) === value);
    setDetailEditForm(prev => ({
      ...prev,
      managerUserId: value,
      manager: staff?.name || '',
      managerTeam: staff?.team || '',
    }));
  };

  const handleTeamLeadChange = value => {
    const staff = staffOptions.find(item => String(item.id) === value);
    setDetailEditForm(prev => ({
      ...prev,
      teamLeadUserId: value,
      teamLead: staff?.name || '',
    }));
  };

  const handleDepartmentHeadChange = value => {
    const staff = staffOptions.find(item => String(item.id) === value);
    setDetailEditForm(prev => ({
      ...prev,
      departmentHeadUserId: value,
      departmentHead: staff?.name || '',
    }));
  };

  const handleSendSms = async () => {
    if (!ad) return;

    const phoneNumber = ad.mobile || '';
    if (!phoneNumber) {
      setSmsError('계약서를 받을 고객 휴대폰 번호가 없습니다.');
      return;
    }

    const isResend = ad.smsContractStatus === '발송' || Boolean(ad.latestSmsToken) || Boolean(ad.smsHistories?.length);
    const confirmMessage = `다음 휴대폰 번호로 SMS 계약서를 ${isResend ? '재발송' : '발송'}하시겠습니까?\n\n${phoneNumber}`;
    if (!window.confirm(confirmMessage)) return;

    setIsSendingSms(true);
    setSmsMessage('');
    setSmsError('');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}/sms-consent/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumber,
          resend: isResend,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'SMS 계약서 발송에 실패했습니다.');
      }

      setSmsMessage(data.message);
      await fetchAd();
    } catch (err) {
      console.error('Send SMS consent error:', err);
      setSmsError(err.message);
    } finally {
      setIsSendingSms(false);
    }
  };

  const getPaymentEditValidation = () => {
    if (detailEditForm.productNames.length === 0) {
      return '상품군을 선택해주세요.';
    }
    if (detailEditForm.productNames.length > MAX_SELECTED_PRODUCT_COUNT) {
      return '상품군은 최대 2개까지 선택할 수 있습니다.';
    }
    if (!paymentEditForm.approvedAmount) {
      return '승인금액을 입력해주세요.';
    }
    if (!paymentEditForm.spendingCost && paymentEditForm.spendingCost !== '0') {
      return '소진비를 입력해주세요.';
    }
    if (!paymentEditForm.contractStartDate || !paymentEditForm.contractEndDate) {
      return '계약기간을 선택해주세요.';
    }
    if (paymentEditForm.contractEndDate < paymentEditForm.contractStartDate) {
      return '계약 종료일은 시작일보다 빠를 수 없습니다.';
    }
    if (!paymentEditForm.taxInvoice) {
      return '세금계산서 발행 여부를 선택해주세요.';
    }
    if (!paymentEditForm.paymentMethod) {
      return '결제구분을 선택해주세요.';
    }
    if (!detailEditForm.managerUserId) {
      return '담당자를 선택해주세요.';
    }

    return '';
  };

  const handleUpdateClick = () => {
    if (!canEditPayment) return;

    const validationError = getPaymentEditValidation();
    if (validationError) {
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '입력 확인',
        message: validationError,
        variant: 'warning',
      });
      return;
    }

    setUpdateModal({
      show: true,
      mode: 'confirm',
      title: '광고 수정',
      message: '수정한 광고 정보를 저장하시겠습니까?',
      variant: 'warning',
    });
  };

  const handlePaymentEditSubmit = async () => {
    setIsSavingPayment(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}/payment-info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approvedAmount: paymentEditForm.approvedAmount,
          contractStartDate: formatDateValue(paymentEditForm.contractStartDate),
          contractEndDate: formatDateValue(paymentEditForm.contractEndDate),
          productName: detailEditForm.productNames.join(', '),
          taxInvoice: paymentEditForm.taxInvoice,
          approvalNumber: paymentEditForm.approvalNumber,
          spendingCost: paymentEditForm.spendingCost,
          paymentMethod: paymentEditForm.paymentMethod,
          cardCompany: paymentEditForm.cardCompany,
          cardExpiryMonth: paymentEditForm.cardExpiryMonth,
          cardExpiryYear: paymentEditForm.cardExpiryYear,
          cardNumber: paymentEditForm.cardNumber,
          paymentStatus: paymentEditForm.paymentStatus,
          installmentMonths: paymentEditForm.installmentMonths,
          managerUserId: detailEditForm.managerUserId,
          teamLeadUserId: detailEditForm.teamLeadUserId || getStaffIdByName(staffOptions, detailEditForm.teamLead),
          departmentHeadUserId: detailEditForm.departmentHeadUserId || getStaffIdByName(staffOptions, detailEditForm.departmentHead),
          teamLead: detailEditForm.teamLead,
          departmentHead: detailEditForm.departmentHead,
          production1: detailEditForm.production1,
          production2: detailEditForm.production2,
          adProgress: detailEditForm.adProgress,
          productItems: detailEditForm.productItems,
          registrationUrl: detailEditForm.registrationUrl,
          titleText: detailEditForm.titleText,
          descriptionText: detailEditForm.descriptionText,
          advertiserAccount: detailEditForm.advertiserAccount,
          memo: detailEditForm.memo,
          fileName: detailEditForm.fileName,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '결제정보 수정에 실패했습니다.');
      }

      setAd(prev => ({
        ...prev,
        ...data.payment,
      }));
      setPaymentEditForm(prev => ({
        ...prev,
        approvedAmount: String(data.payment.approvedAmount ?? ''),
        contractStartDate: parseDateValue(data.payment.contractStartDate),
        contractEndDate: parseDateValue(data.payment.contractEndDate),
        taxInvoice: data.payment.taxInvoice || '발행',
        approvalNumber: data.payment.approvalNumber || '',
        spendingCost: String(data.payment.spendingCost ?? ''),
        paymentMethod: data.payment.paymentMethod || '',
        cardCompany: data.payment.cardCompany || '',
        cardExpiryMonth: data.payment.cardExpiryMonth || '',
        cardExpiryYear: data.payment.cardExpiryYear || '',
        cardNumber: data.payment.cardNumber || '',
        paymentStatus: data.payment.paymentStatus,
        installmentMonths: data.payment.installmentMonths || '',
      }));
      setDetailEditForm(createDetailEditForm({
        ...ad,
        ...data.payment,
      }));
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '수정 완료',
        message: data.message || '광고 정보가 수정되었습니다.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Update ad payment info error:', err);
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '수정 실패',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCreateComment = async (event, scope = 'public') => {
    event.preventDefault();
    const isAdminScope = scope === 'admin';
    const content = (isAdminScope ? adminCommentText : commentText).trim();
    const setText = isAdminScope ? setAdminCommentText : setCommentText;
    const setErrorMessage = isAdminScope ? setAdminCommentError : setCommentError;
    const setCreating = isAdminScope ? setIsCreatingAdminComment : setIsCreatingComment;
    const pagination = isAdminScope ? adminCommentPagination : commentPagination;

    if (!content) {
      setErrorMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setCreating(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, scope }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 등록에 실패했습니다.');
      }

      setText('');
      await fetchComments(0, pagination.pageSize, scope);
    } catch (err) {
      console.error('Create ad comment error:', err);
      setErrorMessage(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStartCommentEdit = (comment, scope = 'public') => {
    if (scope === 'admin') {
      setEditingAdminCommentId(comment.id);
      setEditingAdminCommentText(comment.content);
      setAdminCommentError('');
      return;
    }

    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
    setCommentError('');
  };

  const handleCancelCommentEdit = (scope = 'public') => {
    if (scope === 'admin') {
      setEditingAdminCommentId(null);
      setEditingAdminCommentText('');
      return;
    }

    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleUpdateComment = async (commentId, scope = 'public') => {
    const isAdminScope = scope === 'admin';
    const content = (isAdminScope ? editingAdminCommentText : editingCommentText).trim();
    const setActionId = isAdminScope ? setAdminCommentActionId : setCommentActionId;
    const setErrorMessage = isAdminScope ? setAdminCommentError : setCommentError;
    const commentKey = isAdminScope ? 'adminComments' : 'comments';

    if (!content) {
      setErrorMessage('수정할 댓글 내용을 입력해주세요.');
      return;
    }

    setActionId(commentId);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 수정에 실패했습니다.');
      }

      setAd(prev => ({
        ...(prev || {}),
        [commentKey]: (prev?.[commentKey] || []).map(comment => (
          comment.id === commentId ? data.comment : comment
        )),
      }));
      handleCancelCommentEdit(scope);
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '댓글 수정 완료',
        message: data.message || '댓글 수정이 완료되었습니다.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Update ad comment error:', err);
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '댓글 수정 실패',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteComment = async (commentId, scope = 'public') => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;

    const isAdminScope = scope === 'admin';
    const setActionId = isAdminScope ? setAdminCommentActionId : setCommentActionId;
    const setErrorMessage = isAdminScope ? setAdminCommentError : setCommentError;
    const editingId = isAdminScope ? editingAdminCommentId : editingCommentId;
    const pagination = isAdminScope ? adminCommentPagination : commentPagination;
    const commentKey = isAdminScope ? 'adminComments' : 'comments';

    setActionId(commentId);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/ads/${id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 삭제에 실패했습니다.');
      }

      setAd(prev => ({
        ...(prev || {}),
        [commentKey]: (prev?.[commentKey] || []).filter(comment => comment.id !== commentId),
      }));
      if (editingId === commentId) {
        handleCancelCommentEdit(scope);
      }
      const nextTotal = Math.max(pagination.total - 1, 0);
      const nextPageCount = Math.max(Math.ceil(nextTotal / pagination.pageSize), 1);
      const nextPageIndex = Math.min(pagination.pageIndex, nextPageCount - 1);
      await fetchComments(nextPageIndex, pagination.pageSize, scope);
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '댓글 삭제 완료',
        message: data.message || '댓글 삭제가 완료되었습니다.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Delete ad comment error:', err);
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '댓글 삭제 실패',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="ad_view_block">
        <div className="ad_view_state">
          <Spinner animation="border" size="sm" />
          <span>광고 상세 정보를 불러오는 중입니다.</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ad_view_block">
        <Alert variant="danger" className="ad_view_alert">{error}</Alert>
        <button type="button" className="ad_view_list_button" onClick={() => navigate('/contracts/ad-management')}>
          광고 목록
        </button>
      </section>
    );
  }

  if (!ad) return null;

  const comments = Array.isArray(ad.comments) ? ad.comments : [];
  const adminComments = Array.isArray(ad.adminComments) ? ad.adminComments : [];
  const canUseAdminComments = Boolean(ad.canUseAdminComments);
  const isEditingCardPayment = paymentEditForm.paymentMethod === '카드';
  const isCardPayment = ad.paymentMethod === '카드';
  const commentRangeStart = commentPagination.total > 0
    ? commentPagination.pageIndex * commentPagination.pageSize + 1
    : 0;
  const commentRangeEnd = Math.min(
    (commentPagination.pageIndex + 1) * commentPagination.pageSize,
    commentPagination.total
  );
  const smsHistories = (ad.smsHistories || []).slice(0, 5);
  const agreementPreviewUrl = `${window.location.origin}/contracts/ad-management/${ad.id}/agreement-preview`;
  const productItems = Array.isArray(ad.productItems) ? ad.productItems : [];
  const selectedAdProducts = getProductNames(ad.productName);
  const editableProductNames = canEditPayment ? detailEditForm.productNames : selectedAdProducts;
  const managerOptions = staffOptions;
  const teamLeadOptions = staffOptions.filter(staff => TEAM_LEAD_LEVELS.has(staff.level));
  const departmentHeadOptions = staffOptions.filter(staff => DEPARTMENT_HEAD_LEVELS.has(staff.level));
  const teamLeadSelectValue = detailEditForm.teamLeadUserId || getStaffIdByName(teamLeadOptions, detailEditForm.teamLead);
  const departmentHeadSelectValue = detailEditForm.departmentHeadUserId || getStaffIdByName(departmentHeadOptions, detailEditForm.departmentHead);
  const hasSmsSendHistory = ad.smsContractStatus === '발송' || Boolean(ad.latestSmsToken) || smsHistories.length > 0;
  const smsSendButtonText = isSendingSms ? '전송중' : hasSmsSendHistory ? '재발송' : '발송';

  return (
    <section className="ad_view_block">
      <div className="ad_view_section_title">기본정보등록</div>
      <section className="ad_view_panel">
        <div className="ad_view_grid three">
          <Field label="상호명" value={ad.companyName} />
          <Field label="대표자" value={ad.ceoName} />
          <Field label="사업자등록번호" value={ad.businessRegNumber} />
          <Field label="Tel" value={ad.tel} />
          <Field label="Mobile" value={ad.mobile} />
          <Field label="업체 URL" value={ad.companyUrl} />
          <Field label="주소" value={getFullAddress(ad)} wide />
          <Field label="업체 E-Mail" value={ad.companyEmail} />
        </div>
      </section>

      <div className="ad_view_section_title">결제정보등록</div>
      <section className="ad_view_panel">
        <div className="ad_view_payment">
          <div className="ad_view_products">
            {PRODUCTS.map(product => (
              <Chip
                key={product}
                active={editableProductNames.includes(product)}
                onClick={canEditPayment ? () => handleDetailProductToggle(product) : undefined}
                disabled={isSavingPayment}
              >
                {product}
              </Chip>
            ))}
          </div>

          <div className="ad_view_grid two compact">
            {canEditPayment ? (
              <EditableField label="승인금액">
                <IMaskInput
                  mask={Number}
                  thousandsSeparator=","
                  value={paymentEditForm.approvedAmount}
                  onAccept={value => setPaymentEditForm(prev => ({ ...prev, approvedAmount: value }))}
                  placeholder="0"
                  inputMode="numeric"
                  disabled={isSavingPayment}
                />
              </EditableField>
            ) : (
              <Field label="승인금액" value={formatMoney(ad.approvedAmount)} />
            )}
            {canEditPayment ? (
              <EditableField label="계약기간">
                <div className="ad_view_inline_dates">
                  <DatePicker
                    selected={paymentEditForm.contractStartDate}
                    onChange={date => {
                      setPaymentEditForm(prev => ({ ...prev, contractStartDate: date }));
                    }}
                    maxDate={paymentEditForm.contractEndDate || undefined}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    placeholderText="시작일"
                    disabled={isSavingPayment}
                    popperClassName="date_select_calendar ad_payment_edit_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderContractDateHeader}
                  />
                  <span aria-hidden="true">-</span>
                  <DatePicker
                    selected={paymentEditForm.contractEndDate}
                    onChange={date => {
                      setPaymentEditForm(prev => ({ ...prev, contractEndDate: date }));
                    }}
                    minDate={paymentEditForm.contractStartDate || undefined}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    placeholderText="종료일"
                    disabled={isSavingPayment}
                    popperClassName="date_select_calendar ad_payment_edit_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderContractDateHeader}
                  />
                </div>
              </EditableField>
            ) : (
              <Field label="계약기간" value={contractPeriod} />
            )}
            <Field label="VAT" value={formatMoney(canEditPayment ? paymentPreview.vat : ad.vat)} />
            <Field label="승인회사" value={ad.approvedCompany} />
            <Field label="순이익" value={formatMoney(canEditPayment ? paymentPreview.netProfit : ad.netProfit)} />
            {canEditPayment ? (
              <EditableField label="세금계산서">
                <select
                  value={paymentEditForm.taxInvoice}
                  onChange={event => setPaymentEditForm(prev => ({ ...prev, taxInvoice: event.target.value }))}
                  disabled={isSavingPayment}
                >
                  {getSelectOptions(TAX_INVOICE_OPTIONS, paymentEditForm.taxInvoice).map(option => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </EditableField>
            ) : (
              <Field label="세금계산서" value={ad.taxInvoice} />
            )}
            {canEditPayment ? (
              <EditableField label="소진비">
                <IMaskInput
                  mask={Number}
                  thousandsSeparator=","
                  value={paymentEditForm.spendingCost}
                  onAccept={value => setPaymentEditForm(prev => ({ ...prev, spendingCost: value }))}
                  placeholder="0"
                  inputMode="numeric"
                  disabled={isSavingPayment}
                />
              </EditableField>
            ) : (
              <Field label="소진비" value={formatMoney(ad.spendingCost)} />
            )}
            {canEditPayment ? (
              <EditableField label="승인번호">
                <input
                  type="text"
                  value={paymentEditForm.approvalNumber}
                  onChange={event => setPaymentEditForm(prev => ({ ...prev, approvalNumber: event.target.value }))}
                  disabled={isSavingPayment}
                />
              </EditableField>
            ) : (
              <Field label="승인번호" value={ad.approvalNumber} />
            )}
            {canEditPayment ? (
              <EditableField label="결제구분">
                <select
                  value={paymentEditForm.paymentMethod}
                  onChange={event => {
                    const paymentMethod = event.target.value;
                    setPaymentEditForm(prev => ({
                      ...prev,
                      paymentMethod,
                      ...(paymentMethod === '카드'
                        ? {}
                        : {
                            cardCompany: '',
                            cardExpiryMonth: '',
                            cardExpiryYear: '',
                            cardNumber: '',
                            installmentMonths: '',
                          }),
                    }));
                  }}
                  disabled={isSavingPayment}
                >
                  <option value="">선택</option>
                  {getSelectOptions(PAYMENT_METHOD_OPTIONS, paymentEditForm.paymentMethod).map(option => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </EditableField>
            ) : (
              <Field label="결제구분" value={ad.paymentMethod} />
            )}
            {canEditPayment && isEditingCardPayment && (
              <>
                <EditableField label="카드사">
                  <select
                    value={paymentEditForm.cardCompany}
                    onChange={event => setPaymentEditForm(prev => ({ ...prev, cardCompany: event.target.value }))}
                    disabled={isSavingPayment}
                  >
                    <option value="">선택</option>
                    {getSelectOptions(CARD_COMPANY_OPTIONS, paymentEditForm.cardCompany).map(option => (
                      <option value={option} key={option}>{option}</option>
                    ))}
                  </select>
                </EditableField>
                <EditableField label="유효기간">
                  <div className="ad_view_split_pair">
                    <IMaskInput
                      mask="00"
                      value={paymentEditForm.cardExpiryMonth}
                      onAccept={value => setPaymentEditForm(prev => ({ ...prev, cardExpiryMonth: value }))}
                      placeholder="월"
                      disabled={isSavingPayment}
                    />
                    <span aria-hidden="true">/</span>
                    <IMaskInput
                      mask="00"
                      value={paymentEditForm.cardExpiryYear}
                      onAccept={value => setPaymentEditForm(prev => ({ ...prev, cardExpiryYear: value }))}
                      placeholder="년"
                      disabled={isSavingPayment}
                    />
                  </div>
                </EditableField>
              </>
            )}
            {!canEditPayment && isCardPayment && (
              <>
                <Field label="카드사" value={ad.cardCompany} />
                <Field label="유효기간" value={[ad.cardExpiryMonth, ad.cardExpiryYear].filter(Boolean).join('/')} />
              </>
            )}
            {canEditPayment ? (
              <EditableField label="결제상태">
                <select
                  value={paymentEditForm.paymentStatus}
                  onChange={event => {
                    setPaymentEditForm(prev => ({
                      ...prev,
                      paymentStatus: event.target.value,
                    }));
                  }}
                  disabled={isSavingPayment}
                >
                  {PAYMENT_STATUSES.map(status => (
                    <option value={status} key={status}>{status}</option>
                  ))}
                </select>
              </EditableField>
            ) : (
              <Field label="결제상태" value={ad.paymentStatus} />
            )}
            {canEditPayment && isEditingCardPayment ? (
              <EditableField label="할부개월">
                <select
                  value={paymentEditForm.installmentMonths}
                  onChange={event => setPaymentEditForm(prev => ({ ...prev, installmentMonths: event.target.value }))}
                  disabled={isSavingPayment}
                >
                  <option value="">선택</option>
                  {getSelectOptions(INSTALLMENT_MONTH_OPTIONS, paymentEditForm.installmentMonths).map(option => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </EditableField>
            ) : !canEditPayment && isCardPayment ? (
              <Field label="할부개월" value={ad.installmentMonths} />
            ) : null}
            {canEditPayment && isEditingCardPayment ? (
              <EditableField label="카드번호" wide>
                <SegmentedInput
                  value={paymentEditForm.cardNumber}
                  segments={CARD_NUMBER_SEGMENTS}
                  className="card"
                  disabled={isSavingPayment}
                  onChange={value => setPaymentEditForm(prev => ({ ...prev, cardNumber: value }))}
                />
              </EditableField>
            ) : !canEditPayment && isCardPayment ? (
              <Field label="카드번호" value={ad.cardNumber} wide />
            ) : (
              null
            )}
          </div>
        </div>
      </section>

      <div className="ad_view_section_title">SMS동의</div>
      <section className="ad_view_panel sms">
        {smsMessage && <Alert variant="success" className="ad_view_alert sms_alert">{smsMessage}</Alert>}
        {smsError && <Alert variant="danger" className="ad_view_alert sms_alert">{smsError}</Alert>}
        <div className="ad_view_grid three">
          <Field
            label="SMS계약서발송"
            value={ad.smsContractStatus}
            action={
              <button type="button" onClick={handleSendSms} disabled={isSendingSms}>
                {smsSendButtonText}
              </button>
            }
          />
          <Field label="동의상태" value={agreementText} />
          <Field
            label="계약서"
            value=""
            action={
              <a href={agreementPreviewUrl} target="_blank" rel="noreferrer">이용약관 보기</a>
            }
          />
        </div>
      </section>

      <div className="ad_view_section_title">SMS 전송내역</div>
      <section className="ad_view_panel sms_history">
        <Table className="ad_view_sms_table" responsive={false}>
          <thead>
            <tr>
              <th>전송일시</th>
              <th>결과</th>
              <th>상세</th>
              <th>보낸사람</th>
              <th>받는사람</th>
            </tr>
          </thead>
          <tbody>
            {smsHistories.length ? (
              smsHistories.map(history => (
                <tr key={history.id}>
                  <td>{formatDateTime(history.createdAt)}</td>
                  <td>{history.resultCode}</td>
                  <td>{history.resultText || '-'}</td>
                  <td>{history.senderName || '-'}</td>
                  <td>{history.phoneNumber || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>전송 내역이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </section>

      <div className="ad_view_section_title">상품정보등록</div>
      <section className="ad_view_panel">
        <div className="ad_view_grid three compact">
          {canEditPayment ? (
            <EditableField label="담당자">
              <select
                value={detailEditForm.managerUserId}
                onChange={event => handleManagerChange(event.target.value)}
                disabled={isSavingPayment}
              >
                <option value="">선택</option>
                {managerOptions.map(staff => (
                  <option value={staff.id} key={staff.id}>
                    {staff.name} ({staff.team || '미지정'})
                  </option>
                ))}
              </select>
            </EditableField>
          ) : (
            <Field label="담당자" value={ad.manager} />
          )}
          {canEditPayment ? (
            <EditableField label="담당팀장">
              <select
                value={teamLeadSelectValue}
                onChange={event => handleTeamLeadChange(event.target.value)}
                disabled={isSavingPayment}
              >
                <option value="">없음</option>
                {teamLeadOptions.map(staff => (
                  <option value={staff.id} key={staff.id}>{staff.name}</option>
                ))}
              </select>
            </EditableField>
          ) : (
            <Field label="담당팀장" value={ad.teamLead} />
          )}
          {canEditPayment ? (
            <EditableField label="담당부장">
              <select
                value={departmentHeadSelectValue}
                onChange={event => handleDepartmentHeadChange(event.target.value)}
                disabled={isSavingPayment}
              >
                <option value="">없음</option>
                {departmentHeadOptions.map(staff => (
                  <option value={staff.id} key={staff.id}>{staff.name}</option>
                ))}
              </select>
            </EditableField>
          ) : (
            <Field label="담당부장" value={ad.departmentHead} />
          )}
          {canEditPayment ? (
            <EditableField label="제작사항01">
              <input
                type="text"
                value={detailEditForm.production1}
                onChange={event => setDetailEditForm(prev => ({ ...prev, production1: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="제작사항01" value={ad.production1} />
          )}
          {canEditPayment ? (
            <EditableField label="제작사항02">
              <input
                type="text"
                value={detailEditForm.production2}
                onChange={event => setDetailEditForm(prev => ({ ...prev, production2: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="제작사항02" value={ad.production2} />
          )}
          {canEditPayment ? (
            <EditableField label="광고진행">
              <select
                value={detailEditForm.adProgress}
                onChange={event => setDetailEditForm(prev => ({ ...prev, adProgress: event.target.value }))}
                disabled={isSavingPayment}
              >
                <option value="">선택</option>
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </EditableField>
          ) : (
            <Field label="광고진행" value={ad.adProgress} />
          )}
        </div>

        <div className="ad_view_products_grid">
          {orderedProductIndexes.map(index => (
            canEditPayment ? (
              <EditableField label={`상품${index + 1}`} key={`product_${index + 1}`}>
                <input
                  type="text"
                  value={detailEditForm.productItems[index] || ''}
                  onChange={event => updateDetailProductItem(index, event.target.value)}
                  disabled={isSavingPayment}
                />
              </EditableField>
            ) : (
              <Field
                label={`상품${index + 1}`}
                value={productItems[index]}
                key={`product_${index + 1}`}
              />
            )
          ))}
        </div>
      </section>

      <div className="ad_view_section_title">기타정보등록</div>
      <section className="ad_view_panel">
        <div className="ad_view_grid one">
          {canEditPayment ? (
            <EditableField label="등록URL" wide>
              <input
                type="text"
                value={detailEditForm.registrationUrl}
                onChange={event => setDetailEditForm(prev => ({ ...prev, registrationUrl: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="등록URL" value={ad.registrationUrl} />
          )}
          {canEditPayment ? (
            <EditableField label="제목문구" wide>
              <input
                type="text"
                value={detailEditForm.titleText}
                onChange={event => setDetailEditForm(prev => ({ ...prev, titleText: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="제목문구" value={ad.titleText} />
          )}
          {canEditPayment ? (
            <EditableField label="설명문구" wide>
              <input
                type="text"
                value={detailEditForm.descriptionText}
                onChange={event => setDetailEditForm(prev => ({ ...prev, descriptionText: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="설명문구" value={ad.descriptionText} />
          )}
          {canEditPayment ? (
            <EditableField label="광고주계정" wide>
              <input
                type="text"
                value={detailEditForm.advertiserAccount}
                onChange={event => setDetailEditForm(prev => ({ ...prev, advertiserAccount: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="광고주계정" value={ad.advertiserAccount} />
          )}
          {canEditPayment ? (
            <EditableField label="비고" wide>
              <input
                type="text"
                value={detailEditForm.memo}
                onChange={event => setDetailEditForm(prev => ({ ...prev, memo: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="비고" value={ad.memo} />
          )}
          {canEditPayment ? (
            <EditableField label="첨부파일" wide>
              <input
                type="text"
                value={detailEditForm.fileName}
                onChange={event => setDetailEditForm(prev => ({ ...prev, fileName: event.target.value }))}
                disabled={isSavingPayment}
              />
            </EditableField>
          ) : (
            <Field label="첨부파일" value={ad.fileName} />
          )}
        </div>
      </section>

      {canUseAdminComments && (
        <CommentSection
          title="관리자 댓글"
          emptyText="등록된 관리자 댓글이 없습니다."
          comments={adminComments}
          pagination={adminCommentPagination}
          isLoading={isLoadingAdminComments}
          error={adminCommentError}
          text={adminCommentText}
          onTextChange={setAdminCommentText}
          isCreating={isCreatingAdminComment}
          actionId={adminCommentActionId}
          editingId={editingAdminCommentId}
          editingText={editingAdminCommentText}
          onEditingTextChange={setEditingAdminCommentText}
          onSubmit={event => handleCreateComment(event, 'admin')}
          onStartEdit={comment => handleStartCommentEdit(comment, 'admin')}
          onCancelEdit={() => handleCancelCommentEdit('admin')}
          onUpdate={commentId => handleUpdateComment(commentId, 'admin')}
          onDelete={commentId => handleDeleteComment(commentId, 'admin')}
          onPageChange={(pageIndex, pageSize) => fetchComments(pageIndex, pageSize, 'admin')}
          className="admin_comments"
        />
      )}

      <section className="ad_view_panel comments">
        <h2>전체 공개 댓글</h2>
        <div className="ad_view_comment_list">
          {isLoadingComments ? (
            <div className="ad_view_comment_empty">
              <Spinner animation="border" size="sm" />
              <span>댓글을 불러오는 중입니다.</span>
            </div>
          ) : comments.length > 0 ? comments.map(comment => {
            const isEditing = editingCommentId === comment.id;
            const isProcessing = commentActionId === comment.id;

            return (
              <div className="ad_view_comment" key={comment.id}>
                <div className="ad_view_comment_author">
                  <span className="ad_view_comment_avatar">
                    {comment.authorProfileImage ? (
                      <img src={comment.authorProfileImage} alt="" />
                    ) : (
                      comment.author?.slice(0, 1) || 'I'
                    )}
                  </span>
                  <strong title={comment.author}>{comment.author}</strong>
                </div>
                <div className={`ad_view_comment_bubble ${comment.canManage ? 'manageable' : ''}`}>
                  {isEditing ? (
                    <div className="ad_view_comment_edit">
                      <input
                        type="text"
                        value={editingCommentText}
                        onChange={event => setEditingCommentText(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            handleUpdateComment(comment.id);
                          }
                          if (event.key === 'Escape') {
                            handleCancelCommentEdit();
                          }
                        }}
                        aria-label="댓글 수정"
                        maxLength={1000}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="save"
                        onClick={() => handleUpdateComment(comment.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? '저장 중' : '저장'}
                      </button>
                      <button type="button" onClick={handleCancelCommentEdit} disabled={isProcessing}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <p title={comment.content}>{comment.content}</p>
                  )}
                  {!isEditing && (
                    <div className="ad_view_comment_meta">
                      {comment.canManage && (
                        <div className="ad_view_comment_actions">
                          <button type="button" onClick={() => handleStartCommentEdit(comment)}>
                            수정
                          </button>
                          <button
                            type="button"
                            className="delete"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={isProcessing}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                      <time>{formatCommentDateTime(comment.createdAt)}</time>
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="ad_view_comment_empty">등록된 공개 댓글이 없습니다.</div>
          )}
        </div>
        <div className="ad_view_comment_footer">
          <select
            value={commentPagination.pageSize}
            onChange={event => fetchComments(0, Number(event.target.value))}
            aria-label="댓글 페이지당 표시 개수"
            disabled={isLoadingComments}
          >
            <option value={5}>5개</option>
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
          <TablePagination
            pageIndex={commentPagination.pageIndex}
            pageCount={commentPagination.pageCount}
            onPageChange={pageIndex => fetchComments(pageIndex, commentPagination.pageSize)}
            className="ad_view_comment_pages"
          />
          <div className="ad_view_comment_count">
            <span>{commentRangeStart}-{commentRangeEnd}</span>
            <strong>
              <FontAwesomeIcon icon={faCoins} aria-hidden="true" />
              {commentPagination.total}건
            </strong>
          </div>
        </div>
        <form className="ad_view_comment_form" onSubmit={handleCreateComment}>
          <input
            type="text"
            value={commentText}
            onChange={event => setCommentText(event.target.value)}
            aria-label="댓글 입력"
            placeholder="댓글을 입력해주세요."
            maxLength={1000}
          />
          <button type="submit" disabled={isCreatingComment}>
            {isCreatingComment ? '등록 중' : '등록'}
          </button>
        </form>
        {commentError && <p className="ad_view_comment_error">{commentError}</p>}
      </section>

      <div className="ad_view_bottom_actions">
        <button
          type="button"
          className="ad_view_update_button"
          onClick={handleUpdateClick}
          disabled={!canEditPayment || isSavingPayment}
          title={canEditPayment ? '수정한 광고 결제정보 저장' : '전체관리자 또는 대표만 수정할 수 있습니다.'}
        >
          {isSavingPayment ? '수정 중...' : '광고수정'}
        </button>
        <button type="button" className="ad_view_list_button" onClick={() => navigate('/contracts/ad-management')}>
          광고 목록
        </button>
      </div>

      <Modal
        show={updateModal.show}
        onHide={() => {
          if (!isSavingPayment) {
            setUpdateModal(prev => ({ ...prev, show: false }));
          }
        }}
        centered
        dialogClassName="ad_view_update_dialog"
        contentClassName={`ad_view_update_modal ${updateModal.variant}`}
      >
        <Modal.Body>
          <strong>{updateModal.title}</strong>
          <p>{updateModal.message}</p>
          <div className="ad_view_update_modal_actions">
            {updateModal.mode === 'confirm' ? (
              <>
                <button
                  type="button"
                  className="ad_view_modal_cancel"
                  onClick={() => setUpdateModal(prev => ({ ...prev, show: false }))}
                  disabled={isSavingPayment}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="ad_view_modal_confirm"
                  onClick={handlePaymentEditSubmit}
                  disabled={isSavingPayment}
                >
                  {isSavingPayment ? '수정 중...' : '수정'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ad_view_modal_confirm"
                onClick={() => setUpdateModal(prev => ({ ...prev, show: false }))}
              >
                확인
              </button>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </section>
  );
}

export default AdManagementDetail;
