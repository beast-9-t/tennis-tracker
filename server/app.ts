import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createToken, hashPassword, verifyPassword } from './security.js';
import type { DataStore } from './store.js';
import type { Mood, Session, TrainingGoal, TrainingRecord, User } from './types.js';

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MOODS: Mood[] = ['excellent', 'good', 'normal', 'tired', 'exhausted'];
const FOCUS_OPTIONS = ['正手', '反手', '发球', '截击', '高压球', '接发球', '脚步移动', '战术配合', '体能训练', '综合训练'];
const WEATHER_OPTIONS = ['晴天', '多云', '阴天', '小雨', '大雨', '刮风'];

type AuthenticatedRequest = Request & { user: User; session: Session };

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ field: string; reason: string }>,
  ) {
    super(message);
  }
}

/**
 * 把存储层抛出的错误转换为 HTTP 语义。
 * 存储实现只需附带 `httpStatus` / `code` 字段即可被识别（例如 PG 网关的冲突错误）。
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const candidate = error as { httpStatus?: unknown; code?: unknown; message?: unknown } | null;
  if (candidate && typeof candidate === 'object' && typeof candidate.httpStatus === 'number') {
    const status = candidate.httpStatus;
    const code = typeof candidate.code === 'string' ? candidate.code : 'INTERNAL_ERROR';
    const message = typeof candidate.message === 'string' ? candidate.message : '数据存储请求失败';
    if (status === 409 || code === '23505') {
      return new ApiError(409, 'CONFLICT', '数据已存在或被并发修改，请刷新后重试');
    }
    if (status >= 400 && status < 500) return new ApiError(status, code, message);
    return new ApiError(500, code, message);
  }
  return new ApiError(500, 'INTERNAL_ERROR', '服务器内部错误');
}

function responseData(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data, meta: { requestId: res.locals.requestId } });
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, decodeURIComponent(value.join('='))];
    }),
  );
}

function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    status: user.status,
    profile: user.profile,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validateCredentials(username: unknown, password: unknown) {
  const details: Array<{ field: string; reason: string }> = [];
  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 32) {
    details.push({ field: 'username', reason: '用户名长度必须为 3-32 个字符' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    details.push({ field: 'password', reason: '密码长度必须为 8-128 个字符' });
  }
  if (details.length) throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', details);
}

function validateRecordInput(body: Record<string, unknown>, partial = false) {
  const details: Array<{ field: string; reason: string }> = [];
  const required = ['occurredAt', 'durationMinutes', 'focus', 'mood', 'selfRating', 'energyLevel'];
  if (!partial) {
    required.forEach((field) => {
      if (!(field in body)) details.push({ field, reason: '该字段为必填项' });
    });
  }
  const allowed = new Set([...required, 'notes', 'location', 'partner', 'weather', 'version', 'clientRecordId']);
  Object.keys(body).forEach((field) => {
    if (!allowed.has(field)) details.push({ field, reason: '不允许提交该字段' });
  });
  if ('occurredAt' in body && (typeof body.occurredAt !== 'string' || Number.isNaN(Date.parse(body.occurredAt)))) {
    details.push({ field: 'occurredAt', reason: '必须为有效的 ISO 8601 时间' });
  }
  if ('durationMinutes' in body && (!Number.isInteger(body.durationMinutes) || Number(body.durationMinutes) < 15 || Number(body.durationMinutes) > 300)) {
    details.push({ field: 'durationMinutes', reason: '必须为 15-300 之间的整数' });
  }
  if ('focus' in body && (typeof body.focus !== 'string' || !FOCUS_OPTIONS.includes(body.focus))) {
    details.push({ field: 'focus', reason: '训练重点枚举值无效' });
  }
  if ('mood' in body && (typeof body.mood !== 'string' || !MOODS.includes(body.mood as Mood))) {
    details.push({ field: 'mood', reason: '心情枚举值无效' });
  }
  for (const field of ['selfRating', 'energyLevel'] as const) {
    if (field in body && (!Number.isInteger(body[field]) || Number(body[field]) < 1 || Number(body[field]) > 10)) {
      details.push({ field, reason: '必须为 1-10 之间的整数' });
    }
  }
  for (const [field, max] of [['notes', 2000], ['location', 120], ['partner', 80]] as const) {
    const value = body[field];
    if (field in body && value !== null && (typeof value !== 'string' || value.length > max)) {
      details.push({ field, reason: `必须为不超过 ${max} 个字符的字符串或 null` });
    }
  }
  if ('weather' in body && body.weather !== null && (typeof body.weather !== 'string' || !WEATHER_OPTIONS.includes(body.weather))) {
    details.push({ field: 'weather', reason: '天气枚举值无效' });
  }
  if (details.length) throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', details);
}

async function issueSession(store: DataStore, userId: string): Promise<Session> {
  const now = Date.now();
  const session: Session = {
    accessToken: createToken(),
    refreshToken: createToken(),
    userId,
    accessExpiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS).toISOString(),
    revokedAt: null,
  };
  await store.createSession(session);
  return session;
}

async function getOrCreateGoal(store: DataStore, user: User): Promise<TrainingGoal> {
  const existing = await store.findTrainingGoal(user.id);
  if (existing) return existing;
  const goal: TrainingGoal = {
    userId: user.id,
    weeklyTargetCount: 4,
    monthlyTargetCount: 16,
    weekStartsOn: 1,
    timezone: user.profile.timezone,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await store.saveTrainingGoal(goal);
  return goal;
}

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function zonedMidnightUtc(year: number, month: number, day: number, timezone: string) {
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let index = 0; index < 2; index += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    candidate += target - represented;
  }
  return new Date(candidate);
}

function currentPeriodBounds(timezone: string, now = new Date()) {
  const local = localDateParts(now, timezone);
  const localNoon = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
  const weekday = localNoon.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(Date.UTC(local.year, local.month - 1, local.day + mondayOffset));
  const nextMonday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 7));
  return {
    weekStart: zonedMidnightUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timezone),
    weekEnd: zonedMidnightUtc(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth() + 1, nextMonday.getUTCDate(), timezone),
    monthStart: zonedMidnightUtc(local.year, local.month, 1, timezone),
    monthEnd: zonedMidnightUtc(local.year, local.month + 1, 1, timezone),
  };
}

function recordsInRange(records: TrainingRecord[], from: number, to: number) {
  return records.filter((item) => {
    const occurredAt = Date.parse(item.occurredAt);
    return occurredAt >= from && occurredAt < to;
  });
}

/** 判断浏览器 Origin 是否与当前请求同源（同源的非简单请求同样会带 Origin 头）。 */
function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export interface CreateAppOptions {
  /** 数据存储驱动名，仅用于 /health 自检输出。 */
  storeName?: string;
}

export function createApp(store: DataStore, options: CreateAppOptions = {}) {
  const app = express();
  const storeName = options.storeName ?? 'custom';
  const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();
  const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  );
  app.disable('x-powered-by');
  // 部署在反向代理之后（Vercel 等），让 req.ip 取到真实访客 IP，否则限流会误伤所有用户。
  app.set('trust proxy', true);
  // 部分 Serverless 平台在进入应用前已解析并消费了请求体，
  // 这里标记 _body 让 express.json() 跳过，避免二次读取空流导致 400。
  app.use((req, _res, next) => {
    if (req.body !== undefined) (req as Request & { _body?: boolean })._body = true;
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  // 先校验来源（放行同源与白名单），再补 CORS 响应头。
  app.use((req, _res, next) => {
    const origin = req.header('origin');
    if (
      !origin ||
      isSameOrigin(origin, req.header('host')) ||
      process.env.NODE_ENV !== 'production' ||
      allowedOrigins.has(origin)
    ) {
      return next();
    }
    return next(new ApiError(403, 'FORBIDDEN', '来源站点不在允许列表中'));
  });
  app.use(cors({ credentials: true, origin: true }));
  app.use((req, res, next) => {
    res.locals.requestId = req.header('x-request-id') || randomUUID();
    res.setHeader('x-request-id', res.locals.requestId);
    next();
  });

  const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authorization = req.header('authorization');
      const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
      const candidate = accessToken ? await store.findSessionByAccessToken(accessToken) : null;
      const session = candidate && !candidate.revokedAt && new Date(candidate.accessExpiresAt).getTime() > Date.now()
        ? candidate
        : null;
      const user = session ? await store.findUserById(session.userId) : null;
      if (!session || !user || user.status !== 'active') {
        return next(new ApiError(401, 'UNAUTHENTICATED', '登录状态无效或已过期'));
      }
      (req as AuthenticatedRequest).user = user;
      (req as AuthenticatedRequest).session = session;
      return next();
    } catch (error) {
      return next(error);
    }
  };

  app.get('/api/v1/health', (_req, res) => responseData(res, { status: 'ok', store: storeName }));

  app.post('/api/v1/auth/register', async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      validateCredentials(username, password);
      const registrationKey = req.ip || 'unknown';
      const priorRegistrationAttempts = registrationAttempts.get(registrationKey);
      const registrationBucket = priorRegistrationAttempts && priorRegistrationAttempts.resetAt > Date.now()
        ? priorRegistrationAttempts
        : { count: 0, resetAt: Date.now() + 60 * 60 * 1000 };
      if (registrationBucket.count >= 20) {
        throw new ApiError(429, 'RATE_LIMITED', '注册尝试过于频繁，请稍后再试');
      }
      registrationBucket.count += 1;
      registrationAttempts.set(registrationKey, registrationBucket);
      const normalizedUsername = username.trim().toLocaleLowerCase('en-US');
      if (await store.findUserByNormalizedUsername(normalizedUsername)) {
        throw new ApiError(409, 'CONFLICT', '用户名已存在');
      }

      const now = new Date().toISOString();
      const user: User = {
        id: randomUUID(),
        username: username.trim(),
        normalizedUsername,
        passwordHash: await hashPassword(password),
        status: 'active',
        profile: {
          nickname: username.trim(),
          avatarUrl: null,
          gender: 'undisclosed',
          age: null,
          heightCm: null,
          weightKg: null,
          playingYears: null,
          level: 'beginner',
          phone: null,
          email: null,
          bio: '热爱网球，享受每一次挥拍！',
          timezone: 'Asia/Shanghai',
          version: 1,
        },
        createdAt: now,
        updatedAt: now,
      };
      await store.createUser(user);
      const session = await issueSession(store, user.id);
      res.cookie('tennis_refresh_token', session.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: REFRESH_TTL_MS,
        path: '/api/v1/auth',
      });
      return responseData(res, { accessToken: session.accessToken, user: publicUser(user) }, 201);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/auth/login', async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      validateCredentials(username, password);
      const normalizedUsername = username.trim().toLocaleLowerCase('en-US');
      const attemptKey = `${req.ip}:${normalizedUsername}`;
      const attempt = failedLoginAttempts.get(attemptKey);
      if (attempt && attempt.resetAt > Date.now() && attempt.count >= 5) {
        throw new ApiError(429, 'RATE_LIMITED', '登录尝试过于频繁，请稍后再试');
      }
      const user = await store.findUserByNormalizedUsername(normalizedUsername);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        const current = attempt && attempt.resetAt > Date.now() ? attempt : { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
        current.count += 1;
        failedLoginAttempts.set(attemptKey, current);
        throw new ApiError(401, 'UNAUTHENTICATED', '用户名或密码错误');
      }
      failedLoginAttempts.delete(attemptKey);
      const session = await issueSession(store, user.id);
      res.cookie('tennis_refresh_token', session.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: REFRESH_TTL_MS,
        path: '/api/v1/auth',
      });
      return responseData(res, { accessToken: session.accessToken, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/auth/refresh', async (req, res, next) => {
    try {
      const refreshToken = parseCookies(req.header('cookie')).tennis_refresh_token;
      const candidate = refreshToken ? await store.findSessionByRefreshToken(refreshToken) : null;
      const oldSession = candidate && !candidate.revokedAt && new Date(candidate.refreshExpiresAt).getTime() > Date.now()
        ? candidate
        : null;
      if (!oldSession) throw new ApiError(401, 'UNAUTHENTICATED', '刷新令牌无效或已过期');
      await store.revokeSession(oldSession.accessToken, new Date().toISOString());
      const session = await issueSession(store, oldSession.userId);
      res.cookie('tennis_refresh_token', session.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: REFRESH_TTL_MS,
        path: '/api/v1/auth',
      });
      return responseData(res, { accessToken: session.accessToken });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/auth/logout', authenticate, async (req, res, next) => {
    try {
      await store.revokeSession((req as AuthenticatedRequest).session.accessToken, new Date().toISOString());
      res.clearCookie('tennis_refresh_token', { path: '/api/v1/auth' });
      return responseData(res, { loggedOut: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/auth/me', authenticate, (req, res) => {
    return responseData(res, publicUser((req as AuthenticatedRequest).user));
  });

  app.get('/api/v1/users/me/profile', authenticate, (req, res) => {
    return responseData(res, (req as AuthenticatedRequest).user.profile);
  });

  app.patch('/api/v1/users/me/profile', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const updates = req.body ?? {};
      const allowedFields = new Set([
        'nickname', 'avatarUrl', 'gender', 'age', 'heightCm', 'weightKg',
        'playingYears', 'level', 'phone', 'email', 'bio', 'timezone', 'version',
      ]);
      const unknownField = Object.keys(updates).find((key) => !allowedFields.has(key));
      if (unknownField) {
        throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', [
          { field: unknownField, reason: '不允许更新该字段' },
        ]);
      }
      if (!Number.isInteger(updates.version) || updates.version !== authRequest.user.profile.version) {
        throw new ApiError(409, 'CONFLICT', '个人资料已被更新，请刷新后重试');
      }

      const details: Array<{ field: string; reason: string }> = [];
      if ('nickname' in updates && (typeof updates.nickname !== 'string' || !updates.nickname.trim() || updates.nickname.trim().length > 40)) {
        details.push({ field: 'nickname', reason: '昵称长度必须为 1-40 个字符' });
      }
      if ('gender' in updates && !['male', 'female', 'other', 'undisclosed'].includes(updates.gender)) {
        details.push({ field: 'gender', reason: '性别枚举值无效' });
      }
      if ('level' in updates && !['beginner', 'intermediate', 'advanced', 'professional'].includes(updates.level)) {
        details.push({ field: 'level', reason: '技术水平枚举值无效' });
      }
      for (const [field, min, max] of [
        ['age', 1, 120], ['heightCm', 100, 250], ['weightKg', 30, 200], ['playingYears', 0, 80],
      ] as const) {
        const value = updates[field];
        if (field in updates && value !== null && (typeof value !== 'number' || value < min || value > max)) {
          details.push({ field, reason: `必须为 ${min}-${max} 范围内的数字或 null` });
        }
      }
      if ('email' in updates && updates.email !== null && (typeof updates.email !== 'string' || !/^\S+@\S+\.\S+$/.test(updates.email))) {
        details.push({ field: 'email', reason: '邮箱格式不正确' });
      }
      if ('phone' in updates && updates.phone !== null && (typeof updates.phone !== 'string' || !/^\+?[0-9 -]{6,20}$/.test(updates.phone))) {
        details.push({ field: 'phone', reason: '手机号格式不正确' });
      }
      if ('bio' in updates && (typeof updates.bio !== 'string' || updates.bio.length > 200)) {
        details.push({ field: 'bio', reason: '个人简介不能超过 200 个字符' });
      }
      if ('timezone' in updates && typeof updates.timezone === 'string') {
        try {
          Intl.DateTimeFormat('en-US', { timeZone: updates.timezone });
        } catch {
          details.push({ field: 'timezone', reason: '时区名称无效' });
        }
      }
      if (details.length) throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', details);

      const { version: _version, ...profileUpdates } = updates;
      authRequest.user.profile = {
        ...authRequest.user.profile,
        ...profileUpdates,
        ...(typeof profileUpdates.nickname === 'string' ? { nickname: profileUpdates.nickname.trim() } : {}),
        version: authRequest.user.profile.version + 1,
      };
      authRequest.user.updatedAt = new Date().toISOString();
      await store.updateUser(authRequest.user);
      return responseData(res, authRequest.user.profile);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/training-records', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const body = (req.body ?? {}) as Record<string, unknown>;
      validateRecordInput(body);
      const clientRecordId = String(req.header('idempotency-key') || body.clientRecordId || '').trim() || null;
      if (clientRecordId) {
        const existing = await store.findTrainingRecordByClientId(authRequest.user.id, clientRecordId);
        if (existing) return responseData(res, existing);
      }

      const now = new Date().toISOString();
      const record: TrainingRecord = {
        id: randomUUID(),
        userId: authRequest.user.id,
        clientRecordId,
        occurredAt: new Date(body.occurredAt as string).toISOString(),
        durationMinutes: body.durationMinutes as number,
        focus: body.focus as string,
        mood: body.mood as Mood,
        selfRating: body.selfRating as number,
        energyLevel: body.energyLevel as number,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
        location: typeof body.location === 'string' ? body.location.trim() || null : null,
        partner: typeof body.partner === 'string' ? body.partner.trim() || null : null,
        weather: typeof body.weather === 'string' ? body.weather : null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await store.createTrainingRecord(record);
      return responseData(res, record, 201);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/training-records', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'limit 必须为 1-100 之间的整数');
      }
      const startAt = typeof req.query.startAt === 'string' ? Date.parse(req.query.startAt) : null;
      const endAt = typeof req.query.endAt === 'string' ? Date.parse(req.query.endAt) : null;
      if (startAt !== null && Number.isNaN(startAt)) throw new ApiError(400, 'VALIDATION_ERROR', 'startAt 不是有效时间');
      if (endAt !== null && Number.isNaN(endAt)) throw new ApiError(400, 'VALIDATION_ERROR', 'endAt 不是有效时间');

      const filtered = (await store.listTrainingRecords(authRequest.user.id))
        .filter((item) => !item.deletedAt)
        .filter((item) => startAt === null || Date.parse(item.occurredAt) >= startAt)
        .filter((item) => endAt === null || Date.parse(item.occurredAt) <= endAt)
        .filter((item) => typeof req.query.focus !== 'string' || item.focus === req.query.focus)
        .filter((item) => typeof req.query.mood !== 'string' || item.mood === req.query.mood)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
      let startIndex = 0;
      if (typeof req.query.cursor === 'string') {
        const cursorId = Buffer.from(req.query.cursor, 'base64url').toString('utf8');
        const cursorIndex = filtered.findIndex((item) => item.id === cursorId);
        if (cursorIndex >= 0) startIndex = cursorIndex + 1;
      }
      const items = filtered.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + items.length < filtered.length;
      const nextCursor = hasMore && items.length
        ? Buffer.from(items[items.length - 1].id).toString('base64url')
        : null;
      return res.json({
        data: items,
        page: { nextCursor, hasMore },
        meta: { requestId: res.locals.requestId },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/training-records/:id', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const record = await store.findTrainingRecordById(String(req.params.id), authRequest.user.id);
      if (!record || record.deletedAt) throw new ApiError(404, 'NOT_FOUND', '训练记录不存在');
      return responseData(res, record);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/v1/training-records/:id', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const record = await store.findTrainingRecordById(String(req.params.id), authRequest.user.id);
      if (!record || record.deletedAt) throw new ApiError(404, 'NOT_FOUND', '训练记录不存在');
      const body = (req.body ?? {}) as Record<string, unknown>;
      validateRecordInput(body, true);
      if (!Number.isInteger(body.version) || body.version !== record.version) {
        throw new ApiError(409, 'CONFLICT', '训练记录已被更新，请刷新后重试');
      }
      const mutableFields = ['occurredAt', 'durationMinutes', 'focus', 'mood', 'selfRating', 'energyLevel', 'notes', 'location', 'partner', 'weather'] as const;
      for (const field of mutableFields) {
        if (field in body) (record as unknown as Record<string, unknown>)[field] = body[field];
      }
      if ('occurredAt' in body) record.occurredAt = new Date(body.occurredAt as string).toISOString();
      for (const field of ['notes', 'location', 'partner'] as const) {
        if (field in body && typeof body[field] === 'string') record[field] = body[field].trim() || null;
      }
      record.version += 1;
      record.updatedAt = new Date().toISOString();
      await store.updateTrainingRecord(record);
      return responseData(res, record);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/v1/training-records/:id', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const record = await store.findTrainingRecordById(String(req.params.id), authRequest.user.id);
      if (!record) throw new ApiError(404, 'NOT_FOUND', '训练记录不存在');
      if (!record.deletedAt) {
        record.deletedAt = new Date().toISOString();
        record.updatedAt = record.deletedAt;
        record.version += 1;
        await store.updateTrainingRecord(record);
      }
      return responseData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/training-goals/current', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const goal = await getOrCreateGoal(store, authRequest.user);
      return responseData(res, goal);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/v1/training-goals/current', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { weeklyTargetCount, monthlyTargetCount, timezone, version } = req.body ?? {};
      if (!Number.isInteger(weeklyTargetCount) || weeklyTargetCount < 1 || weeklyTargetCount > 20) {
        throw new ApiError(400, 'VALIDATION_ERROR', '每周目标必须为 1-20 之间的整数');
      }
      if (!Number.isInteger(monthlyTargetCount) || monthlyTargetCount < 1 || monthlyTargetCount > 100) {
        throw new ApiError(400, 'VALIDATION_ERROR', '每月目标必须为 1-100 之间的整数');
      }
      try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone });
      } catch {
        throw new ApiError(400, 'VALIDATION_ERROR', '时区名称无效');
      }

      const existing = await store.findTrainingGoal(authRequest.user.id);
      let goal: TrainingGoal;
      if (!existing) {
        if (version !== 0 && version !== undefined) throw new ApiError(409, 'CONFLICT', '训练目标版本冲突');
        goal = {
          userId: authRequest.user.id,
          weeklyTargetCount,
          monthlyTargetCount,
          weekStartsOn: 1,
          timezone,
          version: 1,
          updatedAt: new Date().toISOString(),
        };
      } else {
        if (!Number.isInteger(version) || version !== existing.version) {
          throw new ApiError(409, 'CONFLICT', '训练目标已被更新，请刷新后重试');
        }
        goal = {
          ...existing,
          weeklyTargetCount,
          monthlyTargetCount,
          timezone,
          version: existing.version + 1,
          updatedAt: new Date().toISOString(),
        };
      }
      await store.saveTrainingGoal(goal);
      return responseData(res, goal);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/dashboard/overview', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const records = (await store.listTrainingRecords(authRequest.user.id))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
      const goal = await getOrCreateGoal(store, authRequest.user);
      const bounds = currentPeriodBounds(goal.timezone);
      const weeklyCount = recordsInRange(records, bounds.weekStart.getTime(), bounds.weekEnd.getTime()).length;
      const monthlyCount = recordsInRange(records, bounds.monthStart.getTime(), bounds.monthEnd.getTime()).length;
      return responseData(res, {
        totalMatches: records.length,
        totalDurationMinutes: records.reduce((sum, item) => sum + item.durationMinutes, 0),
        weeklyMatches: weeklyCount,
        monthlyMatches: monthlyCount,
        lastMatch: records[0] ?? null,
        recentMatches: records.slice(0, 5),
        goal,
        goalProgress: {
          weekly: { current: weeklyCount, target: goal.weeklyTargetCount },
          monthly: { current: monthlyCount, target: goal.monthlyTargetCount },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  const getStatisticsRecords = async (req: AuthenticatedRequest) => {
    const from = typeof req.query.from === 'string' ? Date.parse(req.query.from) : Number.NaN;
    const to = typeof req.query.to === 'string' ? Date.parse(req.query.to) : Number.NaN;
    if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'from 和 to 必须是有效且递增的 ISO 时间');
    }
    const all = await store.listTrainingRecords(req.user.id);
    return {
      from,
      to,
      records: recordsInRange(all.filter((item) => !item.deletedAt), from, to),
    };
  };

  app.get('/api/v1/statistics/summary', authenticate, async (req, res, next) => {
    try {
      const { records } = await getStatisticsRecords(req as AuthenticatedRequest);
      const focusCounts = records.reduce<Record<string, number>>((counts, item) => {
        counts[item.focus] = (counts[item.focus] ?? 0) + 1;
        return counts;
      }, {});
      const mostPlayedFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const totalDurationMinutes = records.reduce((sum, item) => sum + item.durationMinutes, 0);
      return responseData(res, {
        totalMatches: records.length,
        totalDurationMinutes,
        averageRating: records.length ? Number((records.reduce((sum, item) => sum + item.selfRating, 0) / records.length).toFixed(1)) : 0,
        averageEnergy: records.length ? Number((records.reduce((sum, item) => sum + item.energyLevel, 0) / records.length).toFixed(1)) : 0,
        mostPlayedFocus,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/statistics/duration-trend', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { records } = await getStatisticsRecords(authRequest);
      const bucket = req.query.bucket ?? 'day';
      if (!['day', 'week', 'month'].includes(String(bucket))) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'bucket 仅支持 day、week、month');
      }
      const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : authRequest.user.profile.timezone;
      const buckets = records.reduce<Record<string, number>>((result, item) => {
        const local = localDateParts(new Date(item.occurredAt), timezone);
        let key = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
        if (bucket === 'month') key = key.slice(0, 7);
        if (bucket === 'week') {
          const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
          const weekday = date.getUTCDay();
          date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
          key = date.toISOString().slice(0, 10);
        }
        result[key] = (result[key] ?? 0) + item.durationMinutes;
        return result;
      }, {});
      return responseData(res, Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([period, durationMinutes]) => ({ period, durationMinutes })));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/statistics/mood-distribution', authenticate, async (req, res, next) => {
    try {
      const { records } = await getStatisticsRecords(req as AuthenticatedRequest);
      const counts = Object.fromEntries(MOODS.map((mood) => [mood, 0])) as Record<Mood, number>;
      records.forEach((item) => { counts[item.mood] += 1; });
      return responseData(res, MOODS.map((mood) => ({
        mood,
        count: counts[mood],
        percentage: records.length ? Number(((counts[mood] / records.length) * 100).toFixed(1)) : 0,
      })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/feedback', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
      if (!content || content.length > 500) {
        throw new ApiError(400, 'VALIDATION_ERROR', '反馈内容长度必须为 1-500 个字符');
      }
      const recentCount = await store.countFeedbackSince(
        authRequest.user.id,
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      );
      if (recentCount >= 5) throw new ApiError(429, 'RATE_LIMITED', '反馈提交过于频繁，请稍后再试');
      const feedback = {
        id: randomUUID(),
        userId: authRequest.user.id,
        content,
        status: 'new' as const,
        createdAt: new Date().toISOString(),
      };
      await store.createFeedback(feedback);
      return responseData(res, feedback, 201);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/migration/local-data', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const records = Array.isArray(req.body?.records) ? req.body.records : [];
      if (records.length > 500) throw new ApiError(400, 'VALIDATION_ERROR', '单次最多迁移 500 条训练记录');
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let profileImported = false;
      let goalImported = false;
      const errors: Array<{ clientRecordId: string | null; message: string }> = [];

      for (const candidate of records) {
        try {
          if (!candidate || typeof candidate !== 'object') throw new ApiError(400, 'VALIDATION_ERROR', '记录格式无效');
          const body = candidate as Record<string, unknown>;
          validateRecordInput(body);
          const clientRecordId = typeof body.clientRecordId === 'string' && body.clientRecordId.trim()
            ? body.clientRecordId.trim()
            : null;
          if (!clientRecordId) throw new ApiError(400, 'VALIDATION_ERROR', '迁移记录必须包含 clientRecordId');
          const exists = await store.findTrainingRecordByClientId(authRequest.user.id, clientRecordId);
          if (exists) {
            skippedCount += 1;
            continue;
          }
          const now = new Date().toISOString();
          await store.createTrainingRecord({
            id: randomUUID(),
            userId: authRequest.user.id,
            clientRecordId,
            occurredAt: new Date(body.occurredAt as string).toISOString(),
            durationMinutes: body.durationMinutes as number,
            focus: body.focus as string,
            mood: body.mood as Mood,
            selfRating: body.selfRating as number,
            energyLevel: body.energyLevel as number,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            location: typeof body.location === 'string' ? body.location.trim() || null : null,
            partner: typeof body.partner === 'string' ? body.partner.trim() || null : null,
            weather: typeof body.weather === 'string' ? body.weather : null,
            version: 1,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          importedCount += 1;
        } catch (error) {
          failedCount += 1;
          errors.push({
            clientRecordId: typeof candidate?.clientRecordId === 'string' ? candidate.clientRecordId : null,
            message: error instanceof Error ? error.message : '记录格式无效',
          });
        }
      }

      if (req.body?.profile && typeof req.body.profile === 'object') {
        const profile = req.body.profile as Record<string, unknown>;
        let invalidProfile =
          (profile.nickname !== undefined && (typeof profile.nickname !== 'string' || !profile.nickname.trim() || profile.nickname.trim().length > 40)) ||
          (profile.gender !== undefined && !['male', 'female', 'other', 'undisclosed'].includes(String(profile.gender))) ||
          (profile.level !== undefined && !['beginner', 'intermediate', 'advanced', 'professional'].includes(String(profile.level))) ||
          (profile.age !== undefined && profile.age !== null && (typeof profile.age !== 'number' || profile.age < 1 || profile.age > 120)) ||
          (profile.heightCm !== undefined && profile.heightCm !== null && (typeof profile.heightCm !== 'number' || profile.heightCm < 100 || profile.heightCm > 250)) ||
          (profile.weightKg !== undefined && profile.weightKg !== null && (typeof profile.weightKg !== 'number' || profile.weightKg < 30 || profile.weightKg > 200)) ||
          (profile.playingYears !== undefined && profile.playingYears !== null && (typeof profile.playingYears !== 'number' || profile.playingYears < 0 || profile.playingYears > 80)) ||
          (profile.bio !== undefined && (typeof profile.bio !== 'string' || profile.bio.length > 200)) ||
          (profile.avatarUrl !== undefined && profile.avatarUrl !== null && (typeof profile.avatarUrl !== 'string' || !/^https:\/\//.test(profile.avatarUrl))) ||
          (profile.email !== undefined && profile.email !== null && (typeof profile.email !== 'string' || !/^\S+@\S+\.\S+$/.test(profile.email))) ||
          (profile.phone !== undefined && profile.phone !== null && (typeof profile.phone !== 'string' || !/^\+?[0-9 -]{6,20}$/.test(profile.phone)));
        if (!invalidProfile && typeof profile.timezone === 'string') {
          try {
            Intl.DateTimeFormat('en-US', { timeZone: profile.timezone });
          } catch {
            invalidProfile = true;
          }
        }
        if (invalidProfile) {
          failedCount += 1;
          errors.push({ clientRecordId: null, message: '个人资料格式无效' });
        } else {
          const allowedProfileFields = ['nickname', 'avatarUrl', 'gender', 'age', 'heightCm', 'weightKg', 'playingYears', 'level', 'phone', 'email', 'bio', 'timezone'] as const;
          for (const field of allowedProfileFields) {
            if (field in profile && profile[field] !== undefined) {
              (authRequest.user.profile as unknown as Record<string, unknown>)[field] = profile[field];
            }
          }
          authRequest.user.profile.version += 1;
          authRequest.user.updatedAt = new Date().toISOString();
          await store.updateUser(authRequest.user);
          profileImported = true;
        }
      }

      if (req.body?.goal && typeof req.body.goal === 'object') {
        const goalInput = req.body.goal as Record<string, unknown>;
        const weekly = goalInput.weeklyTargetCount;
        const monthly = goalInput.monthlyTargetCount;
        if (Number.isInteger(weekly) && Number(weekly) >= 1 && Number(weekly) <= 20 && Number.isInteger(monthly) && Number(monthly) >= 1 && Number(monthly) <= 100) {
          const goal = await getOrCreateGoal(store, authRequest.user);
          await store.saveTrainingGoal({
            ...goal,
            weeklyTargetCount: weekly as number,
            monthlyTargetCount: monthly as number,
            version: goal.version + 1,
            updatedAt: new Date().toISOString(),
          });
          goalImported = true;
        } else {
          failedCount += 1;
          errors.push({ clientRecordId: null, message: '训练目标格式无效' });
        }
      }

      const existingStatus = await store.findMigrationStatus(authRequest.user.id);
      const status = existingStatus ?? {
        userId: authRequest.user.id,
        completed: false,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        lastMigratedAt: null as string | null,
      };
      status.importedCount += importedCount;
      status.skippedCount += skippedCount;
      status.failedCount = failedCount;
      status.completed = failedCount === 0;
      status.lastMigratedAt = new Date().toISOString();
      await store.saveMigrationStatus(status);
      return responseData(res, { ...status, batch: { importedCount, skippedCount, failedCount, profileImported, goalImported, errors } });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/migration/status', authenticate, async (req, res, next) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const status = (await store.findMigrationStatus(authRequest.user.id)) ?? {
        userId: authRequest.user.id,
        completed: false,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        lastMigratedAt: null,
      };
      return responseData(res, status);
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', '接口不存在')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const apiError = toApiError(error);
    return res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details ? { details: apiError.details } : {}),
        requestId: res.locals.requestId,
      },
    });
  });

  return app;
}
