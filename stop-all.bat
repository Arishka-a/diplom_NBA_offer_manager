@echo off
echo ========================================
echo Stopping all NBA Offer Manager services
echo ========================================
echo.

echo Stopping Docker containers...
docker-compose down

echo.
echo All services stopped!
echo ========================================
pause
