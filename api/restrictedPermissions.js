const EXCLUSIVE_AD_MANAGER_LOGIN_ID = 'cchee';
const MASTER_LOGIN_IDS = new Set(['cchee', 'cchee@gmail.com']);

function isMasterAccount(user) {
  return MASTER_LOGIN_IDS.has(user?.email);
}

function isReservedMasterLoginId(loginId) {
  return MASTER_LOGIN_IDS.has(String(loginId || '').trim().toLowerCase());
}

function isExclusiveAdManager(user) {
  return user?.email === EXCLUSIVE_AD_MANAGER_LOGIN_ID;
}

function canDeleteAdPayment(user) {
  return isExclusiveAdManager(user);
}

function canManageAdComment(user) {
  return isExclusiveAdManager(user);
}

module.exports = {
  EXCLUSIVE_AD_MANAGER_LOGIN_ID,
  isMasterAccount,
  isReservedMasterLoginId,
  isExclusiveAdManager,
  canDeleteAdPayment,
  canManageAdComment,
};
