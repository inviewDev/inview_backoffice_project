require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ORIGIN = 'https://inviewcc.cafe24.com';
const output = path.resolve('.tmp_migration/inviewcc_notices_export.json');

async function main() {
  if (!process.env.LEGACY_LOGIN_ID || !process.env.LEGACY_LOGIN_PASSWORD) {
    throw new Error('Set LEGACY_LOGIN_ID and LEGACY_LOGIN_PASSWORD for the authorized source account.');
  }
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto(`${ORIGIN}/source/LOGIN/login.php`);
    await page.locator('#UserID').fill(process.env.LEGACY_LOGIN_ID);
    await page.locator('#UserPW').fill(process.env.LEGACY_LOGIN_PASSWORD);
    await page.locator('#login_check').click();
    await page.waitForURL(`${ORIGIN}/index.php`, { timeout: 15000 }).catch(() => {
      throw new Error(`Source login did not complete. ${dialogs.join(' ')}`);
    });
    await page.goto(`${ORIGIN}/source/SDL/dl_notice_manage.php`);
    await page.locator('tr[data-note_code]').first().waitFor();
    const responsePromise = page.waitForResponse(response => response.url().includes('/source/CS/common_table.php'));
    await page.locator('select.grd-row-select').selectOption('500');
    await responsePromise;
    await page.waitForFunction(() => document.querySelectorAll('tr[data-note_code]').length > 20);
    const rows = await page.locator('tr[data-note_code]').evaluateAll(elements => elements.map(element => ({
      sourceId: element.dataset.note_code,
      title: element.dataset.note_title,
      authorName: element.dataset.reg_nm,
      createdAt: element.dataset.reg_dt,
      viewCount: Number(element.dataset.note_view),
    })));
    if (!rows.length || rows.length >= 500) throw new Error('Source list completeness must be checked.');
    const countText = await page.locator('#result').innerText();
    const countMatches = [...countText.matchAll(/([\d,]+)\s*건/g)];
    const total = Number(countMatches.at(-1)?.[1].replaceAll(',', ''));
    if (total !== rows.length || new Set(rows.map(row => row.sourceId)).size !== total) {
      throw new Error(`Incomplete source list: ${rows.length} rows / ${total} total.`);
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : { posts: [] };
    const cache = new Map(previous.posts.map(post => [post.sourceId, post]));
    const posts = [];
    const parser = await context.newPage();
    await parser.goto('about:blank');
    for (const row of rows) {
      let detail = cache.get(row.sourceId);
      if (!detail || detail.title !== row.title || detail.createdAt !== row.createdAt) {
        const sourceUrl = `${ORIGIN}/source/SDL/dl_board_manage_detail.php?note_gubn=N&note_code=${encodeURIComponent(row.sourceId)}`;
        const response = await context.request.get(sourceUrl);
        if (!response.ok()) throw new Error(`Read failed: ${row.sourceId} (${response.status()}).`);
        const html = await response.text();
        const extracted = await parser.evaluate(htmlText => {
          const document = new DOMParser().parseFromString(htmlText, 'text/html');
          const content = document.querySelector('.board-contents');
          if (!content) throw new Error('Missing board contents; authentication or source markup changed.');
          const info = [...document.querySelectorAll('.board-info strong')].map(element => element.textContent.trim());
          const images = [...content.querySelectorAll('img')].map(element => element.getAttribute('src'));
          const links = [...document.querySelectorAll('#frmMain a[href], #frmMain [onclick]')]
            .map(element => ({ text: element.textContent.trim(), href: element.getAttribute('href'), onclick: element.getAttribute('onclick') }));
          return { html: content.innerHTML, text: content.textContent, info, images, links,
            tags: [...new Set([...content.querySelectorAll('*')].map(element => element.tagName))] };
        }, html);
        if ((row.authorName && extracted.info[0] !== row.authorName) || extracted.info[1] !== row.createdAt) {
          throw new Error(`Source detail metadata mismatch: ${row.sourceId}: ${JSON.stringify({ list: [row.authorName, row.createdAt], detail: extracted.info })}.`);
        }
        detail = { ...row, authorName: extracted.info[0] || row.authorName, sourceUrl, ...extracted };
        cache.set(row.sourceId, detail);
      }
      posts.push(detail);
      fs.writeFileSync(output, JSON.stringify({ source: ORIGIN, exportedAt: new Date().toISOString(), total, posts }, null, 2));
      if (posts.length % 25 === 0) console.log(`Exported ${posts.length}/${total}`);
    }
    const assetDirectory = path.resolve('.tmp_migration/notice-assets');
    fs.mkdirSync(assetDirectory, { recursive: true });
    const assetUrls = new Set(posts.flatMap(post => [
      ...post.images.map(src => new URL(src, post.sourceUrl).href),
      ...post.links.filter(link => link.href?.includes('dl_board_manage_file_download.php'))
        .map(link => new URL(link.href, post.sourceUrl).href),
    ]));
    const assets = [];
    for (const url of assetUrls) {
      const key = crypto.createHash('sha256').update(url).digest('hex');
      const file = path.join(assetDirectory, key);
      const metadata = `${file}.json`;
      if (fs.existsSync(file) && fs.existsSync(metadata)) {
        assets.push(JSON.parse(fs.readFileSync(metadata, 'utf8')));
        continue;
      }
      try {
        const response = await context.request.get(url, { timeout: 20000 });
        const body = await response.body();
        const mimeType = (response.headers()['content-type'] || '').split(';')[0].trim();
        if (!response.ok() || !body.length || /text\/html/.test(mimeType)) {
          throw new Error(`HTTP ${response.status()} / ${mimeType} / ${body.length} bytes`);
        }
        const asset = { url, file, mimeType, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') };
        fs.writeFileSync(file, body);
        fs.writeFileSync(metadata, JSON.stringify(asset, null, 2));
        assets.push(asset);
      } catch (error) {
        assets.push({ url, error: error.message });
      }
      if (assets.length % 20 === 0) console.log(`Downloaded ${assets.length}/${assetUrls.size} assets`);
    }
    fs.writeFileSync(path.join(assetDirectory, 'manifest.json'), JSON.stringify(assets, null, 2));
    console.log(JSON.stringify({ output, count: posts.length,
      authors: [...new Set(posts.map(post => post.authorName))],
      images: [...new Set(posts.flatMap(post => post.images))].length,
      links: posts.flatMap(post => post.links).filter(link => link.href || link.onclick).length,
      tags: [...new Set(posts.flatMap(post => post.tags))],
      oldest: posts.at(-1)?.createdAt, newest: posts[0]?.createdAt,
      assets: assets.length, failedAssets: assets.filter(asset => asset.error),
      assetBytes: assets.reduce((sum, asset) => sum + (asset.bytes || 0), 0) }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
