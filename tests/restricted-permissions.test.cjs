const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isExclusiveAdManager,
  canDeleteAdPayment,
  canManageAdComment,
} = require('../api/restrictedPermissions');

test('댓글 수정, 댓글 삭제, 광고 삭제는 cchee 계정에만 허용한다', () => {
  const cchee = { email: 'cchee', role: '전체관리자', canDeleteAds: true };
  const otherAdmin = { email: 'admin', role: '전체관리자', canDeleteAds: true };
  const legacyAlias = { email: 'cchee@gmail.com', role: '전체관리자', canDeleteAds: true };

  assert.equal(isExclusiveAdManager(cchee), true);
  assert.equal(canDeleteAdPayment(cchee), true);
  assert.equal(canManageAdComment(cchee), true);

  for (const account of [otherAdmin, legacyAlias, { email: 'staff', canDeleteAds: true }, null]) {
    assert.equal(isExclusiveAdManager(account), false);
    assert.equal(canDeleteAdPayment(account), false);
    assert.equal(canManageAdComment(account), false);
  }
});
