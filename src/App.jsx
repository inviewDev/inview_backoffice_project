import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Fetching /api/users');
    fetch('/api/users', {
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(res => {
        console.log('Response status:', res.status);
        console.log('Response headers:', res.headers);
        if (!res.ok) {
          return res.text().then(text => {
            throw new Error(`API error ${res.status}: ${text}`);
          });
        }
        return res.json();
      })
      .then(jsonData => {
        console.log('Received data:', jsonData);
        setData(jsonData);
        setError(null);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
      });
  }, []);

  return (
    <div>
      <h1>
        {error ? `에러: ${error}` : data ? JSON.stringify(data) : '로딩 중...'}
      </h1>
    </div>
  );
}

export default App;