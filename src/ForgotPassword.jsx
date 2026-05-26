import { useState } from 'react';
import { Alert } from 'react-bootstrap';

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      setMessage(data.message);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch (err) {
      console.error('Password reset request error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup_container">
      <h2 className="signup_title">비밀번호 찾기</h2>
      <form onSubmit={handleSubmit} className="signup_form">
        <input
          type="email"
          placeholder="가입한 이메일"
          className="signup_input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />
        <button type="submit" className="signup_button" disabled={isLoading}>
          {isLoading ? '발송 중...' : '재설정 링크 받기'}
        </button>
        <button type="button" className="tab_button" onClick={onBack} disabled={isLoading}>
          로그인으로 돌아가기
        </button>
        {message && <Alert variant="success" className="mt-3">{message}</Alert>}
        {devResetUrl && (
          <Alert variant="warning" className="mt-3">
            메일 설정이 없어 개발용 링크가 생성되었습니다.
            <br />
            <a href={devResetUrl}>비밀번호 재설정 열기</a>
          </Alert>
        )}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      </form>
    </div>
  );
}

export default ForgotPassword;
