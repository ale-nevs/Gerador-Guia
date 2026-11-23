/* Webmail (mundo isolado, janela principal): recebe o e-mail visto pelo captura-main.js e mostra o botão flutuante "Abrir no conferidor".
   - Mostra, antes do clique, se o e-mail já está em atendimento ou já foi atendido (consulta o Conferidor).
   - Fica apagado quando o e-mail é fechado (o texto dele sumiu da tela): aí pede um segundo clique para confirmar.
   - Quando o Conferidor manda a resposta ("Responder no webmail"): se o e-mail aberto é o do atendimento, abre o
     "Responder a todos" (atalho A do SmarterMail; se não abrir, clica no botão) e o resposta.js cola a resposta no
     topo do texto. Se o e-mail aberto for outro, o botão pede a confirmação antes. Se nada abrir, o botão cola onde
     está o cursor.
   O envio do e-mail é sempre do operador, no webmail: a extensão não envia nada. */
(function () {
  const CH = 'cfResp', VALE = 15 * 60000, AUTO = 3 * 60000;
  const ESTADOS = ['novo', 'aguardandoCompose', 'compondo', 'colado', 'falhou'];
  const TEXTOS_BOTAO = ['responder a todos', 'responder todos', 'reply all', 'reply to all'];
  let msg = null, host = null, raiz = null, timer = null, fechado = false, confirmar = 0, status = null, trechos = [], falhas = 0;
  let pend = null, meuTab = -1, acionado = null, naoAbriu = false;
  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const visivel = el => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };

  /* ---------- resposta pendente (memória da sessão do navegador, compartilhada com o resposta.js) ---------- */
  async function lerPend() {
    try { return (await chrome.storage.session.get(CH))[CH] || null; }
    catch (e) { try { await chrome.runtime.sendMessage({ tipo: 'acesso' }); return (await chrome.storage.session.get(CH))[CH] || null; } catch (e2) { return null; } }
  }
  const gravarPend = p => chrome.storage.session.set({ [CH]: p }).catch(() => { });
  const limparPend = () => chrome.storage.session.remove(CH).catch(() => { });
  const valePend = p => !!p && ESTADOS.includes(p.estado) && Date.now() - p.criado < VALE;
  const ehMeu = p => !!p && (p.aba === meuTab || performance.timeOrigin > p.criado);   // esta aba, ou a janela de resposta aberta depois
  const pendAqui = () => valePend(pend) && ehMeu(pend) && pend.estado !== 'colado';
  /* o e-mail aberto é o do atendimento? (mesmo Message-ID; ou mesmo assunto, sem RE:/ENC:, e mesmo remetente) */
  const semPrefixo = s => norm(s).replace(/^((re|res|enc|fw|fwd|rv|tr)\s*:\s*)+/i, '');
  const limpaId = s => norm(s).replace(/^<|>$/g, '');
  function confere(m, a) {
    if (!m || !a) return false;
    const id = limpaId(m.messageId); if (id && (a.messageIds || []).some(x => limpaId(x) === id)) return true;
    const s1 = semPrefixo(m.assunto), s2 = semPrefixo(a.assunto);
    if (!s1 || s1 !== s2) return false;
    return !a.de || !m.de || !m.de.email || norm(m.de.email) === norm(a.de);
  }

  function montar() {
    if (host) return;
    host = document.createElement('div'); host.id = 'conferidor-flutuante';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646';
    raiz = host.attachShadow({ mode: 'closed' });
    raiz.innerHTML = `<style>
      .cx{display:flex;align-items:stretch;font:600 13px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;border-radius:12px;box-shadow:0 6px 20px rgba(15,23,42,.35);overflow:hidden}
      button{all:unset;cursor:pointer;box-sizing:border-box}
      .abrir{display:flex;align-items:center;gap:9px;background:#2c4a70;color:#fff;padding:9px 14px;max-width:340px}
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
    raiz.getElementById('fechar').addEventListener('click', () => {
      if (pendAqui()) { limparPend(); pend = null; base(); return; }   // descarta a resposta pendente (o e-mail aberto fica como está)
      host.style.display = 'none';
    });
    document.documentElement.appendChild(host);
  }
  function mostrar() { montar(); host.style.display = ''; }
  function pintar(cls, t1, t2, t3) {
    if (!raiz) return;
    raiz.getElementById('cx').className = 'cx ' + (cls || '');
    raiz.getElementById('t1').textContent = t1; raiz.getElementById('t2').textContent = t2 || ''; raiz.getElementById('t3').textContent = t3 || '';
    const f = raiz.getElementById('fechar'); f.title = pendAqui() ? 'Descartar a resposta' : 'Ocultar'; f.setAttribute('aria-label', f.title);
  }
  /* estado de repouso: resposta pendente > e-mail fechado > e-mail aberto (com o status do atendimento) */
  function base() {
    clearTimeout(timer);
    if (pendAqui()) return pintarResp();
    if (!msg) { if (host && !msg) host.style.display = 'none'; return; }
    if (fechado) return pintar('dim', 'E-mail fechado', 'Abra o e-mail para mandá-lo ao conferidor.');
    pintar(status ? ({ warn: 'warn', ok: 'okst', info: 'info' })[status.nivel] || '' : '', 'Abrir no conferidor', msg.assunto || '', status ? status.texto : '');
  }
  function pintarResp() {
    const p = pend, quem = p.quem ? 'Resposta: ' + p.quem : '', alvo = (p.alvo && p.alvo.assunto) || p.assunto || '';
    if (p.estado === 'compondo') return pintar('esperando', 'Colando a resposta…', quem);
    if (p.estado === 'falhou') return pintar('erro', 'Não consegui colar sozinho', 'Clique no corpo da resposta e aqui (ou copie no Conferidor e use Ctrl+V).');
    if (p.estado === 'aguardandoCompose') return naoAbriu
      ? pintar('erro', 'O Responder a todos não abriu', 'Clique em Responder a todos: a resposta é colada assim que o texto abrir.', 'Ou clique no corpo da resposta e aqui para colar.')
      : pintar('esperando', 'Abrindo Responder a todos…', quem);
    const aberto = msg && emailAberto(), mesmo = aberto && confere(msg, p.alvo);
    if (mesmo) return pintar('resp', 'Responder a todos e colar', quem, '');
    return pintar('resp warn', 'Responder a todos e colar', quem, aberto ? `O e-mail aberto é outro. Abra “${alvo}” (ou clique para responder a este).` : `Abra o e-mail “${alvo}”: o Responder a todos abre sozinho.`);
  }
  const temporario = (cls, t1, t2) => { pintar(cls, t1, t2); clearTimeout(timer); timer = setTimeout(base, 5000); };
  function enviar(tipo, dados, cb) {
    try { chrome.runtime.sendMessage({ tipo, ...dados }, r => { if (chrome.runtime.lastError) { cb(null, true); return; } cb(r, false); }); }
    catch (e) { cb(null, true); }
  }
  function clicar() {
    if (pendAqui()) { clicarResp(); return; }
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
  function clicarResp() {
    if (pend.estado === 'novo') {
      const aberto = msg && emailAberto();
      if (!(aberto && confere(msg, pend.alvo)) && Date.now() - confirmar > 5000) {   // não é o e-mail do atendimento: segundo clique confirma
        confirmar = Date.now(); pintar('resp warn', 'Responder a este e-mail?', aberto ? msg.assunto || '(sem assunto)' : 'Nenhum e-mail aberto identificado', 'Não é o e-mail do atendimento. Clique de novo para responder mesmo assim.');
        clearTimeout(timer); timer = setTimeout(base, 5000); return;
      }
      confirmar = 0; acionar(); return;
    }
    colar();   // não abriu sozinho / não colou: cola onde está o cursor
  }

  /* ---------- Responder a todos + colar ---------- */
  function clicarBotao() {
    const docs = [document]; document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) docs.push(f.contentDocument); } catch (e) { } });
    for (const d of docs) {
      const el = [...d.querySelectorAll('button,a,[role="button"],[role="menuitem"],[title],[aria-label]')].filter(x => visivel(x) && !(host && host.contains(x)))
        .find(x => [x.title, x.getAttribute('aria-label'), (x.innerText || '').trim()].some(t => t && TEXTOS_BOTAO.includes(t.trim().toLowerCase())));
      if (el) { el.click(); return true; }
    }
    return false;
  }
  async function acionar() {
    if (!pend || acionado === pend.id) return;
    const id = pend.id; acionado = id; naoAbriu = false;
    pend.estado = 'aguardandoCompose'; pend.acionadoEm = Date.now(); await gravarPend(pend);
    base();
    await sleep(300);   // o resposta.js fotografa os editores que já existem
    window.postMessage({ __conferidor: 'tecla', tecla: 'a' }, window.location.origin);   // captura-main.js: atalho A = Responder a todos
    await sleep(3500);
    let p = await lerPend(); if (p && p.id === id && p.estado === 'aguardandoCompose') clicarBotao();
    await sleep(5500);
    p = await lerPend(); if (p && p.id === id && p.estado === 'aguardandoCompose') { pend = p; naoAbriu = true; base(); }
  }
  /* resposta chegou ou a situação mudou: abre sozinho só se o e-mail aberto for o do atendimento */
  function decidir() {
    if (!pendAqui() || pend.estado !== 'novo') return base();
    mostrar();
    if (pend.aba !== meuTab || document.hidden) return base();
    if (acionado !== pend.id && Date.now() - pend.criado < AUTO && msg && emailAberto() && confere(msg, pend.alvo)) { acionar(); return; }
    base();
  }
  /* plano B: cola onde está o cursor (corpo da resposta, que pode estar dentro de um iframe) */
  function colar() {
    let doc = document, el = document.activeElement;
    for (let i = 0; i < 3 && el && el.tagName === 'IFRAME'; i++) { try { doc = el.contentDocument; el = doc.activeElement; } catch (e) { el = null; } }
    const editavel = el && (el.isContentEditable || doc.designMode === 'on');
    if (!editavel) { temporario('erro', 'Clique no corpo da resposta', 'Abra Responder a todos, clique no texto e depois aqui.'); return; }
    let ok = false; try { ok = doc.execCommand('insertHTML', false, pend.html); } catch (e) { ok = false; }
    if (!ok) { try { ok = doc.execCommand('insertText', false, pend.texto || ''); } catch (e) { ok = false; } }
    if (!ok) { temporario('erro', 'Não consegui colar', 'Use o botão Copiar no Conferidor e Ctrl+V aqui.'); return; }
    pend = null; limparPend();
    temporario('ok', 'Resposta colada', 'Revise o texto e clique em Enviar no webmail.');
  }

  /* ---------- o e-mail continua aberto? (algum trecho do texto dele aparece na tela) ---------- */
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
  const emailAberto = () => !msg ? false : trechos.length ? trechos.some(t => textoNaTela().includes(t)) : !fechado;
  setInterval(() => {
    if (!msg || !trechos.length || document.hidden || !host || host.style.display === 'none' || (pendAqui() && pend.estado !== 'novo')) return;
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
    const ver = () => { mostrar(); base(); perguntarStatus(); if (pendAqui() && pend.estado === 'novo') setTimeout(decidir, 1200); };   // abriu o e-mail do atendimento: responde sozinho
    if (document.documentElement) ver(); else document.addEventListener('DOMContentLoaded', ver, { once: true });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pendAqui() && pend.estado === 'novo') setTimeout(decidir, 400); });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'session' || !ch[CH]) return;
      const antes = pend; pend = ch[CH].newValue || null;
      if (!pend) { if (antes && host) base(); return; }
      if (!ehMeu(pend)) return;
      if (pend.estado === 'colado' && (!antes || antes.estado !== 'colado')) { mostrar(); temporario('ok', 'Resposta colada', 'Revise o texto e clique em Enviar no webmail.'); return; }
      if (pend.estado === 'novo' && (!antes || antes.id !== pend.id)) { naoAbriu = false; confirmar = 0; decidir(); return; }
      if (host) base();
    });
    chrome.runtime.onMessage.addListener((m, s, responder) => {
      if (m && m.tipo === 'resposta') { lerPend().then(p => { pend = p; naoAbriu = false; decidir(); }); responder({ ok: true }); }
    });
    enviar('meuTab', {}, async r => {
      meuTab = r && typeof r.tabId === 'number' ? r.tabId : -1;
      pend = await lerPend();
      if (pendAqui()) { const pronto = () => { mostrar(); decidir(); }; if (document.documentElement) pronto(); else document.addEventListener('DOMContentLoaded', pronto, { once: true }); }
    });
  } catch (e) { }
})();
