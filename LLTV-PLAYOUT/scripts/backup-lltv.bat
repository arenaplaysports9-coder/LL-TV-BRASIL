@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-lltv.ps1"
if errorlevel 1 pause
