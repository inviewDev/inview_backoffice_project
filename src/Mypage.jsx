import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Col, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import './main.css';

moment.locale('ko');
const localizer = momentLocalizer(moment);

function MyPage({ user, setUser }) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhoneNumber, setIsEditingPhoneNumber] = useState(false);
  const [isEditingBirthDate, setIsEditingBirthDate] = useState(false);
  const [isEditingOfficePhoneNumber, setIsEditingOfficePhoneNumber] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    birthDate: user.birthDate && user.birthDate !== '미지정' ? new Date(user.birthDate) : null,
    officePhoneNumber: user.officePhoneNumber || '',
    password: '',
    passwordConfirm: '',
  });
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');
  const [editingMemo, setEditingMemo] = useState(null);
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', start: null, endTime: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMemoLoading, setIsMemoLoading] = useState(false);
  const [isEventLoading, setIsEventLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const memoRes = await fetch('/api/memos', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const memoData = await memoRes.json();
        if (memoRes.ok) {
          setMemos(
            memoData.map(memo => ({
              id: memo.id,
              content: memo.content,
              createdAt: new Date(memo.createdAt).toLocaleString('ko-KR'),
              updatedAt: new Date(memo.updatedAt).toLocaleString('ko-KR'),
            }))
          );
        }
        const eventRes = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const eventData = await eventRes.json();
        if (eventRes.ok) {
          setEvents(
            eventData.map(event => ({
              id: event.id,
              title: event.title,
              start: new Date(event.start),
              endTime: new Date(event.endTime),
            }))
          );
        }
      } catch (err) {
        console.error('Fetch data error:', err);
        setError('데이터를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdateField = async (field, value) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    const phoneRegex = /^\d{3}-\d{4}-\d{4}$/;
    const officePhoneRegex = /^\d{2}-\d{4}-\d{4}$/;

    if (field === 'phoneNumber' && value && !phoneRegex.test(value)) {
      setError('휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
      setIsLoading(false);
      return;
    }
    if (field === 'officePhoneNumber' && value && !officePhoneRegex.test(value)) {
      setError('사내전화번호 형식이 올바르지 않습니다. (예: 02-1234-1234 또는 02-123-1234)');
      setIsLoading(false);
      return;
    }
    if (field === 'birthDate' && value && isNaN(value)) {
      setError('유효한 생년월일을 선택해주세요.');
      setIsLoading(false);
      return;
    }
    if (field === 'password' && formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }
    if (field === 'password' && formData.password && (formData.password.length < 8 || !/[!@#$%^&*]/.test(formData.password))) {
      setError('비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.');
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const dataToSend = {};
      if (field === 'email') dataToSend.email = value;
      if (field === 'phoneNumber') dataToSend.phoneNumber = value;
      if (field === 'birthDate') dataToSend.birthDate = value ? value.toISOString().split('T')[0] : null;
      if (field === 'officePhoneNumber') dataToSend.officePhoneNumber = value || null;
      if (field === 'password') dataToSend.password = formData.password;

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '사용자 정보 수정에 실패했습니다.');
      setUser(prev => ({
        ...prev,
        email: data.user.email,
        phoneNumber: data.user.phoneNumber,
        birthDate: data.user.birthDate,
        officePhoneNumber: data.user.officePhoneNumber,
      }));
      setFormData(prev => ({
        ...prev,
        email: data.user.email,
        phoneNumber: data.user.phoneNumber,
        birthDate: data.user.birthDate && data.user.birthDate !== '미지정' ? new Date(data.user.birthDate) : null,
        officePhoneNumber: data.user.officePhoneNumber || '',
        password: '',
        passwordConfirm: '',
      }));
      setSuccess('사용자 정보가 수정되었습니다.');
      setIsEditingEmail(false);
      setIsEditingPhoneNumber(false);
      setIsEditingBirthDate(false);
      setIsEditingOfficePhoneNumber(false);
      setIsEditingPassword(false);
    } catch (err) {
      console.error(`Update ${field} error:`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMemo = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsMemoLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMemo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메모 저장에 실패했습니다.');
      setMemos(prev => [
        {
          id: data.memo.id,
          content: data.memo.content,
          createdAt: new Date(data.memo.createdAt).toLocaleString('ko-KR'),
          updatedAt: new Date(data.memo.updatedAt).toLocaleString('ko-KR'),
        },
        ...prev,
      ]);
      setNewMemo('');
      setSuccess('메모가 저장되었습니다.');
    } catch (err) {
      console.error('Save memo error:', err);
      setError(err.message);
    } finally {
      setIsMemoLoading(false);
    }
  };

  const handleEditMemo = async (id, content) => {
    setError('');
    setSuccess('');
    setIsMemoLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/memos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메모 수정에 실패했습니다.');
      setMemos(prev =>
        prev.map(memo =>
          memo.id === id
            ? {
                ...memo,
                content: data.memo.content,
                updatedAt: new Date(data.memo.updatedAt).toLocaleString('ko-KR'),
              }
            : memo
        )
      );
      setEditingMemo(null);
      setSuccess('메모가 수정되었습니다.');
    } catch (err) {
      console.error('Update memo error:', err);
      setError(err.message);
    } finally {
      setIsMemoLoading(false);
    }
  };

  const handleDeleteMemo = async id => {
    setError('');
    setSuccess('');
    setIsMemoLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/memos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메모 삭제에 실패했습니다.');
      setMemos(prev => prev.filter(memo => memo.id !== id));
      setSuccess('메모가 삭제되었습니다.');
    } catch (err) {
      console.error('Delete memo error:', err);
      setError(err.message);
    } finally {
      setIsMemoLoading(false);
    }
  };

  const handleAddEvent = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsEventLoading(true);

    if (!newEvent.title || !newEvent.start || !newEvent.endTime) {
      setError('이벤트 제목, 시작 시간, 종료 시간을 입력해주세요.');
      setIsEventLoading(false);
      return;
    }
    if (newEvent.start >= newEvent.endTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      setIsEventLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newEvent.title,
          start: newEvent.start.toISOString(),
          endTime: newEvent.endTime.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '이벤트 추가에 실패했습니다.');
      setEvents(prev => [
        ...prev,
        {
          id: data.id,
          title: data.title,
          start: new Date(data.start),
          endTime: new Date(data.endTime),
        },
      ]);
      setNewEvent({ title: '', start: null, endTime: null });
      setSuccess('이벤트가 추가되었습니다.');
    } catch (err) {
      console.error('Add event error:', err);
      setError(err.message);
    } finally {
      setIsEventLoading(false);
    }
  };

  const handleDeleteEvent = async eventId => {
    setError('');
    setSuccess('');
    setIsEventLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '이벤트 삭제에 실패했습니다.');
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setSuccess('이벤트가 삭제되었습니다.');
    } catch (err) {
      console.error('Delete event error:', err);
      setError(err.message);
    } finally {
      setIsEventLoading(false);
    }
  };

  const memoColumns = [
    {
      accessorKey: 'content',
      header: '내용',
      cell: ({ row }) => row.original.content,
    },
    {
      accessorKey: 'createdAt',
      header: '등록일',
      cell: ({ row }) => row.original.createdAt,
    },
    {
      accessorKey: 'updatedAt',
      header: '수정일',
      cell: ({ row }) => row.original.updatedAt,
    },
    {
      id: 'actions',
      header: '작업',
      cell: ({ row }) => (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEditingMemo({ id: row.original.id, content: row.original.content })}
            disabled={isMemoLoading}
          >
            수정
          </Button>{' '}
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm('이 메모를 삭제하시겠습니까?')) {
                handleDeleteMemo(row.original.id);
              }
            }}
            disabled={isMemoLoading}
          >
            삭제
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: memos,
    columns: memoColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <section className="mypage_block">
      <Container>
        <div className="mypage_contBox row g-4">
          <Col md={6}>
            <Card className="user_infoBox">
              <Card.Body>
                <Card.Title>{user.name}님의 마이페이지</Card.Title>
                <ListGroup variant="flush">
                  <ListGroup.Item><strong>이름:</strong> {user.name}</ListGroup.Item>
                  <ListGroup.Item><strong>직급:</strong> {user.level}</ListGroup.Item>
                  <ListGroup.Item><strong>팀:</strong> {user.team}</ListGroup.Item>
                  <ListGroup.Item><strong>부서:</strong> {user.department}</ListGroup.Item>
                  <ListGroup.Item>
                    <strong>이메일:</strong>{' '}
                    {isEditingEmail ? (
                      <Form
                        onSubmit={e => {
                          e.preventDefault();
                          handleUpdateField('email', formData.email);
                        }}
                        className="d-flex align-items-center"
                      >
                        <Form.Control
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          className="signup_input me-2"
                          required
                          disabled={isLoading}
                        />
                        <Button type="submit" variant="success" size="sm" disabled={isLoading}>
                          저장
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setFormData({ ...formData, email: user.email });
                            setIsEditingEmail(false);
                          }}
                          disabled={isLoading}
                        >
                          취소
                        </Button>
                      </Form>
                    ) : (
                      <>
                        {user.email}{' '}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setIsEditingEmail(true)}
                        >
                          편집
                        </Button>
                      </>
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>휴대전화번호:</strong>{' '}
                    {isEditingPhoneNumber ? (
                      <Form
                        onSubmit={e => {
                          e.preventDefault();
                          handleUpdateField('phoneNumber', formData.phoneNumber);
                        }}
                        className="d-flex align-items-center"
                      >
                        <IMaskInput
                          mask="000-0000-0000"
                          value={formData.phoneNumber}
                          onAccept={value => setFormData({ ...formData, phoneNumber: value })}
                          placeholder="010-1234-5678"
                          className="signup_input form-control me-2"
                          required
                          disabled={isLoading}
                        />
                        <Button type="submit" variant="success" size="sm" disabled={isLoading}>
                          저장
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setFormData({ ...formData, phoneNumber: user.phoneNumber });
                            setIsEditingPhoneNumber(false);
                          }}
                          disabled={isLoading}
                        >
                          취소
                        </Button>
                      </Form>
                    ) : (
                      <>
                        {user.phoneNumber}{' '}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setIsEditingPhoneNumber(true)}
                        >
                          편집
                        </Button>
                      </>
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>생년월일:</strong>{' '}
                    {isEditingBirthDate ? (
                      <Form
                        onSubmit={e => {
                          e.preventDefault();
                          handleUpdateField('birthDate', formData.birthDate);
                        }}
                        className="d-flex align-items-center"
                      >
                        <DatePicker
                          selected={formData.birthDate}
                          onChange={date => setFormData({ ...formData, birthDate: date })}
                          locale={ko}
                          dateFormat="yyyy-MM-dd"
                          placeholderText="생년월일을 선택하세요"
                          className="signup_input me-2"
                          required
                          disabled={isLoading}
                          minDate={new Date(1900, 0, 1)}
                          maxDate={new Date()}
                          showYearDropdown
                          scrollableYearDropdown
                          yearDropdownItemNumber={100}
                        />
                        <Button type="submit" variant="success" size="sm" disabled={isLoading}>
                          저장
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              birthDate:
                                user.birthDate && user.birthDate !== '미지정'
                                  ? new Date(user.birthDate)
                                  : null,
                            });
                            setIsEditingBirthDate(false);
                          }}
                          disabled={isLoading}
                        >
                          취소
                        </Button>
                      </Form>
                    ) : (
                      <>
                        {user.birthDate && user.birthDate !== '미지정'
                          ? new Date(user.birthDate).toLocaleDateString('ko-KR')
                          : '미지정'}{' '}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setIsEditingBirthDate(true)}
                        >
                          편집
                        </Button>
                      </>
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>사내전화번호:</strong>{' '}
                    {isEditingOfficePhoneNumber ? (
                      <Form
                        onSubmit={e => {
                          e.preventDefault();
                          handleUpdateField('officePhoneNumber', formData.officePhoneNumber);
                        }}
                        className="d-flex align-items-center"
                      >
                        <IMaskInput
                          mask="00-0000-0000"
                          value={formData.officePhoneNumber}
                          onAccept={value => setFormData({ ...formData, officePhoneNumber: value })}
                          placeholder="02-1234-1234"
                          className="signup_input form-control me-2"
                          disabled={isLoading}
                        />
                        <Button type="submit" variant="success" size="sm" disabled={isLoading}>
                          저장
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setFormData({ ...formData, officePhoneNumber: user.officePhoneNumber || '' });
                            setIsEditingOfficePhoneNumber(false);
                          }}
                          disabled={isLoading}
                        >
                          취소
                        </Button>
                      </Form>
                    ) : (
                      <>
                        {user.officePhoneNumber || '미지정'}{' '}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setIsEditingOfficePhoneNumber(true)}
                        >
                          편집
                        </Button>
                      </>
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>비밀번호 변경:</strong>{' '}
                    {isEditingPassword ? (
                      <Form
                        onSubmit={e => {
                          e.preventDefault();
                          handleUpdateField('password', formData.password);
                        }}
                        className="d-flex align-items-center"
                      >
                        <Form.Control
                          type="password"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          placeholder="새 비밀번호"
                          className="signup_input me-2"
                          disabled={isLoading}
                        />
                        <Form.Control
                          type="password"
                          value={formData.passwordConfirm}
                          onChange={e => setFormData({ ...formData, passwordConfirm: e.target.value })}
                          placeholder="비밀번호 확인"
                          className="signup_input me-2"
                          disabled={isLoading}
                        />
                        <Button type="submit" variant="success" size="sm" disabled={isLoading}>
                          저장
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setFormData({ ...formData, password: '', passwordConfirm: '' });
                            setIsEditingPassword(false);
                          }}
                          disabled={isLoading}
                        >
                          취소
                        </Button>
                      </Form>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setIsEditingPassword(true)}
                      >
                        편집
                      </Button>
                    )}
                  </ListGroup.Item>
                </ListGroup>
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                {success && <Alert variant="success" className="mt-3">{success}</Alert>}
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="memo_infoBox">
              <Card.Body>
                <Card.Title>개인메모</Card.Title>
                <Form onSubmit={handleSaveMemo}>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    value={newMemo}
                    onChange={e => setNewMemo(e.target.value)}
                    placeholder="새 메모를 입력하세요"
                    className="signup_input"
                    disabled={isMemoLoading}
                  />
                  <Button
                    type="submit"
                    variant="success"
                    className="mt-2"
                    disabled={isMemoLoading}
                  >
                    {isMemoLoading ? '저장 중...' : '메모 저장'}
                  </Button>
                </Form>
                {editingMemo && (
                  <Form
                    onSubmit={e => {
                      e.preventDefault();
                      handleEditMemo(editingMemo.id, editingMemo.content);
                    }}
                    className="mt-3"
                  >
                    <Form.Control
                      as="textarea"
                      rows={5}
                      value={editingMemo.content}
                      onChange={e => setEditingMemo({ ...editingMemo, content: e.target.value })}
                      placeholder="메모 수정"
                      className="signup_input"
                      disabled={isMemoLoading}
                    />
                    <Button
                      type="submit"
                      variant="success"
                      className="mt-2"
                      disabled={isMemoLoading}
                    >
                      {isMemoLoading ? '수정 중...' : '메모 수정'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="mt-2 ms-2"
                      onClick={() => setEditingMemo(null)}
                      disabled={isMemoLoading}
                    >
                      취소
                    </Button>
                  </Form>
                )}
                <div className="mt-3">
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        {table.getHeaderGroups().map(headerGroup => (
                          headerGroup.headers.map(header => (
                            <th key={header.id}>{header.column.columnDef.header}</th>
                          ))
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map(row => (
                          <tr key={row.id}>
                            {row.getVisibleCells().map(cell => (
                              <td key={cell.id}>
                                {cell.column.columnDef.cell
                                  ? cell.column.columnDef.cell({ row: cell.row, column: cell.column })
                                  : cell.getValue()}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={memoColumns.length} className="text-center">
                            저장된 메모가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
            <Card className="calendar_infoBox mt-4">
              <Card.Body>
                <Card.Title>캘린더</Card.Title>
                <Form onSubmit={handleAddEvent} className="mb-3">
                  <Form.Group className="mb-2">
                    <Form.Label>이벤트 제목</Form.Label>
                    <Form.Control
                      type="text"
                      value={newEvent.title}
                      onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                      placeholder="이벤트 제목"
                      className="signup_input"
                      disabled={isEventLoading}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>시작 시간</Form.Label>
                    <DatePicker
                      selected={newEvent.start}
                      onChange={date => setNewEvent({ ...newEvent, start: date })}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      placeholderText="시작 시간"
                      locale={ko}
                      className="signup_input"
                      disabled={isEventLoading}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label>종료 시간</Form.Label>
                    <DatePicker
                      selected={newEvent.endTime}
                      onChange={date => setNewEvent({ ...newEvent, endTime: date })}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      placeholderText="종료 시간"
                      locale={ko}
                      className="signup_input"
                      disabled={isEventLoading}
                    />
                  </Form.Group>
                  <Button
                    type="submit"
                    variant="success"
                    disabled={isEventLoading}
                  >
                    {isEventLoading ? '추가 중...' : '이벤트 추가'}
                  </Button>
                </Form>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="endTime"
                  style={{ height: 400 }}
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
                  onSelectEvent={event => {
                    if (window.confirm(`이벤트 "${event.title}"를 삭제하시겠습니까?`)) {
                      handleDeleteEvent(event.id);
                    }
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

export default MyPage;