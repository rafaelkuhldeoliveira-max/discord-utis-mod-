# DiscordUtils+ — Fake Mute e Fake Voice

Versao atualizada: **somente controles de voz**. A antiga aba `Apagadas 24h`, o registro de mensagens e as respectivas opcoes foram removidos.

O instalador tem o visual original do [DarkModeBR/DiscordUtils](https://github.com/DarkModeBR/DiscordUtils) (licenca MIT): janela escura com **Instalar / Atualizar**, **Reparar** e **Desinstalar**.

## Instale diretamente pelo PowerShell

```powershell
irm https://tinyurl.com/Discord-Mod-v1 | iex
```

Se o link encurtado nao redirecionar ao arquivo novo, use diretamente:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1 | iex
```

No menu grafico, clique em **Instalar / Atualizar**. Para substituir uma versao anterior, **Instalar / Atualizar** copia o complemento novo e reinicia o cliente. **Reparar** reaplica os arquivos; se usar Reparar com o Discord aberto, pressione Ctrl+R no Discord apos concluir.

## Controles

- **Fake Mute (pequeno):** envia `self_mute=true` no evento `VOICE_STATE_UPDATE` do Gateway; nao chama `MediaEngine.setMute`, portanto nao deve cortar o microfone fisico.
- **Fake Voice (maior):** envia `self_mute=true` e `self_deaf=true` no Gateway; nao executa o ensurdecimento local.
- O painel inclui a aba **Voz**, com duas secoes: estado da chamada e botoes, mais as opcoes para mostrar/ocultar cada controle.
- Ambos os modos podem ser ativados ao mesmo tempo. O Fake Voice prevalece no estado informado (mute + deaf). Ao desligar os modos, o plugin volta a enviar o estado real do microfone e dos fones.
- Quando fora da chamada, os controles ficam **preparados**, e tentam aplicar automaticamente quando o Discord conecta.
- O modulo se reinscreve nos eventos de conexao e religa o hook no socket apos uma reconexao.

## Validacao e limite

O novo complemento passou em **testes locais simulados** com socket de Gateway, eventos Flux e saida de controle. Ainda nao foi testado em uma instalacao real do Discord para Windows nesta sessao. O envio do estado ao Gateway nao prova, por si, que os outros participantes estao vendo esse estado; isso deve ser confirmado em uma chamada real.

## Arquivos

- `instalar-global.ps1`, `instalar.ps1`, `install-plugin.ps1`: entradas que abrem o mesmo menu grafico
- `discordutils-plus/instalador-gui.ps1`: instalador grafico do original adaptado com integracao do complemento
- `discordutils-plus/addon.js`: controles Fake Mute e Fake Voice
- `discordutils-plus/LICENSE_ORIGINAL.txt`: licenca MIT do projeto base

O instalador verifica o SHA-256 do complemento, faz backup do renderer original e desativa autoUpdate do renderer para preservar a modificacao.

## Desinstalar

Execute o mesmo comando e clique em **Desinstalar** para restaurar o cliente. Ao iniciar a nova versao, dados antigos de mensagens apagadas salvos no armazenamento local pelo complemento anterior sao apagados.
