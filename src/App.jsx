import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/users')  // Vercel에서 배포 후 상대 경로로 호출
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1>백오피스 데이터: {data ? JSON.stringify(data) : 'Loading...'}</h1>
    </div>
  );
}

export default App;