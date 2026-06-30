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

app.use(express.json({ limit: '8mb' }));

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
const ADMIN_COMMENT_LEVELS = new Set(['대표', '파트장', '팀장']);
const MASTER_LOGIN_IDS = new Set(['cchee', 'cchee@gmail.com']);
const AD_VISIBILITY_SCOPE_OPTIONS = ['own', 'team', 'department', 'all'];
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const USER_DELETE_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 120000,
};
const ACCESS_TOKEN_EXPIRES_IN = '5h';

function isAdminRole(role) {
  return role === '전체관리자' || role === '관리자';
}

function isMasterAccount(user) {
  return MASTER_LOGIN_IDS.has(String(user?.email || '').trim().toLowerCase());
}

function normalizeAdVisibilityScope(scope) {
  const value = String(scope || '').trim();
  return AD_VISIBILITY_SCOPE_OPTIONS.includes(value) ? value : 'own';
}

function canAccessAdminComments(user) {
  return ADMIN_COMMENT_LEVELS.has(user?.level) || user?.role === '팀장' || isAdminRole(user?.role);
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

function toOptionalString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function toMoneyNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeCardNumber(value) {
  const text = toOptionalString(value);
  if (!text) return { value: null };

  const digits = text.replace(/\D/g, '');
  if (!digits) return { value: text };

  return {
    value: digits.match(/.{1,4}/g).join('-'),
  };
}

function normalizeCardExpiryMonth(value) {
  const text = toOptionalString(value);
  if (!text) return null;

  const digits = text.replace(/\D/g, '').slice(0, 2);
  const month = Number(digits);
  if (!month || month < 1 || month > 12) return text;

  return String(month).padStart(2, '0');
}

function normalizeCardExpiryYear(value) {
  const text = toOptionalString(value);
  if (!text) return null;
  return text.replace(/\D/g, '').slice(0, 2) || null;
}

function normalizeProductItems(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeProductItemSlots(value) {
  if (!Array.isArray(value)) return Array(10).fill('');

  return Array.from({ length: 10 }, (_, index) => String(value[index] || '').trim());
}

function getPaymentProductItems(payment) {
  if (Array.isArray(payment.productItems)) {
    return normalizeProductItems(payment.productItems);
  }

  return [];
}

function getPaymentProductItemSlots(payment) {
  if (Array.isArray(payment.productItems)) {
    return normalizeProductItemSlots(payment.productItems);
  }

  return Array(10).fill('');
}

function getAppUrl(req) {
  return process.env.APP_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`;
}

function normalizePhoneNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function formatPhoneNumber(value) {
  const digits = normalizePhoneNumber(value);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || '';
}

function makeAgreementToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function getAgreementUrl(req, token) {
  return `${getAppUrl(req).replace(/\/$/, '')}/agreement/${token}`;
}

function getCompanyHomeUrl() {
  return process.env.COMPANY_HOME_URL || 'https://www.inviewcc.com';
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

function mapPaymentToAgreement(payment) {
  const productItems = getPaymentProductItems(payment);

  return {
    id: payment.id,
    companyName: payment.company?.companyName || '',
    ceoName: payment.company?.ceoName || '',
    businessRegNumber: payment.company?.businessRegNumber || '',
    tel: payment.company?.tel || '',
    mobile: payment.company?.mobile || '',
    address: [
      payment.company?.postcode && `(${payment.company.postcode})`,
      payment.company?.address,
      payment.company?.detailAddress,
    ].filter(Boolean).join(' '),
    companyUrl: payment.company?.companyUrl || '',
    companyEmail: payment.company?.companyEmail || '',
    productName: payment.productName,
    approvedAmount: payment.approvedAmount,
    vat: payment.vat,
    paymentMethod: payment.paymentMethod,
    cardCompany: payment.cardCompany || '',
    installmentMonths: payment.installmentMonths || '',
    contractStartDate: toDateString(payment.startDate),
    contractEndDate: toDateString(payment.endDate),
    manager: payment.manager || payment.user?.name || '',
    managerPhone: payment.user?.officePhoneNumber || payment.user?.phoneNumber || '',
    managerEmail: payment.user?.email || '',
    productItems: productItems.length
      ? productItems
      : [
          payment.productName,
          payment.titleText,
          payment.descriptionText,
          payment.memo,
        ].filter(Boolean),
    smsContractStatus: payment.smsContractStatus,
    agreementStatus: payment.agreementStatus,
    agreementAt: payment.agreementAt ? payment.agreementAt.toISOString() : null,
  };
}

async function createUniqueAgreementToken() {
  for (let index = 0; index < 10; index += 1) {
    const token = makeAgreementToken();
    const exists = await prisma.smsConsentToken.findUnique({ where: { token }, select: { id: true } });
    if (!exists) return token;
  }
  throw new Error('동의 토큰 생성에 실패했습니다.');
}

async function sendRelaySms({ phoneNumber, message, subject }) {
  const relayUrl = process.env.SMS_RELAY_URL;
  const relaySecret = process.env.SMS_RELAY_SECRET;

  if (!relayUrl || !relaySecret) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${relaySecret}`,
        'Content-Type': 'application/json',
        'X-SMS-Relay-Secret': relaySecret,
      },
      body: JSON.stringify({
        phoneNumber: normalizePhoneNumber(phoneNumber),
        subject,
        message,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!response.ok || data.ok === false) {
      throw new Error(`Cafe24 SMS relay 오류: ${data.error || data.resultText || `HTTP ${response.status}`}`);
    }

    return {
      resultCode: data.resultCode || 'OK',
      resultText: `Cafe24 SMS relay: ${data.resultText || '전송 완료'}`,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Cafe24 SMS relay 응답 시간이 초과되었습니다.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendNiceSms({ phoneNumber, message, subject }) {
  const relayResult = await sendRelaySms({ phoneNumber, message, subject });
  if (relayResult) return relayResult;

  const userid = process.env.NICESMS_USERID || process.env.SMS_USERID;
  const password = process.env.NICESMS_PASSWORD || process.env.SMS_PASSWORD;
  const sender = process.env.NICESMS_SENDER || process.env.SMS_SENDER;

  if (!userid || !password || !sender) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('문자 발송 설정이 누락되었습니다.');
    }
    console.warn(`NICESMS is not configured. Dev SMS to ${phoneNumber}: ${message}`);
    return { resultCode: 'DEV', resultText: '개발 환경 문자 발송 생략' };
  }

  const params = new URLSearchParams({
    userid,
    password,
    subject,
    msg: message,
    receivers: normalizePhoneNumber(phoneNumber),
    sender: normalizePhoneNumber(sender),
    resflag: 'N',
  });

  const response = await fetch('https://sms.nicesms.co.kr/cpmms_utf8/cplms.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`문자왕국 API 오류: HTTP ${response.status}`);
  }

  const result = Object.fromEntries(new URLSearchParams(text));
  const resultCode = result.result || result.RESULT || 'UNKNOWN';
  const resultText = result.MSG || result.message || text;

  if (String(resultCode).toUpperCase() !== 'OK') {
    throw new Error(`문자왕국 직접 발송 실패: ${resultText || resultCode}`);
  }

  return { resultCode: 'OK', resultText };
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

async function getCurrentUserRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role || null;
}

async function getCurrentUserAccess(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      level: true,
      team: true,
      department: true,
      adVisibilityScope: true,
      canEditAds: true,
      canDeleteAds: true,
    },
  });
}

function canEditAdPayment(user) {
  return isMasterAccount(user) || user?.canEditAds === true || user?.role === '전체관리자' || user?.level === '대표';
}

function canDeleteAdPayment(user) {
  return isMasterAccount(user) || user?.canDeleteAds === true;
}

function getEffectiveAdVisibilityScope(user) {
  if (isMasterAccount(user)) return 'all';

  const configuredScope = normalizeAdVisibilityScope(user?.adVisibilityScope);
  if (configuredScope !== 'own') return configuredScope;

  if (user?.level === '대표') return 'all';
  if (user?.level === '파트장') return 'department';
  if (user?.level === '팀장' || user?.role === '팀장') return 'team';

  return 'own';
}

function buildTeamAdAccessFilter(user) {
  const team = String(user?.team || '').trim();
  if (!team || team === '미지정') return { userId: user.id };

  return {
    OR: [
      { userId: user.id },
      { managerTeam: team },
      { user: { is: { team } } },
    ],
  };
}

function buildDepartmentAdAccessFilter(user) {
  const department = String(user?.department || '').trim();
  const teams = getTeamsByDepartment(department);
  const filters = [{ userId: user.id }];

  if (department && department !== '미지정') {
    filters.push({ user: { is: { department } } });
  }
  if (teams.length > 0) {
    filters.push({ managerTeam: { in: teams } });
  }

  return { OR: filters };
}

function buildAdAccessFilter(user, targetUserId = null) {
  const filters = [];
  const scope = getEffectiveAdVisibilityScope(user);

  if (scope === 'team') {
    filters.push(buildTeamAdAccessFilter(user));
  } else if (scope === 'department') {
    filters.push(buildDepartmentAdAccessFilter(user));
  } else if (scope !== 'all') {
    filters.push({ userId: user.id });
  }

  if (targetUserId && scope === 'all') {
    filters.push({ userId: targetUserId });
  } else if (targetUserId && targetUserId === user.id) {
    filters.push({ userId: targetUserId });
  }

  return filters.length ? { AND: filters } : {};
}

function canViewAd(user, payment) {
  if (!user?.id || !payment?.id) return false;

  const scope = getEffectiveAdVisibilityScope(user);
  if (scope === 'all') return true;
  if (payment.userId === user.id) return true;

  if (scope === 'team') {
    return Boolean(
      user.team &&
      user.team !== '미지정' &&
      (
        payment.managerTeam === user.team ||
        payment.user?.team === user.team
      )
    );
  }

  if (scope === 'department') {
    const teams = getTeamsByDepartment(user.department);
    return Boolean(
      (user.department && user.department !== '미지정' && payment.user?.department === user.department) ||
      (payment.managerTeam && teams.includes(payment.managerTeam))
    );
  }

  return false;
}

function canViewAllAdsInList(user) {
  return getEffectiveAdVisibilityScope(user) === 'all';
}

function serializeAdComment(comment, currentUser) {
  return {
    id: comment.id,
    userId: comment.userId,
    isAdminOnly: Boolean(comment.isAdminOnly),
    author: comment.user?.name || '사용자',
    authorProfileImage: comment.user?.profileImage || '',
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    canManage: comment.userId === currentUser.id || isAdminRole(currentUser.role),
  };
}

async function verifyAdminRole(req, res, next) {
  try {
    const currentRole = await getCurrentUserRole(req.user.id);
    if (!currentRole) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!isAdminRole(currentRole)) {
      return res.status(403).json({ error: '전체관리자 또는 관리자 계정만 접근 가능합니다.' });
    }

    req.user.role = currentRole;
    next();
  } catch (error) {
    console.error('Verify admin role error:', error);
    res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
  }
}

async function verifyMasterRole(req, res, next) {
  try {
    const currentRole = await getCurrentUserRole(req.user.id);
    if (!currentRole) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (currentRole !== '전체관리자') {
      return res.status(403).json({ error: '전체관리자 계정만 접근 가능합니다.' });
    }

    req.user.role = currentRole;
    next();
  } catch (error) {
    console.error('Verify master role error:', error);
    res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
  }
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

function getTeamsByDepartment(department) {
  const targetDepartment = String(department || '').trim();
  if (!targetDepartment) return [];

  return Object.entries(teamDepartmentMapping)
    .filter(([, mappedDepartment]) => mappedDepartment === targetDepartment)
    .map(([team]) => team);
}

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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: normalizeAdVisibilityScope(user.adVisibilityScope),
        canEditAds: canEditAdPayment(user),
        canDeleteAds: canDeleteAdPayment(user),
      },
    });
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

apiRouter.post('/signup', async (req, res) => {
  try {
    const { password, name, team, level, phoneNumber, birthDate } = req.body;
    const loginId = String(req.body.loginId || req.body.email || '').trim();

    if (!loginId || !password || !name || !team || !phoneNumber || !birthDate) {
      return res.status(400).json({ error: '아이디, 비밀번호, 이름, 소속팀, 휴대전화번호, 생년월일은 필수입니다.' });
    }
    if (/\s/.test(loginId)) {
      return res.status(400).json({ error: '아이디에는 공백을 사용할 수 없습니다.' });
    }
    if (!/^[A-Za-z]+$/.test(loginId)) {
      return res.status(400).json({ error: '아이디는 영문만 사용할 수 있습니다.' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email: loginId } });
    if (existingUser) return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const mappedDepartment = teamDepartmentMapping[team] || '기타부서';

    const newUser = await prisma.user.create({
      data: {
        email: loginId,
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
        adVisibilityScope: normalizeAdVisibilityScope(newUser.adVisibilityScope),
        canEditAds: Boolean(newUser.canEditAds),
        canDeleteAds: Boolean(newUser.canDeleteAds),
      },
      SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
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
        adVisibilityScope: normalizeAdVisibilityScope(newUser.adVisibilityScope),
        canEditAds: Boolean(newUser.canEditAds),
        canDeleteAds: Boolean(newUser.canDeleteAds),
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
    const { password } = req.body;
    const loginId = String(req.body.loginId || req.body.email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호가 필요합니다.' });
    }

    const user = await prisma.user.findUnique({ where: { email: loginId } });
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
        adVisibilityScope: normalizeAdVisibilityScope(user.adVisibilityScope),
        canEditAds: canEditAdPayment(user),
        canDeleteAds: canDeleteAdPayment(user),
      },
      SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
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
        adVisibilityScope: normalizeAdVisibilityScope(user.adVisibilityScope),
        canEditAds: canEditAdPayment(user),
        canDeleteAds: canDeleteAdPayment(user),
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
  const { password, phoneNumber, birthDate, officePhoneNumber, profileImage } = req.body;
  const requestedLoginId = req.body.loginId ?? req.body.email;

  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: '자신의 정보만 수정할 수 있습니다.' });
  }

  try {
    const dataToUpdate = {};
    if (requestedLoginId !== undefined) {
      const loginId = String(requestedLoginId).trim();
      if (!loginId) {
        return res.status(400).json({ error: '아이디를 입력해주세요.' });
      }
      if (!/^[A-Za-z]+$/.test(loginId)) {
        return res.status(400).json({ error: '아이디는 영문만 사용할 수 있습니다.' });
      }

      const duplicateUser = await prisma.user.findUnique({
        where: { email: loginId },
        select: { id: true },
      });
      if (duplicateUser && duplicateUser.id !== req.user.id) {
        return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
      }

      dataToUpdate.email = loginId;
    }
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: normalizeAdVisibilityScope(updatedUser.adVisibilityScope),
        canEditAds: canEditAdPayment(updatedUser),
        canDeleteAds: canDeleteAdPayment(updatedUser),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: normalizeAdVisibilityScope(updatedUser.adVisibilityScope),
        canEditAds: canEditAdPayment(updatedUser),
        canDeleteAds: canDeleteAdPayment(updatedUser),
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

apiRouter.get('/staff-options', verifyToken, async (_req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { status: '재직' },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        level: true,
        team: true,
        department: true,
      },
    });

    res.json({ staff });
  } catch (error) {
    console.error('Fetch staff options error:', error);
    res.status(500).json({ error: '직원 목록을 불러오지 못했습니다.' });
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
  if (!companyName || !ceoName || !businessRegNumber || !tel || !mobile || !postcode || !address || !companyEmail) {
    return res.status(400).json({ error: '회사 필수 정보를 모두 입력해주세요.' });
  }
  if (!/^\d{3}-\d{2}-\d{5}$/.test(businessRegNumber)) {
    return res.status(400).json({ error: '사업자등록번호 형식이 올바르지 않습니다.' });
  }
  if (!/^\d{2,4}-\d{3,4}-\d{4}$/.test(tel)) {
    return res.status(400).json({ error: '전화번호 형식이 올바르지 않습니다.' });
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
        birthDate: birthDate || '',
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
    companyId,
    productName,
    startDate,
    endDate,
    approvedCompany,
    taxInvoice,
    paymentMethod,
    paymentDetail = {},
    productInfo = {},
    extraInfo = {},
  } = req.body;
  const targetUserId = parseInt(userId || req.user.id, 10);
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  if (!canAccessUser(req, targetUserId)) {
    return res.status(403).json({ error: '해당 사용자 정보에 접근할 권한이 없습니다.' });
  }
  if (!productName || !startDate || !endDate || !approvedCompany || !paymentMethod) {
    return res.status(400).json({ error: '결제 필수 정보를 모두 입력해주세요.' });
  }
  if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
    return res.status(400).json({ error: '계약기간 날짜 형식이 올바르지 않습니다.' });
  }
  if (parsedEndDate < parsedStartDate) {
    return res.status(400).json({ error: '종료일은 시작일보다 늦어야 합니다.' });
  }

  try {
    let targetCompanyId = companyId ? parseInt(companyId, 10) : null;

    if (targetCompanyId) {
      const company = await prisma.company.findFirst({
        where: { id: targetCompanyId, userId: targetUserId },
        select: { id: true },
      });

      if (!company) {
        return res.status(400).json({ error: '선택한 회사 정보를 찾을 수 없습니다.' });
      }
    } else {
      const latestCompany = await prisma.company.findFirst({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      targetCompanyId = latestCompany?.id || null;
    }

    const approvedAmount = toMoneyNumber(paymentDetail.approvedAmount);
    const spendingCost = toMoneyNumber(paymentDetail.spendingCost);
    const vat = Math.round(approvedAmount / 11);
    const netProfit = Math.max(approvedAmount - vat - spendingCost, 0);
    const productItems = normalizeProductItems(productInfo.products);
    const cardNumberResult = normalizeCardNumber(
      paymentDetail.cardNumber ||
      [
        paymentDetail.cardNumber1,
        paymentDetail.cardNumber2,
        paymentDetail.cardNumber3,
        paymentDetail.cardNumber4,
      ].filter(Boolean).join('-')
    );
    if (cardNumberResult.error) {
      return res.status(400).json({ error: cardNumberResult.error });
    }
    const isCardPayment = paymentMethod === '카드';

    const payment = await prisma.payment.create({
      data: {
        userId: targetUserId,
        companyId: targetCompanyId,
        productName,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        approvedCompany,
        taxInvoice: taxInvoice || '발행',
        paymentMethod,
        approvedAmount,
        vat,
        spendingCost,
        netProfit,
        approvalNumber: toOptionalString(paymentDetail.approvalNumber),
        paymentStatus: toOptionalString(paymentDetail.paymentStatus) || '결제대기',
        cardCompany: isCardPayment ? toOptionalString(paymentDetail.cardCompany) : null,
        cardExpiryMonth: isCardPayment ? normalizeCardExpiryMonth(paymentDetail.expiryMonth) : null,
        cardExpiryYear: isCardPayment ? normalizeCardExpiryYear(paymentDetail.expiryYear) : null,
        cardNumber: isCardPayment ? cardNumberResult.value : null,
        installmentMonths: isCardPayment ? toOptionalString(paymentDetail.installmentMonths) : null,
        manager: toOptionalString(productInfo.manager) || req.user.name || null,
        managerTeam: toOptionalString(productInfo.managerTeam) || req.user.team || null,
        teamLead: toOptionalString(productInfo.teamLead),
        departmentHead: toOptionalString(productInfo.departmentHead),
        productItems,
        production1: toOptionalString(productInfo.production1),
        production2: toOptionalString(productInfo.production2),
        adProgress: toOptionalString(productInfo.adProgress) || 'OFF',
        advertiserAccount: toOptionalString(extraInfo.advertiserAccount),
        registrationUrl: toOptionalString(extraInfo.registrationUrl),
        titleText: toOptionalString(extraInfo.titleText),
        descriptionText: toOptionalString(extraInfo.descriptionText),
        memo: toOptionalString(extraInfo.memo),
        fileName: toOptionalString(extraInfo.fileName),
      },
    });

    res.status(201).json({ message: '결제 정보가 등록되었습니다.', payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: '결제 정보 등록 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/system/outbound-ip', verifyToken, verifyAdminRole, async (_req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();

    if (!response.ok || !data.ip) {
      throw new Error('Outbound IP lookup failed');
    }

    res.json({
      ip: data.ip,
      region: process.env.VERCEL_REGION || '',
    });
  } catch (error) {
    console.error('Outbound IP lookup error:', error);
    res.status(500).json({ error: '외부 발신 IP를 확인하지 못했습니다.' });
  }
});

apiRouter.get('/ads', verifyToken, async (req, res) => {
  const targetUserId = req.query.userId ? parseInt(req.query.userId, 10) : null;
  const isPaginatedRequest = req.query.page !== undefined || req.query.pageSize !== undefined;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const search = String(req.query.search || '').trim();
  const sortBy = String(req.query.sortBy || 'createdAt');
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }

    const accessFilter = buildAdAccessFilter(currentUser, targetUserId);
    const searchFilter = search
      ? {
          OR: [
            { manager: { contains: search, mode: 'insensitive' } },
            { managerTeam: { contains: search, mode: 'insensitive' } },
            { productName: { contains: search, mode: 'insensitive' } },
            { approvalNumber: { contains: search, mode: 'insensitive' } },
            { paymentStatus: { contains: search, mode: 'insensitive' } },
            { paymentMethod: { contains: search, mode: 'insensitive' } },
            { cardCompany: { contains: search, mode: 'insensitive' } },
            { advertiserAccount: { contains: search, mode: 'insensitive' } },
            {
              user: {
                is: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { team: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              company: {
                is: {
                  OR: [
                    { companyName: { contains: search, mode: 'insensitive' } },
                    { ceoName: { contains: search, mode: 'insensitive' } },
                    { businessRegNumber: { contains: search, mode: 'insensitive' } },
                    { tel: { contains: search, mode: 'insensitive' } },
                    { mobile: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const whereFilters = [accessFilter, searchFilter].filter(filter => Object.keys(filter).length > 0);
    const where = whereFilters.length ? { AND: whereFilters } : {};
    const directSortFields = new Set([
      'smsContractStatus',
      'agreementStatus',
      'agreementAt',
      'productName',
      'approvedAmount',
      'vat',
      'spendingCost',
      'netProfit',
      'paymentMethod',
      'cardCompany',
      'paymentStatus',
      'production1',
      'production2',
      'adProgress',
      'advertiserAccount',
      'approvalNumber',
      'createdAt',
    ]);
    let orderBy;

    if (sortBy === 'manager') {
      orderBy = [{ manager: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }];
    } else if (sortBy === 'team' || sortBy === 'department') {
      orderBy = [{ managerTeam: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }];
    } else if (['companyName', 'ceoName', 'businessRegNumber', 'tel', 'mobile'].includes(sortBy)) {
      orderBy = [{ company: { [sortBy]: sortOrder } }, { createdAt: 'desc' }, { id: 'desc' }];
    } else if (sortBy === 'contractDate') {
      orderBy = [{ startDate: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }];
    } else if (sortBy === 'createdAt') {
      orderBy = [{ createdAt: sortOrder }, { id: sortOrder }];
    } else if (directSortFields.has(sortBy)) {
      orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }];
    } else {
      orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
    }

    const paymentQuery = {
      where,
      orderBy,
      select: {
        id: true,
        manager: true,
        managerTeam: true,
        smsContractStatus: true,
        agreementStatus: true,
        agreementAt: true,
        startDate: true,
        endDate: true,
        productName: true,
        approvedAmount: true,
        vat: true,
        spendingCost: true,
        netProfit: true,
        paymentMethod: true,
        cardCompany: true,
        paymentStatus: true,
        production1: true,
        production2: true,
        adProgress: true,
        advertiserAccount: true,
        approvalNumber: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            team: true,
          },
        },
        company: {
          select: {
            companyName: true,
            ceoName: true,
            businessRegNumber: true,
            tel: true,
            mobile: true,
          },
        },
      },
    };

    if (isPaginatedRequest) {
      paymentQuery.skip = (page - 1) * pageSize;
      paymentQuery.take = pageSize;
    }

    const [total, payments] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany(paymentQuery),
    ]);

    const ads = payments.map(payment => ({
      id: payment.id,
      manager: payment.manager || payment.user?.name || '',
      team: payment.managerTeam || payment.user?.team || '',
      companyName: payment.company?.companyName || '',
      ceoName: payment.company?.ceoName || '',
      businessRegNumber: payment.company?.businessRegNumber || '',
      tel: payment.company?.tel || '',
      mobile: payment.company?.mobile || '',
      smsContractStatus: payment.smsContractStatus,
      agreementStatus: payment.agreementStatus,
      agreementAt: toDateString(payment.agreementAt),
      contractStartDate: toDateString(payment.startDate),
      contractEndDate: toDateString(payment.endDate),
      productName: payment.productName,
      approvedAmount: payment.approvedAmount,
      vat: payment.vat,
      spendingCost: payment.spendingCost,
      netProfit: payment.netProfit,
      paymentMethod: payment.paymentMethod,
      cardCompany: payment.cardCompany || '',
      paymentStatus: payment.paymentStatus,
      production1: payment.production1 || '',
      production2: payment.production2 || '',
      adProgress: payment.adProgress,
      advertiserAccount: payment.advertiserAccount || '',
      approvalNumber: payment.approvalNumber || '',
      createdAt: toDateString(payment.createdAt),
    }));

    res.json({
      ads,
      total,
      page: isPaginatedRequest ? page : 1,
      pageSize: isPaginatedRequest ? pageSize : total,
      pageCount: isPaginatedRequest ? Math.max(Math.ceil(total / pageSize), 1) : 1,
    });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ error: '광고 목록 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/ads/:id', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: adId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            team: true,
            department: true,
            profileImage: true,
          },
        },
        company: true,
        smsConsentTokens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        smsSendHistories: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            sender: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }

    if (!canViewAd(currentUser, payment)) {
      return res.status(403).json({ error: '해당 광고 정보를 조회할 권한이 없습니다.' });
    }

    const canUseAdminComments = canAccessAdminComments(currentUser);
    const commentInclude = {
      user: {
        select: {
          name: true,
          profileImage: true,
        },
      },
    };
    const commentOrderBy = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    const [
      publicCommentTotal,
      publicComments,
      adminCommentTotal,
      adminComments,
    ] = await Promise.all([
      prisma.adComment.count({
        where: { paymentId: payment.id, isAdminOnly: false },
      }),
      prisma.adComment.findMany({
        where: { paymentId: payment.id, isAdminOnly: false },
        orderBy: commentOrderBy,
        take: 5,
        include: commentInclude,
      }),
      canUseAdminComments
        ? prisma.adComment.count({
            where: { paymentId: payment.id, isAdminOnly: true },
          })
        : Promise.resolve(0),
      canUseAdminComments
        ? prisma.adComment.findMany({
            where: { paymentId: payment.id, isAdminOnly: true },
            orderBy: commentOrderBy,
            take: 5,
            include: commentInclude,
          })
        : Promise.resolve([]),
    ]);

    res.json({
      ad: {
        id: payment.id,
        userId: payment.userId,
        manager: payment.manager || payment.user?.name || '',
        team: payment.managerTeam || payment.user?.team || '',
        department: payment.user?.department || '',
        companyName: payment.company?.companyName || '',
        ceoName: payment.company?.ceoName || '',
        businessRegNumber: payment.company?.businessRegNumber || '',
        birthDate: payment.company?.birthDate || '',
        tel: payment.company?.tel || '',
        mobile: payment.company?.mobile || '',
        postcode: payment.company?.postcode || '',
        address: payment.company?.address || '',
        detailAddress: payment.company?.detailAddress || '',
        companyUrl: payment.company?.companyUrl || '',
        companyEmail: payment.company?.companyEmail || '',
        smsContractStatus: payment.smsContractStatus,
        agreementStatus: payment.agreementStatus,
        agreementAt: toDateString(payment.agreementAt),
        contractStartDate: toDateString(payment.startDate),
        contractEndDate: toDateString(payment.endDate),
        productName: payment.productName,
        approvedCompany: payment.approvedCompany,
        taxInvoice: payment.taxInvoice,
        approvedAmount: payment.approvedAmount,
        vat: payment.vat,
        spendingCost: payment.spendingCost,
        netProfit: payment.netProfit,
        paymentMethod: payment.paymentMethod,
        cardCompany: payment.cardCompany || '',
        cardExpiryMonth: payment.cardExpiryMonth || '',
        cardExpiryYear: payment.cardExpiryYear || '',
        cardNumber: payment.cardNumber || '',
        installmentMonths: payment.installmentMonths || '',
        paymentStatus: payment.paymentStatus,
        teamLead: payment.teamLead || '',
        departmentHead: payment.departmentHead || '',
        production1: payment.production1 || '',
        production2: payment.production2 || '',
        productItems: getPaymentProductItemSlots(payment),
        adProgress: payment.adProgress,
        advertiserAccount: payment.advertiserAccount || '',
        approvalNumber: payment.approvalNumber || '',
        createdAt: toDateString(payment.createdAt),
        registrationUrl: payment.registrationUrl || '',
        titleText: payment.titleText || '',
        descriptionText: payment.descriptionText || '',
        memo: payment.memo || '',
        fileName: payment.fileName || '',
        latestSmsToken: payment.smsConsentTokens[0]?.token || '',
        smsHistories: payment.smsSendHistories.map(history => ({
          id: history.id,
          createdAt: history.createdAt.toISOString(),
          resultCode: history.resultCode,
          resultText: history.resultText || '',
          phoneNumber: history.phoneNumber,
          senderName: history.sender?.name || '-',
        })),
        canUseAdminComments,
        canEditAd: canEditAdPayment(currentUser),
        canDeleteAd: canDeleteAdPayment(currentUser),
        comments: publicComments.map(comment => serializeAdComment(comment, currentUser)),
        commentPagination: {
          page: 1,
          pageSize: 5,
          pageCount: Math.max(Math.ceil(publicCommentTotal / 5), 1),
          total: publicCommentTotal,
        },
        adminComments: adminComments.map(comment => serializeAdComment(comment, currentUser)),
        adminCommentPagination: {
          page: 1,
          pageSize: 5,
          pageCount: Math.max(Math.ceil(adminCommentTotal / 5), 1),
          total: adminCommentTotal,
        },
      },
    });
  } catch (error) {
    console.error('Get ad detail error:', error);
    res.status(500).json({ error: '광고 상세 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.delete('/ads/:id', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!canDeleteAdPayment(currentUser)) {
      return res.status(403).json({ error: '광고상품 삭제 권한이 없습니다.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: adId },
      select: {
        id: true,
        userId: true,
        companyId: true,
        productName: true,
        managerTeam: true,
        user: {
          select: {
            team: true,
            department: true,
          },
        },
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, payment)) {
      return res.status(403).json({ error: '해당 광고상품을 삭제할 권한이 없습니다.' });
    }

    await prisma.$transaction(async tx => {
      await tx.adComment.deleteMany({ where: { paymentId: adId } });
      await tx.smsSendHistory.deleteMany({ where: { paymentId: adId } });
      await tx.smsConsentToken.deleteMany({ where: { paymentId: adId } });
      await tx.payment.delete({ where: { id: adId } });

      if (payment.companyId) {
        const remainingPaymentCount = await tx.payment.count({
          where: { companyId: payment.companyId },
        });
        if (remainingPaymentCount === 0) {
          await tx.company.deleteMany({ where: { id: payment.companyId } });
        }
      }
    });

    res.json({
      message: '광고상품이 삭제되었습니다.',
      deletedAd: {
        id: payment.id,
        companyName: payment.company?.companyName || '',
        productName: payment.productName || '',
      },
    });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ error: '광고상품 삭제 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/ads/:id/comments', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const requestedPageSize = parseInt(req.query.pageSize, 10) || 5;
  const pageSizeOptions = [5, 10, 20, 50];
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 5;
  const scope = req.query.scope === 'admin' ? 'admin' : 'public';
  const isAdminOnly = scope === 'admin';

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }

  try {
    const [currentUser, payment] = await Promise.all([
      getCurrentUserAccess(req.user.id),
      prisma.payment.findUnique({
        where: { id: adId },
        select: {
          id: true,
          userId: true,
          managerTeam: true,
          user: {
            select: {
              team: true,
              department: true,
            },
          },
        },
      }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, payment)) {
      return res.status(403).json({ error: '해당 광고의 댓글을 조회할 권한이 없습니다.' });
    }
    if (isAdminOnly && !canAccessAdminComments(currentUser)) {
      return res.status(403).json({ error: '관리자 댓글을 조회할 권한이 없습니다.' });
    }

    const total = await prisma.adComment.count({
      where: { paymentId: adId, isAdminOnly },
    });
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, pageCount);
    const comments = await prisma.adComment.findMany({
      where: { paymentId: adId, isAdminOnly },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.json({
      comments: comments.map(comment => serializeAdComment(comment, currentUser)),
      page: safePage,
      pageSize,
      pageCount,
      total,
      scope,
    });
  } catch (error) {
    console.error('Get ad comments error:', error);
    res.status(500).json({ error: '댓글 목록 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/ads/:id/comments', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);
  const content = String(req.body.content || '').trim();
  const scope = req.body.scope === 'admin' ? 'admin' : 'public';
  const isAdminOnly = scope === 'admin';

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }
  if (!content) {
    return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: '댓글은 1,000자 이내로 입력해주세요.' });
  }

  try {
    const [currentUser, payment] = await Promise.all([
      getCurrentUserAccess(req.user.id),
      prisma.payment.findUnique({
        where: { id: adId },
        select: {
          id: true,
          userId: true,
          managerTeam: true,
          user: {
            select: {
              team: true,
              department: true,
            },
          },
        },
      }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, payment)) {
      return res.status(403).json({ error: '해당 광고에 댓글을 작성할 권한이 없습니다.' });
    }
    if (isAdminOnly && !canAccessAdminComments(currentUser)) {
      return res.status(403).json({ error: '관리자 댓글을 작성할 권한이 없습니다.' });
    }

    const comment = await prisma.adComment.create({
      data: {
        paymentId: adId,
        userId: currentUser.id,
        content,
        isAdminOnly,
      },
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.status(201).json({
      message: '댓글이 등록되었습니다.',
      comment: serializeAdComment(comment, currentUser),
      scope,
    });
  } catch (error) {
    console.error('Create ad comment error:', error);
    res.status(500).json({ error: '댓글 등록 중 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/ads/:adId/comments/:commentId', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.adId, 10);
  const commentId = parseInt(req.params.commentId, 10);
  const content = String(req.body.content || '').trim();

  if (!Number.isInteger(adId) || !Number.isInteger(commentId)) {
    return res.status(400).json({ error: '댓글 정보가 올바르지 않습니다.' });
  }
  if (!content) {
    return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: '댓글은 1,000자 이내로 입력해주세요.' });
  }

  try {
    const [currentUser, existingComment] = await Promise.all([
      getCurrentUserAccess(req.user.id),
      prisma.adComment.findFirst({
        where: {
          id: commentId,
          paymentId: adId,
        },
        select: {
          id: true,
          userId: true,
          isAdminOnly: true,
          payment: {
            select: {
              id: true,
              userId: true,
              managerTeam: true,
              user: {
                select: {
                  team: true,
                  department: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!existingComment) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, existingComment.payment)) {
      return res.status(403).json({ error: '해당 광고 댓글을 수정할 권한이 없습니다.' });
    }
    if (existingComment.isAdminOnly && !canAccessAdminComments(currentUser)) {
      return res.status(403).json({ error: '관리자 댓글을 수정할 권한이 없습니다.' });
    }
    if (existingComment.userId !== currentUser.id && !isAdminRole(currentUser.role)) {
      return res.status(403).json({ error: '댓글을 수정할 권한이 없습니다.' });
    }

    const comment = await prisma.adComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.json({
      message: '댓글 수정이 완료되었습니다.',
      comment: serializeAdComment(comment, currentUser),
    });
  } catch (error) {
    console.error('Update ad comment error:', error);
    res.status(500).json({ error: '댓글 수정 중 오류가 발생했습니다.' });
  }
});

apiRouter.delete('/ads/:adId/comments/:commentId', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.adId, 10);
  const commentId = parseInt(req.params.commentId, 10);

  if (!Number.isInteger(adId) || !Number.isInteger(commentId)) {
    return res.status(400).json({ error: '댓글 정보가 올바르지 않습니다.' });
  }

  try {
    const [currentUser, existingComment] = await Promise.all([
      getCurrentUserAccess(req.user.id),
      prisma.adComment.findFirst({
        where: {
          id: commentId,
          paymentId: adId,
        },
        select: {
          id: true,
          userId: true,
          isAdminOnly: true,
          payment: {
            select: {
              id: true,
              userId: true,
              managerTeam: true,
              user: {
                select: {
                  team: true,
                  department: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!existingComment) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, existingComment.payment)) {
      return res.status(403).json({ error: '해당 광고 댓글을 삭제할 권한이 없습니다.' });
    }
    if (existingComment.isAdminOnly && !canAccessAdminComments(currentUser)) {
      return res.status(403).json({ error: '관리자 댓글을 삭제할 권한이 없습니다.' });
    }
    if (existingComment.userId !== currentUser.id && !isAdminRole(currentUser.role)) {
      return res.status(403).json({ error: '댓글을 삭제할 권한이 없습니다.' });
    }

    await prisma.adComment.delete({
      where: { id: commentId },
    });

    res.json({ message: '댓글 삭제가 완료되었습니다.' });
  } catch (error) {
    console.error('Delete ad comment error:', error);
    res.status(500).json({ error: '댓글 삭제 중 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/ads/:id/payment-info', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);
  const approvedAmount = Number(String(req.body.approvedAmount ?? '').replace(/[,\s]/g, ''));
  const spendingCost = Number(String(req.body.spendingCost ?? '').replace(/[,\s]/g, ''));
  const startDate = new Date(req.body.contractStartDate);
  const endDate = new Date(req.body.contractEndDate);
  const taxInvoice = toOptionalString(req.body.taxInvoice) || '발행';
  const approvalNumber = toOptionalString(req.body.approvalNumber);
  const paymentMethod = toOptionalString(req.body.paymentMethod);
  const cardCompany = toOptionalString(req.body.cardCompany);
  const cardExpiryMonth = normalizeCardExpiryMonth(req.body.cardExpiryMonth);
  const cardExpiryYear = normalizeCardExpiryYear(req.body.cardExpiryYear);
  const cardNumberResult = normalizeCardNumber(req.body.cardNumber);
  const paymentStatus = String(req.body.paymentStatus || '').trim();
  const installmentMonths = toOptionalString(req.body.installmentMonths);
  const productName = toOptionalString(req.body.productName);
  const selectedProductNames = String(productName || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const productItems = normalizeProductItemSlots(req.body.productItems);
  const managerUserId = req.body.managerUserId === undefined || req.body.managerUserId === ''
    ? null
    : parseInt(req.body.managerUserId, 10);
  const teamLeadUserId = req.body.teamLeadUserId === undefined || req.body.teamLeadUserId === ''
    ? null
    : parseInt(req.body.teamLeadUserId, 10);
  const departmentHeadUserId = req.body.departmentHeadUserId === undefined || req.body.departmentHeadUserId === ''
    ? null
    : parseInt(req.body.departmentHeadUserId, 10);
  const fallbackTeamLead = toOptionalString(req.body.teamLead);
  const fallbackDepartmentHead = toOptionalString(req.body.departmentHead);
  const production1 = toOptionalString(req.body.production1);
  const production2 = toOptionalString(req.body.production2);
  const adProgress = toOptionalString(req.body.adProgress) || 'OFF';
  const registrationUrl = toOptionalString(req.body.registrationUrl);
  const titleText = toOptionalString(req.body.titleText);
  const descriptionText = toOptionalString(req.body.descriptionText);
  const advertiserAccount = toOptionalString(req.body.advertiserAccount);
  const memo = toOptionalString(req.body.memo);
  const fileName = toOptionalString(req.body.fileName);
  const taxInvoiceOptions = ['발행', '미발행'];
  const paymentMethodOptions = ['카드', '현금'];
  const paymentStatusOptions = ['결제대기', '결제승인', '매출취소', '위약금'];

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }
  if (!productName) {
    return res.status(400).json({ error: '상품군을 선택해주세요.' });
  }
  if (selectedProductNames.length > 2) {
    return res.status(400).json({ error: '상품군은 최대 2개까지 선택할 수 있습니다.' });
  }
  if (
    req.body.approvedAmount === undefined ||
    req.body.approvedAmount === null ||
    req.body.approvedAmount === '' ||
    !Number.isFinite(approvedAmount) ||
    approvedAmount < 0
  ) {
    return res.status(400).json({ error: '승인금액을 올바르게 입력해주세요.' });
  }
  if (
    req.body.spendingCost === undefined ||
    req.body.spendingCost === null ||
    req.body.spendingCost === '' ||
    !Number.isFinite(spendingCost) ||
    spendingCost < 0
  ) {
    return res.status(400).json({ error: '소진비를 올바르게 입력해주세요.' });
  }
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: '계약기간 날짜 형식이 올바르지 않습니다.' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: '계약 종료일은 시작일보다 빠를 수 없습니다.' });
  }
  if (!taxInvoiceOptions.includes(taxInvoice)) {
    return res.status(400).json({ error: '세금계산서 값을 확인해주세요.' });
  }
  if (!paymentMethod || !paymentMethodOptions.includes(paymentMethod)) {
    return res.status(400).json({ error: '결제구분을 선택해주세요.' });
  }
  if (paymentMethod === '카드' && cardNumberResult.error) {
    return res.status(400).json({ error: cardNumberResult.error });
  }
  if (!paymentStatusOptions.includes(paymentStatus)) {
    return res.status(400).json({ error: '유효하지 않은 결제상태입니다.' });
  }
  if (req.body.managerUserId !== undefined && !Number.isInteger(managerUserId)) {
    return res.status(400).json({ error: '담당자 정보가 올바르지 않습니다.' });
  }
  if (req.body.teamLeadUserId !== undefined && req.body.teamLeadUserId !== '' && !Number.isInteger(teamLeadUserId)) {
    return res.status(400).json({ error: '담당팀장 정보가 올바르지 않습니다.' });
  }
  if (req.body.departmentHeadUserId !== undefined && req.body.departmentHeadUserId !== '' && !Number.isInteger(departmentHeadUserId)) {
    return res.status(400).json({ error: '담당부장 정보가 올바르지 않습니다.' });
  }

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!canEditAdPayment(currentUser)) {
      return res.status(403).json({ error: '전체관리자 또는 대표만 결제정보를 수정할 수 있습니다.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: adId },
      select: {
        id: true,
        userId: true,
        cardNumber: true,
      },
    });
    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }

    const [managerUser, teamLeadUser, departmentHeadUser] = await Promise.all([
      managerUserId
        ? prisma.user.findUnique({
            where: { id: managerUserId },
            select: { id: true, name: true, team: true, department: true, status: true },
          })
        : Promise.resolve(null),
      teamLeadUserId
        ? prisma.user.findUnique({
            where: { id: teamLeadUserId },
            select: { id: true, name: true, level: true, status: true },
          })
        : Promise.resolve(null),
      departmentHeadUserId
        ? prisma.user.findUnique({
            where: { id: departmentHeadUserId },
            select: { id: true, name: true, level: true, status: true },
          })
        : Promise.resolve(null),
    ]);

    if (managerUserId && !managerUser) {
      return res.status(400).json({ error: '선택한 담당자를 찾을 수 없습니다.' });
    }
    if (teamLeadUserId && !teamLeadUser) {
      return res.status(400).json({ error: '선택한 담당팀장을 찾을 수 없습니다.' });
    }
    if (departmentHeadUserId && !departmentHeadUser) {
      return res.status(400).json({ error: '선택한 담당부장을 찾을 수 없습니다.' });
    }

    const vat = Math.round(approvedAmount / 11);
    const netProfit = Math.max(approvedAmount - vat - spendingCost, 0);
    const nextCardNumber = paymentMethod === '카드'
      ? cardNumberResult.value || payment.cardNumber || null
      : null;
    const nextTeamLead = teamLeadUser ? teamLeadUser.name : fallbackTeamLead;
    const nextDepartmentHead = departmentHeadUser ? departmentHeadUser.name : fallbackDepartmentHead;
    const updatedPayment = await prisma.payment.update({
      where: { id: adId },
      data: {
        productName,
        approvedAmount,
        startDate,
        endDate,
        taxInvoice,
        approvalNumber,
        spendingCost,
        paymentMethod,
        cardCompany: paymentMethod === '카드' ? cardCompany : null,
        cardExpiryMonth: paymentMethod === '카드' ? cardExpiryMonth : null,
        cardExpiryYear: paymentMethod === '카드' ? cardExpiryYear : null,
        cardNumber: nextCardNumber,
        paymentStatus,
        installmentMonths: paymentMethod === '카드' ? installmentMonths : null,
        vat,
        netProfit,
        ...(managerUser
          ? {
              userId: managerUser.id,
              manager: managerUser.name,
              managerTeam: managerUser.team,
            }
          : {}),
        teamLead: nextTeamLead,
        departmentHead: nextDepartmentHead,
        production1,
        production2,
        adProgress,
        productItems,
        registrationUrl,
        titleText,
        descriptionText,
        advertiserAccount,
        memo,
        fileName,
      },
      select: {
        id: true,
        userId: true,
        productName: true,
        approvedAmount: true,
        startDate: true,
        endDate: true,
        taxInvoice: true,
        approvalNumber: true,
        spendingCost: true,
        paymentMethod: true,
        cardCompany: true,
        cardExpiryMonth: true,
        cardExpiryYear: true,
        cardNumber: true,
        paymentStatus: true,
        installmentMonths: true,
        vat: true,
        netProfit: true,
        manager: true,
        managerTeam: true,
        teamLead: true,
        departmentHead: true,
        production1: true,
        production2: true,
        adProgress: true,
        productItems: true,
        registrationUrl: true,
        titleText: true,
        descriptionText: true,
        advertiserAccount: true,
        memo: true,
        fileName: true,
        user: {
          select: {
            name: true,
            team: true,
            department: true,
          },
        },
      },
    });

    res.json({
      message: '광고 정보가 수정되었습니다.',
      payment: {
        id: updatedPayment.id,
        userId: updatedPayment.userId,
        manager: updatedPayment.manager || updatedPayment.user?.name || '',
        team: updatedPayment.managerTeam || updatedPayment.user?.team || '',
        department: updatedPayment.user?.department || '',
        productName: updatedPayment.productName,
        approvedAmount: updatedPayment.approvedAmount,
        contractStartDate: toDateString(updatedPayment.startDate),
        contractEndDate: toDateString(updatedPayment.endDate),
        taxInvoice: updatedPayment.taxInvoice,
        approvalNumber: updatedPayment.approvalNumber || '',
        spendingCost: updatedPayment.spendingCost,
        paymentMethod: updatedPayment.paymentMethod,
        cardCompany: updatedPayment.cardCompany || '',
        cardExpiryMonth: updatedPayment.cardExpiryMonth || '',
        cardExpiryYear: updatedPayment.cardExpiryYear || '',
        cardNumber: updatedPayment.cardNumber || '',
        paymentStatus: updatedPayment.paymentStatus,
        installmentMonths: updatedPayment.installmentMonths || '',
        vat: updatedPayment.vat,
        netProfit: updatedPayment.netProfit,
        teamLead: updatedPayment.teamLead || '',
        departmentHead: updatedPayment.departmentHead || '',
        production1: updatedPayment.production1 || '',
        production2: updatedPayment.production2 || '',
        productItems: getPaymentProductItemSlots(updatedPayment),
        adProgress: updatedPayment.adProgress,
        registrationUrl: updatedPayment.registrationUrl || '',
        titleText: updatedPayment.titleText || '',
        descriptionText: updatedPayment.descriptionText || '',
        advertiserAccount: updatedPayment.advertiserAccount || '',
        memo: updatedPayment.memo || '',
        fileName: updatedPayment.fileName || '',
      },
    });
  } catch (error) {
    console.error('Update ad payment info error:', error);
    res.status(500).json({ error: '결제정보 수정 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/ads/:id/sms-consent/send', verifyToken, async (req, res) => {
  const adId = parseInt(req.params.id, 10);
  const { phoneNumber, resend = false } = req.body;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!Number.isInteger(adId)) {
    return res.status(400).json({ error: '광고 ID가 올바르지 않습니다.' });
  }
  if (!/^01\d{8,9}$/.test(normalizedPhone)) {
    return res.status(400).json({ error: '계약서를 받을 휴대폰 번호를 확인해주세요.' });
  }

  try {
    const [currentUser, payment] = await Promise.all([
      getCurrentUserAccess(req.user.id),
      prisma.payment.findUnique({
        where: { id: adId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              team: true,
              department: true,
              phoneNumber: true,
              officePhoneNumber: true,
            },
          },
          company: true,
          smsConsentTokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }
    if (!payment) {
      return res.status(404).json({ error: '광고 정보를 찾을 수 없습니다.' });
    }
    if (!canViewAd(currentUser, payment)) {
      return res.status(403).json({ error: '해당 광고에 계약서를 발송할 권한이 없습니다.' });
    }
    let consentToken = payment.smsConsentTokens[0] || null;
    const canReuseToken = Boolean(
      resend &&
      consentToken &&
      (
        consentToken.usedAt ||
        (!consentToken.expiredAt && consentToken.expiresAt > new Date())
      )
    );

    if (!canReuseToken) {
      const token = await createUniqueAgreementToken();
      consentToken = await prisma.smsConsentToken.create({
        data: {
          paymentId: payment.id,
          token,
          phoneNumber: formatPhoneNumber(normalizedPhone),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const agreementUrl = getAgreementUrl(req, consentToken.token);
    const subject = '[(주)아이앤뷰커뮤니케이션]';
    const message = `안녕하세요. (주)아이앤뷰커뮤니케이션입니다.\n이용동의서를 확인해주세요.\n${agreementUrl}`;

    let sendResult;
    try {
      sendResult = await sendNiceSms({
        phoneNumber: normalizedPhone,
        subject,
        message,
      });
    } catch (smsError) {
      await prisma.smsSendHistory.create({
        data: {
          paymentId: payment.id,
          senderId: req.user.id,
          phoneNumber: formatPhoneNumber(normalizedPhone),
          resultCode: 'FAIL',
          resultText: smsError.message,
          token: consentToken.token,
        },
      });
      throw smsError;
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { smsContractStatus: '발송' },
      }),
      prisma.smsSendHistory.create({
        data: {
          paymentId: payment.id,
          senderId: req.user.id,
          phoneNumber: formatPhoneNumber(normalizedPhone),
          resultCode: sendResult.resultCode,
          resultText: sendResult.resultText,
          token: consentToken.token,
        },
      }),
    ]);

    res.json({
      message: resend ? 'SMS 계약서 재발송이 완료되었습니다.' : 'SMS 계약서 발송이 완료되었습니다.',
      agreementUrl,
      token: consentToken.token,
    });
  } catch (error) {
    console.error('Send SMS consent error:', error);
    res.status(500).json({ error: error.message || 'SMS 계약서 발송 중 오류가 발생했습니다.' });
  }
});

apiRouter.get('/agreements/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const consentToken = await prisma.smsConsentToken.findUnique({
      where: { token },
      include: {
        payment: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
                phoneNumber: true,
                officePhoneNumber: true,
              },
            },
            company: true,
          },
        },
      },
    });

    if (!consentToken) {
      return res.status(404).json({ error: '유효하지 않은 계약서 링크입니다.' });
    }
    const isAlreadyAgreed = Boolean(consentToken.usedAt || consentToken.payment.agreementAt);
    if (!isAlreadyAgreed && (consentToken.expiredAt || consentToken.expiresAt < new Date())) {
      return res.status(410).json({ error: '만료된 계약서 링크입니다.' });
    }

    res.json({
      token: consentToken.token,
      isAgreed: isAlreadyAgreed,
      agreedAt: consentToken.usedAt ? consentToken.usedAt.toISOString() : null,
      expiresAt: consentToken.expiresAt.toISOString(),
      contract: mapPaymentToAgreement(consentToken.payment),
    });
  } catch (error) {
    console.error('Get agreement error:', error);
    res.status(500).json({ error: '계약서 조회 중 오류가 발생했습니다.' });
  }
});

apiRouter.post('/agreements/:token/agree', async (req, res) => {
  const { token } = req.params;

  try {
    const consentToken = await prisma.smsConsentToken.findUnique({
      where: { token },
      include: { payment: true },
    });

    if (!consentToken) {
      return res.status(404).json({ error: '유효하지 않은 계약서 링크입니다.' });
    }
    const isAlreadyAgreed = Boolean(consentToken.usedAt || consentToken.payment.agreementAt);
    if (!isAlreadyAgreed && (consentToken.expiredAt || consentToken.expiresAt < new Date())) {
      return res.status(410).json({ error: '만료된 계약서 링크입니다.' });
    }

    if (isAlreadyAgreed) {
      return res.json({
        message: '이미 동의가 완료된 계약서입니다.',
        agreedAt: (consentToken.usedAt || consentToken.payment.agreementAt).toISOString(),
        agreedIp: consentToken.agreedIp || '',
        redirectUrl: getCompanyHomeUrl(),
      });
    }

    const agreedAt = new Date();
    const agreedIp = getClientIp(req);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: consentToken.paymentId },
        data: {
          agreementStatus: '동의',
          agreementAt: agreedAt,
        },
      }),
      prisma.smsConsentToken.update({
        where: { token },
        data: {
          usedAt: agreedAt,
          expiredAt: null,
          agreedIp,
        },
      }),
      prisma.smsConsentToken.updateMany({
        where: {
          paymentId: consentToken.paymentId,
          token: { not: token },
          usedAt: null,
          expiredAt: null,
        },
        data: { expiredAt: agreedAt },
      }),
    ]);

    res.json({
      message: '계약서 동의가 완료되었습니다.',
      agreedAt: agreedAt.toISOString(),
      agreedIp,
      redirectUrl: getCompanyHomeUrl(),
    });
  } catch (error) {
    console.error('Agree contract error:', error);
    res.status(500).json({ error: '계약서 동의 처리 중 오류가 발생했습니다.' });
  }
});

function toDateString(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sumBy(items, field) {
  return items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
}

function getKoreanCurrentYear() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date()));
}

function getKoreanCurrentDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    date: `${values.year}-${String(values.month).padStart(2, '0')}-${String(values.day).padStart(2, '0')}`,
  };
}

function getKoreanMonthRange(year, month) {
  const koreanOffsetMilliseconds = 9 * 60 * 60 * 1000;

  return {
    start: new Date(Date.UTC(year, month - 1, 1) - koreanOffsetMilliseconds),
    end: new Date(Date.UTC(year, month, 1) - koreanOffsetMilliseconds),
  };
}

const DASHBOARD_EXCLUDED_PAYMENT_STATUS_MARKERS = ['\uCDE8\uC18C', '\uB300\uAE30'];

function isDashboardCompletedSaleStatus(status) {
  const text = String(status || '').trim();
  return text.length > 0 && !DASHBOARD_EXCLUDED_PAYMENT_STATUS_MARKERS.some(marker => text.includes(marker));
}

apiRouter.get('/dashboard/my-monthly-sales', verifyToken, async (req, res) => {
  const currentDate = getKoreanCurrentDateParts();
  const monthRange = getKoreanMonthRange(currentDate.year, currentDate.month);

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }

    const statusTotals = await prisma.payment.groupBy({
      by: ['paymentStatus'],
      where: {
        userId: currentUser.id,
        createdAt: {
          gte: monthRange.start,
          lt: monthRange.end,
        },
      },
      _count: { _all: true },
      _sum: { approvedAmount: true },
    });
    const completedTotals = statusTotals.filter(item => (
      isDashboardCompletedSaleStatus(item.paymentStatus)
    ));

    res.json({
      year: currentDate.year,
      month: currentDate.month,
      totalSales: completedTotals.reduce(
        (sum, item) => sum + (Number(item._sum.approvedAmount) || 0),
        0
      ),
      count: completedTotals.reduce(
        (sum, item) => sum + (Number(item._count._all) || 0),
        0
      ),
    });
  } catch (error) {
    console.error('Fetch dashboard personal monthly sales error:', error);
    res.status(500).json({ error: '개인 월 매출 정보를 불러오지 못했습니다.' });
  }
});

apiRouter.get('/dashboard/monthly-sales', verifyToken, async (_req, res) => {
  const currentYear = getKoreanCurrentYear();
  const startYear = currentYear - 2;

  try {
    const rows = await prisma.$queryRaw`
      select extract(year from "createdAt" + interval '9 hours')::int as year,
             extract(month from "createdAt" + interval '9 hours')::int as month,
             "paymentStatus" as status,
             count(*)::int as count,
             sum(coalesce("approvedAmount", 0))::float as total
        from "Payment"
       where extract(year from "createdAt" + interval '9 hours')::int between ${startYear} and ${currentYear}
       group by 1, 2, 3
       order by 1 desc, 2 asc
    `;
    const completedRows = rows.filter(row => isDashboardCompletedSaleStatus(row.status));

    const years = Array.from({ length: 3 }, (_, index) => currentYear - index).map(year => {
      const months = Array.from({ length: 12 }, (_, monthIndex) => {
        const monthRows = completedRows.filter(item => (
          Number(item.year) === year &&
          Number(item.month) === monthIndex + 1
        ));

        return {
          month: monthIndex + 1,
          total: monthRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
          count: monthRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
        };
      });

      return {
        year,
        total: months.reduce((sum, month) => sum + month.total, 0),
        count: months.reduce((sum, month) => sum + month.count, 0),
        months,
      };
    });

    res.json({
      currentYear,
      startYear,
      excludedStatuses: ['취소', '대기'],
      years,
    });
  } catch (error) {
    console.error('Fetch dashboard monthly sales error:', error);
    res.status(500).json({ error: '월별 매출 정보를 불러오지 못했습니다.' });
  }
});

apiRouter.get('/dashboard/top-sales', verifyToken, async (_req, res) => {
  const currentDate = getKoreanCurrentDateParts();

  try {
    const rows = await prisma.$queryRaw`
      select coalesce(nullif(btrim(payment.manager), ''), nullif(btrim(app_user.name), ''), '미지정') as manager,
             payment."paymentStatus" as status,
             (payment."createdAt" + interval '9 hours')::date::text as date,
             count(*)::int as count,
             sum(coalesce(payment."approvedAmount", 0))::float as total
        from "Payment" payment
        left join "User" app_user on app_user.id = payment."userId"
       where extract(year from payment."createdAt" + interval '9 hours')::int = ${currentDate.year}
         and extract(month from payment."createdAt" + interval '9 hours')::int = ${currentDate.month}
       group by 1, 2, 3
       order by 3 asc
    `;
    const completedRows = rows.filter(row => isDashboardCompletedSaleStatus(row.status));
    const summarize = targetRows => {
      const managerMap = new Map();

      targetRows.forEach(row => {
        const manager = String(row.manager || '미지정').trim() || '미지정';
        const existing = managerMap.get(manager) || { manager, total: 0, count: 0 };
        existing.total += Number(row.total) || 0;
        existing.count += Number(row.count) || 0;
        managerMap.set(manager, existing);
      });

      return [...managerMap.values()]
        .sort((a, b) => b.total - a.total || b.count - a.count || a.manager.localeCompare(b.manager, 'ko'))
        .slice(0, 10);
    };

    res.json({
      currentDate: currentDate.date,
      today: summarize(completedRows.filter(row => row.date === currentDate.date)),
      month: summarize(completedRows),
    });
  } catch (error) {
    console.error('Fetch dashboard top sales error:', error);
    res.status(500).json({ error: '실적 Top 10 정보를 불러오지 못했습니다.' });
  }
});

apiRouter.get('/dashboard/sales', verifyToken, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const search = String(req.query.search || '').trim();
  const range = String(req.query.range || 'custom').trim().toLowerCase();
  let dateFrom = String(req.query.dateFrom || '').trim();
  let dateTo = String(req.query.dateTo || '').trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const allowedRanges = new Set(['today', 'week', 'month', 'all', 'custom']);

  if (!allowedRanges.has(range)) {
    return res.status(400).json({ error: '조회 기간 유형이 올바르지 않습니다.' });
  }

  const currentDate = getKoreanCurrentDateParts().date;
  const shiftDate = (value, { days = 0, months = 0 }) => {
    const [year, month, day] = value.split('-').map(Number);
    let shifted = new Date(Date.UTC(year, month - 1, day));
    if (months) {
      const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
      const targetLastDay = new Date(Date.UTC(
        targetMonth.getUTCFullYear(),
        targetMonth.getUTCMonth() + 1,
        0,
      )).getUTCDate();
      shifted = new Date(Date.UTC(
        targetMonth.getUTCFullYear(),
        targetMonth.getUTCMonth(),
        Math.min(day, targetLastDay),
      ));
    }
    if (days) shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  };

  if (range === 'today') {
    dateFrom = currentDate;
    dateTo = currentDate;
  } else if (range === 'week') {
    dateFrom = shiftDate(currentDate, { days: -6 });
    dateTo = currentDate;
  } else if (range === 'month') {
    dateFrom = shiftDate(currentDate, { months: -1 });
    dateTo = currentDate;
  } else if (range === 'all') {
    dateFrom = '';
    dateTo = '';
  }

  if (dateFrom && !datePattern.test(dateFrom)) {
    return res.status(400).json({ error: '조회 시작일 형식이 올바르지 않습니다.' });
  }
  if (dateTo && !datePattern.test(dateTo)) {
    return res.status(400).json({ error: '조회 종료일 형식이 올바르지 않습니다.' });
  }

  try {
    const currentUser = await getCurrentUserAccess(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    }

    const filters = [];

    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00+09:00`);
      if (dateTo) {
        const endExclusive = new Date(`${dateTo}T00:00:00+09:00`);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        createdAt.lt = endExclusive;
      }
      filters.push({ createdAt });
    }

    if (search) {
      filters.push({
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { manager: { contains: search, mode: 'insensitive' } },
          { managerTeam: { contains: search, mode: 'insensitive' } },
          { approvedCompany: { contains: search, mode: 'insensitive' } },
          { paymentMethod: { contains: search, mode: 'insensitive' } },
          { paymentStatus: { contains: search, mode: 'insensitive' } },
          {
            user: {
              is: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { team: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            company: {
              is: {
                OR: [
                  { companyName: { contains: search, mode: 'insensitive' } },
                  { ceoName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    const where = filters.length ? { AND: filters } : {};
    const skip = (page - 1) * pageSize;
    const [total, payments, statusTotals] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          productName: true,
          approvedCompany: true,
          paymentMethod: true,
          approvedAmount: true,
          paymentStatus: true,
          manager: true,
          managerTeam: true,
          startDate: true,
          endDate: true,
          company: {
            select: {
              companyName: true,
              ceoName: true,
            },
          },
          user: {
            select: {
              name: true,
              team: true,
            },
          },
        },
      }),
      prisma.payment.groupBy({
        by: ['paymentStatus'],
        where,
        _sum: { approvedAmount: true },
      }),
    ]);

    const totalSales = statusTotals
      .filter(item => isDashboardCompletedSaleStatus(item.paymentStatus))
      .reduce((sum, item) => sum + (Number(item._sum.approvedAmount) || 0), 0);
    const totalCancellations = statusTotals
      .filter(item => String(item.paymentStatus || '').includes('취소'))
      .reduce((sum, item) => sum + (Number(item._sum.approvedAmount) || 0), 0);

    res.json({
      rows: payments.map((payment, index) => ({
        id: payment.id,
        sequence: skip + index + 1,
        registrationDate: toDateString(payment.createdAt),
        product: payment.productName || '-',
        companyName: payment.company?.companyName || '-',
        ceoName: payment.company?.ceoName || '-',
        approvedCompany: payment.approvedCompany || '-',
        paymentMethod: payment.paymentMethod || '-',
        approvedAmount: payment.approvedAmount || 0,
        paymentStatus: payment.paymentStatus === '위약금' ? '부분취소' : payment.paymentStatus,
        team: payment.managerTeam || payment.user?.team || '-',
        manager: payment.manager || payment.user?.name || '-',
        period: `${toDateString(payment.startDate)} ~ ${toDateString(payment.endDate)}`,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(Math.ceil(total / pageSize), 1),
      totalSales,
      totalCancellations,
      appliedRange: {
        type: range,
        dateFrom,
        dateTo,
      },
    });
  } catch (error) {
    console.error('Fetch dashboard sales error:', error);
    res.status(500).json({ error: '매출현황 데이터를 불러오지 못했습니다.' });
  }
});

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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
      },
    });
    res.json({ message: '상태 변경 완료', user: updatedUser });
  } catch (error) {
    console.error('Change status error:', error);
    res.status(500).json({ error: '상태 변경 중 오류가 발생했습니다.' });
  }
});

apiRouter.patch('/users/:id/account-settings', verifyToken, verifyMasterRole, async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  const loginId = String(req.body.loginId || '').trim();
  const team = String(req.body.team || '').trim();
  const role = String(req.body.role || '').trim();
  const resetPassword = req.body.resetPassword === true;
  const hasAdVisibilityScopeInput = Object.prototype.hasOwnProperty.call(req.body, 'adVisibilityScope');
  const adVisibilityScope = normalizeAdVisibilityScope(req.body.adVisibilityScope);
  const hasCanEditAdsInput = Object.prototype.hasOwnProperty.call(req.body, 'canEditAds');
  const canEditAds = req.body.canEditAds === true;
  const hasCanDeleteAdsInput = Object.prototype.hasOwnProperty.call(req.body, 'canDeleteAds');
  const canDeleteAds = req.body.canDeleteAds === true;

  if (!Number.isInteger(targetUserId)) {
    return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
  }
  if (!loginId || !team || !role) {
    return res.status(400).json({ error: '아이디, 팀, 권한을 모두 입력해주세요.' });
  }
  if (!ROLE_OPTIONS.includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 권한 값입니다.' });
  }
  if (targetUserId === req.user.id && role !== '전체관리자') {
    return res.status(400).json({ error: '현재 로그인한 계정의 전체관리자 권한은 해제할 수 없습니다.' });
  }

  try {
    const [actor, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, role: true },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          team: true,
          department: true,
          level: true,
          adVisibilityScope: true,
          canEditAds: true,
          canDeleteAds: true,
        },
      }),
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    if (hasAdVisibilityScopeInput && !isMasterAccount(actor)) {
      return res.status(403).json({ error: '광고 열람권한 설정은 마스터 계정만 변경할 수 있습니다.' });
    }
    if (hasCanEditAdsInput && !isMasterAccount(actor)) {
      return res.status(403).json({ error: '광고 수정권한 설정은 마스터 계정만 변경할 수 있습니다.' });
    }
    if (hasCanDeleteAdsInput && !isMasterAccount(actor)) {
      return res.status(403).json({ error: '광고 삭제권한 설정은 마스터 계정만 변경할 수 있습니다.' });
    }

    if (loginId !== targetUser.email) {
      if (!/^[A-Za-z]+$/.test(loginId)) {
        return res.status(400).json({ error: '아이디는 영문만 사용할 수 있습니다.' });
      }

      const duplicateUser = await prisma.user.findUnique({
        where: { email: loginId },
        select: { id: true },
      });

      if (duplicateUser) {
        return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
      }
    }

    const isRepresentative = targetUser.level === '대표';
    const effectiveTeam = isRepresentative ? '대표' : team;
    const mappedDepartment = isRepresentative ? '대표' : teamDepartmentMapping[team];
    if (!isRepresentative && team !== targetUser.team && !mappedDepartment) {
      return res.status(400).json({ error: '유효하지 않은 팀 값입니다.' });
    }

    const updateData = {
      email: loginId,
      team: effectiveTeam,
      department: mappedDepartment || targetUser.department,
      role,
    };

    if (hasAdVisibilityScopeInput) {
      updateData.adVisibilityScope = isMasterAccount(targetUser) ? 'all' : adVisibilityScope;
    }
    if (hasCanEditAdsInput) {
      updateData.canEditAds = isMasterAccount(targetUser) ? true : canEditAds;
    }
    if (hasCanDeleteAdsInput) {
      updateData.canDeleteAds = isMasterAccount(targetUser) ? true : canDeleteAds;
    }

    if (resetPassword) {
      updateData.passwordHash = await bcrypt.hash('1111', 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
      },
    });

    res.json({
      message: resetPassword
        ? '계정 설정이 저장되었으며 비밀번호가 1111로 초기화되었습니다.'
        : '계정 설정이 저장되었습니다.',
      passwordReset: resetPassword,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update account settings error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }
    res.status(500).json({ error: '계정 설정 저장 중 오류가 발생했습니다.' });
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
      data: level === '대표'
        ? { level, team: '대표', department: '대표' }
        : { level },
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
      },
    });
    res.json({ message: '직급 변경 완료', user: updatedUser });
  } catch (error) {
    console.error('Change level error:', error);
    res.status(500).json({ error: '직급 변경 중 오류가 발생했습니다.' });
  }
});

async function deleteUsersWithRelations(tx, targetUserIds) {
  const archiveUser = await tx.user.findUnique({
    where: { email: 'cchee' },
    select: { id: true },
  });
  if (!archiveUser) {
    throw new Error('광고 데이터 보관 계정(cchee)을 찾을 수 없습니다.');
  }
  if (targetUserIds.includes(archiveUser.id)) {
    const protectedError = new Error('광고 데이터 보관 계정(cchee)은 삭제할 수 없습니다.');
    protectedError.statusCode = 400;
    throw protectedError;
  }

  const targetUsers = await tx.user.findMany({
    where: { id: { in: targetUserIds } },
    select: {
      id: true,
      name: true,
      team: true,
    },
  });

  for (const targetUser of targetUsers) {
    await tx.payment.updateMany({
      where: {
        userId: targetUser.id,
        OR: [
          { manager: null },
          { manager: '' },
        ],
      },
      data: { manager: targetUser.name },
    });
    await tx.payment.updateMany({
      where: {
        userId: targetUser.id,
        OR: [
          { managerTeam: null },
          { managerTeam: '' },
        ],
      },
      data: { managerTeam: targetUser.team },
    });
    await tx.payment.updateMany({
      where: { userId: targetUser.id },
      data: { userId: archiveUser.id },
    });
    await tx.company.updateMany({
      where: { userId: targetUser.id },
      data: { userId: archiveUser.id },
    });
  }

  const payrolls = await tx.payroll.findMany({
    where: { userId: { in: targetUserIds } },
    select: { id: true },
  });
  const payrollIds = payrolls.map(payroll => payroll.id);

  if (payrollIds.length > 0) {
    await tx.salesDetail.deleteMany({ where: { payrollId: { in: payrollIds } } });
    await tx.cancellationDetail.deleteMany({ where: { payrollId: { in: payrollIds } } });
  }

  await tx.payroll.deleteMany({ where: { userId: { in: targetUserIds } } });
  await tx.passwordResetToken.deleteMany({ where: { userId: { in: targetUserIds } } });
  await tx.personalMemo.deleteMany({ where: { userId: { in: targetUserIds } } });
  await tx.calendarEvent.deleteMany({ where: { userId: { in: targetUserIds } } });

  return tx.user.deleteMany({ where: { id: { in: targetUserIds } } });
}

apiRouter.post('/users/bulk-delete', verifyToken, verifyMasterRole, async (req, res) => {
  const rawUserIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
  const targetUserIds = [...new Set(rawUserIds.map(id => Number(id)).filter(Number.isInteger))];

  if (targetUserIds.length === 0) {
    return res.status(400).json({ error: '삭제할 사용자를 선택해주세요.' });
  }
  if (targetUserIds.includes(req.user.id)) {
    return res.status(400).json({ error: '현재 로그인한 계정은 일괄 삭제할 수 없습니다.' });
  }

  try {
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true, email: true, name: true },
    });

    if (targetUsers.length !== targetUserIds.length) {
      return res.status(404).json({ error: '선택한 사용자 중 존재하지 않는 계정이 있습니다.' });
    }

    await prisma.$transaction(
      async tx => {
        await deleteUsersWithRelations(tx, targetUserIds);
      },
      USER_DELETE_TRANSACTION_OPTIONS,
    );

    res.json({
      message: `${targetUsers.length}명의 사용자 계정이 삭제되었습니다.`,
      deletedUsers: targetUsers,
      deletedUserIds: targetUserIds,
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : '사용자 일괄 삭제 중 오류가 발생했습니다.',
    });
  }
});

apiRouter.delete('/users/:id', verifyToken, verifyMasterRole, async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);

  if (!Number.isInteger(targetUserId)) {
    return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
  }

  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: '현재 로그인한 계정은 삭제할 수 없습니다.' });
  }

  try {
    const deletedUser = await prisma.$transaction(
      async tx => {
        const targetUser = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, email: true, name: true },
        });

        if (!targetUser) {
          const notFoundError = new Error('사용자를 찾을 수 없습니다.');
          notFoundError.statusCode = 404;
          throw notFoundError;
        }

        await deleteUsersWithRelations(tx, [targetUserId]);
        return targetUser;
      },
      USER_DELETE_TRANSACTION_OPTIONS,
    );

    res.json({ message: '사용자 삭제가 완료되었습니다.', user: deletedUser });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : '사용자 삭제 중 오류가 발생했습니다.',
    });
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
        adVisibilityScope: true,
        canEditAds: true,
        canDeleteAds: true,
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
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '요청 용량이 너무 큽니다. 더 작은 이미지를 등록해주세요.' });
  }
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
