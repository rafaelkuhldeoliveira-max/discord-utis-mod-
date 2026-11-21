# ORACULO X - DiscordUtils Mod (experimental)

Tema preto e vermelho carmesim. O instalador grafico usa a base DiscordUtils e injeta o complemento de voz e a aba Coleira.

- **Voz:** Fake Mute (botao pequeno), Fake Voice (botao maior), opcoes para mostrar/ocultar os botoes, atalhos F6/F7 e aviso pedindo para fechar/reabrir o Discord apos alteracoes. Os estados de voz escolhidos sao salvos por conta.
- **Coleira:** bot oficial em `coleira-bot`, controlado pela aba Coleira do painel via ponte local autenticada. Apenas participantes que fizerem `/seguir` podem ser movidos junto com o dono, e podem cancelar a qualquer momento com `/parar`, ao sair ou ao trocar de canal.
- **Vencord (opcional e separado):** `vencord-userplugin/oraculoXFakeVoice/index.ts`, com o import solicitado e `restartNeeded: true`. Requer Vencord compilado a partir do fonte, e nao e instalado pelo PowerShell.
- **Instalador:** `instalar-global.ps1`, com menu Instalar / Atualizar, Reparar e Desinstalar e verificacao SHA-256 do complemento e da ponte Coleira.

## Como usar

Leia o codigo de `instalar-global.ps1` antes de executa-lo. Abra o PowerShell e use:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1 | iex
```

No menu, clique em **Instalar / Atualizar**; feche completamente o Discord pela bandeja e reabra caso nao apareca **Oraculo X > Voz / Coleira**.

A Coleira **nao e iniciada automaticamente** pelo instalador: configure o token do bot oficial em `coleira-bot/.env` a partir de `.env.example` e rode `npm install` e `npm start` na pasta `coleira-bot`. Mantenha `COLEIRA_PORT=37659`. Nunca cole o token da sua conta pessoal.

O Fake Mute/Fake Voice dependem do comportamento interno e mutavel do Discord e **nao ha garantia de estado visivel para outras pessoas**. Nao foram testados em uma chamada real de Discord para Windows nesta sessao. O uso de mods nao oficiais pode contrariar as regras da plataforma. Os testes automatizados de sintaxe e consentimento estao definidos em `.github/workflows/oraculo-x-check.yml`, mas dependem do GitHub Actions estar habilitado.

---

# DiscordUtils+ — Fake Mute e Fake Voice

**Mecanismo FakeMuteX integrado:** [mrcrossog/FakeMuteX](https://github.com/mrcrossog/FakeMuteX), versão 1.2.7 (MrCross). O interceptor `WebSocket.prototype.send` e a configuração de atalho foram adaptados para o renderer do DiscordUtils; o plugin BetterDiscord original não é instalado e nenhuma dependência `BdApi` é necessária.

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

- **Fake Mute (pequeno):** envia `self_mute=true` no evento `VOICE_STATE_UPDATE` do Gateway, sem desligar o microfone local. Usa o módulo interno do Gateway e, se indisponível, o interceptor WebSocket adaptado do FakeMuteX.
- **Fake Voice (maior):** envia `self_mute=true` e `self_deaf=true` no Gateway; nao executa o ensurdecimento local.
- O painel inclui a aba **Voz**, com duas secoes: estado da chamada e botoes, mais as opcoes para mostrar/ocultar cada controle.
- Ambos os modos podem ser ativados ao mesmo tempo. O Fake Voice prevalece no estado informado (mute + deaf). Ao desligar os modos, o plugin volta a enviar o estado real do microfone e dos fones.
- Quando fora da chamada, os controles ficam **preparados**, e tentam aplicar automaticamente quando o Discord conecta.
- O módulo se reinscreve nos eventos de conexão e religa o hook no socket após reconexões.
- **Atalho Fake Mute:** F6 por padrão; configurável na aba **Voz**, incluindo combinações Ctrl, Shift, Alt e NumPad.
- **Atalho Fake Voice:** F7 por padrão; também configurável. Os dois atalhos funcionam com os botões extras ocultos.
- **Visualização local:** a opção **Mostrar meu estado falso** coloca o indicador na barra de voz e, quando localizado, junto ao seu nome na lista de participantes. Fake Mute mostra microfone riscado; Fake Voice mostra microfone e fones riscados. Não altera os controles reais de mute/deafen.
- **Compatibilidade:** o interceptor observa somente pacotes JSON de voz (opcode 4); formatos binários desconhecidos ou compactados não são alterados.

## Validacao e limite

O complemento passou nos testes simulados de Gateway direto, WebSocket (JSON e ArrayBuffer), desativação e atalhos F6/F7. A visualização local depende da estrutura de interface da versão instalada. Ainda não foi testado em uma instalação real do Discord para Windows nesta sessão. O envio do estado ao Gateway não prova que outras pessoas estejam vendo esse estado; confirme em uma chamada real.

## Arquivos

- `instalar-global.ps1`, `instalar.ps1`, `install-plugin.ps1`: entradas que abrem o mesmo menu grafico
- `discordutils-plus/instalador-gui.ps1`: instalador grafico do original adaptado com integracao do complemento
- `discordutils-plus/addon.js`: controles Fake Mute e Fake Voice
- `discordutils-plus/LICENSE_ORIGINAL.txt`: licenca MIT do projeto base

O instalador verifica o SHA-256 do complemento, faz backup do renderer original e desativa autoUpdate do renderer para preservar a modificacao.

## Desinstalar

Execute o mesmo comando e clique em **Desinstalar** para restaurar o cliente. Ao iniciar a nova versao, dados antigos de mensagens apagadas salvos no armazenamento local pelo complemento anterior sao apagados.

## Coleira — bot oficial (participacao voluntaria)

O projeto agora inclui uma nova aba **Coleira** no painel e o bot complementar com os comandos `/coleira`, `/seguir` e `/parar`.
Os usuarios precisam consentir com `/seguir` na mesma chamada; sair ou trocar de canal cancela o acompanhamento.
Leia as instrucoes em [coleira-bot/README.md](coleira-bot/README.md). O bot deve ser iniciado separadamente com Node.js; o instalador PowerShell continua instalando apenas o plugin.
