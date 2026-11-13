[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$scriptUrl = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/discordutils-global/install-plugin.ps1'
$script = Invoke-RestMethod -Uri $scriptUrl -UseBasicParsing
if (-not $script -or $script.Length -lt 8000) { throw 'O instalador nao foi carregado corretamente.' }
Invoke-Expression $script
