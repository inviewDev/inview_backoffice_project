/* eslint-disable no-console */
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const sourcePath = path.resolve(
  process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length)
    || '.tmp_migration/inviewcc_ads_export.2026-06-25.json',
);
const backupDirectory = path.resolve('.tmp_migration/backups');

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

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseSourceDate(value, koreanTime) {
  const match = clean(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (!match) return null;

  const [, year, month, day, hour = '12', minute = '00', second = '00'] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return new Date(timestamp - (koreanTime ? 9 * 60 * 60 * 1000 : 0));
}

function identityKey(businessRegNumber, companyName, createdAt) {
  return [
    clean(businessRegNumber),
    clean(companyName),
    createdAt?.toISOString() || '',
  ].join('|');
}

async function main() {
  const source = JSON.parse(sanitizeJsonText(fs.readFileSync(sourcePath, 'utf8')));
  const payments = await prisma.payment.findMany({
    include: {
      company: {
        select: {
          businessRegNumber: true,
          companyName: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const paymentsByIdentity = new Map();
  for (const payment of payments) {
    const key = identityKey(
      payment.company?.businessRegNumber,
      payment.company?.companyName,
      payment.createdAt,
    );
    if (!paymentsByIdentity.has(key)) paymentsByIdentity.set(key, []);
    paymentsByIdentity.get(key).push(payment);
  }

  const usedPaymentIds = new Set();
  const targets = [];
  const missing = [];

  for (const row of source.rows) {
    const oldCreatedAt = parseSourceDate(row.reg_dt, false);
    const correctedCreatedAt = parseSourceDate(row.reg_dt, true);
    const key = identityKey(row.b_num, row.corp_name, oldCreatedAt);
    const payment = (paymentsByIdentity.get(key) || [])
      .find(candidate => !usedPaymentIds.has(candidate.id));

    if (!payment || !correctedCreatedAt) {
      missing.push({
        adCode: clean(row.ad_code),
        companyName: clean(row.corp_name),
        registeredAt: clean(row.reg_dt),
      });
      continue;
    }

    usedPaymentIds.add(payment.id);
    targets.push({
      id: payment.id,
      adCode: clean(row.ad_code),
      oldCreatedAt: payment.createdAt.toISOString(),
      correctedCreatedAt: correctedCreatedAt.toISOString(),
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    sourceRows: source.rows.length,
    paymentRows: payments.length,
    matched: targets.length,
    localOnly: payments.length - targets.length,
    missing: missing.length,
    missingSample: missing.slice(0, 10),
    newestBefore: targets
      .slice()
      .sort((a, b) => b.oldCreatedAt.localeCompare(a.oldCreatedAt))
      .slice(0, 3),
  }, null, 2));

  if (missing.length > 0 || targets.length !== source.rows.length) {
    throw new Error(`Legacy payment matching failed: ${missing.length} missing`);
  }
  if (!apply) return;

  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `legacy-created-at-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    sourcePath,
    rows: targets,
  }, null, 2));

  const batchSize = 500;
  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    const values = batch
      .map(target => `(${target.id}, '${target.correctedCreatedAt}'::timestamptz)`)
      .join(', ');
    await prisma.$executeRawUnsafe(`
      UPDATE "Payment" AS payment
      SET "createdAt" = corrected."createdAt"
      FROM (VALUES ${values}) AS corrected(id, "createdAt")
      WHERE payment.id = corrected.id
    `);
  }

  console.log(JSON.stringify({
    updated: targets.length,
    backupPath,
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
