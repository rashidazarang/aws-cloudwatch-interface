import { DescribeLogGroupsCommand, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { describe, expect, it, vi } from 'vitest';

import { CloudWatchService } from './cloudwatch-client.js';
import type { CloudWatchLogsClientLike } from './cloudwatch-client.js';

const baseRequest = {
  logGroupName: '/aws/lambda/example',
  queryString: 'fields @timestamp, @message | sort @timestamp desc | limit 20',
  window: {
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(),
  },
} as const;

describe('CloudWatchService', () => {
  it('throws when start time is after end time', async () => {
    const service = new CloudWatchService({
      client: createNoopClient(),
    });

    await expect(
      service.startQuery({
        ...baseRequest,
        window: {
          startTime: new Date('2024-03-10T10:00:00Z'),
          endTime: new Date('2024-03-09T10:00:00Z'),
        },
      }),
    ).rejects.toThrow('window.startTime must be before window.endTime');
  });

  it('runs query until completion and returns normalized result', async () => {
    const send = vi
      .fn()
      .mockImplementationOnce(async (command: StartQueryCommand) => {
        expect(command).toBeInstanceOf(StartQueryCommand);
        return { queryId: 'abc-123' } as never;
      })
      .mockImplementationOnce(async (command: GetQueryResultsCommand) => {
        expect(command).toBeInstanceOf(GetQueryResultsCommand);
        return { status: 'Running' } as never;
      })
      .mockImplementationOnce(async (command: GetQueryResultsCommand) => {
        expect(command).toBeInstanceOf(GetQueryResultsCommand);
        return {
          status: 'Complete',
          results: [
            [
              { field: '@timestamp', value: '2024-03-10T10:00:00Z' },
              { field: '@message', value: 'hello world' },
            ],
          ],
        } as never;
      });

    const wait = vi.fn(() => Promise.resolve());

    const service = new CloudWatchService({
      client: { send } as CloudWatchLogsClientLike,
      sleepFn: wait,
    });

    const result = await service.runQuery(baseRequest, {
      pollIntervalMs: 5,
      maxPollAttempts: 5,
    });

    expect(result.status).toBe('succeeded');
    expect(result.queryId).toBe('abc-123');
    expect(result.records).toHaveLength(1);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('throws when CloudWatch omits query id', async () => {
    const service = new CloudWatchService({
      client: {
        send: vi.fn().mockResolvedValueOnce({}),
      } as CloudWatchLogsClientLike,
    });

    await expect(service.startQuery(baseRequest)).rejects.toThrow('CloudWatch did not return a queryId');
  });

  it('delegates listLogGroups to CloudWatch client', async () => {
    const send = vi.fn().mockResolvedValue({ logGroups: [] });
    const service = new CloudWatchService({
      client: { send } as CloudWatchLogsClientLike,
    });

    await service.listLogGroups('token-123');

    expect(send).toHaveBeenCalledWith(expect.any(DescribeLogGroupsCommand));
    const command = send.mock.calls[0][0] as DescribeLogGroupsCommand;
    expect(command.input?.nextToken).toBe('token-123');
  });
});

function createNoopClient(): CloudWatchLogsClientLike {
  return {
    send: vi.fn(),
  };
}
