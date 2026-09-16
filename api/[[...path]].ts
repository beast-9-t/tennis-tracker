/**
 * Vercel 可选 Catch-all 函数：文件名 [[...path]].ts
 * 让本函数通过文件系统路由直接接管 /api 下所有层级的路径
 * （如 /api/v1/auth/refresh），不依赖 vercel.json 的 rewrites。
 */
import app from '../server/vercel';

export default app;
