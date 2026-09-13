<script setup lang="ts">
import { ref, provide, onMounted } from 'vue';
import Navigation from './components/Navigation.vue';
import HomePage from './components/HomePage.vue';
import MatchList from './components/MatchList.vue';
import Statistics from './components/Statistics.vue';
import TennisForm from './components/TennisForm.vue';
import LoginPage from './components/LoginPage.vue';
import ProfilePage from './components/ProfilePage.vue';
import { authApi } from './api/client';
import { migrateLegacyData } from './services/migration';

const isLoggedIn = ref(false);
const isAuthLoading = ref(true);
const currentPage = ref<'home' | 'history' | 'statistics' | 'profile'>('home');
const formKey = ref(0);
const contentKey = ref(0);

// 全局庆祝效果状态
const showCelebration = ref(false);
const celebrationMessage = ref('');

const migrateAfterLogin = async (username: string) => {
  try {
    await migrateLegacyData(username);
  } catch (error) {
    console.warn('Legacy data migration will be retried later:', error);
  }
};

onMounted(async () => {
  try {
    const user = await authApi.restoreSession();
    isLoggedIn.value = !!user;
    if (user) await migrateAfterLogin(user.username);
  } catch {
    isLoggedIn.value = false;
  } finally {
    isAuthLoading.value = false;
  }
});

const handlePageChange = (page: 'home' | 'history' | 'statistics' | 'profile') => {
  currentPage.value = page;
};

const handleMatchAdded = () => {
  formKey.value++;
  contentKey.value++;
  // 触发庆祝效果
  triggerCelebration();
};

const handleLoginSuccess = async () => {
  await migrateAfterLogin(authApi.getCurrentUsername());
  isLoggedIn.value = true;
};

const handleLogout = async () => {
  await authApi.logout();
  isLoggedIn.value = false;
  currentPage.value = 'home';
};

// 触发庆祝效果
const triggerCelebration = () => {
  const messages = [
    '太棒啦！🎉',
    '继续保持！💪',
    '你真厉害！🌟',
    '为你的坚持点赞！👏',
    '进步看得见！🚀',
    '每一次训练都算数！✨',
    '向着更好的自己出发！🎯',
  ];
  
  celebrationMessage.value = messages[Math.floor(Math.random() * messages.length)];
  showCelebration.value = true;
  
  // 3秒后隐藏庆祝效果
  setTimeout(() => {
    showCelebration.value = false;
  }, 3000);
};

// 提供给子组件
provide('showCelebration', showCelebration);
provide('celebrationMessage', celebrationMessage);
provide('triggerCelebration', triggerCelebration);
</script>

<template>
  <div v-if="isAuthLoading" class="min-h-screen flex items-center justify-center text-gray-500">
    正在恢复登录状态...
  </div>

  <!-- 登录页面 -->
  <LoginPage v-else-if="!isLoggedIn" @login-success="handleLoginSuccess" />

  <!-- 主应用 -->
  <div v-else id="app" class="min-h-screen bg-gradient-to-br from-green-50/30 via-white to-blue-50/30">
    <!-- 全局庆祝效果 -->
    <Transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-500 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showCelebration" class="fixed inset-0 z-[100] pointer-events-none">
        <!-- 烟花效果 -->
        <div class="firework" style="left: 20%; top: 30%;"></div>
        <div class="firework" style="left: 80%; top: 25%;"></div>
        <div class="firework" style="left: 50%; top: 20%;"></div>
        <div class="firework" style="left: 30%; top: 50%;"></div>
        <div class="firework" style="left: 70%; top: 45%;"></div>
        
        <!-- 星星飘落 -->
        <div class="star-fall" style="left: 10%; animation-delay: 0s;"></div>
        <div class="star-fall" style="left: 25%; animation-delay: 0.3s;"></div>
        <div class="star-fall" style="left: 40%; animation-delay: 0.1s;"></div>
        <div class="star-fall" style="left: 55%; animation-delay: 0.4s;"></div>
        <div class="star-fall" style="left: 70%; animation-delay: 0.2s;"></div>
        <div class="star-fall" style="left: 85%; animation-delay: 0.5s;"></div>
        <div class="star-fall" style="left: 15%; animation-delay: 0.6s;"></div>
        <div class="star-fall" style="left: 60%; animation-delay: 0.35s;"></div>
        
        <!-- 中心祝福文字 -->
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="celebration-card">
            <div class="text-6xl mb-4 animate-bounce">🎊</div>
            <div class="text-3xl font-bold gradient-text mb-2">
              {{ celebrationMessage }}
            </div>
            <div class="text-lg text-gray-600 animate-pulse">
              记录已保存成功！
            </div>
            <div class="flex justify-center space-x-2 mt-4">
              <span class="text-2xl animate-spin-slow">⭐</span>
              <span class="text-2xl animate-pulse">🎾</span>
              <span class="text-2xl animate-spin-slow">⭐</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 主内容区域 -->
    <main class="container mx-auto px-4 py-6 max-w-2xl mb-24">
      <Transition
        mode="out-in"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-10"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 -translate-x-10"
      >
        <HomePage v-if="currentPage === 'home'" :key="`home-${contentKey}`" />
        <Statistics v-else-if="currentPage === 'statistics'" :key="`statistics-${contentKey}`" />
        <MatchList v-else-if="currentPage === 'history'" :key="`history-${contentKey}`" />
        <ProfilePage v-else-if="currentPage === 'profile'" @logout="handleLogout" />
      </Transition>
    </main>

    <!-- 网球记录表单 -->
    <TennisForm :key="formKey" @match-added="handleMatchAdded" />

    <!-- 导航栏 -->
    <Navigation :current-page="currentPage" @page-change="handlePageChange" />
  </div>
</template>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #56ab2f, #1976d2);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #2e7d32, #0d47a1);
}

/* 自定义过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 烟花效果 */
.firework {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: firework 1s ease-out infinite;
}

.firework::before,
.firework::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: firework-particle 1s ease-out infinite;
}

.firework:nth-child(1) {
  background: #56ab2f;
  box-shadow: 0 0 10px #56ab2f;
}
.firework:nth-child(1)::before,
.firework:nth-child(1)::after {
  background: #56ab2f;
}

.firework:nth-child(2) {
  background: #1976d2;
  box-shadow: 0 0 10px #1976d2;
  animation-delay: 0.2s;
}
.firework:nth-child(2)::before,
.firework:nth-child(2)::after {
  background: #1976d2;
  animation-delay: 0.2s;
}

.firework:nth-child(3) {
  background: #fbbf24;
  box-shadow: 0 0 10px #fbbf24;
  animation-delay: 0.4s;
}
.firework:nth-child(3)::before,
.firework:nth-child(3)::after {
  background: #fbbf24;
  animation-delay: 0.4s;
}

.firework:nth-child(4) {
  background: #ec4899;
  box-shadow: 0 0 10px #ec4899;
  animation-delay: 0.3s;
}
.firework:nth-child(4)::before,
.firework:nth-child(4)::after {
  background: #ec4899;
  animation-delay: 0.3s;
}

.firework:nth-child(5) {
  background: #8b5cf6;
  box-shadow: 0 0 10px #8b5cf6;
  animation-delay: 0.5s;
}
.firework:nth-child(5)::before,
.firework:nth-child(5)::after {
  background: #8b5cf6;
  animation-delay: 0.5s;
}

@keyframes firework {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes firework-particle {
  0% {
    transform: translate(0, 0);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx, 50px), var(--ty, -50px));
    opacity: 0;
  }
}

/* 星星飘落效果 */
.star-fall {
  position: absolute;
  top: -20px;
  font-size: 24px;
  animation: star-fall 2s linear forwards;
}

.star-fall::before {
  content: '⭐';
}

@keyframes star-fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* 庆祝卡片 */
.celebration-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 2rem 3rem;
  border-radius: 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  text-align: center;
  animation: celebration-pop 0.5s ease-out;
}

@keyframes celebration-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 缓慢旋转 */
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}
</style>
