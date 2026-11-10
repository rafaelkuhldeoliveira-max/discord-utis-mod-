# instalar.ps1 — Bootstrap do instalador gráfico
$ErrorActionPreference = 'Stop'

$url = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/install-plugin.ps1'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('discord-utis-mod-installer-' + [guid]::NewGuid().ToString('N') + '.ps1')

try {
    Write-Host 'Baixando instalador com painel...' -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing
    if (-not (Test-Path $temp) -or (Get-Item $temp).Length -lt 100) {
        throw 'O instalador baixado está vazio ou incompleto.'
    }

    Write-Host 'Abrindo painel de instalação...' -ForegroundColor Cyan
    & $temp
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "O instalador terminou com código $LASTEXITCODE."
    }
}
finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}
