@echo off
echo ========================================
echo NBA Offer Manager - Full Stack Startup
echo ========================================
echo.
echo Step 1: Starting Docker (PostgreSQL + Adminer)...
docker-compose up -d

echo.
echo Step 2: Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Step 3: Starting Backend and Frontend...
echo.
echo Services will be available at:
echo   - Frontend:   http://localhost:3000
echo   - Backend:    http://localhost:3002
echo   - Adminer:    http://localhost:8080
echo.
echo Press Ctrl+C to stop Backend and Frontend
echo (Docker containers will continue running)
echo ========================================
echo.

npm run dev
