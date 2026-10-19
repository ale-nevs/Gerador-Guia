/* Mundo isolado da extensão: recebe o que o captura-main.js viu e entrega ao painel (via fundo.js). */
window.addEventListener('message', ev => {
  if (ev.source !== window || ev.origin !== window.location.origin) return;
  const d = ev.data; if (!d || d.__conferidor !== 'msg' || !d.msg) return;
  try { chrome.runtime.sendMessage({ tipo: 'webmail', msg: d.msg }); } catch (e) { /* extensão recarregada: a página precisa ser atualizada */ }
});
