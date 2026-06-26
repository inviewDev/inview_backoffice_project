ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "canDeleteAds" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
   SET "role" = '전체관리자',
       "status" = '재직',
       "adVisibilityScope" = 'all',
       "canDeleteAds" = true
 WHERE lower("email") IN ('cchee', 'cchee@gmail.com');
