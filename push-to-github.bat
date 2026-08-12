@echo off
setlocal
title Claude Skills MCP Connector - GitHub Push

echo.
echo ================================================
echo Claude Skills MCP Connector - GitHub Setup
echo ================================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed or is not in PATH.
  echo Install Git for Windows, then run this file again.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing Git repository...
  git init
)

echo Adding project files...
git add .

echo.
git commit -m "Update Claude Skills MCP connector"
if errorlevel 1 (
  echo.
  echo No new commit was created. This can happen if nothing changed.
)

git branch -M main

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/trytotest13/Claude-Skills-MCP-Connector.git
) else (
  git remote set-url origin https://github.com/trytotest13/Claude-Skills-MCP-Connector.git
)

echo.
echo Remote:
git remote -v

echo.
echo This will replace the main branch on:
echo https://github.com/trytotest13/Claude-Skills-MCP-Connector
echo.
choice /C YN /M "Push with force to replace the GitHub version"
if errorlevel 2 (
  echo Push cancelled.
  pause
  exit /b 0
)

git push -u origin main --force

if errorlevel 1 (
  echo.
  echo PUSH FAILED.
  echo Copy the complete error above and send it to ChatGPT.
  pause
  exit /b 1
)

echo.
echo ================================================
echo SUCCESS: Project pushed to GitHub.
echo ================================================
pause
