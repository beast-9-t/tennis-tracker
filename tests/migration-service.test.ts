import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrationApi } from '../src/api/client';
import { migrateLegacyData } from '../src/services/migration';

describe('本地数据迁移服务', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('映射旧数据并在成功后保留原数据、写入完成标记', async () => {
    localStorage.setItem('tennis_matches_alice', JSON.stringify([{
      id: 'legacy-1', date: '2026-09-13T00:00:00.000Z', duration: 90,
      focus: '综合训练', mood: 'good', selfRating: 8, energyLevel: 7,
    }]));
    localStorage.setItem('tennis_user_accounts', JSON.stringify({ alice: 'plain-password', bob: 'keep-bob' }));
    vi.spyOn(migrationApi, 'status').mockResolvedValue({ completed: false, importedCount: 0, skippedCount: 0, failedCount: 0 });
    const migrate = vi.spyOn(migrationApi, 'migrate').mockResolvedValue({
      completed: true,
      batch: { importedCount: 1, skippedCount: 0, failedCount: 0, errors: [] },
    });

    await migrateLegacyData('alice');

    expect(migrate.mock.calls[0][0].records[0]).toMatchObject({
      clientRecordId: 'legacy-1', durationMinutes: 90,
    });
    expect(localStorage.getItem('tennis_matches_alice')).not.toBeNull();
    expect(localStorage.getItem('tennis_cloud_migration_alice')).toBe('completed');
    expect(JSON.parse(localStorage.getItem('tennis_user_accounts') ?? '{}')).toEqual({ bob: 'keep-bob' });
  });

  it('已有完成标记时不会重复请求服务端', async () => {
    localStorage.setItem('tennis_cloud_migration_alice', 'completed');
    const status = vi.spyOn(migrationApi, 'status');

    await migrateLegacyData('alice');

    expect(status).not.toHaveBeenCalled();
  });
});
