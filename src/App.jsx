import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { Nav, Button, Spinner } from 'react-bootstrap';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import MyPage from './Mypage.jsx';

// JWT 디코딩 함수
function parseJwt(token) {
  try {
    if (!token) {
      console.error('No token provided to parseJwt');
      return null;
    }
    const base64Url = token.split('.')[1];
    if (!base64Url) {
      console.error('Invalid token format: missing payload');
      return null;
    }
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    console.log('Decoded JWT:', decoded);
    return decoded;
  } catch (e) {
    console.error('parseJwt error:', e.message);
    return null;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const decoded = parseJwt(token);
      if (!decoded || !decoded.id || !decoded.email || !decoded.role || !decoded.name) {
        console.warn('Invalid or missing JWT fields:', decoded);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setIsLoading(false);
        return;
      }

      const currentTime = Date.now() / 1000;
      if (decoded.exp && decoded.exp < currentTime) {
        console.warn('Token expired, clearing localStorage');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '사용자 정보 조회 실패');
        setUser({
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
      } catch (error) {
        console.error('Fetch user error:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const isAdmin = user && (user.role === '전체관리자' || user.role === '관리자');

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {!user ? (
        <div className="basic_wrap">
          <div className="img_box">
            <img src="img/logo/logo_w.svg" alt="아이앤뷰 로고" />
          </div>
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
      ) : (
        <div>
          <div className="header_wrap">
            <div className="header">
              <div className="header_cont">
                <div className="left_align">
                  <div className="logo_box">
                    <Link to="/">
                      <img src="img/logo/logo_w.svg" alt="아이앤뷰 로고" />
                    </Link>
                  </div>
                  <div className="nav_cont">
                    <ul>
                      <li><Nav.Link as={Link} to="/contracts">계약관리</Nav.Link></li>
                      <li><Nav.Link as={Link} to="/community">커뮤니티</Nav.Link></li>
                      <li>{isAdmin && <Nav.Link as={Link} to="/users">직원관리</Nav.Link>}</li>
                    </ul>
                  </div>
                </div>
                <div className="right_align">
                  <span>{user.name}님 환영합니다.</span>
                  <Nav.Link as={Link} to="/mypage">마이페이지</Nav.Link>
                  <div className="ad_cont">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('user');
                        setUser(null);
                        setTab('login');
                      }}
                    >
                      로그아웃
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard user={user} setUser={setUser} />} />
            <Route path="/mypage" element={<MyPage user={user} setUser={setUser} />} />
            <Route
              path="/users"
              element={
                isAdmin ? <UserList user={user} /> : <Navigate replace to="/" />
              }
            />
            <Route path="/contracts" element={<div>계약관리 페이지 (미구현)</div>} />
            <Route path="/community" element={<div>커뮤니티 페이지 (미구현)</div>} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </div>
      )}
    </div>
  );
}

export default App;