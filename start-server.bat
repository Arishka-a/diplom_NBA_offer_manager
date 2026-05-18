@echo off
echo ========================================
echo   NBA-OfferManager Server Launcher
echo ========================================
echo.

REM Проверка Docker
echo [1/4] Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)

REM Запуск базы данных
echo [2/4] Starting PostgreSQL database...
cd "%~dp0"
docker-compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Failed to start database
    pause
    exit /b 1
)

REM Ожидание готовности БД
echo [3/4] Waiting for database to be ready...
timeout /t 5 /nobreak >nul

REM Запуск сервера
echo [4/4] Starting API server...
cd server
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo ========================================
echo   Starting server in development mode
echo ========================================
echo.
call npm run dev
