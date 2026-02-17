@echo off
set "LOG_FILE=antigravity_session.log"

echo [Launcher] Starting Antigravity Watcher...
echo [Launcher] Timestamp: %DATE% %TIME% > %LOG_FILE%

:: Try Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [Launcher] Python found. Running antigravity_watcher.py...
    python -u antigravity_watcher.py
    goto :EOF
)

:: Try Node
echo [Launcher] Python not found or failed. Trying Node.js...
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [Launcher] Node found. Running antigravity_watcher.js...
    node antigravity_watcher.js
    goto :EOF
)

echo [Launcher] CRITICAL: Neither Python nor Node.js found in PATH.
echo [Launcher] Please ensure one is installed and available.
pause
