import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/users')
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
      })
      .catch(err => {
        console.error('Fetch error:', err);
      });
  }, []);

  return (
    <div>
      <h1>백오피스 데이터: {data ? JSON.stringify(data) : 'Loading...'}</h1>
    </div>
  );
}

export default App;