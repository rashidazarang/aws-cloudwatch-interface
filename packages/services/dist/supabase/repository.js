import { createClient, } from '@supabase/supabase-js';
export class SupabaseRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    static fromServiceRole(config) {
        const client = createClient(config.url, config.serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
        return new SupabaseRepository(client);
    }
    static fromClient(client) {
        return new SupabaseRepository(client);
    }
    async getProfileById(id) {
        const { data, error } = await this.client
            .from('profiles')
            .select()
            .eq('id', id)
            .single();
        return assertRow(data, error, `Profile ${id} not found`);
    }
    async createQueryHistory(payload) {
        const { data, error } = await this.client
            .from('query_history')
            .insert({
            requester_type: payload.requesterType,
            requester_id: payload.requesterId ?? null,
            log_group: payload.logGroup,
            query_string: payload.queryString,
            status: payload.status,
            error_message: payload.errorMessage ?? null,
            result_row_count: payload.resultRowCount ?? null,
            summary_text: payload.summaryText ?? null,
            cloudwatch_query_id: payload.cloudwatchQueryId ?? null,
        })
            .select()
            .single();
        return assertRow(data, error, 'Failed to insert query_history record');
    }
    async updateQueryHistory(id, updates) {
        const { data, error } = await this.client
            .from('query_history')
            .update({
            status: updates.status,
            error_message: updates.errorMessage ?? null,
            result_row_count: updates.resultRowCount ?? null,
            summary_text: updates.summaryText ?? null,
            cloudwatch_query_id: updates.cloudwatchQueryId ?? null,
        })
            .eq('id', id)
            .select()
            .single();
        return assertRow(data, error, `Failed to update query_history record ${id}`);
    }
    async createSavedQuery(input) {
        const { data, error } = await this.client
            .from('saved_queries')
            .insert({
            user_id: input.userId,
            name: input.name,
            log_group: input.logGroup,
            query_string: input.queryString,
            description: input.description ?? null,
            tags: input.tags ?? null,
        })
            .select()
            .single();
        return assertRow(data, error, 'Failed to insert saved query');
    }
    async listSavedQueries(userId) {
        const { data, error } = await this.client
            .from('saved_queries')
            .select()
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to list saved queries for user ${userId}: ${error.message}`);
        }
        return data ?? [];
    }
    async listQueryHistory(userId, options = {}) {
        const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
        const offset = Math.max(options.offset ?? 0, 0);
        const from = offset;
        const to = offset + limit - 1;
        const { data, error } = await this.client
            .from('query_history')
            .select()
            .eq('requester_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) {
            throw new Error(`Failed to list query history for user ${userId}: ${error.message}`);
        }
        return data ?? [];
    }
    async deleteSavedQuery(id, userId) {
        const { error } = await this.client
            .from('saved_queries')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) {
            throw new Error(`Failed to delete saved query ${id}: ${error.message}`);
        }
    }
    async insertLogRecords(records, options = {}) {
        if (records.length === 0) {
            return { insertedCount: 0, deduplicatedCount: 0, deletedOldCount: 0 };
        }
        const deduped = deduplicateLogs(records);
        if (deduped.length > 0) {
            const { error } = await this.client.from('cloudwatch_logs').insert(deduped);
            if (error) {
                throw new Error(`Failed to insert cloudwatch logs: ${error.message}`);
            }
        }
        let deletedOldCount = 0;
        if (typeof options.retentionDays === 'number') {
            deletedOldCount = await this.purgeLogsBefore(new Date(Date.now() - options.retentionDays * 24 * 60 * 60 * 1000));
        }
        return {
            insertedCount: deduped.length,
            deduplicatedCount: records.length - deduped.length,
            deletedOldCount,
        };
    }
    async purgeLogsBefore(cutoff) {
        const isoCutoff = cutoff.toISOString();
        const { data, error } = await this.client
            .from('cloudwatch_logs')
            .delete()
            .lt('timestamp', isoCutoff)
            .select('id');
        if (error) {
            throw new Error(`Failed to purge cloudwatch logs before ${isoCutoff}: ${error.message}`);
        }
        return Array.isArray(data) ? data.length : 0;
    }
}
function deduplicateLogs(records) {
    const tracker = new Map();
    for (const record of records) {
        const mapped = mapLogRecord(record);
        const key = `${mapped.log_group}|${mapped.timestamp}|${mapped.message}`;
        if (!tracker.has(key)) {
            tracker.set(key, mapped);
        }
    }
    return Array.from(tracker.values());
}
function mapLogRecord(record) {
    return {
        log_group: record.logGroup,
        timestamp: record.timestamp.toISOString(),
        message: record.message,
        ingestion_label: record.ingestionLabel ?? null,
        metadata: record.metadata ?? {},
    };
}
function assertRow(data, error, message) {
    if (error) {
        throw new Error(`${message}: ${error.message}`);
    }
    if (!data) {
        throw new Error(message);
    }
    return data;
}
//# sourceMappingURL=repository.js.map