import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Spinner, Table } from 'react-bootstrap';
import './styles/ad_management_detail.css';

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

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? number.toLocaleString('ko-KR') : '-';
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

function Chip({ active, children }) {
  return <span className={`ad_view_product_chip ${active ? 'active' : ''}`}>{children}</span>;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
}

function AdManagementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [error, setError] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsError, setSmsError] = useState('');

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

  const handleSendSms = async () => {
    if (!ad) return;

    const phoneNumber = ad.mobile || '';
    if (!phoneNumber) {
      setSmsError('계약서를 받을 고객 휴대폰 번호가 없습니다.');
      return;
    }

    const isResend = ad.smsContractStatus === '발송';
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
  const smsHistories = ad.smsHistories || [];
  const agreementPreviewUrl = `${window.location.origin}/contracts/ad-management/${ad.id}/agreement-preview`;
  const productItems = Array.isArray(ad.productItems) ? ad.productItems : [];

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
            <Field label="승인금액" value={formatMoney(ad.approvedAmount)} />
            <Field label="계약기간" value={contractPeriod} />
            <Field label="VAT" value={formatMoney(ad.vat)} />
            <Field label="승인회사" value={ad.approvedCompany} />
            <Field label="순이익" value={formatMoney(ad.netProfit)} />
            <Field label="세금계산서" value={ad.taxInvoice} />
            <Field label="소진비" value={formatMoney(ad.spendingCost)} />
            <Field label="승인번호" value={ad.approvalNumber} />
            <Field label="결제구분" value={ad.paymentMethod} />
            <Field label="카드사" value={ad.cardCompany} />
            <Field label="결제상태" value={ad.paymentStatus} />
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
              <button type="button" onClick={handleSendSms} disabled={isSendingSms || ad.agreementStatus === '동의'}>
                {isSendingSms ? '전송중' : ad.smsContractStatus === '발송' ? '재발송' : '발송'}
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
        <div className="ad_view_grid three">
          <Field label="담당자" value={ad.manager} />
          <Field label="담당팀장" value={ad.teamLead} />
          <Field label="담당부장" value={ad.departmentHead} />
          <Field label="제작사항-1" value={ad.production1} />
          <Field label="제작사항-2" value={ad.production2} />
          <Field label="광고진행" value={ad.adProgress} />
          {Array.from({ length: 10 }, (_, index) => (
            <Field
              label={`상품${index + 1}`}
              value={productItems[index]}
              wide
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
        <button type="button" className="ad_view_register_button" disabled>
          광고 등록
        </button>
        <button type="button" className="ad_view_list_button" onClick={() => navigate('/contracts/ad-management')}>
          광고 목록
        </button>
      </div>
    </section>
  );
}

export default AdManagementDetail;
