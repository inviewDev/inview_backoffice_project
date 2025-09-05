const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();
const app = express();
const apiRouter = express.Router();

app.use(express.json());

// JWT 인증 및 MASTER 역할 미들웨어
function verifyMasterRole(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '토큰이 필요합니다.' });
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    if (decoded.role !== 'MASTER') {
      return res.status(403).json({ error: '마스터 계정만 접근 가능합니다.' });
    }
    req.user = decoded; // 인증 정보 요청에 전달
    next();
  });
}

const teamDepartmentMapping = {
  '1팀': '1부서',
  '3팀': '1부서',
  '4팀': '1부서',
  '2팀': '2부서',
  '5팀': '2부서',
  '6팀': '2부서',
  '개발관리부': '운영부서',
};

// 회원가입 엔드포인트
apiRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name, team } = req.body;
    if (!email || !password || !name || !team) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름, 소속팀은 필수입니다.' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const mappedDepartment = teamDepartmentMapping[team] || '기타부서';

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        team,
        department: mappedDepartment,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    res.status(201).json({
      message: '회원가입 성공',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        team: newUser.team,
        department: newUser.department,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 엔드포인트 (JWT 토큰 발급)
apiRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호가 필요합니다.' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
    }
    // JWT 토큰 발급
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      SECRET,
      { expiresIn: '1h' }
    );
    res.json({
      message: '로그인 성공',
      token, // 클라이언트에 전달
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        team: user.team,
        department: user.department,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 목록 조회 - JWT 인증+마스터 권한 필요하게 변경!
apiRouter.get('/users', verifyMasterRole, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, team: true, department: true },
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
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
