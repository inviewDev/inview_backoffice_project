import { useState, useEffect } from 'react';
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
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('로그인 실패');
      const data = await res.json();

      // JWT 토큰 localStorage 저장
      localStorage.setItem('access_token', data.token);

      // 로그인 사용자 정보 App 컴포넌트에 전달
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

  // 새로고침 등 시도 시 기존 토큰이 있으면 사용자 정보 유지(선택사항)
  useEffect(() => {
    // 토큰 존재 시 사용자 정보 복구 로직 필요하면 구현
    // 예) 토큰 디코딩 후 user 상태 재설정 등
  }, []);

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
        <button onClick={() => {
          localStorage.removeItem('access_token'); // 로그아웃 시 토큰 삭제
          setUser(null);
        }}>로그아웃</button>
      </nav>

      <Routes>
        <Route path="/" element={<UserList user={user} />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </div>
  );
}

export default App;