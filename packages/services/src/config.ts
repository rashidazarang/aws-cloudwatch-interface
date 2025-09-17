import type { CloudWatchLogsClientConfig } from '@aws-sdk/client-cloudwatch-logs';

import { CloudWatchService } from './aws/cloudwatch-client.js';
import { SupabaseAuthService } from './supabase/auth-service.js';
import { SupabaseRepository } from './supabase/repository.js';

export function createCloudWatchServiceFromEnv(overrides: CloudWatchLogsClientConfig = {}) {
  const region = process.env.AWS_REGION ?? overrides.region;
  if (!region) {
    throw new Error('AWS_REGION must be set to initialise CloudWatch');
  }

  const credentials = extractCredentialsFromEnv();

  return new CloudWatchService({
    region,
    credentials,
    ...overrides,
  });
}

export function createSupabaseRepositoryFromEnv() {
  const config = resolveSupabaseConfig();
  return SupabaseRepository.fromServiceRole(config);
}

export function createSupabaseAuthServiceFromEnv() {
  const config = resolveSupabaseConfig();
  return SupabaseAuthService.fromServiceRole(config);
}

function extractCredentialsFromEnv() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  const sessionToken = process.env.AWS_SESSION_TOKEN;
  return sessionToken ? { accessKeyId, secretAccessKey, sessionToken } : { accessKeyId, secretAccessKey };
}

function resolveSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return { url, serviceRoleKey } as const;
}
