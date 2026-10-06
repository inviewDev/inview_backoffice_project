const EXCLUSIVE_AD_MANAGER_LOGIN_ID = 'cchee';

function isExclusiveAdManager(user) {
  return String(user?.email || '').trim().toLowerCase() === EXCLUSIVE_AD_MANAGER_LOGIN_ID;
}

function canDeleteAdPayment(user) {
  return isExclusiveAdManager(user);
}

function canManageAdComment(user) {
  return isExclusiveAdManager(user);
}

module.exports = {
  EXCLUSIVE_AD_MANAGER_LOGIN_ID,
  isExclusiveAdManager,
  canDeleteAdPayment,
  canManageAdComment,
};
