import { useEffect, useState } from 'react';

function UserList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token'); // 로그인 시 저장된 JWT 토큰 읽기

    fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`, // 서버에 JWT 토큰 전달
      }
    })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => { throw new Error(`API 에러 ${res.status}: ${text}`); });
        }
        return res.json();
      })
      .then(json => {
        setData(json);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p>로딩중...</p>;
  if (error) return <p style={{ color: 'red' }}>에러: {error}</p>;

  return (
    <div>
      <h1>사용자 목록</h1>
      <ul>
        {data && data.length > 0 ? data.map(user => (
          <li key={user.id}>
            <p>ID: {user.id}</p> 이메일: {user.email}, 이름: {user.name}, 역할: {user.role}, 팀: {user.team}, 부서: {user.department}
          </li>
        )) : <li>사용자가 없습니다.</li>}
      </ul>
    </div>
  );
}

export default UserList;
