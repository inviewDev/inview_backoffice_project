import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
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
            ID: {user.id} / 이름: {user.name} / 역할: {user.role}
          </li>
        )) : <li>사용자가 없습니다.</li>}
      </ul>
    </div>
  );
}

export default App;