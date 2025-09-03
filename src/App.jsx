import { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      // 실제 로그인 API 호출
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('로그인 실패');
      const data = await res.json();

      // 예: 로그인 성공 시 사용자 정보 전달
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>로그인</h2>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">로그인</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return (
      <div>
        <h1>아이앤뷰커뮤니케이션_Backoffice</h1>
        <Login onLoginSuccess={setUser} />
        <Signup />
      </div>
    );
  }

  return (
    <div>
      <h1>아이앤뷰커뮤니케이션_Backoffice</h1>
      <nav style={{ padding: '20px', backgroundColor: '#f5f5f5', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '20px' }}>사용자 목록</Link>
        <button onClick={() => setUser(null)}>로그아웃</button>
      </nav>

      <Routes>
        <Route path="/" element={<UserList user={user} />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </div>
  );
}

export default App;