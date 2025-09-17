import {
  createCloudWatchServiceFromEnv,
  createSupabaseAuthServiceFromEnv,
  createSupabaseRepositoryFromEnv,
} from '@aws-cloudwatch-interface/services';

let cloudwatchSingleton: ReturnType<typeof createCloudWatchServiceFromEnv> | undefined;
let supabaseSingleton: ReturnType<typeof createSupabaseRepositoryFromEnv> | undefined;
let authSingleton: ReturnType<typeof createSupabaseAuthServiceFromEnv> | undefined;

export function getCloudWatchService() {
  if (!cloudwatchSingleton) {
    cloudwatchSingleton = createCloudWatchServiceFromEnv();
  }
  return cloudwatchSingleton;
}

export function getSupabaseRepository() {
  if (!supabaseSingleton) {
    supabaseSingleton = createSupabaseRepositoryFromEnv();
  }

  return supabaseSingleton;
}

export function getSupabaseAuthService() {
  if (!authSingleton) {
    authSingleton = createSupabaseAuthServiceFromEnv();
  }

  return authSingleton;
}
