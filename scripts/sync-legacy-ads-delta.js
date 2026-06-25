/* eslint-disable no-console */
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const full = args.has('--full');
const adCodeArg = process.argv.find(item => item.startsWith('--ad-code='));
const selectedAdCodes = new Set(
  (adCodeArg ? adCodeArg.slice('--ad-code='.length) : '')
    .split(',')
    .map(clean)
    .filter(Boolean),
);

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find(item => item.startsWith(prefix));
  return path.resolve(value ? value.slice(prefix.length) : fallback);
}

const baselinePath = getArg('baseline', '.tmp_migration/inviewcc_ads_export.json');
const currentPath = getArg('current', '.tmp_migration/inviewcc_ads_export.2026-06-25.json');
const detailsPath = getArg(
  'details',
  full
    ? '.tmp_migration/inviewcc_ad_details_export.json'
    : '.tmp_migration/inviewcc_ad_details_delta.2026-06-25.json',
);
const backupDirectory = getArg('backup-dir', '.tmp_migration/backups');

function sanitizeJsonText(input) {
  let output = '';
  let inString = false;
  let escaping = false;

  for (const char of input) {
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

function readJson(filePath) {
  return JSON.parse(sanitizeJsonText(fs.readFileSync(filePath, 'utf8')));
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function text(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function money(value) {
  return Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

function parseDate(value, fallback = null) {
  const source = clean(value);
  if (!source || source.startsWith('0000-00-00')) return fallback;

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return fallback;

  const [, year, month, day, hour = '12', minute = '00', second = '00'] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ) - (9 * 60 * 60 * 1000));

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseContractDates(term, fallback) {
  const [startText, endText] = clean(term).split('~').map(clean);
  const startDate = parseDate(startText, fallback) || fallback;
  const endDate = parseDate(endText, startDate) || startDate;
  return { startDate, endDate };
}

function dateKey(value) {
  if (!value) return '';
  const koreanDate = new Date(new Date(value).getTime() + (9 * 60 * 60 * 1000));
  return koreanDate.toISOString().slice(0, 10);
}

function dateTimeKey(value) {
  return value ? new Date(value).toISOString() : '';
}

function identityKey(row) {
  return [
    clean(row.b_num),
    clean(row.corp_name),
    dateTimeKey(parseDate(row.reg_dt)),
  ].join('|');
}

function paymentIdentityKey(payment) {
  return [
    clean(payment.company?.businessRegNumber),
    clean(payment.company?.companyName),
    dateTimeKey(payment.createdAt),
  ].join('|');
}

function duplicateKey(row) {
  const createdAt = parseDate(row.reg_dt) || new Date(Date.UTC(2000, 0, 1, 12));
  return [
    clean(row.b_num),
    clean(row.corp_name) || '상호명 없음',
    dateKey(createdAt),
    money(row.price),
    clean(row.prdt_code) || '미지정',
    clean(row.auth_num),
  ].join('|');
}

function paymentDuplicateKey(payment) {
  return [
    clean(payment.company?.businessRegNumber),
    clean(payment.company?.companyName),
    dateKey(payment.createdAt),
    Number(payment.approvedAmount || 0),
    clean(payment.productName),
    clean(payment.approvalNumber),
  ].join('|');
}

function normalizePaymentStatus(value) {
  const status = clean(value);
  return status === '결제취소' ? '매출취소' : status || '결제대기';
}

function mapApprovedCompany(value) {
  const code = clean(value).toUpperCase();
  if (code === 'INV') return '(주)아이앤뷰커뮤니케이션';
  return clean(value) || '(주)아이앤뷰커뮤니케이션';
}

function mapTaxInvoice(value) {
  const code = clean(value).toUpperCase();
  if (code === 'Y') return '발행';
  if (code === 'N') return '미발행';
  return clean(value);
}

function mapInstallmentMonths(value) {
  const source = clean(value);
  return /^\d+$/.test(source) ? `${Number(source)}개월` : source;
}

function buildPayload(row, detail, userId, managerTeam) {
  const createdAt = parseDate(row.reg_dt) || new Date(Date.UTC(2000, 0, 1, 12));
  const detailTerm = `${detail.f_term || ''}~${detail.t_term || ''}`;
  const { startDate, endDate } = parseContractDates(
    clean(detail.f_term) || clean(detail.t_term) ? detailTerm : row.term,
    createdAt,
  );
  const productItems = Array.from(
    { length: 10 },
    (_, index) => text(detail[`prdt${index + 1}`]),
  );

  return {
    company: {
      userId,
      companyName: clean(detail.corp_name) || clean(row.corp_name) || '상호명 없음',
      ceoName: clean(detail.rep_name) || clean(row.rep_name),
      businessRegNumber: clean(detail.b_num) || clean(row.b_num),
      birthDate: '',
      tel: clean(detail.phone_num1) || clean(row.phone_num1),
      mobile: clean(detail.phone_num2) || clean(row.phone_num2),
      postcode: clean(detail.p_num),
      address: text(detail.addr1),
      detailAddress: text(detail.addr2) || null,
      companyUrl: clean(detail.corp_url) || null,
      companyEmail: clean(detail.corp_mail),
    },
    payment: {
      userId,
      productName: clean(row.prdt_code) || '미지정',
      startDate,
      endDate,
      approvedCompany: mapApprovedCompany(detail.recog_corp),
      taxInvoice: mapTaxInvoice(detail.tax_bill),
      paymentMethod: clean(row.pay_gubn),
      approvedAmount: money(detail.price || row.price),
      vat: money(detail.vat || row.vat),
      spendingCost: money(detail.exh_price || row.exh_price),
      netProfit: money(detail.rev_price || row.rev_price),
      approvalNumber: clean(detail.auth_num || row.auth_num) || null,
      paymentStatus: normalizePaymentStatus(row.pay_status || row.h_pay_status),
      cardCompany: clean(row.card_corp) || null,
      installmentMonths: mapInstallmentMonths(detail.card_month) || null,
      manager: clean(detail.manager_nm) || clean(row.manager) || null,
      managerTeam: clean(managerTeam) || clean(row.dept_name) || null,
      teamLead: clean(detail.t_manager_nm) || clean(detail.t_manager) || null,
      departmentHead: clean(detail.m_manager_nm) || clean(detail.m_manager) || null,
      productItems,
      production1: clean(row.making1) || null,
      production2: clean(row.making2) || null,
      adProgress: clean(row.ad_progress) || 'OFF',
      advertiserAccount: clean(detail.ad_account || row.ad_account) || null,
      registrationUrl: text(detail.reg_url) || null,
      titleText: text(detail.t_words) || null,
      descriptionText: text(detail.d_words) || null,
      memo: text(detail.remark) || null,
      smsContractStatus: clean(row.sms_yn) || '미발송',
      agreementStatus: clean(row.agree_gubn) || '미동의',
      agreementAt: parseDate(row.agree_dt, null),
    },
    createdAt,
  };
}

function resolveUser(row, usersByName) {
  const manager = clean(row.manager);
  const team = clean(row.dept_name);
  const candidates = usersByName.get(manager) || [];
  const exactTeam = candidates.filter(user => (
    clean(user.team) === team || clean(user.department) === team
  ));

  if (exactTeam.length === 1) return exactTeam[0];
  if (candidates.length === 1) return candidates[0];

  const active = candidates.filter(user => user.status === '재직');
  if (active.length === 1) return active[0];
  return null;
}

async function main() {
  const baseline = readJson(baselinePath);
  const current = readJson(currentPath);
  const detailExport = readJson(detailsPath);
  const baselineByCode = new Map(baseline.rows.map(row => [clean(row.ad_code), row]));
  const detailsByCode = new Map(detailExport.rows.map(row => [clean(row.ad_code), row]));
  const changedFields = [
    'manager', 'dept_name', 'corp_name', 'rep_name', 'b_num', 'phone_num1',
    'phone_num2', 'sms_yn', 'agree_gubn', 'agree_dt', 'term', 'prdt_code',
    'price', 'vat', 'exh_price', 'rev_price', 'pay_gubn', 'card_corp',
    'pay_status', 'making1', 'making2', 'ad_progress', 'ad_account', 'auth_num',
    'reg_dt',
  ];
  const changedRows = full ? current.rows : current.rows.filter(row => {
    const previous = baselineByCode.get(clean(row.ad_code));
    return !previous || changedFields.some(field => clean(previous[field]) !== clean(row[field]));
  });
  const deltaRows = selectedAdCodes.size > 0
    ? changedRows.filter(row => selectedAdCodes.has(clean(row.ad_code)))
    : changedRows;

  const [users, payments, beforeCounts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        team: true,
        department: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      include: { company: true },
      orderBy: { id: 'asc' },
    }),
    Promise.all([prisma.payment.count(), prisma.company.count()]),
  ]);
  const usersByName = new Map();
  for (const user of users) {
    const name = clean(user.name);
    if (!usersByName.has(name)) usersByName.set(name, []);
    usersByName.get(name).push(user);
  }
  const archiveUser = users.find(user => user.email === 'cchee');
  if (!archiveUser) {
    throw new Error('광고 데이터 보관 계정(cchee)을 찾을 수 없습니다.');
  }

  const paymentsByKey = new Map();
  const paymentsByIdentity = new Map();
  for (const payment of payments) {
    const key = paymentDuplicateKey(payment);
    if (!paymentsByKey.has(key)) paymentsByKey.set(key, []);
    paymentsByKey.get(key).push(payment);

    const identity = paymentIdentityKey(payment);
    if (!paymentsByIdentity.has(identity)) paymentsByIdentity.set(identity, []);
    paymentsByIdentity.get(identity).push(payment);
  }

  const usedPaymentIds = new Set();
  const targets = [];
  const errors = [];
  const skippedMissingExisting = [];

  for (const row of deltaRows) {
    const adCode = clean(row.ad_code);
    const previous = baselineByCode.get(adCode);
    const detail = detailsByCode.get(adCode);

    if (!detail || detail.fetch_error || detail.missing) {
      errors.push({ adCode, reason: detail?.fetch_error || '상세정보 없음' });
      continue;
    }

    const candidateIdentities = [
      previous ? identityKey(previous) : '',
      identityKey(row),
    ].filter(Boolean);
    const candidateKeys = [
      previous ? duplicateKey(previous) : '',
      duplicateKey(row),
    ].filter(Boolean);
    let existing = null;

    for (const identity of candidateIdentities) {
      existing = (paymentsByIdentity.get(identity) || [])
        .find(payment => !usedPaymentIds.has(payment.id));
      if (existing) break;
    }

    for (const key of candidateKeys) {
      if (existing) break;
      existing = (paymentsByKey.get(key) || []).find(payment => !usedPaymentIds.has(payment.id));
      if (existing) break;
    }

    const matchedUser = resolveUser(row, usersByName);
    if (!matchedUser && !full) {
      if (previous && !existing) {
        skippedMissingExisting.push({
          adCode,
          reason: `현재 사용자 계정 없음: ${clean(row.manager)} / ${clean(row.dept_name)}`,
        });
        continue;
      }
      errors.push({ adCode, reason: `사용자 매칭 실패: ${clean(row.manager)} / ${clean(row.dept_name)}` });
      continue;
    }
    const user = matchedUser || archiveUser;
    const managerTeam = matchedUser?.team || clean(row.dept_name);

    if (existing) usedPaymentIds.add(existing.id);
    targets.push({
      adCode,
      mode: existing ? 'update' : 'create',
      existing,
      payload: buildPayload(row, detail, user.id, managerTeam),
      manager: clean(row.manager),
      team: managerTeam,
      archived: !matchedUser,
    });
  }

  const creates = targets.filter(target => target.mode === 'create');
  const updates = targets.filter(target => target.mode === 'update');
  console.log(JSON.stringify({
    mode: apply ? (full ? 'full-apply' : 'apply') : (full ? 'full-dry-run' : 'dry-run'),
    baselineRows: baseline.rows.length,
    currentRows: current.rows.length,
    deltaRows: deltaRows.length,
    creates: creates.length,
    updates: updates.length,
    archivedOwnerRows: targets.filter(target => target.archived).length,
    skippedMissingExisting: skippedMissingExisting.length,
    skippedMissingExistingRows: skippedMissingExisting,
    errors,
    createSample: creates.slice(0, 5).map(target => ({
      adCode: target.adCode,
      manager: target.manager,
      team: target.team,
      companyName: target.payload.company.companyName,
    })),
    updateSample: updates.slice(0, 10).map(target => ({
      adCode: target.adCode,
      paymentId: target.existing.id,
      companyName: target.payload.company.companyName,
    })),
    beforeCounts: {
      payments: beforeCounts[0],
      companies: beforeCounts[1],
    },
  }, null, 2));

  if (errors.length > 0) {
    throw new Error(`동기화 검증 실패: ${errors.length}건`);
  }
  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to write to the database.');
    return;
  }

  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `legacy-delta-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    source: {
      baselinePath,
      currentPath,
      detailsPath,
    },
    beforeCounts: {
      payments: beforeCounts[0],
      companies: beforeCounts[1],
    },
    updates: updates.map(target => ({
      adCode: target.adCode,
      payment: target.existing,
    })),
  }, null, 2));

  for (const target of targets) {
    await prisma.$transaction(async tx => {
      if (target.mode === 'update') {
        await tx.company.update({
          where: { id: target.existing.companyId },
          data: target.payload.company,
        });
        await tx.payment.update({
          where: { id: target.existing.id },
          data: target.payload.payment,
        });
        return;
      }

      const company = await tx.company.create({
        data: {
          ...target.payload.company,
          createdAt: target.payload.createdAt,
          updatedAt: target.payload.createdAt,
        },
        select: { id: true },
      });
      await tx.payment.create({
        data: {
          ...target.payload.payment,
          companyId: company.id,
          createdAt: target.payload.createdAt,
          updatedAt: target.payload.createdAt,
        },
      });
    });
  }

  const [paymentCount, companyCount] = await Promise.all([
    prisma.payment.count(),
    prisma.company.count(),
  ]);
  console.log(JSON.stringify({
    applied: targets.length,
    created: creates.length,
    updated: updates.length,
    backupPath,
    afterCounts: {
      payments: paymentCount,
      companies: companyCount,
    },
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
