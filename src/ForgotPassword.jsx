import { useState } from 'react';
import { Alert } from 'react-bootstrap';

function ForgotPassword({ onBack }) {
  const [loginId, setLoginId] = useState('');
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
    setIsLoading(true);

    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim() }),
      });
      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      }

      setMessage(data.message || '관리자에게 아이디를 전달하여 비밀번호 초기화를 요청해주세요.');
    } catch (err) {
      console.error('Password reset request error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container forgot_auth_container">
      <form onSubmit={handleSubmit} className="signup_form forgot_auth_form">
        <div className="auth_header">
          <h2 className="auth_title">비밀번호 찾기</h2>
          <p className="auth_desc">아이디를 입력하면 관리자 초기화 방법을 안내합니다.</p>
        </div>

        <label className="signup_auth_field">
          <img
            src="/img/svg/login_user.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="아이디"
            aria-label="아이디"
            className="signup_auth_input"
            value={loginId}
            onChange={e => setLoginId(e.target.value)}
            disabled={isLoading}
            autoComplete="username"
            required
          />
        </label>

        <button type="submit" className="signup_button" disabled={isLoading}>
          {isLoading ? '확인 중...' : '초기화 방법 확인'}
        </button>

        <button
          type="button"
          className="auth_secondary_button"
          onClick={onBack}
          disabled={isLoading}
        >
          로그인으로 돌아가기
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

export default ForgotPassword;
