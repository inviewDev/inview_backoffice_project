ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "adVisibilityScope" TEXT NOT NULL DEFAULT 'own';

UPDATE "User"
   SET "role" = '전체관리자',
       "status" = '재직',
       "adVisibilityScope" = 'all'
 WHERE lower("email") IN ('cchee', 'cchee@gmail.com');
