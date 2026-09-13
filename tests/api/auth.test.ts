import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MemoryStore } from '../../server/store';

describe('认证 API', () => {
  it('注册、查询当前用户、退出形成完整会话链路', async () => {
    const store = new MemoryStore();
    const app = createApp(store);

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'Alice', password: 'password123' })
      .expect(201);

    expect(registered.body.data.user.username).toBe('Alice');
    expect(registered.body.data.accessToken).toBeTypeOf('string');
    expect(store.state.users[0].passwordHash).not.toContain('password123');

    const token = registered.body.data.accessToken;
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => expect(response.body.data.username).toBe('Alice'));

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('拒绝重复注册，并用统一错误结构返回', async () => {
    const app = createApp(new MemoryStore());
    const credentials = { username: 'alice', password: 'password123' };

    await request(app).post('/api/v1/auth/register').send(credentials).expect(201);
    const duplicated = await request(app).post('/api/v1/auth/register').send(credentials).expect(409);

    expect(duplicated.body.error.code).toBe('CONFLICT');
    expect(duplicated.body.error.requestId).toBeTypeOf('string');
  });

  it('登录成功后可轮换刷新令牌', async () => {
    const app = createApp(new MemoryStore());
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'password123' })
      .expect(201);

    const loggedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'password123' })
      .expect(200);
    const refreshCookie = loggedIn.headers['set-cookie'][0];

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(refreshed.body.data.accessToken).not.toBe(loggedIn.body.data.accessToken);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);
  });

  it('连续登录失败后触发限流', async () => {
    const app = createApp(new MemoryStore());
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', password: 'password123' })
      .expect(201);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice', password: 'wrong-password' })
        .expect(401);
    }
    const limited = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'wrong-password' })
      .expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });

  it('限制高频注册请求', async () => {
    const app = createApp(new MemoryStore());
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', password: 'password123' });
      expect([201, 409]).toContain(response.status);
    }
    const limited = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'another-user', password: 'password123' })
      .expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
