UPDATE "User"
SET "canDeleteAds" = CASE
  WHEN LOWER("email") = 'cchee' THEN true
  ELSE false
END
WHERE "canDeleteAds" IS DISTINCT FROM CASE
  WHEN LOWER("email") = 'cchee' THEN true
  ELSE false
END;
