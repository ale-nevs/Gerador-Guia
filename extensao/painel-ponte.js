/* Ligação do painel lateral com o webmail: converte o que chegou e oferece o e-mail ao conferidor. */
(function () {
  const conv = m => ({
    uid: m.uid, folder: m.folder, messageId: m.messageId, assunto: m.assunto,
    fromNome: m.de && m.de.nome, fromEmail: m.de && m.de.email, plain: m.plain, html: m.html, data: m.data, datas: m.datas, anexos: m.anexos
  });
  const aplicar = v => { if (v && v.msg && typeof ofertarWebmail === 'function') ofertarWebmail(conv(v.msg)); };
  chrome.storage.session.get('ultimaWebmail').then(r => aplicar(r.ultimaWebmail)).catch(() => { });
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'session' && c.ultimaWebmail) aplicar(c.ultimaWebmail.newValue); });
})();
