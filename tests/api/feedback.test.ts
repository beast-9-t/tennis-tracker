import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('意见反馈 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let token = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    store.state.feedback = [];
    token = (await request(app).post('/api/v1/auth/register').send({ username: 'alice', password: 'password123' })).body.data.accessToken;
  });

  it('保存当前用户反馈并清理首尾空白', async () => {
    const response = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '  希望增加训练提醒  ' })
      .expect(201);

    expect(response.body.data.content).toBe('希望增加训练提醒');
    expect(store.state.feedback[0].userId).toBe(store.state.users[0].id);
  });

  it('拒绝空反馈并限制每小时提交次数', async () => {
    await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' })
      .expect(400);

    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .post('/api/v1/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: `反馈 ${index}` })
        .expect(201);
    }
    const limited = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '第六条反馈' })
      .expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
