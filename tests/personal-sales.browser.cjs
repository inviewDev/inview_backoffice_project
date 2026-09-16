const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { expect } = require((process.env.PLAYWRIGHT_MODULE || 'playwright') + '/test');

const output = path.join(os.tmpdir(), 'inview-personal-sales-qa');
const url = process.env.SALES_TEST_URL || 'http://127.0.0.1:5173/paystub';
const fixtureUser = { id: 1, email: 'test@example.test', name: '테스트', role: '전체관리자', level: '대표' };
const token = ['e30', Buffer.from(JSON.stringify({ ...fixtureUser, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-only'].join('.');
const rows = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1, name: `직원 ${String(index + 1).padStart(2, '0')}`,
  department: index < 8 ? '1부서' : '2부서', team: index < 8 ? '1팀' : '2팀',
  approvedAmount: (15 - index) * 1100000, netProfit: index * 250000, count: 15 - index,
}));
rows.push({ id: 16, name: '실적 없음', department: '1부서', team: '1팀', approvedAmount: 0, netProfit: 0, count: 0 });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
    await context.addInitScript(value => localStorage.setItem('access_token', value), token);
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let mode = 'normal';
    page.on('pageerror', error => errors.push(error.message));
    // No request from this test reaches the database or an authenticated live service.
    await context.route('**/api/**', async route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname === '/api/me') return route.fulfill({ json: { user: fixtureUser } });
      if (requestUrl.pathname === '/api/sales-permissions') return route.fulfill({ json: { canViewTeamSales: false } });
      if (requestUrl.pathname === '/api/personal-sales') {
        const month = requestUrl.searchParams.get('month');
        requests.push(month);
        if (mode === 'error') return route.fulfill({ status: 500, json: { error: '테스트 조회 오류' } });
        return route.fulfill({ json: { month, scope: 'all', rows: mode === 'empty' ? [] : rows } });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected test request' } });
    });
    await page.goto(url);
    const tableRows = page.locator('.personal_sales_table tbody tr');
    const ready = () => page.locator('.personal_sales_table_wrap[aria-busy="false"]').waitFor();
    await ready();
    assert.equal(await page.locator('h1').innerText(), '개인별 매출 통계');
    await expect(page.getByRole('columnheader', { name: '순위' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '조회 인원 범위' })).toHaveCount(0);
    await expect(page.locator('.ad_manage_count')).toContainText('15명');
    await expect(tableRows).toHaveCount(10);
    await expect(tableRows.first()).toContainText('직원 01');
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: '순이익', exact: true }).click();
    await expect(tableRows.first()).toContainText('직원 15');
    await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
    await expect(tableRows).toHaveCount(5);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드' }).click();
    const download = await downloadEvent;
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(csv.startsWith('\uFEFF'));
    assert.equal(csv.split('\r\n').length, 16);
    assert.ok(!csv.includes('순위'));
    assert.ok(!csv.includes('실적 없음'));
    await page.getByRole('combobox', { name: '페이지 크기' }).selectOption('20');
    await expect(tableRows).toHaveCount(15);
    await page.getByRole('combobox', { name: '페이지 크기' }).selectOption('5');
    await expect(tableRows).toHaveCount(5);
    await page.getByRole('combobox', { name: '페이지 크기' }).selectOption('10');

    await page.getByLabel('부서', { exact: true }).selectOption('2부서');
    await expect(tableRows).toHaveCount(7);
    await page.getByLabel('팀', { exact: true }).selectOption('2팀');
    await expect(tableRows).toHaveCount(7);
    await page.getByLabel('통합검색').fill('직원 15');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await ready();
    await expect(tableRows).toHaveCount(1);
    await expect(tableRows.first()).toContainText('직원 15');

    await page.getByLabel('통합검색').fill('없는직원');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await ready();
    await expect(tableRows).toContainText('해당하는 직원이 없습니다');
    assert.equal(await page.getByRole('button', { name: 'CSV 다운로드' }).isDisabled(), true);
    await page.getByRole('button', { name: '검색 조건 초기화' }).click();
    await ready();
    await expect(tableRows).toHaveCount(10);

    await page.getByLabel('조회 연월').fill('2026-01');
    await ready();
    await page.getByRole('button', { name: '이전 달' }).click();
    await ready();
    assert.equal(await page.getByLabel('조회 연월').inputValue(), '2025-12');
    await expect.poll(() => requests.at(-1)).toBe('2025-12');

    mode = 'error';
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.ok((await page.getByRole('alert').innerText()).includes('테스트 조회 오류'));
    mode = 'normal';
    await page.getByRole('button', { name: '다시 시도' }).click();
    await ready();
    await expect(tableRows).toHaveCount(10);

    for (const width of [1024, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.admin_sidebar_nav')).toBeHidden();
      await page.screenshot({ path: path.join(output, `viewport-${width}.png`), fullPage: true, animations: 'disabled' });
      const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, section: document.querySelector('.personal_sales').getBoundingClientRect().width }));
      assert.ok(layout.document <= layout.viewport + 1, JSON.stringify(layout));
      const controlsFit = await page.locator('.personal_sales_filters input, .personal_sales_filters select').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().right <= innerWidth));
      assert.equal(controlsFit, true);
    }
    mode = 'empty';
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await ready();
    await expect(tableRows).toContainText('해당하는 직원이 없습니다');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['no-rank', 'all-positive-count-employees', 'metric-sort', 'pagination-page-size', 'csv-all-pages', 'department-team-search', 'empty', 'reset', 'month-rollover', 'error-retry', 'responsive-1440-1024-390-320', 'no-page-errors'], screenshots: output }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
