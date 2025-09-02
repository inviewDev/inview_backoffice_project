const express = require('express');
const app = express();
const apiRouter = express.Router();

app.use(express.json());

// 임시 사용자 데이터 (나중에 DB로 대체)
const users = [
  {
    id: 1,
    email: 'admin@inview.com',
    password: 'admin123', // 실제로는 해시 처리 필요
    name: 'Admin',
    role: 'admin',
    isMaster: true // 마스터 계정 플래그
  }
];

// 회원가입 엔드포인트
apiRouter.post('/signup', (req, res) => {
  const { email, password, name } = req.body;

  // 입력 검증
  if (!email || !password || !name) {
    return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수입니다.' });
  }

  // 이메일 중복 체크
  if (users.find(user => user.email === email)) {
    return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
  }

  // 새 사용자 추가
  const newUser = {
    id: users.length + 1,
    email,
    password, // 실제로는 bcrypt로 해시 처리
    name,
    role: 'user', // 기본적으로 일반 사용자
    isMaster: false // 마스터 계정은 기본적으로 false
  };
  users.push(newUser);

  res.status(201).json({ message: '회원가입 성공', user: { id: newUser.id, email, name, role: newUser.role } });
});

// 사용자 목록 조회 (마스터 계정 전용)
apiRouter.get('/users', (req, res) => {
  console.log('Accessing /api/users endpoint');
  // 마스터 계정 확인 로직 (임시로 이메일 기반, 나중에 토큰 인증 추가)
  const masterUser = users.find(user => user.email === 'admin@inview.com' && user.isMaster);
  if (!masterUser) {
    return res.status(403).json({ error: '마스터 계정만 접근 가능합니다.' });
  }
  res.json(users);
});

// 기존 루트 엔드포인트
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.send('Hello from Express backend on Vercel!');
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;