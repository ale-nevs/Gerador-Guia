/* Webmail (mundo isolado): recebe o e-mail visto pelo captura-main.js e exibe o painel flutuante "Abrir no conferidor".
   v1.3.0:
   - Cache LRU (até 40 e-mails) + MutationObserver com debounce no painel de leitura: voltar para um e-mail já em cache
     reconhece automaticamente a mensagem visível sem reenviar o e-mail errado.
   - Botão minimizar (—) recolhe em pílula compacta restaurável, nunca some definitivamente da sessão.
   - Exibe status ao vivo (inclusive rascunho pausado e alerta de pasta desconectada) e atualiza ao concluir guia.
   - Auto-Responder & Colar: ao receber resposta do Conferidor, abre "Responder" no webmail e insere o HTML formatado
     automaticamente acima do histórico citado (com fallback seguro para inserção manual em 1 clique).
   Nada é enviado sem revisão e clique do operador no botão Enviar do webmail. */
(function () {
  let msg = null, host = null, raiz = null, timer = null, fechado = false, minimizado = false, confirmar = 0;
  let resposta = null, status = null, pastaDesconectada = false, trechos = [], obsTimer = null, observando = false;
  const historicoMsgs = []; // LRU mais recente primeiro: [{ chave, msg, trechos, assuntoNorm }]
  const MAX_CACHE = 40;

  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const chaveMsg = m => String((m && (m.messageId || (m.uid != null ? m.folder + ':' + m.uid : m.assunto))) || '');

  function extrairTrechos(m) {
    const out = [];
    let t = (m && m.plain) || '';
    if (!t && m && m.html) { try { t = new DOMParser().parseFromString(m.html, 'text/html').body.textContent || ''; } catch (e) { t = ''; } }
    t = norm(t);
    if (t.length >= 48) {
      [0.2, 0.5, 0.78].forEach(f => { const i = Math.floor(t.length * f); const s = t.slice(i, i + 26).trim(); if (s.length >= 15) out.push(s); });
    }
    return out;
  }

  function guardarNoCache(m) {
    const ch = chaveMsg(m);
    const tr = extrairTrechos(m);
    const idx = historicoMsgs.findIndex(x => x.chave === ch && ch);
    if (idx >= 0) historicoMsgs.splice(idx, 1);
    historicoMsgs.unshift({ chave: ch, msg: m, trechos: tr, assuntoNorm: norm(m.assunto || '') });
    if (historicoMsgs.length > MAX_CACHE) historicoMsgs.length = MAX_CACHE;
    return tr;
  }

  function montar() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'conferidor-flutuante';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646;font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    raiz = host.attachShadow({ mode: 'closed' });
    raiz.innerHTML = `<style>
      .cx{display:flex;align-items:stretch;font:600 13px/1.3 "Inter","Segoe UI",system-ui,-apple-system,sans-serif;border-radius:12px;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 28px -6px rgba(15,23,42,.38),0 2px 6px rgba(15,23,42,.18);overflow:hidden;background:#1e4678;color:#fff;transition:transform .14s ease,opacity .14s ease}
      button{all:unset;cursor:pointer;box-sizing:border-box}
      .abrir{display:flex;align-items:center;gap:10px;background:#1e4678;color:#fff;padding:10px 14px;max-width:340px;transition:background .14s}
      .abrir:hover{background:#193a63}.abrir:focus-visible{outline:2px solid #2dd4bf;outline-offset:-2px}
      .ic-w{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.12);display:inline-flex;align-items:center;justify-content:center;flex:none}
      .tx{display:flex;flex-direction:column;gap:2px;min-width:0}
      .tx b{font-weight:700;font-size:13px;letter-spacing:-.01em}
      .tx small{font-weight:500;color:rgba(255,255,255,.84);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:255px}
      .st{display:none;font-size:11px;font-weight:650;padding:2.5px 7px;border-radius:6px;margin-top:3px;white-space:normal;line-height:1.3;border:1px solid transparent}
      .warn .st{display:inline-block;background:#fffbeb;color:#78350f;border-color:#fde68a}
      .okst .st{display:inline-block;background:#ecfdf5;color:#14532d;border-color:#a7f3d0}
      .info .st{display:inline-block;background:#eff6ff;color:#1e3a5f;border-color:#bfdbfe}
      .fechar{background:rgba(13,31,54,.35);color:#cbd5e1;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:15px;border-left:1px solid rgba(255,255,255,.12);transition:background .14s,color .14s}
      .fechar:hover{background:rgba(13,31,54,.65);color:#fff}
      .ok .abrir{background:#15803d}.erro .abrir{background:#b91c1c}.esperando .abrir{background:#275996}
      .dim .abrir{background:#475569}.dim .fechar{background:#334155}
      .resp .abrir{background:#117f72}.resp .abrir:hover{background:#11655c}
      .pilula{display:none;align-items:center;gap:7px;padding:8px 12px;border-radius:999px;background:#152f50;color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 6px 18px rgba(15,23,42,.32);font:650 12px/1 "Inter","Segoe UI",system-ui,sans-serif}
      .pilula:hover{background:#1e4678}
      .pilula .ponto{width:8px;height:8px;border-radius:50%;background:#2dd4bf}
      .min .cx{display:none}.min .pilula{display:inline-flex}
    </style>
    <div id="wrap">
      <div class="cx" id="cx">
        <button class="abrir" id="abrir" title="Abrir este e-mail no Conferidor de Guias">
          <span class="ic-w">${ICONE}</span>
          <span class="tx"><b id="t1">Abrir no conferidor</b><small id="t2"></small><span class="st" id="t3"></span></span>
        </button>
        <button class="fechar" id="fechar" title="Minimizar botão" aria-label="Minimizar botão">–</button>
      </div>
      <button class="pilula" id="pilula" title="Expandir botão do Conferidor de Guias">${ICONE}<span>Conferidor</span><span class="ponto" id="ponto" hidden></span></button>
    </div>`;
    const ab = raiz.getElementById('abrir');
    ab.addEventListener('mousedown', e => e.preventDefault()); // preserva foco/cursor no editor de resposta
    ab.addEventListener('click', clicar);
    raiz.getElementById('fechar').addEventListener('click', () => { minimizado = true; atualizarMinimizado(); });
    raiz.getElementById('pilula').addEventListener('click', () => { minimizado = false; atualizarMinimizado(); base(); });
    document.documentElement.appendChild(host);
    iniciarObservador();
  }

  function atualizarMinimizado() {
    if (!raiz) return;
    raiz.getElementById('wrap').className = minimizado ? 'min' : '';
    const pt = raiz.getElementById('ponto');
    if (pt) pt.hidden = !resposta;
  }

  function pintar(cls, t1, t2, t3) {
    if (!raiz) return;
    atualizarMinimizado();
    raiz.getElementById('cx').className = 'cx ' + (cls || '');
    raiz.getElementById('t1').textContent = t1;
    raiz.getElementById('t2').textContent = t2 || '';
    raiz.getElementById('t3').textContent = t3 || '';
  }

  function base() {
    clearTimeout(timer);
    if (resposta) {
      return pintar('resp', 'Inserir resposta' + (resposta.quem ? ': ' + resposta.quem : ''), 'Clique aqui para abrir Responder e colar o texto.');
    }
    if (!msg) return;
    if (fechado) return pintar('dim', 'E-mail fechado', 'Abra um pedido para enviá-lo ao conferidor.');
    let nivel = status ? status.nivel : '';
    let txtSt = status ? status.texto : '';
    if (pastaDesconectada) {
      txtSt = txtSt ? txtSt + ' · Pasta desconectada no Conferidor' : 'Pasta compartilhada desconectada no Conferidor';
      if (!nivel) nivel = 'warn';
    }
    pintar(({ warn: 'warn', ok: 'okst', info: 'info' })[nivel] || '', 'Abrir no conferidor', msg.assunto || '', txtSt);
  }

  const temporario = (cls, t1, t2) => { pintar(cls, t1, t2, ''); clearTimeout(timer); timer = setTimeout(base, 5000); };
  function enviar(tipo, dados, cb) {
    try { chrome.runtime.sendMessage({ tipo, ...dados }, r => { if (chrome.runtime.lastError) { cb(null, true); return; } cb(r, false); }); }
    catch (e) { cb(null, true); }
  }

  async function clicar() {
    if (resposta) {
      const ok = await autoResponderEColar(resposta, true);
      if (!ok) { temporario('erro', 'Abra Responder no webmail', 'Clique no corpo do e-mail e clique aqui novamente.'); }
      return;
    }
    if (!msg) return;
    if (fechado && Date.now() - confirmar > 5000) {
      confirmar = Date.now();
      pintar('dim', 'Enviar o último e-mail lido?', 'Clique de novo para confirmar: ' + (msg.assunto || ''), '');
      clearTimeout(timer); timer = setTimeout(base, 5000);
      return;
    }
    confirmar = 0;
    pintar('esperando', 'Abrindo no conferidor…', msg.assunto || '', '');
    enviar('abrir', { msg }, (r, falhou) => {
      if (falhou) return temporario('erro', 'Extensão atualizada', 'Aperte F5 nesta página e tente de novo.');
      if (r && r.ok) {
        const n = r.nomes || [];
        return temporario('ok', n.length ? 'Aberto: ' + n[0] + (n.length > 1 ? ` e mais ${n.length - 1}` : '') : 'Aberto no conferidor', 'Veja a aba do Conferidor de Guias.');
      }
      if (r && r.motivo === 'sem-url') return temporario('erro', 'Abra o Conferidor antes', 'Abra o site do Conferidor numa aba uma vez e tente de novo.');
      temporario('erro', 'Não foi possível abrir', (r && r.motivo) || '');
    });
  }

  /* Localiza o editor de resposta aberto no webmail (iframe de edição ou div contenteditable visível) */
  function acharEditorResposta() {
    let doc = document, el = document.activeElement;
    for (let i = 0; i < 3 && el && el.tagName === 'IFRAME'; i++) {
      try { doc = el.contentDocument; el = doc && (doc.activeElement || doc.body); } catch (e) { el = null; }
    }
    if (el && (el.isContentEditable || (doc && doc.designMode === 'on'))) return { doc, el };
    for (const f of document.querySelectorAll('iframe')) {
      const r = f.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) continue;
      try {
        const fd = f.contentDocument, fb = fd && fd.body;
        if (fb && (fb.isContentEditable || fd.designMode === 'on')) return { doc: fd, el: fb };
      } catch (e) { }
    }
    const editaveis = [...document.querySelectorAll('[contenteditable="true"], [role="textbox"][contenteditable="true"]')].filter(n => {
      const r = n.getBoundingClientRect();
      return r.width >= 160 && r.height >= 60 && n.offsetParent !== null;
    });
    if (editaveis.length) return { doc: document, el: editaveis[0] };
    return null;
  }

  function clicarBotaoResponderWebmail() {
    const cands = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')].filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 16) return false;
      const tx = norm(el.textContent || '');
      const lb = norm((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || ''));
      if (/todos|all|encaminhar|forward/i.test(tx) || /todos|all|encaminhar|forward/i.test(lb)) return false;
      return /^responder$/.test(tx) || /^reply$/.test(tx) || /\bresponder\b/.test(lb) || /\breply\b/.test(lb);
    });
    if (!cands.length) return false;
    try { cands[0].click(); return true; } catch (e) { return false; }
  }

  function inserirNoEditor(alvo, resp) {
    const { doc, el } = alvo;
    try {
      el.focus();
      const sel = doc.getSelection ? doc.getSelection() : window.getSelection();
      if (sel && (!el.contains(sel.anchorNode) || sel.anchorNode === el)) {
        const range = doc.createRange();
        range.selectNodeContents(el);
        range.collapse(true); // posiciona no início da resposta, acima da citação original
        sel.removeAllRanges();
        sel.addRange(range);
      }
      let ok = false;
      try { ok = doc.execCommand('insertHTML', false, resp.html + '<div><br></div>'); } catch (e) { ok = false; }
      if (!ok) {
        const sel2 = doc.getSelection ? doc.getSelection() : null;
        if (sel2 && sel2.rangeCount) {
          const rg = sel2.getRangeAt(0);
          const frag = rg.createContextualFragment(resp.html + '<div><br></div>');
          rg.insertNode(frag);
          rg.collapse(false);
          ok = true;
        }
      }
      if (!ok) { try { ok = doc.execCommand('insertText', false, (resp.texto || '') + '\n\n'); } catch (e) { ok = false; } }
      if (ok) {
        try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
      }
      return ok;
    } catch (e) { return false; }
  }

  async function autoResponderEColar(resp, veioDeClique) {
    let alvo = acharEditorResposta();
    if (!alvo) {
      const clicou = clicarBotaoResponderWebmail();
      if (clicou) {
        for (let i = 0; i < 22 && !alvo; i++) { await espera(125); alvo = acharEditorResposta(); }
      }
    }
    if (!alvo) return false;
    const ok = inserirNoEditor(alvo, resp);
    if (!ok) return false;
    resposta = null;
    enviar('respostaUsada', {}, () => { });
    minimizado = false;
    temporario('ok', 'Resposta inserida!', 'Confira o destinatário/texto e clique em Enviar no webmail.');
    return true;
  }

  /* Leitura leve apenas do painel de leitura visível (sem reflow de toda a página a cada 1.5s) */
  function textoPainelLeitura() {
    let s = '';
    const paineis = document.querySelectorAll('[id*="reading"], [class*="reading"], [class*="message-content"], [class*="mail-view"], [class*="msg-body"], main');
    if (paineis.length) paineis.forEach(p => { s += ' ' + (p.textContent || ''); });
    else if (document.body) s = document.body.textContent || '';
    document.querySelectorAll('iframe').forEach(f => { try { const b = f.contentDocument && f.contentDocument.body; if (b) s += ' ' + (b.textContent || ''); } catch (e) { } });
    return norm(s);
  }

  function verificarPainelVisivel() {
    if (resposta || document.hidden || !host) return;
    const tela = textoPainelLeitura();
    if (msg && trechos.length && trechos.some(t => tela.includes(t))) {
      if (fechado) { fechado = false; base(); }
      return;
    }
    // Verifica se o operador clicou de volta em outro e-mail já guardado no cache do SmarterMail
    for (const item of historicoMsgs) {
      if (item.msg === msg) continue;
      const bateTrecho = item.trechos.length ? item.trechos.some(t => tela.includes(t)) : (item.assuntoNorm.length >= 12 && tela.includes(item.assuntoNorm));
      if (bateTrecho) {
        msg = item.msg;
        trechos = item.trechos;
        fechado = false;
        confirmar = 0;
        base();
        perguntarStatus();
        return;
      }
    }
    if (msg && trechos.length && !fechado) { fechado = true; base(); }
  }

  function iniciarObservador() {
    if (observando || !document.body) return;
    observando = true;
    const agendar = () => { clearTimeout(obsTimer); obsTimer = setTimeout(verificarPainelVisivel, 380); };
    const mo = new MutationObserver(agendar);
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { agendar(); if (msg) perguntarStatus(); } });
  }

  function perguntarStatus() {
    if (!msg) return;
    const m = msg;
    enviar('status', { msg: m }, r => {
      if (m !== msg) return;
      status = (r && r.info) || null;
      pastaDesconectada = !!(r && r.pastaDesconectada);
      base();
    });
  }

  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data;
    if (!d || d.__conferidor !== 'msg' || !d.msg) return;
    msg = d.msg;
    fechado = false;
    minimizado = false;
    confirmar = 0;
    trechos = guardarNoCache(msg);
    const mostrar = () => { montar(); host.style.display = ''; base(); perguntarStatus(); };
    if (document.body) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar, { once: true });
  });

  try {
    chrome.runtime.onMessage.addListener((m, sender, responder) => {
      if (m && m.tipo === 'resposta' && m.resposta) {
        resposta = m.resposta;
        minimizado = false;
        montar();
        host.style.display = '';
        autoResponderEColar(resposta, false).then(colado => {
          if (!colado) base();
          responder({ ok: true, colado: !!colado });
        });
        return true;
      }
      if (m && m.tipo === 'atendimentoAtualizado') {
        if (msg) perguntarStatus();
      }
    });
    enviar('pegarResposta', {}, r => {
      if (r && r.resposta) { resposta = r.resposta; montar(); host.style.display = ''; base(); }
    });
  } catch (e) { }
})();
