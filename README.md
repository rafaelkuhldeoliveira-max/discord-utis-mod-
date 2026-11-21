# ORACULO X — DiscordUtils Mod (experimental)

**Tema:** preto + vermelho carmesim. O instalador passou a usar o renderer GLOBAL do Oraculo X; preserva a aba **Missoes**, o acompanhamento de **Orbs** e as demais funcoes do arquivo `discordutils-global/renderer.js`, sem instalar um segundo interceptor de voz.

## Voz — alteracoes sem reiniciar

- **Fake Mute**: botao pequeno, atalho **F6**, envia `self_mute=true` e preserva o microfone local.
- **Fake Voice**: botao maior, atalho **F7**, envia `self_mute=true` e `self_deaf=true`, preservando o audio local.
- Abra **Oraculo X > Mod** para ligar/desligar os dois interruptores. Os botoes extras na barra de voz tambem alternam imediatamente. **Nao existe aviso de reinicio por clique.**
- As preferencias de voz ficam salvas nas configuracoes locais. Fora de uma chamada o estado fica preparado e pode depender da proxima conexao/reconexao.
- O mecanismo tenta o WebSocket ou o modulo Gateway interno; o Discord pode alterar essas interfaces a qualquer momento. O painel informa envios nao confirmados. **A exibição para outras pessoas nao foi comprovada em chamada real.** Confirme numa chamada de teste com outra conta.

## Coleira — vinculada pelo ID

O painel **Oraculo X > Coleira** identifica automaticamente o ID da sua conta Discord. Ele precisa coincidir com o `DISCORD_OWNER_ID` configurado no bot.

**Nenhum token ou chave precisa ser digitado no painel.** O bot gera automaticamente um segredo temporario num arquivo local privado (`%APPDATA%\\OraculoX\\coleira-bridge.json`), e a ponte nativa o utiliza para autenticar o controle. O ID identifica a conta, mas nao serve como senha.

O bot **oficial** precisa de `DISCORD_BOT_TOKEN` no arquivo `coleira-bot/.env`, e somente ali. Esse token e de aplicativo/bot, nao o token pessoal da sua conta. Configure `DISCORD_GUILD_ID`, `DISCORD_OWNER_ID` e mantenha `COLEIRA_PORT=37659`.

O bot deve ser iniciado separadamente no mesmo computador:

```powershell
cd coleira-bot
Copy-Item .env.example .env
# Edite o arquivo .env e configure os IDs e o token do BOT OFICIAL
npm install
npm start
```

No servidor, voce controla com `/coleira ligar`, `/coleira desligar` ou pelos botoes do painel. Um participante entra voluntariamente com `/seguir` e sai com `/parar`, ao sair ou trocar manualmente de canal. **Nao existe reentrada forcada.** Leia [instrucoes detalhadas](coleira-bot/README.md).

## Instalar / atualizar

Revise [instalar-global.ps1](instalar-global.ps1) antes de executar qualquer script remoto. No PowerShell:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1 | iex
```

Na janela **ORACULO X**, escolha **Instalar / Atualizar** (ou **Reparar** para reaplicar). O instalador verifica SHA-256 do renderer e da ponte nativa. A instalacao pode fechar e reabrir o Discord **uma vez** para carregar arquivos novos; o uso normal dos botoes Fake Mute e Fake Voice nao requer reinicio. **Desinstalar** restaura o cliente.

O repositório inclui um plugin Vencord **opcional, separado**, em [vencord-userplugin/oraculoXFakeVoice](vencord-userplugin/). Depois de compilado e ativado, alternar `fakeMute` e `fakeDeafen` nele nao exige reinicio, mas ativar pela primeira vez um plugin Vencord com patch pode exigir.

## Advertencias e testes

As mudancas sao experimentais. Alteracoes no Gateway do Discord podem impedir a funcionalidade. Nao foram realizados testes no cliente Discord real nesta sessao. O bot de Coleira usa as permissoes do bot oficial e acompanha apenas pessoas autorizadas.

Uma verificacao automatica de sintaxe e regras de consentimento esta descrita em [GitHub Actions](.github/workflows/oraculo-x-check.yml). Se GitHub Actions nao estiver habilitado, os testes ainda nao terao sido executados.

- Base de instalador: [DarkModeBR/DiscordUtils](https://github.com/DarkModeBR/DiscordUtils), licenca MIT.
- Referencia de Fake Mute: [mrcrossog/FakeMuteX](https://github.com/mrcrossog/FakeMuteX).
- Inspiracao para Coleira: [byoulis/discord-coleira](https://github.com/byoulis/discord-coleira), adaptado com bot oficial e consentimento.
