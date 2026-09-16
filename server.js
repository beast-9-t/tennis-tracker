/**
 * Vercel 官方 zero-config Express 入口（仓库根目录）。
 *
 * 实测发现：api/ 目录 + vercel.json rewrites 的方式下，多级子路径
 * （如 /api/v1/health）无法被 rewrite 转发到函数（单级可以），平台直接 404。
 * 改用官方 zero-config Express 模式：入口文件放在仓库根，
 * Vercel 自动把整个 Express 应用作为单个函数挂到所有路径，
 * 不再依赖 rewrites 转发。
 *
 * 服务端 TS 由 `npm run build:api` 编译到 dist-server/server，这里只做转发。
 */
import app from './dist-server/server/vercel.js';

export default app;
