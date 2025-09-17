import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAuthService } from './auth-service.js';

function createMockClient() {
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
      },
    },
    error: null,
  });

  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'user-1',
      email: 'user@example.com',
      display_name: 'User',
      role: 'member',
      created_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  });

  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });

  const from = vi.fn().mockImplementation(() => ({ select }));

  const client = {
    auth: { getUser },
    from,
  } as unknown as SupabaseClient;

  return { client, getUser, single };
}

describe('SupabaseAuthService', () => {
  it('retrieves user profile from access token', async () => {
    const { client, getUser, single } = createMockClient();
    const service = new SupabaseAuthService(client);

    const user = await service.getUserFromAccessToken('token');

    expect(getUser).toHaveBeenCalledWith('token');
    expect(single).toHaveBeenCalledOnce();
    expect(user).toMatchObject({ id: 'user-1', email: 'user@example.com', role: 'member' });
  });

  it('throws when token invalid', async () => {
    const { client } = createMockClient();
    client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const service = new SupabaseAuthService(client);

    await expect(service.getUserFromAccessToken('bad')).rejects.toThrow('Unable to authenticate request');
  });
});
