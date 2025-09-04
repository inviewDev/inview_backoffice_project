import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';
import Login from './Login.jsx';

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
