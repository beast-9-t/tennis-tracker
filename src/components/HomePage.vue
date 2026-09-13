<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { TennisMatch } from '../types/tennis';
import { dashboardApi } from '../api/client';
import { Trophy, Clock, TrendingUp, Flame, Award, Target, Settings, ChevronDown, ChevronUp, MapPin, User, Zap, Star, Sun } from 'lucide-vue-next';
import GoalSettingsDialog from './GoalSettingsDialog.vue';

const recentMatches = ref<TennisMatch[]>([]);
const showGoalSettings = ref(false);
const expandedMatchIds = ref<Set<string>>(new Set());
const isLoading = ref(false);
const errorMsg = ref('');
const totalMatches = ref(0);
const totalDuration = ref(0);
const weeklyMatches = ref(0);
const monthlyMatches = ref(0);
const lastMatch = ref<TennisMatch | null>(null);
const goals = ref({ weeklyTarget: 4, monthlyTarget: 16 });

const loadData = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const overview = await dashboardApi.getOverview();
    recentMatches.value = overview.recentMatches;
    totalMatches.value = overview.totalMatches;
    totalDuration.value = overview.totalDurationMinutes;
    weeklyMatches.value = overview.weeklyMatches;
    monthlyMatches.value = overview.monthlyMatches;
    lastMatch.value = overview.lastMatch;
    goals.value = {
      weeklyTarget: overview.goal.weeklyTargetCount,
      monthlyTarget: overview.goal.monthlyTargetCount,
    };
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '首页数据加载失败';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadData);

const handleGoalsSaved = () => {
  loadData();
};

const toggleExpand = (matchId: string) => {
  if (expandedMatchIds.value.has(matchId)) {
    expandedMatchIds.value.delete(matchId);
  } else {
    expandedMatchIds.value.add(matchId);
  }
  expandedMatchIds.value = new Set(expandedMatchIds.value);
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const getMoodEmoji = (mood: TennisMatch['mood']) => {
  const emojiMap: Record<string, string> = {
    excellent: '🎉',
    good: '😊',
    normal: '😐',
    tired: '😴',
    exhausted: '😫',
  };
  return emojiMap[mood] || '😐';
};
</script>

<template>
  <div class="pb-20 space-y-3">
    <div v-if="errorMsg" class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{{ errorMsg }}</div>
    <div v-if="isLoading" class="text-center py-3 text-gray-500 text-sm">正在加载首页数据...</div>
    <!-- 头部标题卡片 -->
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold gradient-text">🎾 网球记录助手</h1>
          <p class="text-sm text-gray-500 mt-0.5">记录每一次挥拍，见证进步</p>
        </div>
        <div class="text-3xl opacity-20">🎾</div>
      </div>
    </div>

    <!-- 统计数据卡片 -->
    <div class="grid grid-cols-3 gap-3">
      <div class="card p-3 text-center">
        <Trophy :size="20" class="mx-auto text-tennis-green mb-1" />
        <p class="text-xl font-bold text-tennis-green">{{ totalMatches }}</p>
        <p class="text-xs text-gray-500 mt-0.5">总场次</p>
      </div>
      <div class="card p-3 text-center">
        <Clock :size="20" class="mx-auto text-tennis-blue mb-1" />
        <p class="text-xl font-bold text-tennis-blue">{{ (totalDuration / 60).toFixed(0) }}h</p>
        <p class="text-xs text-gray-500 mt-0.5">总时长</p>
      </div>
      <div class="card p-3 text-center">
        <TrendingUp :size="20" class="mx-auto text-tennis-green mb-1" />
        <p class="text-xl font-bold text-tennis-green">{{ weeklyMatches }}</p>
        <p class="text-xs text-gray-500 mt-0.5">本周</p>
      </div>
    </div>

    <!-- 最近一场卡片 -->
    <div v-if="lastMatch" class="card p-4">
      <div class="flex items-center space-x-2 mb-3">
        <Flame :size="18" class="text-tennis-blue" />
        <h3 class="font-semibold text-gray-900">最近一场</h3>
      </div>
      <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="font-semibold text-gray-900">{{ formatDate(lastMatch.date) }}</p>
            <p class="text-sm text-gray-600 mt-1">{{ lastMatch.focus }}</p>
          </div>
          <span class="text-3xl">{{ getMoodEmoji(lastMatch.mood) }}</span>
        </div>
        <div class="flex items-center gap-4 mt-3 text-sm text-gray-600">
          <div class="flex items-center space-x-1">
            <Zap :size="14" class="text-orange-500" />
            <span>能量: {{ lastMatch.energyLevel }}/10</span>
          </div>
          <div class="flex items-center space-x-1">
            <Clock :size="14" class="text-tennis-blue" />
            <span>{{ lastMatch.duration }}分钟</span>
          </div>
          <div class="flex items-center space-x-1">
            <Award :size="14" class="text-yellow-500" />
            <span>评分: {{ lastMatch.selfRating }}/10</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 训练目标卡片 -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <Target :size="18" class="text-tennis-green" />
          <h3 class="font-semibold text-gray-900">训练目标</h3>
        </div>
        <button
          @click="showGoalSettings = true"
          class="text-gray-400 hover:text-tennis-green transition-colors"
        >
          <Settings :size="18" />
        </button>
      </div>
      
      <div class="space-y-3">
        <!-- 本周目标 -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-gray-600">本周目标：{{ goals.weeklyTarget }} 场</span>
            <div class="flex items-center space-x-1">
              <span class="text-sm font-semibold text-tennis-green">{{ weeklyMatches }}/{{ goals.weeklyTarget }}</span>
              <Award v-if="weeklyMatches >= goals.weeklyTarget" :size="16" class="text-yellow-500" />
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              class="bg-gradient-to-r from-tennis-green to-tennis-blue h-full rounded-full transition-all duration-500"
              :style="{ width: Math.min((weeklyMatches / goals.weeklyTarget) * 100, 100) + '%' }"
            ></div>
          </div>
          <p v-if="weeklyMatches >= goals.weeklyTarget" class="text-xs text-tennis-green mt-1 flex items-center">
            <Award :size="14" class="mr-1" /> 恭喜！本周目标已达成！
          </p>
        </div>
        
        <!-- 本月目标 -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-gray-600">本月目标：{{ goals.monthlyTarget }} 场</span>
            <span class="text-sm font-semibold text-tennis-blue">{{ monthlyMatches }}/{{ goals.monthlyTarget }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              class="bg-gradient-to-r from-tennis-blue to-tennis-green h-full rounded-full transition-all duration-500"
              :style="{ width: Math.min((monthlyMatches / goals.monthlyTarget) * 100, 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 目标设置对话框 -->
    <GoalSettingsDialog
      v-model:visible="showGoalSettings"
      @goals-saved="handleGoalsSaved"
    />

    <!-- 最近记录 -->
    <div v-if="recentMatches.length > 0">
      <div class="flex items-center space-x-2 mb-3">
        <Flame :size="18" class="text-tennis-blue" />
        <h3 class="font-semibold text-gray-900">最近记录</h3>
      </div>
      <div class="space-y-2">
        <TransitionGroup name="list" tag="div">
          <div
            v-for="(match, index) in recentMatches"
            :key="match.id"
            class="card overflow-hidden"
            :style="{ 'animation-delay': `${index * 0.1}s` }"
          >
            <div
              @click="toggleExpand(match.id)"
              class="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center space-x-3">
                <span class="text-2xl">{{ getMoodEmoji(match.mood) }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-center">
                    <p class="font-semibold text-gray-900">{{ formatDate(match.date) }}</p>
                    <div class="flex items-center space-x-2">
                      <span class="px-2 py-1 bg-tennis-green/10 text-tennis-green text-xs rounded-full">
                        {{ match.focus }}
                      </span>
                      <ChevronDown
                        v-if="!expandedMatchIds.has(match.id)"
                        :size="16"
                        class="text-gray-400"
                      />
                      <ChevronUp
                        v-else
                        :size="16"
                        class="text-gray-400"
                      />
                    </div>
                  </div>
                  <div class="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span>{{ match.duration }}分钟</span>
                    <span>评分: {{ match.selfRating }}</span>
                    <span>能量: {{ match.energyLevel }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 详细信息 -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="max-h-0 opacity-0"
              enter-to-class="max-h-[500px] opacity-100"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="max-h-[500px] opacity-100"
              leave-to-class="max-h-0 opacity-0"
            >
              <div v-if="expandedMatchIds.has(match.id)" class="px-3 pb-3 border-t border-gray-100 pt-3">
                <!-- 评分和能量 -->
                <div class="grid grid-cols-2 gap-3 mb-3">
                  <div class="flex items-center space-x-2 bg-yellow-50 rounded-lg px-3 py-2">
                    <Star :size="18" class="text-yellow-500" />
                    <div>
                      <p class="text-xs text-gray-500">自我评价</p>
                      <p class="font-semibold text-gray-900">{{ match.selfRating }}/10</p>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2 bg-orange-50 rounded-lg px-3 py-2">
                    <Zap :size="18" class="text-orange-500" />
                    <div>
                      <p class="text-xs text-gray-500">能量消耗</p>
                      <p class="font-semibold text-gray-900">{{ match.energyLevel }}/10</p>
                    </div>
                  </div>
                </div>
                
                <!-- 详细信息网格 -->
                <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div v-if="match.location" class="flex items-center space-x-2">
                    <MapPin :size="16" class="text-tennis-green" />
                    <span class="text-gray-600">场地：</span>
                    <span class="font-medium">{{ match.location }}</span>
                  </div>
                  <div v-if="match.partner" class="flex items-center space-x-2">
                    <User :size="16" class="text-tennis-blue" />
                    <span class="text-gray-600">搭档：</span>
                    <span class="font-medium">{{ match.partner }}</span>
                  </div>
                  <div v-if="match.weather" class="flex items-center space-x-2">
                    <Sun :size="16" class="text-yellow-500" />
                    <span class="text-gray-600">天气：</span>
                    <span class="font-medium">{{ match.weather }}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <Clock :size="16" class="text-tennis-blue" />
                    <span class="text-gray-600">时长：</span>
                    <span class="font-medium">{{ match.duration }}分钟</span>
                  </div>
                </div>
                
                <!-- 备注 -->
                <div v-if="match.notes" class="bg-gray-50 rounded-lg p-2">
                  <p class="text-xs text-gray-500 mb-1">备注</p>
                  <p class="text-sm text-gray-700">{{ match.notes }}</p>
                </div>
              </div>
            </Transition>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="card p-8 text-center">
      <div class="text-5xl mb-3">🎾</div>
      <p class="text-gray-500">还没有记录</p>
      <p class="text-gray-400 text-sm mt-1">点击右下角按钮开始记录</p>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
