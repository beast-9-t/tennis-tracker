# 🚀 快速开始

## Windows 用户

### 方法 1：使用批处理文件（推荐）

1. 打开命令提示符 (CMD) 或 PowerShell
2. 进入项目目录：
   ```cmd
   cd c:\Users\o\CodeBuddy\20260209102439\tennis-tracker
   ```

3. 运行安装脚本：
   ```cmd
   install.bat
   ```

4. 运行开发服务器：
   ```cmd
   run.bat
   ```

5. 打开浏览器访问：http://localhost:5173

### 方法 2：手动安装

1. 进入项目目录：
   ```cmd
   cd c:\Users\o\CodeBuddy\20260209102439\tennis-tracker
   ```

2. 安装依赖：
   ```cmd
   npm install
   ```

3. 如果提示缺少依赖，运行：
   ```cmd
   npm install tdesign-vue-next tdesign-icons-vue-next tailwindcss@3.4.17 tailwind-merge@^2.5.5 tailwindcss-animate@^1.0.7 postcss@8.5 autoprefixer@^10.4.20 lucide-vue-next vue-echarts
   ```

4. 启动开发服务器：
   ```cmd
   npm run dev
   ```

5. 打开浏览器访问控制台显示的地址

## 首次使用

1. 点击右下角的 **+** 按钮添加第一条记录
2. 填写训练信息：
   - 训练时长：例如 90 分钟
   - 训练重点：选择"综合训练"或其他选项
   - 心情状态：选择"不错"或其他
   - 自我评价：拖动滑块到 7
   - 能量消耗：拖动滑块到 5
   - 其他信息可选填写
3. 点击"保存记录"

4. 探索应用功能：
   - **首页**：查看欢迎信息和快速统计
   - **历史记录**：查看所有网球记录
   - **统计分析**：查看详细的数据统计

## 常见问题

### Q: 提示缺少模块？
A: 运行 `npm install` 安装所有依赖

### Q: 端口被占用？
A: 修改 `vite.config.ts` 中的端口配置，或关闭占用 5173 端口的程序

### Q: 样式不正常？
A: 确认已安装 tailwindcss 和相关依赖，并重启开发服务器

### Q: 数据丢失？
A: 数据存储在 LocalStorage 中，清除浏览器数据会丢失。注意定期备份（见 SETUP.md）

### Q: 如何备份数据？
A: 打开浏览器开发者工具 (F12) -> Application -> Local Storage -> 复制 tennis_matches 的值

## 技术支持

如遇问题，请检查：
1. Node.js 版本 >= 18
2. npm 版本 >= 9
3. 浏览器版本（推荐 Chrome 最新版）

## 项目结构

```
tennis-tracker/
├── src/
│   ├── components/      # Vue 组件
│   ├── types/           # 类型定义
│   ├── utils/           # 工具函数
│   ├── App.vue          # 根组件
│   ├── main.ts          # 入口文件
│   └── index.css        # 全局样式
├── index.html           # HTML 模板
├── package.json         # 依赖配置
├── README.md            # 项目说明
├── SETUP.md             # 详细安装指南
├── PROJECT_SUMMARY.md   # 项目总结
└── QUICKSTART.md        # 本文件
```

## 下一步

- 📖 阅读 [README.md](./README.md) 了解项目详情
- 🛠️ 查看 [SETUP.md](./SETUP.md) 获取详细配置
- 📊 阅读 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) 了解技术实现

祝你使用愉快！🎾
