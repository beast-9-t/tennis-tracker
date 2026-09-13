# 安装和运行指南

## 第一步：安装依赖

打开命令行，进入项目目录：

```bash
cd c:\Users\o\CodeBuddy\20260209102439\tennis-tracker
```

安装基础依赖：

```bash
npm install
```

安装 TDesign 和其他依赖：

```bash
npm install tdesign-vue-next tdesign-icons-vue-next tailwindcss@3.4.17 tailwind-merge@^2.5.5 tailwindcss-animate@^1.0.7 postcss@8.5 autoprefixer@^10.4.20 lucide-vue-next vue-echarts
```

或者直接运行安装脚本：

```bash
install.bat
```

## 第二步：运行开发服务器

```bash
npm run dev
```

或者运行脚本：

```bash
run.bat
```

## 第三步：访问应用

打开浏览器访问控制台显示的地址（通常是 http://localhost:5173）

## 功能说明

### 添加网球记录
1. 点击右下角的浮动按钮
2. 填写训练信息：
   - 训练时长
   - 训练重点
   - 心情状态
   - 自我评价（1-10分）
   - 能量消耗（1-10分）
   - 场地位置（可选）
   - 搭档（可选）
   - 天气（可选）
   - 备注（可选）
3. 点击"保存记录"

### 查看历史记录
1. 点击底部导航的"历史记录"
2. 可以按"全部"、"本周"、"本月"筛选
3. 点击记录卡片展开/收起详细信息
4. 点击删除图标删除记录

### 查看统计分析
1. 点击底部导航的"统计分析"
2. 查看各种统计数据：
   - 总场次、总时长
   - 平均评分、能量消耗
   - 心情分布图
   - 本周、本月统计
   - 训练目标进度

## 数据存储

所有数据存储在浏览器的 LocalStorage 中，无需后端服务器，完全本地运行。

## 注意事项

1. 请确保 Node.js 版本 >= 18
2. 如果遇到依赖安装问题，可以尝试删除 node_modules 文件夹和 package-lock.json，然后重新安装
3. 数据仅在当前浏览器中有效，清除浏览器数据会丢失所有记录，请注意备份

## 备份和恢复数据

### 备份数据
1. 打开浏览器开发者工具（F12）
2. 切换到 Application 标签
3. 找到 Local Storage
4. 复制 tennis_matches 的值保存到文件

### 恢复数据
1. 打开浏览器开发者工具（F12）
2. 切换到 Application 标签
3. 找到 Local Storage
4. 在 tennis_matches 中粘贴之前保存的值
5. 刷新页面

## 遇到问题？

如果遇到任何问题，请检查：
1. Node.js 版本是否正确
2. 依赖是否完整安装
3. 浏览器是否支持 LocalStorage
4. 是否有浏览器扩展干扰

祝你使用愉快！🎾
