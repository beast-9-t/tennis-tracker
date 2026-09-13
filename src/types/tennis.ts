export interface TennisMatch {
  id: string;
  date: Date;
  duration: number; // 分钟
  focus: string; // 训练重点
  mood: 'excellent' | 'good' | 'normal' | 'tired' | 'exhausted'; // 心情
  selfRating: number; // 自我评价 1-10
  energyLevel: number; // 能量消耗 1-10
  notes?: string; // 备注
  location?: string; // 场地位置
  partner?: string; // 搭档
  weather?: string; // 天气
  version?: number; // 服务端乐观锁版本
}

export type MoodType = TennisMatch['mood'];

export const MOOD_OPTIONS = [
  { value: 'excellent', label: '很棒', color: 'text-green-600' },
  { value: 'good', label: '不错', color: 'text-blue-600' },
  { value: 'normal', label: '一般', color: 'text-gray-600' },
  { value: 'tired', label: '疲惫', color: 'text-orange-600' },
  { value: 'exhausted', label: '精疲力尽', color: 'text-red-600' },
];

export const FOCUS_OPTIONS = [
  '正手',
  '反手',
  '发球',
  '截击',
  '高压球',
  '接发球',
  '脚步移动',
  '战术配合',
  '体能训练',
  '综合训练',
];
