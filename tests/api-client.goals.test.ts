import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goalsApi } from '../src/api/client';

const response = (data: unknown) => new Response(JSON.stringify({ data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

describe('训练目标 API Client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('读取并按完整契约更新目标', async () => {
    const goal = {
      weeklyTargetCount: 5, monthlyTargetCount: 20, weekStartsOn: 1 as const,
      timezone: 'Asia/Shanghai', version: 2,
    };
    vi.mocked(fetch).mockResolvedValueOnce(response(goal)).mockResolvedValueOnce(response({ ...goal, version: 3 }));

    expect(await goalsApi.getCurrent()).toEqual(goal);
    const updated = await goalsApi.update(goal);

    const [, init] = vi.mocked(fetch).mock.calls[1];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(goal);
    expect(updated.version).toBe(3);
  });
});
