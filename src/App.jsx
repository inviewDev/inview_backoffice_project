import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/users')
      .then(res => {
        console.log('Response status:', res.status);  // 응답 상태 로그 (200이 나와야 함)
        console.log('Response headers:', res.headers);  // 헤더 로그 (디버깅용)
        if (!res.ok) {
          return res.text().then(text => {
            throw new Error(`API error ${res.status}: ${text}`);  // 에러 시 응답 텍스트 출력
          });
        }
        return res.json();
      })
      .then(jsonData => {
        console.log('Received data:', jsonData);  // 성공 시 데이터 로그
        setData(jsonData);
      })
      .catch(err => {
        console.error('Fetch error:', err);  // 전체 에러 로그 (ECONNREFUSED 등 상세)
      });
  }, []);

  return (
    <div>
      <h1>백오피스 데이터: {data ? JSON.stringify(data) : 'Loading...'}</h1>
    </div>
  );
}

export default App;