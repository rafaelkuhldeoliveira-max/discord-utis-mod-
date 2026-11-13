# DiscordUtils+ — Fake Mute, Fake Voice e mensagens apagadas por até 24h

Esta versão substitui os antigos módulos demonstrativos do repositório por uma instalação integrada ao cliente Discord para Windows, usando como base o projeto [DarkModeBR/DiscordUtils](https://github.com/DarkModeBR/DiscordUtils) (licença MIT).

## Instalar com um comando PowerShell

Abra o **PowerShell** no Windows e cole:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1 | iex
```

O mesmo instalador também está nos links `instalar.ps1` e `install-plugin.ps1` da raiz.

## O que instala

- **Fake Mute**, botão menor ao lado dos controles de voz: altera o estado informado ao Discord, sem mudar o microfone local.
- **Fake Voice**, botão maior: informa mute/deafen ao Discord, mas não desliga a recepção local de áudio.
- **Apagadas 24h**: registra no armazenamento local mensagens que o cliente observou e que depois foram apagadas. É necessário ativar a função antes da exclusão; não recupera mensagens antigas. A retenção máxima é de 24 horas.
- **Painel do DiscordUtils+**, com opções separadas para exibir os botões e ativar o registro de mensagens (desligado por padrão).

O instalador baixa a versão fixa da base DarkModeBR/DiscordUtils, verifica o SHA-256 do complemento `discordutils-plus/addon.js`, aplica o patch e reinicia o Discord. A atualização automática do renderer original fica desativada para não apagar o complemento; use **Reparar** para atualizar/recuperar a instalação quando necessário.

## Reparar ou desinstalar

No PowerShell (sem `| iex`):

```powershell
& ([ScriptBlock]::Create((irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1))) -Reparar
```

```powershell
& ([ScriptBlock]::Create((irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1))) -Desinstalar
```

O instalador requer Windows e a versão desktop do Discord. **Os fluxos do gateway e de mensagens foram testados com mocks; a compatibilidade com a versão atual do cliente real ainda precisa ser validada no Windows.**
