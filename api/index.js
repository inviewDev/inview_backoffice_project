const express = require('express');
const app = express();
const apiRouter = express.Router();

app.use(express.json());

// 임시 사용자 데이터
const users = [
  {
    id: 1,
    email: 'admin@inview.com',
    password: 'admin123',
    name: 'Admin',
    role: 'admin',
    isMaster: true
  }
];

// 회원가입 엔드포인트
apiRouter.post('/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수입니다.' });
  }
  if (users.find(user => user.email === email)) {
    return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
  }
  const newUser = {
    id: users.length + 1,
    email,
    password,
    name,
    role: 'user',
    isMaster: false
  };
  users.push(newUser);
  res.status(201).json({ message: '회원가입 성공', user: { id: newUser.id, email, name, role: newUser.role } });
});

// 사용자 목록 조회 (마스터 계정 전용)
apiRouter.get('/users', (req, res) => {
  console.log('Accessing /api/users endpoint');
  const masterUser = users.find(user => user.email === 'admin@inview.com' && user.isMaster);
  if (!masterUser) {
    return res.status(403).json({ error: '마스터 계정만 접근 가능합니다.' });
  }
  res.json(users);
});

app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;