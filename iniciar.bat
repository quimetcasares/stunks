@echo off
REM Abre Stunks en modo desarrollo. Necesita Node.js 22 LTS: https://nodejs.org
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No encontre Node.js. Instala la version LTS desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando lo necesario, solo la primera vez...
  call npm install
)
call npm run dev
pause
