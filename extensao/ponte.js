/* Webmail (mundo isolado): recebe o e-mail visto pelo captura-main.js e mostra o botão flutuante "Abrir no conferidor".
   - Mostra, antes do clique, se o e-mail já está em atendimento ou já foi atendido (consulta o Conferidor).
   - Fica apagado quando o e-mail é fechado (o texto dele sumiu da tela): aí pede um segundo clique para confirmar.
   - Quando o Conferidor manda a resposta, vira "Colar resposta": cola no corpo da resposta aberta no webmail.
   Nada é aberto, respondido ou enviado sem o clique do operador; o envio do e-mail é sempre no webmail. */
(function () {
  let msg = null, host = null, raiz = null, timer = null, fechado = false, confirmar = 0, resposta = null, status = null, trechos = [], falhas = 0;
  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  function montar() {
    if (host) return;
    host = document.createElement('div'); host.id = 'conferidor-flutuante';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646';
    raiz = host.attachShadow({ mode: 'closed' });
    raiz.innerHTML = `<style>
      .cx{display:flex;align-items:stretch;font:600 13px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;border-radius:12px;box-shadow:0 6px 20px rgba(15,23,42,.35);overflow:hidden}
      button{all:unset;cursor:pointer;box-sizing:border-box}
      .abrir{display:flex;align-items:center;gap:9px;background:#2c4a70;color:#fff;padding:9px 14px;max-width:320px}
      .abrir:hover{background:#233c5c}.abrir:focus-visible{outline:2px solid #3aae9c;outline-offset:-2px}
      .tx{display:flex;flex-direction:column;gap:2px;min-width:0}.tx b{font-weight:700}
      .tx small{font-weight:500;opacity:.85;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .st{display:none;font-size:11.5px;font-weight:650;padding:2px 6px;border-radius:5px;margin-top:2px;white-space:normal}
      .warn .st{display:block;background:#fef3c7;color:#78350f}.okst .st{display:block;background:#dcfce7;color:#14532d}.info .st{display:block;background:#e0e7ff;color:#1e3a8a}
      .fechar{background:#233c5c;color:#cbd5e1;padding:0 10px;display:flex;align-items:center;font-size:16px}
      .fechar:hover{background:#1e3350;color:#fff}
      .ok .abrir{background:#16a34a}.erro .abrir{background:#b91c1c}.esperando .abrir{background:#375b88}
      .dim .abrir{background:#64748b}.dim .fechar{background:#475569}
      .resp .abrir{background:#17786b}.resp .fechar{background:#155f56}
    </style><div class="cx" id="cx"><button class="abrir" id="abrir" title="Abrir este e-mail no Conferidor de Guias">${ICONE}<span class="tx"><b id="t1">Abrir no conferidor</b><small id="t2"></small><span class="st" id="t3"></span></span></button><button class="fechar" id="fechar" title="Ocultar" aria-label="Ocultar">×</button></div>`;
    const ab = raiz.getElementById('abrir');
    ab.addEventListener('mousedown', e => e.preventDefault());   // mantém o cursor no corpo da resposta (para colar)
    ab.addEventListener('click', clicar);
    raiz.getElementById('fechar').addEventListener('click', () => { host.style.display = 'none'; });
    document.documentElement.appendChild(host);
  }
  function pintar(cls, t1, t2, t3) {
    if (!raiz) return;
    raiz.getElementById('cx').className = 'cx ' + (cls || '');
    raiz.getElementById('t1').textContent = t1; raiz.getElementById('t2').textContent = t2 || ''; raiz.getElementById('t3').textContent = t3 || '';
  }
  /* estado de repouso: resposta para colar > e-mail fechado > e-mail aberto (com o status do atendimento) */
  function base() {
    clearTimeout(timer);
    if (resposta) return pintar('resp', 'Colar resposta' + (resposta.quem ? ': ' + resposta.quem : ''), 'Clique em Responder no webmail, depois no corpo do texto, e aqui.');
    if (!msg) return;
    if (fechado) return pintar('dim', 'E-mail fechado', 'Abra o e-mail para mandá-lo ao conferidor.');
    pintar(status ? ({ warn: 'warn', ok: 'okst', info: 'info' })[status.nivel] || '' : '', 'Abrir no conferidor', msg.assunto || '', status ? status.texto : '');
  }
  const temporario = (cls, t1, t2) => { pintar(cls, t1, t2); clearTimeout(timer); timer = setTimeout(base, 5000); };
  function enviar(tipo, dados, cb) {
    try { chrome.runtime.sendMessage({ tipo, ...dados }, r => { if (chrome.runtime.lastError) { cb(null, true); return; } cb(r, false); }); }
    catch (e) { cb(null, true); }
  }
  function clicar() {
    if (resposta) { colar(); return; }
    if (!msg) return;
    if (fechado && Date.now() - confirmar > 5000) { confirmar = Date.now(); pintar('dim', 'Enviar o último e-mail aberto?', 'Clique de novo para confirmar: ' + (msg.assunto || '')); clearTimeout(timer); timer = setTimeout(base, 5000); return; }
    confirmar = 0;
    pintar('esperando', 'Abrindo…', msg.assunto || '');
    enviar('abrir', { msg }, (r, falhou) => {
      if (falhou) return temporario('erro', 'A extensão foi atualizada', 'Aperte F5 nesta página e tente de novo.');
      if (r && r.ok) { const n = r.nomes || []; return temporario('ok', n.length ? 'Aberto: ' + n[0] + (n.length > 1 ? ` e mais ${n.length - 1}` : '') : 'Aberto no conferidor', 'Veja a aba do Conferidor de Guias.'); }
      if (r && r.motivo === 'sem-url') return temporario('erro', 'Abra o Conferidor antes', 'Abra o site do Conferidor numa aba uma vez e tente de novo.');
      temporario('erro', 'Não consegui abrir', (r && r.motivo) || '');
    });
  }
  /* cola a resposta onde está o cursor (corpo da resposta no webmail, que pode estar dentro de um iframe) */
  function colar() {
    let doc = document, el = document.activeElement;
    for (let i = 0; i < 3 && el && el.tagName === 'IFRAME'; i++) { try { doc = el.contentDocument; el = doc.activeElement; } catch (e) { el = null; } }
    const editavel = el && (el.isContentEditable || doc.designMode === 'on');
    if (!editavel) { temporario('erro', 'Clique no corpo da resposta', 'Abra Responder no webmail, clique no texto e depois aqui.'); setTimeout(() => { if (resposta) base(); }, 5100); return; }
    let ok = false; try { ok = doc.execCommand('insertHTML', false, resposta.html); } catch (e) { ok = false; }
    if (!ok) { try { ok = doc.execCommand('insertText', false, resposta.texto || ''); } catch (e) { ok = false; } }
    if (!ok) { temporario('erro', 'Não consegui colar', 'Use o botão Copiar no Conferidor e Ctrl+V aqui.'); return; }
    resposta = null; enviar('respostaUsada', {}, () => { });
    temporario('ok', 'Resposta colada', 'Revise o texto e clique em Enviar no webmail.');
  }
  /* o e-mail continua aberto? (algum trecho do texto dele aparece na tela) */
  function prepararTrechos() {
    trechos = []; falhas = 0;
    let t = msg.plain || '';
    if (!t && msg.html) { try { t = new DOMParser().parseFromString(msg.html, 'text/html').body.textContent || ''; } catch (e) { t = ''; } }
    t = norm(t); if (t.length < 60) return;
    [0.25, 0.5, 0.75].forEach(f => { const i = Math.floor(t.length * f); const s = t.slice(i, i + 24).trim(); if (s.length >= 16) trechos.push(s); });
  }
  function textoNaTela() {
    let s = document.body ? document.body.innerText : '';
    document.querySelectorAll('iframe').forEach(f => { try { const b = f.contentDocument && f.contentDocument.body; if (b) s += ' ' + b.innerText; } catch (e) { } });
    return norm(s);
  }
  setInterval(() => {
    if (!msg || !trechos.length || resposta || document.hidden || !host || host.style.display === 'none') return;
    const aberto = trechos.some(t => textoNaTela().includes(t));
    if (aberto) { falhas = 0; if (fechado) { fechado = false; base(); } }
    else if (++falhas >= 2 && !fechado) { fechado = true; base(); }
  }, 1500);
  function perguntarStatus() {
    const m = msg; status = null;
    enviar('status', { msg: m }, r => { if (m !== msg) return; status = r && r.info ? r.info : null; base(); });
  }
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data; if (!d || d.__conferidor !== 'msg' || !d.msg) return;
    msg = d.msg; fechado = false; confirmar = 0; prepararTrechos();
    const mostrar = () => { montar(); host.style.display = ''; base(); perguntarStatus(); };
    if (document.documentElement) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar, { once: true });
  });
  try {
    chrome.runtime.onMessage.addListener(m => {
      if (m && m.tipo === 'resposta' && m.resposta) { resposta = m.resposta; montar(); host.style.display = ''; base(); }
    });
    enviar('pegarResposta', {}, r => { if (r && r.resposta) { resposta = r.resposta; montar(); host.style.display = ''; base(); } });
  } catch (e) { }
})();
