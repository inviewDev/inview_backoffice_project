import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Col, Spinner, Form, Button, Alert } from 'react-bootstrap';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('ko');
const localizer = momentLocalizer(moment);

const events = [
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

function Dashboard({ user, setUser }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [officePhoneNumber, setOfficePhoneNumber] = useState(user.officePhoneNumber || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEditOfficePhone = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/users/${user.id}/officePhoneNumber`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ officePhoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '사내전화번호 수정에 실패했습니다.');
      setUser({
        ...user,
        officePhoneNumber: data.user.officePhoneNumber || '미지정',
      });
      setSuccess(data.message);
      setIsEditing(false);
    } catch (err) {
      console.error('Edit officePhoneNumber error:', err);
      setError(err.message);
    }
  };

  if (!user || !user.email || !user.role || !user.name) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p>사용자 정보를 불러오는 중...</p>
      </Container>
    );
  }

  const formattedDate = currentTime.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const formattedTime = currentTime.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
  const formattedBirthDate = user.birthDate !== '미지정' ? new Date(user.birthDate).toLocaleDateString('ko-KR') : '미지정';

  return (
    <section className="dashboard_block">
      <Container>
        <div className="dash_contBox">
          <Col md={4}>
            <Card className="user_infoBox">
              <Card.Body>
                <Card.Title>{user.name}님 환영합니다!</Card.Title>
                <Card.Text>아이앤뷰 백오피스 시스템에 오신 것을 환영합니다.</Card.Text>
                <ListGroup variant="flush">
                  <ListGroup.Item><strong>직급:</strong> {user.level || '미지정'}</ListGroup.Item>
                  <ListGroup.Item><strong>팀:</strong> {user.team || '미지정'}</ListGroup.Item>
                  <ListGroup.Item><strong>부서:</strong> {user.department || '미지정'}</ListGroup.Item>
                  <ListGroup.Item><strong>권한:</strong> {user.role}</ListGroup.Item>
                  <ListGroup.Item><strong>휴대전화번호:</strong> {user.phoneNumber || '미지정'}</ListGroup.Item>
                  <ListGroup.Item><strong>생년월일:</strong> {formattedBirthDate}</ListGroup.Item>
                  <ListGroup.Item>
                    <strong>사내전화번호:</strong>{' '}
                    {isEditing ? (
                      <Form onSubmit={handleEditOfficePhone} className="d-inline">
                        <Form.Control
                          type="tel"
                          value={officePhoneNumber}
                          onChange={e => setOfficePhoneNumber(e.target.value)}
                          pattern="[0-9]{3}-[0-9]{4}-[0-9]{4}"
                          placeholder="02-1234-5678"
                          className="d-inline-block w-auto"
                        />
                        <Button type="submit" variant="success" size="sm" className="ms-2">저장</Button>
                        <Button variant="secondary" size="sm" className="ms-2" onClick={() => setIsEditing(false)}>취소</Button>
                      </Form>
                    ) : (
                      <>
                        {user.officePhoneNumber || '미지정'}{' '}
                        <Button variant="link" size="sm" onClick={() => setIsEditing(true)}>편집</Button>
                      </>
                    )}
                  </ListGroup.Item>
                </ListGroup>
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                {success && <Alert variant="success" className="mt-3">{success}</Alert>}
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="time_infoBox">
              <Card.Body>
                <Card.Text>
                  <strong>날짜:</strong> {formattedDate}<br />
                  <strong>시간:</strong> {formattedTime}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="Calendar_infoBox">
              <Card.Body>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: 300 }}
                  defaultView="month"
                  views={['month', 'week', 'day']}
                  messages={{
                    today: '오늘',
                    previous: '이전',
                    next: '다음',
                    month: '월',
                    week: '주',
                    day: '일',
                  }}
                />
              </Card.Body>
            </Card>
          </Col>
        </div>
      </Container>
    </section>
  );
}

export default Dashboard;