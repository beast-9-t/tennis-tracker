@echo off
echo ====================================
echo 重启开发服务器
echo ====================================
echo.

cd /d "%~dp0"

echo 停止当前服务器...
taskkill /F /IM node.exe 2>nul

echo 清理缓存...
if exist ".vite" rmdir /s /q .vite

echo 启动开发服务器...
echo.
echo ====================================
echo 服务器启动中...
echo ====================================
echo.
npm run dev

pause
// 注释掉这一行，避免覆盖 Tailwind 样式
// import 'tdesign-vue-next/es/style/index.css'
