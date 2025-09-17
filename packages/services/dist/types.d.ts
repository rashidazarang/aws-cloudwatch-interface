export interface LogQueryWindow {
    startTime: Date;
    endTime: Date;
}
export interface LogQueryRequest {
    logGroupName: string;
    queryString: string;
    window: LogQueryWindow;
    limit?: number;
}
export interface QueryExecutionOptions {
    pollIntervalMs?: number;
    maxPollAttempts?: number;
}
export interface LogQueryResultField {
    field: string;
    value: string;
}
export interface LogQueryResultRecord {
    fields: LogQueryResultField[];
}
export type LogQueryStatus = 'scheduled' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface LogQueryResult {
    queryId: string;
    status: LogQueryStatus;
    records: LogQueryResultRecord[];
    statistics?: {
        bytesScanned?: number;
        recordsMatched?: number;
        recordsScanned?: number;
    };
}
export interface SavedQueryInput {
    userId: string;
    name: string;
    logGroup: string;
    queryString: string;
    description?: string;
    tags?: string[];
}
export interface QueryHistoryInput {
    requesterType: 'user' | 'agent';
    requesterId?: string;
    logGroup: string;
    queryString: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    errorMessage?: string;
    resultRowCount?: number;
    summaryText?: string;
    cloudwatchQueryId?: string;
}
export interface LogRecordInput {
    logGroup: string;
    timestamp: Date;
    message: string;
    ingestionLabel?: string;
    metadata?: Record<string, unknown>;
}
export interface LogIngestionResult {
    insertedCount: number;
    deduplicatedCount: number;
    deletedOldCount: number;
}
