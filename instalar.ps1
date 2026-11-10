# instalar.ps1 — instala o plugin em %APPDATA%
$ErrorActionPreference = 'Stop'

$Install = Join-Path $env:APPDATA 'discord-utis-mod'
New-Item -ItemType Directory -Force -Path $Install | Out-Null

$base = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/plugin'
@('inject.js','renderer.js','style.css','settings.json') | ForEach-Object {
    Invoke-WebRequest "$base/$_" -OutFile (Join-Path $Install $_)
}

Write-Host "Plugin instalado em: $Install" -ForegroundColor Green
