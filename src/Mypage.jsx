import { useState, useEffect } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import DateSelectPicker from './components/DateSelectPicker';
import './styles/mypage.css';

moment.locale('ko');
const localizer = momentLocalizer(moment);
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const current_year = new Date().getFullYear();
const mypage_calendar_year_options = Array.from({ length: 16 }, (_, index) => current_year - 5 + index);

function pad(value) {
  return String(value).padStart(2, '0');
}

function renderMypageDateHeader({ date, changeYear, changeMonth }) {
  return (
    <div className="date_select_header mypage_calendar_date_header">
      <select
        value={date.getFullYear()}
        onChange={event => changeYear(Number(event.target.value))}
        aria-label="일정 연도"
      >
        {mypage_calendar_year_options.map(year => (
          <option value={year} key={year}>{year}년</option>
        ))}
      </select>
      <select
        value={date.getMonth()}
        onChange={event => changeMonth(Number(event.target.value))}
        aria-label="일정 월"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <option value={index} key={index}>{pad(index + 1)}월</option>
        ))}
      </select>
    </div>
  );
}

async function parseApiResponse(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function MyPage({ user, setUser }) {
  const [isEditingLoginId, setIsEditingLoginId] = useState(false);
  const [isEditingPhoneNumber, setIsEditingPhoneNumber] = useState(false);
  const [isEditingBirthDate, setIsEditingBirthDate] = useState(false);
  const [isEditingOfficePhoneNumber, setIsEditingOfficePhoneNumber] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [formData, setFormData] = useState({
    loginId: user.email || '',
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
  const [isProfileImageLoading, setIsProfileImageLoading] = useState(false);

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
    const officePhoneRegex = /^\d{2,3}-\d{3,4}-\d{4}$/;

    if (field === 'loginId' && !/^[A-Za-z0-9]+$/.test(value)) {
      setError('아이디는 영문과 숫자만 사용할 수 있습니다.');
      setIsLoading(false);
      return;
    }
    if (field === 'phoneNumber' && value && !phoneRegex.test(value)) {
      setError('휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
      setIsLoading(false);
      return;
    }
    if (field === 'officePhoneNumber' && value && !officePhoneRegex.test(value)) {
      setError('사내전화번호 형식이 올바르지 않습니다. (예: 02-1234-1234, 070-1234-5678)');
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
      if (field === 'loginId') dataToSend.loginId = value.trim();
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
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || '사용자 정보 수정에 실패했습니다.');
      setUser(prev => ({
        ...prev,
        email: data.user.email,
        phoneNumber: data.user.phoneNumber,
        birthDate: data.user.birthDate,
        officePhoneNumber: data.user.officePhoneNumber,
        profileImage: data.user.profileImage || '',
      }));
      setFormData(prev => ({
        ...prev,
        loginId: data.user.email,
        phoneNumber: data.user.phoneNumber,
        birthDate: data.user.birthDate && data.user.birthDate !== '미지정' ? new Date(data.user.birthDate) : null,
        officePhoneNumber: data.user.officePhoneNumber || '',
        password: '',
        passwordConfirm: '',
      }));
      setSuccess('사용자 정보가 수정되었습니다.');
      setIsEditingLoginId(false);
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

  const handleUpdateProfileImage = async profileImage => {
    setError('');
    setSuccess('');
    setIsProfileImageLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profileImage }),
      });
      const data = await parseApiResponse(res);

      if (!res.ok) {
        throw new Error(data.error || '프로필 사진 저장에 실패했습니다.');
      }

      setUser(prev => ({
        ...prev,
        profileImage: data.user.profileImage || '',
      }));
      setSuccess(profileImage ? '프로필 사진이 등록되었습니다.' : '프로필 사진이 삭제되었습니다.');
    } catch (err) {
      console.error('Update profile image error:', err);
      setError(err.message);
    } finally {
      setIsProfileImageLoading(false);
    }
  };

  const handleProfileImageChange = e => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    setError('');
    setSuccess('');

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setError('프로필 사진은 JPG, PNG, WEBP, GIF 파일만 등록할 수 있습니다.');
      return;
    }

    if (file.size >= MAX_PROFILE_IMAGE_SIZE) {
      setError('프로필 사진은 2MB 미만 파일만 등록할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleUpdateProfileImage(reader.result);
    };
    reader.onerror = () => {
      setError('프로필 사진을 읽지 못했습니다.');
    };
    reader.readAsDataURL(file);
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
        <div className="mypage_table_actions">
          <button
            type="button"
            className="mypage_text_button"
            onClick={() => setEditingMemo({ id: row.original.id, content: row.original.content })}
            disabled={isMemoLoading}
          >
            수정
          </button>
          <button
            type="button"
            className="mypage_text_button danger"
            onClick={() => {
              if (window.confirm('이 메모를 삭제하시겠습니까?')) {
                handleDeleteMemo(row.original.id);
              }
            }}
            disabled={isMemoLoading}
          >
            삭제
          </button>
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
      <div className="admin_loading">
        <Spinner animation="border" variant="primary" />
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <section className="mypage_block">
      <div className="mypage_header">
        <div>
          <h1>마이페이지</h1>
          <p>{user.name}님의 계정 정보와 개인 업무 일정을 관리합니다.</p>
        </div>
        <div className="mypage_user_badge">
          <span>{user.team || '미지정'}</span>
          <strong>{user.level || '미지정'}</strong>
        </div>
      </div>

      {(error || success) && (
        <div className="mypage_message_area">
          {error && <Alert variant="danger" className="mypage_alert">{error}</Alert>}
          {success && <Alert variant="success" className="mypage_alert">{success}</Alert>}
        </div>
      )}

      <div className="mypage_grid">
        <section className="mypage_panel mypage_profile_panel">
          <div className="mypage_panel_head">
            <h2>내 정보</h2>
          </div>

          <div className="mypage_profile_summary">
            <div className="mypage_avatar_area">
              <label className={`mypage_avatar ${user.profileImage ? 'has_image' : ''}`}>
                {user.profileImage ? (
                  <img src={user.profileImage} alt={`${user.name} 프로필 사진`} />
                ) : (
                  <span>{user.name?.slice(0, 1) || 'I'}</span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleProfileImageChange}
                  disabled={isProfileImageLoading}
                />
                <em>{isProfileImageLoading ? '등록 중' : '사진 등록'}</em>
              </label>
              {user.profileImage && (
                <button
                  type="button"
                  className="mypage_avatar_remove"
                  onClick={() => handleUpdateProfileImage(null)}
                  disabled={isProfileImageLoading}
                >
                  삭제
                </button>
              )}
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.department || '미지정'} / {user.role || '미지정'}</span>
            </div>
          </div>

          <div className="mypage_info_table">
            <div className="mypage_info_row">
              <strong>이름</strong>
              <span>{user.name}</span>
            </div>
            <div className="mypage_info_row">
              <strong>직급</strong>
              <span>{user.level}</span>
            </div>
            <div className="mypage_info_row">
              <strong>팀</strong>
              <span>{user.team}</span>
            </div>
            <div className="mypage_info_row">
              <strong>부서</strong>
              <span>{user.department}</span>
            </div>
            <div className="mypage_info_row">
              <strong>권한</strong>
              <span>{user.role}</span>
            </div>
            <div className="mypage_info_row editable">
              <strong>아이디</strong>
              {isEditingLoginId ? (
                <form
                  className="mypage_inline_form"
                  onSubmit={e => {
                    e.preventDefault();
                    handleUpdateField('loginId', formData.loginId);
                  }}
                >
                  <input
                    type="text"
                    value={formData.loginId}
                    onChange={e => setFormData({
                      ...formData,
                      loginId: e.target.value.replace(/[^A-Za-z0-9]/g, ''),
                    })}
                    className="mypage_input"
                    placeholder="아이디(영문/숫자)"
                    aria-label="아이디"
                    pattern="[A-Za-z0-9]+"
                    title="아이디는 영문과 숫자만 사용할 수 있습니다."
                    autoComplete="username"
                    required
                    disabled={isLoading}
                  />
                  <div className="mypage_form_actions">
                    <button type="submit" className="mypage_primary_button" disabled={isLoading}>저장</button>
                    <button
                      type="button"
                      className="mypage_secondary_button"
                      onClick={() => {
                        setFormData({ ...formData, loginId: user.email });
                        setIsEditingLoginId(false);
                      }}
                      disabled={isLoading}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <span>
                  {user.email}
                  <button type="button" className="mypage_edit_button" onClick={() => setIsEditingLoginId(true)}>편집</button>
                </span>
              )}
            </div>
            <div className="mypage_info_row editable">
              <strong>휴대전화번호</strong>
              {isEditingPhoneNumber ? (
                <form
                  className="mypage_inline_form"
                  onSubmit={e => {
                    e.preventDefault();
                    handleUpdateField('phoneNumber', formData.phoneNumber);
                  }}
                >
                  <IMaskInput
                    mask="000-0000-0000"
                    value={formData.phoneNumber}
                    onAccept={value => setFormData({ ...formData, phoneNumber: value })}
                    placeholder="010-1234-5678"
                    className="mypage_input"
                    required
                    disabled={isLoading}
                  />
                  <div className="mypage_form_actions">
                    <button type="submit" className="mypage_primary_button" disabled={isLoading}>저장</button>
                    <button
                      type="button"
                      className="mypage_secondary_button"
                      onClick={() => {
                        setFormData({ ...formData, phoneNumber: user.phoneNumber });
                        setIsEditingPhoneNumber(false);
                      }}
                      disabled={isLoading}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <span>
                  {user.phoneNumber}
                  <button type="button" className="mypage_edit_button" onClick={() => setIsEditingPhoneNumber(true)}>편집</button>
                </span>
              )}
            </div>
            <div className="mypage_info_row editable">
              <strong>사내전화번호</strong>
              {isEditingOfficePhoneNumber ? (
                <form
                  className="mypage_inline_form"
                  onSubmit={e => {
                    e.preventDefault();
                    handleUpdateField('officePhoneNumber', formData.officePhoneNumber);
                  }}
                >
                  <IMaskInput
                    mask={[
                      { mask: '00-000-0000' },
                      { mask: '00-0000-0000' },
                      { mask: '000-0000-0000' },
                    ]}
                    value={formData.officePhoneNumber}
                    onAccept={value => setFormData({ ...formData, officePhoneNumber: value })}
                    placeholder="070-1234-5678"
                    className="mypage_input"
                    disabled={isLoading}
                  />
                  <div className="mypage_form_actions">
                    <button type="submit" className="mypage_primary_button" disabled={isLoading}>저장</button>
                    <button
                      type="button"
                      className="mypage_secondary_button"
                      onClick={() => {
                        setFormData({ ...formData, officePhoneNumber: user.officePhoneNumber || '' });
                        setIsEditingOfficePhoneNumber(false);
                      }}
                      disabled={isLoading}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <span>
                  {user.officePhoneNumber || '미지정'}
                  <button type="button" className="mypage_edit_button" onClick={() => setIsEditingOfficePhoneNumber(true)}>편집</button>
                </span>
              )}
            </div>
            <div className="mypage_info_row editable">
              <strong>생년월일</strong>
              {isEditingBirthDate ? (
                <form
                  className="mypage_inline_form"
                  onSubmit={e => {
                    e.preventDefault();
                    handleUpdateField('birthDate', formData.birthDate);
                  }}
                >
                  <DateSelectPicker
                    value={formData.birthDate}
                    onChange={date => setFormData({ ...formData, birthDate: date })}
                    disabled={isLoading}
                    minDate={new Date(1900, 0, 1)}
                    maxDate={new Date()}
                    placeholder="생년월일"
                    className="mypage_date_select"
                  />
                  <div className="mypage_form_actions">
                    <button type="submit" className="mypage_primary_button" disabled={isLoading}>저장</button>
                    <button
                      type="button"
                      className="mypage_secondary_button"
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
                    </button>
                  </div>
                </form>
              ) : (
                <span>
                  {user.birthDate && user.birthDate !== '미지정'
                    ? new Date(user.birthDate).toLocaleDateString('ko-KR')
                    : '미지정'}
                  <button type="button" className="mypage_edit_button" onClick={() => setIsEditingBirthDate(true)}>편집</button>
                </span>
              )}
            </div>
            <div className="mypage_info_row editable">
              <strong>비밀번호 변경</strong>
              {isEditingPassword ? (
                <form
                  className="mypage_inline_form password"
                  onSubmit={e => {
                    e.preventDefault();
                    handleUpdateField('password', formData.password);
                  }}
                >
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="새 비밀번호"
                    className="mypage_input"
                    disabled={isLoading}
                  />
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={e => setFormData({ ...formData, passwordConfirm: e.target.value })}
                    placeholder="비밀번호 확인"
                    className="mypage_input"
                    disabled={isLoading}
                  />
                  <div className="mypage_form_actions">
                    <button type="submit" className="mypage_primary_button" disabled={isLoading}>저장</button>
                    <button
                      type="button"
                      className="mypage_secondary_button"
                      onClick={() => {
                        setFormData({ ...formData, password: '', passwordConfirm: '' });
                        setIsEditingPassword(false);
                      }}
                      disabled={isLoading}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <span>
                  <button type="button" className="mypage_edit_button standalone" onClick={() => setIsEditingPassword(true)}>편집</button>
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="mypage_side_stack">
          <section className="mypage_panel mypage_todo_panel">
            <div className="mypage_panel_head">
              <h2>ToDo</h2>
            </div>

            <form className="mypage_memo_form" onSubmit={handleSaveMemo}>
              <textarea
                rows={4}
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                placeholder="내용을 입력하세요"
                className="mypage_textarea"
                disabled={isMemoLoading}
              />
              <button type="submit" className="mypage_primary_button" disabled={isMemoLoading}>
                {isMemoLoading ? '저장 중...' : '저장'}
              </button>
            </form>

            {editingMemo && (
              <form
                className="mypage_memo_form edit"
                onSubmit={e => {
                  e.preventDefault();
                  handleEditMemo(editingMemo.id, editingMemo.content);
                }}
              >
                <textarea
                  rows={4}
                  value={editingMemo.content}
                  onChange={e => setEditingMemo({ ...editingMemo, content: e.target.value })}
                  placeholder="수정"
                  className="mypage_textarea"
                  disabled={isMemoLoading}
                />
                <div className="mypage_form_actions">
                  <button type="submit" className="mypage_primary_button" disabled={isMemoLoading}>
                    {isMemoLoading ? '수정 중...' : '수정'}
                  </button>
                  <button type="button" className="mypage_secondary_button" onClick={() => setEditingMemo(null)} disabled={isMemoLoading}>
                    취소
                  </button>
                </div>
              </form>
            )}

            <div className="mypage_table_wrap">
              <table className="mypage_table">
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
                      <td colSpan={memoColumns.length} className="mypage_empty_cell">
                        저장된 내용이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mypage_panel mypage_calendar_panel">
            <div className="mypage_panel_head">
              <h2>캘린더</h2>
            </div>

            <form className="mypage_event_form" onSubmit={handleAddEvent}>
              <label>
                이벤트 제목
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="이벤트 제목"
                  className="mypage_input"
                  disabled={isEventLoading}
                />
              </label>
              <label>
                시작 시간
                <DatePicker
                  selected={newEvent.start}
                  onChange={date => setNewEvent({ ...newEvent, start: date })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  placeholderText="시작 시간"
                  locale={ko}
                  className="mypage_input"
                  wrapperClassName="mypage_date_wrap"
                  popperClassName="date_select_calendar mypage_calendar_datepicker"
                  showPopperArrow={false}
                  renderCustomHeader={renderMypageDateHeader}
                  disabled={isEventLoading}
                />
              </label>
              <label>
                종료 시간
                <DatePicker
                  selected={newEvent.endTime}
                  onChange={date => setNewEvent({ ...newEvent, endTime: date })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  placeholderText="종료 시간"
                  locale={ko}
                  className="mypage_input"
                  wrapperClassName="mypage_date_wrap"
                  popperClassName="date_select_calendar mypage_calendar_datepicker"
                  showPopperArrow={false}
                  renderCustomHeader={renderMypageDateHeader}
                  disabled={isEventLoading}
                />
              </label>
              <button type="submit" className="mypage_primary_button" disabled={isEventLoading}>
                {isEventLoading ? '추가 중...' : '이벤트 추가'}
              </button>
            </form>

            <div className="mypage_calendar_wrap">
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
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default MyPage;
