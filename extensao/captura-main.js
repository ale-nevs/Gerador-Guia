/* Roda dentro da página do webmail (mundo "MAIN"). Observa a resposta que o próprio SmarterMail recebe ao abrir
   um e-mail (POST /api/v1/mail/message) e repassa só os campos necessários para a ponte. Não envia nada para fora
   do navegador e não altera a página. */
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
  const f = window.fetch;
  if (f) window.fetch = function (u, o) {
    const p = f.apply(this, arguments);
    try { const url = String(typeof u === 'string' ? u : (u && u.url) || '').split('?')[0]; if (ALVO.test(url) && ((o && o.method) || 'GET').toUpperCase() === 'POST') p.then(r => r.clone().json().then(enviar).catch(() => { })).catch(() => { }); } catch (e) { }
    return p;
  };
})();
