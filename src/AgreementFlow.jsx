import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import './styles/agreement_flow.css';

const termsSections = [
  {
    title: '제1조 목적',
    body: [
      '본 약관은 고객과 주식회사 아이앤뷰커뮤니케이션 사이의 온라인 마케팅 서비스 계약에 필요한 권리, 의무, 책임 사항을 정합니다.',
    ],
  },
  {
    title: '제2조 서비스 범위',
    body: [
      '검색광고, 웹페이지 제작, 블로그, SNS, 콘텐츠 제작, 광고 운영 등 계약서에 명시된 마케팅 서비스를 제공합니다.',
      '광고 매체 정책 변경, 심사 지연, 외부 플랫폼 장애 등 회사가 직접 통제할 수 없는 사유가 발생할 수 있습니다.',
    ],
  },
  {
    title: '제3조 계약의 성립',
    body: [
      '고객이 본 약관과 계약 내용을 확인하고 동의 버튼을 누르면 계약 동의가 성립합니다.',
      '서비스 기간, 결제금액, 상품 구성은 계약서 표시 내용을 기준으로 합니다.',
    ],
  },
  {
    title: '제4조 변경 및 해지',
    body: [
      '서비스 내용 변경 또는 계약 해지는 담당자와 협의하여 진행합니다.',
      '이미 진행된 광고비, 제작비, 매체비 등은 환불 또는 정산 대상에서 제외될 수 있습니다.',
    ],
  },
  {
    title: '제5조 기타',
    body: [
      '계약서와 약관에 명시되지 않은 사항은 관계 법령과 상호 협의에 따릅니다.',
      '분쟁이 발생할 경우 관할 법원은 회사 소재지를 기준으로 합니다.',
    ],
  },
];

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? `${number.toLocaleString('ko-KR')}원` : '-';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { hour12: false });
}

function AgreementLayout({ children }) {
  return (
    <main className="agreement_page">
      <section className="agreement_shell">
        <div className="agreement_logo">
          <img src="/img/logo/logo_w.svg" alt="I&VIEW Communication" />
        </div>
        {children}
      </section>
    </main>
  );
}

function AgreementState({ message, error }) {
  return (
    <AgreementLayout>
      <div className="agreement_state">
        {!error && <Spinner animation="border" size="sm" />}
        <p>{message}</p>
      </div>
    </AgreementLayout>
  );
}

function ContractField({ label, value, wide = false }) {
  return (
    <div className={`agreement_contract_field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="agreement_terms_box">
      {termsSections.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.body.map(item => <p key={item}>{item}</p>)}
        </section>
      ))}
    </div>
  );
}

function ContractContent({ contract }) {
  const productItems = contract?.productItems?.length
    ? contract.productItems
    : [contract?.productName].filter(Boolean);

  return (
    <section className="agreement_contract_card">
      <div className="agreement_contract_grid">
        <ContractField label="상호명" value={contract.companyName} />
        <ContractField label="대표자명" value={contract.ceoName} />
        <ContractField label="사업자등록번호" value={contract.businessRegNumber} />
        <ContractField label="연락처" value={contract.mobile || contract.tel} />
        <ContractField label="주소" value={contract.address} wide />
        <ContractField label="상품명" value={contract.productName} wide />
        <ContractField label="결제수단" value={contract.paymentMethod === '카드' ? contract.cardCompany : contract.paymentMethod} />
        <ContractField label="결제금액" value={formatMoney(contract.approvedAmount)} />
        <ContractField label="VAT" value={formatMoney(contract.vat)} />
        <ContractField label="계약기간" value={`${contract.contractStartDate || '-'} ~ ${contract.contractEndDate || '-'}`} />
        <ContractField label="담당자" value={contract.manager} />
        <ContractField label="담당자 연락처" value={contract.managerPhone} />
        <ContractField label="담당자 이메일" value={contract.managerEmail} wide />
      </div>

      <div className="agreement_products">
        <h2>상품정보등록</h2>
        {productItems.length ? (
          productItems.map(item => <p key={item}>{item}</p>)
        ) : (
          <p>등록된 상품 구성이 없습니다.</p>
        )}
      </div>

      <div className="agreement_notice">
        <p>본 계약서는 고객의 휴대폰으로 발송된 고유 링크를 통해 동의 처리됩니다.</p>
        <p>동의 일시와 접속 IP는 계약 확인 목적으로 저장될 수 있습니다.</p>
      </div>
    </section>
  );
}

function useAgreement(token) {
  const [agreement, setAgreement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/agreements/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '계약서를 조회하지 못했습니다.');
      }

      setAgreement(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { agreement, isLoading, error, reload };
}

function mapAdToContract(ad) {
  const productItems = Array.isArray(ad.productItems)
    ? ad.productItems.map(item => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    id: ad.id,
    companyName: ad.companyName || '',
    ceoName: ad.ceoName || '',
    businessRegNumber: ad.businessRegNumber || '',
    tel: ad.tel || '',
    mobile: ad.mobile || '',
    address: [ad.postcode && `(${ad.postcode})`, ad.address, ad.detailAddress].filter(Boolean).join(' '),
    companyUrl: ad.companyUrl || '',
    companyEmail: ad.companyEmail || '',
    productName: ad.productName || '',
    approvedAmount: ad.approvedAmount,
    vat: ad.vat,
    paymentMethod: ad.paymentMethod || '',
    cardCompany: ad.cardCompany || '',
    installmentMonths: ad.installmentMonths || '',
    contractStartDate: ad.contractStartDate || '',
    contractEndDate: ad.contractEndDate || '',
    manager: ad.manager || '',
    managerPhone: '',
    managerEmail: '',
    productItems: productItems.length
      ? productItems
      : [ad.productName, ad.titleText, ad.descriptionText, ad.memo].filter(Boolean),
    smsContractStatus: ad.smsContractStatus,
    agreementStatus: ad.agreementStatus,
    agreementAt: ad.agreementAt,
  };
}

function useAgreementPreview(id) {
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPreview = async () => {
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
          throw new Error(data.error || '계약서 미리보기를 불러오지 못했습니다.');
        }

        setContract(mapAdToContract(data.ad));
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [id]);

  return { contract, isLoading, error };
}

function AgreementTermsPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { agreement, isLoading, error } = useAgreement(token);

  if (isLoading) return <AgreementState message="이용약관을 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>SMS 계약서 동의</p>
        <h1>이용약관</h1>
        <span>{agreement.contract.companyName || '고객'}님 계약 동의 전 약관을 확인해주세요.</span>
      </div>

      {agreement.isAgreed && (
        <Alert variant="success" className="agreement_alert">
          이미 {formatDateTime(agreement.agreedAt || agreement.contract.agreementAt)}에 동의 완료된 계약서입니다.
        </Alert>
      )}

      <TermsContent />

      <div className="agreement_actions">
        <button type="button" onClick={() => navigate(`/agreement/${token}/contract`)}>
          계약서 확인
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementContractPage() {
  const { token } = useParams();
  const { agreement, isLoading, error } = useAgreement(token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  const contract = agreement?.contract;

  const handleAgree = async () => {
    if (!window.confirm('계약서 내용을 확인했으며 동의하시겠습니까?')) return;

    setIsSubmitting(true);
    setSubmitMessage('');
    setSubmitError('');

    try {
      const res = await fetch(`/api/agreements/${token}/agree`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '동의 처리에 실패했습니다.');
      }

      setSubmitMessage(data.message);
      window.setTimeout(() => {
        window.location.href = data.redirectUrl || 'https://www.inviewcc.com';
      }, 600);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <AgreementState message="계약서를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>온라인 마케팅 서비스</p>
        <h1>계약서</h1>
        <span>계약 내용을 확인한 뒤 하단의 동의 버튼을 눌러주세요.</span>
      </div>

      {(submitMessage || agreement.isAgreed) && (
        <Alert variant="success" className="agreement_alert">
          {submitMessage || `이미 ${formatDateTime(agreement.agreedAt || contract.agreementAt)}에 동의 완료된 계약서입니다.`}
        </Alert>
      )}
      {submitError && <Alert variant="danger" className="agreement_alert">{submitError}</Alert>}

      <ContractContent contract={contract} />

      <div className="agreement_actions split">
        <Link to={`/agreement/${token}`}>약관 다시 보기</Link>
        <button type="button" onClick={handleAgree} disabled={isSubmitting || agreement.isAgreed}>
          {agreement.isAgreed ? '동의 완료' : isSubmitting ? '처리 중...' : '동의'}
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementPreviewTermsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contract, isLoading, error } = useAgreementPreview(id);

  if (isLoading) return <AgreementState message="이용약관 미리보기를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>관리자 미리보기</p>
        <h1>이용약관</h1>
        <span>{contract.companyName || '고객'} 계약서에 연결된 이용약관입니다.</span>
      </div>

      <TermsContent />

      <div className="agreement_actions">
        <button type="button" onClick={() => navigate(`/contracts/ad-management/${id}/agreement-preview/contract`)}>
          계약서 확인
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementPreviewContractPage() {
  const { id } = useParams();
  const { contract, isLoading, error } = useAgreementPreview(id);

  if (isLoading) return <AgreementState message="계약서 미리보기를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>관리자 미리보기</p>
        <h1>서비스 이용계약서</h1>
        <span>SMS 발송 여부와 무관하게 확인하는 계약서 미리보기입니다.</span>
      </div>

      <ContractContent contract={contract} />

      <div className="agreement_actions split">
        <Link to={`/contracts/ad-management/${id}/agreement-preview`}>약관 다시 보기</Link>
        <button type="button" onClick={() => window.close()}>
          닫기
        </button>
      </div>
    </AgreementLayout>
  );
}

export {
  AgreementTermsPage,
  AgreementContractPage,
  AgreementPreviewTermsPage,
  AgreementPreviewContractPage,
};
