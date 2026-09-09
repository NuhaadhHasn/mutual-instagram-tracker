@echo off
title Mutual
cd /d "%~dp0"
set PORT=8321

where node >nul 2>&1
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  node server.js %PORT%
  goto :end
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

echo.
echo   Mutual needs either Node.js or Python installed to run locally.
echo.
echo   Install one of these, then double-click this file again:
echo     Node.js   https://nodejs.org
echo     Python    https://python.org
echo.
pause

:end
