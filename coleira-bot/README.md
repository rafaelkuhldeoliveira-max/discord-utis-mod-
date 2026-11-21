# Coleira para DiscordUtils Mod

Adaptacao da ideia do repositorio byoulis/discord-coleira, com bot oficial e participacao voluntaria. Nao utiliza self-bot nem token de usuario.

## Pre-requisitos

- Node.js 24.17 ou superior.
- Bot criado em https://discord.com/developers/applications com permissoes **Mover membros**, **Conectar** e **Ver canais**.
- Convite do bot com escopos **bot** e **applications.commands** no servidor desejado.

## Configuracao (PowerShell)

Entre na pasta `coleira-bot`, copie `.env.example` para `.env` e edite as credenciais:

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Use somente o token **do bot**. Em `.env`, preencha `DISCORD_GUILD_ID` com o ID do servidor, `DISCORD_OWNER_ID` com seu ID do dono do bot. **Nao existe chave para digitar no painel**: o bot gera um segredo temporario e o processo local le esse segredo com permissoes do sistema operacional. O vinculo da conta e validado por ID.

A ponte usa apenas `127.0.0.1:37659`, portanto mantenha `COLEIRA_PORT=37659`. **Nao publique `.env`**.

## Integracao ao DiscordUtils Mod

Instale/atualize o seu mod pelo instalador principal **apos incorporar a alteracao no branch main**. Abra **Oraculo X > Coleira** e clique em **Conectar / Atualizar**. O ID exibido no painel precisa ser o mesmo de `DISCORD_OWNER_ID`. Nao precisa digitar token ou chave no painel. Depois use **Ligar** ou **Desligar** no painel.

Para o controle funcionar, deixe o bot aberto com `npm start` no mesmo computador onde roda o Discord modificado.

## Comandos

- `/coleira ligar`, `/coleira desligar`, `/coleira status` — somente o dono da conta configurada no .env.
- `/seguir` — participante se autoriza voluntariamente, estando na mesma chamada do dono com a coleira ligada.
- `/parar` — participante cancela a autorizacao a qualquer momento.

Quando o dono muda de canal, apenas usuarios que fizeram `/seguir` e **ainda estavam no canal anterior** sao movidos. Quem sair, trocar manualmente de canal ou usar `/parar` nao sera puxado de volta. Desativar zera a lista de participantes.

## Testes

```powershell
npm test
```

## Arquitetura

- `src/index.js`: bot Discord com intents de servidores/voz, comandos e controlador local.
- `src/policy.js`: regras de consentimento e acompanhamento.
- `test/policy.test.js`: testes unitarios.
- `discordutils-global/renderer.js`: nova aba Coleira sem alterar Fake Mute e Fake Voice.
- `discordutils-global/inject.js`: comunicacao entre painel e bot pelo localhost, com segredo interno gerado automaticamente, nunca exposto na interface.

O bot e o cliente Oraculo X nao foram verificados em chamada real neste PR. Revisao manual das permissoes e teste com participantes voluntarios sao recomendados.
