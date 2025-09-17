import type { CloudWatchLogsClientConfig, DescribeLogGroupsCommandOutput, GetQueryResultsCommandOutput } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import type { LogQueryRequest, LogQueryResult, QueryExecutionOptions } from '../types.js';
type CloudWatchLogsClientLike = Pick<CloudWatchLogsClient, 'send'>;
export type SleepFn = (ms: number) => Promise<void>;
export declare class CloudWatchService {
    private readonly client;
    private readonly sleep;
    constructor(options?: CloudWatchLogsClientConfig & {
        client?: CloudWatchLogsClientLike;
        sleepFn?: SleepFn;
    });
    listLogGroups(nextToken?: string): Promise<DescribeLogGroupsCommandOutput>;
    startQuery(request: LogQueryRequest): Promise<string>;
    getQueryResults(queryId: string): Promise<GetQueryResultsCommandOutput>;
    runQuery(request: LogQueryRequest, options?: QueryExecutionOptions): Promise<LogQueryResult>;
}
export declare function createCloudWatchService(config?: CloudWatchLogsClientConfig): CloudWatchService;
export {};
