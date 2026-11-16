require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const AUTHOR_ACCOUNTS = { '윤주영': 'dbswndud', '조창희': 'whckdgml', '최윤솔': 'chldbsthf' };

function legacyDate(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value || '')) throw new Error(`Invalid source date: ${value}`);
  const date = new Date(value.replace(' ', 'T') + '+09:00');
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) {
    throw new Error(`Invalid source date: ${value}`);
  }
  return date;
}

function resolveAuthor(name, users) {
  if (Object.hasOwn(AUTHOR_ACCOUNTS, name)) {
    const user = users.find(user => user.email === AUTHOR_ACCOUNTS[name]);
    if (!user || user.name !== name) throw new Error(`Required author account mismatch: ${name}`);
    return user.id;
  }
  const candidates = users.filter(user => user.name === name);
  if (candidates.length > 1) throw new Error(`Ambiguous author name: ${name}`);
  return candidates[0]?.id ?? null;
}

function planComments(audit, source, users) {
  const sourceByCode = new Map(source.map(ad => [ad.ad_code, ad]));
  const seenPayments = new Set();
  const seenSources = new Set();
  const rows = [];
  for (const match of audit.comparisons) {
    const paymentId = match.backoffice.id;
    const sourceId = match.legacy.ad_code;
    if (seenPayments.has(paymentId) || seenSources.has(sourceId)) throw new Error('An advertisement is mapped more than once.');
    seenPayments.add(paymentId); seenSources.add(sourceId);
    const ad = sourceByCode.get(sourceId);
    if (!ad || ad.total !== ad.comments.length) throw new Error(`Incomplete source comments: ${sourceId}`);
    const occurrences = new Map();
    for (const comment of ad.comments) {
      if (typeof comment.content !== 'string' || typeof comment.authorName !== 'string') throw new Error('Invalid source comment.');
      const signature = JSON.stringify([sourceId, 'N', comment.authorName, comment.createdAt, comment.content]);
      const ordinal = (occurrences.get(signature) || 0) + 1;
      occurrences.set(signature, ordinal);
      // The source grid exposes no comment ID. Keep identical source rows via a deterministic occurrence number.
      const hash = crypto.createHash('sha256').update(signature).digest('hex');
      const createdAt = legacyDate(comment.createdAt);
      rows.push({ paymentId, userId: resolveAuthor(comment.authorName, users),
        authorNameSnapshot: comment.authorName, content: comment.content, createdAt, updatedAt: createdAt,
        isAdminOnly: false, legacySourceId: `inviewcc:ad-comment:${sourceId}:${hash}:${ordinal}` });
    }
  }
  if (new Set(rows.map(row => row.legacySourceId)).size !== rows.length) throw new Error('Duplicate import key.');
  return rows;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const directoryArg = process.argv.find(arg => arg.startsWith('--directory='));
  const directory = path.resolve(directoryArg ? directoryArg.slice('--directory='.length) : '.tmp_migration/homepage-comment-audit-2026-11-16');
  const audit = JSON.parse(fs.readFileSync(path.join(directory, 'comparison.json'), 'utf8'));
  const source = JSON.parse(fs.readFileSync(path.join(directory, 'legacy-comments.json'), 'utf8'));
  const db = new PrismaClient();
  try {
    const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
    for (const name of Object.keys(AUTHOR_ACCOUNTS)) resolveAuthor(name, users);
    const rows = planComments(audit, source, users);
    const current = await db.payment.findMany({ where: { id: { in: audit.comparisons.map(match => match.backoffice.id) } },
      select: { id: true, createdAt: true, company: { select: { companyName: true, businessRegNumber: true } } } });
    for (const match of audit.comparisons) {
      const record = current.find(record => record.id === match.backoffice.id);
      if (!record || record.createdAt.toISOString() !== match.backoffice.createdAt ||
        record.company?.companyName !== match.backoffice.company?.companyName ||
        record.company?.businessRegNumber !== match.backoffice.company?.businessRegNumber) {
        throw new Error(`Advertisement changed after comparison: ${match.backoffice.id}`);
      }
    }
    const existing = await db.adComment.findMany({ where: { legacySourceId: { in: rows.map(row => row.legacySourceId) } }, select: { legacySourceId: true } });
    const existingKeys = new Set(existing.map(comment => comment.legacySourceId));
    const pending = rows.filter(row => !existingKeys.has(row.legacySourceId));
    const report = { mode: apply ? 'apply' : 'dry-run', matchedAds: audit.comparisons.length,
      sourceComments: rows.length, newComments: pending.length, alreadyImported: existing.length,
      deferredAds: audit.legacyOnly.length, deferredComments: audit.legacyOnly.reduce((sum, ad) => sum + ad.comments.length, 0),
      authorMappings: Object.fromEntries(Object.keys(AUTHOR_ACCOUNTS).map(name => [name, { loginId: AUTHOR_ACCOUNTS[name], userId: resolveAuthor(name, users), comments: rows.filter(row => row.authorNameSnapshot === name).length }])),
      archivedComments: rows.filter(row => row.userId === null).length };
    console.log(JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(directory, 'comment-import-plan.json'), JSON.stringify({ report, rows }, null, 2));
    if (!apply || !pending.length) return;
    const before = await db.adComment.findMany({ orderBy: { id: 'asc' } });
    const backupPath = path.join(directory, `comments-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(before, null, 2));
    const created = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261116)`;
      const imported = await tx.adComment.findMany({ where: { legacySourceId: { in: pending.map(row => row.legacySourceId) } }, select: { legacySourceId: true } });
      const keys = new Set(imported.map(row => row.legacySourceId));
      const data = pending.filter(row => !keys.has(row.legacySourceId));
      for (let offset = 0; offset < data.length; offset += 200) await tx.adComment.createMany({ data: data.slice(offset, offset + 200) });
      const unchanged = await tx.adComment.findMany({ where: { id: { in: before.map(row => row.id) } }, orderBy: { id: 'asc' } });
      if (JSON.stringify(unchanged) !== JSON.stringify(before)) throw new Error('Existing comments changed; rolling back import.');
      const importedRows = await tx.adComment.findMany({ where: { legacySourceId: { in: rows.map(row => row.legacySourceId) } } });
      if (importedRows.length !== rows.length) throw new Error('Imported comment count mismatch.');
      const byKey = new Map(importedRows.map(row => [row.legacySourceId, row]));
      for (const expected of rows) {
        const actual = byKey.get(expected.legacySourceId);
        for (const key of ['paymentId', 'userId', 'authorNameSnapshot', 'content', 'isAdminOnly']) {
          if (actual[key] !== expected[key]) throw new Error(`Comment verification failed: ${key}`);
        }
        if (+actual.createdAt !== +expected.createdAt || +actual.updatedAt !== +expected.updatedAt) throw new Error('Source timestamp mismatch.');
      }
      return data.length;
    }, { maxWait: 10000, timeout: 120000 });
    const result = { ...report, created, unchangedExistingComments: before.length, backupPath,
      totalComments: await db.adComment.count(), completedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(directory, 'comment-import-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await db.$disconnect(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { legacyDate, resolveAuthor, planComments };
