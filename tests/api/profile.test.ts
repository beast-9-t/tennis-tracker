import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('个人资料 API', () => {
  const store = new MemoryStore();
  const app = createApp(store);
  let token = '';

  beforeEach(async () => {
    store.state.users = [];
    store.state.sessions = [];
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'password123' });
    token = response.body.data.accessToken;
  });

  it('查询并更新当前用户资料', async () => {
    const initial = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updated = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '网球 Alice', level: 'intermediate', age: 26, version: initial.body.data.version })
      .expect(200);

    expect(updated.body.data.nickname).toBe('网球 Alice');
    expect(updated.body.data.level).toBe('intermediate');
    expect(updated.body.data.version).toBe(2);
  });

  it('拒绝非法字段和过期版本', async () => {
    await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin', version: 1 })
      .expect(400);

    await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '第一次更新', version: 1 })
      .expect(200);

    const conflict = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '过期更新', version: 1 })
      .expect(409);

    expect(conflict.body.error.code).toBe('CONFLICT');
  });
});
