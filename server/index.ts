import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadEnvFile } from './env.js';
import { createStoreFromEnv, resolveStoreDriver } from './factory.js';

loadEnvFile();

// 云服务器 / 容器平台通常注入 PORT；本地开发沿用 API_PORT。
const port = Number(process.env.PORT || process.env.API_PORT || 3000);
const staticDir = resolve(process.cwd(), 'dist');

const app = createApp(
  createStoreFromEnv({ defaultDataFile: resolve(process.cwd(), 'data', 'tennis-tracker.json') }),
  {
    storeName: resolveStoreDriver(),
    // 构建产物存在时由 Express 同源托管前端，后端接口天然同源，无需 CORS 配置。
    ...(existsSync(staticDir) ? { staticDir } : {}),
  },
);

app.listen(port, '0.0.0.0', () => {
  console.log(`Tennis Tracker listening on http://0.0.0.0:${port} (store: ${resolveStoreDriver()})`);
});
