<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { UserInfo } from '../types/user';
import { feedbackApi, profileApi } from '../api/client';
import { Input, Button, Select, InputNumber, Textarea, Avatar, MessagePlugin, Dialog } from 'tdesign-vue-next';
import { User, Mail, Phone, Ruler, Weight, Calendar, Award, Edit3, LogOut, Settings, ChevronRight, Heart, Activity, Target, MessageSquare } from 'lucide-vue-next';

const emit = defineEmits<{
  'logout': [];
}>();

const userInfo = ref<UserInfo>({
  nickname: '',
  avatar: '',
  gender: 'male',
  age: 25,
  height: 175,
  weight: 70,
  playingYears: 1,
  level: 'intermediate',
  phone: '',
  email: '',
  bio: '',
});

const isEditing = ref(false);
const showLogoutDialog = ref(false);
const showFeedbackDialog = ref(false);
const feedbackContent = ref('');
const profileVersion = ref(0);

const genderOptions = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
];

const levelOptions = [
  { label: '初学者', value: 'beginner' },
  { label: '中级', value: 'intermediate' },
  { label: '高级', value: 'advanced' },
  { label: '专业', value: 'professional' },
];

const loadProfile = async () => {
  try {
    const profile = await profileApi.get();
    userInfo.value = {
      nickname: profile.nickname,
      avatar: profile.avatarUrl ?? '',
      gender: profile.gender === 'undisclosed' ? 'other' : profile.gender,
      age: profile.age ?? 25,
      height: profile.heightCm ?? 175,
      weight: profile.weightKg ?? 70,
      playingYears: profile.playingYears ?? 1,
      level: profile.level,
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      bio: profile.bio,
    };
    profileVersion.value = profile.version;
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '个人资料加载失败');
  }
};

onMounted(loadProfile);

const handleSave = async () => {
  try {
    const saved = await profileApi.update({
      nickname: userInfo.value.nickname,
      avatarUrl: userInfo.value.avatar || null,
      gender: userInfo.value.gender,
      age: userInfo.value.age,
      heightCm: userInfo.value.height,
      weightKg: userInfo.value.weight,
      playingYears: userInfo.value.playingYears,
      level: userInfo.value.level,
      phone: userInfo.value.phone || null,
      email: userInfo.value.email || null,
      bio: userInfo.value.bio,
      version: profileVersion.value,
    });
    profileVersion.value = saved.version;
    isEditing.value = false;
    MessagePlugin.success('保存成功！');
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '保存失败，请重试');
  }
};

const handleLogout = () => {
  emit('logout');
};

const getLevelLabel = (level: string) => {
  const option = levelOptions.find(opt => opt.value === level);
  return option?.label || '中级';
};

// 提交反馈意见
const submitFeedback = async () => {
  if (!feedbackContent.value.trim()) {
    MessagePlugin.warning('请输入反馈内容');
    return;
  }
  
  try {
    await feedbackApi.submit(feedbackContent.value.trim());
    MessagePlugin.success('感谢您的反馈！');
    feedbackContent.value = '';
    showFeedbackDialog.value = false;
  } catch (err) {
    MessagePlugin.error('提交失败，请重试');
    console.error('Feedback error:', err);
  }
};
</script>

<template>
  <div class="pb-24 space-y-3">
    <!-- 用户头像和基本信息 -->
    <div class="card p-6">
      <div class="flex flex-col items-center">
        <!-- 头像区域 - 在名称正上方，高度与文字行高一致(约18px) -->
        <div 
          class="rounded-full bg-gradient-to-br from-tennis-green to-tennis-blue flex items-center justify-center text-white font-bold shadow-md mb-2"
          style="width: 20px; height: 20px; font-size: 11px; min-width: 20px; min-height: 20px;"
        >
          <span v-if="!userInfo.avatar">{{ userInfo.nickname ? userInfo.nickname[0].toUpperCase() : 'U' }}</span>
          <img 
            v-else 
            :src="userInfo.avatar" 
            class="w-full h-full rounded-full object-cover"
          />
        </div>
        
        <!-- 用户名称 - 与头像高度一致 -->
        <h2 class="text-lg font-bold text-gray-900 leading-7">{{ userInfo.nickname || '网球爱好者' }}</h2>
        
        <!-- 其他信息 -->
        <p class="text-sm text-gray-500 text-center mt-1">{{ userInfo.bio || '热爱网球，享受每一次挥拍！' }}</p>
        <div class="flex items-center space-x-2 mt-2">
          <span class="px-2 py-0.5 bg-tennis-green/10 text-tennis-green text-xs rounded-full">
            {{ getLevelLabel(userInfo.level) }}
          </span>
          <span class="text-xs text-gray-400">球龄 {{ userInfo.playingYears }} 年</span>
        </div>
      </div>
    </div>

    <!-- 个人信息 -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <User :size="18" class="text-tennis-green" />
          <h3 class="font-semibold text-gray-900">个人信息</h3>
        </div>
        <t-button
          variant="text"
          size="small"
          @click="isEditing = !isEditing"
          class="text-tennis-blue"
        >
          <Edit3 :size="16" class="mr-1" />
          {{ isEditing ? '取消' : '编辑' }}
        </t-button>
      </div>

      <!-- 基本信息 -->
      <div v-if="!isEditing" class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <User :size="16" />
            <span>性别</span>
          </div>
          <span class="font-medium text-gray-900">
            {{ userInfo.gender === 'male' ? '男' : userInfo.gender === 'female' ? '女' : '其他' }}
          </span>
        </div>
        
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Calendar :size="16" />
            <span>年龄</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.age }} 岁</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Ruler :size="16" />
            <span>身高</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.height }} cm</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Weight :size="16" />
            <span>体重</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.weight }} kg</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Activity :size="16" />
            <span>球龄</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.playingYears }} 年</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Award :size="16" />
            <span>水平</span>
          </div>
          <span class="font-medium text-gray-900">{{ getLevelLabel(userInfo.level) }}</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <div class="flex items-center space-x-2 text-gray-600">
            <Phone :size="16" />
            <span>手机</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.phone || '未设置' }}</span>
        </div>

        <div class="flex items-center justify-between py-2">
          <div class="flex items-center space-x-2 text-gray-600">
            <Mail :size="16" />
            <span>邮箱</span>
          </div>
          <span class="font-medium text-gray-900">{{ userInfo.email || '未设置' }}</span>
        </div>
      </div>

      <!-- 编辑表单 -->
      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
          <t-input v-model="userInfo.nickname" placeholder="请输入昵称" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">性别</label>
          <t-select v-model="userInfo.gender" :options="genderOptions" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">年龄</label>
            <t-input-number v-model="userInfo.age" :min="1" :max="120" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">球龄（年）</label>
            <t-input-number v-model="userInfo.playingYears" :min="0" :max="50" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">身高（cm）</label>
            <t-input-number v-model="userInfo.height" :min="100" :max="250" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">体重（kg）</label>
            <t-input-number v-model="userInfo.weight" :min="30" :max="200" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">技术水平</label>
          <t-select v-model="userInfo.level" :options="levelOptions" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">手机号</label>
          <t-input v-model="userInfo.phone" placeholder="请输入手机号" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <t-input v-model="userInfo.email" placeholder="请输入邮箱" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
          <t-textarea v-model="userInfo.bio" placeholder="介绍一下自己吧..." :maxlength="200" />
        </div>

        <t-button theme="primary" block @click="handleSave">
          保存修改
        </t-button>
      </div>
    </div>

    <!-- 设置选项 -->
    <div class="card overflow-hidden">
      <!-- 反馈意见 -->
      <div 
        @click="showFeedbackDialog = true"
        class="p-4 flex items-center justify-between border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div class="flex items-center space-x-3">
          <MessageSquare :size="20" class="text-gray-400" />
          <span class="text-gray-900">反馈意见</span>
        </div>
        <ChevronRight :size="20" class="text-gray-400" />
      </div>

      <div 
        @click="showLogoutDialog = true"
        class="p-4 flex items-center justify-between cursor-pointer hover:bg-red-50 transition-colors"
      >
        <div class="flex items-center space-x-3">
          <LogOut :size="20" class="text-red-500" />
          <span class="text-red-500">退出登录</span>
        </div>
        <ChevronRight :size="20" class="text-red-500" />
      </div>
    </div>

    <!-- 反馈意见对话框 -->
    <t-dialog
      v-model:visible="showFeedbackDialog"
      header="意见反馈"
      :confirm-btn="{ content: '提交', theme: 'primary' }"
      :cancel-btn="'取消'"
      @confirm="submitFeedback"
      :close-on-overlay-click="false"
    >
      <div class="space-y-4 py-2">
        <p class="text-sm text-gray-500">请填写您的宝贵意见，我们会认真阅读每一条反馈</p>
        <textarea
          v-model="feedbackContent"
          placeholder="请输入您的意见或建议..."
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
          maxlength="500"
        ></textarea>
        <p class="text-xs text-gray-400 text-right">{{ feedbackContent.length }}/500</p>
      </div>
    </t-dialog>

    <!-- 退出确认对话框 -->
    <t-dialog
      v-model:visible="showLogoutDialog"
      header="确认退出"
      body="确定要退出登录吗？"
      :confirm-btn="{ content: '确定', theme: 'danger' }"
      :cancel-btn="'取消'"
      @confirm="handleLogout"
    />
  </div>
</template>

<style scoped>
:deep(.t-avatar) {
  --td-avatar-size-large: 4rem;
}

:deep(.t-input-number) {
  width: 100%;
}
</style>
