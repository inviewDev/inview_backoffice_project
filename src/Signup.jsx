import { useState } from 'react';
import { Alert } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

const initial_form_data = {
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  team: '1팀',
  level: '사원',
  phoneNumber: '',
  birthDate: null,
};

const team_options = ['1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리팀'];

function Signup() {
  const [formData, setFormData] = useState(initial_form_data);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const parseResponse = async response => {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };

  const handleChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePhoneChange = value =>
    setFormData({ ...formData, phoneNumber: value });

  const handleDateChange = date =>
    setFormData({ ...formData, birthDate: date });

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    const phoneRegex = /^\d{3}-\d{4}-\d{4}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      setError('휴대전화번호 형식을 확인해주세요. 예: 010-1234-5678');
      return;
    }

    if (!formData.birthDate || isNaN(formData.birthDate)) {
      setError('생년월일을 선택해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const submitData = {
        ...formData,
        birthDate: formData.birthDate.toISOString().split('T')[0],
      };
      const dataToSend = { ...submitData };
      delete dataToSend.passwordConfirm;

      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        throw new Error(data.error || '회원가입 신청에 실패했습니다.');
      }

      setMessage(data.message || '회원가입 신청이 완료되었습니다.');
      setFormData(initial_form_data);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container signup_auth_container">
      <form onSubmit={handleSubmit} className="signup_form signup_auth_form">
        <label className="signup_auth_field">
          <img
            src="/img/svg/login_user.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="아이디"
            aria-label="아이디"
            required
            className="signup_auth_input"
            disabled={isLoading}
            autoComplete="username"
          />
        </label>

        <label className="signup_auth_field">
          <img
            src="/img/svg/login_lock.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="비밀번호"
            aria-label="비밀번호"
            required
            className="signup_auth_input"
            disabled={isLoading}
            autoComplete="new-password"
          />
        </label>

        <label className="signup_auth_field">
          <img
            src="/img/svg/login_lock.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            name="passwordConfirm"
            type="password"
            value={formData.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호 확인"
            aria-label="비밀번호 확인"
            required
            className="signup_auth_input"
            disabled={isLoading}
            autoComplete="new-password"
          />
        </label>

        <label className="signup_auth_field">
          <span className="signup_auth_label">이름</span>
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="이름"
            aria-label="이름"
            required
            className="signup_auth_input"
            disabled={isLoading}
            autoComplete="name"
          />
        </label>

        <label className="signup_auth_field">
          <span className="signup_auth_label">소속팀</span>
          <select
            name="team"
            value={formData.team}
            onChange={handleChange}
            required
            className="signup_auth_input signup_auth_select"
            disabled={isLoading}
          >
            {team_options.map(team => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>

        <label className="signup_auth_field">
          <span className="signup_auth_label">연락처</span>
          <IMaskInput
            mask="000-0000-0000"
            name="phoneNumber"
            value={formData.phoneNumber}
            onAccept={handlePhoneChange}
            placeholder="010-1234-5678"
            aria-label="연락처"
            required
            className="signup_auth_input"
            disabled={isLoading}
          />
        </label>

        <label className="signup_auth_field">
          <span className="signup_auth_label">생년월일</span>
          <DatePicker
            selected={formData.birthDate}
            onChange={handleDateChange}
            locale={ko}
            dateFormat="yyyy-MM-dd"
            placeholderText="생년월일"
            className="signup_auth_input"
            wrapperClassName="signup_date_wrap"
            required
            disabled={isLoading}
            minDate={new Date(1900, 0, 1)}
            maxDate={new Date()}
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={100}
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className={`signup_button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? '처리 중...' : '회원가입 신청'}
        </button>

        {message && (
          <Alert variant="success" className="signup_message success">
            {message}
          </Alert>
        )}
        {error && (
          <Alert variant="danger" className="signup_message error">
            {error}
          </Alert>
        )}
      </form>
    </div>
  );
}

export default Signup;
