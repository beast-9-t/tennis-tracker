import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 极简 .env 加载器，仅用于本地开发。
 * 已存在的进程环境变量优先，不会覆盖 shell 或部署平台注入的配置。
 */
export function loadEnvFile(filePath = resolve(process.cwd(), '.env')): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}
