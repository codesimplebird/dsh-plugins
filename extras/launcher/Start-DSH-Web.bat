@echo off
setlocal enabledelayedexpansion
set PORT=3080
set ADB=%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe
set URL=http://127.0.0.1:%PORT%
set AUTO_DIR=%APPDATA%\npm\node_modules\dsh-autostart
set LAUNCHER=%AUTO_DIR%\dsh-web-launcher.ps1
set LAUNCH_LOG_DIR=%AUTO_DIR%\logs
set LOG=%TEMP%\dsh-web.log
set LATEST_FILE=%TEMP%\dsh-latest.txt
set TITLE=DeepSeek dsh web
title %TITLE%

REM usage: double-click = auto-start + menu ; with args: start/stop/restart/status
if /i "%~1"=="start"   goto start
if /i "%~1"=="stop"    goto stop
if /i "%~1"=="restart" goto restart
if /i "%~1"=="status"  goto status

REM --- async version check (non-blocking, runs once) ---
if not exist "%LATEST_FILE%" (
  start "" /b cmd /c "call %APPDATA%\npm\node_modules\dsh-autostart\dsh-check-version.bat"
)

REM ================== DEFAULT: AUTO-START THEN MENU (double-click) ==================
goto start

REM ================== START ==================
:start
call :ensure_adb
REM clear any stop sentinel left by a previous stop
del "%APPDATA%\npm\node_modules\dsh-autostart\run\stop.sentinel" 2>nul
echo.
echo  ==== %TITLE% ====
echo  URL: %URL%
echo.
netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul 2>&1
if !errorlevel!==0 (
  echo  [OK] Service is already running on port %PORT%.
  goto open_browser
)
if exist "%LAUNCHER%" (
  echo  Starting supervisor in hidden window with crash auto-restart ...
  start "" powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
) else (
  echo  dsh-autostart not found, starting dsh web directly ...
  start "" powershell -NoProfile -WindowStyle Minimized -Command "dsh web --port %PORT% > \"%LOG%\" 2>&1"
)
timeout /t 5 /nobreak >nul
:open_browser
start "" "%URL%"
echo.
echo  Browser opened: %URL%
echo.
echo  NOTE: the service runs in background and is supervised.
echo.
goto menu

REM ================== MENU ==================
:menu
cls
echo.
echo ============================================
echo   %TITLE% - control panel
echo   URL: %URL%
echo ============================================
echo.
if exist "%LATEST_FILE%" (
  set "LATEST="
  set /p LATEST=<"%LATEST_FILE%"
  if defined LATEST (
    for /f "delims=" %%v in ('dsh --version 2^>nul') do set "LOCAL=%%v"
    if not "!LATEST!"=="!LOCAL!" (
      echo   [UPDATE] New version available: !LATEST!  -  you have: !LOCAL!
      echo   [UPDATE] Select option 6 to upgrade.
      echo.
    )
  )
)
echo  Select an option:
echo.
echo   [1]  Start service
echo   [2]  Stop service
echo   [3]  Restart service
echo   [4]  Show status
echo   [5]  Show logs
echo   [6]  Upgrade dsh
echo   [0]  Exit
echo.
set "CMD="
set /p CMD=Option^> 
if "%CMD%"=="1" goto start
if "%CMD%"=="2" goto stop
if "%CMD%"=="3" goto restart
if "%CMD%"=="4" goto status
if "%CMD%"=="5" goto logs
if "%CMD%"=="6" goto upgrade
if "%CMD%"=="0" goto quit
echo.
echo  Invalid option: %CMD%
pause
goto menu

REM ================== STOP ==================
:stop
echo.
if exist "%LAUNCHER%" (
  echo  Stopping via supervisor ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Stop
  timeout /t 2 /nobreak >nul
)
REM kill anything still listening on the port (covers manually started dsh)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr /c:"LISTENING"') do (
  if not "%%a"=="0" (
    echo  Killing process PID=%%a ...
    taskkill /PID %%a /F /T >nul 2>&1
  )
)
echo  [OK] Service stopped.
pause
goto menu

REM ================== RESTART ==================
:restart
echo.
echo  WARNING: This restarts the service under supervision.
echo.
echo   [1]  Confirm restart
echo   [2]  Cancel
echo.
set "CONFIRM="
set /p CONFIRM=Choice^> 
if not "%CONFIRM%"=="1" (
  echo  Restart cancelled.
  pause
  goto menu
)
if exist "%LAUNCHER%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Stop
  timeout /t 2 /nobreak >nul
)
REM kill anything still on the port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr /c:"LISTENING"') do (
  if not "%%a"=="0" taskkill /PID %%a /F /T >nul 2>&1
)
timeout /t 2 /nobreak >nul
if exist "%LAUNCHER%" (
  echo  Restarting supervisor...
  start "" powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
) else (
  call :ensure_adb
  start "" powershell -NoProfile -WindowStyle Minimized -Command "dsh web --port %PORT% > \"%LOG%\" 2>&1"
)
timeout /t 6 /nobreak >nul
start "" "%URL%"
echo  Service restarted: %URL%
pause
goto menu

REM ================== STATUS ==================
:status
echo.
netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul 2>&1
if !errorlevel!==0 (
  echo  dsh web: RUNNING on port %PORT%.
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr /c:"LISTENING"') do (
    if not "%%a"=="0" (
      tasklist /FI "PID eq %%a" /FO LIST 2>nul | findstr /i "Image"
      echo  PID: %%a
    )
  )
) else (
  echo  dsh web: NOT running.
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'Name=''powershell.exe''' | Where-Object CommandLine -match 'dsh-web-launcher' | Measure-Object | Select-Object -ExpandProperty Count" > "%TEMP%\sup-count.txt"
set /p SUP_COUNT=<"%TEMP%\sup-count.txt"
if !SUP_COUNT! GTR 0 (
  echo  supervisor: RUNNING
) else (
  echo  supervisor: NOT running
)
netstat -ano | findstr /c:":5037 " | findstr /c:"LISTENING" >nul 2>&1
if !errorlevel!==0 (
  echo  ADB server: RUNNING.
) else (
  echo  ADB server: NOT running.
)
echo.
echo  Local dsh version:
call dsh --version 2>&1
if exist "%LATEST_FILE%" (
  set "LATEST="
  set /p LATEST=<"%LATEST_FILE%"
  if defined LATEST (
    echo  Latest available: !LATEST!
  )
)
pause
goto menu

REM ================== LOGS ==================
:logs
echo.
powershell -NoProfile -Command "$d = if (Test-Path '%LAUNCH_LOG_DIR%') { Get-ChildItem '%LAUNCH_LOG_DIR%' -Filter 'launcher-*.log' | Sort-Object LastWriteTime | Select-Object -Last 1 } else { $null }; if ($d) { 'Latest supervisor log: ' + $d.Name; Get-Content $d.FullName -Tail 20 } else { 'No supervisor logs yet.' }"
if exist "%LAUNCH_LOG_DIR%\dsh-web-stdout.log" (
  echo.
  echo  dsh web stdout tail 10:
  powershell -NoProfile -Command "Get-Content -LiteralPath '%LAUNCH_LOG_DIR%\dsh-web-stdout.log' -Tail 10"
)
if exist "%LAUNCH_LOG_DIR%\dsh-web-stderr.log" (
  echo.
  echo  dsh web stderr tail 10:
  powershell -NoProfile -Command "Get-Content -LiteralPath '%LAUNCH_LOG_DIR%\dsh-web-stderr.log' -Tail 10"
)
if exist "%LOG%" (
  echo.
  echo  dsh web run log tail 10:
  powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 10"
)
pause
goto menu

REM ================== UPGRADE ==================
:upgrade
echo.
echo  Current version:
call dsh --version 2>&1
echo.
echo  Checking npm registry for the latest version...
call npm view @deepseek-ai/dsh version 2>&1
echo.
echo   [1]  Upgrade now
echo   [2]  Back to menu
echo.
set "UPG="
set /p UPG=Choice^> 
if not "%UPG%"=="1" (
  echo  Upgrade cancelled.
  goto menu
)
if exist "%LAUNCHER%" (
  echo  Stopping via supervisor...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Stop
) else (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr /c:"LISTENING"') do (
    if not "%%a"=="0" taskkill /PID %%a /F /T >nul 2>&1
  )
)
echo.
echo  Running: npm install -g @deepseek-ai/dsh@latest
call npm install -g @deepseek-ai/dsh@latest 2>&1
echo.
echo  Upgrade finished. New version:
call dsh --version 2>&1
del "%LATEST_FILE%" 2>nul
if exist "%LAUNCHER%" (
  echo  Restarting supervisor...
  start "" powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
  timeout /t 6 /nobreak >nul
  start "" "%URL%"
)
pause
goto menu

REM ================== ADB CHECK ==================
:ensure_adb
if not exist "%ADB%" exit /b 0
netstat -ano | findstr /c:":5037 " | findstr /c:"LISTENING" >nul 2>&1
if !errorlevel!==0 exit /b 0
"%ADB%" start-server >nul 2>&1
exit /b 0

REM ================== QUIT ==================
:quit
echo.
echo  Note: service keeps running in background (supervised).
echo  To stop it use option 2.
pause
exit /b
