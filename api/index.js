const express = require('express');
const app = express();
const apiRouter = express.Router();

app.use(express.json());

// 예시 사용자 데이터
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

// 회원가입 API
apiRouter.post('/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수입니다.' });
  }
  if (users.find(u => u.email === email)) {
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

// 사용자 목록 API (경로는 /api/users)
apiRouter.get('/users', (req, res) => {
  res.json(users);
});

// 모든 API는 /api 경로로 묶기
app.use('/api', apiRouter);

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('서버 내부 오류입니다.');
});

// 로컬 개발용 listen (배포 시 제거)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

module.exports = app;