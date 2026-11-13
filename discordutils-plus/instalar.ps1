# DiscordUtils+ — integracao local com instalador DiscordUtils, MIT base.
# Instalacao remota (Windows PowerShell 5.1+):
# irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/discordutils-plus/instalar.ps1 | iex
# Instalacao local: powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar-discordutils-plus.ps1
[CmdletBinding()]
param(
    [switch]$Reparar,
    [switch]$Desinstalar,
    [string]$InstallDir = (Join-Path $env:APPDATA 'DiscordUtils'),
    [switch]$NaoReiniciar
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

function Info([string]$message) { Write-Host "[DiscordUtils+] $message" -ForegroundColor Cyan }
function Check([bool]$ok, [string]$message) { if (-not $ok) { throw $message } }

# Instalador remoto: no modo 'irm URL | iex', $PSScriptRoot fica vazio.
# Se houver addon local (uso por ZIP), ele continua sendo suportado.
$repoAddon = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/discordutils-plus/addon.js'
$expectedSha256 = '9716F35CD7C6A82E78BA04CC081AF6B4F7ED2B39D93D44FC742C7B8145A06C81'
$addon = $null
if ($PSScriptRoot) {
    $localAddon = Join-Path $PSScriptRoot 'addon.js'
    if (Test-Path -LiteralPath $localAddon -PathType Leaf) { $addon = $localAddon }
}
if (-not $Desinstalar -and -not $addon) {
    $downloadDir = Join-Path $env:TEMP 'DiscordUtilsPlus-Install'
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
    $addon = Join-Path $downloadDir 'addon.js'
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    Info 'Baixando addon do seu repositorio GitHub...'
    Invoke-WebRequest -UseBasicParsing -Uri $repoAddon -OutFile $addon
}
if (-not $Desinstalar) {
    Check (Test-Path -LiteralPath $addon -PathType Leaf) 'Nao foi possivel obter o addon.'
    $actualSha256 = (Get-FileHash -LiteralPath $addon -Algorithm SHA256).Hash
    Check ($actualSha256 -eq $expectedSha256) 'Hash do addon invalido: instalacao cancelada para evitar alteracoes inesperadas.'
}

# O repositorio de origem disponibiliza o instalador publicamente.
$fixedCommit = '530be26972a1a2e7b459e2daf421337fa1282fad'
$source = "https://raw.githubusercontent.com/DarkModeBR/DiscordUtils/$fixedCommit/plugin/install-plugin.ps1"
$temp = Join-Path $env:TEMP 'DiscordUtilsPlus-Install'
New-Item -ItemType Directory -Force -Path $temp | Out-Null
$base = Join-Path $temp 'install-plugin.ps1'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Info 'Baixando o instalador original DarkModeBR/DiscordUtils...'
Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $base
Check ((Get-Item $base).Length -gt 4000) 'Instalador original veio vazio ou incompleto.'

if (-not $NaoReiniciar) {
    Info 'Fechando Discord para aplicar arquivos com seguranca...'
    foreach ($name in @('Discord', 'DiscordCanary', 'DiscordPTB')) {
        Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

if ($Desinstalar) {
    Info 'Desinstalando via instalador de origem...'
    & $base -Action uninstall -InstallDir $InstallDir -NoRestart -Repo DarkModeBR/DiscordUtils -Branch $fixedCommit
    Info 'Remocao concluida.'
} else {
    $action = if ($Reparar) { 'repair' } else { 'install' }
    Info "Executando instalacao base: $action..."
    & $base -Action $action -InstallDir $InstallDir -NoRestart -Repo DarkModeBR/DiscordUtils -Branch $fixedCommit

    $renderer = Join-Path $InstallDir 'renderer.js'
    $inject = Join-Path $InstallDir 'inject.js'
    $settings = Join-Path $InstallDir 'settings.json'
    Check (Test-Path -LiteralPath $renderer -PathType Leaf) 'O renderer.js original nao foi instalado.'
    Check (Test-Path -LiteralPath $inject -PathType Leaf) 'O inject.js original nao foi instalado.'

    $sourceCode = [IO.File]::ReadAllText($renderer, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
    $addonCode = [IO.File]::ReadAllText($addon, [Text.Encoding]::UTF8)

    # Ponto de extensao dentro da mesma closure: acesso real ao webpack, stores e painel.
    $before = '    let panel, panelBody, tabButtons = [], activeTab = 0, positioned = false;'
    Check ($sourceCode.Contains($before)) 'Estrutura do renderer original mudou: marcador de painel nao localizado.'
    $insert = "    // === DiscordUtilsPlus: begin ===`n" + $addonCode + "`n    // === DiscordUtilsPlus: end ===`n" + $before
    $sourceCode = $sourceCode.Replace($before, $insert)

    $tabMarker = "    const tabs = [`n"
    Check ($sourceCode.Contains($tabMarker)) 'Estrutura de abas alterada pelo DiscordUtils original.'
    $newTabs = "    const tabs = [`n      { name: 'Voz e privacidade', icon: 'shield', render: DU_PLUS.renderSettings },`n      { name: 'Apagadas 24h', icon: 'clock', render: DU_PLUS.renderDeleted },`n"
    $sourceCode = $sourceCode.Replace($tabMarker, $newTabs)

    $startMarker = '      getRequire(); buildPanel(); insertNavItem();'
    Check ($sourceCode.Contains($startMarker)) 'Ponto de ativacao do renderer nao localizado.'
    $sourceCode = $sourceCode.Replace($startMarker, '      getRequire(); buildPanel(); insertNavItem(); DU_PLUS.start();')

    # A atualizacao automatica do upstream substituiria o mod customizado no boot.
    $cfg = if (Test-Path $settings) { Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    $cfg | Add-Member -NotePropertyName 'autoUpdate' -NotePropertyValue $false -Force
    $cfg | Add-Member -NotePropertyName 'autoPatch' -NotePropertyValue $true -Force
    [IO.File]::WriteAllText($settings, ($cfg | ConvertTo-Json -Depth 20), ([Text.UTF8Encoding]::new($false)))

    if (Test-Path $renderer) { Copy-Item $renderer "$renderer.original.bak" -Force }
    [IO.File]::WriteAllText($renderer, $sourceCode, ([Text.UTF8Encoding]::new($false)))
    Check (([IO.File]::ReadAllText($renderer)).Contains('DiscordUtilsPlus: begin')) 'Falha ao gravar renderer customizado.'
    Info 'Mod integrado: Fake Mute menor + Fake Voice maior + registro local por 24 horas.'
    Info 'Abas novas: Voz e privacidade / Apagadas 24h.'
    Info 'AutoUpdate do DiscordUtils base desligado para preservar o mod.'
}

if (-not $NaoReiniciar) {
    $root = Join-Path $env:LOCALAPPDATA 'Discord'
    $exes = @()
    foreach ($name in @('Discord', 'DiscordCanary', 'DiscordPTB')) {
        $dir = Join-Path $env:LOCALAPPDATA $name
        if (Test-Path $dir) {
            $exes += @(Get-ChildItem -Path $dir -Filter 'app-*' -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending |
                ForEach-Object { Join-Path $_.FullName "$name.exe" } |
                Where-Object { Test-Path $_ })
        }
    }
    if ($exes.Count -gt 0) {
        Info 'Iniciando Discord...'
        Start-Process -FilePath $exes[0]
    } else {
        Info 'Abra o Discord manualmente.'
    }
}
Info 'Concluido.'
