@echo off
REM ============================================================
REM  A $49.95 — Local Preview
REM  Double-click this file to start a local web server.
REM  Then open http://localhost:8080 in your browser.
REM
REM  Requires Node.js (already installed if you can read this).
REM  Press Ctrl+C to stop the server.
REM ============================================================

echo.
echo  Starting local preview at http://localhost:8080
echo  Press Ctrl+C to stop.
echo.

cd /d "%~dp0"

REM Try to open the browser automatically
start "" "http://localhost:8080"

REM Start the server (uses npx + the popular "http-server" package)
npx --yes http-server -p 8080 -c-1 .
