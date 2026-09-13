import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordsApi } from '../src/api/client';

const jsonResponse = (data: unknown, status = 200) => new Response(
  JSON.stringify({ data, meta: { requestId: 'req-1' } }),
  { status, headers: { 'Content-Type': 'application/json' } },
);

describe('训练记录 API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => 'client-idempotency-key' });
  });

  it('新增记录时转换字段并携带幂等键', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      id: 'server-1', occurredAt: '2026-09-13T04:00:00.000Z', durationMinutes: 90,
      focus: '综合训练', mood: 'good', selfRating: 8, energyLevel: 7,
      notes: null, location: null, partner: null, weather: '晴天', version: 1,
    }));

    const result = await recordsApi.create({
      date: new Date('2026-09-13T04:00:00.000Z'), duration: 90, focus: '综合训练',
      mood: 'good', selfRating: 8, energyLevel: 7, weather: '晴天',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('client-idempotency-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({ durationMinutes: 90, occurredAt: '2026-09-13T04:00:00.000Z' });
    expect(result).toMatchObject({ id: 'server-1', duration: 90, version: 1 });
    expect(result.date).toBeInstanceOf(Date);
  });

  it('读取列表时将服务端时间转换为 Date', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [{
      id: 'server-1', occurredAt: '2026-09-13T04:00:00.000Z', durationMinutes: 60,
      focus: '发球', mood: 'excellent', selfRating: 9, energyLevel: 8,
      notes: null, location: null, partner: null, weather: null, version: 2,
    }], page: { nextCursor: 'cursor-1', hasMore: true } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));

    const page = await recordsApi.listPage();
    const records = page.data;
    expect(records[0].date.toISOString()).toBe('2026-09-13T04:00:00.000Z');
    expect(records[0].duration).toBe(60);
    expect(page.page).toEqual({ nextCursor: 'cursor-1', hasMore: true });
  });

  it('更新记录时携带服务端版本号', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      id: 'server-1', occurredAt: '2026-09-13T04:00:00.000Z', durationMinutes: 120,
      focus: '发球', mood: 'excellent', selfRating: 9, energyLevel: 8,
      notes: null, location: null, partner: null, weather: null, version: 3,
    }));

    const updated = await recordsApi.update('server-1', { duration: 120, version: 2 });
    const [url, init] = vi.mocked(fetch).mock.calls[0];

    expect(String(url)).toContain('/training-records/server-1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ durationMinutes: 120, version: 2 });
    expect(updated.version).toBe(3);
  });
});
