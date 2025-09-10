import { useState } from 'react';
import { Alert } from 'react-bootstrap';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '이메일 또는 비밀번호를 확인해주세요.');
      }
      const data = await res.json();
      console.log('Login response:', data);
      localStorage.setItem('access_token', data.token);
      console.log('Stored token:', localStorage.getItem('access_token'));
      onLoginSuccess({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: data.user.name,
        level: data.user.level || '미지정',
        team: data.user.team || '미지정',
        department: data.user.department || '미지정',
        phoneNumber: data.user.phoneNumber || '미지정',
        birthDate: data.user.birthDate || '미지정',
        officePhoneNumber: data.user.officePhoneNumber || '미지정',
      });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="signup_container">
      <h2 className="signup_title">로그인</h2>
      <form onSubmit={handleSubmit} className="signup_form">
        <input
          type="email"
          placeholder="이메일"
          className="signup_input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="signup_input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="signup_button">로그인</button>
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      </form>
    </div>
  );
}

export default Login;