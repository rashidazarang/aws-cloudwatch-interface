# Supabase Setup

This directory hosts database migrations and operational notes for the AWS CloudWatch Interface. Start by running [`schema.sql`](./schema.sql) in your Supabase project or compatible Postgres environment.

## Applying the Base Schema

### Via Supabase SQL Editor
1. Open the SQL editor in the Supabase dashboard.
2. Paste the contents of `schema.sql`.
3. Execute and verify that the tables, enums, policies, and indexes are created. Pay special attention to the `cloudwatch_logs` table, which enforces uniqueness on `(log_group, timestamp, message)` and powers the 30-day retention flow.

### Via `psql`
```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```
Ensure `DATABASE_URL` points to your Supabase/Postgres instance (service-role credentials recommended).

## Next Steps
- Seed an initial admin profile and corresponding API token for bootstrap operations.
- Configure Supabase Auth settings to issue JWTs with the user UUID (`auth.uid()`).
- Set up automated migrations (e.g., via `supabase db push` or a CI workflow) in future milestones.
- Schedule a recurring task (Vercel cron or GitHub Action) that invokes the ingestion API/MCP tool hourly so new logs roll in while the retention policy prunes rows older than 30 days.

Additional migrations and seed scripts will live alongside this README as the project matures.
