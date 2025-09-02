import { Routes, Route, Link } from 'react-router-dom';
import UserList from './UserList.jsx';
import Signup from './Signup.jsx';

function App() {
  return (
    <div>
      <nav style={{ padding: '20px', backgroundColor: '#f5f5f5', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '20px' }}>사용자 목록</Link>
        <Link to="/signup">회원가입</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<UserList />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  );
}

export default App;