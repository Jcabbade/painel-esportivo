# Sobe o servidor do Painel Esportivo em segundo plano (sem janela).
$backend = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend'
$pythonw = Join-Path $backend '.venv\Scripts\pythonw.exe'

$jaRodando = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($jaRodando) { exit 0 }

Start-Process -FilePath $pythonw -ArgumentList '-m', 'painel.main' -WorkingDirectory $backend -WindowStyle Hidden
