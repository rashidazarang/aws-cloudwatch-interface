import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ProfileRecord } from './repository.js';
import { SupabaseRepository } from './repository.js';

export interface SupabaseAuthConfig {
  url: string;
  serviceRoleKey: string;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: ProfileRecord['role'];
  profile: ProfileRecord;
}

export class SupabaseAuthService {
  private readonly repository: SupabaseRepository;

  constructor(private readonly client: SupabaseClient) {
    this.repository = SupabaseRepository.fromClient(client);
  }

  static fromServiceRole(config: SupabaseAuthConfig) {
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return new SupabaseAuthService(client);
  }

  async getUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error || !data?.user) {
      throw new Error('Unable to authenticate request');
    }

    const profile = await this.repository.getProfileById(data.user.id);

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: profile.role,
      profile,
    };
  }
}
