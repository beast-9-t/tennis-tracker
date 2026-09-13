<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { TennisMatch, MOOD_OPTIONS, FOCUS_OPTIONS } from '../types/tennis';
import { recordsApi } from '../api/client';
import { Calendar, Clock, Target, Smile, Star, Zap, MapPin, User, Sun, Trash2, ChevronDown, ChevronUp } from 'lucide-vue-next';

const matches = ref<TennisMatch[]>([]);
const expandedMatchId = ref<string | null>(null);
const filterDate = ref<'all' | 'week' | 'month'>('all');
const isLoading = ref(false);
const errorMsg = ref('');
const editingMatch = ref<TennisMatch | null>(null);
const editingDate = ref('');
const isSaving = ref(false);
const nextCursor = ref<string | null>(null);
const hasMore = ref(false);

onMounted(() => {
  loadMatches();
});

const loadMatches = async (append = false) => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const now = new Date();
    let startAt: string | undefined;
    if (filterDate.value === 'week') {
      const start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
      start.setHours(0, 0, 0, 0);
      startAt = start.toISOString();
    } else if (filterDate.value === 'month') {
      startAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    const result = await recordsApi.listPage({
      startAt,
      limit: 20,
      cursor: append ? nextCursor.value ?? undefined : undefined,
    });
    matches.value = append ? [...matches.value, ...result.data] : result.data;
    nextCursor.value = result.page.nextCursor;
    hasMore.value = result.page.hasMore;
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '记录加载失败';
  } finally {
    isLoading.value = false;
  }
};

const deleteMatch = async (matchId: string) => {
  if (confirm('确定要删除这条记录吗？')) {
    try {
      await recordsApi.delete(matchId);
      await loadMatches();
    } catch (error) {
      errorMsg.value = error instanceof Error ? error.message : '删除失败';
    }
  }
};

const toggleExpand = (matchId: string) => {
  expandedMatchId.value = expandedMatchId.value === matchId ? null : matchId;
};

const startEdit = (match: TennisMatch) => {
  editingMatch.value = { ...match, date: new Date(match.date) };
  const localDate = new Date(match.date.getTime() - match.date.getTimezoneOffset() * 60_000);
  editingDate.value = localDate.toISOString().slice(0, 16);
};

const saveEdit = async () => {
  if (!editingMatch.value || editingMatch.value.version === undefined) return;
  isSaving.value = true;
  errorMsg.value = '';
  try {
    await recordsApi.update(editingMatch.value.id, {
      date: new Date(editingDate.value),
      duration: editingMatch.value.duration,
      focus: editingMatch.value.focus,
      mood: editingMatch.value.mood,
      selfRating: editingMatch.value.selfRating,
      energyLevel: editingMatch.value.energyLevel,
      notes: editingMatch.value.notes,
      location: editingMatch.value.location,
      partner: editingMatch.value.partner,
      weather: editingMatch.value.weather,
      version: editingMatch.value.version,
    });
    editingMatch.value = null;
    await loadMatches();
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '保存修改失败';
  } finally {
    isSaving.value = false;
  }
};

const getMoodIcon = (mood: TennisMatch['mood']) => {
  const option = MOOD_OPTIONS.find(o => o.value === mood);
  return option?.label || mood;
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

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="space-y-4 pb-24">
    <div v-if="errorMsg" class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{{ errorMsg }}</div>
    <!-- 筛选器 -->
    <div class="card p-4">
      <div class="flex items-center space-x-2">
        <Calendar :size="20" class="text-tennis-green" />
        <span class="text-sm font-medium text-gray-700">筛选：</span>
        <button
          v-for="option in [
            { value: 'all', label: '全部' },
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
          ]"
          :key="option.value"
          @click="filterDate = option.value as any; loadMatches()"
          :class="[
            'px-3 py-1 rounded-lg text-sm transition-all duration-200',
            filterDate === option.value
              ? 'bg-tennis-green text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 记录列表 -->
    <div v-if="isLoading" class="text-center py-12 text-gray-500">正在加载训练记录...</div>

    <div v-else-if="matches.length === 0" class="text-center py-12">
      <div class="text-6xl mb-4">🎾</div>
      <p class="text-gray-500 text-lg">还没有网球记录</p>
      <p class="text-gray-400 text-sm mt-2">点击右下角的按钮添加第一条记录吧！</p>
    </div>

    <div v-else class="space-y-4">
      <TransitionGroup
        name="list"
        tag="div"
      >
        <div
          v-for="match in matches"
          :key="match.id"
          class="card overflow-hidden"
        >
          <!-- 基础信息 -->
          <div
            @click="toggleExpand(match.id)"
            class="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                  <span class="text-2xl">{{ getMoodEmoji(match.mood) }}</span>
                  <div>
                    <h3 class="font-semibold text-gray-900">{{ formatDate(match.date) }}</h3>
                    <p class="text-sm text-gray-500">{{ formatTime(match.date) }}</p>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-1 bg-tennis-green/10 text-tennis-green text-xs rounded-full font-medium">
                    {{ match.focus }}
                  </span>
                  <span class="px-2 py-1 bg-tennis-blue/10 text-tennis-blue text-xs rounded-full font-medium">
                    {{ match.duration }}分钟
                  </span>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-500">{{ getMoodIcon(match.mood) }}</span>
                <button
                  @click.stop="deleteMatch(match.id)"
                  class="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 :size="20" />
                </button>
                <ChevronDown
                  v-if="expandedMatchId !== match.id"
                  :size="20"
                  class="text-gray-400"
                />
                <ChevronUp
                  v-else
                  :size="20"
                  class="text-gray-400"
                />
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
            <div v-if="expandedMatchId === match.id" class="px-4 pb-4 border-t border-gray-100 pt-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="flex items-center space-x-2">
                  <Star :size="18" class="text-tennis-green" />
                  <span class="text-sm text-gray-600">自我评价：</span>
                  <span class="font-semibold">{{ match.selfRating }}/10</span>
                </div>
                <div class="flex items-center space-x-2">
                  <Zap :size="18" class="text-tennis-blue" />
                  <span class="text-sm text-gray-600">能量消耗：</span>
                  <span class="font-semibold">{{ match.energyLevel }}/10</span>
                </div>
                <div v-if="match.location" class="flex items-center space-x-2">
                  <MapPin :size="18" class="text-tennis-green" />
                  <span class="text-sm text-gray-600">场地：</span>
                  <span class="font-semibold">{{ match.location }}</span>
                </div>
                <div v-if="match.partner" class="flex items-center space-x-2">
                  <User :size="18" class="text-tennis-blue" />
                  <span class="text-sm text-gray-600">搭档：</span>
                  <span class="font-semibold">{{ match.partner }}</span>
                </div>
                <div v-if="match.weather" class="flex items-center space-x-2">
                  <Sun :size="18" class="text-tennis-green" />
                  <span class="text-sm text-gray-600">天气：</span>
                  <span class="font-semibold">{{ match.weather }}</span>
                </div>
              </div>
              <div v-if="match.notes" class="mt-4 p-3 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-700">{{ match.notes }}</p>
              </div>
              <button
                type="button"
                class="mt-4 w-full py-2 rounded-lg bg-blue-50 text-tennis-blue hover:bg-blue-100"
                @click="startEdit(match)"
              >
                编辑记录
              </button>
            </div>
          </Transition>
        </div>
      </TransitionGroup>
      <button
        v-if="hasMore"
        type="button"
        :disabled="isLoading"
        class="w-full py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50"
        @click="loadMatches(true)"
      >
        {{ isLoading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <div v-if="editingMatch" class="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4">
      <form class="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto" @submit.prevent="saveEdit">
        <h3 class="font-bold text-lg">编辑训练记录</h3>
        <label class="block text-sm">训练日期
          <input v-model="editingDate" type="datetime-local" class="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
        <label class="block text-sm">训练时长（分钟）
          <input v-model.number="editingMatch.duration" type="number" min="15" max="300" class="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
        <label class="block text-sm">训练重点
          <select v-model="editingMatch.focus" class="mt-1 w-full border rounded-lg px-3 py-2">
            <option v-for="focus in FOCUS_OPTIONS" :key="focus" :value="focus">{{ focus }}</option>
          </select>
        </label>
        <label class="block text-sm">心情
          <select v-model="editingMatch.mood" class="mt-1 w-full border rounded-lg px-3 py-2">
            <option v-for="mood in MOOD_OPTIONS" :key="mood.value" :value="mood.value">{{ mood.label }}</option>
          </select>
        </label>
        <label class="block text-sm">自我评价：{{ editingMatch.selfRating }}
          <input v-model.number="editingMatch.selfRating" type="range" min="1" max="10" class="w-full" />
        </label>
        <label class="block text-sm">能量消耗：{{ editingMatch.energyLevel }}
          <input v-model.number="editingMatch.energyLevel" type="range" min="1" max="10" class="w-full" />
        </label>
        <label class="block text-sm">场地
          <input v-model="editingMatch.location" class="mt-1 w-full border rounded-lg px-3 py-2" maxlength="120" />
        </label>
        <label class="block text-sm">搭档
          <input v-model="editingMatch.partner" class="mt-1 w-full border rounded-lg px-3 py-2" maxlength="80" />
        </label>
        <label class="block text-sm">备注
          <textarea v-model="editingMatch.notes" rows="3" maxlength="2000" class="mt-1 w-full border rounded-lg px-3 py-2"></textarea>
        </label>
        <div class="flex gap-3">
          <button type="button" class="flex-1 py-2 rounded-lg bg-gray-100" @click="editingMatch = null">取消</button>
          <button type="submit" :disabled="isSaving" class="flex-1 py-2 rounded-lg bg-tennis-green text-white disabled:opacity-50">
            {{ isSaving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
