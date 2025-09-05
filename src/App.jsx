import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';
import Login from './Login.jsx';

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

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('login'); // 'login' or 'signup'

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
      <div className='basic_wrap'>
        <div className="img_box"><img src="img/logo/logo.svg" alt="" /></div>
        <div className="sign_in_wrap">
          <div className="in_box">
            <div className="tabs">
              <button
                className={`tab_button ${tab === 'login' ? 'active' : ''}`}
                onClick={() => setTab('login')}
              >
                로그인
              </button>
              <button
                className={`tab_button ${tab === 'signup' ? 'active' : ''}`}
                onClick={() => setTab('signup')}
              >
                회원가입
              </button>
            </div>
          </div>
          <div className="tab_content">
            {tab === 'login' && <Login onLoginSuccess={setUser} />}
            {tab === 'signup' && <Signup />}
          </div>
        </div>
      </div>
    );
  }

  // 로그인 상태일 때
  return (
    <div>
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
