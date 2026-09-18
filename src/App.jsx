import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faOutdent,
  faIndent,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import UserList from './UserList.jsx';
import AccountSettings from './AccountSettings.jsx';
import Signup from './Signup.jsx';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import MyPage from './Mypage.jsx';
import AdDetail from './Ad_Detail.jsx';
import AdManagement from './AdManagement.jsx';
import AdManagementDetail from './AdManagementDetail.jsx';
import PersonalSales from './PersonalSales.jsx';
import Community from './Community.jsx';
import ResetPassword from './ResetPassword.jsx';
import {
  AgreementContractPage,
  AgreementPreviewContractPage,
  AgreementPreviewTermsPage,
  AgreementTermsPage,
} from './AgreementFlow.jsx';
import {
  dispatchAuthExpired,
  resetAuthExpirationGuard,
} from './utils/authFetch';

const nav_items = [
  { label: 'Home', to: '/', icon: '/img/svg/icon_home.svg', exact: true },
  { label: '광고 관리', to: '/contracts/ad-management', icon: '/img/svg/icon_manage.svg' },
  { label: '광고 등록', to: '/contracts/ad-detail', icon: '/img/svg/icon_register.svg' },
  { label: '개인 별 매출 통계', to: '/paystub', icon: '/img/svg/icon_chart.svg' },
  { label: '팀별 매출 통계', to: '/team-sales', icon: '/img/svg/icon_chart.svg', permission: 'teamSales' },
  { label: '공지사항', to: '/community?tab=notice', icon: '/img/svg/icon_notice.svg' },
  { label: '자유게시판', to: '/community?tab=board', icon: '/img/svg/icon_board.svg' },
];

function parseJwt(token) {
  try {
    if (!token) return null;

    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('parseJwt error:', error.message);
    return null;
  }
}

function AppPlaceholder({ title, description }) {
  return (
    <section className="admin_placeholder">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function getActiveIconPath(iconPath) {
  return iconPath.replace(/\.svg$/, '_active.svg');
}

function App() {
  const [user, setUser] = useState(null);
  const [salesAccess, setSalesAccess] = useState(null);
  const [tab, setTab] = useState('login');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (window.matchMedia('(max-width: 1024px)').matches) return true;
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let controller;
    const refreshAccess = async () => {
      controller?.abort();
      controller = new AbortController();
      const requestController = controller;
      setSalesAccess(null);
      if (!user?.id) return;
      try {
        const response = await fetch('/api/sales-permissions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          signal: requestController.signal,
        });
        const result = await response.json();
        if (!requestController.signal.aborted) setSalesAccess({ userId: user.id, allowed: response.ok && result.canViewTeamSales === true });
      } catch {
        if (!requestController.signal.aborted) setSalesAccess({ userId: user.id, allowed: false });
      }
    };
    refreshAccess();
    window.addEventListener('focus', refreshAccess);
    window.addEventListener('account-permissions:updated', refreshAccess);
    return () => {
      controller?.abort();
      window.removeEventListener('focus', refreshAccess);
      window.removeEventListener('account-permissions:updated', refreshAccess);
    };
  }, [user?.id]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    setTab('login');
  }, []);

  const handleSessionExpired = useCallback(() => {
    clearSession();
    setShowSessionExpiredModal(true);
    navigate('/', { replace: true });
  }, [clearSession, navigate]);

  useEffect(() => {
    window.addEventListener('auth:expired', handleSessionExpired);
    return () => window.removeEventListener('auth:expired', handleSessionExpired);
  }, [handleSessionExpired]);

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
        handleSessionExpired();
        setIsLoading(false);
        return;
      }

      const currentTime = Date.now() / 1000;
      if (decoded.exp && decoded.exp < currentTime) {
        handleSessionExpired();
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

        if (!res.ok) {
          throw new Error(data.error || '사용자 정보 조회에 실패했습니다.');
        }

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
          officePhoneNumber: data.user.officePhoneNumber || '',
          profileImage: data.user.profileImage || '',
          canEditAds: Boolean(data.user.canEditAds),
          canEditAdPaymentStatus: Boolean(data.user.canEditAdPaymentStatus),
          canDeleteAds: Boolean(data.user.canDeleteAds),
          canWritePosts: Boolean(data.user.canWritePosts),
        });
      } catch (error) {
        console.error('Fetch user error:', error);
        if (localStorage.getItem('access_token')) {
          clearSession();
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [clearSession, handleSessionExpired]);

  useEffect(() => {
    if (!user) return undefined;

    const token = localStorage.getItem('access_token');
    const decoded = parseJwt(token);
    if (!decoded?.exp) return undefined;

    const remainingMs = decoded.exp * 1000 - Date.now();
    if (remainingMs <= 0) {
      dispatchAuthExpired();
      return undefined;
    }

    const timer = window.setTimeout(dispatchAuthExpired, remainingMs);
    return () => window.clearTimeout(timer);
  }, [user]);

  const isAdmin = user && (
    user.role === '전체관리자' ||
    user.role === '관리자' ||
    user.role === '?꾩껜愿由ъ옄' ||
    user.role === '愿由ъ옄'
  );

  const handleLogout = () => {
    clearSession();
    setShowSessionExpiredModal(false);
    resetAuthExpirationGuard();
  };

  const handleLoginSuccess = loggedInUser => {
    resetAuthExpirationGuard();
    setShowSessionExpiredModal(false);
    setUser(loggedInUser);
  };

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (!window.matchMedia('(max-width: 1024px)').matches) {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const closeMobileSidebar = () => {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      setIsSidebarCollapsed(true);
    }
  };

  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 1024px)');
    const handleViewportChange = event => {
      setIsSidebarCollapsed(
        event.matches
          ? true
          : localStorage.getItem('admin_sidebar_collapsed') === 'true'
      );
    };

    mobileMedia.addEventListener('change', handleViewportChange);
    return () => mobileMedia.removeEventListener('change', handleViewportChange);
  }, []);

  const isActiveNav = item => {
    if (item.to.includes('?')) {
      const [itemPath, itemQuery] = item.to.split('?');
      const targetTab = new URLSearchParams(itemQuery).get('tab');
      return location.pathname.startsWith(itemPath) && new URLSearchParams(location.search).get('tab') === targetTab;
    }
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to.split('?')[0];
  };

  if (isLoading) {
    return (
      <div className="admin_loading">
        <Spinner animation="border" variant="primary" />
        <p>로딩 중...</p>
      </div>
    );
  }

  if (location.pathname.startsWith('/agreement/')) {
    return (
      <Routes>
        <Route path="/agreement/:token" element={<AgreementTermsPage />} />
        <Route path="/agreement/:token/contract" element={<AgreementContractPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <>
        <div className={`basic_wrap ${location.pathname !== '/reset-password' ? (tab === 'login' ? 'auth_login_view' : 'auth_signup_view') : ''}`}>
          <div className="img_box">
            <picture>
              <source media="(max-width: 1024px)" srcSet="/img/logo/login_logo_mobile.png" />
              <img src="/img/logo/logo_w.svg" alt="I&VIEW COMMUNICATION 로고" />
            </picture>
          </div>
          {location.pathname === '/reset-password' ? (
            <div className="sign_in_wrap">
              <ResetPassword />
            </div>
          ) : (
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
                {tab === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
                {tab === 'signup' && <Signup />}
              </div>
            </div>
          )}
          <footer className="auth_copyright">
            Copyright 2025 <span>I&amp;VIEW Communication</span>. All Rights Reserved.
          </footer>
        </div>

        <Modal
          show={showSessionExpiredModal}
          onHide={() => setShowSessionExpiredModal(false)}
          centered
          className="admin_session_modal"
          backdrop="static"
          keyboard={false}
        >
          <Modal.Header>
            <Modal.Title>로그아웃 되었습니다</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            로그인 시간이 만료되었습니다. 다시 로그인해주세요.
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => setShowSessionExpiredModal(false)}>
              확인
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  if (location.pathname.includes('/agreement-preview')) {
    return (
      <Routes>
        <Route path="/contracts/ad-management/:id/agreement-preview" element={<AgreementPreviewTermsPage />} />
        <Route path="/contracts/ad-management/:id/agreement-preview/contract" element={<AgreementPreviewContractPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    );
  }

  return (
    <div className={`admin_shell ${isSidebarCollapsed ? 'sidebar_collapsed' : ''}`}>
      <aside className="admin_sidebar">
        <Link to="/" className="admin_sidebar_logo" onClick={closeMobileSidebar}>
          <img src="/img/logo/logo_w.svg" alt="I&VIEW COMMUNICATION" />
        </Link>
        <nav id="admin_sidebar_navigation" className="admin_sidebar_nav" aria-label="주요 메뉴">
          {nav_items.filter(item => !item.permission || (salesAccess?.userId === user.id && salesAccess.allowed)).map(item => {
            const isActive = isActiveNav(item);

            return (
              <Link
                key={item.label}
                to={item.to}
                className={`admin_nav_item ${isActive ? 'active' : ''}`}
                onClick={closeMobileSidebar}
              >
                {item.icon ? (
                  <img src={isActive ? getActiveIconPath(item.icon) : item.icon} alt="" aria-hidden="true" />
                ) : (
                  <span className="admin_nav_chart_icon" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                <span className="admin_nav_text">{item.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/users"
              className={`admin_nav_item ${location.pathname.startsWith('/users') ? 'active' : ''}`}
              onClick={closeMobileSidebar}
            >
              <img
                alt=""
                aria-hidden="true"
                src={location.pathname.startsWith('/users') ? '/img/svg/icon_person_active.svg' : '/img/svg/icon_person.svg'}
              />
              <span>직원 관리</span>
            </Link>
          )}
          <div className="admin_mobile_account">
            <div className="admin_mobile_account_user">
              <span className={`admin_avatar ${user.profileImage ? 'has_image' : ''}`}>
                {user.profileImage ? (
                  <img src={user.profileImage} alt={`${user.name} 프로필 사진`} />
                ) : (
                  user.name?.slice(0, 1) || 'I'
                )}
              </span>
              <span><strong>{user.name}</strong>님 환영합니다.</span>
            </div>
            <button type="button" className="admin_mobile_logout" onClick={handleLogout}>
              <img src="/img/svg/icon_logout.svg" alt="" aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          </div>
        </nav>
        <div className="admin_sidebar_tools">
          <button
            type="button"
            className="admin_sidebar_toggle"
            onClick={handleSidebarToggle}
            aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="admin_sidebar_navigation"
          >
            <FontAwesomeIcon
              className="admin_sidebar_desktop_icon"
              icon={isSidebarCollapsed ? faIndent : faOutdent}
              aria-hidden="true"
            />
            <FontAwesomeIcon
              className="admin_sidebar_mobile_icon"
              icon={isSidebarCollapsed ? faBars : faXmark}
              aria-hidden="true"
            />
            <span className="admin_sidebar_toggle_hint" aria-hidden="true">
              {isSidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
            </span>
          </button>
        </div>
      </aside>

      <div className="admin_main">
        <header className="admin_topbar">
          <div className="admin_topbar_user">
            <span className={`admin_avatar ${user.profileImage ? 'has_image' : ''}`}>
              {user.profileImage ? (
                <img src={user.profileImage} alt={`${user.name} 프로필 사진`} />
              ) : (
                user.name?.slice(0, 1) || 'I'
              )}
            </span>
            <span>
              <strong>{user.name}</strong>님 환영합니다.
            </span>
          </div>
          <span className="admin_topbar_divider" />
          <button type="button" className="admin_logout_button" onClick={handleLogout}>
            <img src="/img/svg/icon_logout.svg" alt="" aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </header>

        <main className="admin_page_body">
          <Routes>
            <Route path="/" element={<Dashboard user={user} setUser={setUser} />} />
            <Route path="/mypage" element={<MyPage user={user} setUser={setUser} />} />
            <Route
              path="/users"
              element={isAdmin ? <UserList user={user} /> : <Navigate replace to="/" />}
            />
            <Route path="/users/account-settings" element={user.role === '전체관리자' ? <AccountSettings user={user} /> : <Navigate replace to="/users" />} />
            <Route path="/contracts/ad-management" element={<AdManagement user={user} />} />
            <Route path="/contracts/ad-management/:id" element={<AdManagementDetail user={user} />} />
            <Route path="/contracts/ad-detail" element={<AdDetail user={user} />} />
            <Route
              path="/contracts/revenue"
              element={
                <AppPlaceholder
                  title="매출 조회"
                  description="작업전"
                />
              }
            />
            <Route path="/paystub" element={<PersonalSales user={user} />} />
            <Route path="/team-sales" element={<PersonalSales key="team-sales" user={user} mode="team" />} />
            <Route path="/community" element={<Community user={user} mode="list" />} />
            <Route path="/community/write" element={<Community user={user} mode="write" />} />
            <Route path="/community/:id/edit" element={<Community user={user} mode="edit" />} />
            <Route path="/community/:id" element={<Community user={user} mode="detail" />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </main>

        <footer className="admin_footer">
          Copyright 2025 I&VIEW Communication. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}

export default App;
