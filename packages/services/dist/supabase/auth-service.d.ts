import { type SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRecord } from './repository.js';
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
export declare class SupabaseAuthService {
    private readonly client;
    private readonly repository;
    constructor(client: SupabaseClient);
    static fromServiceRole(config: SupabaseAuthConfig): SupabaseAuthService;
    getUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser>;
}
