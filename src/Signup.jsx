import { useState } from 'react';
import './main.css';

function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    team: '1팀',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const { passwordConfirm, ...submitData } = formData;
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '회원가입 신청 실패');
      setMessage(data.message); // "회원가입 신청이 완료되었습니다. 관리자 승인을 기다려 주세요."
      setFormData({
        email: '',
        password: '',
        passwordConfirm: '',
        name: '',
        team: '1팀',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container">
      <h2 className="signup_title">회원가입 신청</h2>
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
        <button
          type="submit"
          disabled={isLoading}
          className={`signup_button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? '처리 중...' : '신청'}
        </button>
      </form>
      {message && <p className="signup_message success">{message}</p>}
      {error && <p className="signup_message error">{error}</p>}
    </div>
  );
}

export default Signup;