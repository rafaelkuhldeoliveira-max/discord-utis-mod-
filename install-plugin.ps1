# install-plugin.ps1 — instalador gráfico do discord-utis-mod-
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:RepoRaw = 'https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main'
$script:Install = Join-Path $env:APPDATA 'discord-utis-mod'
$script:ModKeys = @('fakeVoice', 'msgLogger', 'msgEditor')
$script:ModInfo = [ordered]@{
    fakeVoice = @{ Title = 'Fake Voice (simulação local)'; Hint = 'Controles visuais fictícios; não altera conexão ou estado de voz.' }
    msgLogger = @{ Title = 'Log de mensagens'; Hint = 'A captura automática de mensagens não está implementada.' }
    msgEditor = @{ Title = 'Editor local'; Hint = 'Pré-visualizações locais; não edita nem envia mensagens ao servidor.' }
}
$script:Mods = @{ fakeVoice = $false; msgLogger = $false; msgEditor = $false }

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Instalador discord-utis-mod-'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(560, 440)
$form.MinimumSize = New-Object System.Drawing.Size(560, 440)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 9)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Escolha os módulos para configurar'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(22, 18)
$title.Size = New-Object System.Drawing.Size(500, 32)
$form.Controls.Add($title)

$notice = New-Object System.Windows.Forms.Label
$notice.Text = 'Este instalador baixa os arquivos do projeto e grava sua seleção. Não injeta código no Discord.'
$notice.Location = New-Object System.Drawing.Point(24, 55)
$notice.Size = New-Object System.Drawing.Size(500, 42)
$notice.ForeColor = [System.Drawing.Color]::DarkSlateGray
$form.Controls.Add($notice)

$script:Checks = @{}
$y = 108
foreach ($key in $script:ModKeys) {
    $card = New-Object System.Windows.Forms.GroupBox
    $card.Text = $script:ModInfo[$key].Title
    $card.Location = New-Object System.Drawing.Point(22, $y)
    $card.Size = New-Object System.Drawing.Size(500, 70)

    $check = New-Object System.Windows.Forms.CheckBox
    $check.Text = 'Instalar / habilitar'
    $check.AutoSize = $true
    $check.Location = New-Object System.Drawing.Point(14, 24)
    $card.Controls.Add($check)

    $hint = New-Object System.Windows.Forms.Label
    $hint.Text = $script:ModInfo[$key].Hint
    $hint.Location = New-Object System.Drawing.Point(170, 20)
    $hint.Size = New-Object System.Drawing.Size(310, 42)
    $card.Controls.Add($hint)

    $form.Controls.Add($card)
    $script:Checks[$key] = $check
    $y += 78
}

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Os arquivos serão instalados em: ' + $script:Install
$status.Location = New-Object System.Drawing.Point(24, 345)
$status.Size = New-Object System.Drawing.Size(500, 28)
$form.Controls.Add($status)

$installButton = New-Object System.Windows.Forms.Button
$installButton.Text = 'Instalar selecionados'
$installButton.Location = New-Object System.Drawing.Point(350, 375)
$installButton.Size = New-Object System.Drawing.Size(172, 32)
$form.Controls.Add($installButton)
$form.AcceptButton = $installButton

$installButton.Add_Click({
    try {
        foreach ($key in $script:ModKeys) { $script:Mods[$key] = [bool]$script:Checks[$key].Checked }
        if (-not ($script:Mods.Values | Where-Object { $_ })) {
            [System.Windows.Forms.MessageBox]::Show('Selecione pelo menos um módulo.', 'Seleção necessária', 'OK', 'Warning') | Out-Null
            return
        }

        New-Item -ItemType Directory -Force -Path $script:Install | Out-Null
        foreach ($file in @('inject.js', 'renderer.js', 'style.css')) {
            $uri = "$script:RepoRaw/plugin/$file"
            Invoke-WebRequest -Uri $uri -OutFile (Join-Path $script:Install $file) -UseBasicParsing
        }

        $settingsPath = Join-Path $script:Install 'settings.json'
        $settings = @{}
        if (Test-Path $settingsPath) {
            try { $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json -AsHashtable } catch { $settings = @{} }
        }
        if (-not $settings) { $settings = @{} }
        $settings.mods = $script:Mods
        if (-not $settings.modsOn) {
            $settings.modsOn = @{
                fakeVoice = $false; fakeMute = $false; fakeDeafen = $false; fakeChan = $false
                msgLogger = $false; msgEditor = $false; loggerScope = 'all'
            }
        }
        $settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $settingsPath -Encoding UTF8

        [System.Windows.Forms.MessageBox]::Show(
            "Arquivos e seleção instalados em:`n$script:Install`n`nEste pacote não integra nem injeta o plugin no cliente Discord.",
            'Instalação concluída', 'OK', 'Information'
        ) | Out-Null
        $form.Close()
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Falha na instalação', 'OK', 'Error') | Out-Null
    }
})

[void]$form.ShowDialog()
