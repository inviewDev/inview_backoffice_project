import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFloppyDisk, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import UserManagementTabs from './components/UserManagementTabs';
import './styles/user_list.css';
import './styles/account_settings.css';

const teams = ['1팀', '2팀', '3팀', '4팀', '5팀', '6팀', '개발관리부'];
const departments = { '1팀': '1부서', '3팀': '1부서', '4팀': '1부서', '2팀': '2부서', '5팀': '2부서', '6팀': '2부서', '개발관리부': '운영부서' };
const roles = ['전체관리자', '관리자', '팀장', '사용자'];
const scopes = [['own', '본인 광고만'], ['team', '소속팀 광고'], ['department', '소속부서 광고'], ['all', '전체 광고']];
const permissionFields = [['canEditAds', '광고상품 수정'], ['canEditAdPaymentStatus', '결제상태 수정'], ['canDeleteAds', '광고상품 삭제'], ['canWritePosts', '게시글 작성'], ['canViewTeamSales', '팀별 매출 통계 열람']];
const isRoot = user => ['cchee', 'cchee@gmail.com'].includes(String(user?.email || '').trim().toLowerCase());
const accountForm = user => ({
  loginId: user.email, team: user.level === '대표' ? '대표' : user.team,
  role: user.role, adVisibilityScope: isRoot(user) ? 'all' : user.adVisibilityScope || 'own',
  ...Object.fromEntries(permissionFields.map(([key]) => [key, isRoot(user) || Boolean(user[key])])),
  resetPassword: false,
});
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '계정 정보를 처리하지 못했습니다.');
  return result;
}

export default function AccountSettings({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [message, setMessage] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const root = isRoot(currentUser);
  const selected = users.find(user => user.id === selectedId);
  const dirty = Boolean(selected && form && JSON.stringify(accountForm(selected)) !== JSON.stringify(form));
  const matches = useMemo(() => users.filter(user => `${user.name} ${user.email} ${user.team} ${user.department}`.toLowerCase().includes(query.trim().toLowerCase())), [users, query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMessage(null);
    Promise.all(['/api/users', '/api/users/pending', '/api/users/sales-permissions'].map(url => request(url, { signal: controller.signal })))
      .then(([active, pending, access]) => {
        if (controller.signal.aborted) return;
        const permissions = new Map(access.permissions.map(item => [item.userId, item.canViewTeamSales]));
        const accounts = [...active, ...pending].map(user => ({ ...user, canViewTeamSales: isRoot(user) || permissions.get(user.id) === true }));
        setUsers(accounts);
        setStorageReady(access.ready);
        setSelectedId(null);
        setForm(null);
      }).catch(error => { if (!controller.signal.aborted) setMessage({ variant: 'danger', text: error.message }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currentUser.id, refresh]);

  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function canLeave() {
    return !saving && (!dirty || window.confirm('저장하지 않은 변경사항을 취소할까요?'));
  }
  function selectAccount(user) {
    if (user.id === selectedId || !canLeave()) return;
    setSelectedId(user.id);
    setForm(accountForm(user));
    setMessage(null);
  }
  function change(key, value) { setForm(previous => ({ ...previous, [key]: value })); }

  async function save(event) {
    event.preventDefault();
    if (!selected || saving || !dirty) return;
    if (form.resetPassword && !window.confirm(`${selected.name}님의 비밀번호를 1111로 초기화하시겠습니까?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...form };
      if (!root) {
        delete payload.adVisibilityScope;
        permissionFields.forEach(([key]) => { delete payload[key]; });
      } else if (!storageReady || form.canViewTeamSales === accountForm(selected).canViewTeamSales) {
        delete payload.canViewTeamSales;
      }
      const result = await request(`/api/users/${selected.id}/account-settings`, { method: 'PATCH', body: JSON.stringify(payload) });
      const updated = { ...result.user, canViewTeamSales: form.canViewTeamSales };
      setUsers(previous => previous.map(user => user.id === selected.id ? updated : user));
      setForm(accountForm(updated));
      setMessage({ variant: 'success', text: result.message || '계정 설정이 저장되었습니다.' });
      window.dispatchEvent(new Event('account-permissions:updated'));
    } catch (error) {
      setMessage({ variant: 'danger', text: error.message });
    } finally { setSaving(false); }
  }

  const locked = saving || (isRoot(selected) && !root);
  const teamOptions = selected?.level === '대표' ? ['대표'] : [...new Set([selected?.team, ...teams].filter(Boolean))];
  const department = selected?.level === '대표' ? '대표' : departments[form?.team] || selected?.department || '미지정';

  return <section className="userlist_block account_settings">
    <UserManagementTabs activeKey="accounts" canManage beforeNavigate={canLeave} />
    <header className="account_settings_heading"><h1>계정설정</h1><span>{users.length}명</span></header>
    {message && <Alert variant={message.variant} role="alert">{message.text}{!users.length && <Button variant="link" onClick={() => setRefresh(value => value + 1)}>다시 시도</Button>}</Alert>}
    {!loading && !storageReady && <Alert variant="warning">팀별 매출 통계 권한 저장소가 준비되지 않았습니다. DB 마이그레이션이 필요합니다.</Alert>}
    {loading ? <div className="userlist_state"><Spinner animation="border" size="sm" /> 로딩 중...</div> : <div className="account_settings_layout">
      <aside className="account_settings_directory">
        <Form.Control type="search" aria-label="계정 검색" placeholder="이름, 아이디, 팀 검색" value={query} onChange={event => setQuery(event.target.value)} />
        <div className="account_settings_accounts">
          {matches.map(user => <button type="button" className={selectedId === user.id ? 'active' : ''} key={user.id} onClick={() => selectAccount(user)} disabled={saving} aria-pressed={selectedId === user.id}>
            <strong>{user.name}<small>{user.status}</small></strong><span>{user.email}</span><span>{user.department} / {user.team}</span>
          </button>)}
          {!matches.length && <p className="account_settings_empty">일치하는 계정이 없습니다.</p>}
        </div>
      </aside>
      <div className="account_settings_editor">
        {!selected || !form ? <div className="account_settings_empty">선택된 계정이 없습니다.</div> : <Form onSubmit={save}>
          <header className="account_settings_subject"><h2>{selected.name}</h2><span>{selected.email}</span></header>
          <fieldset disabled={locked}>
            <legend>기본 설정</legend>
            <div className="account_settings_fields">
              <Form.Group controlId="account_login"><Form.Label>아이디</Form.Label><Form.Control value={form.loginId} onChange={event => change('loginId', event.target.value.trim())} required disabled={isRoot(selected)} autoComplete="off" /></Form.Group>
              <Form.Group controlId="account_role"><Form.Label>권한</Form.Label><Form.Select value={form.role} onChange={event => change('role', event.target.value)} disabled={selected.id === currentUser.id || isRoot(selected)}>{roles.map(value => <option key={value}>{value}</option>)}</Form.Select></Form.Group>
              <Form.Group controlId="account_team"><Form.Label>팀</Form.Label><Form.Select value={form.team} onChange={event => change('team', event.target.value)} disabled={selected.level === '대표'} required>{teamOptions.map(value => <option key={value}>{value}</option>)}</Form.Select></Form.Group>
              <Form.Group controlId="account_department"><Form.Label>부서</Form.Label><Form.Control value={department} readOnly /></Form.Group>
            </div>
          </fieldset>
          {root && <fieldset disabled={locked || isRoot(selected)}>
            <legend>열람 및 작업 권한</legend>
            <Form.Group controlId="account_ad_scope" className="account_settings_scope"><Form.Label>광고 열람</Form.Label><Form.Select value={form.adVisibilityScope} onChange={event => change('adVisibilityScope', event.target.value)}>{scopes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Form.Select></Form.Group>
            <div className="account_settings_permissions">{permissionFields.map(([key, label]) => <Form.Check key={key} id={`account_${key}`} type="switch" role="switch" label={label} checked={form[key]} onChange={event => change(key, event.target.checked)} disabled={key === 'canViewTeamSales' && !storageReady} />)}</div>
          </fieldset>}
          <fieldset disabled={locked}><legend>비밀번호</legend><Form.Check id="account_password_reset" type="checkbox" label="비밀번호 초기화" checked={form.resetPassword} onChange={event => change('resetPassword', event.target.checked)} /></fieldset>
          <footer className="account_settings_actions">
            <Button type="button" variant="outline-secondary" disabled={!dirty || saving} onClick={() => { if (canLeave()) setForm(accountForm(selected)); }}><FontAwesomeIcon icon={faRotateLeft} /> 취소</Button>
            <Button type="submit" disabled={locked || !dirty || !form.loginId || !form.team}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? '저장 중...' : '저장'}</Button>
          </footer>
        </Form>}
      </div>
    </div>}
  </section>;
}
