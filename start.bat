@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Starting claudeindd...
echo Close this window to stop the bot and the MCP server.
echo.

call npx tsx src\index.ts

echo.
echo claudeindd stopped.
pause
