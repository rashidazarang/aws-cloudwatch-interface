# AWS CloudWatch Interface

AWS CloudWatch Interface is an open-source starter kit that lets teams deploy a secure CloudWatch Logs explorer, REST surface, and Model Context Protocol (MCP) adapter without shipping sensitive data outside their AWS account. The project is designed for rapid deployment on Vercel (or similar serverless hosts) with Supabase as the persistence layer.


## Repository Layout

```
aws-cloudwatch-interface/
├── apps/
│   ├── web/           # Next.js interface (to be implemented)
│   └── mcp/           # MCP adapter package (to be implemented)
├── docs/              # Additional documentation (env guide, architecture notes)
├── packages/
│   └── services/      # Shared service-layer code (CloudWatch + Supabase wrappers)
├── supabase/
│   ├── schema.sql     # Baseline database schema
│   └── README.md      # Supabase setup instructions (coming soon)
├── .gitignore
├── LICENSE (MIT)
└── README.md
```

## Quickstart

1. **Clone & install dependencies**
   ```bash
   git clone <repo-url>
   cd aws-cloudwatch-interface
   pnpm install
   ```
2. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in credentials using the table below before running the development server (to be added in Milestone M1).
3. **Provision Supabase**
   - Create a Supabase project (or self-hosted instance).
   - Run the SQL script in [`supabase/schema.sql`](./supabase/schema.sql) using the Supabase SQL editor or `psql` CLI.
4. **Configure deployment target**
   - Vercel is the default target; review the environment variables section before deploying.

> 🚧 The application code will be added in Milestones M1–M3. For now, the focus is on environment configuration and infrastructure scaffolding.

### Development Scripts

- `pnpm lint` – runs ESLint across workspaces.
- `pnpm test` – executes Vitest suites (currently focused on shared services).
- `pnpm build` – compiles individual packages that expose build scripts.
- `pnpm format` – formats Markdown/TypeScript files via Prettier.

## Environment Variables

| Name | Required | Description |
| ---- | -------- | ----------- |
| `AWS_REGION` | Yes | AWS region for CloudWatch Logs (e.g., `us-east-1`). |
| `AWS_ACCESS_KEY_ID` | Yes* | Access key with permissions for CloudWatch Logs Insights. Required unless using IAM role assumption. |
| `AWS_SECRET_ACCESS_KEY` | Yes* | Secret key paired with the access key. |
| `AWS_SESSION_TOKEN` | Conditional | Session token when using temporary credentials (STS). |
| `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key for client-side access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key used by serverless functions. Protect carefully. |
| `DATABASE_URL` | No | Direct Postgres connection string (used for local development or self-hosted Supabase). |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL exposed to the browser (matches `SUPABASE_URL`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key exposed to the browser (matches `SUPABASE_ANON_KEY`). |
| `JWT_SECRET` | Optional | Reserved for future token issuance. Leave unset unless enabling custom JWT flows. |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL of the deployed interface. |
| `SESSION_COOKIE_NAME` | No | Custom cookie name for session management (`gl_session` by default). |
| `API_RATE_LIMIT` | No | Requests per minute cap for REST/MCP consumers (integer). |
| `MCP_BASE_URL` | Yes | Base URL where the MCP adapter is reachable. |
| `MCP_SHARED_SECRET` | Yes | Shared secret for authenticating MCP clients. |
| `MCP_ALLOWED_TOOLS` | No | Comma-separated list of MCP tools to expose (defaults cover all). |

`*` Provide either static AWS credentials or configure IAM role assumption via your deployment platform.

See [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md) for guidance on storing these values in Vercel and local development.

The Supabase schema enforces deduplication (`(log_group, timestamp, message)` unique index) and a 30-day retention window handled by the ingestion service. Aim to schedule a recurring job (e.g., Vercel cron) that hits the ingestion endpoint or MCP tool hourly so historical data remains fresh without bloating storage.

## REST API Snapshot

- `GET /api/health` – simple readiness probe.
- `GET /api/log-groups` – proxy to CloudWatch Logs `DescribeLogGroups`; supports `nextToken` query param.
- `POST /api/query` – runs a Logs Insights query, polls for completion, and records history in Supabase.
- `GET /api/saved-queries` – list saved queries scoped to the authenticated user.
- `POST /api/saved-queries` – persist a saved query definition tied to the current user.
- `DELETE /api/saved-queries/:id` – remove a saved query owned by the current user.
- `GET /api/query-history` – fetch recent query runs for the authenticated user (supports limit/offset).

Send `Authorization: Bearer <Supabase access token>` with each request. Tokens come from Supabase Auth sessions (e.g., magic-link login from the web UI). Agents can obtain JWTs via Supabase service integrations or Admin API.

## Web Interface (M2 Snapshot)

- Supabase-authenticated login (magic link) powered by the public anon key.
- Log group browser with pagination and manual refresh.
- Query form for selecting time ranges, executing Insights queries, and reviewing results inline.
- Saved query list with quick load/delete actions and ad-hoc save support.
- Query history timeline with lazy pagination so teams can audit previous runs.
- Client calls the REST API with Supabase JWTs so your credentials never leave the deployment.

## MCP Adapter

The MCP adapter (under `apps/mcp`) mirrors the REST functionality for AI agents:

- `list_log_groups`, `run_logs_insights_query`, `list_saved_queries`, `save_query`, and `delete_saved_query` tools.
- Each tool expects a Supabase `accessToken` parameter, ensuring consistent auth semantics with the REST layer.
- Start the adapter via `pnpm --filter @aws-cloudwatch-interface/mcp build` followed by `node apps/mcp/dist/index.js`.

Configuration mirrors the REST deployment (AWS credentials + Supabase keys). Build the shared services package before starting the adapter:

```bash
pnpm --filter @aws-cloudwatch-interface/services build
pnpm --filter @aws-cloudwatch-interface/mcp build
node apps/mcp/dist/index.js
```

Future work will include helper scripts for minting tokens and registering the adapter with popular agent frameworks.

## Supabase Setup

1. Open the Supabase SQL editor (or connect via `psql`).
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and execute.
3. Review row-level security policies and tailor them to your organization’s needs.
4. Populate seed data (admin profile, initial API token) manually or via upcoming CLI scripts.

## Roadmap Snapshot

- **M0**: Scaffold repo, document env requirements, define Supabase schema, stub MCP adapter package.
- **M1**: CloudWatch + Supabase services, REST endpoints, initial tests.
- **M2**: Web UI flows for log exploration and saved queries.
- **M3**: Fully functional MCP adapter and agent docs.
- **M4**: Security hardening, CI, contribution docs, release packaging.

## Contributing

Contributions are welcome once the core scaffolding solidifies. Please review the forthcoming [`CONTRIBUTING.md`](./CONTRIBUTING.md) (to be added in Milestone M4) before submitting pull requests.

## License

Released under the [MIT License](./LICENSE).
