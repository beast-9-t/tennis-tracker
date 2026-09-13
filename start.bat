@echo off
echo ====================================
echo 网球记录助手 - 启动脚本
echo ====================================
echo.

echo 正在启动开发服务器...
echo.

cd /d "%~dp0"
npm run dev

echo.
echo 开发服务器已停止
pause
