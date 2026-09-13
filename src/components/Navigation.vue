<script setup lang="ts">
import { ref } from 'vue';
import { Menu, Calendar, BarChart3, Home, User } from 'lucide-vue-next';

const props = defineProps<{
  currentPage: 'home' | 'history' | 'statistics' | 'profile';
}>();

const emit = defineEmits<{
  'page-change': [page: 'home' | 'history' | 'statistics' | 'profile'];
}>();

const menuItems = [
  { id: 'home' as const, label: '首页', icon: Home },
  { id: 'statistics' as const, label: '统计分析', icon: BarChart3 },
  { id: 'history' as const, label: '历史记录', icon: Calendar },
  { id: 'profile' as const, label: '我的', icon: User },
];
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-lg border-t border-gray-200 z-50">
    <div class="flex justify-around items-center py-2">
      <button
        v-for="item in menuItems"
        :key="item.id"
        @click="emit('page-change', item.id)"
        :class="[
          'flex flex-col items-center px-3 py-2 rounded-lg transition-all duration-300',
          currentPage === item.id
            ? 'text-tennis-green bg-tennis-green/10'
            : 'text-gray-500 hover:text-tennis-green hover:bg-tennis-green/5'
        ]"
      >
        <component
          :is="item.icon"
          :size="22"
          :class="['transition-transform duration-300', currentPage === item.id ? 'animate-bounce-slow' : '']"
        />
        <span class="text-xs mt-1 font-medium">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* Additional animations */
@keyframes bounce-slow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}
</style>
