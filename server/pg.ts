import type { DataStore } from './store.js';
import type {
  Feedback,
  MigrationStatus,
  Session,
  TrainingGoal,
  TrainingRecord,
  User,
} from './types.js';

/**
 * PostgreSQL 访问层（PostgREST 协议）。
 *
 * 同一套代码对接两种 HTTP 网关，协议一致，只有地址与鉴权头不同：
 *   - Supabase：https://{ref}.supabase.co/rest/v1（需要 apikey + Authorization 两个头）
 *   - 云开发：https://{envId}.api.tcloudbasegateway.com/v1/rdb/rest（只需 Authorization）
 *
 * 请求形态：
 *   GET    {base}/{table}?select=*&col=eq.value
 *   POST   {base}/{table}                （Prefer: return=representation[,resolution=merge-duplicates]）
 *   PATCH  {base}/{table}?col=eq.value    （必须带过滤条件）
 *   DELETE {base}/{table}?col=eq.value    （必须带过滤条件）
 *
 * 鉴权：Bearer <服务端密钥>（service_role，绕过 RLS）。该密钥只能留在服务端，
 * 绝不能下发到浏览器，否则等同于把整库读写权限交出去。
 */

/** PostgREST 过滤表达式，例如 { id: 'eq.xxx', deleted_at: 'is.null' }。 */
export type PgFilter = Record<string, string>;

const eq = (value: string | number | boolean | null): string =>
  value === null ? 'is.null' : `eq.${value}`;

export class PgRestError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = 'PgRestError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export interface PgRestOptions {
  baseUrl: string;
  apiKey: string;
  /** 额外请求头（Supabase 需要同时带 apikey）。 */
  extraHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface PgQueryOptions {
  select?: string;
  order?: string;
  limit?: number;
}

export class PgRest {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PgRestOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private buildUrl(table: string, params: URLSearchParams): string {
    const base = this.options.baseUrl.replace(/\/+$/, '');
    const query = params.toString();
    return `${base}/${encodeURIComponent(table)}${query ? `?${query}` : ''}`;
  }

  private async send<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    prefer?: string,
  ): Promise<T[]> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      'Content-Type': 'application/json',
      ...this.options.extraHeaders,
    };
    if (prefer) headers.Prefer = prefer;

    const response = await this.fetchImpl(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();
    if (!response.ok) {
      let code = 'PG_REQUEST_FAILED';
      let message = text;
      try {
        const parsed = JSON.parse(text) as { code?: string; message?: string };
        if (parsed.code) code = parsed.code;
        if (parsed.message) message = parsed.message;
      } catch {
        /* 保留原始文本 */
      }
      throw new PgRestError(response.status, code, message || `PostgreSQL 请求失败（${response.status}）`);
    }

    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as T | T[];
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  async select<T>(table: string, filter: PgFilter = {}, options: PgQueryOptions = {}): Promise<T[]> {
    const params = new URLSearchParams();
    params.set('select', options.select ?? '*');
    for (const [column, expression] of Object.entries(filter)) params.set(column, expression);
    if (options.order) params.set('order', options.order);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    return this.send<T>('GET', this.buildUrl(table, params));
  }

  async insert<T>(
    table: string,
    row: Record<string, unknown>,
    upsert?: 'merge' | 'ignore',
    onConflict?: string,
  ): Promise<T[]> {
    const params = new URLSearchParams({ select: '*' });
    // PostgREST 的 upsert 需要冲突目标列，缺省时以主键为准。
    if (onConflict) params.set('on_conflict', onConflict);
    const prefer = ['return=representation'];
    if (upsert === 'merge') prefer.push('resolution=merge-duplicates');
    if (upsert === 'ignore') prefer.push('resolution=ignore-duplicates');
    return this.send<T>('POST', this.buildUrl(table, params), row, prefer.join(','));
  }

  async patch<T>(table: string, filter: PgFilter, patchBody: Record<string, unknown>): Promise<T[]> {
    assertFilter('PATCH', table, filter);
    const params = new URLSearchParams({ select: '*' });
    for (const [column, expression] of Object.entries(filter)) params.set(column, expression);
    return this.send<T>('PATCH', this.buildUrl(table, params), patchBody, 'return=representation');
  }

  async remove(table: string, filter: PgFilter): Promise<void> {
    assertFilter('DELETE', table, filter);
    const params = new URLSearchParams();
    for (const [column, expression] of Object.entries(filter)) params.set(column, expression);
    await this.send('DELETE', this.buildUrl(table, params));
  }
}

/** 云开发网关要求更新 / 删除必须带 WHERE，避免整表误操作。 */
function assertFilter(operation: string, table: string, filter: PgFilter): void {
  if (Object.keys(filter).length === 0) {
    throw new PgRestError(400, 'FILTER_REQUIRED', `${operation} ${table} 需要至少一个过滤条件`);
  }
}

interface UserRow {
  id: string;
  username: string;
  normalized_username: string;
  password_hash: string;
  status: string;
  profile: User['profile'];
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  access_token: string;
  refresh_token: string;
  user_id: string;
  access_expires_at: string;
  refresh_expires_at: string;
  revoked_at: string | null;
}

interface TrainingRecordRow {
  id: string;
  user_id: string;
  client_record_id: string | null;
  occurred_at: string;
  duration_minutes: number;
  focus: string;
  mood: string;
  self_rating: number;
  energy_level: number;
  notes: string | null;
  location: string | null;
  partner: string | null;
  weather: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TrainingGoalRow {
  user_id: string;
  weekly_target_count: number;
  monthly_target_count: number;
  week_starts_on: number;
  timezone: string;
  version: number;
  updated_at: string;
}

interface FeedbackRow {
  id: string;
  user_id: string;
  content: string;
  status: string;
  created_at: string;
}

interface MigrationStatusRow {
  user_id: string;
  completed: boolean;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  last_migrated_at: string | null;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  normalizedUsername: row.normalized_username,
  passwordHash: row.password_hash,
  status: row.status as User['status'],
  profile: row.profile,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromUser = (user: User): Record<string, unknown> => ({
  id: user.id,
  username: user.username,
  normalized_username: user.normalizedUsername,
  password_hash: user.passwordHash,
  status: user.status,
  profile: user.profile,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});

const toSession = (row: SessionRow): Session => ({
  accessToken: row.access_token,
  refreshToken: row.refresh_token,
  userId: row.user_id,
  accessExpiresAt: row.access_expires_at,
  refreshExpiresAt: row.refresh_expires_at,
  revokedAt: row.revoked_at,
});

const fromSession = (session: Session): Record<string, unknown> => ({
  access_token: session.accessToken,
  refresh_token: session.refreshToken,
  user_id: session.userId,
  access_expires_at: session.accessExpiresAt,
  refresh_expires_at: session.refreshExpiresAt,
  revoked_at: session.revokedAt,
});

const toTrainingRecord = (row: TrainingRecordRow): TrainingRecord => ({
  id: row.id,
  userId: row.user_id,
  clientRecordId: row.client_record_id,
  occurredAt: row.occurred_at,
  durationMinutes: row.duration_minutes,
  focus: row.focus,
  mood: row.mood as TrainingRecord['mood'],
  selfRating: row.self_rating,
  energyLevel: row.energy_level,
  notes: row.notes,
  location: row.location,
  partner: row.partner,
  weather: row.weather,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const fromTrainingRecord = (record: TrainingRecord): Record<string, unknown> => ({
  id: record.id,
  user_id: record.userId,
  client_record_id: record.clientRecordId,
  occurred_at: record.occurredAt,
  duration_minutes: record.durationMinutes,
  focus: record.focus,
  mood: record.mood,
  self_rating: record.selfRating,
  energy_level: record.energyLevel,
  notes: record.notes,
  location: record.location,
  partner: record.partner,
  weather: record.weather,
  version: record.version,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
  deleted_at: record.deletedAt,
});

const toTrainingGoal = (row: TrainingGoalRow): TrainingGoal => ({
  userId: row.user_id,
  weeklyTargetCount: row.weekly_target_count,
  monthlyTargetCount: row.monthly_target_count,
  weekStartsOn: row.week_starts_on as TrainingGoal['weekStartsOn'],
  timezone: row.timezone,
  version: row.version,
  updatedAt: row.updated_at,
});

const fromTrainingGoal = (goal: TrainingGoal): Record<string, unknown> => ({
  user_id: goal.userId,
  weekly_target_count: goal.weeklyTargetCount,
  monthly_target_count: goal.monthlyTargetCount,
  week_starts_on: goal.weekStartsOn,
  timezone: goal.timezone,
  version: goal.version,
  updated_at: goal.updatedAt,
});

const toMigrationStatus = (row: MigrationStatusRow): MigrationStatus => ({
  userId: row.user_id,
  completed: row.completed,
  importedCount: row.imported_count,
  skippedCount: row.skipped_count,
  failedCount: row.failed_count,
  lastMigratedAt: row.last_migrated_at,
});

const fromMigrationStatus = (status: MigrationStatus): Record<string, unknown> => ({
  user_id: status.userId,
  completed: status.completed,
  imported_count: status.importedCount,
  skipped_count: status.skippedCount,
  failed_count: status.failedCount,
  last_migrated_at: status.lastMigratedAt,
});

/** 基于 CloudBase PostgreSQL 的 DataStore 实现。 */
export class PgStore implements DataStore {
  constructor(private readonly rest: PgRest) {}

  async findUserById(id: string): Promise<User | null> {
    const rows = await this.rest.select<UserRow>('users', { id: eq(id) }, { limit: 1 });
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findUserByNormalizedUsername(normalizedUsername: string): Promise<User | null> {
    const rows = await this.rest.select<UserRow>(
      'users',
      { normalized_username: eq(normalizedUsername) },
      { limit: 1 },
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async createUser(user: User): Promise<void> {
    await this.rest.insert<UserRow>('users', fromUser(user));
  }

  async updateUser(user: User): Promise<void> {
    await this.rest.patch<UserRow>('users', { id: eq(user.id) }, fromUser(user));
  }

  async createSession(session: Session): Promise<void> {
    await this.rest.insert<SessionRow>('sessions', fromSession(session));
  }

  async findSessionByAccessToken(accessToken: string): Promise<Session | null> {
    const rows = await this.rest.select<SessionRow>(
      'sessions',
      { access_token: eq(accessToken) },
      { limit: 1 },
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const rows = await this.rest.select<SessionRow>(
      'sessions',
      { refresh_token: eq(refreshToken) },
      { limit: 1 },
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  async revokeSession(accessToken: string, revokedAt: string): Promise<void> {
    await this.rest.patch<SessionRow>(
      'sessions',
      { access_token: eq(accessToken) },
      { revoked_at: revokedAt },
    );
  }

  async createTrainingRecord(record: TrainingRecord): Promise<void> {
    await this.rest.insert<TrainingRecordRow>('training_records', fromTrainingRecord(record));
  }

  async findTrainingRecordById(id: string, userId: string): Promise<TrainingRecord | null> {
    const rows = await this.rest.select<TrainingRecordRow>(
      'training_records',
      { id: eq(id), user_id: eq(userId) },
      { limit: 1 },
    );
    return rows[0] ? toTrainingRecord(rows[0]) : null;
  }

  async findTrainingRecordByClientId(userId: string, clientRecordId: string): Promise<TrainingRecord | null> {
    const rows = await this.rest.select<TrainingRecordRow>(
      'training_records',
      { user_id: eq(userId), client_record_id: eq(clientRecordId) },
      { limit: 1 },
    );
    return rows[0] ? toTrainingRecord(rows[0]) : null;
  }

  async listTrainingRecords(userId: string): Promise<TrainingRecord[]> {
    const rows = await this.rest.select<TrainingRecordRow>(
      'training_records',
      { user_id: eq(userId), deleted_at: 'is.null' },
      { order: 'occurred_at.desc' },
    );
    return rows.map(toTrainingRecord);
  }

  async updateTrainingRecord(record: TrainingRecord): Promise<void> {
    await this.rest.patch<TrainingRecordRow>(
      'training_records',
      { id: eq(record.id), user_id: eq(record.userId) },
      fromTrainingRecord(record),
    );
  }

  async findTrainingGoal(userId: string): Promise<TrainingGoal | null> {
    const rows = await this.rest.select<TrainingGoalRow>(
      'training_goals',
      { user_id: eq(userId) },
      { limit: 1 },
    );
    return rows[0] ? toTrainingGoal(rows[0]) : null;
  }

  async saveTrainingGoal(goal: TrainingGoal): Promise<void> {
    await this.rest.insert<TrainingGoalRow>('training_goals', fromTrainingGoal(goal), 'merge');
  }

  async createFeedback(feedback: Feedback): Promise<void> {
    await this.rest.insert<FeedbackRow>('feedback', {
      id: feedback.id,
      user_id: feedback.userId,
      content: feedback.content,
      status: feedback.status,
      created_at: feedback.createdAt,
    });
  }

  async countFeedbackSince(userId: string, sinceIso: string): Promise<number> {
    const rows = await this.rest.select<{ id: string }>(
      'feedback',
      { user_id: eq(userId), created_at: `gte.${sinceIso}` },
      { select: 'id' },
    );
    return rows.length;
  }

  async findMigrationStatus(userId: string): Promise<MigrationStatus | null> {
    const rows = await this.rest.select<MigrationStatusRow>(
      'migration_status',
      { user_id: eq(userId) },
      { limit: 1 },
    );
    return rows[0] ? toMigrationStatus(rows[0]) : null;
  }

  async saveMigrationStatus(status: MigrationStatus): Promise<void> {
    await this.rest.insert<MigrationStatusRow>(
      'migration_status',
      fromMigrationStatus(status),
      'merge',
    );
  }
}

export interface PgStoreConfig {
  envId?: string;
  apiKey: string;
  /** 自定义网关地址（如需指定实例 / schema 时覆盖）。 */
  baseUrl?: string;
}

export const DEFAULT_PG_GATEWAY_PATH = '/v1/rdb/rest';

export function createPgStore(config: PgStoreConfig): PgStore {
  const base =
    config.baseUrl ??
    (config.envId
      ? `https://${config.envId}.api.tcloudbasegateway.com${DEFAULT_PG_GATEWAY_PATH}`
      : undefined);
  if (!base) {
    throw new Error('创建 PgStore 需要提供 CLOUDBASE_ENV_ID 或 CLOUDBASE_PG_BASE_URL');
  }
  return new PgStore(new PgRest({ baseUrl: base, apiKey: config.apiKey }));
}

export interface SupabaseStoreConfig {
  /** 项目地址，形如 https://abcdefghijk.supabase.co */
  url: string;
  /** service_role / secret key，仅在服务端使用。 */
  serviceRoleKey: string;
}

/**
 * Supabase 的 PostgREST 端点位于 `{url}/rest/v1`，
 * 且网关要求请求同时带 `apikey` 与 `Authorization` 两个头。
 */
export function createSupabaseStore(config: SupabaseStoreConfig): PgStore {
  const baseUrl = `${config.url.replace(/\/+$/, '')}/rest/v1`;
  return new PgStore(
    new PgRest({
      baseUrl,
      apiKey: config.serviceRoleKey,
      extraHeaders: { apikey: config.serviceRoleKey },
    }),
  );
}
