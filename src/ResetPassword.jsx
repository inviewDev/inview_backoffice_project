import { useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    setMessage('');
    setError('');

    if (!token) {
      setError('재설정 토큰이 없습니다. 비밀번호 찾기를 다시 진행해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8 || !/[!@#$%^&*]/.test(password)) {
      setError('비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 재설정에 실패했습니다.');
      }

      setMessage(data.message || '비밀번호가 변경되었습니다.');
      setPassword('');
      setPasswordConfirm('');
    } catch (err) {
      console.error('Password reset confirm error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container reset_auth_container">
      <form onSubmit={handleSubmit} className="signup_form reset_auth_form">
        <div className="auth_header">
          <h2 className="auth_title">새 비밀번호 설정</h2>
          <p className="auth_desc">8자 이상, 특수문자를 포함해 입력해주세요.</p>
        </div>

        <label className="signup_auth_field">
          <img
            src="/img/svg/login_lock.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            type="password"
            placeholder="새 비밀번호"
            aria-label="새 비밀번호"
            className="signup_auth_input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isLoading || !token || !!message}
            autoComplete="new-password"
            required
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
            type="password"
            placeholder="새 비밀번호 확인"
            aria-label="새 비밀번호 확인"
            className="signup_auth_input"
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            disabled={isLoading || !token || !!message}
            autoComplete="new-password"
            required
          />
        </label>

        <button
          type="submit"
          className="signup_button"
          disabled={isLoading || !token || !!message}
        >
          {isLoading ? '변경 중...' : '비밀번호 변경'}
        </button>

        <button
          type="button"
          className="auth_secondary_button"
          onClick={() => navigate('/')}
        >
          로그인으로 이동
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

export default ResetPassword;
