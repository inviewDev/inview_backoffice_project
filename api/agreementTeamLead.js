const TEAM_DEPARTMENT_MAPPING = {
  '1팀': '1부서',
  '3팀': '1부서',
  '4팀': '1부서',
  '2팀': '2부서',
  '5팀': '2부서',
  '6팀': '2부서',
  개발관리부: '운영부서',
};
const PART_LEAD_TEAMS = new Set(['1팀', '2팀']);

function resolveManagerDepartment(payment) {
  const managerTeam = payment?.managerTeam || payment?.user?.team || '';
  return TEAM_DEPARTMENT_MAPPING[managerTeam] || payment?.user?.department || '';
}

async function findAgreementTeamLead(payment, userModel) {
  const managerTeam = payment?.managerTeam || payment?.user?.team || '';
  const department = resolveManagerDepartment(payment);
  if (!managerTeam) return { teamLeadName: '', teamLeadPhone: '' };

  const where = PART_LEAD_TEAMS.has(managerTeam)
    ? {
        department,
        level: '파트장',
        status: '재직',
      }
    : {
        team: managerTeam,
        status: '재직',
        OR: [
          { level: '팀장' },
          { role: '팀장' },
        ],
      };

  const teamLead = await userModel.findFirst({
    where,
    orderBy: { id: 'asc' },
    select: {
      name: true,
      phoneNumber: true,
    },
  });

  return {
    teamLeadName: teamLead?.name || '',
    teamLeadPhone: teamLead?.phoneNumber || '',
  };
}

module.exports = {
  TEAM_DEPARTMENT_MAPPING,
  PART_LEAD_TEAMS,
  resolveManagerDepartment,
  findAgreementTeamLead,
};
