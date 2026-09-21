@echo off
echo ========================================================
echo Starting GoalGuard AI (Backend + Frontend)
echo ========================================================

:: Check if frontend node_modules exists
if not exist "%~dp0frontend\node_modules\" (
    echo Installing frontend dependencies...
    cd "%~dp0frontend"
    call npm install
    cd "%~dp0"
)

:: Launch Backend in a new window
echo Starting Backend on http://localhost:8000 ...
start "GoalGuard Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Launch Frontend in a new window
echo Starting Frontend on http://localhost:5173 ...
start "GoalGuard Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo Both servers launched!
echo Open your browser at: http://localhost:5173
echo ========================================================
pause
