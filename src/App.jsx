import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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
        setError(null);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
      });
  }, []);

  return (
    <div>
      <h1>Data: {error ? `Error: ${error}` : (data ? JSON.stringify(data) : 'Loading...')}</h1>
    </div>
  );
}

export default App;