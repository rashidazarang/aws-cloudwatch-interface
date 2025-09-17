import { type SupabaseClient } from '@supabase/supabase-js';
import type { LogIngestionResult, LogRecordInput, QueryHistoryInput, SavedQueryInput } from '../types.js';
export interface SupabaseServiceConfig {
    url: string;
    serviceRoleKey: string;
}
export interface ProfileRecord {
    id: string;
    email: string;
    display_name: string | null;
    role: 'admin' | 'member';
    created_at: string;
}
export interface SavedQueryRecord {
    id: string;
    user_id: string;
    name: string;
    log_group: string;
    query_string: string;
    description: string | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
}
export interface QueryHistoryRecord {
    id: string;
    requester_type: 'user' | 'agent';
    requester_id: string | null;
    log_group: string;
    query_string: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    error_message: string | null;
    result_row_count: number | null;
    summary_text: string | null;
    cloudwatch_query_id: string | null;
    created_at: string;
}
export interface CloudwatchLogRecord {
    id: string;
    log_group: string;
    timestamp: string;
    message: string;
    ingestion_label: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}
interface LogIngestionOptions {
    retentionDays?: number;
}
export interface QueryHistoryListOptions {
    limit?: number;
    offset?: number;
}
export declare class SupabaseRepository {
    private readonly client;
    constructor(client: SupabaseClient);
    static fromServiceRole(config: SupabaseServiceConfig): SupabaseRepository;
    static fromClient(client: SupabaseClient): SupabaseRepository;
    getProfileById(id: string): Promise<ProfileRecord>;
    createQueryHistory(payload: QueryHistoryInput): Promise<QueryHistoryRecord>;
    updateQueryHistory(id: string, updates: Partial<Pick<QueryHistoryInput, 'status' | 'errorMessage' | 'resultRowCount' | 'summaryText' | 'cloudwatchQueryId'>>): Promise<QueryHistoryRecord>;
    createSavedQuery(input: SavedQueryInput): Promise<SavedQueryRecord>;
    listSavedQueries(userId: string): Promise<SavedQueryRecord[]>;
    listQueryHistory(userId: string, options?: QueryHistoryListOptions): Promise<QueryHistoryRecord[]>;
    deleteSavedQuery(id: string, userId: string): Promise<void>;
    insertLogRecords(records: LogRecordInput[], options?: LogIngestionOptions): Promise<LogIngestionResult>;
    purgeLogsBefore(cutoff: Date): Promise<number>;
}
export {};
