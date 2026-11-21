# Coleira Oraculo X — vinculo manual de duas contas

Bot oficial Discord (discord.js) para acompanhar a troca de canais de voz de maneira **voluntaria**. A interface permite escolher manualmente dois IDs, sem tokens de conta pessoal ou chaves digitadas no painel.

## Configurar o bot oficial

Use **Node.js 24.17+**, crie um aplicativo/bot em https://discord.com/developers/applications e adicione o bot ao servidor com os escopos `bot` e `applications.commands` e permissoes **Mover membros**, **Ver canais** e **Conectar**.

Na pasta `coleira-bot`:

```powershell
Copy-Item .env.example .env
# Abra .env no editor e configure os dados do bot
npm install
npm start
```

No arquivo privado `.env`, preencha `DISCORD_BOT_TOKEN` com **token do bot oficial** (nunca de conta pessoal), `DISCORD_GUILD_ID` com o ID do servidor e `DISCORD_OWNER_ID` com o ID da sua conta **administradora** (a conta que pode operar o painel). Mantenha `COLEIRA_PORT=37659`. **Nao envie o .env ao GitHub.**

O bot cria uma chave aleatoria no computador para autenticar a ponte local em `127.0.0.1:37659`. O usuario **nao digita nenhuma chave no painel**. O ID administrador e a chave interna sao ambos verificados; IDs sozinhos nao sao uma senha.

## Configurar os dois IDs no painel

Em **Oraculo X > Coleira**, preencha:

1. **ID de quem sera acompanhado (participante)**: pessoa que sera movida quando o lider trocar de canal, **depois que ela autorizar**.
2. **ID da pessoa que vai ser seguida (lider)**: pessoa cujos movimentos entre canais serao acompanhados.

Clique **Salvar vinculo dos dois IDs**, depois **Ligar**. Os IDs devem pertencer ao mesmo servidor e precisam ser diferentes. A configuracao e salva somente no arquivo privado `%APPDATA%\OraculoX\coleira-pair.json` (no Windows), para carregar na proxima inicializacao do bot. Ao alterar qualquer ID, a Coleira desliga e o consentimento antigo e descartado.

**Para autorizar**, a pessoa do primeiro ID deve entrar no mesmo canal de voz da pessoa do segundo ID e usar `/seguir`. Ao mudar de canal, o bot a move somente se ela ainda estiver no canal antigo, com autorizacao valida. Ela pode usar `/parar`, desconectar ou trocar manualmente de canal a qualquer momento: isso cancela a autorizacao. **Nao ha puxao forcado, reentrada automatica apos sair nem uso de self-bot.**

O bot possui os comandos `/coleira ligar`, `/coleira desligar` e `/coleira status` (somente administrador), `/seguir` e `/parar`. O painel tambem oferece **Conectar / Atualizar**, **Ligar** e **Desligar**.

## Diagnostico

- **Bot offline**: inicie `npm start` na pasta `coleira-bot`, no mesmo computador do cliente modificado.
- **ID do administrador nao corresponde**: confira `DISCORD_OWNER_ID` no `.env`. Este ID e separado dos dois IDs configuraveis.
- **Nao conseguiu salvar o vinculo**: confirme se os dois IDs existem no servidor e se o bot pode consultar esses membros.
- **Nao move**: confira se a Coleira esta ligada, se a pessoa do primeiro ID executou `/seguir` enquanto estava na chamada do lider e se o bot tem permissao `Mover membros` em ambos os canais.

Teste local de politica:

```powershell
npm test
```

O bot e o mod ainda precisam de teste real com participantes autorizados em um servidor Discord. Testes automatizados de sintaxe e consentimento nao garantem funcionamento em todas as versoes do cliente.
