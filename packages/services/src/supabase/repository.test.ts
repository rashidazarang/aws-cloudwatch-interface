import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseRepository } from './repository.js';

function createClientMock() {
  const insertLogs = vi.fn().mockResolvedValue({ data: null, error: null });
  const purgeSelect = vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null });
  const lt = vi.fn().mockReturnValue({ select: purgeSelect });
  const deleteLogs = vi.fn().mockReturnValue({ lt });

  const insertSavedSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'saved-1',
      user_id: 'user-1',
      name: 'Errors',
      log_group: '/aws/lambda/example',
      query_string: 'fields @timestamp',
      description: null,
      tags: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  });
  const insertSavedSelect = vi.fn().mockReturnValue({ single: insertSavedSingle });
  const insertSaved = vi.fn().mockReturnValue({ select: insertSavedSelect });

  const savedOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const savedSelectBuilder = {
    eq: vi.fn().mockReturnThis(),
    order: savedOrder,
  };
  const selectSaved = vi.fn().mockReturnValue(savedSelectBuilder);

  const deleteSavedFinal = vi.fn().mockResolvedValue({ error: null });
  const deleteSavedSecond = vi.fn().mockImplementation(() => deleteSavedFinal());
  const deleteSavedFirst = vi.fn().mockReturnValue({ eq: deleteSavedSecond });
  const deleteSaved = vi.fn().mockReturnValue({ eq: deleteSavedFirst });

  const selectProfileSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'user-1',
      email: 'user@example.com',
      display_name: 'User',
      role: 'member',
      created_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  });

  const profileEq = vi.fn().mockReturnValue({ single: selectProfileSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'cloudwatch_logs':
        return {
          insert: insertLogs,
          delete: deleteLogs,
        } as unknown as ReturnType<SupabaseClient['from']>;
      case 'saved_queries':
        return {
          insert: insertSaved,
          select: selectSaved,
          delete: deleteSaved,
        } as unknown as ReturnType<SupabaseClient['from']>;
      case 'profiles':
        return { select: profileSelect } as unknown as ReturnType<SupabaseClient['from']>;
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  });

  const client = { from } as unknown as SupabaseClient;

  return {
    client,
    insertLogs,
    purgeSelect,
    savedOrder,
    deleteSavedFinal,
    insertSaved,
    insertSavedSelect,
    insertSavedSingle,
    selectSaved,
    selectProfileSingle,
  };
}

describe('SupabaseRepository', () => {
  it('deduplicates log records before insert and enforces retention', async () => {
    const { client, insertLogs, purgeSelect } = createClientMock();
    const repo = new SupabaseRepository(client);

    const baseTimestamp = new Date('2024-05-01T00:00:00Z');

    const result = await repo.insertLogRecords(
      [
        {
          logGroup: '/aws/lambda/example',
          timestamp: baseTimestamp,
          message: 'Hello world',
        },
        {
          logGroup: '/aws/lambda/example',
          timestamp: baseTimestamp,
          message: 'Hello world',
        },
      ],
      { retentionDays: 30 },
    );

    expect(insertLogs).toHaveBeenCalledTimes(1);
    expect(purgeSelect).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ insertedCount: 1, deduplicatedCount: 1, deletedOldCount: 1 });
  });

  it('returns saved query payload', async () => {
    const { client, insertSaved, insertSavedSelect, insertSavedSingle, selectSaved, savedOrder } = createClientMock();
    const repo = new SupabaseRepository(client);

    const saved = await repo.createSavedQuery({
      userId: 'user-1',
      name: 'Errors',
      logGroup: '/aws/lambda/example',
      queryString: 'fields @timestamp',
    });

    expect(insertSaved).toHaveBeenCalledOnce();
    expect(insertSavedSelect).toHaveBeenCalledOnce();
    expect(insertSavedSingle).toHaveBeenCalledOnce();
    expect(saved.id).toBe('saved-1');

    const list = await repo.listSavedQueries('user-1');
    expect(selectSaved).toHaveBeenCalledOnce();
    expect(savedOrder).toHaveBeenCalledOnce();
    expect(Array.isArray(list)).toBe(true);
  });

  it('fetches profile records by id', async () => {
    const { client, selectProfileSingle } = createClientMock();
    const repo = new SupabaseRepository(client);

    const profile = await repo.getProfileById('user-1');

    expect(selectProfileSingle).toHaveBeenCalledOnce();
    expect(profile).toMatchObject({ id: 'user-1', role: 'member' });
  });

  it('deletes saved query scoped to user', async () => {
    const { client, deleteSavedFinal } = createClientMock();
    const repo = new SupabaseRepository(client);

    await repo.deleteSavedQuery('saved-1', 'user-1');

    expect(deleteSavedFinal).toHaveBeenCalledOnce();
  });
});
