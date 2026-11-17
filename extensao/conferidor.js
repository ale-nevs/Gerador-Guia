/* Página do Conferidor de Guias (hospedada na Vercel). Só age se a página se identificar com
   <meta name="conferidor-guias">; em qualquer outro site *.vercel.app não faz nada. */
(function () {
  if (!document.querySelector('meta[name="conferidor-guias"]')) return;
  const versao = chrome.runtime.getManifest().version;
  document.documentElement.dataset.conferidorExt = versao;
  window.postMessage({ __conferidorExt: 'instalada', versao }, window.location.origin);
  try { chrome.runtime.sendMessage({ tipo: 'conferidor-pronto' }); } catch (e) { }
  /* pergunta à página e espera a resposta (com prazo) */
  const pendentes = new Map();
  const perguntar = (dados, ms) => new Promise(res => {
    const pid = Math.random().toString(36).slice(2); pendentes.set(pid, res);
    window.postMessage({ ...dados, pid }, window.location.origin);
    setTimeout(() => { if (pendentes.has(pid)) { pendentes.delete(pid); res(null); } }, ms);
  });
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data; if (!d || !d.__conferidorPagina) return;
    if (d.__conferidorPagina === 'resposta' && pendentes.has(d.pid)) { pendentes.get(d.pid)(d); pendentes.delete(d.pid); }
    if (d.__conferidorPagina === 'responderWebmail' && d.resposta) {
      try { chrome.runtime.sendMessage({ tipo: 'guardarResposta', resposta: d.resposta }, r => window.postMessage({ __conferidorExt: 'respostaEntregue', ok: !!(r && r.ok), motivo: (r && r.motivo) || (chrome.runtime.lastError ? 'Recarregue esta página (F5).' : '') }, window.location.origin)); }
      catch (e) { window.postMessage({ __conferidorExt: 'respostaEntregue', ok: false, motivo: 'A extensão foi atualizada: recarregue esta página (F5).' }, window.location.origin); }
    }
  });
  chrome.runtime.onMessage.addListener((m, s, responder) => {
    if (m && m.tipo === 'entregar' && m.msg) { perguntar({ __conferidorExt: 'webmail', msg: m.msg }, 14000).then(r => responder(r || { ok: true })); return true; }
    if (m && m.tipo === 'status' && m.msg) { perguntar({ __conferidorExt: 'status', msg: m.msg }, 6500).then(r => responder(r || {})); return true; }
  });
})();
