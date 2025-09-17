import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { createCloudWatchServiceFromEnv, createSupabaseAuthServiceFromEnv, createSupabaseRepositoryFromEnv } from '@aws-cloudwatch-interface/services';

const server = new McpServer({
  name: 'aws-cloudwatch-interface-mcp',
  version: '0.0.1',
});

const authService = createSupabaseAuthServiceFromEnv();
const repository = createSupabaseRepositoryFromEnv();
const cloudwatch = createCloudWatchServiceFromEnv();

const authSchema = z.object({
  accessToken: z.string().min(1, 'accessToken is required'),
});

const listLogGroupsInput = z.object({
  accessToken: z.string().min(1, 'accessToken is required'),
  nextToken: z.string().optional(),
});

type ListLogGroupsArgs = z.infer<typeof listLogGroupsInput>;

server.registerTool(
  'list_log_groups',
  {
    description: 'List CloudWatch log groups available to the deployment. Requires Supabase access token.',
    inputSchema: listLogGroupsInput.shape,
  },
  async (args: ListLogGroupsArgs, _extra: unknown) => {
    const input = listLogGroupsInput.parse(args);
    await authenticate(input.accessToken);

    const response = await cloudwatch.listLogGroups(input.nextToken);
    const payload = {
      logGroups: response.logGroups ?? [],
      nextToken: response.nextToken ?? null,
    };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload),
        },
      ],
      _meta: { payload },
    };
  },
);

const runQueryInput = authSchema.extend({
  logGroupName: z.string().min(1),
  queryString: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  limit: z.number().int().positive().max(10_000).optional(),
  pollIntervalMs: z.number().int().positive().max(10_000).optional(),
  maxPollAttempts: z.number().int().positive().max(100).optional(),
});

type RunQueryArgs = z.infer<typeof runQueryInput>;

server.registerTool(
  'run_logs_insights_query',
  {
    description: 'Execute a CloudWatch Logs Insights query and return results.',
    inputSchema: runQueryInput.shape,
  },
  async (args: RunQueryArgs, _extra: unknown) => {
    const input = runQueryInput.parse(args);
    const user = await authenticate(input.accessToken);

    const history = await repository.createQueryHistory({
      requesterType: 'agent',
      requesterId: user.id,
      logGroup: input.logGroupName,
      queryString: input.queryString,
      status: 'pending',
    });

    try {
      const result = await cloudwatch.runQuery(
        {
          logGroupName: input.logGroupName,
          queryString: input.queryString,
          window: {
            startTime: new Date(input.startTime),
            endTime: new Date(input.endTime),
          },
          limit: input.limit,
        },
        {
          pollIntervalMs: input.pollIntervalMs,
          maxPollAttempts: input.maxPollAttempts,
        },
      );

      await repository.updateQueryHistory(history.id, {
        status: result.status === 'succeeded' ? 'succeeded' : 'failed',
        resultRowCount: result.records.length,
        cloudwatchQueryId: result.queryId,
      });

      const payload = {
        queryId: result.queryId,
        status: result.status,
        records: result.records,
        statistics: result.statistics ?? null,
      };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
        _meta: { payload },
      };
    } catch (error) {
      await repository.updateQueryHistory(history.id, {
        status: 'failed',
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  },
);

const listSavedQueriesInput = authSchema;

type ListSavedQueriesArgs = z.infer<typeof listSavedQueriesInput>;

server.registerTool(
  'list_saved_queries',
  {
    description: 'List saved queries for the authenticated Supabase user.',
    inputSchema: listSavedQueriesInput.shape,
  },
  async (args: ListSavedQueriesArgs, _extra: unknown) => {
    const input = listSavedQueriesInput.parse(args);
    const user = await authenticate(input.accessToken);

    const saved = await repository.listSavedQueries(user.id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ saved }),
        },
      ],
      _meta: { saved },
    };
  },
);

const saveQueryInput = authSchema.extend({
  name: z.string().min(1),
  logGroup: z.string().min(1),
  queryString: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
});

type SaveQueryArgs = z.infer<typeof saveQueryInput>;

server.registerTool(
  'save_query',
  {
    description: 'Persist a saved query for the authenticated Supabase user.',
    inputSchema: saveQueryInput.shape,
  },
  async (args: SaveQueryArgs, _extra: unknown) => {
    const input = saveQueryInput.parse(args);
    const user = await authenticate(input.accessToken);

    const saved = await repository.createSavedQuery({
      userId: user.id,
      name: input.name,
      logGroup: input.logGroup,
      queryString: input.queryString,
      description: input.description,
      tags: input.tags,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ saved }),
        },
      ],
      _meta: { saved },
    };
  },
);

const deleteQueryInput = authSchema.extend({
  id: z.string().uuid(),
});

type DeleteQueryArgs = z.infer<typeof deleteQueryInput>;

server.registerTool(
  'delete_saved_query',
  {
    description: 'Delete a saved query owned by the authenticated user.',
    inputSchema: deleteQueryInput.shape,
  },
  async (args: DeleteQueryArgs, _extra: unknown) => {
    const input = deleteQueryInput.parse(args);
    const user = await authenticate(input.accessToken);

    await repository.deleteSavedQuery(input.id, user.id);
    return {
      content: [
        {
          type: 'text',
          text: 'Deleted',
        },
      ],
      _meta: { id: input.id },
    };
  },
);

async function authenticate(accessToken: string) {
  const auth = await authService.getUserFromAccessToken(accessToken);
  return auth;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start MCP server', error);
  process.exit(1);
});
