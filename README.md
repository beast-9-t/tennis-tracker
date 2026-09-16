# 🎾 网球记录助手

一个美观、高效的网球训练记录应用，帮助你管理网球训练并追踪进步。

## 🚀 部署到生产环境？

**👉 请阅读 [`DEPLOY_VERCEL_SUPABASE.md`](./DEPLOY_VERCEL_SUPABASE.md)** —— 这是当前唯一的权威部署指南（前端 + API 在 Vercel，数据库在 Supabase，约 15 分钟跑完）。

> ⚠️ 本文后续章节描述的是**本地开发**流程（Vite + Express + JSON 持久化），仅供开发与测试参考，与生产部署无关。

## 部署说明（历史参考）

旧 CloudBase 地址仅包含历史静态前端，不能运行当前服务端版本。如需历史参考资料，请看 `DEPLOY_VERCEL_SUPABASE.md` 之外的所有旧 .md 文档。

## 功能特性

- 📝 **记录网球训练**：记录每场比赛的详细信息
  - 训练时长
  - 训练重点（正手、反手、发球等）
  - 心情状态
  - 自我评价
  - 能量消耗
  - 场地位置、搭档、天气等附加信息

- 📊 **统计分析**：查看训练数据统计
  - 总场次、总时长
  - 平均评分、能量消耗
  - 心情分布图
  - 周/月统计
  - 训练目标进度

- 📅 **历史记录**：查看和管理所有网球记录
  - 按日期筛选（全部/本周/本月）
  - 展开/收起详细信息
  - 删除记录

- 🎨 **精美设计**
  - 网球绿 + 球场蓝主题配色
  - 流畅的动画效果
  - 响应式设计，适配手机端
  - 毛玻璃效果卡片

## 技术栈

- **框架**：Vue 3 + TypeScript
- **构建工具**：Vite 5
- **UI组件库**：TDesign Vue Next
- **样式框架**：Tailwind CSS
- **图标库**：Lucide Vue Next
- **后端服务**：Node.js + Express REST API
- **数据存储**：开发环境 JSON 持久化；LocalStorage 仅用于旧数据迁移
- **认证**：scrypt 密码哈希、短期访问令牌、HttpOnly 刷新 Cookie

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行后端服务

```bash
npm run dev:api
```

默认地址为 `http://localhost:3000`，开发数据写入 `data/tennis-tracker.json`。

### 运行前端开发服务器

```bash
npm run dev
```

前端默认通过 Vite 将 `/api` 代理到本地后端，因此开发时需要同时运行以上两个命令。

### 构建生产版本

```bash
npm run build
npm run build:api
```

构建后启动 API：

```bash
npm run start:api
```

### 运行测试

```bash
npm test
```

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
tennis-tracker/
├── server/                # Express API、认证、业务接口与持久化
├── tests/                 # 前端与后端单元/集成测试
├── src/
│   ├── api/              # REST API Client
│   ├── services/         # 本地数据迁移等应用服务
│   ├── components/       # 组件
│   │   ├── Navigation.vue      # 导航栏
│   │   ├── HomePage.vue        # 首页
│   │   ├── MatchList.vue       # 历史记录列表
│   │   ├── Statistics.vue      # 统计分析
│   │   └── TennisForm.vue      # 网球记录表单
│   ├── types/           # 类型定义
│   │   └── tennis.ts
│   ├── utils/           # 工具函数
│   │   └── storage.ts
│   ├── App.vue          # 根组件
│   ├── main.ts          # 入口文件
│   └── index.css        # 全局样式
├── public/              # 静态资源
├── index.html           # HTML 模板
├── vite.config.ts       # Vite 配置
├── tailwind.config.js   # Tailwind CSS 配置
└── package.json         # 项目配置
```

## 特性说明

### 服务端存储与旧数据迁移

账号、个人资料、训练记录、目标和反馈均通过后端保存。升级用户登录后，应用会将旧版 LocalStorage 中的训练记录、资料和目标幂等迁移到服务端；迁移成功后仍保留原始本地数据，便于回滚。

### 响应式设计
完美适配手机端、平板端和桌面端，在任何设备上都能获得良好的使用体验。

### 动画效果
- 悬浮动画
- 淡入淡出
- 列表过渡
- 进度条动画

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 开发

项目使用 Vue 3 Composition API 和 TypeScript 开发，确保类型安全和代码可维护性。

## 许可证

MIT
