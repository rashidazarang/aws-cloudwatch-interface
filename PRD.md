# AWS CloudWatch Interface – Product Requirements Document

## Product Overview
AWS CloudWatch Interface is a lightweight, open-source toolkit for securely querying and managing CloudWatch Logs data through a streamlined web interface, REST endpoints, and Model Context Protocol (MCP) adapter. The starter project is designed for rapid self-hosted deployments (e.g., Vercel plus Supabase) so teams can inspect logs, orchestrate automations, and expose structured log access to AI agents without moving data outside their AWS accounts.

## Goals
- Deliver a minimal, easy-to-deploy baseline that anyone can fork and configure in under 30 minutes.
- Keep log access secure by operating entirely within the user’s AWS & Supabase environments.
- Offer a simple but expressive UI for browsing log groups, running CloudWatch Logs Insights queries, and saving frequent searches.
- Publish a well-documented REST and MCP interface so human users, workflows, and AI agents can consume log data consistently.
- Provide scripts and SQL schema to stand up the required Supabase persistence layer with minimal friction.

## Non-Goals
- Implement full-fledged log analytics features such as dashboards, anomaly detection, or alerting.
- Manage user billing, subscription plans, or cross-account AWS scenarios.
- Extend support beyond CloudWatch Logs and the core IAM prerequisites.
- Bundle third-party proprietary integrations that compromise the open-source and self-host mindset.

## Target Users
- DevOps engineers and SREs who want a focused CloudWatch Logs explorer outside of the AWS console.
- AI/automation engineers who need reliable log retrieval endpoints for autonomous agents.
- Security-conscious teams preferring self-hosted tooling with transparent data flows.

## Primary User Stories
- As an engineer, I can configure AWS credentials (access key/secret or IAM role) and validate connectivity to CloudWatch Logs.
- As a user, I can list log groups, run Logs Insights queries with time and filter parameters, and inspect results within the UI.
- As a user, I can save and tag frequently-used queries for quick recall.
- As an AI agent, I can call authenticated REST endpoints or the MCP adapter to retrieve filtered log data.
- As an auditor, I can review query history (including requester type, target group, status, and row counts) stored in Supabase.
- As an admin, I can rotate credentials, revoke API tokens, or disable caching without redeploying the entire stack.

## Key Features (MVP)
- Setup documentation and onboarding checklist covering environment variables, IAM permissions, and Supabase provisioning.
- Minimal web UI (Next.js/React) with log group explorer, query builder, results table/JSON viewer, and saved queries list.
- REST endpoints protected by JWT or Supabase-authenticated sessions to list log groups, execute queries, and fetch prior results.
- MCP adapter exposing CloudWatch log retrieval and saved-query execution as MCP tools for agent integrations.
- Supabase-backed persistence for users, saved queries, query history, API tokens, and optional cached results.
- Log ingestion utilities that deduplicate `(log_group, timestamp, message)` tuples and enforce a configurable retention window (default 30 days) before writing to Supabase.
- SQL migration script and CLI helper to initialize Supabase schema and seed development data.
- Structured logging, centralized error handling, and basic rate limiting on external entry points.
- Unit tests for service-layer logic (AWS CloudWatch wrapper, Supabase persistence, authentication guards).

## Architecture Overview
- **Frontend**: Next.js app (React + Tailwind) deployed to Vercel (static assets + serverless API routes).
- **Backend**: Serverless functions (Node/TypeScript) handling authentication, query orchestration, Supabase persistence, and MCP tool delivery.
- **Persistence**: Supabase (Postgres + Auth) for user management, query storage, audit logging, and caching.
- **AWS Integration**: AWS SDK v3 for CloudWatch Logs Insights queries and log group enumeration.
- **MCP**: Node-based MCP server/module that binds to the same data services and exposes standardized tools for agents.

## Dependencies & Integrations
- Node.js 18+ runtime, pnpm/npm for package management.
- Next.js 14, React 18, Tailwind CSS for the UI layer.
- AWS SDK for JavaScript v3 (CloudWatch Logs client).
- Supabase JavaScript client and edge functions for database access.
- JSON Web Token (JWT) library for API authentication.
- Vitest (unit tests) and Playwright or Cypress (optional end-to-end smoke tests).
- MCP server toolkit (e.g., `@modelcontextprotocol/sdk`) for building the agent connector.

## Configuration & Environment Variables
All variables must be documented in the README and configured in Vercel (or `.env` for local dev):
- `AWS_REGION`: Target AWS region for CloudWatch Logs.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: Credentials with permissions to run Logs Insights queries; optionally support assumed roles via `AWS_SESSION_TOKEN`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase project access keys.
- `DATABASE_URL`: Connection string for local Supabase or Postgres when running self-hosted.
- `JWT_SECRET`: HMAC secret for issuing and verifying application tokens.
- `NEXT_PUBLIC_APP_URL`: Public base URL for the deployed interface (used in auth callbacks and sharing links).
- `SESSION_COOKIE_NAME`: Configurable session cookie identifier.
- `API_RATE_LIMIT`: Optional limit for inbound agent/API requests.
- `MCP_BASE_URL`: URL where the MCP adapter is hosted (for agent registration).
- `MCP_SHARED_SECRET`: Secret used to authenticate between MCP clients and the adapter.
- `MCP_ALLOWED_TOOLS`: Comma-separated list of MCP tool identifiers the deployment exposes.

## Data Model & Supabase Schema
Provide a SQL script that creates the following tables, indexes, and RLS policies:
- `profiles`: `id` UUID PK, email, display_name, role enum (`admin`, `member`), created_at.
- `api_tokens`: `id` UUID PK, `user_id` FK -> profiles, `token_hash`, `label`, `last_used_at`, `created_at`.
- `saved_queries`: `id` UUID PK, `user_id`, `name`, `log_group`, `query_string`, `description`, `tags`, timestamps.
- `query_history`: `id` UUID PK, `requester_type` enum (`user`, `agent`), `requester_id`, `log_group`, `query_string`, `started_at`, `completed_at`, `status`, `error_message`, `result_row_count`.
- `cached_results`: `id` UUID PK, `query_history_id`, `expires_at`, `result_json` JSONB, `result_checksum`.
- `audit_events`: `id` UUID PK, `actor_id`, `event_type`, `metadata` JSONB, `created_at`.
- `mcp_clients`: `id` UUID PK, `client_name`, `client_public_key`, `last_seen_at`, `status`.
Include indexes on commonly filtered columns (log_group, requester_type, created_at) and RLS to scope data access by user role.

## API Surface
- `POST /api/auth/token`: Issue API or MCP tokens (admin only). Body includes label; returns token value once.
- `GET /api/log-groups`: Paginated list of CloudWatch log groups accessible to the configured AWS credentials.
- `POST /api/query`: Execute a Logs Insights query (`logGroupName`, `startTime`, `endTime`, `queryString`, optional `limit`). Returns job metadata and initial results when available.
- `GET /api/query/:id`: Fetch query status, cached results, and related metadata from Supabase.
- `GET /api/saved-queries`: List saved queries for the authenticated user.
- `POST /api/saved-queries`: Create or update a saved query definition.
- `DELETE /api/saved-queries/:id`: Remove a saved query.
- `GET /api/health`: Health check for monitoring.

## Model Context Protocol Integration
- Ship an MCP adapter that authenticates using `MCP_SHARED_SECRET` and exposes tools such as `list_log_groups`, `run_logs_insights_query`, and `fetch_saved_query`.
- Provide JSON schema definitions for tool inputs/outputs so agents receive structured responses.
- Mirror API rate limits and auditing: MCP tool invocations create entries in `query_history` with requester_type=`agent` and resolve cached results when available.
- Publish integration docs describing how to register the MCP endpoint with popular agent frameworks and how to scope permissions for different clients.

## Security & Privacy
- Enforce HTTPS-only deployments; ensure credentials and tokens never appear in logs.
- Hash API tokens (bcrypt/scrypt) before storing; display raw token only once on creation.
- Implement RLS in Supabase so users only access their own saved queries and history unless they have `admin` role.
- Support credential rotation by reading AWS & Supabase secrets at runtime and gracefully handling rollovers.
- Add per-route rate limiting and penalty boxes for repeated failures.
- Provide guidance on IAM policies limiting CloudWatch access to specific log groups.

## Open Source Readiness
- License under MIT; include LICENSE file and attribution instructions.
- README with quickstart, deployment guide, environment variable table, IAM policy template, and troubleshooting.
- CONTRIBUTING.md with setup steps, coding standards (ESLint + Prettier), testing, and PR guidelines.
- Issue templates (bug, feature request) and a high-level roadmap.
- Automated formatting/linting via Husky or Git hooks to encourage consistency.

## Success Metrics
- First-time deployer completes setup in <30 minutes following README steps.
- REST and MCP queries succeed >95% of the time excluding AWS-side errors.
- Median query response latency <3 seconds for typical 5–15 minute windows.
- Community metrics: targeted GitHub stars, external contributions, and documented MCP integrations within first quarter post-launch.

## Assumptions & Risks
- Users possess IAM credentials with CloudWatch Logs Insights permissions and accept associated AWS costs.
- Supabase (hosted or self-managed) meets user compliance needs; alternative Postgres hosts require manual adaptation.
- Vercel serverless limits are acceptable for anticipated query volumes; fallback deployment guides may be required (AWS Lambda, container runtime).
- MCP adoption requires additional documentation and may surface compatibility differences across agent frameworks.
- Query costs and throttling from AWS must be monitored; include guidance on budgeting and logging.

## Milestones & Roadmap
- **M0 – Project Bootstrap**: Create repository skeleton, README, environment variable reference, Supabase SQL script, MCP adapter skeleton.
- **M1 – Core Services**: Implement AWS CloudWatch service layer, Supabase persistence, REST API endpoints, and accompanying unit tests.
- **M2 – User Interface**: Build minimal UI flows for authentication, log browsing, query execution, and saved query management.
- **M3 – MCP Delivery**: Finalize MCP adapter, publish integration docs, add agent-focused usage examples, and expand auditing.
- **M4 – Hardening & OSS Polish**: Security review, rate limiting, logging strategy, CI setup, contributor docs, issue templates, and release packaging.
