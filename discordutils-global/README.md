# DiscordUtils Global Mod — Fake Mute / Fake Voice

Integrado ao painel original do DiscordUtils. Aba **Mod**, com controles separados e persistentes.

## Comportamento projetado
- Fake Mute: publica `self_mute: true` no Gateway sem clicar no mute local.
- Fake Voice: publica `self_deaf: true` no Gateway sem clicar no deafen local.
- Ligado: os controles do Discord identificados pelo plugin recebem fundo/risco vermelho.
- Desligado: as classes visuais são removidas, sem mudar as funções nativas.
- A prévia visual **não prova** que outros usuários receberam o estado. O painel distingue mensagem enviada de estado confirmado.
- O áudio não é modificado diretamente pelo plugin, mas o servidor ou cliente Discord pode bloquear/alterar o áudio ao receber estados de mute/deafen.

## Instalação
1. Feche o Discord completamente.
2. Abra Windows PowerShell e execute:

```powershell
irm 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1' | iex
```
3. No instalador original preservado, clique **Instalar / Atualizar**.
4. Abra Discord Utils → **Mod**. Configure Fake Mute e Fake Voice de forma independente.

## Diagnóstico
No console de desenvolvedor (com o Discord carregado), rode:

```javascript
window.DiscordUtils.voiceModStatus()
```

Campos importantes:
- `gatewayHook`: interceptação WebSocket registrada.
- `voiceChannelDetected`: o plugin capturou o quadro de voz.
- `sentVoiceFrames`: número de quadros de estado enviados/modificados.
- `remoteVoiceConfirmed`: chegou um evento `VOICE_STATE_UPDATE` do seu usuário com os valores esperados.
- `localButtonsFound`: reconhecimento dos botões do Discord na interface.
- `microphoneAudible`/`outputAudible`: sempre `null`, pois não é possível medir isso automaticamente pelos eventos de estado.

## Como conferir numa chamada real
Entre com uma segunda conta no canal. Com o microfone funcionando e a segunda conta ouvindo, ative Fake Mute e confirme se (1) ela vê microfone riscado e (2) continua recebendo sua voz. Depois ative Fake Voice e confirme se (3) ela vê fone riscado e (4) você continua recebendo áudio. Desative cada opção e confira a restauração. Se uma etapa falhar, o plugin não atende ao comportamento pretendido nessa versão do Discord.

## Testes efetuados
14 casos simulados em WebSocket e DOM passaram: estados individuais, ativação/desativação, passthrough de pacotes não relacionados, eco do Gateway, preservação dos controles de Configurações, limpeza de sessão e ausência de interceptação de captura de áudio. **Não houve teste dentro de uma chamada real**.

Base original: [DarkModeBR/DiscordUtils](https://github.com/DarkModeBR/DiscordUtils). Os três arquivos principais deste diretório contêm a interface original e as adições localizadas. 
