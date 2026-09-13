export type Gender = 'male' | 'female' | 'other' | 'undisclosed';
export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type Mood = 'excellent' | 'good' | 'normal' | 'tired' | 'exhausted';

export interface UserProfile {
  nickname: string;
  avatarUrl: string | null;
  gender: Gender;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  playingYears: number | null;
  level: PlayerLevel;
  phone: string | null;
  email: string | null;
  bio: string;
  timezone: string;
  version: number;
}

export interface User {
  id: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  status: 'active' | 'disabled';
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  revokedAt: string | null;
}

export interface TrainingRecord {
  id: string;
  userId: string;
  clientRecordId: string | null;
  occurredAt: string;
  durationMinutes: number;
  focus: string;
  mood: Mood;
  selfRating: number;
  energyLevel: number;
  notes: string | null;
  location: string | null;
  partner: string | null;
  weather: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TrainingGoal {
  userId: string;
  weeklyTargetCount: number;
  monthlyTargetCount: number;
  weekStartsOn: 1;
  timezone: string;
  version: number;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  userId: string;
  content: string;
  status: 'new' | 'processing' | 'resolved' | 'closed';
  createdAt: string;
}

export interface MigrationStatus {
  userId: string;
  completed: boolean;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  lastMigratedAt: string | null;
}

export interface DatabaseState {
  users: User[];
  sessions: Session[];
  trainingRecords: TrainingRecord[];
  trainingGoals: TrainingGoal[];
  feedback: Feedback[];
  migrations: MigrationStatus[];
}
