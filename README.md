# DiscordUtils+ — Instalador grafico para Windows

Baseado no projeto [DarkModeBR/DiscordUtils](https://github.com/DarkModeBR/DiscordUtils). O instalador abre **o mesmo painel grafico escuro da versao original**, com os botoes **Instalar / Atualizar**, **Reparar** e **Desinstalar**; os botoes usam o complemento deste repositorio.

## Instalacao pelo PowerShell (com menu)

Abra o PowerShell no Windows e execute:

```powershell
irm https://tinyurl.com/Discord-Mod-v1 | iex
```

O atalho TinyURL foi criado pelo responsavel pelo repositorio. Se o atalho nao redirecionar ao arquivo atualizado, use o link direto:

```powershell
irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1 | iex
```

Aguarde o carregamento e use **Instalar / Atualizar** na janela **Discord Utils+**. O comando inicia o menu em uma instancia do PowerShell separada, sem exigir ZIP.

## Funcoes inclusas

- **Fake Mute (botao pequeno):** transmite `self_mute: true` no estado da chamada sem cortar o microfone fisico.
- **Fake Voice (botao maior):** transmite `self_mute: true` e `self_deaf: true` sem desligar automaticamente audio local.
- **Apagadas 24h:** opcional, desligado inicialmente; registra localmente mensagens capturadas enquanto o Discord esta aberto para exibi-las se forem apagadas, com exclusao automatica do historico apos 24 horas. Nao recupera exclusoes anteriores a ativacao.
- **Opcoes dentro do Discord Utils** para ligar/desligar registro e mostrar/ocultar os dois botoes.

Os controles tentam reenviar o estado no Gateway real (`OP 4`), em vez de apenas alterar um icone. A compatibilidade depende do cliente Discord instalado. **Ainda nao houve validacao ao vivo no Discord para Windows; houve testes automatizados com Gateway/Flux simulados**.

## Como funciona o instalador

- `instalar-global.ps1`, `instalar.ps1` e `install-plugin.ps1`: entradas para abrir o menu grafico.
- `discordutils-plus/instalador-gui.ps1`: o instalador original personalizado, mantendo layout e operacoes de instalacao/reparo/remocao.
- `discordutils-plus/addon.js`: complemento dos botoes e das mensagens apagadas.
- `discordutils-plus/instalar.ps1`: entrada alternativa para o menu.
- `discordutils-plus/LICENSE_ORIGINAL.txt`: termos MIT da base original.

O instalador usa um commit fixo do DiscordUtils original e verifica SHA-256 do complemento antes de aplicar alteracoes ao `renderer.js`. Faz backup do renderer antes de adicionar as abas **Voz e privacidade** e **Apagadas 24h**. Desativa a atualizacao automatica do arquivo modificado para que ele nao seja substituido imediatamente.

## Reparar ou remover

Abra novamente o menu grafico com o mesmo comando PowerShell e escolha **Reparar** ou **Desinstalar**. Para usar diretamente sem o menu:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1))) -Reparar
```

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/instalar-global.ps1))) -Desinstalar
```

Requer Windows, acesso ao GitHub e Discord para desktop. Alteracoes nas implementacoes internas do Discord podem exigir reparos ou atualizacoes do complemento.
