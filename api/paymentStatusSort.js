const PAYMENT_STATUS_GROUPS = [
  ['결제대기'],
  ['결제승인'],
  ['매출취소'],
  ['위약금', '부분취소'],
];

function getGroupCount(statusCounts, statuses) {
  return statuses.reduce((total, status) => total + (statusCounts.get(status) || 0), 0);
}

function buildStatusGroups(groupRows, direction, priorityStatus = '') {
  const statusCounts = new Map(
    groupRows.map(row => [row.paymentStatus, Number(row._count?._all || 0)]),
  );
  const knownStatuses = new Set(PAYMENT_STATUS_GROUPS.flat());
  let orderedGroups = direction === 'desc'
    ? [...PAYMENT_STATUS_GROUPS].reverse()
    : [...PAYMENT_STATUS_GROUPS];
  const priorityIndex = orderedGroups.findIndex(statuses => statuses.includes(priorityStatus));
  if (priorityIndex > 0) {
    const [priorityGroup] = orderedGroups.splice(priorityIndex, 1);
    orderedGroups.unshift(priorityGroup);
  }
  const knownGroups = orderedGroups
    .map(statuses => ({ statuses, count: getGroupCount(statusCounts, statuses) }))
    .filter(group => group.count > 0);
  const unknownGroups = [...statusCounts.entries()]
    .filter(([status, count]) => !knownStatuses.has(status) && count > 0)
    .sort(([statusA], [statusB]) => {
      const comparison = String(statusA || '').localeCompare(String(statusB || ''), 'ko-KR');
      return direction === 'desc' ? -comparison : comparison;
    })
    .map(([status, count]) => ({ statuses: [status], count }));

  return [...knownGroups, ...unknownGroups];
}

function addStatusFilter(where, statuses) {
  const statusFilter = statuses.length === 1
    ? { paymentStatus: statuses[0] }
    : { paymentStatus: { in: statuses } };

  return Object.keys(where).length > 0
    ? { AND: [where, statusFilter] }
    : statusFilter;
}

async function findPaymentsByStatusOrder({
  paymentModel,
  where = {},
  select,
  direction = 'asc',
  priorityStatus = '',
  skip = 0,
  take,
}) {
  const groupRows = await paymentModel.groupBy({
    by: ['paymentStatus'],
    where,
    _count: { _all: true },
  });
  const statusGroups = buildStatusGroups(groupRows, direction, priorityStatus);
  const total = statusGroups.reduce((sum, group) => sum + group.count, 0);
  const payments = [];
  let remainingSkip = Math.max(skip, 0);
  let remainingTake = Number.isInteger(take) ? Math.max(take, 0) : Infinity;

  for (const group of statusGroups) {
    if (remainingTake === 0) break;
    if (remainingSkip >= group.count) {
      remainingSkip -= group.count;
      continue;
    }

    const query = {
      where: addStatusFilter(where, group.statuses),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: remainingSkip,
      select,
    };
    if (Number.isFinite(remainingTake)) {
      query.take = Math.min(remainingTake, group.count - remainingSkip);
    }

    const rows = await paymentModel.findMany(query);
    payments.push(...rows);
    remainingSkip = 0;
    if (Number.isFinite(remainingTake)) {
      remainingTake -= rows.length;
    }
  }

  return { total, payments };
}

module.exports = {
  PAYMENT_STATUS_GROUPS,
  buildStatusGroups,
  findPaymentsByStatusOrder,
};
