const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { expect } = require((process.env.PLAYWRIGHT_MODULE || 'playwright') + '/test');

const origin = process.env.SALES_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = path.join(os.tmpdir(), 'inview-account-settings-qa');
const accounts = [
  { id: 1, name: '마스터', email: 'cchee', role: '전체관리자', team: '개발관리부', department: '운영부서', level: '사원', status: '재직' },
  { id: 2, name: '김직원', email: 'staff2', role: '사용자', team: '1팀', department: '1부서', level: '사원', status: '재직' },
  { id: 3, name: '이관리', email: 'admin3', role: '전체관리자', team: '2팀', department: '2부서', level: '팀장', status: '재직' },
  { id: 4, name: '가입대기', email: 'pending4', role: '사용자', team: '3팀', department: '1부서', level: '사원', status: '가입대기' },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) });
  const errors = [];
  const saved = [];
  let available = true;
  let saveError = false;
  let grants = new Set();
  try {
    async function session(id) {
      const actor = accounts.find(account => account.id === id);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
      const token = ['e30', Buffer.from(JSON.stringify({ ...actor, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-only'].join('.');
      await context.addInitScript(value => localStorage.setItem('access_token', value), token);
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const allowed = actor.id === 1 || grants.has(actor.id);
        if (url.pathname === '/api/me') return route.fulfill({ json: { user: actor } });
        if (url.pathname === '/api/users') return route.fulfill({ json: accounts.filter(account => account.status !== '가입대기') });
        if (url.pathname === '/api/users/pending') return route.fulfill({ json: accounts.filter(account => account.status === '가입대기') });
        if (url.pathname === '/api/sales-permissions') return route.fulfill({ json: { canViewTeamSales: allowed } });
        if (url.pathname === '/api/users/sales-permissions') return route.fulfill({ json: { ready: available, permissions: [...grants].map(userId => ({ userId, canViewTeamSales: true })) } });
        if (url.pathname.match(/^\/api\/users\/\d+\/account-settings$/)) {
          if (saveError) return route.fulfill({ status: 500, json: { error: '테스트 저장 오류' } });
          const payload = route.request().postDataJSON();
          const targetId = Number(url.pathname.split('/')[3]);
          saved.push({ id: targetId, payload });
          if (payload.canViewTeamSales === true) grants.add(targetId);
          if (payload.canViewTeamSales === false) grants.delete(targetId);
          const index = accounts.findIndex(account => account.id === targetId);
          accounts[index] = { ...accounts[index], ...payload, email: payload.loginId };
          return route.fulfill({ json: { user: accounts[index], message: '계정 설정이 저장되었습니다.' } });
        }
        if (url.pathname === '/api/team-sales') {
          if (!allowed) return route.fulfill({ status: 403, json: { error: '팀별 매출 통계 열람 권한이 없습니다.' } });
          return route.fulfill({ json: { month: url.searchParams.get('month'), scope: 'all', rows: [
            { id: 'team1', department: '1부서', team: '1팀', approvedAmount: 22000000, netProfit: 9000000, count: 10 },
            { id: 'team2', department: '2부서', team: '2팀', approvedAmount: 11000000, netProfit: 4000000, count: 5 },
          ] } });
        }
        return route.fulfill({ status: 404, json: { error: 'Unexpected test request' } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      return { context, page };
    }

    const root = await session(1);
    const page = root.page;
    await page.goto(origin + '/users');
    await expect(page.getByRole('tab', { name: '계정설정' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '계정설정' })).toHaveCount(0);
    await page.getByRole('tab', { name: '계정설정' }).click();
    await expect(page).toHaveURL(/\/users\/account-settings$/);
    await page.getByRole('button', { name: /김직원/ }).click();
    await page.getByRole('switch', { name: '팀별 매출 통계 열람' }).check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('저장되었습니다');
    assert.equal(saved.at(-1).payload.canViewTeamSales, true);
    await page.reload();
    await page.getByRole('button', { name: /김직원/ }).click();
    await expect(page.getByRole('switch', { name: '팀별 매출 통계 열람' })).toBeChecked();
    await page.screenshot({ path: path.join(output, 'accounts-desktop.png'), fullPage: true, animations: 'disabled' });

    const viewer = await session(2);
    await viewer.page.goto(origin + '/team-sales');
    await expect(viewer.page.getByRole('heading', { name: '팀별 매출 통계', exact: true })).toBeVisible();
    await expect(viewer.page.locator('.personal_sales_table tbody tr')).toHaveCount(2);
    await expect(viewer.page.getByRole('columnheader', { name: '이름', exact: true })).toHaveCount(0);
    const downloadEvent = viewer.page.waitForEvent('download');
    await viewer.page.getByRole('button', { name: 'CSV 다운로드' }).click();
    const downloaded = await downloadEvent;
    const csv = fs.readFileSync(await downloaded.path(), 'utf8');
    assert.equal(csv.split('\r\n')[0], '\uFEFF"부서","팀","승인금액","순이익","건수"');
    await viewer.page.screenshot({ path: path.join(output, 'team-sales-desktop.png'), fullPage: true, animations: 'disabled' });
    await viewer.page.getByLabel('부서', { exact: true }).selectOption('1부서');
    await expect(viewer.page.locator('.personal_sales_table tbody tr')).toHaveCount(1);
    await viewer.page.setViewportSize({ width: 390, height: 844 });
    await expect(viewer.page.locator('.admin_sidebar_nav')).toBeHidden();
    await viewer.page.evaluate(() => scrollTo(0, 0));
    await viewer.page.screenshot({ path: path.join(output, 'team-sales-mobile.png'), fullPage: true, animations: 'disabled' });
    assert.ok(await viewer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await page.getByRole('switch', { name: '팀별 매출 통계 열람' }).uncheck();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('저장되었습니다');
    assert.equal(saved.at(-1).payload.canViewTeamSales, false);
    await viewer.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(viewer.page.getByRole('alert')).toContainText('열람 권한이 없습니다');
    await expect(viewer.page.locator('.admin_nav_item', { hasText: '팀별 매출 통계' })).toHaveCount(0);
    await expect(viewer.page.locator('.personal_sales_table')).not.toContainText('22,000,000');

    saveError = true;
    await page.getByRole('switch', { name: '광고상품 수정' }).check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('테스트 저장 오류');
    await expect(page.getByRole('switch', { name: '광고상품 수정' })).toBeChecked();
    saveError = false;
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByRole('switch', { name: '광고상품 수정' })).not.toBeChecked();
    await page.getByRole('button', { name: /마스터/ }).click();
    await expect(page.getByLabel('아이디', { exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: '팀별 매출 통계 열람' })).toBeDisabled();
    await page.getByRole('button', { name: /김직원/ }).click();
    for (const width of [1024, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.admin_sidebar_nav')).toBeHidden();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `accounts-${width}.png`), fullPage: true, animations: 'disabled' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.getByRole('tab', { name: '대기목록' }).click();
    await expect(page).toHaveURL(/tab=pending/);
    await expect(page.getByRole('tab', { name: '대기목록' })).toHaveAttribute('aria-selected', 'true');

    const admin = await session(3);
    await admin.page.goto(origin + '/users/account-settings');
    await admin.page.getByRole('button', { name: /김직원/ }).click();
    await expect(admin.page.getByRole('switch', { name: '팀별 매출 통계 열람' })).toHaveCount(0);
    await admin.page.getByLabel('아이디', { exact: true }).fill('staff2updated');
    await admin.page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(admin.page.getByRole('alert')).toContainText('저장되었습니다');
    assert.ok(!('canViewTeamSales' in saved.at(-1).payload));
    assert.ok(!('adVisibilityScope' in saved.at(-1).payload));
    await admin.page.goto(origin + '/team-sales');
    await expect(admin.page.getByRole('alert')).toContainText('열람 권한이 없습니다');

    available = false;
    await page.goto(origin + '/users/account-settings');
    await page.getByRole('button', { name: /김직원/ }).click();
    await expect(page.getByRole('alert')).toContainText('마이그레이션');
    await expect(page.getByRole('switch', { name: '팀별 매출 통계 열람' })).toBeDisabled();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, screenshots: output, checks: ['settings-tab', 'no-row-settings', 'grant-save-reload', 'revoke-on-focus', 'team-table-csv', 'save-error-retains-draft', 'cancel', 'protected-root', 'non-root-permission-hidden', 'pending-route', 'responsive', 'missing-storage-state'] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
