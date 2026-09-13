import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../src/api/client';

describe('首页概览 API Client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('一次请求返回首页数据并转换记录日期', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: {
      totalMatches: 1,
      totalDurationMinutes: 90,
      weeklyMatches: 1,
      monthlyMatches: 1,
      lastMatch: {
        id: 'record-1', occurredAt: '2026-09-13T04:00:00.000Z', durationMinutes: 90,
        focus: '综合训练', mood: 'good', selfRating: 8, energyLevel: 7,
        notes: null, location: null, partner: null, weather: '晴天', version: 1,
      },
      recentMatches: [],
      goal: { weeklyTargetCount: 4, monthlyTargetCount: 16, weekStartsOn: 1, timezone: 'Asia/Shanghai', version: 1 },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const overview = await dashboardApi.getOverview();
    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/overview', expect.any(Object));
    expect(overview.totalDurationMinutes).toBe(90);
    expect(overview.lastMatch?.date).toBeInstanceOf(Date);
  });
});
