import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert, Accordion, Modal, InputGroup } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPostcodeModal, setShowPostcodeModal] = useState(false);

  // 회사 정보 저장 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // 유효성 검사
    if (!formData.companyName) {
      setError('상호명을 입력해주세요.');
      setIsLoading(false);
      return;
    }
    if (!formData.ceoName) {
      setError('대표자 이름을 입력해주세요.');
      setIsLoading(false);
      return;
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(formData.businessRegNumber)) {
      setError('사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)');
      setIsLoading(false);
      return;
    }
    if (!/^\d{6}$/.test(formData.birthDate)) {
      setError('생년월일은 6자리 숫자여야 합니다. (예: 991231)');
      setIsLoading(false);
      return;
    }
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formData.tel)) {
      setError('전화번호 형식이 올바르지 않습니다. (예: 02-1234-5678)');
      setIsLoading(false);
      return;
    }
    if (!/^\d{3}-\d{4}-\d{4}$/.test(formData.mobile)) {
      setError('휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
      setIsLoading(false);
      return;
    }
    if (!formData.postcode || !formData.address) {
      setError('주소를 검색하여 입력해주세요.');
      setIsLoading(false);
      return;
    }
    if (!formData.companyEmail.includes('@')) {
      setError('유효한 이메일 주소를 입력해주세요.');
      setIsLoading(false);
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
      setSuccess('회사 정보가 성공적으로 등록되었습니다.');
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
      setError(err.message);
    } finally {
      setIsLoading(false);
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
          <Accordion.Item eventKey="0">
            <Accordion.Header>기본정보등록</Accordion.Header>
            <Accordion.Body>
              <div className="company_formBox">
                  <Form onSubmit={handleSubmit}>
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
                      />
                    </InputGroup>
                    <div>
                      <InputGroup className="input_group_box">
                        <Form.Label>우편번호</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.postcode}
                          placeholder="우편번호"
                          className="signup_input"
                          readOnly
                          disabled={isLoading}
                        />
                        <Button
                          variant="outline-primary"
                          onClick={() => setShowPostcodeModal(true)}
                          disabled={isLoading}
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
                          disabled={isLoading}
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
                          disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
                      />
                    </InputGroup>
                    <div className="d-flex justify-content-end">
                      <Button
                        type="submit"
                        variant="success"
                        className="me-2"
                        disabled={isLoading}
                      >
                        {isLoading ? '저장 중...' : '저장'}
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
                        disabled={isLoading}
                      >
                        취소
                      </Button>
                    </div>
                    {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                    {success && <Alert variant="success" className="mt-3">{success}</Alert>}
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