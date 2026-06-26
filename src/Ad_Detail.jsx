import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import DaumPostcode from 'react-daum-postcode';
import './styles/ad_detail.css';
import './styles/date_select_picker.css';

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

const card_company_options = [
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

const installment_month_options = Array.from({ length: 12 }, (_, index) => `${index + 1}개월`);
const team_lead_levels = new Set(['파트장', '팀장']);
const department_head_levels = new Set(['대표', '파트장']);
const card_number_keys = ['cardNumber1', 'cardNumber2', 'cardNumber3', 'cardNumber4'];
const current_year = new Date().getFullYear();
const contract_year_options = Array.from({ length: 21 }, (_, index) => current_year - 10 + index);

const initial_company_data = {
  companyName: '',
  ceoName: '',
  businessRegNumber: '',
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
  taxInvoice: '발행',
  paymentMethod: '',
};

const initial_payment_detail = {
  approvedAmount: '',
  spendingCost: '',
  approvalNumber: '',
  paymentStatus: '결제대기',
  cardCompany: '',
  installmentMonths: '',
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
  production1: '',
  production2: '',
  adProgress: '',
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

const business_number_segments = [3, 2, 5];
const tel_number_segments = [4, 4, 4];
const mobile_number_segments = [3, 4, 4];
const card_number_segments = [4, 4, 4, 4];

function getNumber(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function getDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function renderContractDateHeader({ date, changeYear, changeMonth }) {
  return (
    <div className="date_select_header ad_contract_date_header">
      <select
        value={date.getFullYear()}
        onChange={event => changeYear(Number(event.target.value))}
        aria-label="계약기간 연도"
      >
        {contract_year_options.map(year => (
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
  return parts.every(part => !part) ? '' : parts.join('-');
}

function createInitialProductInfo(user) {
  return {
    ...initial_product_info,
    manager: user?.name || '',
  };
}

function AdField({ label, children, className = '' }) {
  return (
    <label className={`ad_field ${className}`}>
      <span className="ad_field_label">{label}</span>
      <span className="ad_field_control">{children}</span>
    </label>
  );
}

function AdSegmentedInput({ value, segments, className = '', disabled, onChange }) {
  const inputRefs = useRef([]);
  const parts = splitSegmentedValue(value, segments);

  const focusInput = index => {
    window.requestAnimationFrame(() => {
      inputRefs.current[index]?.focus();
    });
  };

  return (
    <div className={`ad_segmented_control ${className}`}>
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
              onChange(index, digits);
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
          {index < segments.length - 1 && <span>-</span>}
        </Fragment>
      ))}
    </div>
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
  const [productInfo, setProductInfo] = useState(() => createInitialProductInfo(user));
  const [extraInfo, setExtraInfo] = useState(initial_extra_info);
  const [staffOptions, setStaffOptions] = useState([]);
  const [isLoading, setIsLoading] = useState({ company: false, payment: false });
  const [showPostcodeModal, setShowPostcodeModal] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'warning',
  });

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

  useEffect(() => {
    setProductInfo(prev => ({
      ...prev,
      manager: user?.name || '',
    }));
  }, [user?.name]);

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

  const showAlert = ({ title = '입력 확인', message, variant = 'warning' }) => {
    setAlertModal({ show: true, title, message, variant });
  };

  const validateCompanyData = () => {
    if (!formData.companyName) {
      return '상호명을 입력해주세요.';
    }
    if (!formData.ceoName) {
      return '대표자 이름을 입력해주세요.';
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(formData.businessRegNumber)) {
      return '사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)';
    }
    if (!/^\d{2,4}-\d{3,4}-\d{4}$/.test(formData.tel)) {
      return '전화번호 형식이 올바르지 않습니다. (예: 02-1234-5678, 0507-1234-5678)';
    }
    if (!/^\d{3}-\d{4}-\d{4}$/.test(formData.mobile)) {
      return '휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)';
    }
    if (!formData.postcode || !formData.address) {
      return '주소를 검색하여 입력해주세요.';
    }
    if (!formData.companyEmail.includes('@')) {
      return '유효한 이메일 주소를 입력해주세요.';
    }

    return '';
  };

  const validatePaymentData = () => {
    if (!paymentData.productName) {
      return '상품명을 선택해주세요.';
    }
    if (!paymentDetail.approvedAmount) {
      return '승인금액을 입력해주세요.';
    }
    if (!paymentData.startDate || !paymentData.endDate) {
      return '계약기간을 선택해주세요.';
    }
    if (paymentData.endDate < paymentData.startDate) {
      return '종료일은 시작일보다 늦어야 합니다.';
    }
    if (!paymentData.paymentMethod) {
      return '결제구분을 선택해주세요.';
    }
    if (paymentData.paymentMethod === '카드') {
      if (!paymentDetail.cardCompany) return '카드사를 선택해주세요.';
      if (!paymentDetail.installmentMonths) return '할부개월수를 선택해주세요.';
    }
    if (!productInfo.manager) {
      return '담당자를 입력해주세요.';
    }

    return '';
  };

  const createCompany = async token => {
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
    return data.company?.id || null;
  };

  const getPaymentDetailPayload = () => {
    if (paymentData.paymentMethod === '카드') return paymentDetail;

    return {
      ...paymentDetail,
      cardCompany: '',
      installmentMonths: '',
      expiryMonth: '',
      expiryYear: '',
      cardNumber1: '',
      cardNumber2: '',
      cardNumber3: '',
      cardNumber4: '',
    };
  };

  const handlePaymentSubmit = async e => {
    e.preventDefault();

    const companyValidationMessage = validateCompanyData();
    if (companyValidationMessage) {
      showAlert({ message: companyValidationMessage });
      return;
    }

    const paymentValidationMessage = validatePaymentData();
    if (paymentValidationMessage) {
      showAlert({ message: paymentValidationMessage });
      return;
    }

    setIsLoading({ company: true, payment: true });

    try {
      const token = localStorage.getItem('access_token');
      const companyId = await createCompany(token);
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...paymentData,
          userId: user.id,
          companyId,
          paymentDetail: getPaymentDetailPayload(),
          productInfo,
          extraInfo,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '결제 정보 등록에 실패했습니다.');

      showAlert({
        title: '등록 완료',
        message: '광고 정보가 등록되었습니다.',
        variant: 'success',
      });
      setFormData(initial_company_data);
      setPaymentData(initial_payment_data);
      setPaymentDetail(initial_payment_detail);
      setProductInfo(createInitialProductInfo(user));
      setExtraInfo(initial_extra_info);
    } catch (err) {
      console.error('Save payment error:', err);
      showAlert({
        title: '등록 실패',
        message: err.message,
        variant: 'danger',
      });
    } finally {
      setIsLoading({ company: false, payment: false });
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

  const handlePaymentMethodChange = value => {
    setPaymentData(prev => ({ ...prev, paymentMethod: value }));

    if (value !== '카드') {
      setPaymentDetail(prev => ({
        ...prev,
        cardCompany: '',
        installmentMonths: '',
        expiryMonth: '',
        expiryYear: '',
        cardNumber1: '',
        cardNumber2: '',
        cardNumber3: '',
        cardNumber4: '',
      }));
    }
  };

  const updateSegmentedCompanyField = (field, index, value, segments) => {
    setFormData(prev => {
      const parts = splitSegmentedValue(prev[field], segments);
      parts[index] = getDigits(value);
      return {
        ...prev,
        [field]: joinSegmentedValue(parts),
      };
    });
  };

  const addressSummary = [
    formData.postcode && `(${formData.postcode})`,
    formData.address,
    formData.detailAddress,
  ].filter(Boolean).join(' ');

  const teamLeadOptions = staffOptions.filter(staff => team_lead_levels.has(staff.level));
  const departmentHeadOptions = staffOptions.filter(staff => department_head_levels.has(staff.level));
  const orderedProductIndexes = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9];

  return (
    <section className="ad_detail_block">
      <section className="ad_section">
        <div className="ad_section_title">기본정보등록</div>
        <div className="ad_panel ad_basic_panel">
          <div className="ad_form_grid three ad_basic_grid">
            <AdField label="상호명">
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="대표자">
              <input
                type="text"
                value={formData.ceoName}
                onChange={e => setFormData(prev => ({ ...prev, ceoName: e.target.value }))}
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="사업자등록번호" className="segmented">
              <AdSegmentedInput
                value={formData.businessRegNumber}
                segments={business_number_segments}
                className="business"
                disabled={isLoading.company}
                onChange={(index, value) =>
                  updateSegmentedCompanyField('businessRegNumber', index, value, business_number_segments)
                }
              />
            </AdField>
            <AdField label="Tel" className="segmented">
              <AdSegmentedInput
                value={formData.tel}
                segments={tel_number_segments}
                disabled={isLoading.company}
                onChange={(index, value) =>
                  updateSegmentedCompanyField('tel', index, value, tel_number_segments)
                }
              />
            </AdField>
            <AdField label="Mobile" className="segmented">
              <AdSegmentedInput
                value={formData.mobile}
                segments={mobile_number_segments}
                disabled={isLoading.company}
                onChange={(index, value) =>
                  updateSegmentedCompanyField('mobile', index, value, mobile_number_segments)
                }
              />
            </AdField>
            <AdField label="업체 URL">
              <input
                type="url"
                value={formData.companyUrl}
                onChange={e => setFormData(prev => ({ ...prev, companyUrl: e.target.value }))}
                disabled={isLoading.company}
              />
            </AdField>
            <AdField label="주소" className="span_two compact_address">
              <div className="ad_compact_address_control">
                <input
                  type="text"
                  value={addressSummary}
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
                disabled={isLoading.company}
              />
            </AdField>
          </div>
        </div>
      </section>

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
                    popperClassName="date_select_calendar ad_contract_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderContractDateHeader}
                  />
                  <span>-</span>
                  <DatePicker
                    selected={paymentData.endDate}
                    onChange={date => setPaymentData(prev => ({ ...prev, endDate: date }))}
                    dateFormat="yyyy-MM-dd"
                    locale={ko}
                    placeholderText="종료일"
                    disabled={isLoading.payment}
                    popperClassName="date_select_calendar ad_contract_calendar"
                    showPopperArrow={false}
                    renderCustomHeader={renderContractDateHeader}
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
                  <option value="매출취소">매출취소</option>
                </select>
              </AdField>
              <AdField label="결제구분">
                <select
                  value={paymentData.paymentMethod}
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                  disabled={isLoading.payment}
                >
                  <option value="">선택</option>
                  <option value="카드">카드</option>
                  <option value="현금">현금</option>
                </select>
              </AdField>
              {paymentData.paymentMethod === '카드' && (
                <>
                  <AdField label="카드사">
                    <select
                      value={paymentDetail.cardCompany}
                      onChange={e => setPaymentDetail(prev => ({ ...prev, cardCompany: e.target.value }))}
                      disabled={isLoading.payment}
                    >
                      <option value="">선택</option>
                      {card_company_options.map(cardCompany => (
                        <option value={cardCompany} key={cardCompany}>{cardCompany}</option>
                      ))}
                    </select>
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
                      <option value="">선택</option>
                      {installment_month_options.map(month => (
                        <option value={month} key={month}>{month}</option>
                      ))}
                    </select>
                  </AdField>
                  <AdField label="카드번호" className="span_full segmented">
                    <AdSegmentedInput
                      value={card_number_keys.map(key => paymentDetail[key]).join('-')}
                      segments={card_number_segments}
                      className="card"
                      disabled={isLoading.payment}
                      onChange={(index, value) =>
                        setPaymentDetail(prev => ({ ...prev, [card_number_keys[index]]: value }))
                      }
                    />
                  </AdField>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      <section className="ad_section">
        <div className="ad_section_title">상품정보등록</div>
        <div className="ad_panel">
          <div className="ad_form_grid three compact">
            <AdField label="담당자">
              <input
                value={productInfo.manager}
                readOnly
              />
            </AdField>
            <AdField label="담당팀장">
              <select
                value={productInfo.teamLead}
                onChange={e => setProductInfo(prev => ({ ...prev, teamLead: e.target.value }))}
              >
                <option value="">없음</option>
                {teamLeadOptions.map(staff => (
                  <option value={staff.name} key={staff.id}>{staff.name}</option>
                ))}
              </select>
            </AdField>
            <AdField label="담당부장">
              <select
                value={productInfo.departmentHead}
                onChange={e => setProductInfo(prev => ({ ...prev, departmentHead: e.target.value }))}
              >
                <option value="">없음</option>
                {departmentHeadOptions.map(staff => (
                  <option value={staff.name} key={staff.id}>{staff.name}</option>
                ))}
              </select>
            </AdField>
            <AdField label="제작사항-1">
              <select
                value={productInfo.production1}
                onChange={e => setProductInfo(prev => ({ ...prev, production1: e.target.value }))}
              >
                <option value="">선택</option>
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
                <option value="">선택</option>
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
                <option value="">선택</option>
                <option value="OFF">OFF</option>
                <option value="ON">ON</option>
              </select>
            </AdField>
          </div>

          <div className="ad_products_grid">
            {orderedProductIndexes.map(index => (
              <AdField label={`상품${index + 1}`} key={`product_${index + 1}`}>
                <input
                  value={productInfo.products[index]}
                  onChange={e => updateProduct(index, e.target.value)}
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
              />
            </AdField>
            <AdField label="제목문구">
              <input
                value={extraInfo.titleText}
                onChange={e => setExtraInfo(prev => ({ ...prev, titleText: e.target.value }))}
              />
            </AdField>
            <AdField label="설명문구">
              <input
                value={extraInfo.descriptionText}
                onChange={e => setExtraInfo(prev => ({ ...prev, descriptionText: e.target.value }))}
              />
            </AdField>
            <AdField label="광고주계정">
              <input
                value={extraInfo.advertiserAccount}
                onChange={e => setExtraInfo(prev => ({ ...prev, advertiserAccount: e.target.value }))}
              />
            </AdField>
            <AdField label="비고">
              <input
                value={extraInfo.memo}
                onChange={e => setExtraInfo(prev => ({ ...prev, memo: e.target.value }))}
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

      <Modal
        show={alertModal.show}
        onHide={() => setAlertModal(prev => ({ ...prev, show: false }))}
        dialogClassName="ad_top_alert_dialog"
        contentClassName={`ad_top_alert_content ${alertModal.variant}`}
      >
        <Modal.Body>
          <strong>{alertModal.title}</strong>
          <p>{alertModal.message}</p>
          <button
            type="button"
            className="ad_primary_button"
            onClick={() => setAlertModal(prev => ({ ...prev, show: false }))}
          >
            확인
          </button>
        </Modal.Body>
      </Modal>
    </section>
  );
}

export default AdDetail;
