// plugin/inject.js
// Injeta o painel do plugin no cliente Discord.

(function () {
  if (window.__du_plugin_loaded) return;
  window.__du_plugin_loaded = true;

  const include = (src, type = 'script') => {
    const tag = document.createElement(type === 'css' ? 'link' : 'script');
    if (type === 'css') {
      tag.rel = 'stylesheet';
      tag.href = src;
    } else {
      tag.src = src;
    }
    document.head.appendChild(tag);
  };

  include('https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/plugin/style.css', 'css');
  include('https://raw.githubusercontent.com/rafaelkuhldeoliveira-max/discord-utis-mod-/main/plugin/renderer.js');
})();
