import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';

// jwt-decode 없이 토큰 페이로드 디코딩 함수
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

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

      localStorage.setItem('access_token', data.token);
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

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const decoded = parseJwt(token);
      if (!decoded) {
        localStorage.removeItem('access_token');
        setUser(null);
        return;
      }
      const currentTime = Date.now() / 1000;

      if (decoded.exp && decoded.exp < currentTime) {
        localStorage.removeItem('access_token');
        setUser(null);
      } else {
        setUser({
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        });
      }
    }
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
        <Link to="/" style={{ marginRight: '20px' }}>
          사용자 목록
        </Link>
        <button
          onClick={() => {
            localStorage.removeItem('access_token');
            setUser(null);
          }}
        >
          로그아웃
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<UserList user={user} />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
