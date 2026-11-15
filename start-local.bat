@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Da tao file .env tu cau hinh mau.
)
where node >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node.js 22+ tai https://nodejs.org/
  pause
  exit /b 1
)
echo Mo trinh duyet tai http://localhost:4100
call npm run dev
pause
