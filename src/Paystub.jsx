import React, { useState, useEffect } from 'react';
import { Container, Accordion, Table, Alert, Spinner } from 'react-bootstrap';
import './main.css';

function Paystub({ user }) {
  const [payrollData, setPayrollData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayroll = async () => {
      setIsLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('로그인이 필요합니다.');
        }
        const res = await fetch(`/api/payroll?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '급여 명세서 조회에 실패했습니다.');
        }
        setPayrollData(data);
      } catch (err) {
        console.error('Fetch payroll error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && user.id) {
      fetchPayroll();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p>급여 명세서 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!payrollData) {
    return <Alert variant="info">급여 명세서 데이터가 없습니다.</Alert>;
  }

  const { periodStart, periodEnd, department, team, commissionRates, salesDetails, cancellationDetails, settlement } = payrollData;

  return (
    <section className="paystub_block">
      <Container>
        <Accordion defaultActiveKey="0">
          {/* 1. 매출기간 */}
          <Accordion.Item eventKey="0">
            <Accordion.Header>1. 매출기간</Accordion.Header>
            <Accordion.Body>
              <p>매출기간: {periodStart} ~ {periodEnd}</p>
              <p>부서: {department}</p>
              <p>팀: {team}</p>
              <p>담당자: {user.name}</p>
              <p>수수료 기준 총 매출</p>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>수수료 비율</th>
                    <th>영업지원금</th>
                    <th>프로모션</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionRates.map((rate, index) => (
                    <tr key={index}>
                      <td>{rate.rate}</td>
                      <td>{rate.support}</td>
                      <td>{rate.promotion}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>

          {/* 2. 매출현황 */}
          <Accordion.Item eventKey="1">
            <Accordion.Header>2. 매출현황</Accordion.Header>
            <Accordion.Body>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>매출현황</th>
                    <th>등록일</th>
                    <th>상품</th>
                    <th>승인금액</th>
                    <th>vat제외매출</th>
                    <th>실비</th>
                    <th>안전자금</th>
                    <th>수당기준액</th>
                    <th>영업수당</th>
                  </tr>
                </thead>
                <tbody>
                  {salesDetails.map((detail, index) => (
                    <tr key={index}>
                      <td>{detail.status}</td>
                      <td>{detail.registrationDate}</td>
                      <td>{detail.product}</td>
                      <td>{detail.approvedAmount}</td>
                      <td>{detail.vatExcludedSales}</td>
                      <td>{detail.actualCost}</td>
                      <td>{detail.safetyFund}</td>
                      <td>{detail.allowanceBase}</td>
                      <td>{detail.salesAllowance}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>총 합 계</td>
                    <td colSpan="2"></td>
                    <td>{payrollData.totalApprovedAmount}</td>
                    <td>{payrollData.totalVatExcluded}</td>
                    <td>{payrollData.totalActualCost}</td>
                    <td>{payrollData.totalSafetyFund}</td>
                    <td>{payrollData.totalAllowanceBase}</td>
                    <td>{payrollData.totalSalesAllowance}</td>
                  </tr>
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>

          {/* 3. 취소현황 */}
          <Accordion.Item eventKey="2">
            <Accordion.Header>3. 취소현황</Accordion.Header>
            <Accordion.Body>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>매출현황</th>
                    <th>등록일</th>
                    <th>상품</th>
                    <th>취소금액</th>
                    <th>부가세</th>
                    <th>매출 취소 기준액</th>
                    <th></th>
                    <th>안전자금</th>
                    <th>취소수당</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellationDetails.map((detail, index) => (
                    <tr key={index}>
                      <td>{detail.status}</td>
                      <td>{detail.registrationDate}</td>
                      <td>{detail.product}</td>
                      <td>{detail.cancellationAmount}</td>
                      <td>{detail.vat}</td>
                      <td>{detail.cancellationBase}</td>
                      <td></td>
                      <td>{detail.safetyFund}</td>
                      <td>{detail.cancellationAllowance}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>취 소 계</td>
                    <td colSpan="2"></td>
                    <td>{payrollData.totalCancellationAmount}</td>
                    <td>{payrollData.totalVat}</td>
                    <td>{payrollData.totalCancellationBase}</td>
                    <td></td>
                    <td>{payrollData.totalSafetyFundCancellation}</td>
                    <td>{payrollData.totalCancellationAllowance}</td>
                  </tr>
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>

          {/* 4. 수수료 정산 */}
          <Accordion.Item eventKey="3">
            <Accordion.Header>4. 수수료 정산</Accordion.Header>
            <Accordion.Body>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>영업지원금</th>
                    <th>수당</th>
                    <th>매출 취소</th>
                    <th>소 계</th>
                    <th>세금</th>
                    <th>교육비</th>
                    <th>교육식비</th>
                    <th>실수령액</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{payrollData.commissionSupport}</td>
                    <td>{payrollData.allowance}</td>
                    <td>{payrollData.totalCancellationAmount}</td>
                    <td>{payrollData.subTotal}</td>
                    <td>{payrollData.tax}</td>
                    <td>{payrollData.educationFee}</td>
                    <td>{payrollData.mealFee}</td>
                    <td>{payrollData.netIncome}</td>
                  </tr>
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Container>
    </section>
  );
}

export default Paystub;