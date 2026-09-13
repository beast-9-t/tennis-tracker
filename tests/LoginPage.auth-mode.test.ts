import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LoginPage from '../src/components/LoginPage.vue';
import { ApiError, authApi } from '../src/api/client';

describe('登录与注册流程分离', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('登录不存在的账号时不会自动注册', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', '用户名或密码错误'));
    const wrapper = mount(LoginPage);

    await wrapper.get('input[placeholder="请输入用户名"]').setValue('alice');
    await wrapper.get('input[placeholder="请输入密码"]').setValue('password123');
    await wrapper.get('button[type="button"].w-full').trigger('click');

    expect(wrapper.text()).toContain('用户名或密码错误');
    expect(authApi.login).toHaveBeenCalledWith('alice', 'password123');
    expect(wrapper.emitted('login-success')).toBeUndefined();
  });

  it('注册时要求两次密码一致', async () => {
    const wrapper = mount(LoginPage);

    await wrapper.get('[data-testid="register-tab"]').trigger('click');
    await wrapper.get('input[placeholder="请输入用户名"]').setValue('alice');
    await wrapper.get('input[placeholder="请输入密码"]').setValue('password123');
    await wrapper.get('[data-testid="confirm-password"]').setValue('different123');
    await wrapper.get('button[type="button"].w-full').trigger('click');

    expect(wrapper.text()).toContain('两次输入的密码不一致');
    expect(vi.spyOn(authApi, 'register')).not.toHaveBeenCalled();
  });

  it('注册成功后创建账号并进入应用', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValue({ username: 'alice' });
    const wrapper = mount(LoginPage);

    await wrapper.get('[data-testid="register-tab"]').trigger('click');
    await wrapper.get('input[placeholder="请输入用户名"]').setValue('alice');
    await wrapper.get('input[placeholder="请输入密码"]').setValue('password123');
    await wrapper.get('[data-testid="confirm-password"]').setValue('password123');
    await wrapper.get('button[type="button"].w-full').trigger('click');

    expect(authApi.register).toHaveBeenCalledWith('alice', 'password123');
    expect(wrapper.emitted('login-success')).toHaveLength(1);
  });

  it('注册已存在的用户名时给出明确提示', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValue(new ApiError(409, 'CONFLICT', '用户名已存在'));
    const wrapper = mount(LoginPage);

    await wrapper.get('[data-testid="register-tab"]').trigger('click');
    await wrapper.get('input[placeholder="请输入用户名"]').setValue('alice');
    await wrapper.get('input[placeholder="请输入密码"]').setValue('password123');
    await wrapper.get('[data-testid="confirm-password"]').setValue('password123');
    await wrapper.get('button[type="button"].w-full').trigger('click');

    expect(wrapper.text()).toContain('用户名已存在，请直接登录');
    expect(wrapper.emitted('login-success')).toBeUndefined();
  });
});
