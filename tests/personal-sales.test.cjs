const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { once } = require('node:events');

const apiPath = path.resolve(__dirname, '../api/index.js');
const apiSource = fs.readFileSync(apiPath, 'utf8');
const apiRequire = createRequire(apiPath);
const jwt = apiRequire('jsonwebtoken');
const secret = 'personal-sales-test-only';
const utils = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.resolve(__dirname, '../src/utils/personalSales.js'), 'utf8')).toString('base64'));
const user = { id: 1, email: 'staff@example.test', name: 'Staff', role: '사용자', level: '사원', team: '1팀', department: '1부서', adVisibilityScope: 'own' };
const plain = value => JSON.parse(JSON.stringify(value));

// Run the real Express app with an isolated environment and an in-memory Prisma double.
async function request(t, { account = user, month = '2026-09', groups = [], employees = [], authenticated = true, dbError = false,
  endpoint = '/personal-sales', method = 'GET', payload, granted = false, storageMissing = false, failUpdate = false,
  target = { ...user, id: 2, email: 'target' },
} = {}) {
  const calls = {};
  const state = { permission: granted, accountSaved: false };
  const checkStorage = () => { if (storageMissing) throw Object.assign(new Error('Missing table'), { code: 'P2021' }); };
  const prisma = {
    user: {
      findUnique: async args => args.where.id === 1 ? account : args.where.id === target?.id ? target : null,
      findMany: async args => { calls.users = plain(args); return employees; },
      update: async args => {
        calls.update = plain(args);
        if (failUpdate) throw new Error('Update failed');
        state.accountSaved = true;
        return { ...target, ...args.data };
      },
    },
    payment: { groupBy: async args => {
      calls.payments = plain(args);
      if (dbError) throw new Error('private database details');
      return groups;
    } },
    userSalesPermission: {
      findUnique: async () => { checkStorage(); return { canViewTeamSales: state.permission }; },
      findMany: async () => { checkStorage(); return [{ userId: target.id, canViewTeamSales: state.permission }]; },
      upsert: async args => { checkStorage(); calls.permission = plain(args); state.permission = args.update.canViewTeamSales; },
    },
    $transaction: async callback => {
      const snapshot = { ...state };
      try { return await callback(prisma); } catch (error) { Object.assign(state, snapshot); throw error; }
    },
  };
  const isolatedRequire = name => {
    if (name === 'dotenv') return { config() {} };
    if (name === '@prisma/client') return { PrismaClient: class { constructor() { return prisma; } } };
    return apiRequire(name);
  };
  const context = vm.createContext({
    require: isolatedRequire, module: { exports: {} },
    process: { env: { JWT_SECRET: secret, DATABASE_URL: 'postgresql://test.invalid/test', NODE_ENV: 'test' } },
    console: { log() {}, error() {} }, Buffer, URL, URLSearchParams, setTimeout, clearTimeout,
  });
  vm.runInContext(apiSource, context, { filename: apiPath });
  const server = context.module.exports.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await once(server, 'listening');
  const headers = authenticated ? { Authorization: `Bearer ${jwt.sign({ id: 1 }, secret)}` } : {};
  if (payload) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${endpoint}?month=${encodeURIComponent(month)}`, { headers, method, body: payload ? JSON.stringify(payload) : undefined });
  return { status: response.status, body: await response.json(), calls, state };
}

const group = (userId, paymentStatus, approvedAmount, netProfit, count = 1) => ({ userId, paymentStatus, _sum: { approvedAmount, netProfit }, _count: { _all: count } });

test('API requires authentication and validates month before querying', async t => {
  const unauthenticated = await request(t, { authenticated: false });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(unauthenticated.calls, {});
  for (const month of ['2026-13', '2026-1', '2026-09-01', '2200-01', '']) {
    const result = await request(t, { month });
    assert.equal(result.status, 400);
    assert.deepEqual(result.calls, {});
  }
});

test('API aggregates by owner ID and excludes waiting/cancelled and zero-count employees', async t => {
  const result = await request(t, {
    account: { ...user, adVisibilityScope: 'all' },
    employees: [{ id: 1, name: 'Same' }, { id: 2, name: 'Same' }, { id: 3, name: 'Zero' }],
    groups: [group(1, '결제완료', 1100, 700, 2), group(1, '입금완료', 2200, 1500), group(2, '결제완료', 500, 200), group(1, '결제대기', 9999, 9999), group(1, '결제취소', 9999, 9999), group(1, '', 9999, 9999)],
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.scope, 'all');
  assert.deepEqual(result.body.rows.map(row => [row.id, row.approvedAmount, row.netProfit, row.count]), [[1, 3300, 2200, 3], [2, 500, 200, 1]]);
  assert.deepEqual(result.calls.users.where, { id: { in: [1, 2] } });
  assert.deepEqual(result.calls.payments.by, ['userId', 'paymentStatus']);
  assert.deepEqual(result.calls.payments.where.AND[1], { createdAt: { gte: '2026-08-31T15:00:00.000Z', lt: '2026-09-30T15:00:00.000Z' } });
});

test('API uses exclusive KST month bounds over leap years and year rollover', async t => {
  for (const [month, start, end] of [['2024-02', '2024-01-31T15:00:00.000Z', '2024-02-29T15:00:00.000Z'], ['2026-12', '2026-11-30T15:00:00.000Z', '2026-12-31T15:00:00.000Z']]) {
    const result = await request(t, { month });
    assert.deepEqual(result.calls.payments.where.AND[1].createdAt, { gte: start, lt: end });
  }
});

test('API restricts own, team, department and master views using existing access rules', async t => {
  const own = await request(t);
  assert.deepEqual(own.calls.payments.where.AND[0], { AND: [{ userId: 1 }] });
  assert.deepEqual(own.calls.users.where, { id: { in: [] } });
  const team = await request(t, { account: { ...user, level: '팀장' } });
  assert.equal(team.body.scope, 'team');
  assert.deepEqual(team.calls.payments.where.AND[0].AND[0].OR, [{ userId: 1 }, { managerTeam: '1팀' }, { user: { is: { team: '1팀' } } }]);
  assert.deepEqual(team.calls.users.where, { id: { in: [] } });
  const department = await request(t, { account: { ...user, level: '파트장' } });
  assert.equal(department.body.scope, 'department');
  assert.deepEqual(department.calls.payments.where.AND[0].AND[0].OR[1], { user: { is: { department: '1부서' } } });
  assert.deepEqual(department.calls.users.where, { id: { in: [] } });
  const unassigned = await request(t, { account: { ...user, level: '팀장', team: '미지정' } });
  assert.deepEqual(unassigned.calls.payments.where.AND[0], { AND: [{ userId: 1 }] });
  const master = await request(t, { account: { ...user, email: 'cchee' } });
  assert.equal(master.body.scope, 'all');
  assert.deepEqual(master.calls.payments.where.AND[0], {});
});

test('API returns missing-user and sanitized database errors', async t => {
  const missing = await request(t, { account: null });
  assert.equal(missing.status, 401);
  assert.deepEqual(missing.calls, {});
  const failed = await request(t, { dbError: true });
  assert.equal(failed.status, 500);
  assert.ok(!JSON.stringify(failed.body).includes('private database details'));
});

test('all positive-count employees are included without rank or top-ten limit', async t => {
  const employees = Array.from({ length: 15 }, (_, index) => ({ id: index + 1, name: `Staff ${index}` }));
  const result = await request(t, {
    account: { ...user, adVisibilityScope: 'all' }, employees,
    groups: employees.map(employee => group(employee.id, '결제완료', 0, 0)),
  });
  assert.equal(result.body.rows.length, 15);
  assert.ok(result.body.rows.every(row => row.count === 1 && !('rank' in row)));
});

test('filters and sorting retain all positive-count employees and input stays immutable', async () => {
  const { selectPersonalSales } = await utils;
  const rows = Array.from({ length: 15 }, (_, index) => ({ id: index + 1, name: `Staff ${index}`, department: index < 5 ? 'First' : 'Second', team: 'Team', approvedAmount: 1500 - index * 100, netProfit: index * 10, count: index }));
  const snapshot = JSON.stringify(rows);
  assert.equal(selectPersonalSales(rows, {})[0].id, 2);
  assert.equal(selectPersonalSales(rows, {}).length, 14);
  assert.equal(selectPersonalSales(rows, { department: 'Second' }).length, 10);
  assert.equal(selectPersonalSales(rows, { search: 'STAFF Second' }).length, 10);
  assert.equal(selectPersonalSales(rows, { sort: 'netProfit' })[0].id, 15);
  assert.equal(selectPersonalSales(rows, { sort: 'count' })[0].id, 15);
  assert.equal(selectPersonalSales(rows, { sort: 'approvedAmount', direction: 'asc' })[0].id, 15);
  assert.ok(selectPersonalSales(rows).every(row => !('rank' in row)));
  assert.deepEqual(selectPersonalSales(rows, { search: 'not found' }), []);
  assert.equal(JSON.stringify(rows), snapshot);
});

test('CSV includes BOM, quotes multiline values and neutralizes spreadsheet formulas', async () => {
  const { personalSalesCsv } = await utils;
  const csv = personalSalesCsv([{ name: '=SUM(1,2)', department: 'A,"B"\nC', team: null, approvedAmount: 100, netProfit: -20, count: 1 }]);
  assert.equal(csv.split('\r\n')[0], '\uFEFF"이름","부서","팀","승인금액","순이익","건수"');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"A,""B""\nC"'));
  assert.ok(csv.includes('"","100","-20","1"'));
  assert.ok(!csv.includes('null'));
});

test('team sales rejects ungranted viewers, including ungranted full administrators', async t => {
  for (const account of [user, { ...user, role: '전체관리자', level: '대표', adVisibilityScope: 'all' }]) {
    const result = await request(t, { account, endpoint: '/team-sales' });
    assert.equal(result.status, 403);
    assert.equal(result.calls.payments, undefined);
  }
  assert.equal((await request(t, { endpoint: '/team-sales', authenticated: false })).status, 401);
  assert.equal((await request(t, { endpoint: '/team-sales', month: '2026-13', granted: true })).status, 400);
});

test('granted team sales aggregates current owner teams without exposing individuals', async t => {
  const result = await request(t, {
    endpoint: '/team-sales', granted: true,
    employees: [{ id: 1, team: '1팀', department: '1부서' }, { id: 2, team: '1팀', department: '1부서' }, { id: 3, team: '2팀', department: '2부서' }],
    groups: [group(1, '결제완료', 100, 30), group(2, '입금완료', 200, 50, 2), group(3, '결제완료', 0, 0), group(1, '결제취소', 999, 999), group(2, '결제대기', 999, 999)],
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.rows.map(row => [row.team, row.approvedAmount, row.netProfit, row.count]), [['1팀', 300, 80, 3], ['2팀', 0, 0, 1]]);
  assert.ok(result.body.rows.every(row => !('name' in row) && !('userId' in row)));
  assert.deepEqual(result.calls.payments.where, { createdAt: { gte: '2026-08-31T15:00:00.000Z', lt: '2026-09-30T15:00:00.000Z' } });
});

test('missing permission storage fails closed without breaking existing me or personal sales routes', async t => {
  assert.equal((await request(t, { endpoint: '/team-sales', storageMissing: true })).status, 403);
  const access = await request(t, { endpoint: '/sales-permissions', storageMissing: true });
  assert.equal(access.status, 200);
  assert.equal(access.body.canViewTeamSales, false);
  assert.equal((await request(t, { endpoint: '/me', storageMissing: true })).status, 200);
  assert.equal((await request(t, { storageMissing: true })).status, 200);
  const master = { ...user, email: 'cchee', role: '전체관리자' };
  assert.equal((await request(t, { endpoint: '/team-sales', account: master, storageMissing: true })).status, 200);
  const setup = await request(t, { endpoint: '/users/sales-permissions', account: master, storageMissing: true });
  assert.equal(setup.body.ready, false);
});

test('account settings grants and revokes team permission atomically for root only', async t => {
  const payload = { loginId: 'target', team: '1팀', role: '사용자', canViewTeamSales: true };
  const options = { endpoint: '/users/2/account-settings', method: 'PATCH', payload };
  assert.equal((await request(t, options)).status, 403);
  const administrator = await request(t, { ...options, account: { ...user, role: '전체관리자' } });
  assert.equal(administrator.status, 403);
  assert.equal(administrator.calls.update, undefined);
  const account = { ...user, role: '전체관리자', email: 'cchee' };
  const granted = await request(t, { ...options, account });
  assert.equal(granted.status, 200);
  assert.deepEqual(granted.state, { permission: true, accountSaved: true });
  const revoked = await request(t, { ...options, account, granted: true, payload: { ...payload, canViewTeamSales: false } });
  assert.equal(revoked.status, 200);
  assert.deepEqual(revoked.state, { permission: false, accountSaved: true });
  const invalid = await request(t, { ...options, account, payload: { ...payload, canViewTeamSales: 'false' } });
  assert.equal(invalid.status, 400);
  const missing = await request(t, { ...options, account, storageMissing: true });
  assert.equal(missing.status, 503);
  assert.deepEqual(missing.state, { permission: false, accountSaved: false });
  const failed = await request(t, { ...options, account, failUpdate: true });
  assert.equal(failed.status, 500);
  assert.deepEqual(failed.state, { permission: false, accountSaved: false });
});

test('basic account changes do not require new storage; reserved root identity cannot be assigned', async t => {
  const payload = { loginId: 'target', team: '1팀', role: '사용자' };
  const options = { endpoint: '/users/2/account-settings', method: 'PATCH', payload, account: { ...user, role: '전체관리자' }, storageMissing: true };
  assert.equal((await request(t, options)).status, 200);
  const escalation = await request(t, { ...options, payload: { ...payload, loginId: 'CcHeE' } });
  assert.equal(escalation.status, 400);
  assert.equal(escalation.calls.update, undefined);
  const rootEdit = await request(t, { ...options, target: { ...user, id: 2, email: 'cchee' }, payload: { ...payload, loginId: 'cchee' } });
  assert.equal(rootEdit.status, 403);
});
