export interface UserInfo {
  nickname: string;
  avatar: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  height: number;
  weight: number;
  playingYears: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  phone: string;
  email: string;
  bio: string;
}
