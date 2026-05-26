import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Modal } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import DaumPostcode from 'react-daum-postcode';
import './styles/ad_detail.css';

const product_options = [
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

const initial_company_data = {
  companyName: '',
  ceoName: '',
  businessRegNumber: '',
  birthDate: '',
  tel: '',
  mobile: '',
  postcode: '',
  address: '',
  detailAddress: '',
  companyUrl: '',
  companyEmail: '',
};

const initial_payment_data = {
  productName: '',
  startDate: null,
  endDate: null,
  approvedCompany: '(주)아이앤뷰커뮤니케이션',
  taxInvoice: '',
  paymentMethod: '',
};

const initial_payment_detail = {
  approvedAmount: '',
  spendingCost: '',
  approvalNumber: '',
  paymentStatus: '결제대기',
  cardCompany: '',
  installmentMonths: '1개월',
  expiryMonth: '',
  expiryYear: '',
  cardNumber1: '',
  cardNumber2: '',
  cardNumber3: '',
  cardNumber4: '',
};

const initial_product_info = {
  manager: '',
  teamLead: '',
  departmentHead: '',
  production1: '없음',
  production2: '없음',
  adProgress: 'OFF',
  products: Array(10).fill(''),
};

const initial_extra_info = {
  registrationUrl: '',
  titleText: '',
  descriptionText: '',
  advertiserAccount: '',
  memo: '',
  fileName: '',
};

function getNumber(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function AdField({ label, children, className = '' }) {
  return (
    <label className={`ad_field ${className}`}>
      <span className="ad_field_label">{label}</span>
      <span className="ad_field_control">{children}</span>
    </label>
  );
}

function AdReadField({ label, value, className = '' }) {
  return (
    <div className={`ad_field ${className}`}>
      <span className="ad_field_label">{label}</span>
      <span className="ad_field_control readonly">{value || '-'}</span>
    </div>
  );
}

function AdDetail({ user }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initial_company_data);
  const [paymentData, setPaymentData] = useState(initial_payment_data);
  const [paymentDetail, setPaymentDetail] = useState(initial_payment_detail);
  const [productInfo, setProductInfo] = useState({
    ...initial_product_info,
    manager: user?.name || '',
  });
  const [extraInfo, setExtraInfo] = useState(initial_extra_info);
  const [error, setError] = useState({ company: '', payment: '' });
  const [success, setSuccess] = useState({ company: '', payment: '' });
  const [isLoading, setIsLoading] = useState({ company: false, payment: false });
  const [showPostcodeModal, setShowPostcodeModal] = useState(false);

  const paymentSummary = useMemo(() => {
    const approvedAmount = getNumber(paymentDetail.approvedAmount);
    const vat = Math.round(approvedAmount / 11);
    const salesAmount = Math.max(approvedAmount - vat, 0);
    const netProfit = Math.max(salesAmount - getNumber(paymentDetail.spendingCost), 0);

    return {
      vat,
      salesAmount,
      netProfit,
    };
  }, [paymentDetail.approvedAmount, paymentDetail.spendingCost]);

  const handleCompanySubmit = async e => {
    e.preventDefault();
    setError(prev => ({ ...prev, company: '' }));
    setSuccess(prev => ({ ...prev, company: '' }));
    setIsLoading(prev => ({ ...prev, company: true }));

    if (!formData.companyName) {
      setError(prev => ({ ...prev, company: '상호명을 입력해주세요.' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!formData.ceoName) {
      setError(prev => ({ ...prev, company: '대표자 이름을 입력해주세요.' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(formData.businessRegNumber)) {
      setError(prev => ({ ...prev, company: '사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!/^\d{6}$/.test(formData.birthDate)) {
      setError(prev => ({ ...prev, company: '생년월일은 6자리 숫자여야 합니다. (예: 991231)' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formData.tel)) {
      setError(prev => ({ ...prev, company: '전화번호 형식이 올바르지 않습니다. (예: 02-1234-5678)' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!/^\d{3}-\d{4}-\d{4}$/.test(formData.mobile)) {
      setError(prev => ({ ...prev, company: '휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!formData.postcode || !formData.address) {
      setError(prev => ({ ...prev, company: '주소를 검색하여 입력해주세요.' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }
    if (!formData.companyEmail.includes('@')) {
      setError(prev => ({ ...prev, company: '유효한 이메일 주소를 입력해주세요.' }));
      setIsLoading(prev => ({ ...prev, company: false }));
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          userId: user.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '회사 정보 등록에 실패했습니다.');

      setSuccess(prev => ({ ...prev, company: '회사 정보가 성공적으로 등록되었습니다.' }));
      setFormData(initial_company_data);
    } catch (err) {
      console.error('Save company error:', err);
      setError(prev => ({ ...prev, company: err.message }));
    } finally {
      setIsLoading(prev => ({ ...prev, company: false }));
    }
  };

  const handlePaymentSubmit = async e => {
    e.preventDefault();
    setError(prev => ({ ...prev, payment: '' }));
    setSuccess(prev => ({ ...prev, payment: '' }));
    setIsLoading(prev => ({ ...prev, payment: true }));

    if (!paymentData.productName) {
      setError(prev => ({ ...prev, payment: '상품명을 선택해주세요.' }));
      setIsLoading(prev => ({ ...prev, payment: false }));
      return;
    }
    if (!paymentData.startDate || !paymentData.endDate) {
      setError(prev => ({ ...prev, payment: '계약기간을 선택해주세요.' }));
      setIsLoading(prev => ({ ...prev, payment: false }));
      return;
    }
    if (paymentData.endDate < paymentData.startDate) {
      setError(prev => ({ ...prev, payment: '종료일은 시작일보다 늦어야 합니다.' }));
      setIsLoading(prev => ({ ...prev, payment: false }));
      return;
    }
    if (!paymentData.taxInvoice) {
      setError(prev => ({ ...prev, payment: '세금계산서 발행 여부를 선택해주세요.' }));
      setIsLoading(prev => ({ ...prev, payment: false }));
      return;
    }
    if (!paymentData.paymentMethod) {
      setError(prev => ({ ...prev, payment: '결제구분을 선택해주세요.' }));
      setIsLoading(prev => ({ ...prev, payment: false }));
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...paymentData,
          userId: user.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '결제 정보 등록에 실패했습니다.');

      setSuccess(prev => ({ ...prev, payment: '광고 결제 정보가 성공적으로 등록되었습니다.' }));
      setPaymentData(initial_payment_data);
      setPaymentDetail(initial_payment_detail);
      setProductInfo({
        ...initial_product_info,
        manager: user?.name || '',
      });
      setExtraInfo(initial_extra_info);
    } catch (err) {
      console.error('Save payment error:', err);
      setError(prev => ({ ...prev, payment: err.message }));
    } finally {
      setIsLoading(prev => ({ ...prev, payment: false }));
    }
  };

  const handleAddressComplete = data => {
    setFormData(prev => ({
      ...prev,
      postcode: data.zonecode,
      address: data.address,
      detailAddress: '',
    }));
    setShowPostcodeModal(false);
  };

  const updateProduct = (index, value) => {
    setProductInfo(prev => ({
      ...prev,
      products: prev.products.map((product, productIndex) =>
        productIndex === index ? value : product
      ),
    }));
  };

  return (
    <section className="ad_detail_block">
      <form id="ad_company_form" className="ad_section" onSubmit={handleCompanySubmit}>
        <div className="ad_section_title">기본정보등록</div>
        <div className="ad_panel">
          <div className="ad_form_grid three">
            <AdField label="상호명">
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="상호명을 입력하세요"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="대표자">
              <input
                type="text"
                value={formData.ceoName}
                onChange={e => setFormData(prev => ({ ...prev, ceoName: e.target.value }))}
                placeholder="대표자 이름"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="사업자등록번호">
              <IMaskInput
                mask="000-00-00000"
                value={formData.businessRegNumber}
                onAccept={value => setFormData(prev => ({ ...prev, businessRegNumber: value }))}
                placeholder="123-45-67890"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="생년월일">
              <IMaskInput
                mask="000000"
                value={formData.birthDate}
                onAccept={value => setFormData(prev => ({ ...prev, birthDate: value }))}
                placeholder="991231"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="Tel">
              <IMaskInput
                mask={[
                  { mask: '00-000-0000' },
                  { mask: '00-0000-0000' },
                  { mask: '000-000-0000' },
                  { mask: '000-0000-0000' },
                ]}
                value={formData.tel}
                onAccept={value => setFormData(prev => ({ ...prev, tel: value }))}
                placeholder="02-1234-5678"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="Mobile">
              <IMaskInput
                mask="000-0000-0000"
                value={formData.mobile}
                onAccept={value => setFormData(prev => ({ ...prev, mobile: value }))}
                placeholder="010-1234-5678"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="업체 URL">
              <input
                type="url"
                value={formData.companyUrl}
                onChange={e => setFormData(prev => ({ ...prev, companyUrl: e.target.value }))}
                placeholder="https://example.com"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="주소" className="span_two">
              <div className="ad_address_control">
                <input
                  type="text"
                  value={formData.postcode}
                  placeholder="우편번호"
                  readOnly
                  disabled={isLoading.company}
                  onClick={() => !isLoading.company && setShowPostcodeModal(true)}
                />
                <input
                  type="text"
                  value={formData.address}
                  placeholder="기본주소"
                  readOnly
                  disabled={isLoading.company}
                  onClick={() => !isLoading.company && setShowPostcodeModal(true)}
                />
                <button
                  type="button"
                  onClick={() => setShowPostcodeModal(true)}
                  disabled={isLoading.company}
                >
                  검색
                </button>
              </div>
            </AdField>
            <AdField label="업체 E-Mail">
              <input
                type="email"
                value={formData.companyEmail}
                onChange={e => setFormData(prev => ({ ...prev, companyEmail: e.target.value }))}
                placeholder="contact@example.com"
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="상세주소" className="span_full">
              <input
                type="text"
                value={formData.detailAddress}
                onChange={e => setFormData(prev => ({ ...prev, detailAddress: e.target.value }))}
                placeholder="상세주소를 입력하세요"
                disabled={isLoading.company}
              />
            </AdField>
          </div>

          <div className="ad_section_actions">
            <button type="submit" className="ad_primary_button" disabled={isLoading.company}>
              {isLoading.company ? '저장 중...' : '기본정보 저장'}
            </button>
            <button
              type="button"
              className="ad_secondary_button"
              onClick={() => setFormData(initial_company_data)}
              disabled={isLoading.company}
            >
              초기화
            </button>
          </div>

          {error.company && <Alert variant="danger" className="ad_alert">{error.company}</Alert>}
          {success.company && <Alert variant="success" className="ad_alert">{success.company}</Alert>}
        </div>
      </form>

      <form id="ad_payment_form" className="ad_section" onSubmit={handlePaymentSubmit}>
        <div className="ad_section_title">결제정보등록</div>
        <div className="ad_panel">
          <div className="ad_payment_grid">
            <div className="ad_product_picker">
              {product_options.map(product => (
                <button
                  type="button"
                  key={product}
                  className={paymentData.productName === product ? 'active' : ''}
                  onClick={() => setPaymentData(prev => ({ ...prev, productName: product }))}
                  disabled={isLoading.payment}
                >
                  {product}
                </button>
              ))}
            </div>

            <div className="ad_form_grid two">
              <AdField label="승인금액">
                <IMaskInput
                  mask={Number}
                  thousandsSeparator=","
                  value={paymentDetail.approvedAmount}
                  onAccept={value => setPaymentDetail(prev => ({ ...prev, approvedAmount: value }))}
                  placeholder="0"
                  disabled={isLoading.payment}
                />
              </AdField>
              <AdField label="계약기간">
                <div className="ad_date_range">
                  <DatePicker
                    selected={paymentData.startDate}
                    onChange={date => setPaymentData(prev => ({ ...prev, startDate: date }))}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    placeholderText="시작일"
                    disabled={isLoading.payment}
                  />
                  <span>-</span>
                  <DatePicker
                    selected={paymentData.endDate}
                    onChange={date => setPaymentData(prev => ({ ...prev, endDate: date }))}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    placeholderText="종료일"
                    disabled={isLoading.payment}
                  />
                </div>
              </AdField>
              <AdReadField label="VAT" value={formatNumber(paymentSummary.vat)} />
              <AdReadField label="승인회사" value={paymentData.approvedCompany} />
              <AdReadField label="매출액" value={formatNumber(paymentSummary.salesAmount)} />
              <AdField label="세금계산서">
                <select
                  value={paymentData.taxInvoice}
                  onChange={e => setPaymentData(prev => ({ ...prev, taxInvoice: e.target.value }))}
                  disabled={isLoading.payment}
                >
                  <option value="">선택</option>
                  <option value="발행">발행</option>
                  <option value="미발행">미발행</option>
                </select>
              </AdField>
              <AdReadField label="총 순이익" value={formatNumber(paymentSummary.netProfit)} />
              <AdField label="승인번호">
                <input
                  value={paymentDetail.approvalNumber}
                  onChange={e => setPaymentDetail(prev => ({ ...prev, approvalNumber: e.target.value }))}
                  placeholder="승인번호"
                  disabled={isLoading.payment}
                />
              </AdField>
              <AdField label="소진비">
                <IMaskInput
                  mask={Number}
                  thousandsSeparator=","
                  value={paymentDetail.spendingCost}
                  onAccept={value => setPaymentDetail(prev => ({ ...prev, spendingCost: value }))}
                  placeholder="0"
                  disabled={isLoading.payment}
                />
              </AdField>
              <AdField label="결제상태">
                <select
                  value={paymentDetail.paymentStatus}
                  onChange={e => setPaymentDetail(prev => ({ ...prev, paymentStatus: e.target.value }))}
                  disabled={isLoading.payment}
                >
                  <option value="결제대기">결제대기</option>
                  <option value="결제승인">결제승인</option>
                  <option value="결제취소">결제취소</option>
                </select>
              </AdField>
              <AdField label="결제구분">
                <select
                  value={paymentData.paymentMethod}
                  onChange={e => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  disabled={isLoading.payment}
                >
                  <option value="">선택</option>
                  <option value="카드">카드</option>
                  <option value="현금">현금</option>
                </select>
              </AdField>
              <AdField label="카드사">
                <input
                  value={paymentDetail.cardCompany}
                  onChange={e => setPaymentDetail(prev => ({ ...prev, cardCompany: e.target.value }))}
                  placeholder="카드사"
                  disabled={isLoading.payment}
                />
              </AdField>
              <AdField label="유효기간">
                <div className="ad_split_pair">
                  <IMaskInput
                    mask="00"
                    value={paymentDetail.expiryMonth}
                    onAccept={value => setPaymentDetail(prev => ({ ...prev, expiryMonth: value }))}
                    placeholder="월"
                    disabled={isLoading.payment}
                  />
                  <span>/</span>
                  <IMaskInput
                    mask="00"
                    value={paymentDetail.expiryYear}
                    onAccept={value => setPaymentDetail(prev => ({ ...prev, expiryYear: value }))}
                    placeholder="년"
                    disabled={isLoading.payment}
                  />
                </div>
              </AdField>
              <AdField label="할부개월수">
                <select
                  value={paymentDetail.installmentMonths}
                  onChange={e => setPaymentDetail(prev => ({ ...prev, installmentMonths: e.target.value }))}
                  disabled={isLoading.payment}
                >
                  <option value="1개월">1개월</option>
                  <option value="3개월">3개월</option>
                  <option value="6개월">6개월</option>
                  <option value="12개월">12개월</option>
                </select>
              </AdField>
              <AdField label="카드번호" className="span_full">
                <div className="ad_card_number">
                  {['cardNumber1', 'cardNumber2', 'cardNumber3', 'cardNumber4'].map((key, index) => (
                    <span key={key}>
                      <IMaskInput
                        mask="0000"
                        value={paymentDetail[key]}
                        onAccept={value => setPaymentDetail(prev => ({ ...prev, [key]: value }))}
                        placeholder="****"
                        disabled={isLoading.payment}
                      />
                      {index < 3 && <i>-</i>}
                    </span>
                  ))}
                </div>
              </AdField>
            </div>
          </div>

          {error.payment && <Alert variant="danger" className="ad_alert">{error.payment}</Alert>}
          {success.payment && <Alert variant="success" className="ad_alert">{success.payment}</Alert>}
        </div>
      </form>

      <section className="ad_section">
        <div className="ad_section_title">상품정보등록</div>
        <div className="ad_panel">
          <div className="ad_form_grid three compact">
            <AdField label="담당자">
              <input
                value={productInfo.manager}
                onChange={e => setProductInfo(prev => ({ ...prev, manager: e.target.value }))}
              />
            </AdField>
            <AdField label="담당팀장">
              <input
                value={productInfo.teamLead}
                onChange={e => setProductInfo(prev => ({ ...prev, teamLead: e.target.value }))}
                placeholder="없음"
              />
            </AdField>
            <AdField label="담당부장">
              <input
                value={productInfo.departmentHead}
                onChange={e => setProductInfo(prev => ({ ...prev, departmentHead: e.target.value }))}
                placeholder="없음"
              />
            </AdField>
            <AdField label="제작사항-1">
              <select
                value={productInfo.production1}
                onChange={e => setProductInfo(prev => ({ ...prev, production1: e.target.value }))}
              >
                <option value="없음">없음</option>
                <option value="진행">진행</option>
                <option value="완료">완료</option>
              </select>
            </AdField>
            <AdField label="제작사항-2">
              <select
                value={productInfo.production2}
                onChange={e => setProductInfo(prev => ({ ...prev, production2: e.target.value }))}
              >
                <option value="없음">없음</option>
                <option value="진행">진행</option>
                <option value="완료">완료</option>
              </select>
            </AdField>
            <AdField label="광고진행">
              <select
                value={productInfo.adProgress}
                onChange={e => setProductInfo(prev => ({ ...prev, adProgress: e.target.value }))}
              >
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </AdField>
          </div>

          <div className="ad_products_grid">
            {productInfo.products.map((product, index) => (
              <AdField label={`상품${index + 1}`} key={`product_${index + 1}`}>
                <input
                  value={product}
                  onChange={e => updateProduct(index, e.target.value)}
                  placeholder="상품 내용을 입력하세요"
                />
              </AdField>
            ))}
          </div>
        </div>
      </section>

      <section className="ad_section">
        <div className="ad_section_title">기타정보등록</div>
        <div className="ad_panel">
          <div className="ad_form_grid one">
            <AdField label="등록URL">
              <input
                value={extraInfo.registrationUrl}
                onChange={e => setExtraInfo(prev => ({ ...prev, registrationUrl: e.target.value }))}
                placeholder="https://"
              />
            </AdField>
            <AdField label="제목문구">
              <input
                value={extraInfo.titleText}
                onChange={e => setExtraInfo(prev => ({ ...prev, titleText: e.target.value }))}
                placeholder="제목 문구"
              />
            </AdField>
            <AdField label="설명문구">
              <input
                value={extraInfo.descriptionText}
                onChange={e => setExtraInfo(prev => ({ ...prev, descriptionText: e.target.value }))}
                placeholder="설명 문구"
              />
            </AdField>
            <AdField label="광고주계정">
              <input
                value={extraInfo.advertiserAccount}
                onChange={e => setExtraInfo(prev => ({ ...prev, advertiserAccount: e.target.value }))}
                placeholder="광고주 계정"
              />
            </AdField>
            <AdField label="비고">
              <input
                value={extraInfo.memo}
                onChange={e => setExtraInfo(prev => ({ ...prev, memo: e.target.value }))}
                placeholder="비고"
              />
            </AdField>
            <AdField label="첨부파일">
              <div className="ad_file_control">
                <label>
                  파일 선택
                  <input
                    type="file"
                    onChange={e => setExtraInfo(prev => ({
                      ...prev,
                      fileName: e.target.files?.[0]?.name || '',
                    }))}
                  />
                </label>
                <span>{extraInfo.fileName || '선택된 파일 없음'}</span>
              </div>
            </AdField>
          </div>
        </div>
      </section>

      <div className="ad_bottom_actions">
        <button type="submit" form="ad_payment_form" className="ad_primary_button large" disabled={isLoading.payment}>
          {isLoading.payment ? '등록 중...' : '광고 등록'}
        </button>
        <button
          type="button"
          className="ad_secondary_button large"
          onClick={() => navigate('/contracts/ad-management')}
        >
          광고 목록
        </button>
      </div>

      <Modal
        show={showPostcodeModal}
        onHide={() => setShowPostcodeModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>우편번호 검색</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <DaumPostcode
            onComplete={handleAddressComplete}
            style={{ height: '400px' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="ad_secondary_button"
            onClick={() => setShowPostcodeModal(false)}
          >
            닫기
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default AdDetail;
