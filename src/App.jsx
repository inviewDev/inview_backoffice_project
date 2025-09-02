import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching /api/users');
      try {
        const response = await fetch('/api/users', {
          headers: {
            'Accept': 'application/json',
          },
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`API 에러 ${response.status}: ${text}`);
        }

        const jsonData = await response.json();
        console.log('Received data:', jsonData);
        setData(jsonData);
        setError(null);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>사용자 데이터</h1>
      {isLoading ? (
        <p>로딩 중...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>에러: {error}</p>
      ) : (
        <>
          <p style={{ color: 'green' }}>Complete: 데이터 로드 성공!</p>
          <ul>
            {data && data.length > 0 ? (
              data.map(user => (
                <li key={user.id}>
                  ID: {user.id}, 이름: {user.name}, 역할: {user.role}
                </li>
              ))
            ) : (
              <p>데이터 없음</p>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;