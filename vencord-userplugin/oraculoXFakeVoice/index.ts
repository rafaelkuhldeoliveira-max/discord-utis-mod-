import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

// Oraculo X: adaptacao do exemplo Fake Voice Options fornecido pelo usuario.
// Autor original do exemplo: SaucyDuck. Requer Vencord compilado a partir do fonte.
// Estas patches so evitam mute/deafen local; nao garantem o estado remoto.
const settings = definePluginSettings({
    fakeMute: {
        description: "Fake Mute: manter microfone local ativo (requer reinicio)",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    },
    fakeDeafen: {
        description: "Fake Voice: manter audio local ativo (requer reinicio)",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "Fake Voice Options",
    description: "Opcoes locais Fake Mute e Fake Voice para Oraculo X",
    authors: [{ name: "SaucyDuck", id: 1004904120056029256n }],
    settings,
    patches: [
        {
            find: "e.setSelfMute(n)",
            replacement: [
                {
                    match: /e\.setSelfMute\(n\),/g,
                    replace: 'e.setSelfMute(Vencord.Settings.plugins["Fake Voice Options"].fakeMute?false:n),'
                },
                {
                    match: /e\.setSelfDeaf\(t\.deaf\)/g,
                    replace: 'e.setSelfDeaf(Vencord.Settings.plugins["Fake Voice Options"].fakeDeafen?false:t.deaf)'
                }
            ]
        }
    ]
});
