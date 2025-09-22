import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Accordion, Modal, InputGroup } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import DaumPostcode from 'react-daum-postcode';
import './main.css';

function AdDetail({ user }) {
  const [formData, setFormData] = useState({
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
  });
  const [paymentData, setPaymentData] = useState({
    productName: '',
    startDate: null,
    endDate: null,
    approvedCompany: '(주)아이앤뷰커뮤니케이션',
    taxInvoice: '',
    paymentMethod: '',
  });
  const [error, setError] = useState({ company: '', payment: '' });
  const [success, setSuccess] = useState({ company: '', payment: '' });
  const [isLoading, setIsLoading] = useState({ company: false, payment: false });
  const [showPostcodeModal, setShowPostcodeModal] = useState(false);

  // 기본정보등록 저장 핸들러
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setError({ ...error, company: '' });
    setSuccess({ ...success, company: '' });
    setIsLoading({ ...isLoading, company: true });

    // 유효성 검사
    if (!formData.companyName) {
      setError({ ...error, company: '상호명을 입력해주세요.' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!formData.ceoName) {
      setError({ ...error, company: '대표자 이름을 입력해주세요.' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(formData.businessRegNumber)) {
      setError({ ...error, company: '사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!/^\d{6}$/.test(formData.birthDate)) {
      setError({ ...error, company: '생년월일은 6자리 숫자여야 합니다. (예: 991231)' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formData.tel)) {
      setError({ ...error, company: '전화번호 형식이 올바르지 않습니다. (예: 02-1234-5678)' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!/^\d{3}-\d{4}-\d{4}$/.test(formData.mobile)) {
      setError({ ...error, company: '휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!formData.postcode || !formData.address) {
      setError({ ...error, company: '주소를 검색하여 입력해주세요.' });
      setIsLoading({ ...isLoading, company: false });
      return;
    }
    if (!formData.companyEmail.includes('@')) {
      setError({ ...error, company: '유효한 이메일 주소를 입력해주세요.' });
      setIsLoading({ ...isLoading, company: false });
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
      setSuccess({ ...success, company: '회사 정보가 성공적으로 등록되었습니다.' });
      setFormData({
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
      });
    } catch (err) {
      console.error('Save company error:', err);
      setError({ ...error, company: err.message });
    } finally {
      setIsLoading({ ...isLoading, company: false });
    }
  };

  // 결제정보등록 저장 핸들러
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError({ ...error, payment: '' });
    setSuccess({ ...success, payment: '' });
    setIsLoading({ ...isLoading, payment: true });

    // 유효성 검사
    if (!paymentData.productName) {
      setError({ ...error, payment: '상품명을 선택해주세요.' });
      setIsLoading({ ...isLoading, payment: false });
      return;
    }
    if (!paymentData.startDate || !paymentData.endDate) {
      setError({ ...error, payment: '계약기간을 선택해주세요.' });
      setIsLoading({ ...isLoading, payment: false });
      return;
    }
    if (paymentData.endDate < paymentData.startDate) {
      setError({ ...error, payment: '종료일은 시작일보다 늦어야 합니다.' });
      setIsLoading({ ...isLoading, payment: false });
      return;
    }
    if (!paymentData.taxInvoice) {
      setError({ ...error, payment: '세금계산서 발행 여부를 선택해주세요.' });
      setIsLoading({ ...isLoading, payment: false });
      return;
    }
    if (!paymentData.paymentMethod) {
      setError({ ...error, payment: '결제구분을 선택해주세요.' });
      setIsLoading({ ...isLoading, payment: false });
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
      setSuccess({ ...success, payment: '결제 정보가 성공적으로 등록되었습니다.' });
      setPaymentData({
        productName: '',
        startDate: null,
        endDate: null,
        approvedCompany: '(주)아이앤뷰커뮤니케이션',
        taxInvoice: '',
        paymentMethod: '',
      });
    } catch (err) {
      console.error('Save payment error:', err);
      setError({ ...error, payment: err.message });
    } finally {
      setIsLoading({ ...isLoading, payment: false });
    }
  };

  // Daum 우편번호 검색 완료 핸들러
  const handleAddressComplete = (data) => {
    setFormData({
      ...formData,
      postcode: data.zonecode,
      address: data.address,
      detailAddress: '',
    });
    setShowPostcodeModal(false);
  };

  return (
    <section className="ad_detail_block">
      <Container>
        <Accordion defaultActiveKey="0">
          {/* 기본정보등록 섹션 */}
          <Accordion.Item eventKey="0">
            <Accordion.Header>기본정보등록</Accordion.Header>
            <Accordion.Body>
              <div className="company_formBox">
                <Form onSubmit={handleCompanySubmit}>
                  <InputGroup className="input_group_box">
                    <Form.Label>상호명</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      placeholder="상호명을 입력하세요"
                      className="signup_input"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>대표자</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.ceoName}
                      onChange={(e) =>
                        setFormData({ ...formData, ceoName: e.target.value })
                      }
                      placeholder="대표자 이름을 입력하세요"
                      className="signup_input"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>사업자등록번호</Form.Label>
                    <IMaskInput
                      mask="000-00-00000"
                      value={formData.businessRegNumber}
                      onAccept={(value) =>
                        setFormData({ ...formData, businessRegNumber: value })
                      }
                      placeholder="123-45-67890"
                      className="signup_input form-control"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>생년월일</Form.Label>
                    <IMaskInput
                      mask="000000"
                      value={formData.birthDate}
                      onAccept={(value) =>
                        setFormData({ ...formData, birthDate: value })
                      }
                      placeholder="991231"
                      className="signup_input form-control"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>전화번호 (TEL)</Form.Label>
                    <IMaskInput
                      mask="{00,000}-{000,0000}-0000"
                      value={formData.tel}
                      onAccept={(value) => setFormData({ ...formData, tel: value })}
                      placeholder="02-1234-5678"
                      className="signup_input form-control"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>휴대전화 (Mobile)</Form.Label>
                    <IMaskInput
                      mask="000-0000-0000"
                      value={formData.mobile}
                      onAccept={(value) => setFormData({ ...formData, mobile: value })}
                      placeholder="010-1234-5678"
                      className="signup_input form-control"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <div className="address_box">
                    <InputGroup className="input_group_box">
                      <Form.Label>우편번호</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.postcode}
                        placeholder="우편번호"
                        className="signup_input"
                        readOnly
                        disabled={isLoading.company}
                        onClick={() => !isLoading.company && setShowPostcodeModal(true)}
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => setShowPostcodeModal(true)}
                        disabled={isLoading.company}
                      >
                        검색
                      </Button>
                    </InputGroup>
                    <InputGroup className="input_group_box">
                      <Form.Label>기본주소</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.address}
                        placeholder="주소"
                        className="signup_input"
                        readOnly
                        disabled={isLoading.company}
                        onClick={() => !isLoading.company && setShowPostcodeModal(true)}
                      />
                    </InputGroup>
                    <InputGroup className="input_group_box">
                      <Form.Label>상세주소</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.detailAddress}
                        onChange={(e) =>
                          setFormData({ ...formData, detailAddress: e.target.value })
                        }
                        placeholder="상세주소를 입력하세요"
                        className="signup_input"
                        disabled={isLoading.company}
                      />
                    </InputGroup>
                  </div>
                  <InputGroup className="input_group_box">
                    <Form.Label>업체 URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={formData.companyUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, companyUrl: e.target.value })
                      }
                      placeholder="https://example.com"
                      className="signup_input"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>업체 Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, companyEmail: e.target.value })
                      }
                      placeholder="contact@example.com"
                      className="signup_input"
                      disabled={isLoading.company}
                    />
                  </InputGroup>
                  <div className="d-flex justify-content-end">
                    <Button
                      type="submit"
                      variant="success"
                      className="me-2"
                      disabled={isLoading.company}
                    >
                      {isLoading.company ? '저장 중...' : '저장'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setFormData({
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
                        })
                      }
                      disabled={isLoading.company}
                    >
                      취소
                    </Button>
                  </div>
                  {error.company && <Alert variant="danger" className="mt-3">{error.company}</Alert>}
                  {success.company && <Alert variant="success" className="mt-3">{success.company}</Alert>}
                </Form>
              </div>
            </Accordion.Body>
          </Accordion.Item>

          {/* 결제정보등록 섹션 */}
          <Accordion.Item eventKey="1">
            <Accordion.Header>결제정보등록</Accordion.Header>
            <Accordion.Body>
              <div className="company_formBox">
                <Form onSubmit={handlePaymentSubmit}>
                  <InputGroup className="input_group_box">
                    <Form.Label>상품명</Form.Label>
                    <Form.Select
                      value={paymentData.productName}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, productName: e.target.value })
                      }
                      className="signup_input"
                      disabled={isLoading.payment}
                    >
                      <option value="">선택하세요</option>
                      <option value="G패키지">G패키지</option>
                      <option value="N바이럴마케팅">N바이럴마케팅</option>
                      <option value="INVIEWCC패키지">INVIEWCC패키지</option>
                      <option value="SNS 페이지 기자단">SNS 페이지 기자단</option>
                      <option value="홈페이지 제작">홈페이지 제작</option>
                      <option value="모바일 홈페이지 제작">모바일 홈페이지 제작</option>
                      <option value="언론뉴스 송출">언론뉴스 송출</option>
                      <option value="온라인 광고 교육 패키지">온라인 광고 교육 패키지</option>
                      <option value="온라인 광고 환불대행">온라인 광고 환불대행</option>
                      <option value="블로그 마케팅">블로그 마케팅</option>
                      <option value="인플루언서 마케팅">인플루언서 마케팅</option>
                      <option value="GDN 패키지">GDN 패키지</option>
                      <option value="NAVER 대대행">NAVER 대대행</option>
                    </Form.Select>
                  </InputGroup>
                  <div className="input_group_box">
                    <InputGroup>
                      <Form.Label>계약기간 (시작)</Form.Label>
                      <div className='dataBox'>
                        <DatePicker
                          selected={paymentData.startDate}
                          onChange={(date) => setPaymentData({ ...paymentData, startDate: date })}
                          dateFormat="yyyy-MM-dd"
                          locale={ko}
                          placeholderText="시작일 선택"
                          className="signup_input"
                          disabled={isLoading.payment}
                        />
                        ~
                        <DatePicker
                          selected={paymentData.endDate}
                          onChange={(date) => setPaymentData({ ...paymentData, endDate: date })}
                          dateFormat="yyyy-MM-dd"
                          locale={ko}
                          placeholderText="종료일 선택"
                          className="signup_input"
                          disabled={isLoading.payment}
                        />
                      </div>
                    </InputGroup>
                  </div>
                  <InputGroup className="input_group_box">
                    <Form.Label>승인회사</Form.Label>
                    <Form.Control
                      type="text"
                      value={paymentData.approvedCompany}
                      readOnly
                      className="signup_input"
                      disabled={isLoading.payment}
                    />
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>세금계산서</Form.Label>
                    <Form.Select
                      value={paymentData.taxInvoice}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, taxInvoice: e.target.value })
                      }
                      className="signup_input"
                      disabled={isLoading.payment}
                    >
                      <option value="">선택하세요</option>
                      <option value="발행">발행</option>
                      <option value="미발행">미발행</option>
                    </Form.Select>
                  </InputGroup>
                  <InputGroup className="input_group_box">
                    <Form.Label>결제구분</Form.Label>
                    <Form.Select
                      value={paymentData.paymentMethod}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, paymentMethod: e.target.value })
                      }
                      className="signup_input"
                      disabled={isLoading.payment}
                    >
                      <option value="">선택하세요</option>
                      <option value="카드">카드</option>
                      <option value="현금">현금</option>
                    </Form.Select>
                  </InputGroup>
                  <div className="d-flex justify-content-end">
                    <Button
                      type="submit"
                      variant="success"
                      className="me-2"
                      disabled={isLoading.payment}
                    >
                      {isLoading.payment ? '저장 중...' : '저장'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setPaymentData({
                          productName: '',
                          startDate: null,
                          endDate: null,
                          approvedCompany: '(주)아이앤뷰커뮤니케이션',
                          taxInvoice: '',
                          paymentMethod: '',
                        })
                      }
                      disabled={isLoading.payment}
                    >
                      취소
                    </Button>
                  </div>
                  {error.payment && <Alert variant="danger" className="mt-3">{error.payment}</Alert>}
                  {success.payment && <Alert variant="success" className="mt-3">{success.payment}</Alert>}
                </Form>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {/* 우편번호 검색 모달 */}
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
            <Button
              variant="secondary"
              onClick={() => setShowPostcodeModal(false)}
            >
              닫기
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </section>
  );
}

export default AdDetail;