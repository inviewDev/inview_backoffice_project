/* eslint-disable no-console */
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refetch = args.has('--refetch');
const fetchOnly = args.has('--fetch-only');

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

const limit = Number(getArg('limit', '0')) || 0;
const concurrency = Math.max(1, Math.min(Number(getArg('concurrency', '6')) || 6, 20));
const listExportPath = path.resolve(
  getArg('file', path.join(process.cwd(), '.tmp_migration', 'inviewcc_ads_export.json')),
);
const defaultDetailsPath = path.join(
  process.cwd(),
  '.tmp_migration',
  limit > 0 ? `inviewcc_ad_details_export.limit${limit}.json` : 'inviewcc_ad_details_export.json',
);
const detailsExportPath = path.resolve(getArg('details-file', defaultDetailsPath));

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

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(sanitizeJsonText(raw));
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
  return date ? new Date(date).toISOString().split('T')[0] : '';
}

function duplicateKeyFromValues({
  businessRegNumber,
  companyName,
  createdAt,
  approvedAmount,
  productName,
  approvalNumber,
}) {
  return [
    clean(businessRegNumber),
    clean(companyName),
    dateKey(createdAt),
    Number(approvedAmount || 0),
    clean(productName),
    clean(approvalNumber),
  ].join('|');
}

function duplicateKeyFromListRow(row) {
  const createdAt = parseDate(row.reg_dt) || new Date(Date.UTC(2000, 0, 1, 12));
  return duplicateKeyFromValues({
    businessRegNumber: row.b_num,
    companyName: clean(row.corp_name) || '?',
    createdAt,
    approvedAmount: money(row.price),
    productName: clean(row.prdt_code) || '?',
    approvalNumber: row.auth_num,
  });
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function compactSample(rows, size = 5) {
  return rows.slice(0, size).map(row => ({
    adCode: row.adCode,
    paymentId: row.paymentId,
    reason: row.reason,
  }));
}

function buildProductItems(detail) {
  return Array.from({ length: 10 }, (_, index) => text(detail[`prdt${index + 1}`]));
}

function hasProductContent(items) {
  return items.some(item => item.length > 0);
}

function mapApprovedCompany(value) {
  const code = clean(value).toUpperCase();
  if (code === 'INV') return '(주)아이앤뷰커뮤니케이션';
  return clean(value) || undefined;
}

function mapTaxInvoice(value) {
  const code = clean(value).toUpperCase();
  if (code === 'Y') return '발행';
  if (code === 'N') return '미발행';
  return clean(value) || undefined;
}

function mapInstallmentMonths(value) {
  const source = clean(value);
  if (/^\d+$/.test(source)) return `${Number(source)}개월`;
  return source || undefined;
}

function postLegacyDetail(adCode) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      query_id: 'Select_AdvertisingDetail',
      ad_code: adCode,
    }).toString();

    const request = http.request(
      {
        hostname: 'inviewcc.cafe24.com',
        path: '/source/CS/common_table_json.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 20000,
      },
      response => {
        const chunks = [];

        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          try {
            const parsed = JSON.parse(sanitizeJsonText(responseText));
            const row = Array.isArray(parsed.rows) ? parsed.rows[0] : null;
            resolve(row ? { ...row, ad_code: clean(row.ad_code) || adCode } : { ad_code: adCode, missing: true });
          } catch (error) {
            reject(new Error(`Parse failed: ${error.message}`));
          }
        });
      },
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });
    request.write(body);
    request.end();
  });
}

async function retry(fn, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  throw lastError;
}

async function fetchDetails(rows) {
  const results = new Array(rows.length);
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      const adCode = clean(rows[index].ad_code);

      try {
        results[index] = await retry(() => postLegacyDetail(adCode));
      } catch (error) {
        failed += 1;
        results[index] = { ad_code: adCode, fetch_error: error.message };
      } finally {
        completed += 1;
        if (completed % 250 === 0 || completed === rows.length) {
          console.log(`Fetched details ${completed}/${rows.length} (failed: ${failed})`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

  return { rows: results, failed };
}

async function loadOrFetchDetails(rows) {
  if (!refetch && fs.existsSync(detailsExportPath)) {
    const parsed = readJsonFile(detailsExportPath);
    const cachedRows = Array.isArray(parsed.rows) ? parsed.rows : [];

    if (cachedRows.length >= rows.length) {
      return {
        rows: cachedRows.slice(0, rows.length),
        failed: cachedRows.filter(row => row.fetch_error).length,
        fromCache: true,
      };
    }

    console.log(`Cached detail file has ${cachedRows.length} rows, expected ${rows.length}. Refetching.`);
  }

  const result = await fetchDetails(rows);
  fs.mkdirSync(path.dirname(detailsExportPath), { recursive: true });
  fs.writeFileSync(
    detailsExportPath,
    JSON.stringify({
      fetchedAt: new Date().toISOString(),
      sourceRows: rows.length,
      failed: result.failed,
      rows: result.rows,
    }, null, 2),
    'utf8',
  );

  return { ...result, fromCache: false };
}

async function getExistingPaymentMap() {
  const payments = await prisma.$queryRaw`
    select p."id",
           p."companyId",
           p."createdAt",
           p."approvedAmount",
           p."productName",
           p."approvalNumber",
           c."businessRegNumber",
           c."companyName"
      from "Payment" p
      left join "Company" c
        on p."companyId" = c."id"
     order by p."id" asc
  `;

  const byKey = new Map();

  for (const payment of payments) {
    const key = duplicateKeyFromValues({
      businessRegNumber: payment.businessRegNumber || '',
      companyName: payment.companyName || '',
      createdAt: payment.createdAt,
      approvedAmount: payment.approvedAmount,
      productName: payment.productName,
      approvalNumber: payment.approvalNumber || '',
    });

    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({
      id: payment.id,
      companyId: payment.companyId,
    });
  }

  return byKey;
}

function createDetailUpdatePayload(listRow, detail) {
  const productItems = buildProductItems(detail);
  const { startDate, endDate } = parseContractDates(
    `${detail.f_term || ''}~${detail.t_term || ''}`,
    parseDate(listRow.reg_dt),
  );

  return {
    company: {
      companyName: clean(detail.corp_name) || clean(listRow.corp_name) || undefined,
      ceoName: clean(detail.rep_name) || clean(listRow.rep_name) || undefined,
      businessRegNumber: clean(detail.b_num) || clean(listRow.b_num) || undefined,
      tel: clean(detail.phone_num1) || clean(listRow.phone_num1) || undefined,
      mobile: clean(detail.phone_num2) || clean(listRow.phone_num2) || undefined,
      postcode: clean(detail.p_num),
      address: text(detail.addr1),
      detailAddress: text(detail.addr2) || null,
      companyUrl: clean(detail.corp_url) || null,
      companyEmail: clean(detail.corp_mail),
    },
    payment: {
      startDate,
      endDate,
      approvedAmount: money(detail.price || listRow.price),
      vat: money(detail.vat || listRow.vat),
      spendingCost: money(detail.exh_price || listRow.exh_price),
      netProfit: money(detail.rev_price || listRow.rev_price),
      approvedCompany: mapApprovedCompany(detail.recog_corp),
      taxInvoice: mapTaxInvoice(detail.tax_bill),
      paymentMethod: clean(listRow.pay_gubn) || undefined,
      cardCompany: clean(listRow.card_corp) || undefined,
      installmentMonths: mapInstallmentMonths(detail.card_month),
      approvalNumber: clean(detail.auth_num || listRow.auth_num) || null,
      manager: clean(detail.manager_nm) || clean(listRow.manager) || null,
      teamLead: clean(detail.t_manager_nm) || clean(detail.t_manager) || null,
      departmentHead: clean(detail.m_manager_nm) || clean(detail.m_manager) || null,
      productItems: hasProductContent(productItems) ? productItems : [],
      advertiserAccount: clean(detail.ad_account || listRow.ad_account) || null,
      registrationUrl: text(detail.reg_url) || null,
      titleText: text(detail.t_words) || null,
      descriptionText: text(detail.d_words) || null,
      memo: text(detail.remark) || null,
    },
  };
}

async function applyUpdates(targetRows) {
  let updated = 0;

  for (const row of targetRows) {
    await prisma.$transaction(async tx => {
      if (row.companyId) {
        await tx.company.update({
          where: { id: row.companyId },
          data: row.payload.company,
        });
      }

      await tx.payment.update({
        where: { id: row.paymentId },
        data: row.payload.payment,
      });
    });

    updated += 1;
    if (updated % 500 === 0 || updated === targetRows.length) {
      console.log(`Updated details ${updated}/${targetRows.length}`);
    }
  }

  return updated;
}

async function main() {
  if (!fs.existsSync(listExportPath)) {
    throw new Error(`List export file not found: ${listExportPath}`);
  }

  const listExport = readJsonFile(listExportPath);
  const allListRows = Array.isArray(listExport.rows) ? listExport.rows : [];
  const listRows = limit > 0 ? allListRows.slice(0, limit) : allListRows;

  if (listRows.length === 0) {
    throw new Error('No list rows found.');
  }

  const detailResult = await loadOrFetchDetails(listRows);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    fetchOnly,
    sourceRows: allListRows.length,
    limitedRows: listRows.length,
    detailsRows: detailResult.rows.length,
    detailsFailed: detailResult.failed,
    detailsFromCache: detailResult.fromCache,
    detailsExportPath,
    concurrency,
  }, null, 2));

  if (fetchOnly) return;

  const existingPaymentMap = await getExistingPaymentMap();
  const detailByAdCode = new Map(detailResult.rows.map(row => [clean(row.ad_code), row]));
  const targetRows = [];
  const unmatchedRows = [];
  const missingDetailRows = [];
  const ambiguousRows = [];

  for (const listRow of listRows) {
    const adCode = clean(listRow.ad_code);
    const detail = detailByAdCode.get(adCode);

    if (!detail || detail.fetch_error || detail.missing) {
      missingDetailRows.push({ adCode, reason: detail?.fetch_error || 'missing detail' });
      continue;
    }

    const key = duplicateKeyFromListRow(listRow);
    const candidates = existingPaymentMap.get(key) || [];
    const candidate = candidates.shift();

    if (!candidate) {
      unmatchedRows.push({ adCode, reason: 'payment not matched' });
      continue;
    }

    if (candidates.length > 0) {
      ambiguousRows.push({ adCode, paymentId: candidate.id, reason: `${candidates.length + 1} payments share key` });
    }

    targetRows.push({
      adCode,
      paymentId: candidate.id,
      companyId: candidate.companyId,
      payload: createDetailUpdatePayload(listRow, detail),
    });
  }

  const withProductItems = targetRows.filter(row => hasProductContent(row.payload.payment.productItems)).length;
  const withTeamLead = targetRows.filter(row => row.payload.payment.teamLead).length;
  const withDepartmentHead = targetRows.filter(row => row.payload.payment.departmentHead).length;
  const withAddress = targetRows.filter(row => row.payload.company.address || row.payload.company.detailAddress).length;
  const withExtraText = targetRows.filter(row =>
    row.payload.payment.registrationUrl ||
    row.payload.payment.titleText ||
    row.payload.payment.descriptionText ||
    row.payload.payment.memo
  ).length;

  console.log(JSON.stringify({
    matchedRows: targetRows.length,
    unmatchedRows: unmatchedRows.length,
    missingDetailRows: missingDetailRows.length,
    ambiguousRows: ambiguousRows.length,
    withProductItems,
    withTeamLead,
    withDepartmentHead,
    withAddress,
    withExtraText,
    unmatchedSample: compactSample(unmatchedRows),
    missingDetailSample: compactSample(missingDetailRows),
    ambiguousSample: compactSample(ambiguousRows),
  }, null, 2));

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to update the database.');
    return;
  }

  const updated = await applyUpdates(targetRows);
  console.log(`Updated ${updated} legacy ad detail rows.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
