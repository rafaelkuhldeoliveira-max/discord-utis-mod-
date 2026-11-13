# DiscordUtils+ — Menu grafico original (Instalar / Atualizar, Reparar, Desinstalar).
# Uso: irm https://tinyurl.com/Discord-Mod-v1 | iex
[CmdletBinding()]
param(
    [switch]$Reparar,
    [switch]$Desinstalar,
    [switch]$NaoReiniciar
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Reparar -and $Desinstalar) { throw 'Escolha apenas Reparar ou Desinstalar.' }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$guiUrl = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/discordutils-plus/instalador-gui.ps1'
$tempDir = Join-Path $env:TEMP 'DiscordUtilsPlus-boot'
New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
$scriptPath = Join-Path $tempDir 'instalador-gui.ps1'
Write-Host '[DiscordUtils+] Baixando instalador com menu grafico...' -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -Uri $guiUrl -OutFile $scriptPath
if (-not (Test-Path -LiteralPath $scriptPath) -or (Get-Item -LiteralPath $scriptPath).Length -lt 20000) {
    throw 'Falha ao baixar instalador grafico completo.'
}
if ($Reparar -or $Desinstalar) {
    $parametros = @{ Action = $(if ($Desinstalar) { 'uninstall' } else { 'repair' }) }
    if ($NaoReiniciar) { $parametros.NoRestart = $true }
    & $scriptPath @parametros
} else {
    $ps = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $ps)) { $ps = 'powershell.exe' }
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ("`"" + $scriptPath + "`""))
    if ($NaoReiniciar) { $args += '-NoRestart' }
    Start-Process -FilePath $ps -WindowStyle Hidden -ArgumentList $args
    Write-Host '[DiscordUtils+] Menu aberto: Instalar / Atualizar, Reparar, Desinstalar.' -ForegroundColor Green
}
