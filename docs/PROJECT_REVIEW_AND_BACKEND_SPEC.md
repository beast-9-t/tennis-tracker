# Tennis Tracker 项目审查与后端功能规范

> 文档状态：Draft v1.0  
> 审查范围：当前仓库中的 Vue 前端、LocalStorage 数据层、CloudBase 初始化代码与现有项目文档  
> 本阶段目标：冻结产品边界、接口契约与实施顺序；不进行业务代码开发

## 1. 审查结论

当前项目是一个面向个人用户的移动端优先网球训练记录 SPA。前端已覆盖登录、首页、训练记录、历史记录、统计分析、训练目标、个人资料和意见反馈等主要交互，但业务数据仍全部存放在浏览器 LocalStorage 中。

`@cloudbase/js-sdk` 目前只完成 SDK 初始化和匿名登录，没有任何页面通过 CloudBase 读写用户、训练、目标或反馈数据。因此，当前系统应定义为“可演示的前端原型”，而不是具备真实账号体系、云端持久化和多设备同步能力的完整应用。

后端建设的第一目标不是扩展更多页面，而是把现有功能可靠地服务化：真实认证、用户级数据隔离、训练记录 CRUD、目标管理、统计聚合、反馈提交以及本地历史数据迁移。

## 2. 当前技术与架构现状

### 2.1 技术栈

- Vue 3 + TypeScript + Vite 5
- TDesign Vue Next、Tailwind CSS、Lucide Icons
- ECharts / vue-echarts
- LocalStorage 作为实际业务数据源
- CloudBase SDK 已接入依赖并执行匿名初始化，但未进入业务调用链
- 未使用 Vue Router、Pinia、HTTP API Client、运行时数据校验或自动化测试框架

### 2.2 当前数据流

```text
页面组件
  ├─ LoginPage / ProfilePage ── localStorage
  ├─ TennisForm / Home / History / Statistics ── storageUtils ── localStorage
  ├─ GoalSettingsDialog ── goalsUtils ── localStorage
  └─ main.ts ── CloudBase 匿名初始化（与业务数据无连接）
```

### 2.3 当前 LocalStorage 数据

| Key | 内容 | 是否用户隔离 | 风险 |
|---|---|---:|---|
| `tennis_user_accounts` | `username -> password` | 否 | 密码明文保存，严重安全风险 |
| `tennis_current_user` | 当前用户名和登录时间 | 不适用 | 可被任意篡改，无服务端会话 |
| `tennis_user_token` | Base64 拼接值 | 不适用 | 不是可验证令牌 |
| `tennis_user_info_{username}` | 用户资料 | 是 | 仅依赖可篡改用户名 |
| `tennis_matches_{username}` | 训练记录 | 是 | 无云端备份、无并发控制 |
| `tennis_matches` | 旧版训练记录 | 否 | 归属不明确，迁移时需用户确认 |
| `tennis_goals` | 周/月目标 | 否 | 多用户之间共享，属于数据隔离缺陷 |
| `tennis_feedback_list` | 全部用户反馈 | 否 | 任意本地用户可读取或篡改 |

## 3. 已实现的前端页面与功能

### 3.1 登录页

实现内容：

- 用户名、密码输入与非空校验
- 密码显示/隐藏
- Enter 键提交
- 登录中状态和错误提示
- 已存在用户校验密码
- 不存在用户自动创建账号及默认资料
- 登录成功后进入主应用

现有限制：

- 登录和注册没有明确分流，输错新用户名会创建新账号
- 密码以明文存入浏览器
- Token 只是 Base64 文本，不能提供身份可信性
- 刷新页面不会恢复登录态，因为根组件启动时没有调用 `isLoggedIn()`
- 无验证码、限流、找回密码、修改密码、账号注销
- 用户协议和隐私政策链接为空链接

### 3.2 首页

实现内容：

- 产品标题与引导语
- 总场次、总训练时长、本周场次概览
- 最近一场训练摘要
- 周目标、月目标及达成进度
- 目标达成提示
- 最近 5 条训练记录
- 最近记录展开/收起，展示评分、能量、场地、搭档、天气、时长、备注
- 无记录空状态

现有限制：

- 数据仅在组件挂载时加载；新增训练后如果组件未重建，首页内容可能不刷新
- 统计在客户端反复遍历全部记录，数据量增长后效率较差
- 周起始日在不同工具函数中口径不一致：首页使用周日作为起点，统计图使用周一作为起点
- 目标读取不是用户级隔离

### 3.3 新增训练记录弹窗

实现内容：

- 右下角浮动按钮打开/关闭表单
- 训练日期
- 训练时长，当前限制 15–300 分钟
- 10 种训练重点
- 5 种心情
- 自我评分 1–10
- 能量消耗 1–10
- 场地、搭档、天气、备注
- 保存、重置表单、成功庆祝动画

现有限制：

- 只有新增，没有编辑入口
- ID 使用毫秒时间戳，不能作为分布式唯一标识
- 日期仅为本地日期字符串，缺少明确时区和训练开始时间
- 备注、场地、搭档缺少长度约束；未处理恶意内容与超限输入
- 保存是同步本地操作，没有请求失败、重试、离线队列或重复提交治理
- 文档曾描述 5 分钟步进，当前表单并未设置步进，规格与代码不一致

### 3.4 历史记录页

实现内容：

- 展示当前用户全部训练记录
- 全部 / 本周 / 本月筛选
- 日期、时间、心情、训练重点、时长摘要
- 展开查看评分、能量、场地、搭档、天气、备注
- 删除前原生确认，删除后刷新列表
- 空状态

现有限制：

- 无分页、游标或虚拟列表，大数据量时不可扩展
- 无自定义日期范围、训练重点、心情等筛选
- 无编辑、复制、恢复删除
- 删除无并发版本检查，未来多端同步时可能误删新版本
- 筛选和排序完全在客户端完成

### 3.5 统计分析页

实现内容：

- 总场次、总时长、平均评分、平均能量
- 本周场次、本月场次、本月训练时长
- 最常练习项目
- 周/月目标进度
- 本周周一至周日的每日训练时长柱状图
- 全部记录的心情分布环形图
- 无数据空状态

现有限制：

- 聚合逻辑全部在客户端执行，且部分计算绕过组件内已加载的数据再次读取 LocalStorage
- 统计维度不可指定日期范围
- “近期统计”和图表的统计周期、周起始日需要统一定义
- 当前生产构建失败：ECharts 配置中 `animationEasing` 被推断为普通字符串，不能满足 `ECBasicOption` 类型
- 文档中“最近 8 周柱状图”的描述与当前代码“本周每日柱状图”不一致

### 3.6 训练目标弹窗

实现内容：

- 设置每周目标 1–20 场
- 设置每月目标 1–100 场
- 默认值为每周 4 场、每月 16 场
- 首页和统计页可打开设置

现有限制：

- 目标未按用户隔离
- 只支持场次目标，不支持时长或连续训练目标
- 未定义目标周期的时区、周起始日和历史保留策略
- 保存后依赖 LocalStorage 重新读取，缺少统一响应式状态

### 3.7 个人中心

实现内容：

- 展示头像/首字母、昵称、简介、技术水平、球龄
- 展示和编辑性别、年龄、身高、体重、球龄、技术水平、手机、邮箱、简介
- 提交意见反馈
- 退出登录及确认对话框

现有限制：

- 头像只有 URL 字段，没有上传能力
- 手机、邮箱没有格式校验和验证流程
- 保存资料没有服务端校验、冲突处理或失败反馈
- 反馈只保存在所有本地用户共享的数组中
- 未实现设置、隐私、数据导出和账号删除

### 3.8 导航与应用壳

实现内容：

- 首页、统计分析、历史记录、我的四个底部导航入口
- 页面切换动画
- 记录保存后的全局庆祝动画

现有限制：

- 没有 URL 路由，刷新、深链、浏览器前进后退和页面级权限控制不可用
- 根组件默认始终显示登录页，已有本地登录态不会在启动时恢复
- 缺少全局请求状态、错误边界、网络状态与登录过期处理

## 4. 产品范围与后端边界

### 4.1 MVP 必须支持

1. 用户注册、登录、刷新令牌、退出和当前用户查询
2. 当前用户资料查询和修改
3. 当前用户训练记录新增、查询、详情、修改、删除
4. 周/月目标查询和修改
5. 首页概览和统计分析聚合
6. 意见反馈提交
7. 严格的数据归属校验，用户只能访问自己的数据
8. LocalStorage 数据一次性迁移到云端，并可安全重试

### 4.2 暂不纳入 MVP

- 社交关系、公开动态、分享
- AI 训练建议和视频分析
- 训练提醒/推送
- 教练与学员组织体系
- 支付、订阅和会员等级
- 复杂后台运营系统；MVP 只预留反馈查询的管理能力

## 5. API 通用规范

### 5.1 基础约定

- API 前缀：`/api/v1`
- 传输：HTTPS + JSON UTF-8
- 时间：时间点使用 ISO 8601 UTC，例如 `2026-09-13T06:30:00Z`
- 日期：纯日期使用 `YYYY-MM-DD`
- 用户时区：IANA 时区名，默认 `Asia/Shanghai`
- 周起始日：统一为周一
- ID：服务端生成 UUIDv7 或等价有序唯一 ID
- 身份：短期 Access Token + 可轮换 Refresh Token；Refresh Token 建议放 HttpOnly、Secure、SameSite Cookie
- 所有写接口校验 `Content-Type`、身份、字段白名单、长度和枚举值
- 列表默认按 `occurredAt desc, id desc` 排序
- 创建与迁移接口支持 `Idempotency-Key`
- 更新接口使用 `version` 或 `If-Match` 做乐观并发控制

### 5.2 标准成功响应

```json
{
  "data": {},
  "meta": {
    "requestId": "req_xxx"
  }
}
```

### 5.3 标准错误响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": [
      { "field": "durationMinutes", "reason": "必须在 15 到 300 之间" }
    ],
    "requestId": "req_xxx"
  }
}
```

建议错误码：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`INTERNAL_ERROR`。

### 5.4 分页响应

```json
{
  "data": [{ "id": "..." }],
  "page": {
    "nextCursor": "opaque_cursor",
    "hasMore": true
  },
  "meta": { "requestId": "req_xxx" }
}
```

## 6. 核心数据模型

### 6.1 User

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | string | 服务端生成 |
| `username` | string | 3–32 字符、标准化后唯一、不可用纯空白 |
| `passwordHash` | string | 仅服务端保存，Argon2id 或 bcrypt |
| `status` | enum | `active/disabled/deleted` |
| `createdAt/updatedAt` | datetime | 服务端维护 |

### 6.2 UserProfile

| 字段 | 类型 | 规则 |
|---|---|---|
| `nickname` | string | 1–40 |
| `avatarUrl` | string/null | HTTPS URL；上传后由服务端返回 |
| `gender` | enum | `male/female/other/undisclosed` |
| `birthDate` | date/null | 建议替代会随时间失真的年龄 |
| `heightCm` | number/null | 100–250 |
| `weightKg` | number/null | 30–200 |
| `playingSince` | date/null | 建议替代会随时间失真的球龄 |
| `level` | enum | `beginner/intermediate/advanced/professional` |
| `phone/email` | string/null | 格式校验；是否验证单独记录 |
| `bio` | string | 最长 200 |
| `timezone` | string | 默认 `Asia/Shanghai` |
| `version` | integer | 乐观锁 |

兼容策略：第一版接口可以继续接收 `age` 和 `playingYears`，服务端转换为建议字段；新前端逐步切换。

### 6.3 TrainingRecord

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | string | 服务端生成 |
| `userId` | string | 从鉴权上下文取得，禁止客户端指定 |
| `occurredAt` | datetime | 必填，带时区语义 |
| `durationMinutes` | integer | 15–300 |
| `focus` | enum/string | MVP 使用现有 10 个枚举 |
| `mood` | enum | `excellent/good/normal/tired/exhausted` |
| `selfRating` | integer | 1–10 |
| `energyLevel` | integer | 1–10 |
| `location` | string/null | 最长 120 |
| `partner` | string/null | 最长 80 |
| `weather` | enum/null | 现有 6 个枚举；允许后续字典化 |
| `notes` | string/null | 最长 2000 |
| `version` | integer | 每次更新递增 |
| `createdAt/updatedAt/deletedAt` | datetime | 建议软删除，便于同步与恢复 |

### 6.4 TrainingGoal

| 字段 | 类型 | 规则 |
|---|---|---|
| `userId` | string | 唯一归属 |
| `weeklyTargetCount` | integer | 1–20 |
| `monthlyTargetCount` | integer | 1–100 |
| `weekStartsOn` | integer | MVP 固定为 1（周一） |
| `timezone` | string | 用于周期边界计算 |
| `version` | integer | 乐观锁 |

### 6.5 Feedback

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | string | 服务端生成 |
| `userId` | string | 当前登录用户 |
| `content` | string | 1–500，去除首尾空白 |
| `status` | enum | `new/processing/resolved/closed` |
| `createdAt` | datetime | 服务端生成 |

## 7. 需要实现的后端接口

### 7.1 认证与会话（P0）

| 方法与路径 | 用途 | 关键请求 | 关键响应/规则 |
|---|---|---|---|
| `POST /auth/register` | 注册 | `username,password,agreementVersion` | `201`；用户名唯一；密码强度；限流 |
| `POST /auth/login` | 登录 | `username,password` | Access Token、用户摘要；失败不暴露账号是否存在 |
| `POST /auth/refresh` | 刷新会话 | Refresh Cookie | 轮换令牌，检测重放 |
| `POST /auth/logout` | 退出 | 当前会话 | 撤销 Refresh Token；幂等 |
| `GET /auth/me` | 恢复登录态 | Access Token | 当前用户、资料完成度 |
| `POST /auth/password/change` | 修改密码 | `currentPassword,newPassword` | 撤销其他会话，可作为 P1 |

验收重点：不能继续以 LocalStorage 明文密码或伪 Token 作为认证依据；连续失败登录必须限流并记录安全审计。

### 7.2 用户资料（P0）

| 方法与路径 | 用途 | 规则 |
|---|---|---|
| `GET /users/me/profile` | 获取个人资料 | 不存在时返回带默认值的资料对象 |
| `PATCH /users/me/profile` | 部分更新资料 | 字段白名单、格式校验、乐观锁 |
| `POST /users/me/avatar/upload-url` | 获取头像直传凭证 | P1；限制 MIME、大小和过期时间 |
| `DELETE /users/me` | 注销账号 | P1；二次认证、延迟删除、审计 |

### 7.3 训练记录（P0）

| 方法与路径 | 用途 | 关键查询/规则 |
|---|---|---|
| `POST /training-records` | 新增记录 | 支持 `Idempotency-Key`；返回完整记录 |
| `GET /training-records` | 分页列表 | `cursor,limit,startAt,endAt,focus,mood,sort`；`limit` 1–100 |
| `GET /training-records/{id}` | 获取详情 | 只能读取自己的记录 |
| `PATCH /training-records/{id}` | 编辑记录 | 字段白名单 + `version` 乐观锁 |
| `DELETE /training-records/{id}` | 删除记录 | 默认软删除；幂等 |

列表接口应同时支撑“最近 5 条”“全部/本周/本月”和后续自定义筛选。日期边界由客户端携带明确时间点，或同时提供 `period=week/month` 与 `timezone`，两种方式只保留一种作为正式契约，建议前者更明确。

### 7.4 训练目标（P0）

| 方法与路径 | 用途 | 规则 |
|---|---|---|
| `GET /training-goals/current` | 获取当前目标 | 首次访问自动返回默认目标 |
| `PUT /training-goals/current` | 完整更新目标 | 校验范围、用户隔离、乐观锁 |

MVP 每个用户只保留一份当前设置。若后续需要历史目标，再增加按周期生成的 GoalPeriod 记录，不应在 MVP 提前复杂化。

### 7.5 首页与统计聚合（P0）

| 方法与路径 | 用途 | 返回内容 |
|---|---|---|
| `GET /dashboard/overview` | 首页一次加载 | 总场次、总分钟、本周/月场次、最近一场、最近 5 条、目标及进度 |
| `GET /statistics/summary` | 统计摘要 | `from,to,timezone`；总场次、总分钟、平均评分/能量、最常训练项 |
| `GET /statistics/duration-trend` | 时长趋势 | `from,to,bucket=day/week/month,timezone`；各桶分钟数 |
| `GET /statistics/mood-distribution` | 心情分布 | `from,to`；各心情次数和比例 |

说明：数据量较小时统计也可由列表计算，但既然后端建设目标包含多端同步和长期数据，服务端聚合能统一口径并避免下载全部历史记录。首页聚合接口减少首屏多请求瀑布。

### 7.6 意见反馈（P0）

| 方法与路径 | 用途 | 规则 |
|---|---|---|
| `POST /feedback` | 提交反馈 | 内容 1–500；用户级和 IP 级限流；返回反馈 ID |
| `GET /admin/feedback` | 管理端列表 | P1；仅管理员，分页与状态筛选 |
| `PATCH /admin/feedback/{id}` | 更新处理状态 | P1；审计操作者 |

### 7.7 本地数据迁移（P0）

| 方法与路径 | 用途 | 规则 |
|---|---|---|
| `POST /migration/local-data` | 批量导入记录、资料、目标 | 身份必需；单次上限；逐项校验；幂等 |
| `GET /migration/status` | 查询当前用户迁移状态 | 返回是否完成、成功/失败数量和最后迁移时间 |

迁移请求中每条本地记录需带 `clientRecordId`，服务端建立 `(userId, clientRecordId)` 唯一约束。只有服务端确认成功后，前端才标记迁移完成；原 LocalStorage 数据至少保留一个可回滚版本，不能立即清除。旧的全局 `tennis_matches` 归属不明确，必须由当前用户主动确认后再导入。

## 8. 数据库与索引建议

核心集合/表：`users`、`user_profiles`、`auth_sessions`、`training_records`、`training_goals`、`feedback`、`migration_jobs`、`audit_logs`。

关键索引：

- `users(normalized_username)` 唯一
- `training_records(user_id, occurred_at desc, id desc)`
- `training_records(user_id, focus, occurred_at desc)`
- `training_records(user_id, mood, occurred_at desc)`
- `training_goals(user_id)` 唯一
- `feedback(status, created_at desc)`
- `migration_records(user_id, client_record_id)` 唯一
- `auth_sessions(user_id, status, expires_at)`

若采用 CloudBase，集合权限必须默认拒绝客户端跨用户访问。推荐由云函数/API 层从可信身份上下文注入 `userId`，禁止客户端传入并决定数据归属。

## 9. 非功能与安全要求

### 9.1 安全

- 密码只保存强哈希；日志和响应不得记录密码、Token
- 所有资源查询必须带服务端用户归属条件，不能先按 ID 查询后再在前端过滤
- 登录、注册、反馈、迁移接口限流
- 输入白名单校验、统一输出编码，防止存储型 XSS
- Refresh Token 轮换、撤销和过期治理
- CORS 只允许正式前端域名；生产环境强制 HTTPS
- 敏感操作写审计日志；日志脱敏手机号、邮箱和 Token
- 用户协议与隐私政策需有真实版本号，并记录注册时同意的版本与时间

### 9.2 一致性与时区

- 周统一从周一开始
- 周/月边界按用户时区计算，数据库时间统一存 UTC
- 统计接口与列表接口必须共享同一条“有效记录”过滤规则
- 删除、迁移和重试必须幂等
- 更新冲突返回 `409 CONFLICT`，同时返回最新版本摘要

### 9.3 性能与可观测性

- 常规读接口 P95 小于 500ms，写接口 P95 小于 800ms（不含弱网传输）
- 首屏 overview 响应建议小于 100KB
- 所有响应返回 `requestId`
- 记录请求耗时、状态码、错误码；建立 5xx、登录异常、迁移失败告警
- 数据库查询必须命中用户维度索引

### 9.4 测试与质量门禁

- OpenAPI 契约校验
- 服务层单元测试
- 数据归属和越权测试
- API 集成测试：认证、CRUD、统计边界、幂等、并发冲突
- 迁移回放测试和失败恢复测试
- 前后端端到端主链路：注册/登录 → 新增 → 列表 → 编辑/删除 → 统计 → 退出/恢复会话
- CI 必须通过类型检查、构建、测试和依赖安全扫描

## 10. 分阶段执行计划

### 阶段 0：规格冻结与技术决策（1–2 个工作日）

交付物：

- 确认后端形态：CloudBase 云函数/API 网关，或独立 REST 服务
- 确认认证方案、Token 存放方式、数据库和部署环境
- 冻结 OpenAPI 3.1 文档、枚举、字段长度、错误码、时区和周起始日
- 确认登录与注册是否拆分，以及旧本地账号如何迁移

退出标准：前后端、测试可仅依据 OpenAPI 和本规范独立开展工作，不再依赖口头字段解释。

### 阶段 1：工程底座与认证（3–5 个工作日）

交付物：

- 环境配置、密钥管理、数据库迁移机制
- 统一响应、错误处理、日志、requestId、限流
- 注册、登录、刷新、退出、`/auth/me`
- 用户表、会话表、安全审计

退出标准：刷新页面能可靠恢复会话；伪造 LocalStorage 无法获得其他用户数据；认证集成测试通过。

### 阶段 2：资料、训练记录与目标（4–6 个工作日）

交付物：

- 用户资料 GET/PATCH
- 训练记录完整 CRUD、游标分页、日期/重点/心情筛选
- 训练目标 GET/PUT
- 用户归属索引、乐观锁、软删除、幂等键

退出标准：两个测试用户的数据严格隔离；重复提交不产生重复记录；并发更新能返回明确冲突。

### 阶段 3：首页与统计聚合（3–4 个工作日）

交付物：

- dashboard overview
- summary、duration trend、mood distribution
- 周/月边界和时区测试
- 聚合查询性能验证

退出标准：首页和统计页面不需要下载全量历史数据；相同周期下各接口统计结果一致。

### 阶段 4：反馈与本地数据迁移（3–5 个工作日）

交付物：

- 反馈提交接口及限流
- 本地资料、训练记录、目标批量迁移
- 迁移状态、幂等去重、错误明细和重试
- 迁移前备份与回滚说明

退出标准：同一迁移包重复提交不会重复写入；部分失败可定位并单独重试；原数据在确认前不丢失。

### 阶段 5：前端切换与联调（4–6 个工作日）

交付物：

- API Client、Token 刷新、全局错误处理、加载/空/失败状态
- 页面从 LocalStorage 切换为服务端数据源
- 增加记录编辑能力，统一页面响应式刷新
- 会话恢复、路由守卫或等价页面权限控制
- 修复当前 TypeScript 构建错误

退出标准：核心流程通过 E2E；断网、Token 过期、重复点击、慢请求和 409 冲突均有可理解反馈。

### 阶段 6：灰度、监控与上线（2–3 个工作日）

交付物：

- 测试/预发/生产环境隔离
- 数据备份、恢复演练、告警和仪表盘
- 灰度迁移和回滚开关
- 隐私政策、用户协议和数据删除流程

退出标准：生产检查清单通过；可按用户或版本回滚；监控能发现 5xx、延迟和迁移异常。

总体 MVP 估算：20–31 个工作日，适用于 1 名后端 + 1 名前端 + 测试支持。若由单人串行完成，应按 5–8 周安排，并预留部署审批时间。

## 11. 优先级清单

### P0：上线前必须完成

- 真实认证与会话恢复
- 用户级数据隔离
- 训练记录 CRUD 和分页
- 目标用户隔离
- 首页与统计接口
- 反馈服务端存储
- 本地数据安全迁移
- 构建恢复、契约测试、越权测试、日志与告警

### P1：核心体验完善

- 修改密码、账号注销
- 头像上传
- 训练记录编辑和删除恢复
- 更多筛选维度与数据导出
- 管理员反馈处理

### P2：后续产品扩展

- 提醒通知
- 社交分享与教练协作
- AI 分析和视频分析
- 会员或订阅体系

## 12. 当前项目立即需要确认的决策

1. 继续使用 CloudBase 作为正式后端，还是建设独立服务；当前代码不能视为已经完成 CloudBase 后端接入。
2. 用户名密码认证是否保留；若保留，登录和注册必须拆分。
3. 旧 LocalStorage 账号密码不可迁移为可信凭据。建议要求用户重新注册/设置密码，只迁移业务数据。
4. 训练“日期”是否需要精确到开始时间；建议后端模型使用 `occurredAt`，前端可继续只展示日期。
5. 目标周期是否固定自然周/自然月；本规范建议自然周从周一开始，并按用户时区计算。
6. 是否把记录删除定义为可恢复软删除；本规范建议保留 30 天后物理清理。

## 13. 审查证据与已验证事项

- `src/App.vue`：页面切换、登录态初值、庆祝效果和应用壳
- `src/components/LoginPage.vue`：本地账号、明文密码和伪 Token
- `src/components/HomePage.vue`：首页统计、目标、最近记录
- `src/components/TennisForm.vue`：训练记录字段与新增流程
- `src/components/MatchList.vue`：历史筛选、展开与删除
- `src/components/Statistics.vue`：客户端统计和 ECharts 图表
- `src/components/ProfilePage.vue`：资料编辑、反馈和退出
- `src/utils/storage.ts`：用户维度本地训练数据
- `src/utils/goals.ts`：未按用户隔离的目标数据
- `src/utils/cloudStorage.ts`：仅初始化和匿名登录
- 已执行 `npm.cmd run build`，当前因 `Statistics.vue` 的 ECharts `animationEasing` 类型不匹配而失败
- 当前目录未检测到可用 Git 仓库元数据，无法进行提交历史、分支策略和变更追踪审查

