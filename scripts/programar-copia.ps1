# Deja `npm run copia` corriendo sola cada domingo a las 11 a. m. en este computador.
# Si a esa hora estaba apagado, corre apenas se prenda. Uso: npm run copia:programar
# Para quitarla: Unregister-ScheduledTask -TaskName 'You and me - copia' -Confirm:$false
# (Sin tildes a proposito: PowerShell 5.1 lee mal los .ps1 sin BOM.)
$proyecto = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source

$accion = New-ScheduledTaskAction -Execute $node -Argument '--env-file=.env scripts/copia.mjs' -WorkingDirectory $proyecto
$cuando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 11am
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName 'You and me - copia' -Action $accion -Trigger $cuando -Settings $ajustes -Force `
  -Description 'Copia de seguridad semanal de You and me (base de datos, fotos y audios)' | Out-Null

Write-Host "Listo: la copia corre sola cada domingo a las 11 a. m. desde $proyecto"
