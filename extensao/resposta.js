/* Webmail, em todas as janelas e quadros (inclusive a janela de resposta que o webmail abre à parte).
   Quando o Conferidor manda a resposta e o "Responder a todos" é aberto (ponte.js), este script procura o editor NOVO
   (o que surgiu depois do pedido; os que já existiam são ignorados), cola a resposta no topo, confere se o texto
   apareceu e avisa. Se mais de uma janela achar um editor ao mesmo tempo, só uma cola (reserva).
   Nada é enviado: o envio do e-mail é sempre do operador, no webmail. */
(function () {
  if (window.__conferidorResp) return; window.__conferidorResp = true;
  if (location.protocol === 'about:' && window.top !== window) return;   // quadros vazios: quem cuida é a página que os contém
  const CH = 'cfResp', JANELA = 120000, HOST = 'conferidor-flutuante';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const visivel = el => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const nosso = el => !!(el && el.closest && el.closest('#' + HOST));
  async function ler() {
    try { return (await chrome.storage.session.get(CH))[CH] || null; }
    catch (e) { try { await chrome.runtime.sendMessage({ tipo: 'acesso' }); return (await chrome.storage.session.get(CH))[CH] || null; } catch (e2) { return null; } }
  }
  const gravar = p => chrome.storage.session.set({ [CH]: p }).catch(() => { });
  const inicioDe = p => p.acionadoEm || p.criado;
  let antes = new Set(), fotoId = null, aplicando = false, tm = null;

  /* editores de e-mail visíveis: contenteditable, iframe em modo de edição (mesma origem) e, sem eles, textarea grande */
  function listarEditores(doc) {
    const out = [], A = 5000;
    doc.querySelectorAll('[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]').forEach(el => {
      if (nosso(el)) return; if (el.parentElement && el.parentElement.closest('[contenteditable="true"],[contenteditable=""]')) return;
      const r = el.getBoundingClientRect(); if (visivel(el) && r.width * r.height > A) out.push({ el, doc });
    });
    doc.querySelectorAll('iframe').forEach(f => {
      try {
        const d = f.contentDocument; if (!d || !d.body) return; const r = f.getBoundingClientRect(); if (!visivel(f) || r.width * r.height < A) return;
        if (d.designMode === 'on' || d.body.isContentEditable) out.push({ el: d.body, doc: d, frame: f });
        else d.querySelectorAll('[contenteditable="true"],[contenteditable=""]').forEach(el => { const rr = el.getBoundingClientRect(); if (rr.width * rr.height > A) out.push({ el, doc: d, frame: f }); });
      } catch (e) { }
    });
    if (!out.length) doc.querySelectorAll('textarea').forEach(el => { if (nosso(el)) return; const r = el.getBoundingClientRect(); if (visivel(el) && r.width * r.height > A * 4 && !/to|cc|bcc|para|assunto|subject/i.test((el.name || '') + (el.id || ''))) out.push({ el, doc, texto: true }); });
    return out;
  }
  /* foto dos editores que já existiam quando o pedido chegou (rascunhos, notas): só um editor que surgir depois recebe o texto */
  function todosEditaveis(doc, out = new Set()) {
    try {
      doc.querySelectorAll('[contenteditable],textarea').forEach(el => out.add(el));
      doc.querySelectorAll('iframe').forEach(f => { out.add(f); try { const d = f.contentDocument; if (d && d.body) { out.add(d.body); todosEditaveis(d, out); } } catch (e) { } });
    } catch (e) { }
    return out;
  }
  function fotografar(id) { antes = todosEditaveis(document); fotoId = id; }
  const ehAntigo = e => antes.has(e.el) || (e.frame && antes.has(e.frame) && antes.has(e.el));
  function editoresNovos() {
    const l = listarEditores(document).filter(e => !ehAntigo(e));
    const foco = l.find(e => { try { return e.doc.hasFocus() && (e.el.contains(e.doc.activeElement) || e.doc.activeElement === e.el); } catch (_) { return false; } });
    return foco ? [foco, ...l.filter(e => e !== foco)] : l.reverse();   // o que está em foco; senão, o mais recente
  }
  const amostra = p => String(p.texto || '').replace(/\s+/g, ' ').trim().slice(0, 45).toLowerCase();
  const temTexto = (ed, p) => { try { const a = amostra(p); if (!a) return true; return String(ed.texto ? ed.el.value : (ed.el.innerText || ed.el.textContent)).replace(/\s+/g, ' ').toLowerCase().includes(a); } catch (e) { return false; } };
  function inserir(ed, p) {
    const { el, doc } = ed;
    if (ed.texto) { el.focus(); const v = (p.texto || '') + '\n\n' + el.value; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v); ['input', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true }))); return; }
    try { (ed.frame ? ed.frame.contentWindow : window).focus(); } catch (e) { }
    el.focus();
    const sel = doc.getSelection(), rg = doc.createRange(); rg.setStart(el, 0); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg);   // no topo, acima da mensagem original
    let ok = false; try { ok = doc.execCommand('insertHTML', false, p.html + '<div><br></div>'); } catch (e) { }
    if (!ok) { el.insertAdjacentHTML('afterbegin', p.html + '<div><br></div>'); el.dispatchEvent(new InputEvent('input', { bubbles: true })); }
  }
  async function esperarEstavel(ed) { let ant = '', iguais = 0; for (let i = 0; i < 14 && iguais < 2; i++) { await sleep(300); const h = ed.texto ? ed.el.value : ed.el.innerHTML; if (h === ant) iguais++; else { iguais = 0; ant = h; } } }
  /* distância na árvore até o ancestral comum (menor = mesmo e-mail) */
  function distancia(a, b) { if (!a || !b) return 999; if (a.ownerDocument !== b.ownerDocument) return 500; const anc = new Map(); let x = a, n = 0; while (x) { anc.set(x, n++); x = x.parentElement; } let y = b, m = 0; while (y) { if (anc.has(y)) return anc.get(y) + m; y = y.parentElement; m++; } return 400; }

  async function tentar() {
    if (aplicando) return; const p = await ler();
    if (!p || p.estado !== 'aguardandoCompose' || Date.now() - inicioDe(p) > JANELA) return;
    if (fotoId !== p.id) fotografar(p.id);
    const ed = editoresNovos()[0]; if (!ed) return;
    aplicando = true;
    try {
      const meu = Math.random().toString(36).slice(2); p.dono = meu; await gravar(p); await sleep(200);   // reserva: só uma janela cola
      const q = await ler(); if (!q || q.id !== p.id || q.dono !== meu || q.estado !== 'aguardandoCompose') return;
      await aplicarEm(ed, q);
    } finally { aplicando = false; }
  }
  async function aplicarEm(ed, p) {
    p.estado = 'compondo'; await gravar(p);
    let ok = false;
    try {
      await esperarEstavel(ed);   // o webmail termina de montar o corpo (assinatura, mensagem original)
      const ancora = ed.frame || ed.el;
      const mesmo = () => { if (ed.el.isConnected && visivel(ancora)) return ed; const n = editoresNovos(); return n.sort((a, b) => distancia(a.frame || a.el, ancora) - distancia(b.frame || b.el, ancora))[0] || ed; };
      for (let t = 0; t < 3 && !ok; t++) { const alvo = t ? mesmo() : ed; inserir(alvo, p); await sleep(t ? 1500 : 900); ok = temTexto(alvo, p) || temTexto(mesmo(), p); }
      if (ok) {
        await marcar(p.id, 'colado');   // o botão avisa já; a conferência abaixo continua
        await sleep(3000); const m = mesmo(); if (!temTexto(m, p)) { inserir(m, p); await sleep(800); ok = temTexto(mesmo(), p); }   // alguns editores redesenham o corpo logo depois de abrir
      }
    } catch (e) { ok = false; }
    await marcar(p.id, ok ? 'colado' : 'falhou');
    if (ok) setTimeout(async () => { const r = await ler(); if (r && r.id === p.id && r.estado === 'colado') chrome.storage.session.remove(CH).catch(() => { }); }, 6000);   // colada: a resposta não fica guardada
  }
  async function marcar(id, estado) { const q = await ler(); if (!q || q.id !== id || q.estado === estado) return; q.estado = estado; q.fimEm = Date.now(); await gravar(q); }
  function vigiar() { if (tm) return; let n = 0; tm = setInterval(async () => { n++; await tentar(); const p = await ler(); if (!p || p.estado !== 'aguardandoCompose' || n > 200) { clearInterval(tm); tm = null; } }, 600); }

  async function iniciar() {
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'session' || !ch[CH]) return; const p = ch[CH].newValue;
        if (p && p.estado === 'aguardandoCompose') { if (fotoId !== p.id) fotografar(p.id); vigiar(); }
      });
    } catch (e) { return; }
    const p = await ler();
    // janela aberta depois do pedido (resposta em janela própria): tudo nela é novo; janela antiga: foto agora
    if (p && p.estado === 'aguardandoCompose' && Date.now() - inicioDe(p) < JANELA) { if (performance.timeOrigin < inicioDe(p)) fotografar(p.id); else { antes = new Set(); fotoId = p.id; } vigiar(); }
  }
  iniciar();
})();
