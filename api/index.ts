/**
 * Vercel Serverless Function 入口（api/ 目录约定）。
 *
 * 直接引用 TS 源码，由 Vercel 的 @vercel/node 运行时负责编译打包，
 * 不再依赖部署机上先跑 build:api 产出 dist-server（旧方案因此在
 * 平台上反复出现函数缺失、接口 404 的问题）。
 *
 * rewrites 已在 vercel.json 中把 /api/(.*) 转发到本函数。
 */
import app from '../server/vercel';

export default app;
