import { useState } from 'react';
import { Alert } from 'react-bootstrap';

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
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
    setDevResetUrl('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      }

      setMessage(data.message || '가입된 이메일이라면 재설정 링크를 발송했습니다.');
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
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
          <p className="auth_desc">가입한 아이디를 입력하면 재설정 링크를 안내합니다.</p>
        </div>

        <label className="signup_auth_field">
          <img
            src="/img/svg/login_user.svg"
            alt=""
            className="signup_auth_icon"
            aria-hidden="true"
          />
          <input
            type="email"
            placeholder="아이디"
            aria-label="아이디"
            className="signup_auth_input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="username"
            required
          />
        </label>

        <button type="submit" className="signup_button" disabled={isLoading}>
          {isLoading ? '발송 중...' : '재설정 링크 받기'}
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
        {devResetUrl && (
          <Alert variant="warning" className="signup_message warning">
            메일 설정이 없어 개발용 링크가 생성되었습니다.
            <br />
            <a href={devResetUrl}>비밀번호 재설정 열기</a>
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
