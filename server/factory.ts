import { resolve } from 'node:path';
import { createPgStore, createSupabaseStore } from './pg.js';
import { JsonFileStore, type DataStore } from './store.js';

export type StoreDriver = 'supabase' | 'pg' | 'json';

export interface StoreFactoryOptions {
  env?: NodeJS.ProcessEnv;
  /** 未配置数据库时使用的 JSON 文件路径。 */
  defaultDataFile?: string;
}

/**
 * 按环境变量决定数据存储驱动：
 *   1. supabase — SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY（推荐，免费额度足够个人使用）
 *   2. pg       — CLOUDBASE_ENV_ID + CLOUDBASE_API_KEY（云开发 PostgreSQL）
 *   3. json     — 本地 JSON 文件，仅限本地开发 / 测试
 * 显式设置 DATA_STORE 时以它为准，否则按凭据自动判断。
 */
export function resolveStoreDriver(env: NodeJS.ProcessEnv = process.env): StoreDriver {
  const requested = (env.DATA_STORE ?? '').trim().toLowerCase();
  if (requested === 'supabase' || requested === 'pg' || requested === 'json') return requested;

  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim();
  if (env.SUPABASE_URL?.trim() && supabaseKey) return 'supabase';

  if (env.CLOUDBASE_API_KEY?.trim() && (env.CLOUDBASE_ENV_ID?.trim() || env.CLOUDBASE_PG_BASE_URL?.trim())) {
    return 'pg';
  }

  return 'json';
}

export function createStoreFromEnv(options: StoreFactoryOptions = {}): DataStore {
  const env = options.env ?? process.env;
  const driver = resolveStoreDriver(env);

  if (driver === 'supabase') {
    const url = env.SUPABASE_URL?.trim();
    const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? '').trim();
    if (!url || !serviceRoleKey) {
      throw new Error('DATA_STORE=supabase 需要同时设置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY');
    }
    return createSupabaseStore({ url, serviceRoleKey });
  }

  if (driver === 'pg') {
    const apiKey = env.CLOUDBASE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('DATA_STORE=pg 需要设置 CLOUDBASE_API_KEY（服务端 API Key）');
    }
    return createPgStore({
      apiKey,
      envId: env.CLOUDBASE_ENV_ID?.trim() || undefined,
      baseUrl: env.CLOUDBASE_PG_BASE_URL?.trim() || undefined,
    });
  }

  // Serverless / 容器实例的本地磁盘不持久化，生产环境必须显式接数据库。
  if (env.NODE_ENV === 'production' && !env.DATA_STORE?.trim()) {
    throw new Error('生产环境必须配置数据库：请设置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY');
  }

  const dataFile =
    env.DATA_FILE?.trim() || options.defaultDataFile || resolve(process.cwd(), 'data', 'tennis-tracker.json');
  return new JsonFileStore(dataFile);
}
