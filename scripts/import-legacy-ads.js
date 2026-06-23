/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const noCreateUsers = args.has('--no-create-users');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;
const exportPathArg = process.argv.find(arg => arg.startsWith('--file='));
const exportPath = exportPathArg
  ? path.resolve(exportPathArg.split('=').slice(1).join('='))
  : path.join(process.cwd(), '.tmp_migration', 'inviewcc_ads_export.json');

function sanitizeJsonText(input) {
  let output = '';
  let inString = false;
  let escaping = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const code = char.charCodeAt(0);

    if (!inString) {
      output += char;
      if (char === '"') inString = true;
      continue;
    }

    if (escaping) {
      output += char;
      escaping = false;
    } else if (char === '\\') {
      output += char;
      escaping = true;
    } else if (char === '"') {
      output += char;
      inString = false;
    } else if (code < 0x20) {
      if (char === '\t') output += '\\t';
      else if (char === '\n') output += '\\n';
      else if (char === '\r') output += '\\r';
      else output += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      output += char;
    }
  }

  return output;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function money(value) {
  return Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

function parseDate(value, fallback = null) {
  const text = clean(value);
  if (!text || text.startsWith('0000-00-00')) return fallback;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return fallback;

  const [, year, month, day, hour = '12', minute = '00', second = '00'] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseContractDates(term, createdAt) {
  const [startText, endText] = clean(term).split('~').map(part => clean(part));
  const startDate = parseDate(startText, createdAt) || createdAt || new Date(Date.UTC(2000, 0, 1, 12));
  const endDate = parseDate(endText, startDate) || startDate;
  return { startDate, endDate };
}

function dateKey(date) {
  return date ? date.toISOString().split('T')[0] : '';
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function legacyUserEmail(manager, department) {
  return `legacy_${hash(`${manager}|${department}`)}@legacy.inviewcc.local`;
}

function duplicateKeyFromValues({ businessRegNumber, companyName, createdAt, approvedAmount, productName, approvalNumber }) {
  return [
    clean(businessRegNumber),
    clean(companyName),
    dateKey(createdAt),
    Number(approvedAmount || 0),
    clean(productName),
    clean(approvalNumber),
  ].join('|');
}

function mapRow(row, userId) {
  const createdAt = parseDate(row.reg_dt) || new Date(Date.UTC(2000, 0, 1, 12));
  const agreementAt = parseDate(row.agree_dt, null);
  const { startDate, endDate } = parseContractDates(row.term, createdAt);
  const companyName = clean(row.corp_name) || '상호명 없음';
  const businessRegNumber = clean(row.b_num);
  const productName = clean(row.prdt_code) || '미지정';
  const approvedAmount = money(row.price);
  const approvalNumber = clean(row.auth_num);

  return {
    legacyAdCode: clean(row.ad_code),
    duplicateKey: duplicateKeyFromValues({
      businessRegNumber,
      companyName,
      createdAt,
      approvedAmount,
      productName,
      approvalNumber,
    }),
    company: {
      userId,
      companyName,
      ceoName: clean(row.rep_name),
      businessRegNumber,
      birthDate: '',
      tel: clean(row.phone_num1),
      mobile: clean(row.phone_num2),
      postcode: '',
      address: '',
      detailAddress: '',
      companyUrl: '',
      companyEmail: '',
      createdAt,
      updatedAt: createdAt,
    },
    payment: {
      userId,
      productName,
      startDate,
      endDate,
      approvedCompany: '(주)아이앤뷰커뮤니케이션',
      taxInvoice: '',
      paymentMethod: clean(row.pay_gubn),
      approvedAmount,
      vat: money(row.vat),
      spendingCost: money(row.exh_price),
      netProfit: money(row.rev_price),
      approvalNumber,
      paymentStatus: clean(row.pay_status) || clean(row.h_pay_status),
      cardCompany: clean(row.card_corp),
      installmentMonths: '',
      manager: clean(row.manager),
      teamLead: '',
      departmentHead: '',
      productItems: [],
      production1: clean(row.making1),
      production2: clean(row.making2),
      adProgress: clean(row.ad_progress) || 'OFF',
      advertiserAccount: clean(row.ad_account),
      registrationUrl: '',
      titleText: '',
      descriptionText: '',
      memo: '',
      fileName: '',
      smsContractStatus: clean(row.sms_yn) || '미발송',
      agreementStatus: clean(row.agree_gubn) || '미동의',
      agreementAt,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

async function getFallbackUserId() {
  const user = await prisma.user.findFirst({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });

  if (!user) {
    throw new Error('현재 DB에 연결할 기본 사용자가 없습니다. 먼저 관리자 계정을 만들어야 합니다.');
  }

  return user.id;
}

async function getOrCreateLegacyUsers(rows, fallbackUserId) {
  const pairs = new Map();

  for (const row of rows) {
    const manager = clean(row.manager) || '담당자 미상';
    const department = clean(row.dept_name) || '부서 미상';
    pairs.set(`${manager}|${department}`, { manager, department });
  }

  if (noCreateUsers) {
    return {
      userByPair: new Map([...pairs.keys()].map(key => [key, fallbackUserId])),
      createdUsers: 0,
      matchedUsers: 0,
      plannedUsers: pairs.size,
    };
  }

  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, department: true },
  });
  const byEmail = new Map(existingUsers.map(user => [user.email, user]));
  const byNameDepartment = new Map(
    existingUsers.map(user => [`${clean(user.name)}|${clean(user.department)}`, user]),
  );

  const passwordHash = apply ? await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10) : '';
  const userByPair = new Map();
  let createdUsers = 0;
  let matchedUsers = 0;

  for (const [key, pair] of pairs) {
    const email = legacyUserEmail(pair.manager, pair.department);
    const existing = byNameDepartment.get(key) || byEmail.get(email);

    if (existing) {
      userByPair.set(key, existing.id);
      matchedUsers += 1;
      continue;
    }

    if (!apply) {
      userByPair.set(key, fallbackUserId);
      createdUsers += 1;
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: pair.manager,
        team: pair.department,
        department: pair.department,
        role: '사용자',
        status: '퇴사',
        level: '사원',
        phoneNumber: '010-0000-0000',
        birthDate: new Date(Date.UTC(2000, 0, 1, 12)),
      },
      select: { id: true },
    });

    userByPair.set(key, user.id);
    createdUsers += 1;
  }

  return {
    userByPair,
    createdUsers,
    matchedUsers,
    plannedUsers: pairs.size,
  };
}

async function getExistingPaymentKeys() {
  const payments = await prisma.$queryRaw`
    select p."createdAt",
           p."approvedAmount",
           p."productName",
           p."approvalNumber",
           c."businessRegNumber",
           c."companyName"
      from "Payment" p
      left join "Company" c
        on p."companyId" = c."id"
  `;

  return new Set(payments.map(payment => duplicateKeyFromValues({
    businessRegNumber: payment.businessRegNumber || '',
    companyName: payment.companyName || '',
    createdAt: payment.createdAt,
    approvedAmount: payment.approvedAmount,
    productName: payment.productName,
    approvalNumber: payment.approvalNumber || '',
  })));
}

async function hasProductItemsColumn() {
  const rows = await prisma.$queryRaw`
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'Payment'
       and column_name = 'productItems'
     limit 1
  `;
  return rows.length > 0;
}

async function ensureProductItemsColumn() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "productItems" JSONB');
}

async function main() {
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export file not found: ${exportPath}`);
  }

  const raw = fs.readFileSync(exportPath, 'utf8');
  const parsed = JSON.parse(sanitizeJsonText(raw));
  const allRows = parsed.rows || [];
  const rows = limit > 0 ? allRows.slice(0, limit) : allRows;

  const fallbackUserId = await getFallbackUserId();
  const productItemsColumnExists = await hasProductItemsColumn();
  const existingKeys = await getExistingPaymentKeys();
  const userResult = await getOrCreateLegacyUsers(rows, fallbackUserId);

  const mappedRows = [];
  const duplicateRows = [];
  const invalidTermRows = [];

  for (const row of rows) {
    const manager = clean(row.manager) || '담당자 미상';
    const department = clean(row.dept_name) || '부서 미상';
    const userId = userResult.userByPair.get(`${manager}|${department}`) || fallbackUserId;
    const mapped = mapRow(row, userId);

    if (existingKeys.has(mapped.duplicateKey)) {
      duplicateRows.push(row);
      continue;
    }

    if (!clean(row.term).includes('~')) {
      invalidTermRows.push(row);
    }

    mappedRows.push(mapped);
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    sourceRows: allRows.length,
    limitedRows: rows.length,
    existingPaymentKeys: existingKeys.size,
    legacyUserPairs: userResult.plannedUsers,
    matchedUsers: userResult.matchedUsers,
    usersToCreate: userResult.createdUsers,
    duplicateRows: duplicateRows.length,
    invalidTermRows: invalidTermRows.length,
    productItemsColumnExists,
    schemaChangesOnApply: productItemsColumnExists ? [] : ['Payment.productItems JSONB'],
    paymentsToCreate: mappedRows.length,
  }, null, 2));

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to write to the database.');
    return;
  }

  if (!productItemsColumnExists) {
    await ensureProductItemsColumn();
    console.log('Added missing Payment.productItems column.');
  }

  let imported = 0;
  for (const mapped of mappedRows) {
    await prisma.$transaction(async tx => {
      const company = await tx.company.create({ data: mapped.company, select: { id: true } });
      await tx.payment.create({
        data: {
          ...mapped.payment,
          companyId: company.id,
        },
      });
    });

    imported += 1;
    existingKeys.add(mapped.duplicateKey);

    if (imported % 500 === 0) {
      console.log(`Imported ${imported}/${mappedRows.length}`);
    }
  }

  console.log(`Imported ${imported} legacy ads.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
