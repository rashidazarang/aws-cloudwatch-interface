# MCP Adapter

This directory will contain the Model Context Protocol (MCP) adapter, exposing CloudWatch log access as agent-friendly tools. The adapter will:

- Authenticate clients using `MCP_SHARED_SECRET` and API tokens stored in Supabase.
- Provide tools for listing log groups, executing CloudWatch Logs Insights queries, and returning cached results.
- Mirror REST API limits, auditing every invocation into `query_history` and `audit_events`.

Implementation will begin in Milestone M3. For now, this placeholder establishes the package layout.
