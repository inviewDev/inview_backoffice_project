const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { expect } = require((process.env.PLAYWRIGHT_MODULE || 'playwright') + '/test');

const origin = process.env.THEME_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = path.join(os.tmpdir(), 'inview-theme-qa');
const actor = { id: 1, name: '디자인검증', email: 'cchee', role: '전체관리자', team: '개발관리부', department: '운영부서', level: '사원', status: '재직', canWritePosts: true, canEditAds: true, canEditAdPaymentStatus: true };
const accounts = [actor, ...['김담당', '이담당', '박담당'].map((name, i) => ({ id: i + 2, name, email: `staff${i}`, role: '사용자', team: `${i + 1}팀`, department: '1부서', level: '대리', status: '재직' }))];
const ad = { id: 1, companyName: '아이앤뷰 테스트 업체', ceoName: '김대표', businessRegNumber: '000-00-00000', tel: '02-0000-0000', mobile: '010-0000-0000', address: '서울특별시 테스트로 10', detailAddress: '3층', companyEmail: 'test@example.com', companyUrl: 'https://example.com', manager: '김담당', managerUserId: 2, team: '1팀', productName: 'G패키지', approvedAmount: 3300000, spendingCost: 1000000, netProfit: 2000000, vat: 300000, paymentStatus: '결제승인', paymentMethod: '카드', cardCompany: '신한', taxInvoice: '발행', contractStartDate: '2026-09-01', contractEndDate: '2026-09-30', createdAt: '2026-09-01T03:00:00.000Z', smsContractStatus: '미발송', agreementStatus: '미동의', canEditAd: true, canEditPaymentStatus: true, canDeleteAd: true, canUseAdminComments: true, comments: [], adminComments: [], smsHistories: [], productItems: ['검색광고', '브랜드 관리'], adProgress: 'ON', production1: '검색광고', production2: '브랜드 관리', memo: '디자인 확인용 테스트 데이터' };
const ads = Array.from({ length: 10 }, (_, i) => ({ ...ad, id: i + 1, companyName: `테스트 광고주 ${i + 1}`, manager: accounts[1 + i % 3].name, department: accounts[1 + i % 3].department, team: `${1 + i % 3}팀`, paymentStatus: ['결제대기', '결제승인', '매출취소', '부분취소'][i % 4] }));
const post = { id: 1, title: '9월 업무 일정 및 공지사항', boardType: 'notice', authorName: '디자인검증', authorTeam: '개발관리부', createdAt: '2026-09-01T03:00:00.000Z', viewCount: 27, canEdit: true, canDelete: true, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '9월 업무 일정 안내입니다. 광고 등록과 계약 정보를 확인해주세요.' }] }] } };
const token = ['e30', Buffer.from(JSON.stringify({ ...actor, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-only'].join('.');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) });
  const errors = [];
  const unexpected = [];
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(value => localStorage.setItem('access_token', value), token);
    // No request, including an accidental write, reaches the connected API.
    await context.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      let json;
      if (request.method() !== 'GET') {
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({ status: 405, json: { error: 'Read-only design test' } });
      }
      switch (url.pathname) {
        case '/api/me': json = { user: actor }; break;
        case '/api/sales-permissions': json = { canViewTeamSales: true }; break;
        case '/api/users': json = accounts; break;
        case '/api/users/pending': json = []; break;
        case '/api/users/sales-permissions': json = { ready: true, permissions: [] }; break;
        case '/api/staff-options': json = { staff: accounts }; break;
        case '/api/ads': json = { ads, total: 24, pageCount: 3 }; break;
        case '/api/ads/1': json = { ad }; break;
        case '/api/community/posts': json = { posts: [post, { ...post, id: 2, title: '광고 운영 및 정산 안내' }], pagination: { total: 2, totalPages: 1 }, permissions: { canWrite: true } }; break;
        case '/api/community/posts/1': json = { post }; break;
        case '/api/dashboard/my-monthly-sales': json = { totalSales: 12500000, count: 9 }; break;
        case '/api/dashboard/monthly-sales': json = { currentYear: 2026, years: [2024, 2025, 2026].map(year => ({ year, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: (i % 4 + 1) * 5000000, count: 12 })) })) }; break;
        case '/api/dashboard/top-sales': json = { today: accounts.slice(1).map((user, i) => ({ manager: user.name, total: (3 - i) * 1000000, count: 3 })), month: accounts.slice(1).map((user, i) => ({ manager: user.name, total: (3 - i) * 12000000, count: 12 })) }; break;
        case '/api/dashboard/sales': json = { rows: ads.slice(0, 5), total: 5, pageCount: 1, totalSales: 22000000, totalCancellations: 500000 }; break;
        case '/api/personal-sales': json = { month: url.searchParams.get('month'), scope: 'all', rows: accounts.slice(1).map(user => ({ ...user, approvedAmount: 12500000, netProfit: 5500000, count: 9 })) }; break;
        case '/api/team-sales': json = { month: url.searchParams.get('month'), scope: 'all', rows: accounts.slice(1).map(user => ({ id: user.team, department: user.department, team: user.team, approvedAmount: 12500000, netProfit: 5500000, count: 9 })) }; break;
        case '/api/memos': json = [{ id: 1, content: '광고 계약 정보 확인', createdAt: ad.createdAt, updatedAt: ad.createdAt }]; break;
        case '/api/events': json = [{ id: 1, title: '팀 회의', start: '2026-09-16T01:00:00Z', endTime: '2026-09-16T02:00:00Z' }]; break;
        default: unexpected.push(url.pathname); return route.fulfill({ status: 404, json: { error: 'Unexpected design test request' } });
      }
      return route.fulfill({ json });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const screens = [
      ['dashboard', '/', '.dash_sales_table'],
      ['ads', '/contracts/ad-management', '.ad_manage_table tbody tr'],
      ['register', '/contracts/ad-detail', '#ad_payment_form'],
      ['ad-detail', '/contracts/ad-management/1', '#ad_update_form'],
      ['users', '/users', '.userlist_table tbody tr'],
      ['accounts', '/users/account-settings', '.account_settings'],
      ['personal-sales', '/paystub', '.personal_sales_table tbody tr'],
      ['team-sales', '/team-sales', '.personal_sales_table tbody tr'],
      ['community', '/community?tab=notice', '.community_post_item'],
      ['community-detail', '/community/1?tab=notice', '.community_prose'],
      ['editor', '/community/write?tab=notice', '.tiptap'],
      ['mypage', '/mypage', '.mypage_panel'],
      ['contract', '/contracts/ad-management/1/agreement-preview/contract', '.agreement_contract_card'],
    ];
    async function capture(name, width) {
      await page.evaluate(async () => {
        await Promise.all([300, 400, 700, 800, 900].map(weight => document.fonts.load(`${weight} 14px "NanumSquareNeo"`, '광고관리')));
        await document.fonts.ready;
        scrollTo(0, 0);
      });
      const state = await page.evaluate(() => {
        const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
        const densityErrors = [];
        for (const [selector, size] of [
          ['.admin_nav_item, .ad_manage_table tbody td, .account_settings .form-label, .community_tabs button', 13],
          ['.admin_footer, .ad_manage_table thead th, .account_settings_accounts small, .personal_sales_scope, .dash_bar_scale', 12],
          ['.personal_sales_heading h1, .account_settings_heading h1, .community_header h1, .community_detail_header h1, .mypage_header h1', 18],
          ['.dash_section_title, .ad_section_title, .ad_view_section_title', 16],
        ]) {
          for (const element of document.querySelectorAll(selector)) {
            if (visible(element) && parseFloat(getComputedStyle(element).fontSize) !== size) densityErrors.push(`${element.className}: expected ${size}px`);
          }
        }
        if (innerWidth > 1024) {
          const header = document.querySelector('.ad_manage_table thead th');
          if (header && header.getBoundingClientRect().height > 42) densityErrors.push('Table header is not compact');
          const row = document.querySelector('.ad_manage_table tbody tr');
          if (row && row.cells.length > 1 && row.getBoundingClientRect().height > 46) densityErrors.push('Table row is not compact');
        }
        return {
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          densityErrors,
          fontFaces: [...document.fonts].filter(font => font.family.includes('NanumSquareNeo')).map(font => ({ weight: font.weight, status: font.status })),
          wrongFonts: [...document.querySelectorAll('button,input,select,textarea,h1,h2,th,td,p')].filter(visible).filter(element => !getComputedStyle(element).fontFamily.includes('NanumSquareNeo')).map(element => element.tagName + '.' + element.className),
          brokenImages: [...document.images].filter(visible).filter(img => !img.complete || !img.naturalWidth).map(img => img.getAttribute('src')),
        };
      });
      results.push({ name, ...state });
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true, animations: 'disabled' });
      console.log(`${name} ${width}px: ${state.scrollWidth}px document, ${state.wrongFonts.length} font errors, ${state.brokenImages.length} broken images`);
    }
    for (const [name, url, ready] of screens) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(origin + url);
      await expect(page.locator(ready).first()).toBeVisible();
      if (name === 'dashboard') {
        await expect(page.locator('.dash_sales_table thead th').nth(9)).toHaveText('부서+팀');
        await expect(page.locator('.dash_sales_table tbody tr').first().locator('td').nth(9)).toHaveText('1부서 / 1팀');
        await expect(page.getByPlaceholder('상품명, 담당자, 부서, 팀 검색')).toBeVisible();
      }
      await capture(name, 1440);
      if (name === 'ads') {
        const cdp = await context.newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.ad_manage_table tbody td' });
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        assert.ok(fonts.some(font => font.isCustomFont && /NanumSquare\s*Neo/i.test(font.familyName)), JSON.stringify(fonts));
        await cdp.detach();
        const toggle = page.locator('.admin_sidebar_toggle');
        async function checkTogglePlacement() {
          await expect(page.locator('.admin_sidebar')).toHaveCSS('max-width', '208px');
          const sidebar = await page.locator('.admin_sidebar').boundingBox();
          const control = await toggle.boundingBox();
          const logo = await page.locator('.admin_sidebar_logo').boundingBox();
          const nav = await page.locator('.admin_sidebar_nav').boundingBox();
          assert.ok(control.x >= sidebar.x && control.x + control.width <= sidebar.x + sidebar.width);
          assert.ok(control.y >= logo.y + logo.height && nav.y + nav.height <= control.y);
          assert.ok(control.y + control.height <= page.viewportSize().height);
        }
        await checkTogglePlacement();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.hover();
        await expect(page.locator('.admin_sidebar_toggle_hint')).toBeVisible();
        await page.screenshot({ path: path.join(output, 'sidebar-expanded.png') });
        await toggle.click();
        await expect(page.locator('.admin_shell')).toHaveClass(/sidebar_collapsed/);
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await page.reload();
        await expect(page.locator('.admin_shell')).toHaveClass(/sidebar_collapsed/);
        await toggle.focus();
        await expect(page.locator('.admin_sidebar_toggle_hint')).toBeVisible();
        await page.screenshot({ path: path.join(output, 'sidebar-collapsed.png') });
        await toggle.press('Enter');
        await expect(page.locator('.admin_shell')).not.toHaveClass(/sidebar_collapsed/);
        await toggle.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.setViewportSize({ width: 1440, height: 480 });
        await checkTogglePlacement();
        await page.screenshot({ path: path.join(output, 'sidebar-short-viewport.png') });
      }
      if (name === 'register' || name === 'ad-detail') {
        await page.getByPlaceholder('시작일', { exact: true }).click();
        await expect(page.locator('.react-datepicker-popper')).toHaveCount(1);
        await page.locator('.react-datepicker__day--010:not(.react-datepicker__day--outside-month)').click();
        await expect(page.locator('.react-datepicker-popper')).toHaveCount(1);
        await expect(page.getByPlaceholder('시작일', { exact: true })).toHaveValue(/-10$/);
        await page.locator('.react-datepicker__day--020:not(.react-datepicker__day--outside-month)').click();
        await expect(page.locator('.react-datepicker-popper')).toHaveCount(0);
        await expect(page.getByPlaceholder('종료일', { exact: true })).toHaveValue(/-20$/);
      }
      if (name === 'register') {
        await page.getByPlaceholder('주소', { exact: true }).fill('서울특별시 테스트로');
        await page.getByPlaceholder('상세주소', { exact: true }).fill('2층');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.locator('.ad_field').filter({ has: page.locator('.ad_field_label', { hasText: /^결제구분$/ }) }).locator('select').selectOption('카드');
        await page.getByPlaceholder('월', { exact: true }).fill('12');
        await expect(page.getByPlaceholder('년', { exact: true })).toBeFocused();
      }
      for (const width of [1920, 1024, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        if (name !== 'contract' && width <= 1024) await expect(page.locator('.admin_sidebar_nav')).toBeHidden();
        await capture(name, width);
      }
      if (name === 'ads') {
        await page.locator('.admin_sidebar_toggle').click();
        await expect(page.locator('.admin_sidebar_nav')).toBeVisible();
        await page.screenshot({ path: path.join(output, 'mobile-navigation.png'), fullPage: true });
        await page.locator('.admin_nav_item', { hasText: '광고 등록' }).click();
        await expect(page).toHaveURL(/ad-detail$/);
        await expect(page.locator('.admin_sidebar_nav')).toBeHidden();
      }
    }
    const authContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const authPage = await authContext.newPage();
    await authContext.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
    authPage.on('pageerror', error => errors.push(error.message));
    await authPage.goto(origin);
    await authPage.getByLabel('비밀번호', { exact: true }).fill('design-test-only');
    await authPage.getByRole('button', { name: '비밀번호 보기' }).click();
    await expect(authPage.getByLabel('비밀번호', { exact: true })).toHaveAttribute('type', 'text');
    await authPage.getByRole('button', { name: '비밀번호 숨기기' }).click();
    for (const width of [1440, 390, 320]) {
      await authPage.setViewportSize({ width, height: 1000 });
      await authPage.evaluate(() => document.fonts.ready);
      await authPage.screenshot({ path: path.join(output, `login-${width}.png`), fullPage: true });
      assert.ok(await authPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `login-${width}`);
    }
    await authPage.getByRole('button', { name: '회원가입', exact: true }).first().click();
    await authPage.screenshot({ path: path.join(output, 'signup-mobile.png'), fullPage: true });
    for (const view of [{ width: 1440, height: 900 }, { width: 1366, height: 600 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
      await authPage.setViewportSize(view);
      await authPage.screenshot({ path: path.join(output, `signup-${view.width}.png`), fullPage: true });
      const layout = await authPage.evaluate(() => {
        const form = document.querySelector('.sign_in_wrap').getBoundingClientRect();
        const footer = document.querySelector('.auth_copyright').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, overlap: footer.top < form.bottom, clipped: [...document.querySelectorAll('.signup_auth_field')].some(field => field.scrollWidth > field.clientWidth + 1) };
      });
      assert.deepEqual(layout, { overflow: false, overlap: false, clipped: false }, `signup layout ${view.width}`);
    }
    const failures = results.filter(state => state.scrollWidth > state.width + 1 || state.densityErrors.length || state.wrongFonts.length || state.brokenImages.length || state.fontFaces.length !== 5 || state.fontFaces.some(font => font.status !== 'loaded'));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors, unexpected, failures }, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(failures, []);
    console.log(JSON.stringify({ passed: true, screens: screens.length, screenshots: output, checks: ['self-hosted-fonts', 'actual-nanum-glyphs', 'all-controls-font', 'desktop-mobile-overflow', 'loaded-images', 'sidebar-toggle', 'mobile-navigation', 'both-contract-date-pickers', 'manual-address', 'card-expiry-focus', 'password-visibility', 'no-api-writes', 'no-page-errors'] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
