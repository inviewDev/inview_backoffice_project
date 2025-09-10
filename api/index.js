const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();
const app = express();
const apiRouter = express.Router();

app.use(express.json());

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '토큰이 필요합니다.' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    req.user = decoded;
    next();
  });
}

function verifyAdminRole(req, res, next) {
  if (req.user.role !== '전체관리자' && req.user.role !== '관리자') {
    return res.status(403).json({ error: '전체관리자 또는 관리자 계정만 접근 가능합니다.' });
  }
  next();
}

function verifyMasterRole(req, res, next) {
  if (req.user.role !== '전체관리자') {
    return res.status(403).json({ error: '마스터 계정만 접근 가능합니다.' });
  }
  next();
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

apiRouter.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level || '미지정',
        team: user.team || '미지정',
        department: user.department || '미지정',
        phoneNumber: user.phoneNumber || '미지정',
        birthDate: user.birthDate ? user.birthDate.toISOString() : '미지정',
        officePhoneNumber: user.officePhoneNumber || '미지정',
      },
    });
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name, team, level, phoneNumber, birthDate } = req.body;
    if (!email || !password || !name || !team || !phoneNumber || !birthDate) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름, 소속팀, 휴대전화번호, 생년월일은 필수입니다.' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const mappedDepartment = teamDepartmentMapping[team] || '기타부서';

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        team,
        department: mappedDepartment,
        role: '사용자',
        status: '가입대기',
        level: level || '사원',
        phoneNumber,
        birthDate: new Date(birthDate),
        officePhoneNumber: null,
      },
    });

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        level: newUser.level,
        team: newUser.team,
        department: newUser.department,
        phoneNumber: newUser.phoneNumber,
        birthDate: newUser.birthDate.toISOString(),
        officePhoneNumber: newUser.officePhoneNumber,
      },
      SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: '회원가입 신청이 완료되었습니다. 관리자 승인을 기다려 주세요.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        team: newUser.team,
        department: newUser.department,
        role: newUser.role,
        status: newUser.status,
        level: newUser.level,
        phoneNumber: newUser.phoneNumber,
        birthDate: newUser.birthDate.toISOString(),
        officePhoneNumber: newUser.officePhoneNumber,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호가 필요합니다.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.status === '가입대기') return res.status(403).json({ error: '회원가입 승인 대기중입니다.' });
    if (user.status === '퇴사') return res.status(403).json({ error: '계정이 정지되었습니다.' });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        team: user.team,
        department: user.department,
        phoneNumber: user.phoneNumber,
        birthDate: user.birthDate ? user.birthDate.toISOString() : null,
        officePhoneNumber: user.officePhoneNumber,
      },
      SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level || '미지정',
        team: user.team || '미지정',
        department: user.department || '미지정',
        phoneNumber: user.phoneNumber || '미지정',
        birthDate: user.birthDate ? user.birthDate.toISOString() : '미지정',
        officePhoneNumber: user.officePhoneNumber || '미지정',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { email, password, phoneNumber, birthDate, officePhoneNumber } = req.body;

  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: '자신의 정보만 수정할 수 있습니다.' });
  }

  try {
    const dataToUpdate = {};
    if (email) dataToUpdate.email = email;
    if (phoneNumber) dataToUpdate.phoneNumber = phoneNumber;
    if (birthDate) dataToUpdate.birthDate = new Date(birthDate);
    if (officePhoneNumber !== undefined) dataToUpdate.officePhoneNumber = officePhoneNumber;
    if (password) dataToUpdate.passwordHash = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({
      message: '사용자 정보가 수정되었습니다.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        level: updatedUser.level || '미지정',
        team: updatedUser.team || '미지정',
        department: updatedUser.department || '미지정',
        phoneNumber: updatedUser.phoneNumber || '미지정',
        birthDate: updatedUser.birthDate ? updatedUser.birthDate.toISOString() : '미지정',
        officePhoneNumber: updatedUser.officePhoneNumber || '미지정',
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '사용자 정보 수정 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/memos', verifyToken, async (req, res) => {
  try {
    const memos = await prisma.personalMemo.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    res.json(memos);
  } catch (error) {
    console.error('Fetch memos error:', error);
    res.status(500).json({ error: '메모 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/memos', verifyToken, async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: '메모 내용이 필요합니다.' });
  }

  try {
    const memo = await prisma.personalMemo.create({
      data: { userId: req.user.id, content },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    res.json({ message: '메모가 저장되었습니다.', memo });
  } catch (error) {
    console.error('Save memo error:', error);
    res.status(500).json({ error: '메모 저장 중 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/memos/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: '메모 내용이 필요합니다.' });
  }

  try {
    const memo = await prisma.personalMemo.findUnique({
      where: { id: parseInt(id) },
    });
    if (!memo || memo.userId !== req.user.id) {
      return res.status(403).json({ error: '해당 메모를 수정할 권한이 없습니다.' });
    }
    const updatedMemo = await prisma.personalMemo.update({
      where: { id: parseInt(id) },
      data: { content, updatedAt: new Date() },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
    });
    res.json({ message: '메모가 수정되었습니다.', memo: updatedMemo });
  } catch (error) {
    console.error('Update memo error:', error);
    res.status(500).json({ error: '메모 수정 중 오류가 발생했습니다.' });
  }
});

apiRouter.delete('/memos/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const memo = await prisma.personalMemo.findUnique({
      where: { id: parseInt(id) },
    });
    if (!memo || memo.userId !== req.user.id) {
      return res.status(403).json({ error: '해당 메모를 삭제할 권한이 없습니다.' });
    }
    await prisma.personalMemo.delete({ where: { id: parseInt(id) } });
    res.json({ message: '메모가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete memo error:', error);
    res.status(500).json({ error: '메모 삭제 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/events', verifyToken, async (req, res) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: { userId: req.user.id },
      select: { id: true, title: true, start: true, endTime: true },
    });
    res.json(events);
  } catch (error) {
    console.error('Fetch events error:', error);
    res.status(500).json({ error: '이벤트 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/events', verifyToken, async (req, res) => {
  const { title, start, endTime } = req.body;
  if (!title || !start || !endTime) {
    return res.status(400).json({ error: '이벤트 제목, 시작 시간, 종료 시간이 필요합니다.' });
  }

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        userId: req.user.id,
        title,
        start: new Date(start),
        endTime: new Date(endTime),
      },
      select: { id: true, title: true, start: true, endTime: true },
    });
    res.json({ message: '이벤트가 추가되었습니다.', ...event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: '이벤트 추가 중 오류가 발생했습니다.' });
  }
});

apiRouter.delete('/events/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: parseInt(id) },
    });
    if (!event || event.userId !== req.user.id) {
      return res.status(403).json({ error: '해당 이벤트를 삭제할 권한이 없습니다.' });
    }
    await prisma.calendarEvent.delete({ where: { id: parseInt(id) } });
    res.json({ message: '이벤트가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: '이벤트 삭제 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/users/pending', verifyToken, verifyAdminRole, async (req, res) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: '가입대기' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json(pendingUsers);
  } catch (error) {
    console.error('Fetch pending users error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/users/:id/approve', verifyToken, verifyMasterRole, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.status !== '가입대기') return res.status(400).json({ error: '이미 처리된 사용자입니다.' });

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: '재직' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({ message: '사용자 승인 완료', user: updatedUser });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/users/:id/reject', verifyToken, verifyMasterRole, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.status !== '가입대기') return res.status(400).json({ error: '이미 처리된 사용자입니다.' });

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: '퇴사' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({ message: '사용자 거절 완료', user: updatedUser });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/users/:id/status', verifyToken, verifyMasterRole, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({ message: '상태 변경 완료', user: updatedUser });
  } catch (error) {
    console.error('Change status error:', error);
    res.status(500).json({ error: '상태 변경 중 오류가 발생했습니다.' });
  }
});

const ROLE_OPTIONS = ['전체관리자', '관리자', '팀장', '사용자'];

apiRouter.post('/users/:id/role', verifyToken, verifyMasterRole, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!ROLE_OPTIONS.includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 권한 값입니다.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({ message: '권한 변경 완료', user: updatedUser });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: '권한 변경 중 오류가 발생했습니다.' });
  }
});

const LEVEL_OPTIONS = ['대표', '파트장', '팀장', '과장', '대리', '주임', '사원'];

apiRouter.post('/users/:id/level', verifyToken, verifyMasterRole, async (req, res) => {
  const { id } = req.params;
  const { level } = req.body;

  if (!LEVEL_OPTIONS.includes(level)) {
    return res.status(400).json({ error: '유효하지 않은 직급 값입니다.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { level },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json({ message: '직급 변경 완료', user: updatedUser });
  } catch (error) {
    console.error('Change level error:', error);
    res.status(500).json({ error: '직급 변경 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/users', verifyToken, verifyAdminRole, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: { in: ['재직', '퇴사'] } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        level: true,
        team: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        officePhoneNumber: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
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