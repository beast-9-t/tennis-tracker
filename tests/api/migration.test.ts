import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('本地数据迁移 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let token = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    store.state.trainingRecords = [];
    store.state.migrations = [];
    token = (await request(app).post('/api/v1/auth/register').send({ username: 'alice', password: 'password123' })).body.data.accessToken;
  });

  const validRecord = {
    clientRecordId: 'legacy-1',
    occurredAt: '2026-09-13T06:30:00.000Z',
    durationMinutes: 90,
    focus: '综合训练',
    mood: 'good',
    selfRating: 8,
    energyLevel: 7,
    weather: '晴天',
  };

  it('迁移可部分成功并返回错误明细', async () => {
    const response = await request(app)
      .post('/api/v1/migration/local-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [validRecord, { ...validRecord, clientRecordId: 'legacy-2', durationMinutes: 999 }] })
      .expect(200);

    expect(response.body.data.batch).toMatchObject({ importedCount: 1, skippedCount: 0, failedCount: 1 });
    expect(response.body.data.completed).toBe(false);
    expect(response.body.data.batch.errors[0].clientRecordId).toBe('legacy-2');
  });

  it('重复迁移相同本地记录时不会重复写入', async () => {
    await request(app)
      .post('/api/v1/migration/local-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [validRecord] })
      .expect(200);
    const repeated = await request(app)
      .post('/api/v1/migration/local-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [validRecord] })
      .expect(200);

    expect(repeated.body.data.batch).toMatchObject({ importedCount: 0, skippedCount: 1, failedCount: 0 });
    expect(store.state.trainingRecords).toHaveLength(1);
    const status = await request(app)
      .get('/api/v1/migration/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(status.body.data.completed).toBe(true);
  });

  it('同时迁移个人资料和训练目标', async () => {
    const migrated = await request(app)
      .post('/api/v1/migration/local-data')
      .set('Authorization', `Bearer ${token}`)
      .send({
        records: [],
        profile: { nickname: '旧昵称', level: 'intermediate', timezone: 'Asia/Shanghai' },
        goal: { weeklyTargetCount: 6, monthlyTargetCount: 24 },
      })
      .expect(200);

    expect(migrated.body.data.batch).toMatchObject({ profileImported: true, goalImported: true });
    expect(store.state.users[0].profile.nickname).toBe('旧昵称');
    expect(store.state.trainingGoals[0].weeklyTargetCount).toBe(6);
  });
});
