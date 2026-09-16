# Vercel + Supabase 部署指南

本指南面向"前端 + API 部署在 Vercel，数据库托管在 Supabase"的部署方式。整套流程约 15 分钟。

## 前置条件

- 已有 Supabase 项目（项目 URL 类似 `https://xxxx.supabase.co`）
- 已有 Vercel 账号（已登录）
- 已 clone / fork 本仓库到自己的 GitHub / GitLab

---

## 第一步：在 Supabase 中初始化数据库（必做）

Vercel 构建过程**不会**自动创建表。你必须手动执行 schema 脚本。

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 左侧菜单 → **SQL Editor** → **New query**
4. 把本仓库 `supabase/schema.sql` 的全部内容复制粘贴进去
5. 点击右下角 **Run**
6. 等待执行完成（脚本幂等，可重复执行）
7. 验证：左侧菜单 → **Table Editor**，应该看到 6 张表：
   - `users`
   - `sessions`
   - `training_records`
   - `training_goals`
   - `feedback`
   - `migration_status`

> 报错怎么办？看 SQL Editor 底部红色报错。最常见的是复制粘贴时漏了开头的注释 `--`，重新复制完整内容即可。

---

## 第二步：拿到 Supabase 凭据（必做）

1. Supabase → 左侧菜单 → **Project Settings** → **API**
2. 复制两项：
   - **Project URL**（格式：`https://xxxx.supabase.co`）→ 这是 `SUPABASE_URL`
   - **Project API keys** 里的 **`service_role`** 一行的 `secret` 值（不是 `anon public` ！）→ 这是 `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **`service_role` 密钥是后端钥匙，权限等同数据库管理员**。它**绝对不能**进前端代码、不能用 `VITE_` 前缀的环境变量暴露给浏览器、不能提交到 git。只能放在 Vercel 控制台的 Environment Variables 里。

---

## 第三步：在 Vercel 部署（必做）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. **Add New...** → **Project** → 选你的 Git 仓库 → **Import**
3. 进入配置页（Project Settings 之前的页面）：

   | 项 | 值 | 备注 |
   |---|---|---|
   | Framework Preset | Vite | 自动识别，不动 |
   | Build Command | （留空） | `vercel.json` 已写 |
   | Output Directory | （留空） | `vercel.json` 已写 |
   | Install Command | （留空） | 默认 `npm install` |

4. **Environment Variables** 区域，点 **Add**，依次加：

   | Name | Value | 说明 |
   |---|---|---|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` | 从第二步复制 |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | 从第二步复制（**service_role 不是 anon**） |

   > 三个环境（Production / Preview / Development）可以都勾选。建议 Production 必勾。

   > ⚠️ **不要**再额外加 `NODE_ENV=production`。
   > Vercel 运行时会自己把 `NODE_ENV` 置为 `production`，而一旦它出现在项目环境变量里，
   > 依赖安装阶段会进入 production 模式、**跳过全部 `devDependencies`**（`vite`、`typescript`、
   > `vue-tsc`、`@vitejs/plugin-vue` 都在 devDependencies 里），构建会在 `npm run build` 处直接失败。
   > `vercel.json` 已写入 `"installCommand": "npm install --production=false"` 兜底，但最省事的做法是别设它。

5. 点 **Deploy**，等待构建完成（约 1-3 分钟）。

> Vercel 第一次构建可能下载依赖较慢，超时自动延长。如仍失败，去项目 → Settings → Functions → 检查 maxDuration。

---

## 第四步：验证部署（必做）

依次验证 3 步，缺一不可：

### 1. 后端活了吗

浏览器访问：

```
https://你的app.vercel.app/api/v1/health
```

预期返回：

```json
{"data":{"status":"ok","store":"supabase"}, ...}
```

- ✅ `store` 是 `"supabase"` → 后端连上 Supabase 了
- ❌ `store` 是 `"json"` → 环境变量没生效，去 Vercel 项目 → Settings → Environment Variables 检查
- ❌ 404 → 部署没成功，去 Vercel → Deployments → 看构建日志

### 2. 注册并登录

浏览器打开首页：

```
https://你的app.vercel.app
```

- 点击"注册"，填用户名密码
- 应该自动登录进入主页

### 3. 数据落库了吗

- 在应用里添加一条训练记录
- 去 Supabase → **Table Editor** → `users` 和 `training_records`
- 应该能看到刚才的新行

如果第 1 步 OK 但第 3 步看不到数据：检查浏览器 Console 是否有 4xx/5xx 报错；去 Vercel 项目 → Logs 看后端日志。

---

## 常见问题

### Q1: 部署成功但 `/api/v1/health` 返回 500

看 Vercel → Deployments → 选最近一次 → Logs。一般是：

- `SUPABASE_URL` 写错了（少 `/`、多个空格）
- `SUPABASE_SERVICE_ROLE_KEY` 复制成了 `anon` 而不是 `service_role`
- 数据库表还没创建

### Q2: 浏览器出现 CORS 错误

默认前后端在同域（都是 `xxx.vercel.app` 下），**不需要**任何 CORS 配置。

只有当你设置了 `VITE_API_BASE_URL=https://其他域名` 把前端请求切到其他域时，才需要在 Vercel 加 `CORS_ORIGINS=https://你的前端域名`，多个用逗号分隔。

### Q3: 冷启动后第一次请求慢（504 超时）

`vercel.json` 已经把 `maxDuration` 设为 30 秒。如果仍然超时：

- Vercel → Settings → **Functions** → 确认 maxDuration 生效
- 检查是不是大文件上传（Vercel 函数请求体默认 4.5 MB）

### Q4: 我用了 Cloudflare / 阿里云部署脚本，能一起用吗？

本项目仓库里的 `deploy/aliyun-setup.sh` 是阿里云 ECS 部署脚本，与 Vercel **互斥**。一份代码只能用一种部署方式，别混用。

### Q5: 怎么回滚到上一个版本？

Vercel → Deployments → 选一个之前的成功部署 → 右上角菜单 → **Promote to Production**。

### Q6: 页面能打开，但注册报「请求失败」，而且 Logs 里一条请求都没有？

这个组合（**前端正常 + 后端零日志**）几乎只有一个解释：**API 函数压根没部署上去**，
请求在 Vercel 平台层就被 404 掉了，根本没进入函数，所以不会有任何运行日志。
前端拿到的是一段非 JSON 的 404 页面，只能显示兜底文案。

一步确认（把域名换成你自己的）：

```bash
curl -i https://你的app.vercel.app/api/v1/health
```

| 结果 | 含义 | 处理 |
|---|---|---|
| `200` + `{"data":{"status":"ok","store":"supabase"}}` | 后端正常 | 继续查浏览器 Network |
| `404` + 响应头 `X-Vercel-Error: NOT_FOUND` | 函数不存在，部署没成功 | 看下面 |
| `500` | 函数在，但启动就抛错（多为环境变量/建表缺失） | 看 Runtime Logs 首条错误 |

遇到 `X-Vercel-Error: NOT_FOUND` 时按顺序排查：

1. **Deployments 里最近一次部署是不是红色 Error**。若是，点进去看 Build Logs：
   - 报 `vite: not found` / `vue-tsc: not found` / TypeScript 相关缺失 → 就是上面的 `NODE_ENV=production` 陷阱；
   - 报 `The pattern ... doesn't match any Serverless Functions` → `functions` 路径写错了，本仓库用 `api/**/*.js`，别改成写死的文件路径。
2. **确认最新一次成功部署确实包含 `api/[...path].js`**。旧的成功部署会被继续对外服务，容易被误认为"部署更新了"。
3. **确认 `dist-server/` 有产物**。它是 `.gitignore` 里的构建产物，由 `vercel.json` 的
   `buildCommand`（`npm run build && npm run build:api`）在 Vercel 侧生成，本地不用提交；
   但如果你在 Dashboard 里手工覆盖过 Build Command，只留了 `npm run build`，函数就会因为
   `import '../dist-server/server/vercel.js'` 找不到文件而挂掉。
4. 修好后 **Redeploy**（Deployments → 最近一次 → 右上角 → Redeploy，勾选 clear build cache），
   再跑一遍上面的 `curl`。

> 一句话：前端是"最后一次成功部署"在服务，后端 404 说明"最近一次部署失败了"，
> 两者并不矛盾——Vercel 不会因为新部署失败而撤掉旧站点。

---

## 部署后运维

### 看后端日志

Vercel Dashboard → 你的项目 → **Logs** → 切换到 Runtime Logs（不是 Build Logs）。

### 改代码后自动部署

`git push` 到默认分支 → Vercel 自动触发新部署（无需手动操作）。

### 数据库备份

Supabase 付费计划自动每日备份。免费计划保留 7 天，可手动备份：

Supabase → Database → **Backups** → **Create backup**。

### 重置数据库（开发用）

生产环境**不要**这么做！仅开发时：

- Supabase → SQL Editor → 依次 `DROP TABLE` + 重跑 `supabase/schema.sql`

---

## 安全 checklist

部署完成后，对照确认：

- [ ] `SUPABASE_SERVICE_ROLE_KEY` **没有**出现在 `src/`、`api/`、`worker/` 任何前端代码里
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **没有**以 `VITE_` 前缀出现在 Vercel 环境变量里
- [ ] `supabase/schema.sql` 已执行，6 张表都已建好且 RLS 已启用
- [ ] Vercel 项目的 Environment Variables 只设了必要的三个，不多设
- [ ] `.env` 文件（本地）**没有**被 `git add` / `git commit`（`.gitignore` 已包含 `.env` / `.env.*`）

---

## 相关文档

- `supabase/schema.sql` — 数据库表结构 + RLS 策略
- `vercel.json` — Vercel 构建 / 函数 / 路由配置
- `api/[...path].js` — Vercel API catch-all 入口
- `server/vercel.ts` — 服务端 Vercel 适配