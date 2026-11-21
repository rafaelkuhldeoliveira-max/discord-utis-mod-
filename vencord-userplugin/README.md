# Oraculo X - plugin opcional para Vencord

Este diretório contem o exemplo **Fake Voice Options** adaptado a partir do codigo enviado pelo usuario, com credito ao autor SaucyDuck.

## Importante

O plugin Vencord é **separado** do complemento instalado pelo PowerShell do DiscordUtils. Nao execute o arquivo TypeScript diretamente no PowerShell, nem misture dois patchers do Discord no mesmo cliente sem verificar conflitos.

Este plugin altera apenas chamadas de mute/deafen **locais**. Nao garante que outros participantes vejam um estado falso. O funcionamento depende da versao atual do Discord/Vencord e nao foi verificado em uma chamada real.

## Instalacao manual no Vencord

1. Prepare uma copia de desenvolvimento do Vencord seguindo https://docs.vencord.dev/installing/
2. Copie a pasta \`oraculoXFakeVoice\` deste repositorio para \`Vencord/src/userplugins/oraculoXFakeVoice\`.
3. No diretorio do Vencord, rode \`pnpm install --frozen-lockfile\`, depois \`pnpm build\` e \`pnpm inject\`.
4. Reinicie totalmente o Discord e ative **Fake Voice Options** nas configuracoes de plugins.
5. Alterar \`fakeMute\` ou \`fakeDeafen\` mostra o indicador de reinicio nativo do Vencord (\`restartNeeded: true\`).

Documentacao atual: https://docs.vencord.dev/installing/custom-plugins/ e https://docs.vencord.dev/plugins/

## Coleira

A Coleira fica no **Oraculo X - DiscordUtils** (pasta \`coleira-bot\`), nao neste plugin Vencord. Ela utiliza bot oficial Discord com \`/seguir\` e \`/parar\`, sem self-bot, sem token de usuario e sem reentrada forcada em canal.
