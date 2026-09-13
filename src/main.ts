import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next'
// 注释掉 TDesign 全局样式，避免覆盖 Tailwind
// import 'tdesign-vue-next/es/style/index.css'
import App from './App.vue'
// 导入 Tailwind CSS 样式
import './index.css'

// 先挂载应用，确保 UI 立即渲染
const app = createApp(App)
app.use(TDesign)
app.mount('#app')
