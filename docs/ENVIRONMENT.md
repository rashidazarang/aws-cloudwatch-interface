# Environment Configuration Guide

This document explains how to configure environment variables for the AWS CloudWatch Interface across local development, Vercel deployments, and Supabase Edge Functions.

## Variable Reference

Refer to [`../README.md`](../README.md#environment-variables) for the complete list of variables and their descriptions. The sections below give additional context on sourcing and storing each value securely.

### AWS Credentials
- **Preferred**: Create an IAM user with programmatic access limited to the necessary CloudWatch Logs actions (`logs:DescribeLogGroups`, `logs:StartQuery`, `logs:GetQueryResults`, etc.).
- **Alternative**: Configure an IAM role and rely on your host platform (e.g., Vercel, AWS Lambda) for role assumption. In that case, leave `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` empty and ensure the runtime has access via its execution role.
- Store secrets using Vercel’s dashboard (`vercel env add`) or your preferred secret manager. Avoid committing credentials to `.env.example`.

### Supabase Keys
- `SUPABASE_URL` is the project URL from your Supabase dashboard.
- `SUPABASE_ANON_KEY` powers client-side interactions; `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.
- Mirror your Supabase URL and anon key to the public env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) so the browser can bootstrap the auth client.
- When self-hosting, set `DATABASE_URL` to point directly to your Postgres instance for migrations and CLI tooling.
- The base schema provisions a `cloudwatch_logs` table with a uniqueness constraint and RLS policies. Server-side ingestion requires the service-role key (or equivalent) to insert deduplicated rows and purge entries older than the configured retention window (30 days by default).

### Supabase Auth Tokens
- REST endpoints now expect `Authorization: Bearer <Supabase access token>` obtained via Supabase Auth (magic links, OAuth, etc.).
- Cron jobs or automations can mint service tokens using Supabase’s Admin API and store them securely (e.g., Vercel encrypted env vars).
- Regenerate tokens regularly and prefer short-lived JWTs for agents; revoke compromised tokens in Supabase Dashboard → Auth → Users.

### Application Secrets
- `JWT_SECRET` is reserved for future custom token flows. Leave unset unless you introduce additional signing requirements.
- `SESSION_COOKIE_NAME` defaults to `gl_session`. Change this if your infrastructure requires a unique prefix.
- `API_RATE_LIMIT` controls intake across REST and MCP surfaces. Pick a value that balances agent throughput with cost protection.

### MCP Configuration
- `MCP_BASE_URL` identifies where agent clients connect (e.g., `https://mcp.yourdomain.com`).
- Use `MCP_SHARED_SECRET` to sign and verify requests between the MCP adapter and clients. Rotate periodically.
- `MCP_ALLOWED_TOOLS` lets you disable specific tools without redeploying the adapter by removing their identifiers.

## Managing Secrets in Vercel

1. Install Vercel CLI and log in: `npm i -g vercel` then `vercel login`.
2. Set each variable:
   ```bash
   vercel env add AWS_REGION
   vercel env add AWS_ACCESS_KEY_ID
   # ... repeat for remaining keys
   ```
3. Pull them locally with `vercel env pull .env` when needed for development (do not commit the generated `.env`).
4. Redeploy your project after updates so the new secrets propagate to serverless functions.

## Local Development Tips

- Duplicate `.env.example` to `.env` and populate with test credentials.
- When using the Supabase CLI locally, export `SUPABASE_ACCESS_TOKEN` separately for CLI commands; avoid injecting it into the app runtime.
- Consider setting `AWS_PROFILE` and `AWS_REGION` to leverage existing credentials via the AWS SDK default credential chain during development.

## Secret Rotation Checklist

1. Generate new credential (AWS key, Supabase service key, JWT secret, etc.).
2. Update Vercel environment variable and Supabase configuration as required.
3. Redeploy the application.
4. Revoke the old credential in AWS/Supabase.
5. Verify functionality using health checks and a sample query.

Keeping environment configuration documented and versioned separately from sensitive values ensures contributors can reproduce setups without risking unintended secret exposure.
