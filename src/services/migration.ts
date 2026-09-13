import { migrationApi } from '../api/client';

interface LegacyMatch {
  id: string;
  date: string;
  duration: number;
  focus: string;
  mood: string;
  selfRating: number;
  energyLevel: number;
  notes?: string;
  location?: string;
  partner?: string;
  weather?: string;
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function removeLegacyPassword(username: string) {
  const accounts = readJson<Record<string, string>>('tennis_user_accounts');
  if (!accounts || !(username in accounts)) return;
  delete accounts[username];
  if (Object.keys(accounts).length) {
    localStorage.setItem('tennis_user_accounts', JSON.stringify(accounts));
  } else {
    localStorage.removeItem('tennis_user_accounts');
  }
}

export async function migrateLegacyData(username: string) {
  if (!username) return null;
  const markerKey = `tennis_cloud_migration_${username}`;
  if (localStorage.getItem(markerKey) === 'completed') return null;

  const status = await migrationApi.status();
  if (status.completed) {
    localStorage.setItem(markerKey, 'completed');
    removeLegacyPassword(username);
    return status;
  }

  const matches = readJson<LegacyMatch[]>(`tennis_matches_${username}`) ?? [];
  const legacyProfile = readJson<Record<string, unknown>>(`tennis_user_info_${username}`);
  const legacyGoal = readJson<{ weeklyTarget?: number; monthlyTarget?: number }>('tennis_goals');
  const result = await migrationApi.migrate({
    records: matches.map((match) => ({
      clientRecordId: match.id,
      occurredAt: new Date(match.date).toISOString(),
      durationMinutes: match.duration,
      focus: match.focus,
      mood: match.mood,
      selfRating: match.selfRating,
      energyLevel: match.energyLevel,
      notes: match.notes || null,
      location: match.location || null,
      partner: match.partner || null,
      weather: match.weather || null,
    })),
    ...(legacyProfile ? {
      profile: {
        nickname: legacyProfile.nickname,
        avatarUrl: legacyProfile.avatar || null,
        gender: legacyProfile.gender,
        age: legacyProfile.age,
        heightCm: legacyProfile.height,
        weightKg: legacyProfile.weight,
        playingYears: legacyProfile.playingYears,
        level: legacyProfile.level,
        phone: legacyProfile.phone || null,
        email: legacyProfile.email || null,
        bio: legacyProfile.bio,
        timezone: 'Asia/Shanghai',
      },
    } : {}),
    ...(legacyGoal ? {
      goal: {
        weeklyTargetCount: legacyGoal.weeklyTarget,
        monthlyTargetCount: legacyGoal.monthlyTarget,
      },
    } : {}),
  });
  if (result.completed) {
    localStorage.setItem(markerKey, 'completed');
    removeLegacyPassword(username);
  }
  return result;
}
