import type { CloudWatchLogsClientConfig } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchService } from './aws/cloudwatch-client.js';
import { SupabaseAuthService } from './supabase/auth-service.js';
import { SupabaseRepository } from './supabase/repository.js';
export declare function createCloudWatchServiceFromEnv(overrides?: CloudWatchLogsClientConfig): CloudWatchService;
export declare function createSupabaseRepositoryFromEnv(): SupabaseRepository;
export declare function createSupabaseAuthServiceFromEnv(): SupabaseAuthService;
