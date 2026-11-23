/* Roda dentro da página do webmail (mundo "MAIN"). Observa a resposta que o próprio SmarterMail recebe ao abrir
   um e-mail (POST /api/v1/mail/message) e repassa só os campos necessários para a ponte. Não envia nada para fora
   do navegador. A pedido da ponte (resposta vinda do Conferidor), aperta o atalho do SmarterMail "A" (Responder a
   todos): o atalho só é reconhecido quando a tecla é disparada aqui, no mundo da página. */
(function () {
  if (window.__conferidorCaptura) return; window.__conferidorCaptura = true;
  const ALVO = /\/api\/v1\/mail\/message$/i;
  const slim = d => {
    const datas = []; Object.keys(d).forEach(k => { if (/date|sent|received|time/i.test(k) && (typeof d[k] === 'string' || typeof d[k] === 'number') && d[k]) datas.push(String(d[k])); });
    const nomeEmail = a => (a && (a.email || a.name)) ? { nome: a.name || '', email: a.email || '' } : null;
    return {
      uid: d.uid, folder: d.folder || '', messageId: d.messageID || '', assunto: d.subject || '',
      de: nomeEmail(d.fromAddress), para: (d.toAddresses || []).map(nomeEmail).filter(Boolean),
      plain: d.messagePlainText || '', html: d.messageHTML || '', datas: datas.sort((a, b) => 0), data: d.userDate || '',
      anexos: (d.attachments || []).map(a => a && (a.filename || a.name)).filter(Boolean)
    };
  };
  const enviar = json => { try { const d = json && json.messageData; if (d && d.uid) window.postMessage({ __conferidor: 'msg', msg: slim(d) }, window.location.origin); } catch (e) { } };
  const abrir = XMLHttpRequest.prototype.open, enviarXhr = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { try { this.__cfUrl = String(u).split('?')[0]; this.__cfMetodo = String(m).toUpperCase(); } catch (e) { } return abrir.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__cfMetodo === 'POST' && ALVO.test(this.__cfUrl || '')) this.addEventListener('load', () => { try { if (this.status === 200) enviar(JSON.parse(this.responseText)); } catch (e) { } });
    return enviarXhr.apply(this, arguments);
  };
  /* tecla de atalho com keyCode/which preenchidos (o SmarterMail lê esses campos) */
  function tecla(k) {
    const kc = k.toUpperCase().charCodeAt(0), ch = k.charCodeAt(0), ae = document.activeElement;
    if (ae && (/INPUT|TEXTAREA|SELECT/.test(ae.tagName) || ae.isContentEditable)) ae.blur();   // atalho não vale dentro de um campo
    const alvo = (document.activeElement && document.activeElement !== document.body ? document.activeElement : null) || document.body || document;
    for (const tipo of ['keydown', 'keypress', 'keyup']) {
      const ev = new KeyboardEvent(tipo, { key: k, code: 'Key' + k.toUpperCase(), bubbles: true, cancelable: true, composed: true, view: window });
      const v = tipo === 'keypress' ? ch : kc;
      Object.defineProperty(ev, 'keyCode', { get: () => v }); Object.defineProperty(ev, 'which', { get: () => v }); Object.defineProperty(ev, 'charCode', { get: () => (tipo === 'keypress' ? ch : 0) });
      alvo.dispatchEvent(ev);
    }
  }
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data; if (d && d.__conferidor === 'tecla' && typeof d.tecla === 'string' && /^[a-z]$/.test(d.tecla)) tecla(d.tecla);
  });
  const f = window.fetch;
  if (f) window.fetch = function (u, o) {
    const p = f.apply(this, arguments);
    try { const url = String(typeof u === 'string' ? u : (u && u.url) || '').split('?')[0]; if (ALVO.test(url) && ((o && o.method) || 'GET').toUpperCase() === 'POST') p.then(r => r.clone().json().then(enviar).catch(() => { })).catch(() => { }); } catch (e) { }
    return p;
  };
})();
