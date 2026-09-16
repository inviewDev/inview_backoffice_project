import { Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function UserManagementTabs({ activeKey, canManage, beforeNavigate = () => true }) {
  const navigate = useNavigate();
  return <Tabs activeKey={activeKey} className="userlist_tabs" onSelect={key => {
    if (key === activeKey || !beforeNavigate()) return;
    navigate(key === 'accounts' ? '/users/account-settings' : `/users?tab=${key}`);
  }}>
    <Tab eventKey="users" title="직원목록" />
    <Tab eventKey="pending" title="대기목록" />
    {canManage && <Tab eventKey="accounts" title="계정설정" />}
  </Tabs>;
}
