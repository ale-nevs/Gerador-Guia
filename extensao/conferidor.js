/* Página do Conferidor de Guias (hospedada na Vercel). Só age se a página se identificar com
   <meta name="conferidor-guias">; em qualquer outro site *.vercel.app não faz nada. */
(function () {
  if (!document.querySelector('meta[name="conferidor-guias"]')) return;
  const versao = chrome.runtime.getManifest().version;
  document.documentElement.dataset.conferidorExt = versao;
  window.postMessage({ __conferidorExt: 'instalada', versao }, window.location.origin);
  try { chrome.runtime.sendMessage({ tipo: 'conferidor-pronto' }); } catch (e) { }
  chrome.runtime.onMessage.addListener(m => {
    if (m && m.tipo === 'entregar' && m.msg) window.postMessage({ __conferidorExt: 'webmail', msg: m.msg }, window.location.origin);
  });
})();
