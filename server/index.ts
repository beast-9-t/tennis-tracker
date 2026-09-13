import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadEnvFile } from './env.js';
import { createStoreFromEnv, resolveStoreDriver } from './factory.js';

loadEnvFile();

const port = Number(process.env.API_PORT || 3000);
const app = createApp(
  createStoreFromEnv({ defaultDataFile: resolve(process.cwd(), 'data', 'tennis-tracker.json') }),
  { storeName: resolveStoreDriver() },
);

app.listen(port, () => {
  console.log(`Tennis Tracker API listening on http://localhost:${port} (store: ${resolveStoreDriver()})`);
});
