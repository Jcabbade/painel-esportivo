# Registra o Painel Esportivo para subir no logon do usuario atual e cria o atalho na Area de Trabalho.
# Nao precisa de administrador.
$ErrorActionPreference = 'Stop'
$iniciar = Join-Path $PSScriptRoot 'iniciar-painel.ps1'

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$iniciar`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'PainelEsportivo' -Action $acao -Trigger $gatilho -Settings $ajustes `
    -Description 'Servidor local do Painel Esportivo (porta 8765)' -Force | Out-Null

$atalho = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Painel Esportivo.url'
Set-Content -Path $atalho -Encoding ASCII -Value "[InternetShortcut]`r`nURL=http://localhost:8765/"

Write-Host 'Pronto: o painel sobe junto com o Windows. Atalho criado na Area de Trabalho.'
Write-Host 'Para iniciar agora sem reiniciar: Start-ScheduledTask -TaskName PainelEsportivo'
