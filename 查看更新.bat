@echo off
echo ====================================
echo 功能更新完成！
echo ====================================
echo.

cd /d "%~dp0"

echo 正在停止服务器...
taskkill /F /IM node.exe 2>nul

echo 清理 Vite 缓存...
if exist ".vite" rmdir /s /q .vite

echo.
echo ====================================
echo 启动开发服务器...
echo ====================================
echo.

echo ✨ 新功能包括：
echo    1. 目标设置 - 可自定义本周和本月目标
echo    2. 记录展开 - 点击最近记录查看详情
echo    3. 统计图表 - 柱状图和环形图
echo.
echo.

npm run dev

pause
