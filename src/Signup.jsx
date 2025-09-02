import { useState } from 'react';
import './main.css'; // CSS 파일 임포트

function Signup() {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '회원가입 실패');
      setMessage(data.message);
      setFormData({ email: '', password: '', name: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h2 className="signup-title">회원가입</h2>
      <form onSubmit={handleSubmit} className="signup-form">
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="이메일"
          required
          className="signup-input"
          disabled={isLoading}
        />
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="비밀번호"
          required
          className="signup-input"
          disabled={isLoading}
        />
        <input
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="이름"
          required
          className="signup-input"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`signup-button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? '처리 중...' : '가입'}
        </button>
      </form>
      {message && <p className="signup-message success">{message}</p>}
      {error && <p className="signup-message error">{error}</p>}
    </div>
  );
}

export default Signup;