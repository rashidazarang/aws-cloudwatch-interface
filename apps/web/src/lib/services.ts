import { CloudWatchService, SupabaseAuthService, SupabaseRepository } from '@aws-cloudwatch-interface/services';
import type { CloudWatchLogsClientConfig } from '@aws-sdk/client-cloudwatch-logs';

let cloudwatchSingleton: CloudWatchService | undefined;
let supabaseSingleton: SupabaseRepository | undefined;
let authSingleton: SupabaseAuthService | undefined;

export function getCloudWatchService() {
  if (!cloudwatchSingleton) {
    cloudwatchSingleton = new CloudWatchService(resolveCloudWatchConfig());
  }
  return cloudwatchSingleton;
}

export function getSupabaseRepository() {
  if (!supabaseSingleton) {
    supabaseSingleton = SupabaseRepository.fromServiceRole(resolveSupabaseConfig());
  }

  return supabaseSingleton;
}

export function getSupabaseAuthService() {
  if (!authSingleton) {
    authSingleton = SupabaseAuthService.fromServiceRole(resolveSupabaseConfig());
  }

  return authSingleton;
}

function resolveCloudWatchConfig(): CloudWatchLogsClientConfig {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error('AWS_REGION must be set in the environment');
  }

  const credentials = extractCredentials();
  return credentials ? { region, credentials } : { region };
}

function extractCredentials() {
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
    throw new Error('Supabase credentials are missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey };
}
