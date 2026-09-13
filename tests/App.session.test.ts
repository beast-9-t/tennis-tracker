import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from '../src/App.vue';
import { authApi } from '../src/api/client';
import { migrateLegacyData } from '../src/services/migration';

vi.mock('../src/services/migration', () => ({
  migrateLegacyData: vi.fn().mockResolvedValue(null),
}));

const childStubs = {
  LoginPage: { template: '<div data-testid="login-page" />' },
  HomePage: { template: '<div data-testid="home-page" />' },
  Statistics: true,
  MatchList: true,
  ProfilePage: true,
  TennisForm: true,
  Navigation: true,
};

describe('应用登录会话恢复', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('服务端没有可恢复会话时显示登录页', async () => {
    vi.spyOn(authApi, 'restoreSession').mockResolvedValue(null);

    const wrapper = mount(App, {
      global: { stubs: childStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="login-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-page"]').exists()).toBe(false);
  });

  it('服务端刷新会话成功时直接恢复到首页', async () => {
    vi.spyOn(authApi, 'restoreSession').mockResolvedValue({ username: 'alice' });

    const wrapper = mount(App, {
      global: { stubs: childStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="login-page"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="home-page"]').exists()).toBe(true);
  });

  it('恢复会话请求失败时安全回退到登录页', async () => {
    vi.spyOn(authApi, 'restoreSession').mockRejectedValue(new Error('network error'));

    const wrapper = mount(App, {
      global: { stubs: childStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="login-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-page"]').exists()).toBe(false);
  });

  it('旧数据迁移失败时仍保留已恢复的登录会话', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(authApi, 'restoreSession').mockResolvedValue({ username: 'alice' });
    vi.mocked(migrateLegacyData).mockRejectedValueOnce(new Error('migration failed'));

    const wrapper = mount(App, {
      global: { stubs: childStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="home-page"]').exists()).toBe(true);
  });
});
