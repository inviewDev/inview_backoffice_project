require('dotenv').config({ quiet: true });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { inspectAsset } = require('./legacy-notice-data.cjs');

const origin = 'http://127.0.0.1:5173';
const directory = path.resolve('.tmp_migration');

async function main() {
  const prisma = new PrismaClient();
  let browser;
  try {
    const expected = JSON.parse(fs.readFileSync(path.join(directory, 'notices-prepared.json'), 'utf8'));
    const posts = await prisma.communityPost.findMany({ where: { legacySourceId: { startsWith: 'inviewcc:notice:' } } });
    assert.equal(posts.length, expected.length);
    const postMap = new Map(posts.map(post => [post.legacySourceId, post]));
    for (const source of expected) {
      const actual = postMap.get(source.sourceId);
      assert.equal(actual.title, source.title);
      assert.equal(actual.authorNameSnapshot, source.authorName);
      assert.equal(actual.createdAt.toISOString(), source.createdAt);
      assert.equal(actual.contentText, source.contentText);
      assert.deepEqual(actual.content, source.content);
    }
    const user = await prisma.user.findUnique({ where: { email: 'cchee' }, select: { id: true, email: true, role: true, name: true } });
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '10m' });
    const headers = { Authorization: `Bearer ${token}` };
    const listResponse = await fetch(`${origin}/api/community/posts?boardType=notice&pageSize=50`, { headers });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.pagination.total, await prisma.communityPost.count({ where: { boardType: 'notice' } }));
    const assets = new Map();
    for (const post of posts) {
      const response = await fetch(`${origin}/api/community/posts/${post.id}`, { headers });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.post.authorName, post.authorNameSnapshot);
      function visit(node) {
        const references = [node.type === 'image' ? node.attrs?.src : null,
          ...(node.marks || []).filter(mark => mark.type === 'link').map(mark => mark.attrs?.href)];
        for (const reference of references.filter(Boolean)) {
          if (!reference.startsWith('/api/community/assets/')) continue;
          const id = reference.match(/assets\/([a-f0-9]{64})/)[1];
          assets.set(id, reference);
        }
        (node.content || []).forEach(visit);
      }
      visit(payload.post.content);
    }
    assert.equal(assets.size, await prisma.communityAsset.count());
    let verifiedAssets = 0;
    for (const [id, url] of assets) {
      const response = await fetch(`${origin}${url}`);
      assert.equal(response.status, 200);
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'), id);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      verifiedAssets += 1;
    }
    const firstAsset = [...assets.values()][0];
    assert.equal((await fetch(`${origin}${firstAsset.split('?')[0]}`)).status, 401);
    const imageToken = new URL(firstAsset, origin).searchParams.get('token');
    assert.equal((await fetch(`${origin}/api/me`, { headers: { Authorization: `Bearer ${imageToken}` } })).status, 403);
    for (const authorName of ['박광희', '김민']) {
      const response = await fetch(`${origin}/api/community/posts?boardType=notice&search=${encodeURIComponent(authorName)}`, { headers });
      const result = await response.json();
      assert(result.posts.length > 0);
      assert(result.posts.some(post => post.authorName === authorName));
    }
    console.log(`Verified ${posts.length} complete posts and ${verifiedAssets} byte-exact assets through the local API.`);
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    });
    const context = await browser.newContext({ timezoneId: 'Asia/Seoul' });
    await context.addInitScript(value => localStorage.setItem('access_token', value), token);
    let attemptedWrites = 0;
    await context.route('**/api/**', async route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { attemptedWrites += 1; return route.abort(); }
      const url = new URL(route.request().url());
      if (url.searchParams.get('trackView') === 'true') {
        url.searchParams.set('trackView', 'false');
        return route.continue({ url: url.href });
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const screenshotDirectory = path.join(directory, 'notice-browser-qa');
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const imagePost = postMap.get('inviewcc:notice:N20261000001');
    const authorPost = posts.find(post => post.authorNameSnapshot === '김민');
    const attachmentPost = postMap.get('inviewcc:notice:N20190800002');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/community?tab=notice`);
      await page.locator('.community_post_item').first().waitFor();
      await page.screenshot({ path: path.join(screenshotDirectory, `list-${width}.png`) });
      for (const post of [imagePost, authorPost, attachmentPost]) {
        await page.goto(`${origin}/community/${post.id}?tab=notice`);
        await page.locator('.community_detail_header h1').waitFor();
        assert.equal((await page.locator('.community_detail_header h1').innerText()).trim(), post.title.trim());
        assert((await page.locator('.community_post_meta').innerText()).includes(post.authorNameSnapshot));
        await page.waitForFunction(() => [...document.querySelectorAll('.community_prose img')].every(image => image.complete && image.naturalWidth > 0));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.screenshot({ path: path.join(screenshotDirectory, `post-${post.id}-${width}.png`) });
      }
    }
    const fileLink = page.locator('.community_prose a[href*="download=1"]');
    const [download] = await Promise.all([page.waitForEvent('download'), fileLink.click()]);
    assert(download.suggestedFilename().endsWith('.xls'));
    const downloadPath = await download.path();
    const originalFile = JSON.parse(fs.readFileSync(path.join(directory, 'notice-assets/manifest.json'), 'utf8'))
      .find(asset => asset.url.includes('F20190813N00001'));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(downloadPath)).digest('hex'), originalFile.sha256);
    assert.equal(attemptedWrites, 0);
    assert.deepEqual(errors, []);
    const sample = inspectAsset(fs.readFileSync(originalFile.file), download.suggestedFilename());
    assert.equal(sample.mimeType, 'application/vnd.ms-excel');
    const report = { passed: true, posts: posts.length, verifiedAssets, notices: list.pagination.total,
      viewportWidths: [1440, 390, 320], screenshots: screenshotDirectory, attemptedWrites,
      checks: ['all-post-titles-authors-dates-content', 'all-asset-sha256', 'archived-author-search',
        'asset-authentication', 'images-render', 'attachment-download', 'no-horizontal-overflow', 'no-browser-errors'] };
    fs.writeFileSync(path.join(directory, 'notice-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (browser) await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
