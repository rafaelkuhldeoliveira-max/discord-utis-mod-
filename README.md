# discord-utis-mod-

Projeto experimental de interface local para Discord. Os módulos deste pacote são demonstrações visuais: não alteram estado de voz, não capturam mensagens apagadas e não enviam nem editam mensagens no servidor.

## Estrutura

- `plugin/inject.js`
- `plugin/renderer.js`
- `plugin/style.css`
- `plugin/settings.json`
- `install-plugin.ps1` — instalador gráfico para selecionar módulos e baixar os arquivos
- `instalar.ps1` — bootstrap que baixa e abre o instalador gráfico

## Instalação

Abra o **PowerShell** no Windows e cole:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar.ps1 | iex
```

O instalador vai:
1. Baixar e abrir o instalador gráfico (`install-plugin.ps1`).
2. Permitir selecionar os módulos disponíveis.
3. Baixar os arquivos para `%APPDATA%\discord-utis-mod` e gravar a seleção em `settings.json`.

Se aparecer erro de política de execução, use:

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar.ps1 | iex"
```

> **Importante:** o instalador prepara os arquivos e as configurações, mas não instala nem injeta código no cliente Discord. Revise scripts baixados da internet antes de executá-los.

### Módulos disponíveis

- **Fake Voice (simulação local)** — controles visuais fictícios, sem conexão real a canal de voz.
- **Log de mensagens** — interface de registro; captura automática não implementada.
- **Editor local** — pré-visualizações locais, não altera nem envia mensagens no servidor.
