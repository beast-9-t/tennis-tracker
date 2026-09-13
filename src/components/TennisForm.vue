<script setup lang="ts">
import { ref, reactive } from 'vue';
import { TennisMatch, MOOD_OPTIONS, FOCUS_OPTIONS } from '../types/tennis';
import { recordsApi } from '../api/client';

const emit = defineEmits<{
  'match-added': [];
}>();

const showForm = ref(false);
const isSubmitting = ref(false);
const errorMsg = ref('');

const formData = reactive({
  date: new Date().toISOString().split('T')[0],
  duration: 90,
  focus: '综合训练',
  mood: 'good',
  selfRating: 7,
  energyLevel: 5,
  notes: '',
  location: '',
  partner: '',
  weather: '晴天',
});

const weatherOptions = ['晴天', '多云', '阴天', '小雨', '大雨', '刮风'];

const handleSubmit = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  errorMsg.value = '';

  try {
    await recordsApi.create({
      date: new Date(`${formData.date}T12:00:00`),
      duration: formData.duration,
      focus: formData.focus,
      mood: formData.mood as TennisMatch['mood'],
      selfRating: formData.selfRating,
      energyLevel: formData.energyLevel,
      notes: formData.notes,
      location: formData.location,
      partner: formData.partner,
      weather: formData.weather,
    });
    formData.date = new Date().toISOString().split('T')[0];
    formData.duration = 90;
    formData.focus = '综合训练';
    formData.mood = 'good';
    formData.selfRating = 7;
    formData.energyLevel = 5;
    formData.notes = '';
    formData.location = '';
    formData.partner = '';
    formData.weather = '晴天';
    showForm.value = false;
    emit('match-added');
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '保存失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
};

const toggleForm = () => {
  showForm.value = !showForm.value;
};
</script>

<template>
  <!-- 浮动按钮 -->
  <div class="fixed bottom-24 right-4 z-50">
    <!-- 表单弹窗 -->
    <div 
      v-if="showForm" 
      class="absolute bottom-16 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    >
      <!-- 表单头部 -->
      <div class="bg-gradient-to-r from-green-500 to-blue-500 px-4 py-3 flex justify-between items-center">
        <h3 class="text-lg font-bold text-white">🎾 记录网球训练</h3>
        <button 
          @click="showForm = false"
          class="text-white hover:text-gray-200 text-2xl leading-none"
        >×</button>
      </div>
      
      <!-- 表单内容 -->
      <div class="p-4 max-h-[70vh] overflow-y-auto">
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="errorMsg" class="p-2 rounded-lg bg-red-50 text-red-600 text-sm">
            {{ errorMsg }}
          </div>
          <!-- 日期 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">📅 训练日期</label>
            <input 
              v-model="formData.date"
              type="date" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            />
          </div>

          <!-- 时长 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">⏱️ 训练时长 (分钟)</label>
            <input 
              v-model.number="formData.duration"
              type="number"
              min="15"
              max="300"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="请输入时长"
            />
          </div>

          <!-- 训练重点 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">🎯 训练重点</label>
            <select 
              v-model="formData.focus"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            >
              <option v-for="option in FOCUS_OPTIONS" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <!-- 心情 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">😊 心情</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in MOOD_OPTIONS"
                :key="option.value"
                type="button"
                @click="formData.mood = option.value"
                :class="[
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  formData.mood === option.value
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- 自我评价 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">⭐ 自我评价: {{ formData.selfRating }}/10</label>
            <input 
              v-model.number="formData.selfRating"
              type="range"
              min="1"
              max="10"
              class="w-full accent-green-500"
            />
          </div>

          <!-- 能量消耗 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">⚡ 能量消耗: {{ formData.energyLevel }}/10</label>
            <input 
              v-model.number="formData.energyLevel"
              type="range"
              min="1"
              max="10"
              class="w-full accent-blue-500"
            />
          </div>

          <!-- 场地位置 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">📍 场地位置</label>
            <input 
              v-model="formData.location"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="例如：奥林匹克网球馆"
            />
          </div>

          <!-- 搭档 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">👤 搭档</label>
            <input 
              v-model="formData.partner"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="例如：张三"
            />
          </div>

          <!-- 天气 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">🌤️ 天气</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="weather in weatherOptions"
                :key="weather"
                type="button"
                @click="formData.weather = weather"
                :class="[
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  formData.weather === weather
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                {{ weather }}
              </button>
            </div>
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">📝 备注</label>
            <textarea 
              v-model="formData.notes"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 resize-none"
              placeholder="记录今天的训练心得..."
            ></textarea>
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all shadow-lg disabled:opacity-50"
          >
            {{ isSubmitting ? '保存中...' : '💾 保存记录' }}
          </button>
        </form>
      </div>
    </div>

    <!-- + 按钮 -->
    <button
      @click="toggleForm"
      class="w-14 h-14 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center text-3xl font-light"
    >
      {{ showForm ? '×' : '+' }}
    </button>
  </div>
</template>

<style scoped>
/* 确保文字可见 */
input, select, textarea {
  color: #1f2937 !important;
  background-color: white !important;
}

input::placeholder,
textarea::placeholder {
  color: #9ca3af !important;
}
</style>
