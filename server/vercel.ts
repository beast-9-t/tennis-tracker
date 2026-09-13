import { createApp } from './app.js';
import { createStoreFromEnv, resolveStoreDriver } from './factory.js';

/**
 * Vercel Serverless Function 入口。
 *
 * serverless 平台没有“启动”这一说，模块级只初始化一次，热实例之间复用
 * 同一个 Express app 与数据库配置。环境变量由 Vercel 控制台注入，
 * 因此这里不加载 .env。
 */
const app = createApp(createStoreFromEnv(), { storeName: resolveStoreDriver() });

export default app;
