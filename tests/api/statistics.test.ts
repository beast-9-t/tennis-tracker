import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('首页与统计 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let token = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    store.state.trainingRecords = [];
    store.state.trainingGoals = [];
    token = (await request(app).post('/api/v1/auth/register').send({ username: 'alice', password: 'password123' })).body.data.accessToken;
    for (const record of [
      { occurredAt: '2026-09-01T06:00:00.000Z', durationMinutes: 60, mood: 'good', selfRating: 8, energyLevel: 6, focus: '正手' },
      { occurredAt: '2026-09-01T08:00:00.000Z', durationMinutes: 90, mood: 'excellent', selfRating: 10, energyLevel: 8, focus: '正手' },
      { occurredAt: '2026-09-08T06:00:00.000Z', durationMinutes: 120, mood: 'good', selfRating: 9, energyLevel: 7, focus: '发球' },
    ]) {
      await request(app)
        .post('/api/v1/training-records')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...record, weather: '晴天' });
    }
  });

  it('返回首页所需的单次聚合结果', async () => {
    const response = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.totalMatches).toBe(3);
    expect(response.body.data.totalDurationMinutes).toBe(270);
    expect(response.body.data.recentMatches).toHaveLength(3);
    expect(response.body.data.goal.weekStartsOn).toBe(1);
  });

  it('按时间范围返回摘要、趋势和心情分布', async () => {
    const query = 'from=2026-09-01T00:00:00.000Z&to=2026-10-01T00:00:00.000Z';
    const summary = await request(app)
      .get(`/api/v1/statistics/summary?${query}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(summary.body.data).toMatchObject({
      totalMatches: 3,
      totalDurationMinutes: 270,
      averageRating: 9,
      averageEnergy: 7,
      mostPlayedFocus: '正手',
    });

    const trend = await request(app)
      .get(`/api/v1/statistics/duration-trend?${query}&bucket=day&timezone=Asia/Shanghai`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(trend.body.data).toEqual([
      { period: '2026-09-01', durationMinutes: 150 },
      { period: '2026-09-08', durationMinutes: 120 },
    ]);

    const mood = await request(app)
      .get(`/api/v1/statistics/mood-distribution?${query}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mood.body.data.find((item: { mood: string }) => item.mood === 'good')).toMatchObject({ count: 2, percentage: 66.7 });
  });
});
