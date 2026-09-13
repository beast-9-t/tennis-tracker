import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('训练目标 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let token = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    store.state.trainingGoals = [];
    token = (await request(app).post('/api/v1/auth/register').send({ username: 'alice', password: 'password123' })).body.data.accessToken;
  });

  it('首次查询创建默认目标，并可更新', async () => {
    const initial = await request(app)
      .get('/api/v1/training-goals/current')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(initial.body.data.weeklyTargetCount).toBe(4);
    expect(initial.body.data.monthlyTargetCount).toBe(16);

    const updated = await request(app)
      .put('/api/v1/training-goals/current')
      .set('Authorization', `Bearer ${token}`)
      .send({ weeklyTargetCount: 5, monthlyTargetCount: 20, timezone: 'Asia/Shanghai', version: 1 })
      .expect(200);
    expect(updated.body.data.weeklyTargetCount).toBe(5);
    expect(updated.body.data.version).toBe(2);
  });

  it('拒绝超限目标和过期版本', async () => {
    await request(app)
      .get('/api/v1/training-goals/current')
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .put('/api/v1/training-goals/current')
      .set('Authorization', `Bearer ${token}`)
      .send({ weeklyTargetCount: 0, monthlyTargetCount: 20, timezone: 'Asia/Shanghai', version: 1 })
      .expect(400);

    await request(app)
      .put('/api/v1/training-goals/current')
      .set('Authorization', `Bearer ${token}`)
      .send({ weeklyTargetCount: 5, monthlyTargetCount: 20, timezone: 'Asia/Shanghai', version: 0 })
      .expect(409);
  });
});
