import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

const recordInput = (occurredAt = '2026-09-13T06:30:00.000Z') => ({
  occurredAt,
  durationMinutes: 90,
  focus: '综合训练',
  mood: 'good',
  selfRating: 8,
  energyLevel: 7,
  weather: '晴天',
  notes: '状态不错',
});

describe('训练记录 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let aliceToken = '';
  let bobToken = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    store.state.trainingRecords = [];
    aliceToken = (await request(app).post('/api/v1/auth/register').send({ username: 'alice', password: 'password123' })).body.data.accessToken;
    bobToken = (await request(app).post('/api/v1/auth/register').send({ username: 'bobby', password: 'password123' })).body.data.accessToken;
  });

  it('新增、读取、更新并软删除自己的记录', async () => {
    const created = await request(app)
      .post('/api/v1/training-records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send(recordInput())
      .expect(201);

    const id = created.body.data.id;
    expect(created.body.data.version).toBe(1);

    await request(app)
      .get(`/api/v1/training-records/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const updated = await request(app)
      .patch(`/api/v1/training-records/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ durationMinutes: 120, version: 1 })
      .expect(200);
    expect(updated.body.data.durationMinutes).toBe(120);
    expect(updated.body.data.version).toBe(2);

    await request(app)
      .delete(`/api/v1/training-records/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    await request(app)
      .get(`/api/v1/training-records/${id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(404);
  });

  it('按用户隔离数据并支持分页', async () => {
    for (let day = 1; day <= 3; day += 1) {
      await request(app)
        .post('/api/v1/training-records')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(recordInput(`2026-09-0${day}T06:30:00.000Z`));
    }
    await request(app)
      .post('/api/v1/training-records')
      .set('Authorization', `Bearer ${bobToken}`)
      .send(recordInput());

    const firstPage = await request(app)
      .get('/api/v1/training-records?limit=2')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.page.hasMore).toBe(true);

    const secondPage = await request(app)
      .get(`/api/v1/training-records?limit=2&cursor=${firstPage.body.page.nextCursor}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(secondPage.body.data).toHaveLength(1);
  });

  it('使用幂等键避免重复创建，并拒绝越权读取', async () => {
    const first = await request(app)
      .post('/api/v1/training-records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'local-record-1')
      .send(recordInput())
      .expect(201);
    const repeated = await request(app)
      .post('/api/v1/training-records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'local-record-1')
      .send(recordInput())
      .expect(200);

    expect(repeated.body.data.id).toBe(first.body.data.id);
    expect(store.state.trainingRecords).toHaveLength(1);
    await request(app)
      .get(`/api/v1/training-records/${first.body.data.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });
});
