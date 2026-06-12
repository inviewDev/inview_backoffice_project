import { useState } from 'react';
import { Alert } from 'react-bootstrap';
import ForgotPassword from './ForgotPassword.jsx';

function Login({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const parseResponse = async res => {
    const text = await res.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data.error || '아이디 또는 비밀번호를 확인해주세요.');
      }

      localStorage.setItem('access_token', data.token);
      onLoginSuccess({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: data.user.name,
        level: data.user.level || '미입력',
        team: data.user.team || '미입력',
        department: data.user.department || '미입력',
        phoneNumber: data.user.phoneNumber || '미입력',
        birthDate: data.user.birthDate || '미입력',
        officePhoneNumber: data.user.officePhoneNumber || '미입력',
        profileImage: data.user.profileImage || '',
      });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    }
  };

  if (showForgotPassword) {
    return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <div className="login_panel">
      <form onSubmit={handleSubmit} className="login_form">
        <label className="login_field">
          <img
            src="/img/svg/login_user.svg"
            alt=""
            className="login_field_icon"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="아이디"
            aria-label="아이디"
            className="login_input"
            value={loginId}
            onChange={e => setLoginId(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="login_field">
          <img
            src="/img/svg/login_lock.svg"
            alt=""
            className="login_field_icon"
            aria-hidden="true"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="비밀번호"
            aria-label="비밀번호"
            className="login_input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={`login_visibility ${showPassword ? 'is_visible' : ''}`}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            onClick={() => setShowPassword(value => !value)}
          >
            <img src="/img/svg/login_eye_off.svg" alt="" aria-hidden="true" />
          </button>
        </label>

        <button type="submit" className="login_submit">
          로그인
        </button>

        <button
          type="button"
          className="login_forgot"
          onClick={() => setShowForgotPassword(true)}
        >
          비밀번호 찾기
        </button>

        {error && (
          <Alert variant="danger" className="login_alert">
            {error}
          </Alert>
        )}
      </form>
    </div>
  );
}

export default Login;
