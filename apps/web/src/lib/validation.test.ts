import { describe, expect, it } from 'vitest';

import { logQuerySchema, savedQuerySchema } from './validation';

describe('logQuerySchema', () => {
  it('validates minimal payload', () => {
    const parsed = logQuerySchema.parse({
      logGroupName: '/aws/lambda/example',
      queryString: 'fields @timestamp',
      startTime: '2024-06-01T00:00:00.000Z',
      endTime: '2024-06-01T01:00:00.000Z',
    });

    expect(parsed.logGroupName).toBe('/aws/lambda/example');
  });

  it('throws on invalid timestamp', () => {
    expect(() =>
      logQuerySchema.parse({
        logGroupName: '/aws/lambda/example',
        queryString: 'fields @timestamp',
        startTime: 'not-a-date',
        endTime: '2024-06-01T01:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('savedQuerySchema', () => {
  it('validates payload with optional fields', () => {
    const parsed = savedQuerySchema.parse({
      name: 'last hour errors',
      logGroup: '/aws/lambda/example',
      queryString: 'fields @timestamp, @message | filter @message like "ERROR"',
      tags: ['errors'],
    });

    expect(parsed.tags).toContain('errors');
  });
});
