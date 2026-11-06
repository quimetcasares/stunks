@echo off
REM Abre la practica de Stunks con los datos locales del NQ. Solo corre en esta computadora; nada se publica.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No encontre Python. Instalalo desde https://www.python.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
python herramientas\servir.py
pause
