# install-plugin.ps1
# Instala os cards de mod do plugin.

$script:ModKeys = @('fakeVoice', 'msgLogger', 'msgEditor')

$script:ModInfo = [ordered]@{
    fakeVoice = @{
        Title = 'Fake Voice'
        Hint  = 'Mute, Surdo e Canal falso — um botão para cada'
    }
    msgLogger = @{
        Title = 'Log de apagadas'
        Hint  = 'Mensagem apagada continua visivel, em vermelho'
    }
    msgEditor = @{
        Title = 'Editor de mensagens'
        Hint  = 'Editar mensagem antiga + alterar a fala dos outros (local)'
    }
}

$script:Mods = @{ fakeVoice = $false; msgLogger = $false; msgEditor = $false }

[void](New-ModCard 'fakeVoice' 24 302)
[void](New-ModCard 'msgLogger' 24 346)
[void](New-ModCard 'msgEditor' 24 390 372)
