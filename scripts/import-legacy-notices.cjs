require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { parseLegacyNoticeDate, communityContentText, inspectAsset, resolveNoticeAuthor } = require('./legacy-notice-data.cjs');

const directory = path.resolve('.tmp_migration');
const apply = process.argv.includes('--apply');

async function preparePosts(source, assets) {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const { buildSync } = require('esbuild');
  const bundle = buildSync({
    stdin: { contents: `
      import { generateJSON } from '@tiptap/core';
      import StarterKit from '@tiptap/starter-kit';
      import Image from '@tiptap/extension-image';
      import TextAlign from '@tiptap/extension-text-align';
      const extensions = [StarterKit.configure({ heading: { levels: [1,2,3] } }), Image, TextAlign.configure({types:['heading','paragraph','image']})];
      window.convertLegacyNotice = html => generateJSON(html, extensions);
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser',
  }).outputFiles[0].text;
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: bundle });
    const assetMap = Object.fromEntries(assets.map(asset => [asset.url, asset.id]));
    const posts = [];
    for (const post of source.posts) {
      const parsed = await page.evaluate(({ post, assetMap }) => {
        const document = new DOMParser().parseFromString(post.html, 'text/html');
        document.querySelectorAll('script,style,iframe,object,embed').forEach(element => element.remove());
        for (const element of document.querySelectorAll('*')) {
          for (const attribute of [...element.attributes]) {
            if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
          }
        }
        for (const image of document.querySelectorAll('img')) {
          const url = new URL(image.getAttribute('src'), post.sourceUrl).href;
          if (!assetMap[url]) throw new Error('Missing image asset.');
          image.setAttribute('src', '/api/community/assets/' + assetMap[url]);
          image.removeAttribute('srcset');
        }
        for (const link of document.querySelectorAll('a[href]')) {
          const href = new URL(link.getAttribute('href'), post.sourceUrl);
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(href.protocol)) link.removeAttribute('href');
          else link.setAttribute('href', href.href);
        }
        // The current editor has no table extension; keep every cell in reading order.
        for (const table of [...document.querySelectorAll('table')].reverse()) {
          const replacement = document.createElement('div');
          for (const row of table.rows) {
            const rowElement = document.createElement('div');
            for (const cell of row.cells) {
              const cellElement = document.createElement('div');
              cellElement.append(...[...cell.childNodes]);
              rowElement.append(cellElement);
            }
            replacement.append(rowElement);
          }
          table.replaceWith(replacement);
        }
        const content = window.convertLegacyNotice(document.body.innerHTML);
        for (const link of post.links.filter(link => link.href?.includes('dl_board_manage_file_download.php'))) {
          const assetId = assetMap[new URL(link.href, post.sourceUrl).href];
          if (!assetId) throw new Error('Missing attachment asset.');
          content.content.push({ type: 'paragraph', content: [{ type: 'text', text: link.text,
            marks: [{ type: 'link', attrs: { href: '/api/community/assets/' + assetId + '?download=1', target: '_blank', rel: 'noopener noreferrer nofollow' } }] }] });
        }
        return { content, expectedText: document.body.textContent,
          expectedImages: document.querySelectorAll('img').length };
      }, { post, assetMap });
      const text = communityContentText(parsed.content);
      const attachmentText = post.links.filter(link => link.href?.includes('dl_board_manage_file_download.php')).map(link => link.text).join('');
      const normalize = value => value.replace(/\s+/g, '');
      if (normalize(text) !== normalize(parsed.expectedText + attachmentText)) throw new Error(`Content text changed: ${post.sourceId}`);
      const images = JSON.stringify(parsed.content).match(/"type":"image"/g) || [];
      if (images.length !== parsed.expectedImages) throw new Error(`Image count changed: ${post.sourceId}`);
      if (!post.authorName?.trim()) throw new Error(`Missing author: ${post.sourceId}`);
      posts.push({ sourceId: `inviewcc:notice:${post.sourceId}`, title: post.title,
        authorName: post.authorName, createdAt: parseLegacyNoticeDate(post.createdAt).toISOString(),
        viewCount: post.viewCount, content: parsed.content, contentText: text.trim() });
    }
    return posts;
  } finally { await browser.close(); }
}

async function main() {
  const source = JSON.parse(fs.readFileSync(path.join(directory, 'inviewcc_notices_export.json'), 'utf8'));
  if (source.posts.length !== source.total || new Set(source.posts.map(post => post.sourceId)).size !== source.total) throw new Error('Incomplete or duplicate source export.');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'notice-assets/manifest.json'), 'utf8'));
  const assets = manifest.map(asset => {
    if (asset.error) throw new Error(`Asset export failed: ${asset.url}`);
    const url = new URL(asset.url);
    const fileName = url.searchParams.get('file_name') || decodeURIComponent(url.pathname.split('/').at(-1));
    const buffer = fs.readFileSync(asset.file);
    const checked = inspectAsset(buffer, fileName);
    if (checked.id !== asset.sha256 || checked.byteSize !== asset.bytes) throw new Error(`Asset checksum mismatch: ${fileName}`);
    return { ...asset, ...checked, fileName };
  });
  const posts = await preparePosts(source, assets);
  fs.writeFileSync(path.join(directory, 'notices-prepared.json'), JSON.stringify(posts, null, 2));
  const prisma = new PrismaClient();
  try {
    const [users, existing] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.communityPost.findMany({ where: { legacySourceId: { in: posts.map(post => post.sourceId) } }, select: { legacySourceId: true } }),
    ]);
    const imported = new Set(existing.map(post => post.legacySourceId));
    const pending = posts.filter(post => !imported.has(post.sourceId));
    const uniqueAssets = [...new Map(assets.map(asset => [asset.id, asset])).values()];
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', sourcePosts: posts.length,
      newPosts: pending.length, alreadyImported: existing.length, uniqueAssets: uniqueAssets.length,
      archivedAuthors: [...new Set(posts.filter(post => resolveNoticeAuthor(post.authorName, users) === null).map(post => post.authorName))],
      firstCreatedAt: posts.at(-1).createdAt, lastCreatedAt: posts[0].createdAt }, null, 2));
    if (!apply || !pending.length) return;
    const backup = await prisma.communityPost.findMany({ include: { views: true } });
    const backupPath = path.join(directory, `notices-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    const result = await prisma.$transaction(async tx => {
      // Serializes concurrent re-runs without locking ordinary community reads/writes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261027)`;
      let created = 0;
      for (const asset of uniqueAssets) {
        if (await tx.communityAsset.findUnique({ where: { id: asset.id }, select: { id: true } })) continue;
        await tx.communityAsset.create({ data: { id: asset.id, fileName: asset.fileName,
          mimeType: asset.mimeType, byteSize: asset.byteSize, data: fs.readFileSync(asset.file) } });
      }
      for (const post of pending) {
        if (await tx.communityPost.findUnique({ where: { legacySourceId: post.sourceId }, select: { id: true } })) continue;
        await tx.communityPost.create({ data: {
          boardType: 'notice', title: post.title, content: post.content, contentText: post.contentText,
          viewCount: post.viewCount, createdAt: new Date(post.createdAt), updatedAt: new Date(post.createdAt),
          authorId: resolveNoticeAuthor(post.authorName, users), authorNameSnapshot: post.authorName, legacySourceId: post.sourceId,
        } });
        created += 1;
      }
      return { created };
    }, { timeout: 180000, maxWait: 10000 });
    const after = await prisma.communityPost.findMany({ where: { id: { in: backup.map(post => post.id) } }, include: { views: true } });
    const normalize = records => JSON.stringify(records.sort((a, b) => a.id - b.id));
    if (normalize(after) !== normalize(backup)) throw new Error('Existing posts changed during import; inspect backup before further action.');
    console.log(JSON.stringify({ ...result, backupPath, unchangedExistingPosts: backup.length,
      totalNotices: await prisma.communityPost.count({ where: { boardType: 'notice' } }) }, null, 2));
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { preparePosts };
