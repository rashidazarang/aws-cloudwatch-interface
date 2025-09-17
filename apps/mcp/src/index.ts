import { McpServer } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/transport/node';
import { z } from 'zod';

import {
  CloudWatchService,
  SupabaseRepository,
  createCloudWatchServiceFromEnv,
  createSupabaseAuthServiceFromEnv,
  createSupabaseRepositoryFromEnv,
} from '@aws-cloudwatch-interface/services';

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

const listLogGroupsInput = authSchema.extend({
  nextToken: z.string().optional(),
});

server.tool(
  'list_log_groups',
  {
    description: 'List CloudWatch log groups available to the deployment. Requires Supabase access token.',
    inputSchema: listLogGroupsInput,
  },
  async ({ params }) => {
    const input = listLogGroupsInput.parse(params);
    await authenticate(input.accessToken);

    const response = await cloudwatch.listLogGroups(input.nextToken);
    return {
      content: [
        {
          type: 'json_schema',
          data: {
            logGroups: response.logGroups ?? [],
            nextToken: response.nextToken ?? null,
          },
        },
      ],
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

server.tool(
  'run_logs_insights_query',
  {
    description: 'Execute a CloudWatch Logs Insights query and return results.',
    inputSchema: runQueryInput,
  },
  async ({ params }) => {
    const input = runQueryInput.parse(params);
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

      return {
        content: [
          {
            type: 'json_schema',
            data: {
              queryId: result.queryId,
              status: result.status,
              records: result.records,
              statistics: result.statistics ?? null,
            },
          },
        ],
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

server.tool(
  'list_saved_queries',
  {
    description: 'List saved queries for the authenticated Supabase user.',
    inputSchema: listSavedQueriesInput,
  },
  async ({ params }) => {
    const input = listSavedQueriesInput.parse(params);
    const user = await authenticate(input.accessToken);

    const saved = await repository.listSavedQueries(user.id);
    return {
      content: [
        {
          type: 'json_schema',
          data: { saved },
        },
      ],
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

server.tool(
  'save_query',
  {
    description: 'Persist a saved query for the authenticated Supabase user.',
    inputSchema: saveQueryInput,
  },
  async ({ params }) => {
    const input = saveQueryInput.parse(params);
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
          type: 'json_schema',
          data: { saved },
        },
      ],
    };
  },
);

const deleteQueryInput = authSchema.extend({
  id: z.string().uuid(),
});

server.tool(
  'delete_saved_query',
  {
    description: 'Delete a saved query owned by the authenticated user.',
    inputSchema: deleteQueryInput,
  },
  async ({ params }) => {
    const input = deleteQueryInput.parse(params);
    const user = await authenticate(input.accessToken);

    await repository.deleteSavedQuery(input.id, user.id);
    return {
      content: [
        {
          type: 'text',
          text: 'Deleted',
        },
      ],
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
