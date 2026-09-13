import { beforeEach, describe, expect, it, vi } from 'vitest';
import { feedbackApi, profileApi } from '../src/api/client';

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('个人资料与反馈 API Client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('使用版本号更新当前用户资料', async () => {
    const profile = {
      nickname: 'Alice', avatarUrl: null, gender: 'female' as const, age: 26,
      heightCm: 170, weightKg: 60, playingYears: 2,
      level: 'intermediate' as const, phone: null, email: null, bio: '',
      timezone: 'Asia/Shanghai', version: 2,
    };
    vi.mocked(fetch).mockResolvedValue(response({ ...profile, version: 3 }));

    const saved = await profileApi.update(profile);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body)).version).toBe(2);
    expect(saved.version).toBe(3);
  });

  it('将反馈内容提交到服务端', async () => {
    vi.mocked(fetch).mockResolvedValue(response({
      id: 'feedback-1', content: '建议', status: 'new', createdAt: '2026-09-13T00:00:00.000Z',
    }, 201));

    const result = await feedbackApi.submit('建议');
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ content: '建议' });
    expect(result.id).toBe('feedback-1');
  });
});
