import { createClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './repository.js';
export class SupabaseAuthService {
    client;
    repository;
    constructor(client) {
        this.client = client;
        this.repository = SupabaseRepository.fromClient(client);
    }
    static fromServiceRole(config) {
        const client = createClient(config.url, config.serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
        return new SupabaseAuthService(client);
    }
    async getUserFromAccessToken(accessToken) {
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
//# sourceMappingURL=auth-service.js.map