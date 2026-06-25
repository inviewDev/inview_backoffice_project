import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import './styles/ad_management_detail.css';
import './styles/date_select_picker.css';

const PRODUCTS = [
  'G패키지',
  'N바이럴마케팅',
  'INVIEWCC패키지',
  'SNS 페이지 기자단',
  '웹페이지 제작',
  '모바일 홈페이지 제작',
  '언론뉴스 송출',
  '온라인광고 패키지',
  '온라인광고 환불형',
  '블로그마케팅',
  '인플루언서 마케팅',
  'GDN패키지',
  'NAVER 브랜드검색',
];

const orderedProductIndexes = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9];
const PAYMENT_STATUSES = ['결제대기', '결제승인', '매출취소', '위약금'];
const currentYear = new Date().getFullYear();
const contractYearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '-';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ko-KR') : '-';
}

function getMoneyNumber(value) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
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

function EditableField({ label, children }) {
  return (
    <div className="ad_view_field">
      <span className="ad_view_label">{label}</span>
      <div className="ad_view_value editable">{children}</div>
    </div>
  );
}

function Chip({ active, children }) {
  return <span className={`ad_view_product_chip ${active ? 'active' : ''}`}>{children}</span>;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
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
  const [paymentEditForm, setPaymentEditForm] = useState({
    approvedAmount: '',
    contractStartDate: null,
    contractEndDate: null,
    paymentStatus: '결제대기',
  });
  const [updateModal, setUpdateModal] = useState({
    show: false,
    mode: 'confirm',
    title: '',
    message: '',
    variant: 'warning',
  });
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
      setPaymentEditForm({
        approvedAmount: String(data.ad.approvedAmount ?? ''),
        contractStartDate: parseDateValue(data.ad.contractStartDate),
        contractEndDate: parseDateValue(data.ad.contractEndDate),
        paymentStatus: PAYMENT_STATUSES.includes(data.ad.paymentStatus)
          ? data.ad.paymentStatus
          : '결제대기',
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
    const vat = Math.round(approvedAmount / 11);
    const salesAmount = Math.max(approvedAmount - vat, 0);
    const netProfit = Math.max(salesAmount - getMoneyNumber(ad?.spendingCost), 0);

    return {
      approvedAmount,
      vat,
      salesAmount,
      netProfit,
    };
  }, [ad?.spendingCost, paymentEditForm.approvedAmount]);

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
    if (!paymentEditForm.approvedAmount) {
      return '승인금액을 입력해주세요.';
    }
    if (!paymentEditForm.contractStartDate || !paymentEditForm.contractEndDate) {
      return '계약기간을 선택해주세요.';
    }
    if (paymentEditForm.contractEndDate < paymentEditForm.contractStartDate) {
      return '계약 종료일은 시작일보다 빠를 수 없습니다.';
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
      message: '수정한 결제정보를 저장하시겠습니까?',
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
          paymentStatus: paymentEditForm.paymentStatus,
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
        paymentStatus: data.payment.paymentStatus,
      }));
      setUpdateModal({
        show: true,
        mode: 'result',
        title: '수정 완료',
        message: data.message || '결제정보가 수정되었습니다.',
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

  const comments = ad.comments?.length ? ad.comments : [
    {
      id: 'empty',
      author: ad.manager || '담당자',
      content: ad.memo || '등록된 공개 댓글이 없습니다.',
      createdAt: ad.createdAt || '-',
    },
  ];
  const smsHistories = (ad.smsHistories || []).slice(0, 5);
  const agreementPreviewUrl = `${window.location.origin}/contracts/ad-management/${ad.id}/agreement-preview`;
  const productItems = Array.isArray(ad.productItems) ? ad.productItems : [];
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
              <Chip key={product} active={ad.productName === product}>{product}</Chip>
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
            <Field label="세금계산서" value={ad.taxInvoice} />
            <Field label="소진비" value={formatMoney(ad.spendingCost)} />
            <Field label="승인번호" value={ad.approvalNumber} />
            <Field label="결제구분" value={ad.paymentMethod} />
            <Field label="카드사" value={ad.cardCompany} />
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
            <Field label="할부개월" value={ad.installmentMonths} />
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
          <Field label="담당자" value={ad.manager} />
          <Field label="담당팀장" value={ad.teamLead} />
          <Field label="담당부장" value={ad.departmentHead} />
          <Field label="제작사항-1" value={ad.production1} />
          <Field label="제작사항-2" value={ad.production2} />
          <Field label="광고진행" value={ad.adProgress} />
        </div>

        <div className="ad_view_products_grid">
          {orderedProductIndexes.map(index => (
            <Field
              label={`상품${index + 1}`}
              value={productItems[index]}
              key={`product_${index + 1}`}
            />
          ))}
        </div>
      </section>

      <div className="ad_view_section_title">기타정보등록</div>
      <section className="ad_view_panel">
        <div className="ad_view_grid one">
          <Field label="등록URL" value={ad.registrationUrl} />
          <Field label="제목문구" value={ad.titleText} />
          <Field label="설명문구" value={ad.descriptionText} />
          <Field label="광고주계정" value={ad.advertiserAccount} />
          <Field label="비고" value={ad.memo} />
          <Field label="첨부파일" value={ad.fileName} />
        </div>
      </section>

      <section className="ad_view_panel comments">
        <h2>전체 공개 댓글</h2>
        <div className="ad_view_comment_list">
          {comments.map(comment => (
            <div className="ad_view_comment" key={comment.id}>
              <span className="ad_view_comment_avatar">{comment.author?.slice(0, 1) || 'I'}</span>
              <strong>{comment.author}</strong>
              <p>{comment.content}</p>
              <time>{comment.createdAt}</time>
            </div>
          ))}
        </div>
        <div className="ad_view_comment_form">
          <input type="text" aria-label="댓글 입력" />
          <button type="button">등록</button>
        </div>
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
