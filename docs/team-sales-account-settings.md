# Team Sales and Account Settings

## Routes and Permissions

- `/users/account-settings`: account editor, accessible to the existing `전체관리자` role. Staff and pending-list tabs remain available.
- Account permission changes, including `canViewTeamSales`, require the existing root identity (`cchee` or `cchee@gmail.com`) on the server.
- `/team-sales` and `/api/team-sales`: root or explicitly granted users only. Granting team-sales access permits aggregate totals for all teams; it does not expand individual advertisement access.
- `/api/sales-permissions`: current-user menu visibility. The sales API independently checks the current database permission on every request.
- Root identity cannot be renamed or assigned to another account through account settings.
- Account changes and a changed team-sales grant are saved in one transaction. Omitting the new permission field preserves its value.

## Aggregation

Team sales use the same KST registration-month boundaries and completed-payment status test as personal sales. Waiting, cancelled and empty statuses are excluded. Amount and net profit use the stored payment values. Each payment is attributed to its owner's current department and team, consistent with the legacy organizational join. Teams with no included payments are omitted. CSV exports the complete filtered result, not only the displayed page.

## Database Rollout

The additive migration is `prisma/migrations/20260915000000_add_team_sales_permission/migration.sql`. It adds only `UserSalesPermission`, with a cascading user foreign key and RLS enabled without public policies. Prisma must connect as the table owner or an appropriate server-only role that bypasses RLS.

On 2026-09-15, with user approval, this table was applied to the connected database using the targeted SQL migration; the RLS statement was then applied and checked separately. No user grants, account records, or payment data were changed. The table starts empty; root access remains implicit.

The existing database had no `_prisma_migrations` ledger despite its existing schema. Do not run `prisma migrate deploy` blindly: it would attempt historical migrations. No historical migration was executed or marked as applied during this task. Reconcile/baseline the existing schema separately before adopting migration-ledger deployment. Do not rerun this CREATE TABLE migration on the already-updated database.

After schema changes, run `npx prisma generate` and restart the API. On Windows, stop the relevant local API before generation if its Prisma DLL is locked. Frontend/API deployment is separate from the database change.

The new permission is stored outside the User scalar columns so missing storage does not break existing login or `/me` queries. Missing storage denies non-root team access and disables its editor control, while existing account settings can still save.

## Verification

- `node --test tests/personal-sales.test.cjs`: authenticated API tests with isolated Prisma doubles, including grant/revoke authorization, transaction rollback, missing-storage compatibility, aggregation and CSV.
- `node tests/account-settings.browser.cjs`: Playwright fixture tests for account tabs, save/reload/revoke, team totals, CSV, authorization states and responsive layout.
- `node tests/personal-sales.browser.cjs`: existing personal-sales regression checks.
- Browser scripts accept `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHROMIUM_PATH`, and `SALES_TEST_ORIGIN` / `SALES_TEST_URL` when local tooling or URLs differ.
- Browser saves use mocked requests only; no real account was granted permission as a test.
