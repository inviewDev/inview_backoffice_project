require('dotenv').config({ quiet: true });

const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');

const SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();
const app = express();
const apiRouter = express.Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(express.json({ limit: '4mb' }));

apiRouter.use((req, res, next) => {
  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter(name => !process.env[name]);

  if (missingEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    return res.status(500).json({
      error: `Server configuration error: missing ${missingEnv.join(', ')}`,
    });
  }

  next();
});

const ROLE_OPTIONS = ['전체관리자', '관리자', '팀장', '사용자'];
const STATUS_OPTIONS = ['가입대기', '재직', '퇴사'];
const LEVEL_OPTIONS = ['대표', '파트장', '팀장', '과장', '대리', '주임', '사원'];
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isAdminRole(role) {
  return role === '전체관리자' || role === '관리자';
}

function canAccessUser(req, userId) {
  return req.user.id === userId || isAdminRole(req.user.role);
}

function validateProfileImageDataUrl(profileImage) {
  if (profileImage === null || profileImage === '') {
    return { value: null };
  }

  if (typeof profileImage !== 'string') {
    return { error: '프로필 이미지를 확인해주세요.' };
  }

  const match = profileImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return { error: '프로필 이미지는 올바른 이미지 파일만 등록할 수 있습니다.' };
  }

  const [, mimeType, base64Body] = match;
  if (!PROFILE_IMAGE_TYPES.has(mimeType)) {
    return { error: '프로필 이미지는 JPG, PNG, WEBP, GIF 파일만 등록할 수 있습니다.' };
  }

  const imageSize = Buffer.byteLength(base64Body, 'base64');
  if (imageSize >= MAX_PROFILE_IMAGE_SIZE) {
    return { error: '프로필 이미지는 2MB 미만 파일만 등록할 수 있습니다.' };
  }

  return { value: profileImage };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAppUrl(req) {
  return process.env.APP_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`;
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resend || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('메일 발송 설정이 필요합니다.');
    }
    console.warn(`Password reset email is not configured. Reset URL for ${to}: ${resetUrl}`);
    return { configured: false };
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject: '[아이앤뷰 백오피스] 비밀번호 재설정 안내',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>비밀번호 재설정</h2>
        <p>${name || '사용자'}님, 비밀번호 재설정을 요청하셨습니다.</p>
        <p>아래 버튼을 눌러 30분 안에 새 비밀번호를 설정해주세요.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#ff2174;color:#fff;text-decoration:none;border-radius:4px;">
            비밀번호 재설정
          </a>
        </p>
        <p>버튼이 열리지 않으면 아래 주소를 브라우저에 붙여넣어 주세요.</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        <p>요청하지 않았다면 이 메일은 무시하셔도 됩니다.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || '메일 발송에 실패했습니다.');
  }

  return { configured: true };
}

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
  if (!isAdminRole(req.user.role)) {
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
        profileImage: true,
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
        profileImage: user.profileImage || '',
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
        profileImage: newUser.profileImage || '',
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
        profileImage: newUser.profileImage || '',
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
        profileImage: user.profileImage || '',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/password-reset/request', async (req, res) => {
  const { email } = req.body;
  const genericMessage = '가입된 이메일이라면 비밀번호 재설정 링크를 발송했습니다.';

  if (!email) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const resetUrl = `${getAppUrl(req).replace(/\/$/, '')}/reset-password?token=${token}`;

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    let emailResult;
    try {
      emailResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
      return res.status(500).json({ error: '비밀번호 재설정 메일 발송에 실패했습니다. 관리자에게 문의해주세요.' });
    }

    const response = { message: genericMessage };
    if (!emailResult.configured && process.env.NODE_ENV !== 'production') {
      response.devResetUrl = resetUrl;
    }
    res.json(response);
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: '비밀번호 재설정 요청 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: '토큰과 새 비밀번호가 필요합니다.' });
  }
  if (password.length < 8 || !/[!@#$%^&*]/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이며 특수문자를 포함해야 합니다.' });
  }

  try {
    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 재설정 링크입니다.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: '비밀번호 재설정 중 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { email, password, phoneNumber, birthDate, officePhoneNumber, profileImage } = req.body;

  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: '자신의 정보만 수정할 수 있습니다.' });
  }

  try {
    const dataToUpdate = {};
    if (email) dataToUpdate.email = email;
    if (phoneNumber) dataToUpdate.phoneNumber = phoneNumber;
    if (birthDate) dataToUpdate.birthDate = new Date(birthDate);
    if (officePhoneNumber !== undefined) dataToUpdate.officePhoneNumber = officePhoneNumber;
    if (profileImage !== undefined) {
      const validatedProfileImage = validateProfileImageDataUrl(profileImage);
      if (validatedProfileImage.error) {
        return res.status(400).json({ error: validatedProfileImage.error });
      }
      dataToUpdate.profileImage = validatedProfileImage.value;
    }
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
        profileImage: true,
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
        profileImage: updatedUser.profileImage || '',
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '사용자 정보 수정 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/users/:id/officePhoneNumber', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { officePhoneNumber } = req.body;
  const userId = parseInt(id, 10);

  if (userId !== req.user.id) {
    return res.status(403).json({ error: '자신의 정보만 수정할 수 있습니다.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { officePhoneNumber: officePhoneNumber || null },
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
        profileImage: true,
      },
    });

    res.json({
      message: '사내전화번호가 수정되었습니다.',
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
        profileImage: updatedUser.profileImage || '',
      },
    });
  } catch (error) {
    console.error('Update officePhoneNumber error:', error);
    res.status(500).json({ error: '사내전화번호 수정 중 오류가 발생했습니다.' });
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

apiRouter.post('/company', verifyToken, async (req, res) => {
  const {
    userId,
    companyName,
    ceoName,
    businessRegNumber,
    birthDate,
    tel,
    mobile,
    postcode,
    address,
    detailAddress,
    companyUrl,
    companyEmail,
  } = req.body;
  const targetUserId = parseInt(userId || req.user.id, 10);

  if (!canAccessUser(req, targetUserId)) {
    return res.status(403).json({ error: '해당 사용자 정보에 접근할 권한이 없습니다.' });
  }
  if (!companyName || !ceoName || !businessRegNumber || !birthDate || !tel || !mobile || !postcode || !address || !companyEmail) {
    return res.status(400).json({ error: '회사 필수 정보를 모두 입력해주세요.' });
  }
  if (!/^\d{3}-\d{2}-\d{5}$/.test(businessRegNumber)) {
    return res.status(400).json({ error: '사업자등록번호 형식이 올바르지 않습니다.' });
  }
  if (!/^\d{6}$/.test(birthDate)) {
    return res.status(400).json({ error: '생년월일은 6자리 숫자여야 합니다.' });
  }
  if (!companyEmail.includes('@')) {
    return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요.' });
  }

  try {
    const company = await prisma.company.create({
      data: {
        userId: targetUserId,
        companyName,
        ceoName,
        businessRegNumber,
        birthDate,
        tel,
        mobile,
        postcode,
        address,
        detailAddress: detailAddress || null,
        companyUrl: companyUrl || null,
        companyEmail,
      },
    });

    res.status(201).json({ message: '회사 정보가 등록되었습니다.', company });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: '회사 정보 등록 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/payment', verifyToken, async (req, res) => {
  const {
    userId,
    productName,
    startDate,
    endDate,
    approvedCompany,
    taxInvoice,
    paymentMethod,
  } = req.body;
  const targetUserId = parseInt(userId || req.user.id, 10);
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  if (!canAccessUser(req, targetUserId)) {
    return res.status(403).json({ error: '해당 사용자 정보에 접근할 권한이 없습니다.' });
  }
  if (!productName || !startDate || !endDate || !approvedCompany || !taxInvoice || !paymentMethod) {
    return res.status(400).json({ error: '결제 필수 정보를 모두 입력해주세요.' });
  }
  if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
    return res.status(400).json({ error: '계약기간 날짜 형식이 올바르지 않습니다.' });
  }
  if (parsedEndDate < parsedStartDate) {
    return res.status(400).json({ error: '종료일은 시작일보다 늦어야 합니다.' });
  }

  try {
    const latestCompany = await prisma.company.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const payment = await prisma.payment.create({
      data: {
        userId: targetUserId,
        companyId: latestCompany?.id || null,
        productName,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        approvedCompany,
        taxInvoice,
        paymentMethod,
      },
    });

    res.status(201).json({ message: '결제 정보가 등록되었습니다.', payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: '결제 정보 등록 중 오류가 발생했습니다.' });
  }
});

function toDateString(value) {
  return value ? value.toISOString().split('T')[0] : '';
}

function sumBy(items, field) {
  return items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
}

apiRouter.get('/payroll', verifyToken, async (req, res) => {
  const targetUserId = parseInt(req.query.userId || req.user.id, 10);

  if (!canAccessUser(req, targetUserId)) {
    return res.status(403).json({ error: '해당 급여 명세서를 조회할 권한이 없습니다.' });
  }

  try {
    const payroll = await prisma.payroll.findFirst({
      where: { userId: targetUserId },
      orderBy: { periodEnd: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            team: true,
            department: true,
          },
        },
        salesDetails: {
          orderBy: { registrationDate: 'asc' },
        },
        cancellationDetails: {
          orderBy: { registrationDate: 'asc' },
        },
      },
    });

    if (!payroll) {
      return res.json(null);
    }

    const salesDetails = payroll.salesDetails.map(detail => ({
      status: '매출',
      registrationDate: toDateString(detail.registrationDate),
      product: detail.product,
      approvedAmount: detail.approvedAmount,
      vatExcludedSales: detail.vatExcludedSales,
      actualCost: detail.actualCost,
      safetyFund: detail.safetyFund,
      allowanceBase: detail.allowanceBase,
      salesAllowance: detail.salesAllowance,
    }));
    const cancellationDetails = payroll.cancellationDetails.map(detail => ({
      status: '취소',
      registrationDate: toDateString(detail.registrationDate),
      product: detail.product,
      cancellationAmount: detail.cancellationAmount,
      vat: detail.vat,
      cancellationBase: detail.cancellationBase,
      safetyFund: detail.safetyFund,
      cancellationAllowance: detail.cancellationAllowance,
    }));
    const totalCancellationAmount = sumBy(cancellationDetails, 'cancellationAmount');
    const subTotal = payroll.commissionSupport + payroll.allowance - totalCancellationAmount;

    res.json({
      id: payroll.id,
      periodStart: toDateString(payroll.periodStart),
      periodEnd: toDateString(payroll.periodEnd),
      department: payroll.user.department || '미지정',
      team: payroll.user.team || '미지정',
      commissionRates: [],
      salesDetails,
      cancellationDetails,
      totalApprovedAmount: sumBy(salesDetails, 'approvedAmount'),
      totalVatExcluded: sumBy(salesDetails, 'vatExcludedSales'),
      totalActualCost: sumBy(salesDetails, 'actualCost'),
      totalSafetyFund: sumBy(salesDetails, 'safetyFund'),
      totalAllowanceBase: sumBy(salesDetails, 'allowanceBase'),
      totalSalesAllowance: sumBy(salesDetails, 'salesAllowance'),
      totalCancellationAmount,
      totalVat: sumBy(cancellationDetails, 'vat'),
      totalCancellationBase: sumBy(cancellationDetails, 'cancellationBase'),
      totalSafetyFundCancellation: sumBy(cancellationDetails, 'safetyFund'),
      totalCancellationAllowance: sumBy(cancellationDetails, 'cancellationAllowance'),
      totalSales: payroll.totalSales,
      totalCancellations: payroll.totalCancellations,
      commissionSupport: payroll.commissionSupport,
      allowance: payroll.allowance,
      subTotal,
      tax: payroll.tax,
      educationFee: payroll.educationFee,
      mealFee: payroll.mealFee,
      netIncome: payroll.netIncome,
    });
  } catch (error) {
    console.error('Fetch payroll error:', error);
    res.status(500).json({ error: '급여 명세서 조회 중 오류가 발생했습니다.' });
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

  if (!STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태 값입니다.' });
  }

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

app.use((err, req, res, _next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
