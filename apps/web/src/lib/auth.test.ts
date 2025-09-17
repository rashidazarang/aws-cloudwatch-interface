import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services', () => ({
  getSupabaseAuthService: vi.fn(),
}));

import { getSupabaseAuthService } from './services';
import { requireSupabaseUser } from './auth';

const mockedGetSupabaseAuthService = vi.mocked(getSupabaseAuthService);

describe('requireSupabaseUser', () => {
  beforeEach(() => {
    mockedGetSupabaseAuthService.mockReset();
  });

  it('rejects unsupported methods', async () => {
    const result = await requireSupabaseUser(new Request('http://localhost', { method: 'PUT' }), ['GET']);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(405);
  });

  it('requires bearer token', async () => {
    const result = await requireSupabaseUser(new Request('http://localhost'), ['GET']);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('returns user when token valid', async () => {
    const mockAuth = {
      getUserFromAccessToken: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'member' }),
    };
    mockedGetSupabaseAuthService.mockReturnValue(mockAuth as never);

    const result = await requireSupabaseUser(
      new Request('http://localhost', {
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
      ['GET'],
    );

    expect(mockAuth.getUserFromAccessToken).toHaveBeenCalledWith('token-123');
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.user.id).toBe('user-1');
    }
  });

  it('returns 401 when auth service throws', async () => {
    const mockAuth = {
      getUserFromAccessToken: vi.fn().mockRejectedValue(new Error('invalid token')),
    };
    mockedGetSupabaseAuthService.mockReturnValue(mockAuth as never);

    const result = await requireSupabaseUser(
      new Request('http://localhost', {
        headers: {
          authorization: 'Bearer bad',
        },
      }),
      ['GET'],
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
