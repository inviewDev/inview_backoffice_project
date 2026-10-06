const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveManagerDepartment,
  findAgreementTeamLead,
} = require('../api/agreementTeamLead');

test('담당자 팀을 기준으로 해당 부서의 재직 파트장을 조회한다', async () => {
  const calls = [];
  const userModel = {
    findFirst: async query => {
      calls.push(query);
      return { name: '함민혁', phoneNumber: '010-2582-1410' };
    },
  };

  const result = await findAgreementTeamLead({
    managerTeam: '2팀',
    user: { team: '1팀', department: '1부서' },
  }, userModel);

  assert.equal(resolveManagerDepartment({ managerTeam: '2팀' }), '2부서');
  assert.deepEqual(calls[0].where, { department: '2부서', level: '파트장', status: '재직' });
  assert.deepEqual(result, { teamLeadName: '함민혁', teamLeadPhone: '010-2582-1410' });
});

test('5팀과 6팀은 동일 팀의 재직 팀장을 조회한다', async () => {
  const calls = [];
  const userModel = {
    findFirst: async query => {
      calls.push(query);
      return { name: '김민규', phoneNumber: '010-2486-5206' };
    },
  };

  const result = await findAgreementTeamLead({ managerTeam: '5팀' }, userModel);

  assert.deepEqual(calls[0].where, {
    team: '5팀',
    status: '재직',
    OR: [{ level: '팀장' }, { role: '팀장' }],
  });
  assert.deepEqual(result, { teamLeadName: '김민규', teamLeadPhone: '010-2486-5206' });
});

test('해당 팀의 책임자가 없으면 빈 값을 반환한다', async () => {
  const userModel = { findFirst: async () => null };
  const payment = { managerTeam: '기타팀', user: { department: '기타부서' } };

  assert.equal(resolveManagerDepartment(payment), '기타부서');
  assert.deepEqual(
    await findAgreementTeamLead(payment, userModel),
    { teamLeadName: '', teamLeadPhone: '' },
  );
});
