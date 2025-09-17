# MCP Adapter

This package exposes CloudWatch log access via the Model Context Protocol (MCP). Agents call the adapter with Supabase access tokens, mirroring the authentication flow used by the REST API.

## Features

- `list_log_groups` – lists log groups available to the deployment.
- `run_logs_insights_query` – runs a Logs Insights query and returns records/statistics.
- `list_saved_queries` – fetches saved queries owned by the authenticated user.
- `save_query` – persists a saved query for reuse.
- `delete_saved_query` – removes a saved query owned by the caller.

All tools require an `accessToken` parameter containing a Supabase JWT.

## Usage

```bash
pnpm --filter @aws-cloudwatch-interface/mcp build
node apps/mcp/dist/index.js
```

When wiring into an MCP-compatible agent, configure environment variables identical to the REST deployment (`AWS_REGION`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). Agents must supply their Supabase access token when invoking tools, for example:

```json
{
  "name": "list_log_groups",
  "arguments": {
    "accessToken": "<supabase_jwt>"
  }
}
```

Future milestones will include helper scripts for minting service tokens and registering the adapter with common agent frameworks.
