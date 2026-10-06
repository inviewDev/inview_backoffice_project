const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildStatusGroups,
  findPaymentsByStatusOrder,
} = require('../api/paymentStatusSort');

const groupedStatuses = [
  { paymentStatus: '결제승인', _count: { _all: 2 } },
  { paymentStatus: '위약금', _count: { _all: 1 } },
  { paymentStatus: '결제대기', _count: { _all: 3 } },
  { paymentStatus: '매출취소', _count: { _all: 1 } },
];

test('상태 그룹을 화면 옵션 순서와 역순으로 정렬한다', () => {
  assert.deepEqual(
    buildStatusGroups(groupedStatuses, 'asc').map(group => group.statuses),
    [['결제대기'], ['결제승인'], ['매출취소'], ['위약금', '부분취소']],
  );
  assert.deepEqual(
    buildStatusGroups(groupedStatuses, 'desc').map(group => group.statuses),
    [['위약금', '부분취소'], ['매출취소'], ['결제승인'], ['결제대기']],
  );
});

test('선택한 상태 그룹을 나머지 데이터보다 먼저 정렬한다', () => {
  const expectedFirstStatuses = ['결제대기', '결제승인', '매출취소', '위약금'];

  expectedFirstStatuses.forEach(status => {
    assert.ok(buildStatusGroups(groupedStatuses, 'asc', status)[0].statuses.includes(status));
  });
});

test('페이지 경계에서도 모든 상태 그룹을 순서대로 조회한다', async () => {
  const calls = [];
  const rowsByStatus = {
    결제승인: [{ id: 4, paymentStatus: '결제승인' }],
    매출취소: [{ id: 5, paymentStatus: '매출취소' }],
  };
  const paymentModel = {
    groupBy: async () => groupedStatuses,
    findMany: async query => {
      calls.push(query);
      const statusFilter = query.where.AND.at(-1).paymentStatus;
      const status = typeof statusFilter === 'string' ? statusFilter : statusFilter.in[0];
      return rowsByStatus[status] || [];
    },
  };

  const result = await findPaymentsByStatusOrder({
    paymentModel,
    where: { AND: [{ managerTeam: '개발관리부' }] },
    select: { id: true, paymentStatus: true },
    direction: 'asc',
    skip: 4,
    take: 2,
  });

  assert.equal(result.total, 7);
  assert.deepEqual(result.payments.map(payment => payment.paymentStatus), ['결제승인', '매출취소']);
  assert.deepEqual(calls.map(call => call.take), [1, 1]);
  assert.deepEqual(calls.map(call => call.skip), [1, 0]);
});
