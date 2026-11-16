const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');

// Load the real API with an in-memory Prisma substitute. Never connect to the DB.
const apiPath = path.resolve(__dirname, '../api/index.js');
const secret = 'ad-visibility-regression-test-only';
const staff = {
  id: 277, email: 'staff', name: 'Owner', status: '재직', role: '사용자',
  level: '사원', team: '1팀', department: '1부서', adVisibilityScope: 'own',
  canEditAds: true,
};
const users = new Map([
  [staff.id, staff],
  [2, { ...staff, id: 2, email: 'other', name: 'Other', team: '2팀', department: '2부서' }],
  [1, { ...staff, id: 1, email: 'cchee' }],
]);
const payments = [
  { id: 10, userId: staff.id, managerTeam: '1팀', user: staff },
  { id: 11, userId: staff.id, managerTeam: '1팀', user: staff },
  { id: 20, userId: 2, managerTeam: '2팀', user: users.get(2) },
].map(payment => ({
  ...payment, manager: payment.user.name, company: { companyName: 'Company' },
  createdAt: new Date('2026-11-16T00:00:00Z'), paymentStatus: '결제대기',
}));
let writes = 0;

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(filter => matches(row, filter));
    if (key === 'OR') return value.some(filter => matches(row, filter));
    if (value && typeof value === 'object') {
      if ('is' in value) return Boolean(row[key]) && matches(row[key], value.is);
      if ('in' in value) return value.in.includes(row[key]);
      if ('contains' in value) return String(row[key] || '').toLowerCase().includes(value.contains.toLowerCase());
    }
    return row[key] === value;
  });
}

const prisma = {
  user: { findUnique: async ({ where }) => users.get(where.id) || null },
  payment: {
    findUnique: async ({ where }) => payments.find(payment => payment.id === where.id) || null,
    count: async ({ where }) => payments.filter(row => matches(row, where)).length,
    findMany: async ({ where, skip = 0, take }) => {
      const rows = payments.filter(row => matches(row, where));
      return rows.slice(skip, take === undefined ? undefined : skip + take);
    },
    groupBy: async ({ where }) => [{
      paymentStatus: '결제대기',
      _count: { _all: payments.filter(row => matches(row, where)).length },
    }],
  },
  adComment: {
    count: async () => 0,
    findMany: async () => [],
    create: async () => { writes += 1; throw new Error('Unexpected write'); },
  },
  $transaction: async operations => {
    if (Array.isArray(operations)) return Promise.all(operations);
    writes += 1;
    throw new Error('Unexpected write transaction');
  },
};

const apiModule = new Module(apiPath, module);
apiModule.filename = apiPath;
apiModule.paths = Module._nodeModulePaths(path.dirname(apiPath));
const localRequire = Module.createRequire(apiPath);
apiModule.require = name => {
  if (name === '@prisma/client') return { PrismaClient: function () { return prisma; } };
  if (name === 'dotenv') return { config() {} };
  return localRequire(name);
};
const previousSecret = process.env.JWT_SECRET;
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.JWT_SECRET = secret;
process.env.DATABASE_URL = 'test-only-no-database-connection';
apiModule._compile(`${fs.readFileSync(apiPath, 'utf8')}
module.exports.visibility = { getEffectiveAdVisibilityScope, buildAdAccessFilter, canViewAd };`, apiPath);
const app = apiModule.exports;
const { getEffectiveAdVisibilityScope, buildAdAccessFilter, canViewAd } = app.visibility;

test('saved scope overrides job titles, missing scope fails closed, master retains access', () => {
  for (const level of ['사원', '팀장', '파트장', '대표']) {
    assert.equal(getEffectiveAdVisibilityScope({ ...staff, level }), 'own');
    assert.equal(canViewAd({ ...staff, level }, payments[2]), false);
  }
  assert.equal(getEffectiveAdVisibilityScope({ ...staff, adVisibilityScope: undefined }), 'own');
  assert.equal(getEffectiveAdVisibilityScope({ ...staff, adVisibilityScope: 'invalid' }), 'own');
  assert.equal(getEffectiveAdVisibilityScope(users.get(1)), 'all');
  assert.equal(canViewAd(null, payments[0]), false);
  assert.equal(canViewAd(staff, null), false);
});

test('list filters and detail checks agree across scope, team and department combinations', () => {
  const samples = [
    ...payments,
    { id: 30, userId: 3, managerTeam: '1팀', user: { team: '6팀', department: '2부서' } },
    { id: 31, userId: 3, managerTeam: '6팀', user: { team: '1팀', department: '1부서' } },
    { id: 32, userId: 3, managerTeam: '3팀', user: null },
    { id: 33, userId: 3, managerTeam: null, user: null },
  ];
  for (const scope of ['own', 'team', 'department', 'all', 'invalid']) {
    for (const team of ['1팀', '', '미지정']) {
      for (const department of ['1부서', '', '미지정']) {
        const user = { ...staff, adVisibilityScope: scope, team, department };
        for (const payment of samples) {
          assert.equal(canViewAd(user, payment), matches(payment, buildAdAccessFilter(user)),
            JSON.stringify({ scope, team, department, paymentId: payment.id }));
          assert.equal(matches(payment, buildAdAccessFilter(user, 2)),
            canViewAd(user, payment) && payment.userId === 2);
        }
      }
    }
  }
});

test('real API routes enforce own scope without writes', async t => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  t.after(() => {
    for (const [key, value] of [['JWT_SECRET', previousSecret], ['DATABASE_URL', previousDatabaseUrl]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const token = jwt.sign({ id: staff.id, role: '전체관리자', adVisibilityScope: 'all' }, secret);
  async function request(url, options = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    });
    return { status: response.status, body: await response.json() };
  }
  for (const query of ['', '?page=1&pageSize=1', '?search=Company', '?sortBy=paymentStatus', '?sortBy=manager']) {
    const { status, body } = await request(`/ads${query}`);
    assert.equal(status, 200);
    assert.equal(body.total, 2);
    assert.ok(body.ads.every(ad => ad.id === 10 || ad.id === 11));
  }
  assert.equal((await request('/ads?page=2&pageSize=1')).body.ads[0].id, 11);
  assert.equal((await request('/ads?userId=2')).body.total, 0);
  for (const id of ['invalid', '', '-1', '1.5', '2abc']) {
    assert.equal((await request(`/ads?userId=${id}`)).status, 400);
  }
  assert.equal((await request('/ads/20')).status, 403);
  assert.equal((await request('/ads/20/comments')).status, 403);
  assert.equal((await request('/ads/10/comments')).status, 200);
  assert.equal((await request('/ads/20/comments', {
    method: 'POST', body: JSON.stringify({ content: 'Not allowed' }),
  })).status, 403);
  assert.equal((await request('/ads/20/sms-consent/send', {
    method: 'POST', body: JSON.stringify({ phoneNumber: '01012345678' }),
  })).status, 403);
  assert.equal((await request('/ads/20/payment-info', {
    method: 'PATCH', body: JSON.stringify({
      productName: 'Product', approvedAmount: 100, spendingCost: 0,
      contractStartDate: '2026-11-16', contractEndDate: '2026-11-17',
      paymentMethod: '현금', paymentStatus: '결제대기',
    }),
  })).status, 403);

  staff.adVisibilityScope = 'all';
  assert.equal((await request('/ads')).body.total, 3);
  staff.adVisibilityScope = 'own';
  assert.equal((await request('/ads')).body.total, 2);
  staff.adVisibilityScope = 'team';
  assert.equal((await request('/ads')).body.total, 2);
  assert.equal((await request('/ads/20/comments')).status, 403);
  staff.adVisibilityScope = 'department';
  assert.equal((await request('/ads')).body.total, 2);
  staff.adVisibilityScope = 'own';
  const masterToken = jwt.sign({ id: 1 }, secret);
  assert.equal((await request('/ads', { headers: { Authorization: `Bearer ${masterToken}` } })).body.total, 3);
  assert.equal(writes, 0);
});
