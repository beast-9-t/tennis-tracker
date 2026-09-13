/**
 * Vercel Serverless Function 入口：/api/* 全部转发给 Express 应用。
 *
 * 服务端 TypeScript 由 `npm run build:api` 编译到 dist-server/server，
 * 这里只做一层薄转发，避免在 api/ 目录里再做一次 TS 构建。
 */
import app from '../dist-server/server/vercel.js';

export default function handler(req, res) {
  // Vercel 一般保留完整路径；若平台改写成去掉 /api 前缀，这里补回来。
  if (typeof req.url === 'string' && req.url !== '/api' && !req.url.startsWith('/api/')) {
    req.url = `/api${req.url}`;
  }
  return app(req, res);
}
