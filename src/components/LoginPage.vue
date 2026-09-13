<script setup lang="ts">
import { ref } from 'vue';
import { ApiError, authApi } from '../api/client';

const emit = defineEmits<{
  'login-success': [];
}>();

const authMode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMsg = ref('');

const switchMode = (mode: 'login' | 'register') => {
  authMode.value = mode;
  password.value = '';
  confirmPassword.value = '';
  errorMsg.value = '';
};

const validateInput = () => {
  const currentUsername = username.value.trim();
  const currentPassword = password.value;

  if (!currentUsername) {
    return '请输入用户名';
  }
  if (!currentPassword) {
    return '请输入密码';
  }
  if (authMode.value === 'register') {
    if (currentUsername.length < 3 || currentUsername.length > 32) {
      return '用户名长度应为 3-32 个字符';
    }
    if (currentPassword.length < 8) {
      return '密码至少需要 8 个字符';
    }
    if (currentPassword !== confirmPassword.value) {
      return '两次输入的密码不一致';
    }
  }
  return '';
};

const handleSubmit = async () => {
  // 清除错误
  errorMsg.value = '';

  const validationError = validateInput();
  if (validationError) {
    errorMsg.value = validationError;
    return;
  }

  isLoading.value = true;

  try {
    if (authMode.value === 'login') {
      await authApi.login(username.value.trim(), password.value);
    } else {
      await authApi.register(username.value.trim(), password.value);
    }
    emit('login-success');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      errorMsg.value = '用户名已存在，请直接登录';
    } else if (error instanceof ApiError && error.status === 401) {
      errorMsg.value = '用户名或密码错误';
    } else {
      errorMsg.value = error instanceof Error ? error.message : '操作失败，请重试';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo 和标题 -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-500 rounded-full shadow-sm mb-2" style="width: 20px; height: 20px; min-width: 20px; min-height: 20px;">
          <span style="font-size: 10px;">🎾</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-1">网球记录助手</h1>
        <p class="text-gray-500 text-sm">记录每一次挥拍，见证进步</p>
      </div>

      <!-- 登录表单卡片 -->
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="grid grid-cols-2 gap-2 bg-gray-100 rounded-lg p-1 mb-5">
          <button
            type="button"
            data-testid="login-tab"
            class="py-2 rounded-md text-sm font-medium transition-colors"
            :class="authMode === 'login' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'"
            @click="switchMode('login')"
          >
            登录
          </button>
          <button
            type="button"
            data-testid="register-tab"
            class="py-2 rounded-md text-sm font-medium transition-colors"
            :class="authMode === 'register' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'"
            @click="switchMode('register')"
          >
            注册
          </button>
        </div>

        <h2 class="text-lg font-semibold text-gray-800 mb-2 text-center">
          {{ authMode === 'login' ? '欢迎回来' : '创建账号' }}
        </h2>
        <p class="text-sm text-gray-500 text-center mb-5">
          {{ authMode === 'login' ? '请输入用户名和密码登录' : '注册后即可开始记录训练' }}
        </p>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
          {{ errorMsg }}
        </div>

        <div class="space-y-4">
          <!-- 用户名 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
            <input
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
              @keyup.enter="handleSubmit"
            />
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all pr-12"
                @keyup.enter="handleSubmit"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <span v-if="showPassword">🙈</span>
                <span v-else>👁️</span>
              </button>
            </div>
          </div>

          <!-- 确认密码 -->
          <div v-if="authMode === 'register'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请再次输入密码"
              data-testid="confirm-password"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
              @keyup.enter="handleSubmit"
            />
          </div>

          <!-- 登录按钮 -->
          <button
            type="button"
            @click="handleSubmit"
            :disabled="isLoading"
            class="w-full py-3 px-4 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center"
            :class="isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isLoading ? '处理中...' : authMode === 'login' ? '登录' : '注册并登录' }}
          </button>
        </div>
        
        <!-- 提示 -->
        <p class="text-center text-xs text-gray-400 mt-4">
          {{ authMode === 'login' ? '还没有账号？请切换到注册' : '用户名需为 3-32 个字符，密码至少 8 个字符' }}
        </p>
      </div>

      <!-- 底部提示 -->
      <p class="text-center text-xs text-gray-400 mt-5">
        登录即表示同意
        <a href="#" class="text-blue-500 hover:underline">用户协议</a>
        和
        <a href="#" class="text-blue-500 hover:underline">隐私政策</a>
      </p>
    </div>
  </div>
</template>
