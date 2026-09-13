import { beforeEach, describe, expect, it, vi } from 'vitest';
import { statisticsApi } from '../src/api/client';

describe('统计 API Client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('为统计请求传递明确时间范围、分桶和时区', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    await statisticsApi.durationTrend(
      '2026-09-07T00:00:00.000Z',
      '2026-09-14T00:00:00.000Z',
      'day',
      'Asia/Shanghai',
    );

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain('/statistics/duration-trend?');
    expect(url).toContain('bucket=day');
    expect(url).toContain('timezone=Asia%2FShanghai');
  });
});
