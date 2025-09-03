const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const apiRouter = express.Router();

app.use(express.json());

// 회원가입 엔드포인트
apiRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수입니다.' });
    }

    // 중복 이메일 확인 (DB 조회)
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 해시 생성
    const hashedPassword = await bcrypt.hash(password, 10);

    // DB에 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
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
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 엔드포인트 추가
apiRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호가 필요합니다.' });
    }

    // 사용자 이메일로 조회
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 비밀번호 해시 비교
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
    }

    // 로그인 성공 시 사용자 정보 반환 (토큰 생성 예정)
    res.json({
      message: '로그인 성공',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 목록 조회 (마스터 계정만 접근 가능하도록 간단한 권한 체크 포함)
apiRouter.get('/users', async (req, res) => {
  try {
    // 임시: 헤더 'x-user-role'에서 권한 확인 (실제론 JWT 등 인증방식 적용 권장)
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'MASTER') {
      return res.status(403).json({ error: '마스터 계정만 접근 가능합니다.' });
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true },
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
