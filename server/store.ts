import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  DatabaseState,
  Feedback,
  MigrationStatus,
  Session,
  TrainingGoal,
  TrainingRecord,
  User,
} from './types.js';

const emptyState = (): DatabaseState => ({
  users: [],
  sessions: [],
  trainingRecords: [],
  trainingGoals: [],
  feedback: [],
  migrations: [],
});

/**
 * 数据访问契约。所有方法都是异步的，以便同时支持内存实现（本地开发 / 测试）
 * 与 CloudBase PostgreSQL 实现（生产环境）。
 *
 * 命名保持与业务语义一致，实现方负责持久化，调用方不需要再显式调用 persist()。
 */
export interface DataStore {
  findUserById(id: string): Promise<User | null>;
  findUserByNormalizedUsername(normalizedUsername: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  updateUser(user: User): Promise<void>;

  createSession(session: Session): Promise<void>;
  findSessionByAccessToken(accessToken: string): Promise<Session | null>;
  findSessionByRefreshToken(refreshToken: string): Promise<Session | null>;
  revokeSession(accessToken: string, revokedAt: string): Promise<void>;

  createTrainingRecord(record: TrainingRecord): Promise<void>;
  /** 返回指定用户下的记录（包含已软删除的），由调用方判断 deletedAt。 */
  findTrainingRecordById(id: string, userId: string): Promise<TrainingRecord | null>;
  findTrainingRecordByClientId(userId: string, clientRecordId: string): Promise<TrainingRecord | null>;
  /** 返回该用户未软删除的全部记录，过滤 / 排序 / 分页由调用方完成。 */
  listTrainingRecords(userId: string): Promise<TrainingRecord[]>;
  updateTrainingRecord(record: TrainingRecord): Promise<void>;

  findTrainingGoal(userId: string): Promise<TrainingGoal | null>;
  saveTrainingGoal(goal: TrainingGoal): Promise<void>;

  createFeedback(feedback: Feedback): Promise<void>;
  countFeedbackSince(userId: string, sinceIso: string): Promise<number>;

  findMigrationStatus(userId: string): Promise<MigrationStatus | null>;
  saveMigrationStatus(status: MigrationStatus): Promise<void>;
}

/**
 * 内存实现：数据保存在进程内。用于单元测试与无数据库的本地开发。
 * `state` 保持公开，便于测试直接准备 / 断言数据。
 */
export class MemoryStore implements DataStore {
  state: DatabaseState;

  constructor(initialState: DatabaseState = emptyState()) {
    this.state = structuredClone(initialState);
  }

  /** 内存实现无需落盘，保留该钩子以便子类覆写。 */
  protected persist(): void {}

  async findUserById(id: string): Promise<User | null> {
    return this.state.users.find((user) => user.id === id) ?? null;
  }

  async findUserByNormalizedUsername(normalizedUsername: string): Promise<User | null> {
    return this.state.users.find((user) => user.normalizedUsername === normalizedUsername) ?? null;
  }

  async createUser(user: User): Promise<void> {
    this.state.users.push(user);
    this.persist();
  }

  async updateUser(user: User): Promise<void> {
    const index = this.state.users.findIndex((item) => item.id === user.id);
    if (index >= 0) this.state.users[index] = user;
    else this.state.users.push(user);
    this.persist();
  }

  async createSession(session: Session): Promise<void> {
    this.state.sessions.push(session);
    this.persist();
  }

  async findSessionByAccessToken(accessToken: string): Promise<Session | null> {
    return this.state.sessions.find((item) => item.accessToken === accessToken) ?? null;
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.state.sessions.find((item) => item.refreshToken === refreshToken) ?? null;
  }

  async revokeSession(accessToken: string, revokedAt: string): Promise<void> {
    const session = this.state.sessions.find((item) => item.accessToken === accessToken);
    if (session) session.revokedAt = revokedAt;
    this.persist();
  }

  async createTrainingRecord(record: TrainingRecord): Promise<void> {
    this.state.trainingRecords.push(record);
    this.persist();
  }

  async findTrainingRecordById(id: string, userId: string): Promise<TrainingRecord | null> {
    return this.state.trainingRecords.find((item) => item.id === id && item.userId === userId) ?? null;
  }

  async findTrainingRecordByClientId(userId: string, clientRecordId: string): Promise<TrainingRecord | null> {
    return (
      this.state.trainingRecords.find(
        (item) => item.userId === userId && item.clientRecordId === clientRecordId,
      ) ?? null
    );
  }

  async listTrainingRecords(userId: string): Promise<TrainingRecord[]> {
    return this.state.trainingRecords.filter((item) => item.userId === userId && !item.deletedAt);
  }

  async updateTrainingRecord(record: TrainingRecord): Promise<void> {
    const index = this.state.trainingRecords.findIndex((item) => item.id === record.id);
    if (index >= 0) this.state.trainingRecords[index] = record;
    else this.state.trainingRecords.push(record);
    this.persist();
  }

  async findTrainingGoal(userId: string): Promise<TrainingGoal | null> {
    return this.state.trainingGoals.find((item) => item.userId === userId) ?? null;
  }

  async saveTrainingGoal(goal: TrainingGoal): Promise<void> {
    const index = this.state.trainingGoals.findIndex((item) => item.userId === goal.userId);
    if (index >= 0) this.state.trainingGoals[index] = goal;
    else this.state.trainingGoals.push(goal);
    this.persist();
  }

  async createFeedback(feedback: Feedback): Promise<void> {
    this.state.feedback.push(feedback);
    this.persist();
  }

  async countFeedbackSince(userId: string, sinceIso: string): Promise<number> {
    const since = Date.parse(sinceIso);
    return this.state.feedback.filter(
      (item) => item.userId === userId && Date.parse(item.createdAt) >= since,
    ).length;
  }

  async findMigrationStatus(userId: string): Promise<MigrationStatus | null> {
    return this.state.migrations.find((item) => item.userId === userId) ?? null;
  }

  async saveMigrationStatus(status: MigrationStatus): Promise<void> {
    const index = this.state.migrations.findIndex((item) => item.userId === status.userId);
    if (index >= 0) this.state.migrations[index] = status;
    else this.state.migrations.push(status);
    this.persist();
  }
}

/** JSON 文件实现：仅用于本地开发。不适合无状态容器 / 云函数（实例本地磁盘不持久）。 */
export class JsonFileStore extends MemoryStore {
  constructor(private readonly filePath: string) {
    super(readState(filePath));
  }

  protected override persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }
}

function readState(filePath: string): DatabaseState {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<DatabaseState>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}
