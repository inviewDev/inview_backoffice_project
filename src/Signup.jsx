import { useState } from 'react';
import { Form, Alert, Button } from 'react-bootstrap';
import { IMaskInput } from 'react-imask';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import './main.css';

function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    team: '1팀',
    level: '사원',
    phoneNumber: '',
    birthDate: null,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const teamOptions = ['1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리부'];

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
      setError('휴대전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
      return;
    }

    if (!formData.birthDate || isNaN(formData.birthDate)) {
      setError('유효한 생년월일을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const submitData = {
        ...formData,
        birthDate: formData.birthDate.toISOString().split('T')[0],
      };
      const { passwordConfirm, ...dataToSend } = submitData;
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '회원가입 신청 실패');
      setMessage(data.message);
      setFormData({
        email: '',
        password: '',
        passwordConfirm: '',
        name: '',
        team: '1팀',
        level: '사원',
        phoneNumber: '',
        birthDate: null,
      });
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container">
      <h2 className="signup_title">회원가입</h2>
      <form onSubmit={handleSubmit} className="signup_form">
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="이메일"
          required
          className="signup_input"
          disabled={isLoading}
        />
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="비밀번호"
          required
          className="signup_input"
          disabled={isLoading}
        />
        <input
          name="passwordConfirm"
          type="password"
          value={formData.passwordConfirm}
          onChange={handleChange}
          placeholder="비밀번호 확인"
          required
          className="signup_input"
          disabled={isLoading}
        />
        <input
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="이름"
          required
          className="signup_input"
          disabled={isLoading}
        />
        <label className="signup_label" htmlFor="team_select">
          소속팀:
          <select
            id="team_select"
            name="team"
            value={formData.team}
            onChange={handleChange}
            required
            className="signup_select"
            disabled={isLoading}
          >
            <option value="1팀">1팀</option>
            <option value="2팀">2팀</option>
            <option value="3팀">3팀</option>
            <option value="4팀">4팀</option>
            <option value="5팀">5팀</option>
            <option value="6팀">6팀</option>
            <option value="개발관리부">개발관리부</option>
          </select>
        </label>
        <IMaskInput
          mask="000-0000-0000"
          name="phoneNumber"
          value={formData.phoneNumber}
          onAccept={handlePhoneChange}
          placeholder="010-1234-5678"
          required
          className="signup_input"
          disabled={isLoading}
        />
        
        <label className="signup_label" htmlFor="team_select">
          생년월일:
          <DatePicker
            selected={formData.birthDate}
            onChange={handleDateChange}
            locale={ko}
            dateFormat="yyyy-MM-dd"
            placeholderText="생년월일을 선택하세요"
            className="signup_input"
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
          {isLoading ? '처리 중...' : '신청'}
        </button>
        {message && <Alert variant="success" className="signup_message success mt-3">{message}</Alert>}
        {error && <Alert variant="danger" className="signup_message error mt-3">{error}</Alert>}
      </form>
    </div>
  );
}

export default Signup;