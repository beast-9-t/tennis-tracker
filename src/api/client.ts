const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

let accessToken = '';
let refreshPromise: Promise<boolean> | null = null;
let currentUsername = '';

function setAccessToken(token: string) {
  accessToken = token;
}

/**
 * 兜底错误文案。
 * 关键点：当后端函数根本没部署时，平台会返回 HTML 形式的 404（X-Vercel-Error: NOT_FOUND），
 * 响应体不是 JSON，此时若只提示「请求失败，请稍后重试」会把「接口不存在」误报成「偶发失败」。
 * 这里带上状态码，404 额外给出可自查的地址。
 */
function fallbackMessage(response: Response, body: ApiErrorBody) {
  if (body.error?.message) return body.error.message;
  if (response.status === 404) return '接口不存在（HTTP 404），后端服务未部署，请先访问 /api/v1/health 自检';
  return `请求失败（HTTP ${response.status}），请稍后重试`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { data?: T } & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code || (response.status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED'),
      fallbackMessage(response, body),
    );
  }
  return body.data as T;
}

async function parsePageResponse<T>(response: Response): Promise<{ data: T; page: { nextCursor: string | null; hasMore: boolean } }> {
  const body = await response.json().catch(() => ({})) as {
    data?: T;
    page?: { nextCursor: string | null; hasMore: boolean };
  } & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.code || 'REQUEST_FAILED', fallbackMessage(response, body));
  }
  return { data: body.data as T, page: body.page ?? { nextCursor: null, hasMore: false } };
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = await parseResponse<{ accessToken: string }>(response);
        setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) return apiRequest<T>(path, init, false);
  }
  return parseResponse<T>(response);
}

async function apiPageRequest<T>(path: string, retry = true) {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' });
  if (response.status === 401 && retry && await refreshAccessToken()) return apiPageRequest<T>(path, false);
  return parsePageResponse<T>(response);
}

export const authApi = {
  async register(username: string, password: string) {
    const data = await apiRequest<{ accessToken: string; user: { username: string } }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    setAccessToken(data.accessToken);
    currentUsername = data.user.username;
    return data.user;
  },
  async login(username: string, password: string) {
    const data = await apiRequest<{ accessToken: string; user: { username: string } }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    setAccessToken(data.accessToken);
    currentUsername = data.user.username;
    return data.user;
  },
  async restoreSession() {
    if (!(await refreshAccessToken())) return null;
    const user = await apiRequest<{ username: string }>('/auth/me');
    currentUsername = user.username;
    return user;
  },
  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' }, false);
    } finally {
      setAccessToken('');
      currentUsername = '';
    }
  },
  getCurrentUsername() {
    return currentUsername;
  },
};

interface ApiTrainingRecord {
  id: string;
  occurredAt: string;
  durationMinutes: number;
  focus: string;
  mood: 'excellent' | 'good' | 'normal' | 'tired' | 'exhausted';
  selfRating: number;
  energyLevel: number;
  notes: string | null;
  location: string | null;
  partner: string | null;
  weather: string | null;
  version: number;
}

export interface ClientTrainingRecord {
  id: string;
  date: Date;
  duration: number;
  focus: string;
  mood: ApiTrainingRecord['mood'];
  selfRating: number;
  energyLevel: number;
  notes?: string;
  location?: string;
  partner?: string;
  weather?: string;
  version: number;
}

function toClientRecord(record: ApiTrainingRecord): ClientTrainingRecord {
  return {
    id: record.id,
    date: new Date(record.occurredAt),
    duration: record.durationMinutes,
    focus: record.focus,
    mood: record.mood,
    selfRating: record.selfRating,
    energyLevel: record.energyLevel,
    notes: record.notes ?? undefined,
    location: record.location ?? undefined,
    partner: record.partner ?? undefined,
    weather: record.weather ?? undefined,
    version: record.version,
  };
}

export const recordsApi = {
  async listPage(params: { startAt?: string; endAt?: string; limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    query.set('limit', String(params.limit ?? 20));
    if (params.startAt) query.set('startAt', params.startAt);
    if (params.endAt) query.set('endAt', params.endAt);
    if (params.cursor) query.set('cursor', params.cursor);
    const result = await apiPageRequest<ApiTrainingRecord[]>(`/training-records?${query}`);
    return { data: result.data.map(toClientRecord), page: result.page };
  },
  async list(params: { startAt?: string; endAt?: string; limit?: number } = {}) {
    return (await this.listPage({ ...params, limit: params.limit ?? 100 })).data;
  },
  async create(record: Omit<ClientTrainingRecord, 'id' | 'version'>) {
    const created = await apiRequest<ApiTrainingRecord>('/training-records', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        occurredAt: record.date.toISOString(),
        durationMinutes: record.duration,
        focus: record.focus,
        mood: record.mood,
        selfRating: record.selfRating,
        energyLevel: record.energyLevel,
        notes: record.notes || null,
        location: record.location || null,
        partner: record.partner || null,
        weather: record.weather || null,
      }),
    });
    return toClientRecord(created);
  },
  async update(id: string, updates: Partial<ClientTrainingRecord> & { version: number }) {
    const body: Record<string, unknown> = { version: updates.version };
    if (updates.date) body.occurredAt = updates.date.toISOString();
    if (updates.duration !== undefined) body.durationMinutes = updates.duration;
    for (const field of ['focus', 'mood', 'selfRating', 'energyLevel', 'notes', 'location', 'partner', 'weather'] as const) {
      if (field in updates) body[field] = updates[field] || null;
    }
    return toClientRecord(await apiRequest<ApiTrainingRecord>(`/training-records/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }));
  },
  async delete(id: string) {
    return apiRequest<{ deleted: boolean }>(`/training-records/${id}`, { method: 'DELETE' });
  },
};

export interface TrainingGoalDto {
  weeklyTargetCount: number;
  monthlyTargetCount: number;
  weekStartsOn: 1;
  timezone: string;
  version: number;
}

export const goalsApi = {
  getCurrent() {
    return apiRequest<TrainingGoalDto>('/training-goals/current');
  },
  update(goal: Pick<TrainingGoalDto, 'weeklyTargetCount' | 'monthlyTargetCount' | 'timezone' | 'version'>) {
    return apiRequest<TrainingGoalDto>('/training-goals/current', {
      method: 'PUT', body: JSON.stringify(goal),
    });
  },
};

export interface DashboardOverview {
  totalMatches: number;
  totalDurationMinutes: number;
  weeklyMatches: number;
  monthlyMatches: number;
  lastMatch: ClientTrainingRecord | null;
  recentMatches: ClientTrainingRecord[];
  goal: TrainingGoalDto;
}

export const dashboardApi = {
  async getOverview(): Promise<DashboardOverview> {
    const data = await apiRequest<{
      totalMatches: number;
      totalDurationMinutes: number;
      weeklyMatches: number;
      monthlyMatches: number;
      lastMatch: ApiTrainingRecord | null;
      recentMatches: ApiTrainingRecord[];
      goal: TrainingGoalDto;
    }>('/dashboard/overview');
    return {
      ...data,
      lastMatch: data.lastMatch ? toClientRecord(data.lastMatch) : null,
      recentMatches: data.recentMatches.map(toClientRecord),
    };
  },
};

export interface StatisticsSummary {
  totalMatches: number;
  totalDurationMinutes: number;
  averageRating: number;
  averageEnergy: number;
  mostPlayedFocus: string | null;
}

export const statisticsApi = {
  summary(from: string, to: string) {
    const query = new URLSearchParams({ from, to });
    return apiRequest<StatisticsSummary>(`/statistics/summary?${query}`);
  },
  durationTrend(from: string, to: string, bucket: 'day' | 'week' | 'month', timezone = 'Asia/Shanghai') {
    const query = new URLSearchParams({ from, to, bucket, timezone });
    return apiRequest<Array<{ period: string; durationMinutes: number }>>(`/statistics/duration-trend?${query}`);
  },
  moodDistribution(from: string, to: string) {
    const query = new URLSearchParams({ from, to });
    return apiRequest<Array<{ mood: string; count: number; percentage: number }>>(`/statistics/mood-distribution?${query}`);
  },
};

export interface UserProfileDto {
  nickname: string;
  avatarUrl: string | null;
  gender: 'male' | 'female' | 'other' | 'undisclosed';
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  playingYears: number | null;
  level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  phone: string | null;
  email: string | null;
  bio: string;
  timezone: string;
  version: number;
}

export const profileApi = {
  get() {
    return apiRequest<UserProfileDto>('/users/me/profile');
  },
  update(updates: Partial<UserProfileDto> & { version: number }) {
    return apiRequest<UserProfileDto>('/users/me/profile', {
      method: 'PATCH', body: JSON.stringify(updates),
    });
  },
};

export const feedbackApi = {
  submit(content: string) {
    return apiRequest<{ id: string; content: string; status: string; createdAt: string }>('/feedback', {
      method: 'POST', body: JSON.stringify({ content }),
    });
  },
};

export interface MigrationPayload {
  records: Array<Record<string, unknown>>;
  profile?: Record<string, unknown>;
  goal?: Record<string, unknown>;
}

export const migrationApi = {
  status() {
    return apiRequest<{ completed: boolean; importedCount: number; skippedCount: number; failedCount: number }>('/migration/status');
  },
  migrate(payload: MigrationPayload) {
    return apiRequest<{
      completed: boolean;
      batch: { importedCount: number; skippedCount: number; failedCount: number; errors: unknown[] };
    }>('/migration/local-data', { method: 'POST', body: JSON.stringify(payload) });
  },
};
