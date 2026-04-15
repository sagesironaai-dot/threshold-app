@echo off
echo Creating Aelarian backup scheduled tasks...

schtasks /create /tn "Aelarian-Backup-Scheduled" /tr "C:\Users\sasir\AppData\Local\Programs\Python\Python314\python.exe C:\Users\sasir\Desktop\Aelarian\Archives\backup.py" /sc hourly /mo 4 /st 08:00 /ru BUILTIN\Administrators /rl HIGHEST /f
if %errorlevel% neq 0 (
    echo FAILED: Aelarian-Backup-Scheduled
    pause
    exit /b 1
)
echo OK: Aelarian-Backup-Scheduled

schtasks /create /tn "Aelarian-Backup-Startup" /tr "C:\Users\sasir\AppData\Local\Programs\Python\Python314\python.exe C:\Users\sasir\Desktop\Aelarian\Archives\backup.py" /sc onstart /delay 0001:00 /ru BUILTIN\Administrators /rl HIGHEST /f
if %errorlevel% neq 0 (
    echo FAILED: Aelarian-Backup-Startup
    pause
    exit /b 1
)
echo OK: Aelarian-Backup-Startup

echo.
echo Verifying tasks...
schtasks /query /tn "Aelarian-Backup-Scheduled"
schtasks /query /tn "Aelarian-Backup-Startup"

echo.
echo Both tasks created. Running Aelarian-Backup-Scheduled now to confirm...
schtasks /run /tn "Aelarian-Backup-Scheduled"

echo.
echo Done. Check backup.log in Archives/ for results.
pause
