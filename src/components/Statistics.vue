<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { dashboardApi, statisticsApi } from '../api/client';
import { Trophy, Clock, Target, TrendingUp, Activity, Calendar, Settings, ChevronDown, ChevronUp } from 'lucide-vue-next';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { GridComponent } from 'echarts/components';
import GoalSettingsDialog from './GoalSettingsDialog.vue';

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const showGoalSettings = ref(false);
const isLoading = ref(false);
const errorMsg = ref('');
const summary = ref({ totalMatches: 0, totalDurationMinutes: 0, averageRating: 0, averageEnergy: 0, mostPlayedFocus: null as string | null });
const monthlySummary = ref({ totalMatches: 0, totalDurationMinutes: 0, averageRating: 0, averageEnergy: 0, mostPlayedFocus: null as string | null });
const overview = ref<Awaited<ReturnType<typeof dashboardApi.getOverview>> | null>(null);
const trendData = ref<Array<{ period: string; durationMinutes: number }>>([]);
const moodDistribution = ref<Record<string, number>>({ excellent: 0, good: 0, normal: 0, tired: 0, exhausted: 0 });

const refreshData = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    const weekday = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const allFrom = '1970-01-01T00:00:00.000Z';
    const [dashboard, allSummary, currentMonth, trend, moods] = await Promise.all([
      dashboardApi.getOverview(),
      statisticsApi.summary(allFrom, end.toISOString()),
      statisticsApi.summary(monthStart.toISOString(), end.toISOString()),
      statisticsApi.durationTrend(weekStart.toISOString(), weekEnd.toISOString(), 'day'),
      statisticsApi.moodDistribution(allFrom, end.toISOString()),
    ]);
    overview.value = dashboard;
    summary.value = allSummary;
    monthlySummary.value = currentMonth;
    trendData.value = trend;
    moodDistribution.value = Object.fromEntries(moods.map((item) => [item.mood, item.count]));
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '统计数据加载失败';
  } finally {
    isLoading.value = false;
  }
};

onMounted(refreshData);

const totalMatches = computed(() => summary.value.totalMatches);
const totalDuration = computed(() => summary.value.totalDurationMinutes);
const averageRating = computed(() => summary.value.averageRating.toFixed(1));
const averageEnergy = computed(() => summary.value.averageEnergy.toFixed(1));
const mostPlayedFocus = computed(() => summary.value.mostPlayedFocus || '无');
const weeklyMatches = computed(() => overview.value?.weeklyMatches ?? 0);
const monthlyMatches = computed(() => overview.value?.monthlyMatches ?? 0);
const monthlyDuration = computed(() => monthlySummary.value.totalDurationMinutes);
const goals = computed(() => ({
  weeklyTarget: overview.value?.goal.weeklyTargetCount ?? 4,
  monthlyTarget: overview.value?.goal.monthlyTargetCount ?? 16,
}));

const getMoodPercentage = (mood: string) => {
  if (totalMatches.value === 0) return 0;
  const count = moodDistribution.value[mood] || 0;
  return ((count / totalMatches.value) * 100).toFixed(0);
};

const getMoodColor = (mood: string) => {
  const colors: Record<string, string> = {
    excellent: '#22c55e',
    good: '#3b82f6',
    normal: '#6b7280',
    tired: '#f97316',
    exhausted: '#ef4444',
  };
  return colors[mood] || '#6b7280';
};

const getMoodLabel = (mood: string) => {
  const labels: Record<string, string> = {
    excellent: '很棒',
    good: '不错',
    normal: '一般',
    tired: '疲惫',
    exhausted: '精疲力尽',
  };
  return labels[mood] || mood;
};

// 获取本周日期范围
const getWeekDays = () => {
  const days: { label: string; date: Date }[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + mondayOffset + i);
    const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    days.push({
      label: weekDayNames[i],
      date: date,
    });
  }
  return days;
};

// 计算本周每天的训练时长
const weeklyDailyDuration = computed(() => {
  const weekDays = getWeekDays();
  // 初始化每天的数据
  const dailyDurations: Record<string, number> = {};
  weekDays.forEach(day => {
    dailyDurations[day.label] = 0;
  });
  
  // 统计本周的训练时长
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  trendData.value.forEach(item => {
    const itemDate = new Date(`${item.period}T12:00:00`);
    const itemDay = itemDate.getDay();
    const dayIndex = itemDay === 0 ? 6 : itemDay - 1;
    const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    dailyDurations[weekDayNames[dayIndex]] += item.durationMinutes;
  });
  
  return {
    categories: weekDays.map(d => d.label),
    data: weekDays.map(d => (dailyDurations[d.label] / 60).toFixed(1)), // 转换为小时
    rawMinutes: weekDays.map(d => dailyDurations[d.label]),
  };
});

// 柱状图配置 - 本周每日训练时长
const barChartOption = computed(() => {
  const colors = [
    '#56ab2f', // 周一 - 网球绿
    '#4caf50', // 周二
    '#8bc34a', // 周三
    '#1976d2', // 周四 - 网球蓝
    '#2196f3', // 周五
    '#03a9f4', // 周六
    '#00bcd4', // 周日
  ];
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const data = params[0];
        const hours = parseFloat(data.value);
        const minutes = weeklyDailyDuration.value.rawMinutes[data.dataIndex];
        return `${data.name}<br/>训练时长: ${hours}小时 (${minutes}分钟)`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '12%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: weeklyDailyDuration.value.categories,
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          lineStyle: {
            color: '#e2e8f0',
          },
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '小时',
        nameTextStyle: {
          color: '#64748b',
          fontSize: 12,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
        },
      },
    ],
    series: [
      {
        name: '训练时长',
        type: 'bar',
        barWidth: '50%',
        data: weeklyDailyDuration.value.data.map((value, index) => ({
          value: value,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: colors[index] },
                { offset: 1, color: colors[index] + '80' },
              ],
            },
            borderRadius: [8, 8, 0, 0],
          },
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        animationDelay: (idx: number) => idx * 100,
      },
    ],
    animationEasing: 'elasticOut' as const,
    animationDelayUpdate: (idx: number) => idx * 5,
  };
});

// 环形图配置
const pieChartOption = computed(() => {
  const data = Object.entries(moodDistribution.value)
    .filter(([_, count]) => count > 0)
    .map(([mood, count]) => ({
      name: getMoodLabel(mood),
      value: count,
      itemStyle: {
        color: getMoodColor(mood),
      },
    }));
  
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '心情分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: true,
        },
        data: data,
      },
    ],
  };
});
</script>

<template>
  <div class="space-y-4 pb-24">
    <div v-if="errorMsg" class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{{ errorMsg }}</div>
    <div v-if="isLoading" class="text-center py-12 text-gray-500">正在加载统计数据...</div>
    <div v-else-if="totalMatches === 0" class="text-center py-12">
      <div class="text-6xl mb-4">📊</div>
      <p class="text-gray-500 text-lg">还没有数据可分析</p>
      <p class="text-gray-400 text-sm mt-2">添加一些网球记录后再来看看统计数据吧！</p>
    </div>

    <div v-else>
      <!-- 训练目标 -->
      <div class="card p-4 mb-4">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <Target :size="20" class="text-tennis-green" />
            <span>训练目标</span>
          </div>
          <button
            @click="showGoalSettings = true"
            class="text-tennis-blue hover:text-tennis-green transition-colors"
          >
            <Settings :size="20" />
          </button>
        </h3>
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">本周目标：{{ goals.weeklyTarget }} 场</span>
              <span class="font-semibold text-tennis-green">{{ weeklyMatches }}/{{ goals.weeklyTarget }}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                class="bg-gradient-to-r from-tennis-green to-tennis-blue h-full rounded-full transition-all duration-500 relative"
                :style="{ width: Math.min((weeklyMatches / goals.weeklyTarget) * 100, 100) + '%' }"
              >
                <div v-if="weeklyMatches >= goals.weeklyTarget" class="absolute inset-0 bg-gradient-to-r from-yellow-300 to-yellow-500"></div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">本月目标：{{ goals.monthlyTarget }} 场</span>
              <span class="font-semibold text-tennis-blue">{{ monthlyMatches }}/{{ goals.monthlyTarget }}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                class="bg-gradient-to-r from-tennis-blue to-tennis-green h-full rounded-full transition-all duration-500"
                :style="{ width: Math.min((monthlyMatches / goals.monthlyTarget) * 100, 100) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="card p-4 animate-float" style="animation-delay: 0s;">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">总场次</p>
              <p class="text-2xl font-bold text-tennis-green">{{ totalMatches }}</p>
            </div>
            <Trophy :size="32" class="text-tennis-green opacity-50" />
          </div>
        </div>

        <div class="card p-4 animate-float" style="animation-delay: 0.1s;">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">总时长</p>
              <p class="text-2xl font-bold text-tennis-blue">{{ (totalDuration / 60).toFixed(1) }}h</p>
            </div>
            <Clock :size="32" class="text-tennis-blue opacity-50" />
          </div>
        </div>

        <div class="card p-4 animate-float" style="animation-delay: 0.2s;">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">平均评分</p>
              <p class="text-2xl font-bold text-tennis-green">{{ averageRating }}</p>
            </div>
            <Target :size="32" class="text-tennis-green opacity-50" />
          </div>
        </div>

        <div class="card p-4 animate-float" style="animation-delay: 0.3s;">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">平均能量</p>
              <p class="text-2xl font-bold text-tennis-blue">{{ averageEnergy }}</p>
            </div>
            <Activity :size="32" class="text-tennis-blue opacity-50" />
          </div>
        </div>
      </div>

      <!-- 近期统计 -->
      <div class="card p-4 mb-4">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Calendar :size="20" class="text-tennis-green" />
          <span>近期统计</span>
        </h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">本周场次</span>
            <span class="font-semibold text-tennis-green">{{ weeklyMatches }} 场</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">本月场次</span>
            <span class="font-semibold text-tennis-blue">{{ monthlyMatches }} 场</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">本月训练</span>
            <span class="font-semibold text-tennis-green">{{ (monthlyDuration / 60).toFixed(1) }} 小时</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">最常练习</span>
            <span class="font-semibold text-tennis-blue">{{ mostPlayedFocus }}</span>
          </div>
        </div>
      </div>

      <!-- 本周每日训练时长图表 -->
      <div class="card p-4 mb-4">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <TrendingUp :size="20" class="text-tennis-green" />
          <span>本周每日训练时长</span>
        </h3>
        <VChart class="h-80" :option="barChartOption" autoresize />
        <div class="mt-3 text-center text-sm text-gray-500">
          每个柱子代表当天的训练时长，颜色各异便于区分
        </div>
      </div>

      <!-- 心情分布图表 -->
      <div class="card p-4 mb-4">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <TrendingUp :size="20" class="text-tennis-green" />
          <span>心情分布</span>
        </h3>
        <VChart class="h-80" :option="pieChartOption" autoresize />
      </div>

      <!-- 目标设置对话框 -->
      <GoalSettingsDialog
        v-model:visible="showGoalSettings"
        @goals-saved="refreshData"
      />
    </div>
  </div>
</template>
