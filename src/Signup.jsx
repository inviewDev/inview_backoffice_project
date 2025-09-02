import { useState } from 'react';

function Signup() {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '회원가입 실패');
      setMessage(data.message); setFormData({ email: '', password: '', name: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>회원가입</h1>
      <form onSubmit={handleSubmit}>
        <input name="email" value={formData.email} onChange={handleChange} placeholder="이메일" required />
        <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="비밀번호" required />
        <input name="name" value={formData.name} onChange={handleChange} placeholder="이름" required />
        <button type="submit" disabled={isLoading}>{isLoading ? '처리 중...' : '가입'}</button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
export default Signup;
