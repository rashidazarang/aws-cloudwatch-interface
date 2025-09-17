# Shared Services

Shared service-layer utilities for interacting with AWS CloudWatch Logs, Supabase, and ancillary providers will live in this package. The intent is to:

- Provide a thin wrapper around the AWS SDK v3 for CloudWatch Logs Insights queries.
- Expose persistence helpers for storing/retrieving saved queries, API tokens, and query history from Supabase.
- Offer reusable authentication/authorization guards for REST routes and MCP tools.

Implementation begins in Milestone M1. No code has been committed yet; this README marks the package boundary.
