/* Service worker: abre o painel lateral ao clicar no ícone e guarda o último e-mail visto (só na sessão do navegador,
   nunca em disco). O painel lê e escuta essa chave. */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
chrome.runtime.onMessage.addListener(m => {
  if (m && m.tipo === 'webmail' && m.msg) chrome.storage.session.set({ ultimaWebmail: { msg: m.msg, em: Date.now() } });
});
