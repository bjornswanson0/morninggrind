# Morning Grind — automatic backup mirror
# Copies the app folder to a backup location. Run by a Scheduled Task every 15 min + at logon.
$ErrorActionPreference = 'SilentlyContinue'
$src = 'C:\Users\bjorn.swanson\morning-workout-app'
$dst = 'C:\Users\bjorn.swanson\Documents\morning-workout-app-backup'
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
# /MIR mirrors (adds/updates/removes to match); exclude the tools log + any .git
robocopy $src $dst /MIR /XF backup.log /R:1 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
"Last backup: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Set-Content -Encoding utf8 "$src\tools\backup.log"
