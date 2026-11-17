'use strict';
/* ====================================================================
   Modo simples (tela única) e painel flutuante no canto da tela (fica por cima do sistema)
   ==================================================================== */
const MINI_CAMPOS = [['executante', 'Credenciado executante'], ['carteira', 'Carteira'], ['benef', 'Beneficiário'], ['medico_nome', 'Médico'], ['medico_crm', 'CRM'], ['data', 'Data do pedido'], ['local', 'Local do pedido'], ['cid', 'CID']];
let miniMsg = '';
function htmlMini(g, { flutuante = false, semPrints = false } = {}) {
  if (!g || !S) return `<div class="mini"><p class="muted">Nenhum atendimento aberto no conferidor.</p></div>`;
  const p = g.pedido, st = situacaoGuia(g), av = prontoPrints(g) ? avaliarPrints(g) : null, cl = clinicaDe(S);
  const linha = (chave, rot, v) => { const ok = v !== '' && g.copiados[chave] === v; return `<button type="button" class="mini-row ${ok ? 'ok' : ''} ${v ? '' : 'vazio'}" data-mcopy="${esc(chave)}" ${v ? '' : 'disabled'} title="${v ? 'Copiar' : 'Vazio'}"><span class="r">${esc(rot)}</span><span class="v num">${esc(v || '—')}</span>${ic(ok ? 'check' : 'copy', 'sm')}</button>`; };
  const nCopiar = MINI_CAMPOS.filter(([k]) => valorCopia(g, k).trim()).length + p.itens.length * 2, nFeito = MINI_CAMPOS.filter(([k]) => { const v = valorCopia(g, k).trim(); return v && g.copiados[k] === v; }).length + p.itens.filter(it => g.copiados['c:' + it.codigo] === it.codigo).length + p.itens.filter(it => g.copiados['q:' + it.codigo] === String(it.qtd)).length;
  const prob = av ? [...av.checks, ...av.linhas].filter(x => x.sit === 'bad' || x.sit === 'warn') : [];
  return `<div class="mini">
    <div class="mini-h"><div><b>${esc(p.beneficiario || 'Beneficiário não informado')}</b><div class="muted">${esc(cl ? cl.nome : S.email.remetente.email)}${S.guias.length > 1 ? ` · guia ${g.idx + 1} de ${S.guias.length}` : ''}</div></div><span class="tag ${nFeito >= nCopiar ? 'ok' : ''}">${nFeito}/${nCopiar} copiados</span></div>
    ${st.bloqueios.length ? `<div class="mini-al bad">${ic('ban', 'sm')}${pl(st.bloqueios.length, 'bloqueio', 'bloqueios')}: resolva no conferidor antes de gerar a guia.</div>` : ''}
    <div class="mini-sec">Para lançar no sistema (clique para copiar)</div>
    <div class="mini-lista">${MINI_CAMPOS.map(([k, r]) => linha(k, r, valorCopia(g, k).trim())).join('')}
      ${p.itens.map(it => `<div class="mini-item">${linha('c:' + it.codigo, 'Código', it.codigo)}${linha('q:' + it.codigo, 'Qtd.', it.qtd == null ? '' : String(it.qtd))}</div>`).join('') || '<p class="muted">Sem serviços.</p>'}</div>
    ${semPrints ? '' : `<div class="mini-sec">Conferência pelos prints</div>
    <div class="mini-prints">
      ${av ? `<div class="mini-al ${av.ok ? 'ok' : prob.length ? 'warn' : ''}">${ic(av.ok ? 'check' : 'alert', 'sm')}${av.ok ? 'Conferido pelos prints' + (av.ressalvas ? ' (com ressalva)' : '') : prob.length ? prob.length + ' ponto(s) para conferir' : av.avisos[0] || 'Faltam prints'}</div>
        ${prob.slice(0, 4).map(x => `<div class="mini-div">${x.sit === 'bad' ? '✕' : '!'} ${esc(x.rot || 'Item ' + x.codigo)}: ${esc(String(x.lido ?? x.qSis ?? '—'))} <span class="muted">(pedido ${esc(String(x.ped ?? x.qPed ?? '—'))})</span></div>`).join('')}
        ${av.avisos.filter(a => /Falta/.test(a)).map(a => `<div class="mini-div">• ${esc(a)}</div>`).join('')}` : '<p class="muted" style="margin:0 0 6px">Nenhum print lido ainda.</p>'}
      <div class="mini-btns">${Captura.suportada() ? `<button type="button" class="btn sm pri" data-mact="capturar">${ic('eye', 'sm')}${Captura.ativa() ? 'Capturar janela' : 'Conectar janela'}</button>` : ''}<button type="button" class="btn sm" data-mact="colar">${ic('clip', 'sm')}Colar print</button></div>
      ${miniMsg ? `<div class="mini-msg">${esc(miniMsg)}</div>` : ''}
      <div class="mini-num">Nº da guia: <b class="num">${esc(g.numero || '—')}</b>${g.numero ? ` <span class="muted">(${g.numeroOrigem === 'print' ? 'do print' : 'digitado'})</span>` : ''}</div>
    </div>`}
    <div class="mini-btns" style="margin-top:8px">${flutuante ? `<button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Ir para o conferidor</button>` : `<button type="button" class="btn sm line" data-act="modoSimples">${ic('layers', 'sm')}Voltar ao modo completo</button>`}</div>
  </div>`;
}
/* copia um valor do painel (no painel flutuante a área de transferência é a da janelinha) */
async function miniCopiar(chave, win) {
  const g = guiaAtiva(); if (!g) return;
  let v = '';
  if (chave.startsWith('c:') || chave.startsWith('q:')) { const it = g.pedido.itens.find(x => x.codigo === chave.slice(2)); if (!it) return; v = chave[0] === 'c' ? it.codigo : String(it.qtd ?? ''); }
  else v = valorCopia(g, chave).trim();
  if (!v) return;
  let ok = false;
  try { await (win || window).navigator.clipboard.writeText(v); ok = true; } catch (e) { if (!win) ok = await copiar(v); }
  if (!ok) { miniMsg = 'Não consegui copiar: clique de novo.'; Mini.atualizar(); return; }
  g.copiados[chave] = v; miniMsg = 'Copiado: ' + v; persistir(); render();
}
const Mini = {
  win: null,
  aberto() { return !!(this.win && !this.win.closed); },
  async abrir() {
    if (this.aberto()) { this.win.focus(); return; }
    try {
      if ('documentPictureInPicture' in window) this.win = await documentPictureInPicture.requestWindow({ width: 380, height: 700 });
      else { this.win = window.open('', 'conferidorPainel', 'popup,width=400,height=720'); if (!this.win) { toast('O navegador bloqueou a janela do painel. Permita pop-ups para este site.', 'bad'); return; } }
    } catch (e) { toast('Não foi possível abrir o painel flutuante: ' + e.message, 'bad'); return; }
    const d = this.win.document; d.title = 'Conferidor — painel';
    d.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    document.querySelectorAll('style, link[rel=stylesheet]').forEach(n => { if (n.tagName === 'LINK') { const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = n.href; d.head.appendChild(l); } else d.head.appendChild(n.cloneNode(true)); });   // o visual está em css/app.css: no painel vai com o endereço completo
    d.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light');
    d.body.innerHTML = '<div id="miniApp" class="mini-janela"></div>';
    d.addEventListener('click', e => this.clique(e));
    d.addEventListener('paste', e => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => /^image\//.test(f.type)); if (fs.length && S) { e.preventDefault(); miniMsg = 'Lendo o print…'; this.atualizar(); processarPrints(fs).then(() => { miniMsg = ''; this.atualizar(); }); } });
    this.win.addEventListener('pagehide', () => { this.win = null; if (Vis.get() === 'flutuante') Vis.set('completa'); render(); });
    this.atualizar(); render();
  },
  atualizar() { if (!this.aberto()) { this.win = null; return; } const el = this.win.document.getElementById('miniApp'); if (el) el.innerHTML = htmlMini(S ? guiaAtiva() : null, { flutuante: true }); },
  async clique(e) {
    const c = e.target.closest('[data-mcopy]'); if (c) { await miniCopiar(c.dataset.mcopy, this.win); return; }
    const b = e.target.closest('[data-mact]'); if (!b) return;
    const a = b.dataset.mact;
    if (a === 'abrir') { window.focus(); return; }
    if (a === 'capturar') { miniMsg = Captura.ativa() ? 'Capturando…' : ''; this.atualizar(); await capturarJanela(this.win.navigator); miniMsg = ''; this.atualizar(); return; }
    if (a === 'colar') {
      try {
        const itens = await this.win.navigator.clipboard.read(), fs = [];
        for (const it of itens) for (const t of it.types) if (/^image\//.test(t)) fs.push(new File([await it.getType(t)], 'print-colado.png', { type: t }));
        if (!fs.length) { miniMsg = 'Não há imagem copiada. Copie o print e clique de novo (ou Ctrl+V aqui).'; this.atualizar(); return; }
        miniMsg = 'Lendo o print…'; this.atualizar(); await processarPrints(fs); miniMsg = '';
      } catch (er) { miniMsg = 'Use Ctrl+V com o painel selecionado.'; }
      this.atualizar();
    }
  }
};
Object.assign(acoes, {
  capturarJanela() { return capturarJanela(); },
  async trocarJanela() { Captura.parar(); await capturarJanela(); },
  modoSimples() { Vis.set(Vis.simples() ? 'completa' : 'simples'); render(); },
  async painelFlutuante() { Vis.set('flutuante'); await Mini.abrir(); if (!Mini.aberto()) Vis.set('completa'); render(); }
});
document.addEventListener('focusin', e => { const t = e.target; if (t && t.dataset && t.dataset.cpcampo != null && t.dataset.orig == null) t.dataset.orig = t.value.trim(); });   // valor antes da edição (linha do tempo)
/* no modo simples (janela principal) */
document.addEventListener('click', e => {
  const c = e.target.closest && e.target.closest('[data-mcopy]'); if (c) { miniCopiar(c.dataset.mcopy); return; }
  const b = e.target.closest && e.target.closest('[data-mact]'); if (!b) return;
  if (b.dataset.mact === 'capturar') capturarJanela(); else if (b.dataset.mact === 'colar') acoes.colarPrint();
});

/* ---------- Quem está com o Conferidor aberto agora (batimento na pasta a cada minuto) ---------- */
const Presenca = {
  lista: [],
  async bater() {
    const op = operadorObj(); if (!Pasta.ok || !op || Abas.pausada) return;
    try { await Pasta.gravar(['presenca'], slug(op.id || op.nome) + '.json', { operador: op.nome, operadorId: op.id, em: agora(), etapa: S ? S.vista : 0, atendendo: !!S, visivel: !document.hidden }); } catch (e) { }
  },
  async ler() {
    if (!Pasta.ok) { this.lista = []; return []; }
    const out = [];
    for (const [n, h] of await Pasta.listar(['presenca'])) { if (!n.endsWith('.json')) continue; try { const d = JSON.parse(await (await h.getFile()).text()); if (Date.now() - new Date(d.em) < 3 * 60000) out.push(d); } catch (e) { } }
    this.lista = out.sort((a, b) => (a.operador || '').localeCompare(b.operador || '')); return this.lista;
  }
};
setInterval(() => Presenca.bater(), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) Presenca.bater(); });
function htmlPresenca() {
  if (!Pasta.ok) return `<div class="card"><div class="card-h"><h2>Com o Conferidor aberto agora</h2></div><p class="muted" style="margin:0">Conecte a pasta compartilhada para ver quem está on-line.</p></div>`;
  const L = Presenca.lista;
  return `<div class="card"><div class="card-h"><h2>Com o Conferidor aberto agora</h2><span class="tag ${L.length ? 'ok' : ''}">${pl(L.length, 'pessoa', 'pessoas')}</span></div>
    <div class="presenca">${L.map(d => { const o = cfg.operadores.find(x => x.id === d.operadorId); const min = Math.max(0, Math.round((Date.now() - new Date(d.em)) / 60000));
      return `<div class="pres-op">${htmlAvatar(o)}<div><b>${esc(d.operador)}</b><small>${d.atendendo ? `em atendimento · etapa ${d.etapa}` : 'sem atendimento aberto'}${d.visivel === false ? ' · em outra janela' : ''} · ${min < 1 ? 'agora' : 'há ' + min + ' min'}</small></div></div>`; }).join('') || '<p class="muted" style="margin:0">Ninguém além de você, no momento.</p>'}</div></div>`;
}

/* ---------- Notas fixas do beneficiário (por carteira), na pasta "notas" ---------- */
const Notas = {
  itens: {},
  juntar(a, b) { const o = { ...(a || {}) }; Object.entries(b || {}).forEach(([k, v]) => { if (!o[k] || (v.em || '') > (o[k].em || '')) o[k] = v; }); return o; },
  async carregar() {
    const loc = LS.get('notasBenef', null); let it = (loc && loc.itens) || {};
    if (Pasta.ok) { const p = await Pasta.ler(['notas'], 'beneficiarios.json'); if (p) it = this.juntar(p.itens, it); }
    this.itens = it; LS.set('notasBenef', { atualizadoEm: agora(), itens: it });
  },
  de(cart) { const k = normCart(cart || ''); const n = k && this.itens[k]; return n && n.texto ? n : null; },
  async salvar(cart, texto) {
    const k = normCart(cart || ''); if (!k) return false;
    await this.carregar(); this.itens[k] = { texto: texto.trim(), por: operador(), em: agora() };   // texto vazio = removida (fica a marca para não voltar)
    const doc = { atualizadoEm: agora(), itens: this.itens }; LS.set('notasBenef', doc);
    if (Pasta.ok) { try { await Pasta.gravar(['notas'], 'beneficiarios.json', doc); } catch (er) { toast('A nota ficou só neste computador: não consegui gravar na pasta.', 'bad'); } }
    return true;
  }
};
function htmlNotasFixas(g) {
  const cl = clinicaDe(S), nc = cl && (cl.nota || '').trim(), cart = g.carteiraUsada || g.pedido.carteira, nb = Notas.de(cart);
  const linhas = [];
  if (nc) linhas.push(`<div class="nota-fixa">${ic('building', 'sm')}<div class="esp"><b>Nota da clínica ${esc(cl.nome)}:</b> ${esc(nc)}</div></div>`);
  if (nb) linhas.push(`<div class="nota-fixa">${ic('user', 'sm')}<div class="esp"><b>Nota do beneficiário:</b> ${esc(nb.texto)} <span class="muted">— ${esc(nb.por || '')}, ${fmtData(nb.em)}</span></div><button class="btn sm ghost" data-act="notaBenef">${ic('edit', 'sm')}Editar</button></div>`);
  return linhas.length ? `<div class="notas-fixas">${linhas.join('')}</div>` : '';
}

/* ---------- Lembrete de atendimento parado na mesma etapa ---------- */
function htmlAvisoParado() {
  if (!S || !S.avisoParado) return '';
  return `<div class="aviso aviso-parado" role="status">${ic('pause')}<div class="esp">Este atendimento está parado há <b>${S.avisoParado} min</b> na etapa ${S.vista}. Continue, ou responda à clínica se estiver esperando algo.</div><button class="btn sm" data-act="okParado">${ic('check', 'sm')}Ok, continuar</button></div>`;
}
setInterval(() => {
  const lim = Number(cfg.preferencias.minutosParado ?? 10); if (!S || !lim || Abas.pausada || document.hidden) return;
  if (!S.vistaDesde) { S.vistaDesde = agora(); return; }
  const min = Math.floor((Date.now() - new Date(S.vistaDesde)) / 60000);
  if (min >= lim && S.avisoParado !== min && (!S.avisoParado || min - S.avisoParado >= lim)) { S.avisoParado = min; if (aba === 'atend' && !M) render(); }
}, 30000);

/* ---------- Uma aba por vez: duas abas abertas gravariam o atendimento no mesmo lugar do navegador ---------- */
const Abas = {
  id: Math.random().toString(36).slice(2), canal: null, pausada: false, outra: false, esperando: false,
  iniciar() {
    if (!('BroadcastChannel' in window)) return;
    this.canal = new BroadcastChannel('conferidor-abas');
    this.canal.onmessage = ev => {
      const m = ev.data || {}; if (m.de === this.id) return;
      if (m.t === 'ola' && !this.pausada) this.canal.postMessage({ t: 'aqui', de: this.id });
      if (m.t === 'aqui' && this.esperando) this.outra = true;
      if (m.t === 'assumir' && !this.pausada) this.pausar(false);
    };
    this.esperando = true; this.canal.postMessage({ t: 'ola', de: this.id });
    setTimeout(() => { this.esperando = false; if (this.outra) this.pausar(true); }, 400);
  },
  pausar(nova) {
    this.pausada = true; if (M) fecharModal(true);
    let el = document.getElementById('abaPausada');
    if (!el) { el = document.createElement('div'); el.id = 'abaPausada'; el.className = 'aba-pausada'; el.setAttribute('role', 'alertdialog'); document.body.appendChild(el); }
    el.innerHTML = `<div class="aba-pausada-c">${ic('alert', 'xl')}<h2>${nova ? 'O Conferidor já está aberto em outra aba' : 'Esta aba foi pausada'}</h2>
      <p>${nova ? 'Duas abas abertas misturam os atendimentos, porque gravam no mesmo lugar do navegador. Feche esta aba e use a outra, ou use esta (a outra fica pausada).' : 'O Conferidor foi aberto em outra aba. Esta ficou pausada para não misturar os atendimentos.'}</p>
      <button class="btn pri" id="abaUsar">${ic('check')}Usar esta aba</button></div>`;
    el.querySelector('#abaUsar').addEventListener('click', () => this.assumir());
  },
  assumir() {
    if (this.canal) this.canal.postMessage({ t: 'assumir', de: this.id });
    this.pausada = false; this.outra = false;
    const el = document.getElementById('abaPausada'); if (el) el.remove();
    S = LS.get('atual', null); if (S && S.v !== 2) S = null;
    render();
  }
};
window.addEventListener('beforeunload', e => { if (S && !Abas.pausada) { e.preventDefault(); e.returnValue = ''; } });

async function init() {
  Abas.iniciar();
  Dica.iniciar();
  iniciarSoIcone();
  Tema.aplicar();
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
  const hoje = new Date();
  $('#printData').textContent = 'Emitido em ' + fmtData(hoje) + ', ' + fmtHora(hoje) + ' · Criado por Alexandre Neves';
  $('#anoRodape').textContent = hoje.getFullYear();
  await Pasta.init();
  await carregarConfig();
  await Param.carregar();
  await Reg.carregar();
  Reg.conferirLocais().catch(() => { });
  Presenca.bater();
  await Apr.carregar();
  await Notas.carregar();
  S = LS.get('atual', null);
  if (S && S.v !== 2) S = null;
  render();
}
init();
