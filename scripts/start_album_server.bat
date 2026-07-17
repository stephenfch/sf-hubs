@echo off
REM SFHubs-Album autostart script
REM Put shortcut of this file in shell:startup folder

cd /d C:\Users\Win 11\Desktop\sf-hubs
C:\Users\Win 11\.qwenpaw.venv\Scripts\python3.11.exe scripts\album_server.py --port 5300
