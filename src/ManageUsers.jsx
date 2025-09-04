import { useState, useEffect } from 'react';
import './index.css';

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          throw new Error('사용자 목록 조회 실패');
        }

        const data = await response.json();
        setUsers(data);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="manage-users-container">
      <h1>사용자 관리 (마스터 계정)</h1>
      {isLoading ? (
        <p>로딩 중...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>에러: {error}</p>
      ) : (
        <ul>
          {users.map(user => (
            <li key={user.id}>
              <p>ID: {user.id}</p> 이메일: {user.email}, 이름: {user.name}, 역할: {user.role}, 팀: {user.team}, 부서: {user.department}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ManageUsers;