# DiscordUtils+ — entrada PowerShell: suporta irm URL | iex
[CmdletBinding()]
param(
    [switch]$Reparar,
    [switch]$Desinstalar,
    [switch]$NaoReiniciar
)
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$source = [string](Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/discordutils-plus/instalar.ps1' -UseBasicParsing)
if ([string]::IsNullOrWhiteSpace($source) -or $source.Length -lt 4000) { throw 'Instalador DiscordUtils+ vazio ou incompleto.' }
& ([ScriptBlock]::Create($source)) @PSBoundParameters
