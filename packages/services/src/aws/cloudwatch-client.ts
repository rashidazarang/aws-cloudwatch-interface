import type {
  CloudWatchLogsClientConfig,
  DescribeLogGroupsCommandOutput,
  GetQueryResultsCommandOutput,
  StartQueryCommandOutput,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';

import type { LogQueryRequest, LogQueryResult, QueryExecutionOptions } from '../types.js';

type CloudWatchLogsClientLike = Pick<CloudWatchLogsClient, 'send'>;

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_ATTEMPTS = 30;

export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class CloudWatchService {
  private readonly client: CloudWatchLogsClientLike;
  private readonly sleep: SleepFn;

  constructor(options?: CloudWatchLogsClientConfig & { client?: CloudWatchLogsClientLike; sleepFn?: SleepFn }) {
    const { client, ...clientOptions } = options ?? {};
    if (client) {
      this.client = client;
    } else {
      this.client = new CloudWatchLogsClient(clientOptions as CloudWatchLogsClientConfig);
    }

    this.sleep = options?.sleepFn ?? defaultSleep;
  }

  async listLogGroups(nextToken?: string): Promise<DescribeLogGroupsCommandOutput> {
    const command = new DescribeLogGroupsCommand({ nextToken });
    return this.client.send(command) as Promise<DescribeLogGroupsCommandOutput>;
  }

  async startQuery(request: LogQueryRequest): Promise<string> {
    validateQueryRequest(request);

    const command = new StartQueryCommand({
      logGroupName: request.logGroupName,
      queryString: request.queryString,
      startTime: Math.floor(request.window.startTime.getTime() / 1000),
      endTime: Math.floor(request.window.endTime.getTime() / 1000),
      limit: request.limit,
    });

    const response = (await this.client.send(command)) as StartQueryCommandOutput;
    if (!response.queryId) {
      throw new Error('CloudWatch did not return a queryId');
    }

    return response.queryId;
  }

  async getQueryResults(queryId: string): Promise<GetQueryResultsCommandOutput> {
    const command = new GetQueryResultsCommand({ queryId });
    return this.client.send(command) as Promise<GetQueryResultsCommandOutput>;
  }

  async runQuery(
    request: LogQueryRequest,
    options: QueryExecutionOptions = {},
  ): Promise<LogQueryResult> {
    const queryId = await this.startQuery(request);

    const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxAttempts = options.maxPollAttempts ?? DEFAULT_MAX_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.getQueryResults(queryId);
      const status = normalizeStatus(response.status);

      if (status === 'running' || status === 'scheduled') {
        await this.sleep(pollInterval);
        continue;
      }

      const records = (response.results ?? []).map((resultRow) => ({
        fields: (resultRow ?? []).map((entry) => ({
          field: entry?.field ?? '',
          value: entry?.value ?? '',
        })),
      }));

      return {
        queryId,
        status,
        records,
        statistics: response.statistics,
      };
    }

    throw new Error(`Query ${queryId} did not complete after ${maxAttempts} attempts`);
  }
}

function normalizeStatus(status?: string): LogQueryResult['status'] {
  switch (status) {
    case 'Scheduled':
      return 'scheduled';
    case 'Running':
      return 'running';
    case 'Complete':
      return 'succeeded';
    case 'Failed':
      return 'failed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

function validateQueryRequest(request: LogQueryRequest) {
  if (!request.logGroupName) {
    throw new Error('logGroupName is required');
  }

  if (!request.queryString) {
    throw new Error('queryString is required');
  }

  const { startTime, endTime } = request.window;
  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
    throw new Error('window.startTime must be a valid Date');
  }

  if (!(endTime instanceof Date) || Number.isNaN(endTime.getTime())) {
    throw new Error('window.endTime must be a valid Date');
  }

  if (startTime.getTime() >= endTime.getTime()) {
    throw new Error('window.startTime must be before window.endTime');
  }
}

export function createCloudWatchService(config?: CloudWatchLogsClientConfig) {
  return new CloudWatchService(config);
}
