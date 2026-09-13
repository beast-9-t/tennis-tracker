import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Statistics from '../src/components/Statistics.vue';
import { dashboardApi, statisticsApi } from '../src/api/client';

describe('统计分析图表配置', () => {
  beforeEach(() => {
    const today = new Date();
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    vi.spyOn(dashboardApi, 'getOverview').mockResolvedValue({
      totalMatches: 1, totalDurationMinutes: 90, weeklyMatches: 1, monthlyMatches: 1,
      lastMatch: null, recentMatches: [],
      goal: { weeklyTargetCount: 4, monthlyTargetCount: 16, weekStartsOn: 1, timezone: 'Asia/Shanghai', version: 1 },
    });
    vi.spyOn(statisticsApi, 'summary').mockResolvedValue({
      totalMatches: 1, totalDurationMinutes: 90, averageRating: 8,
      averageEnergy: 7, mostPlayedFocus: '综合训练',
    });
    vi.spyOn(statisticsApi, 'durationTrend').mockResolvedValue([{ period, durationMinutes: 90 }]);
    vi.spyOn(statisticsApi, 'moodDistribution').mockResolvedValue([
      { mood: 'good', count: 1, percentage: 100 },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('生成符合 ECharts 类型约束的柱状图配置', async () => {
    const wrapper = mount(Statistics, {
      global: {
        stubs: {
          Echarts: true,
          GoalSettingsDialog: true,
        },
      },
    });
    await flushPromises();

    const barOption = (wrapper.vm as unknown as {
      barChartOption: {
        animationEasing: string;
        series: Array<{ type: string; data: Array<{ value: string }> }>;
      };
    }).barChartOption;

    expect(barOption.animationEasing).toBe('elasticOut');
    expect(barOption.series[0].type).toBe('bar');
    expect(
      barOption.series[0].data.reduce(
        (total, item) => total + Number(item.value),
        0,
      ),
    ).toBe(1.5);
  });
});
