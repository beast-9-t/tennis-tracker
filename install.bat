@echo off
cd /d "%~dp0"
echo Installing dependencies...
npm install
npm install tdesign-vue-next tdesign-icons-vue-next tailwindcss@3.4.17 tailwind-merge@^2.5.5 tailwindcss-animate@^1.0.7 postcss@8.5 autoprefixer@^10.4.20 lucide-vue-next vue-echarts
echo Installation complete!
pause
