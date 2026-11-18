'use strict';
/* ====================================================================
   Interface: componentes comuns, topo, abas, entrada e visão do e-mail
   ==================================================================== */
const TAG_STATUS = {
  em_andamento: ['info', 'clip'], concluido: ['ok', 'check'], cancelado: ['bad', 'ban'], aguardando_clinica: ['warn', 'mail'], descartado: ['', 'x'], devolvido: ['', 'x']
};
const tagStatus = s => { const [c, i] = TAG_STATUS[s] || ['', 'info']; return `<span class="tag ${c}">${ic(i, 'sm')}${esc(STATUS[s] || s)}</span>`; };
const TAG_RES = { autorizada: ['ok', 'check'], parcial: ['warn', 'halfcircle'], nao: ['bad', 'x'], sem_guia: ['obs', 'mail'] };
const tagResultado = s => s ? `<span class="tag ${TAG_RES[s][0]}">${ic(TAG_RES[s][1], 'sm')}${SIT_ROTULO[s]}</span>` : '';
const TAG_MODO = { bloqueio: ['bad', 'ban', 'Bloqueio'], obs: ['obs', 'message', 'Aviso com observação'], atencao: ['warn', 'alert', 'Atenção'], info: ['', 'info', 'Informativo'], desativado: ['', 'x', 'Desativado'] };
const tagModo = (modo, nivel) => { const k = modo === 'atencao' && nivel === 'info' ? 'info' : modo; const [c, i, t] = TAG_MODO[k]; return `<span class="tag ${c}">${ic(i, 'sm')}${t}</span>`; };
const tagParam = p => p ? `<span class="tag ac">${ic('layers', 'sm')}Parametrizado${p.origem === 'criada' ? ' (criada)' : p.origem === 'aplicada' ? ' (aplicada)' : ''}</span>` : '';
const tagItem = est => ({
  cadastrado: '<span class="tag ok">' + ic('check', 'sm') + 'Cadastrado</span>',
  'sem-cadastro': '<span class="tag obs">' + ic('info', 'sm') + 'Sem cadastro</span>',
  divergente: '<span class="tag warn">' + ic('alert', 'sm') + 'Descrição diverge</span>',
  'sem-clinica': '<span class="tag">' + ic('help', 'sm') + 'Clínica não identificada</span>'
}[est]);
const nomeGuia = g => `${g.pedido.beneficiario || 'Beneficiário não informado'}`;

/* ---------- Aviso de pasta sem sincronizar (aparece em todas as telas até conectar) ---------- */
function pintarSync() {
  const el = document.getElementById('barraSync'); if (!el) return;
  let msg = '', acao = '';
  if (!Pasta.suportado) { msg = 'Este navegador não acessa a pasta compartilhada (use o Chrome ou o Edge). Nada está sincronizando com os colegas: os registros ficam só neste computador.'; }
  else if (!Pasta.handle) { msg = 'Pasta compartilhada não conectada. Nada está sincronizando: colegas não veem este atendimento, o aviso de e-mail já atendido não funciona e os registros ficam só neste computador.'; acao = 'Conectar pasta'; }
  else if (!Pasta.ok) { msg = 'A pasta compartilhada precisa ser reautorizada (um clique por dia). Enquanto isso nada está sincronizando com os colegas.'; acao = 'Reautorizar pasta'; }
  else if (Pasta.erro) { msg = 'A última gravação na pasta compartilhada falhou (' + Pasta.erro + '). Este atendimento pode não ter sincronizado: confira a pasta e reautorize se preciso.'; acao = 'Reautorizar pasta'; }
  const np = Reg.nPendentes(), txtP = np ? `${np} ${np === 1 ? 'atendimento registrado' : 'atendimentos registrados'} só neste computador, aguardando envio para a pasta.` : '';
  if (np && Pasta.ok && !Pasta.erro) msg = txtP + ' Eles não se perdem: são enviados assim que a gravação funcionar.';
  else if (np) msg += ' ' + txtP;
  el.hidden = !msg;
  el.innerHTML = msg ? `${ic('folderx')}<span class="esp">${esc(msg)}</span>${np && Pasta.ok ? `<button class="btn sm" data-act="regSync">${ic('refresh', 'sm')}Enviar agora</button>` : ''}${acao ? `<button class="btn sm" data-act="pasta">${ic('folder', 'sm')}${acao}</button>` : ''}` : '';
}

/* ---------- Visualização (Completa · Simples · Flutuante) e densidade, lembradas por operador neste computador ---------- */
const Vis = {
  chave: k => k + '.' + (LS.get('operadorId', '') || 'x'),
  get() { const v = LS.get(this.chave('vis'), null); if (v) return v; return LS.get('modoSimples', false) || LS.get('topoMini', false) ? 'simples' : 'completa'; },
  set(v) { LS.set(this.chave('vis'), v); },
  simples() { return this.get() === 'simples'; },
  densa() { return LS.get(this.chave('densidade'), 'confortavel') === 'compacta'; }
};
function htmlSeletorVis(compacto) {
  const v = Vis.get() === 'flutuante' && !Mini.aberto() ? 'completa' : Vis.get();
  const b = (k, i, t, d) => `<button type="button" role="radio" aria-checked="${v === k}" class="${v === k ? 'on' : ''}" data-act="visualizacao" data-v="${k}" title="${d}" aria-label="${t}">${ic(i, 'sm')}${compacto ? '' : `<span class="txt-fino">${t}</span>`}</button>`;
  return `<div class="seg seg-vis" role="radiogroup" aria-label="Visualização">${compacto ? '' : '<span class="seg-rot">Visualização</span>'}${b('completa', 'monitor', 'Completa', 'Menu, topo e todos os detalhes')}${b('simples', 'rows', 'Simples', 'Tela única: topo compacto e só o essencial para gerar a guia (monitor pequeno)')}${b('flutuante', 'pip', 'Flutuante', 'Abre uma janelinha que fica por cima do sistema, com os campos para copiar e a captura')}</div>`;
}

/* ---------- Topo e abas ---------- */
/* ---------- Progresso dos operadores (topo compacto) ---------- */
const ROT_ETAPA = { 33: 'lendo o pedido', 66: 'gerando a guia', 100: 'anexando e respondendo' };
/* guias abertas agora: o que cada computador diz que está atendendo (presença, a cada 30 s) + registros em andamento do dia.
   Guia ao vivo nunca some; guia parada (ninguém com ela aberta) some depois de X min sem movimento (Preferências). */
function guiasEmAndamento() {
  const hoje = isoDia(new Date()), lim = cfg.preferencias.acoesMinutos, idade = r => (Date.now() - new Date(r.atualizadoEm || r.abertoEm)) / 60000;
  const mapa = new Map();
  Reg.doDia(hoje).filter(r => !r.tipo && r.status === 'em_andamento').forEach(r => { mapa.set(r.id, { ...r, aoVivo: false, parado: Math.round(idade(r)) }); });
  (Presenca.lista || []).forEach(d => (d.guias || []).forEach(x => { const r = mapa.get(x.id) || {};
    mapa.set(x.id, { ...r, id: x.id, paciente: x.paciente || r.paciente, carteira: x.carteira || r.carteira, clinica: x.clinica || r.clinica, clinicaId: x.clinicaId || r.clinicaId, vista: x.vista, idxGuia: x.idx, totalGuias: x.total, itens: r.itens || Array(x.itens || 0).fill({}), operador: d.operador, operadorId: d.operadorId, aoVivo: true, ativa: x.ativa, desde: x.desde, sinal: d.em, visivel: d.visivel }); }));
  if (S) S.guias.filter(g => !guiaTerminal(g)).forEach(g => { const r = montarRegistro(g, 'em_andamento'); mapa.set(g.id, { ...r, vista: g === guiaAtiva() ? S.vista : (g.vista || g.etapa || 2), aoVivo: true, ativa: g === guiaAtiva(), desde: g === guiaAtiva() ? inicioEtapa() : null, visivel: !document.hidden }); });
  return [...mapa.values()].filter(r => r.aoVivo || !lim || r.parado <= lim).sort((a, b) => (b.aoVivo - a.aoVivo) || ((a.atualizadoEm || '') < (b.atualizadoEm || '') ? 1 : -1));
}
function listaProgresso() {
  const porOp = new Map();
  guiasEmAndamento().sort((a, b) => ((a.atualizadoEm || '') < (b.atualizadoEm || '') ? 1 : -1)).forEach(r => { const k = r.operadorId || r.operador || '?'; if (!porOp.has(k)) porOp.set(k, r); });
  return [...porOp.values()].map(r => {
    const o = cfg.operadores.find(x => x.id === r.operadorId) || cfg.operadores.find(x => x.nome === r.operador) || null;
    const v = r.vista || r.etapa || 2, p = v <= 2 ? 33 : v >= 4 ? 100 : 66;
    const tip = `${r.operador || (o && o.nome) || 'Operador'}: ${r.paciente || r.pacienteIni || 'beneficiário'} × ${r.clinica || r.remetente || 'clínica não identificada'}${(r.totalGuias || 1) > 1 ? ` (guia ${(r.idxGuia || 0) + 1} de ${r.totalGuias})` : ''} · ${ROT_ETAPA[p]} (${p}%)`;
    return { o, p, tip };
  });
}
function pintarProgresso() {
  const el = $('#topoProg'); if (!el) return;
  const L = listaProgresso();
  el.innerHTML = L.length ? L.map(x => `<span class="prog" role="img" style="--p:${x.p};${x.o ? estiloOp(x.o) : ''}" title="${esc(x.tip)}" aria-label="${esc(x.tip)}"><span class="pe">${x.o ? glifo(x.o.icone) : ic('user', 'sm')}</span></span>`).join('')
    : `<span class="prog" role="img" style="--p:0" title="Nenhum atendimento em andamento" aria-label="Nenhum atendimento em andamento"><span class="pe">${ic('user', 'sm')}</span></span>`;
}
setInterval(async () => { if (document.hidden || !Vis.simples()) return; try { await Reg.carregar(); await Presenca.ler(); pintarProgresso(); } catch (e) { } }, 20000);   // relê a presença: os outros computadores mudam de guia e de etapa
const extInstalada = () => document.documentElement.dataset.conferidorExt || '';
const EXT_VERSAO = '1.2.0';   // versão da extensão publicada junto com o site
const extDesatualizada = () => { const v = extInstalada(); if (!v) return false; const a = v.split('.').map(Number), b = EXT_VERSAO.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); } return false; };
function renderTopo() {
  const op = operadorObj(), hoje = new Date();
  const dataTxt = aba === 'painel' ? (painelModo === 'mes' ? 'Mês: ' + painelMes.split('-').reverse().join('/') : painelModo === 'semana' ? 'Semana: ' + rotuloSemana(painelSemana) : 'Dia: ' + diaBR(painelDia)) : fmtData(hoje);
  const pasta = !Pasta.suportado ? { c: 'alerta', i: 'alert', t: 'Use o Chrome ou Edge', d: 'Este navegador não permite acessar a pasta compartilhada.' }
    : Pasta.ok ? { c: 'ok', i: 'folder', t: 'Pasta: ' + Pasta.handle.name, d: 'Pasta compartilhada conectada. Configurações e registros ficam nela.' }
      : Pasta.handle ? { c: 'alerta', i: 'folder', t: 'Reautorizar pasta', d: 'A pasta lembrada precisa de autorização (um clique por dia).' }
        : { c: 'alerta', i: 'folderx', t: 'Pasta não conectada', d: 'Sem a pasta, os registros ficam só neste computador e não há visão conjunta entre operadores.' };
  const escuro = Tema.efetivo() === 'dark';
  const mini = Vis.simples(), cab = document.querySelector('header.topo');
  document.body.classList.toggle('topo-mini', mini);
  document.body.classList.toggle('densa', Vis.densa());
  cab.style.cssText = mini && op ? estiloOp(op) : '';
  const nivel = !Pasta.suportado ? 'bad' : Pasta.ok ? 'ok' : Pasta.handle ? 'warn' : 'bad';
  if (mini) pintarProgresso();
  if (mini) {
    $('#topoAcoes').innerHTML = `
    <label class="chip chip-op mini-op" title="Operador">${htmlAvatar(op)}<select id="operador" aria-label="Operador"><option value="">Escolher operador</option>${cfg.operadores.map(o => `<option value="${esc(o.id)}" ${op && op.id === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
    <button class="chip mini-btn" data-act="pasta" title="${esc(pasta.t + ': ' + pasta.d)}" aria-label="${esc(pasta.t)}"><span class="luz ${nivel}"></span></button>
    ${htmlSistemaTopo(true)}${htmlSeletorVis(true)}`;
    $('#abas').innerHTML = '';
    document.title = 'Conferidor de Guias · Promédica';
    return;
  }
  $('#topoAcoes').innerHTML = `
    <label class="chip chip-op" style="${op ? estiloOp(op) : ''}" title="Operador (identificação de contexto e registro)">${htmlAvatar(op)}<select id="operador" aria-label="Operador">
      <option value="">Escolher operador</option>${cfg.operadores.map(o => `<option value="${esc(o.id)}" ${op && op.id === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
    <button class="chip pasta ${pasta.c}" data-act="pasta" title="${esc(pasta.d)}" aria-label="${esc(pasta.t)}"><span class="luz ${nivel}"></span><span class="txt-fino">${esc(pasta.t)}</span></button>
    ${extDesatualizada() ? `<button class="chip pasta alerta" data-act="baixarExtensao" title="A extensão instalada (v${esc(extInstalada())}) é mais antiga que a do site (v${EXT_VERSAO}). Baixe a nova e recarregue em chrome://extensions." aria-label="Atualizar extensão">${ic('download', 'sm')}<span class="txt-fino">Atualizar extensão</span></button>` : extInstalada() ? `<span class="chip pasta ok" title="Extensão do Chrome instalada (v${esc(extInstalada())}): use o botão flutuante no webmail" aria-label="Extensão instalada">${ic('check', 'sm')}${ic('mail', 'sm')}</span>` : `<button class="chip" data-act="baixarExtensao" title="Baixar a extensão do Chrome (abre o e-mail do webmail aqui com um clique)" aria-label="Baixar extensão">${ic('download', 'sm')}</button>`}
    <button class="chip tema" data-act="alternarTema" title="${escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}" aria-label="${escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}">${ic(escuro ? 'sun' : 'moon', 'sm')}</button>
    ${htmlSistemaTopo(false)}
    ${htmlSeletorVis(false)}`;
  const temLista = Lista.listas.length || cfg.clinicas.some(c => c.lista || /erasmo/i.test(c.nome)), pendL = Lista.pendentesMeus();
  $('#abas').innerHTML = [['atend', 'filecheck', 'Atendimento'], ...(temLista ? [['lista', 'rows', Lista.nomeCurto()]] : []), ['quadro', 'activity', 'Acompanhamento'], ['painel', 'chart', 'Painel do dia'], ['config', 'settings', 'Configurações']]
    .map(([k, i, t]) => `<button data-act="aba" data-aba="${k}" class="${aba === k ? 'ativo' : ''}" title="${t}" ${aba === k ? 'aria-current="page"' : ''}>${ic(i)}<span class="txt-fino">${t}</span>${k === 'lista' && pendL ? ` <span class="tag warn">${pendL}</span>` : ''}</button>`).join('')
    + (pendL && aba !== 'lista' ? `<span class="esp" style="flex:1"></span><button class="btn sm lst-continuar" data-act="irLista" title="Suas guias pendentes da lista do dia">${ic('right', 'sm')}Continuar ${esc(Lista.nomeCurto())} (${pendL})</button>` : '');
  $('#verRodape').textContent = 'v' + VERSAO;
  document.title = 'Conferidor de Guias · Promédica';
}

/* ---------- Editor de texto rico ---------- */
const CORES_TEXTO = [['#b91c1c', 'Vermelho'], ['#c2410c', 'Laranja'], ['#15803d', 'Verde'], ['#1d4f91', 'Azul'], ['#6d28d9', 'Roxo'], ['#475569', 'Cinza']];
function htmlEditor({ id, valor, rico = true, minAltura = 200 }) {
  const barra = rico ? `<div class="ed-barra" role="toolbar" aria-label="Formatação do texto">
    <button type="button" class="btn sm line" data-cmd="bold" title="Negrito (Ctrl+B)" aria-label="Negrito">${ic('bold', 'sm')}<span class="sr">Negrito</span></button>
    <button type="button" class="btn sm line" data-cmd="italic" title="Itálico (Ctrl+I)" aria-label="Itálico">${ic('italic', 'sm')}<span class="sr">Itálico</span></button>
    <span class="sep"></span>
    <button type="button" class="btn sm line" data-cmd="insertUnorderedList" title="Lista com marcadores" aria-label="Lista com marcadores">${ic('list', 'sm')}Lista</button>
    <button type="button" class="btn sm line" data-cmd="insertOrderedList" title="Lista numerada" aria-label="Lista numerada">${ic('listnum', 'sm')}Numerada</button>
    <span class="sep"></span>
    <span class="ed-cores" title="Cor do texto">${ic('textcolor', 'sm')}${CORES_TEXTO.map(([c, n]) => `<button type="button" class="ed-cor" data-cor="${c}" style="background:${c}" title="Texto ${n}" aria-label="Cor ${n}"></button>`).join('')}</span>
    <span class="sep"></span>
    <button type="button" class="btn sm ghost" data-cmd="removeFormat" title="Limpar formatação da seleção">${ic('undo', 'sm')}Limpar formatação</button>
  </div>` : '';
  return `${barra}<div class="ed ${rico ? '' : 'solo'}" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" style="min-height:${minAltura}px" data-rico="${rico ? 1 : 0}">${valor}</div>`;
}
function serializarEditor(el, comoModelo) {
  const c = el.cloneNode(true);
  c.querySelectorAll('mark.lacuna').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
  c.querySelectorAll('.tok').forEach(t => t.replaceWith(document.createTextNode('{' + t.dataset.k + '}')));
  return sanitizar(c.innerHTML);
}
/* Converte {CAMPO} em "etiquetas" legíveis no editor de modelos */
function htmlComEtiquetas(html) {
  return html.replace(/\{([A-Z_]+)\}/g, (m, k) => CAMPO[k] ? `<span class="tok" contenteditable="false" data-k="${k}" title="${esc(CAMPO[k].desc)}">${esc(CAMPO[k].nome)}</span>` : `<span class="tok desc" contenteditable="false" data-k="${k}" title="Campo desconhecido">${esc(k)}</span>`);
}
let selSalva = null;
document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest('.ed')) selSalva = s.getRangeAt(0).cloneRange(); });
function inserirNoEditor(el, html) {
  el.focus();
  if (selSalva && el.contains(selSalva.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(selSalva); }
  else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.execCommand('insertHTML', false, html);
}
document.addEventListener('mousedown', e => { if (e.target.closest('.ed-barra .btn, .ed-cor')) e.preventDefault(); });
document.addEventListener('paste', e => {
  const ed = e.target.closest && e.target.closest('.ed'); if (!ed) return;
  e.preventDefault();
  const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain');
  if (ed.dataset.rico === '1' && h) document.execCommand('insertHTML', false, sanitizar(h));
  else document.execCommand('insertText', false, t);
});

/* ---------- Alertas (painel abaixo do conteúdo) ---------- */
function htmlUmAlerta(a, g) {
  let extra = '';
  if (a.vincular) extra += `<select id="selClinica" class="sel-busca" aria-label="Clínica do remetente"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(cl => `<option data-busca="${esc(buscaClinica(cl))}" value="${cl.id}" ${cl.id === S.clinicaSugerida ? 'selected' : ''}>${esc(cl.nome)}</option>`).join('')}</select><button class="btn sm" data-act="vincularClinica">${ic('check', 'sm')}Vincular e salvar e-mail no cadastro</button><button class="btn sm line" data-act="clinicaSoAgora">Só para este e-mail</button>`;
  if (a.acaoCarteira) extra += `<button class="btn sm" data-act="respSemGuia" data-modelo="carteira_nao_localizada">${ic('mail', 'sm')}Não localizei: responder</button><button class="btn sm" data-act="respSemGuia" data-modelo="nome_carteira">${ic('mail', 'sm')}Nome e carteira não conferem: responder</button>`;
  if (a.aprendidoI != null) extra += `<button class="btn sm" data-act="aplicarAprendido" data-i="${a.aprendidoI}">${ic('check', 'sm')}Aplicar a mesma correção</button>`;
  if (a.cadastrarCodigo) extra += `<button class="btn sm" data-act="cadastrarCodigo" data-codigo="${a.cadastrarCodigo}">${ic('plus', 'sm')}Cadastrar código</button>`;
  const conferido = pedeConferi(a) && g.conf && g.conf[a.key];
  if (pedeConferi(a)) extra += `<button type="button" class="btn sm conferi-btn ${conferido ? 'on' : ''}" data-act="conferiAlerta" data-conf="${esc(a.key)}" aria-pressed="${conferido ? 'true' : 'false'}">${ic('check', 'sm')}${conferido ? 'Conferido' : 'Conferi'}</button>`;
  if (a.modo === 'obs') extra += `<span class="muted" style="font-size:var(--fs-xs)">Texto em “Incluir observação” (observações adicionais da resposta).</span>`;
  const ico = a.modo === 'bloqueio' ? 'ban' : a.modo === 'obs' ? 'message' : a.nivel === 'info' ? 'info' : 'alert';
  return `<div class="al ${a.modo === 'atencao' && a.nivel === 'info' ? 'info' : a.modo} ${conferido ? 'conferido' : ''}"><span>${ic(conferido ? 'check' : ico, 'sm')}</span><div class="tx"><b class="al-t">${a.modo === 'bloqueio' ? 'Bloqueio:' : a.modo === 'obs' ? 'Aviso com observação:' : a.nivel === 'info' ? 'Informativo:' : 'Atenção:'}</b> ${esc(a.texto)}</div>${extra ? `<div class="acoes-al">${extra}</div>` : ''}</div>`;
}
function htmlAlertas(g, st) {
  const ordem = a => ({ bloqueio: 0, obs: 1, atencao: 2 }[a.modo]);
  const principais = st.A.filter(a => !(a.modo === 'atencao' && a.nivel === 'info')).sort((a, b) => ordem(a) - ordem(b));
  const infos = st.A.filter(a => a.modo === 'atencao' && a.nivel === 'info');
  const l1 = principais.map(a => htmlUmAlerta(a, g)).join('');
  const l2 = infos.length ? `<details class="al-infos"><summary>${pl(infos.length, 'informativo', 'informativos')}</summary><div class="alertas">${infos.map(a => htmlUmAlerta(a, g)).join('')}</div></details>` : '';
  return (l1 || l2) ? l1 + l2 : `<div class="al info"><span>${ic('check', 'sm')}</span><div class="tx">Nenhum alerta para esta guia.</div></div>`;
}
function htmlPainelAlertas(g, st) {
  const tot = st.A.filter(pedeConferi).length, pend = atencaoPendente(g, st).length;
  return `<section class="card painel-al compacto ${st.bloqueios.length ? 'tem-bloqueio' : ''}" aria-label="Alertas e ocorrências">
    <div class="al-h">${ic(st.bloqueios.length ? 'ban' : 'bell')}<h2>Alertas e ocorrências</h2>
      ${st.bloqueios.length ? `<span class="tag bad">${ic('ban', 'sm')}${pl(st.bloqueios.length, 'bloqueio', 'bloqueios')}</span>` : '<span class="tag ok">' + ic('check', 'sm') + 'Sem bloqueios</span>'}
      ${st.obs.length ? `<span class="tag obs">${ic('message', 'sm')}${st.obs.length} com observação</span>` : ''}
      ${tot ? (pend ? `<span class="tag warn">${ic('alert', 'sm')}${pend} a conferir</span>` : `<span class="tag ok">${ic('check', 'sm')}Conferido</span>`) : ''}</div>
    <div class="al-corpo"><div class="alertas" id="alertas">${htmlAlertas(g, st)}</div></div></section>`;
}

/* ---------- Instrução curta + "Como fazer" (aberto nos primeiros 5 dias de uso neste computador) ---------- */
function comoFazerAberto(chave) {
  const p = LS.get('como.' + chave, null); if (p != null) return p;
  let ini = LS.get('primeiroUso', ''); if (!ini) { ini = isoDia(new Date()); LS.set('primeiroUso', ini); }
  return (Date.now() - new Date(ini + 'T12:00')) / 864e5 < 5;
}
const htmlComoFazer = (chave, frase, detalhe) => `<div class="como"><p class="dica">${frase}</p><details data-como="${chave}" ${comoFazerAberto(chave) ? 'open' : ''}><summary>Como fazer</summary><div class="como-d">${detalhe}</div></details></div>`;
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.como) LS.set('como.' + d.dataset.como, d.open); }, true);

/* ---------- Barra de ação fixa no rodapé: ← Voltar | estado (ver) | Seguir → ---------- */
const curtoTxt = (t, n = 110) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
function statusBarra(g, st, pend) {
  const ver = `<button class="btn link" data-act="verAlertas">ver</button>`;
  if (st.bloqueios.length) return `<span class="tag bad">${ic('ban', 'sm')}${pl(st.bloqueios.length, 'bloqueio', 'bloqueios')}</span><span class="barra-msg" title="${esc(st.bloqueios.map(b => b.texto).join('\n'))}">${esc(curtoTxt(st.bloqueios[0].texto))}</span>${ver}`;
  if (pend && pend.length) return `<span class="tag warn">${ic('alert', 'sm')}${pl(pend.length, 'pendência', 'pendências')}</span><span class="barra-msg" title="${esc(pend.join('\n'))}">${esc(curtoTxt(pend[0]))}</span>`;
  const conf = atencaoPendente(g, st).length;
  if (conf) return `<span class="tag warn">${ic('alert', 'sm')}${conf} a conferir</span><span class="barra-msg">Marque “Conferi” nos avisos depois de conferir.</span>${ver}`;
  return `<span class="tag ok">${ic('check', 'sm')}Tudo certo para seguir</span>`;
}
function htmlBarraAcao({ voltar = '', seguir = '', status = '' }) {
  return `<div class="barra-acao" role="region" aria-label="Ações da etapa">${voltar}<div class="barra-st">${status}</div>${seguir}</div>`;
}

/* ---------- Barra de guias e etapas ---------- */
function htmlBarraGuias() {
  if (S.guias.length < 2) return '';
  return `<div class="guias-bar" role="tablist" aria-label="Guias deste e-mail">${S.guias.map((g, i) => {
    const st = guiaTerminal(g) ? null : situacaoGuia(g);
    return `<button class="guia-tab ${i === S.ativa && S.vista > 1 ? 'ativa' : ''}" role="tab" aria-selected="${i === S.ativa}" data-act="selGuia" data-i="${i}">
      <span class="sq lg idc idc-${i % 10}">${i + 1}</span><span style="min-width:0"><span class="t1" style="display:block">${esc(nomeGuia(g))}</span>
      <span class="t2">${pl(g.pedido.itens.length, 'item', 'itens')} · ${g.status === 'concluido' ? tagResultado(g.resultado.situacao) : tagStatus(g.status)}${st && st.bloqueios.length ? ` <span class="tag bad">${ic('ban', 'sm')}${st.bloqueios.length}</span>` : ''}</span></span></button>`;
  }).join('')}</div>`;
}
function htmlPassos(g) {
  const st = situacaoGuia(g), v = S.vista, fin = g.status === 'concluido';
  const cegaPend = cegaExigida() && g.cega.iniciada && g.cega.resultado && !g.cega.resultado.ok;
  /* nome da etapa fixo; o estado vai num selo (s = texto, c = cor do selo) */
  const nb = st.bloqueios.length;
  const def = [
    { n: 1, t: 'E-mail', e: v === 1 ? 'atual' : 'feito', s: v === 1 ? 'Agora' : 'Concluída', c: v === 1 ? 'info' : 'ok', ok: true },
    { n: 2, t: 'Pedido e alertas', e: v === 2 && !nb ? 'atual' : nb ? (v === 2 ? 'atual atencao' : 'atencao') : (g.etapa > 2 || fin ? 'feito' : 'futuro'), s: nb ? pl(nb, 'bloqueio', 'bloqueios') : v === 2 ? 'Agora' : g.etapa > 2 || fin ? 'Concluída' : 'Pendente', c: nb ? 'bad' : v === 2 ? 'info' : g.etapa > 2 || fin ? 'ok' : '', ok: true },
    { n: 3, t: 'Guia e conferência', e: v === 3 ? 'atual' : cegaPend ? 'atencao' : ((g.cega.ok || !cegaExigida()) && g.etapa > 3) || fin ? 'feito' : 'futuro', s: !st.pode ? 'Bloqueada' : cegaPend ? 'Divergente' : v === 3 ? 'Agora' : g.cega.ok || fin ? 'Conferida' : 'Pendente', c: !st.pode ? '' : cegaPend ? 'warn' : v === 3 ? 'info' : g.cega.ok || fin ? 'ok' : '', ok: st.pode },
    { n: 4, t: 'Finalizar', e: v === 4 ? 'atual' : fin ? 'feito' : 'futuro', s: fin ? 'Concluída' : v === 4 ? 'Agora' : !podeFinal(g, st) ? 'Falta conferir' : 'Pendente', c: fin ? 'ok' : v === 4 ? 'info' : '', ok: podeFinal(g, st) || fin }
  ];
  return `<nav class="passos" aria-label="Etapas do atendimento">${def.map(d => `<button class="passo ${d.e}" data-act="irVista" data-v="${d.n}" ${d.ok ? '' : 'disabled'} ${/atual/.test(d.e) ? 'aria-current="step"' : ''} title="${esc('Etapa ' + d.n + ': ' + d.t + ' — ' + d.s)}">
    <span class="bola">${d.e === 'feito' ? ic('check', 'sm') : /atencao/.test(d.e) ? ic('alert', 'sm') : d.n}</span>
    <span class="tx"><small>Etapa ${d.n}</small><b>${d.t}</b></span><span class="tag ${d.c} passo-selo">${esc(d.s)}</span></button>`).join('')}</nav>`;
}

/* ---------- Tela principal do atendimento ---------- */
/* Redesenho seguro:
   - durante um clique (botão do mouse apertado) a tela não é trocada: se trocasse, o botão sob o mouse sumiria e o clique se perderia;
   - logo depois de editar um campo (evento change), espera o foco ir para o próximo campo;
   - depois de redesenhar, devolve o foco, o cursor e a rolagem das listas internas, se a tela for a mesma. */
const Redesenho = { baixo: false, pendente: false, t: 0, gen: 0 };   // gen: conta os redesenhos; tela que carrega algo antes de pintar só pinta se ainda for a última
document.addEventListener('pointerdown', e => { if (e.button === 0 && e.isPrimary !== false) Redesenho.baixo = true; }, true);
document.addEventListener('click', () => { Redesenho.baixo = false; }, true);
['pointerup', 'pointercancel'].forEach(tp => document.addEventListener(tp, () => setTimeout(() => { Redesenho.baixo = false; if (Redesenho.pendente) render(); }, 0), true));
window.addEventListener('blur', () => { if (Redesenho.baixo) { Redesenho.baixo = false; if (Redesenho.pendente) setTimeout(render, 0); } });
const SEL_ROLAGEM = '.tabela-scroll, .lista-cl, pre.original, .col-fixa, .lst-fila';
const chaveTela = () => [aba, S ? S.vista : 0, S ? S.ativa : 0, aba === 'config' ? cfgSecao : '', aba === 'lista' ? Lista.sub : ''].join('|');
const ATR_FOCO = ['data-campo', 'data-cpcampo', 'data-act', 'data-cfg', 'data-ei', 'data-cega', 'data-i', 'data-codigo', 'data-tipo', 'data-k', 'data-v', 'data-item', 'name'];
function chaveFoco(el) { if (el.id) return '#' + CSS.escape(el.id); const k = ATR_FOCO.map(a => el.getAttribute(a) != null ? `[${a}="${CSS.escape(el.getAttribute(a))}"]` : '').join(''); return k ? el.tagName.toLowerCase() + k : ''; }
function guardarEstadoTela(app) {
  const st = { tela: chaveTela(), rol: [...app.querySelectorAll(SEL_ROLAGEM)].map(e => e.scrollTop) }, ae = document.activeElement;
  if (ae && ae !== document.body && app.contains(ae)) st.foco = { chave: chaveFoco(ae), s: ae.selectionStart, e: ae.selectionEnd };
  return st;
}
function restaurarEstadoTela(app, st) {
  if (!st || st.tela !== chaveTela()) return;
  const nos = [...app.querySelectorAll(SEL_ROLAGEM)]; if (nos.length === st.rol.length) nos.forEach((n, i) => { if (st.rol[i]) n.scrollTop = st.rol[i]; });
  const ae = document.activeElement;
  if (st.foco && st.foco.chave && (!ae || ae === document.body || !document.contains(ae))) {
    let n = null; try { n = app.querySelector(st.foco.chave); } catch (e) { n = null; }
    if (n && typeof n.focus === 'function' && !n.disabled) { n.focus({ preventScroll: true }); try { if (st.foco.s != null && n.setSelectionRange && /^(text|search|email|tel|password|number)?$/.test(n.type || '')) n.setSelectionRange(st.foco.s, st.foco.e); } catch (e) { } }
  }
}
function render() {
  const ev = window.event;
  if (Redesenho.baixo || (ev && ev.type === 'change')) {
    Redesenho.pendente = true;
    if (!Redesenho.baixo) { clearTimeout(Redesenho.t); Redesenho.t = setTimeout(() => { if (Redesenho.pendente && !Redesenho.baixo) render(); }, 0); }
    return;
  }
  Redesenho.pendente = false; clearTimeout(Redesenho.t); Redesenho.gen++;
  try { if (typeof inicioEtapa === 'function') inicioEtapa(); } catch (e) { }   // trocou de guia: o tempo da etapa começa de novo (atendimento com defeito vai para a tela de erro abaixo)
  if (typeof Dica !== 'undefined') Dica.esconder();
  const app = $('#app'), antes = guardarEstadoTela(app);
  try { renderTopo(); pintarSync(); } catch (e) { console.error(e); window.__erros && window.__erros.push('Topo: ' + (e.stack || e.message)); }
  document.body.dataset.pronto = '1';
  if (typeof Presenca !== 'undefined' && Presenca.agendar) Presenca.agendar();
  queueMicrotask(() => Mini.atualizar());   // painel flutuante acompanha o atendimento
  try {
    const r = renderTela(app);
    if (r && r.then) return r.then(v => { restaurarEstadoTela(app, antes); return v; }, e => mostrarErroTela(app, e));
    restaurarEstadoTela(app, antes);
    return r;
  } catch (e) { mostrarErroTela(app, e); }
}
/* uma tela que falha mostra o erro (e como sair dele) em vez de ficar em branco */
function mostrarErroTela(app, e) {
  console.error(e);
  const det = `${e && e.stack || e}\n\nVersão ${VERSAO} · ${navigator.userAgent}`;
  app.innerHTML = `<div class="card"><div class="card-h"><h2>${ic('alert')} Esta tela não abriu</h2></div>
    <p>Algo nos dados desta tela causou um erro. Você pode voltar ao início ou descartar o atendimento aberto (ele continua registrado como em andamento). Envie os detalhes ao suporte.</p>
    <pre class="original" style="max-height:220px">${esc(det)}</pre>
    <div class="acoes"><button class="btn" data-act="erroInicio">${ic('left')}Ir para o início</button><button class="btn line" data-act="erroCopiar">${ic('copy', 'sm')}Copiar detalhes</button>${S ? `<button class="btn dng" data-act="erroSemAtend">${ic('trash', 'sm')}Fechar o atendimento aberto</button>` : ''}</div></div>`;
  window.__ultimoErro = det;
}
function renderTela(app) {
  if (aba === 'lista') return Lista.render(app);
  if (aba === 'painel') return renderPainel(app);
  if (aba === 'quadro') return renderQuadro(app);
  if (aba === 'config') return renderConfig(app);
  if (!S) return renderEntrada(app);
  const g = guiaAtiva();
  const alvoId = 'etapa';
  app.innerHTML = htmlAvisoParado() + htmlAvisoReaberta(g) + htmlBarraGuias() + (S.vista === 1 ? '' : htmlPassos(g) + htmlNotasFixas(g)) + `<div id="${alvoId}"></div>`;
  const alvo = $('#' + alvoId);
  if (S.vista === 1) renderVisao(alvo); else if (g.status === 'concluido' && S.vista === 4) renderConcluida(alvo, g);
  else if (S.vista === 2) renderPedido(alvo, g); else if (S.vista === 3) renderGuia(alvo, g); else renderFinal(alvo, g);
}
function renderEntrada(app) {
  const semOp = !operador();
  app.innerHTML = `
  ${semOp ? `<div class="aviso">${ic('user')}<div>Escolha seu nome em <b>Operador</b>, no topo, antes de começar.</div></div>` : ''}
  ${!Pasta.ok ? `<div class="aviso">${ic('folderx')}<div>${Pasta.handle ? 'A pasta compartilhada precisa ser reautorizada (um clique por dia).' : 'A pasta compartilhada não está conectada: os registros ficam só neste computador e não há visão conjunta entre operadores.'}</div><span class="acoes"><button class="btn sm" data-act="pasta">${ic('folder', 'sm')}${Pasta.handle ? 'Reautorizar pasta' : 'Conectar pasta'}</button></span></div>` : ''}
  ${ultimoConcluido ? `<div class="ultimo">${ic('check')}<div>Último registrado: <b>${esc(ultimoConcluido.texto)}</b> às ${fmtHora(ultimoConcluido.em)}.</div></div>` : ''}
  ${extInstalada() ? `<div class="vazio aguardando" id="zona">
    <div class="ico">${ic('mail', 'xl')}</div>
    <h2>Aguardando e-mail do webmail…</h2>
    <p>Abra o e-mail no webmail e clique em <b>Abrir no conferidor</b>, o botão no canto da tela. Ele chega aqui sozinho.</p>
    <button class="btn line sm" data-act="escolherEml">${ic('upload', 'sm')}Ou envie o arquivo .eml</button>
  </div>` : `<div class="vazio" id="zona">
    <div class="ico">${ic('upload', 'xl')}</div>
    <h2>Nenhum pedido carregado</h2>
    ${htmlComoFazer('upload', 'Arraste aqui o .eml do e-mail que você vai atender ou escolha o arquivo.', `<p>No SmarterMail: abra o e-mail › menu ⋮ › baixar/salvar como .eml. Um e-mail pode ter de 1 a ${MAX_BENEFICIARIOS} beneficiários; cada um gera uma guia. Com a extensão do Chrome (ícone de download no topo), o e-mail vem com um clique, sem baixar arquivo.</p>`)}
    <button class="btn pri" data-act="escolherEml">${ic('upload')}Fazer upload do e-mail (.eml)</button>
  </div>`}
  <div class="card">
    <details>
      <summary>Sem o arquivo? Colar o texto do e-mail</summary>
      <div class="form-grid">
        <div><label class="lbl" for="coladoDe">E-mail do remetente</label><input type="text" id="coladoDe" placeholder="contato@clinica.com.br"></div>
        <div style="grid-column:1/-1"><label class="lbl" for="coladoTxt">Corpo do e-mail</label><textarea id="coladoTxt" rows="9"></textarea></div>
      </div>
      <div class="acoes"><button class="btn" data-act="usarColado">${ic('filecheck')}Ler texto colado</button></div>
    </details>
  </div>`;
  const z = $('#zona');
  z.addEventListener('dragover', ev => { ev.preventDefault(); z.classList.add('sobre'); });
  z.addEventListener('dragleave', () => z.classList.remove('sobre'));
  z.addEventListener('drop', ev => { ev.preventDefault(); z.classList.remove('sobre'); const f = ev.dataTransfer.files[0]; if (f) abrirArquivo(f); });
}
/* Realça no texto do e-mail o que foi lido: códigos, carteira, beneficiário, médico, CID e data (cores iguais às dos campos) */
function realceEmail() {
  const e = S.email, txt = String(e.textoPrincipal || ''), usados = new Set(S.guias.flatMap(g => g.pedido.itens.map(i => i.codigo)));
  const marcas = [], rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of txt.matchAll(/(?<!\d)(\d{8})(?!\d)/g)) marcas.push({ ini: m.index, fim: m.index + 8, cls: usados.has(m[1]) ? 'm-ok' : 'm-warn' });
  const achar = (val, cls, campo, gi) => {
    val = String(val || '').trim(); if (val.length < 2) return;
    const re = new RegExp(val.split(/\s+/).map(rx).join('\\s+'), 'gi'); let m;
    while ((m = re.exec(txt))) { const a = m.index, b = a + m[0].length; if (!marcas.some(x => a < x.fim && x.ini < b)) { marcas.push({ ini: a, fim: b, cls, campo, gi }); return; } if (!m[0].length) break; }
  };
  S.guias.forEach((g, gi) => { const p = g.pedido; achar(p.carteiraBruta, 'm-cart', 'cart', gi); achar(p.beneficiario, 'm-benef', 'benef', gi); achar(p.medico.bruto, 'm-med', 'medico', gi); if (!marcas.some(x => x.campo === 'medico' && x.gi === gi)) achar(p.medico.nome, 'm-med', 'medico', gi); achar(p.cid, 'm-cid', 'cid', gi); achar(p.emissao && p.emissao.bruto, 'm-data', 'data', gi); });
  marcas.sort((a, b) => a.ini - b.ini);
  let html = '', pos = 0;
  for (const m of marcas) { if (m.ini < pos) continue; html += esc(txt.slice(pos, m.ini)) + `<mark class="${m.cls}"${m.campo ? ` data-mcampo="${m.campo}" data-g="${m.gi}"` : ''}>${esc(txt.slice(m.ini, m.fim))}</mark>`; pos = m.fim; }
  html += esc(txt.slice(pos));
  if (e.cortado && e.restante) html += `\n\n<span class="hist">${esc(e.restante)}</span>`;
  return html;
}
/* passar o mouse (ou o foco) num campo acende o trecho correspondente no e-mail */
function acenderTrecho(campo) {
  $$('pre.original mark.acende').forEach(m => m.classList.remove('acende'));
  if (!campo || !S) return;
  const m = $(`pre.original mark[data-mcampo="${campo}"][data-g="${S.ativa}"]`); if (!m) return;
  m.classList.add('acende');
  const cx = m.closest('.col-fixa') || m.closest('pre.original');
  if (cx) { const r = m.getBoundingClientRect(), c = cx.getBoundingClientRect(); if (r.top < c.top + 10 || r.bottom > c.bottom - 10) cx.scrollTop += r.top - c.top - c.height / 3; }
}
['mouseover', 'focusin'].forEach(t => document.addEventListener(t, ev => { const el = ev.target.closest && ev.target.closest('[data-mcampo]:not(mark)'); if (el) acenderTrecho(el.dataset.mcampo); }));
['mouseout', 'focusout'].forEach(t => document.addEventListener(t, ev => { const el = ev.target.closest && ev.target.closest('[data-mcampo]:not(mark)'); if (el && !(ev.relatedTarget && el.contains(ev.relatedTarget))) acenderTrecho(null); }));
function htmlUltimaGuia() {
  const cl = clinicaDe(S), linhas = [], vistos = new Set();
  S.guias.forEach(g => {
    const cart = g.carteiraUsada || g.pedido.carteira; if (!cart || vistos.has(cart)) return; vistos.add(cart);
    const r = Reg.ultimaGuia(cart, S.atendId); if (!r) return;
    const outra = r.clinicaId && cl && r.clinicaId !== cl.id || (!cl && r.clinica);
    linhas.push(`<div class="ult-linha">${S.guias.length > 1 ? `<span class="muted">${esc(nomeGuia(g))}:</span> ` : ''}<b class="num">${esc(r.guia)}</b> <span class="muted">· ${fmtData(r.concluidoEm)}</span>${outra ? ` <span class="tag obs">${ic('building', 'sm')}${esc(r.clinica)}</span>` : ''}</div>`);
  });
  return linhas.length ? `<div class="ult-guia">${ic('clip')}<div><div class="eyebrow">Última guia gerada para ${vistos.size > 1 ? 'estes beneficiários' : 'este beneficiário'}</div>${linhas.join('')}</div></div>` : '';
}
function htmlEmailCard() {
  const e = S.email, cl = clinicaDe(S);
  return `${htmlUltimaGuia()}<div class="card"><div class="card-h"><h2>E-mail recebido</h2></div>
    <dl class="email-meta">
      <dt>De</dt><dd>${esc(e.remetente.nome)} <span class="num">&lt;${esc(e.remetente.email)}&gt;</span> ${cl ? htmlClinica(cl) : `<span class="tag obs">${ic('info', 'sm')}Remetente não cadastrado</span>`}</dd>
      <dt>Recebido</dt><dd>${fmtDH(e.data)}</dd>
      <dt>Assunto</dt><dd>${esc(e.assunto)}</dd>
      ${e.anexos.length ? `<dt>Anexos</dt><dd><span class="tag info">${ic('clip', 'sm')}${pl(e.anexos.length, 'anexo', 'anexos')}</span> ${esc(e.anexos.join(', '))}</dd>` : ''}
    </dl>
    <pre class="original">${realceEmail()}</pre>
    <p class="dica legenda-mk" style="margin-top:8px"><mark class="m-ok">código lido</mark> <mark class="m-warn">8 dígitos não usados</mark> <mark class="m-cart">carteira</mark> <mark class="m-benef">beneficiário</mark> <mark class="m-med">médico</mark> <mark class="m-cid">CID</mark> <mark class="m-data">data</mark> · passe o mouse num campo para achar o trecho.</p></div>`;
}
function renderVisao(alvo) {
  const todas = S.guias.every(guiaTerminal), multi = S.guias.length > 1;
  alvo.innerHTML = `<div class="stack">
  ${htmlEmailCard()}
  <div class="card"><div class="card-h"><h2>${multi ? `Guias deste e-mail (${S.guias.length})` : 'Solicitação deste e-mail'}</h2><span class="esp"></span>${multi ? `<span class="tag ${S.guias.filter(g => g.pedido && chaveBenef(g.pedido)).length ? 'ac' : ''}">${ic('user', 'sm')}${pl(unicos(S.guias.map(g => g.chave)).length, 'beneficiário diferente', 'beneficiários diferentes')}</span>` : ''}</div>
    
    <div class="tabela-scroll"><table class="t"><thead><tr><th>Guia</th><th>Beneficiário</th><th>Carteira</th><th>Serviços (código × qtd.)</th><th>Estado</th><th>Alertas</th><th></th></tr></thead><tbody>
    ${S.guias.map((g, i) => { const st = situacaoGuia(g); return `<tr><td class="c"><span class="sq idc idc-${i % 10}">${i + 1}</span></td><td class="pri">${esc(nomeGuia(g))}</td><td class="num">${esc(g.carteiraUsada || g.pedido.carteiraBruta || '—')}</td>
      <td class="num">${g.pedido.itens.map(it => `${it.codigo} × ${it.qtd ?? '?'}`).join('<br>') || '—'}</td>
      <td>${g.status === 'concluido' ? tagResultado(g.resultado.situacao) + (g.numero && !g.semGuia ? ' <span class="num">' + esc(g.numero) + '</span>' : '') : tagStatus(g.status)} ${tagParam(g.param)}</td>
      <td>${st.bloqueios.length ? `<span class="tag bad">${ic('ban', 'sm')}${pl(st.bloqueios.length, 'bloqueio', 'bloqueios')}</span>` : ''} ${st.obs.length + atencaoPendente(g, st).length ? `<span class="tag warn">${ic('alert', 'sm')}${st.obs.length + atencaoPendente(g, st).length}</span>` : ''}</td>
      <td class="c"><button class="btn sm pri" data-act="selGuia" data-i="${i}">${g.status === 'concluido' ? 'Ver guia' : 'Abrir guia'}${ic('right', 'sm')}</button></td></tr>`; }).join('')}
    </tbody></table></div>
    ${todas ? `<div class="ultimo" style="margin-top:12px">${ic('check')}<div>Todas as guias deste e-mail foram processadas.</div></div>` : ''}
    <div class="acoes">
      ${!multi ? `<button class="btn pri" data-act="selGuia" data-i="0">Seguir para o pedido${ic('right')}</button>` : ''}
      ${multi ? `<button class="btn ${todas ? 'pri' : 'line'}" data-act="respostaEmail">${ic('mail')}Resposta do e-mail (todas as guias)</button>` : ''}
      <span class="esp"></span>
      ${todas ? `<button class="btn pri" data-act="encerrar">${ic('check')}Encerrar atendimento</button>` : ''}
      <button class="btn dng" data-act="descartar">${ic('trash')}Descartar e-mail</button>
    </div></div></div>`;
}

/* ====================================================================
   Etapa 2: pedido e alertas
   ==================================================================== */
function htmlTabelaItens(g, { copiar = false } = {}) {
  const cl = clinicaDe(S);
  return `<div class="tabela-scroll"><table class="t"><thead><tr><th>#</th><th>Código</th><th>Qtd.</th><th>Descrição ${cl ? '(cadastro da clínica)' : '(referência)'}</th><th>Descrição do e-mail</th><th>Situação</th></tr></thead><tbody>
  ${g.pedido.itens.map((it, i) => {
    const ref = descRefItem(g, it), est = estadoItem(g, it);
    const cpCod = copiar ? `<button class="btn cp ${g.copiados['c:' + it.codigo] === it.codigo ? 'copiado' : ''}" data-act="copiarItem" data-tipo="c" data-codigo="${it.codigo}" aria-label="Copiar código ${it.codigo}">${g.copiados['c:' + it.codigo] === it.codigo ? ic('check', 'sm') : ic('copy', 'sm')}</button>` : '';
    const cpQtd = copiar ? `<button class="btn cp ${g.copiados['q:' + it.codigo] === String(it.qtd) ? 'copiado' : ''}" data-act="copiarItem" data-tipo="q" data-codigo="${it.codigo}" aria-label="Copiar quantidade de ${it.codigo}">${g.copiados['q:' + it.codigo] === String(it.qtd) ? ic('check', 'sm') : ic('copy', 'sm')}</button>` : '';
    return `<tr><td class="c">${i + 1}</td>
      <td><div class="t-celula" style="justify-content:flex-start"><span class="cod">${it.codigo}</span>${it.origemCod ? htmlOrigem(it.origemCod) : ''}${cpCod}</div></td>
      <td><div class="t-celula" style="justify-content:flex-start"><span class="qtd ${copiar && it.qtd > 1 ? 'multi' : ''}" ${copiar && it.qtd > 1 ? 'title="Quantidade maior que 1"' : ''}>${it.qtd ?? '<span class="tag bad">' + ic('alert', 'sm') + 'Falta</span>'}</span>${ORIGEM_QTD[it.origemQtd] ? htmlOrigem(ORIGEM_QTD[it.origemQtd]) : ''}${it.qtd != null ? cpQtd : ''}</div></td>
      <td>${esc(ref.texto) || '<span class="muted">—</span>'}</td>
      <td class="muted">${esc(it.desc) || '—'}</td>
      <td><div class="sit-item">${tagItem(est)}${ref.provisoria ? `<span class="tag" title="Sem cadastro: a descrição do e-mail é a referência provisória.">Descrição provisória</span><button class="btn sm line" data-act="cadastrarCodigo" data-codigo="${it.codigo}">${ic('plus', 'sm')}Cadastrar código</button>` : ''}</div></td></tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">Nenhum item lido.</td></tr>`}
  </tbody></table></div>`;
}
function htmlEditarItens(g) {
  const linhas = g._edit || g.pedido.itens.map(i => ({ codigo: i.codigo, desc: i.desc, qtd: i.qtd ?? '' }));
  return `<p class="dica">Corrige só a leitura deste e-mail.</p>
  <div class="tabela-scroll"><table class="t" id="tabEdicao"><thead><tr><th>Código (8 dígitos)</th><th>Descrição do e-mail</th><th>Qtd.</th><th></th></tr></thead><tbody>
  ${linhas.map((it, i) => `<tr><td><input type="text" inputmode="numeric" data-ei="codigo" value="${esc(it.codigo)}" maxlength="12" aria-label="Código"></td><td><input type="text" data-ei="desc" value="${esc(it.desc)}" aria-label="Descrição do e-mail"></td><td style="width:90px"><input type="text" inputmode="numeric" data-ei="qtd" value="${esc(it.qtd)}" maxlength="3" aria-label="Quantidade"></td><td class="c"><button class="btn sm ghost ico" data-act="remItem" data-i="${i}" aria-label="Remover linha" title="Remover linha">${ic('trash', 'sm')}</button></td></tr>`).join('')}
  </tbody></table></div>
  <div class="acoes"><button class="btn sm line" data-act="addItem">${ic('plus', 'sm')}Adicionar linha</button><span class="esp"></span><button class="btn sm ghost" data-act="cancelarItens">Cancelar</button><button class="btn sm pri" data-act="salvarItens">${ic('check', 'sm')}Aplicar correção</button></div>`;
}
function lerTabelaEdicao() { return $$('#tabEdicao tbody tr').map(tr => ({ codigo: $('[data-ei=codigo]', tr).value.replace(/\D/g, ''), desc: $('[data-ei=desc]', tr).value.trim(), qtd: $('[data-ei=qtd]', tr).value.replace(/\D/g, '') })); }

function htmlBannerParam(g) {
  const prm = paramDaGuia(g), cl = clinicaDe(S);
  if (g.param) {
    const feitos = (g.param.preenchido || []);
    return `<div class="banner-param">${ic('layers', 'lg')}<div class="esp"><b>Atendimento parametrizado</b> (${g.param.origem === 'criada' ? 'parametrização criada neste atendimento' : 'parametrização aplicada'}).${feitos.length ? ` Preenchido a partir dela: ${esc(feitos.join(', '))}.` : ''}</div><button class="btn sm line" data-act="parametrizar">${ic('edit', 'sm')}Ver ou editar</button></div>`;
  }
  if (prm) return `<div class="banner-param">${ic('layers', 'lg')}<div class="esp"><b>Parametrização encontrada</b> para ${esc(cl.nome)} e esta carteira (atualizada em ${fmtData(prm.atualizadoEm)}): médico ${esc(prm.medico)}, ${pl(prm.terapias.length, 'terapia', 'terapias')}. Ao aplicar, só são preenchidos dados que faltam no e-mail.</div><button class="btn sm line" data-act="parametrizar">${ic('eye', 'sm')}Ver parametrização</button><button class="btn sm pri" data-act="aplicarParam">${ic('check', 'sm')}Aplicar parametrização</button></div>`;
  return '';
}
/* Responder sem gerar guia: os 3 modelos mais usados pela equipe à vista; os outros num menu */
function maisUsadosSemGuia() {
  const n = {}; Reg.cache.forEach(r => { const m = r.resultado && r.resultado.situacao === 'sem_guia' && r.resultado.modelo; if (m && MODELOS_SEM_GUIA.includes(m)) n[m] = (n[m] || 0) + 1; });
  const ord = [...MODELOS_SEM_GUIA].sort((a, b) => (n[b] || 0) - (n[a] || 0) || MODELOS_SEM_GUIA.indexOf(a) - MODELOS_SEM_GUIA.indexOf(b));
  return { top: ord.slice(0, 3), n };
}
function htmlRespSemGuia() {
  const { top, n } = maisUsadosSemGuia();
  const btn = (k, cls) => `<button class="btn ${cls}" data-act="respSemGuia" data-modelo="${k}">${ic('mail', 'sm')}${esc(nomeModelo(k))}${n[k] ? ` <span class="muted">(${n[k]})</span>` : ''}</button>`;
  return `<div class="linha-flex">${top.map(k => btn(k, 'line')).join('')}
    <details class="menu-resp"><summary class="btn line">${ic('list', 'sm')}Responder sem guia ▾</summary><div class="menu-lista" role="menu">${MODELOS_SEM_GUIA.map(k => btn(k, 'ghost menu-op')).join('')}</div></details></div>
    <p class="dica" style="margin:6px 0 0">À vista, as 3 respostas mais usadas pela equipe nos últimos dias.</p>`;
}
document.addEventListener('click', ev => { $$('details.menu-resp[open]').forEach(d => { if (!d.contains(ev.target)) d.open = false; }); });

/* Origem de cada campo: e-mail, regra da clínica, aprendizado, digitado, parametrização, pedido anterior ou cadastro */
const ORIGENS = { email: ['mail', 'Lido do e-mail'], regra: ['sliders', 'Ajustado pela regra da clínica'], aprendido: ['book', 'Correção aprendida aplicada'], digitado: ['edit', 'Digitado ou corrigido pelo operador'], param: ['layers', 'Preenchido pela parametrização'], anterior: ['undo', 'Do pedido anterior deste remetente'], cadastro: ['building', 'Do cadastro da clínica'] };
const marcarOrigem = (g, campo, tipo) => { g.origem = g.origem || {}; g.origem[campo] = tipo; };
function origemCampo(g, campo) {
  const o = g.origem && g.origem[campo]; if (o) return o;
  const p = g.pedido, v = { beneficiario: p.beneficiario, carteira: g.carteiraUsada, medico: p.medico.nome || p.medico.crm, cid: p.cid, emissao: p.emissao && p.emissao.bruto, local: p.local }[campo];
  if (campo === 'executante') return g.executante != null ? 'digitado' : (clinicaDe(S) && clinicaDe(S).executante ? 'cadastro' : null);
  return v ? 'email' : null;
}
const htmlOrigem = tipo => { const o = ORIGENS[tipo]; return o ? `<span class="orig orig-${tipo}" title="${o[1]}" aria-label="${o[1]}">${ic(o[0], 'sm')}</span>` : ''; };
const origemDe = (g, campo) => htmlOrigem(origemCampo(g, campo));
const ORIGEM_QTD = { regra: 'regra', parametrizacao: 'param', manual: 'digitado', 'colada-crm': 'regra', aprendido: 'aprendido' };

function renderPedido(alvo, g) {
  const p = g.pedido, st = situacaoGuia(g), cl = clinicaDe(S);
  const cartInvalida = g.carteiraUsada && !cartValida(g.carteiraUsada);
  alvo.innerHTML = `
  <div class="grid2">
    <div class="col-fixa">${htmlEmailCard()}</div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Dados do pedido${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${cl ? htmlClinica(cl) : ''}${tagParam(g.param)}${Notas.de(g.carteiraUsada || p.carteira) ? '' : `<button class="btn sm ghost" data-act="notaBenef" title="Recado que aparece sempre que esta carteira for atendida">${ic('message', 'sm')}Nota do beneficiário</button>`}</div>
        <div class="form-grid">
          <div data-mcampo="benef"><label class="lbl mk" for="f-benef">Beneficiário ${origemDe(g, 'beneficiario')}</label><input type="text" id="f-benef" data-campo="beneficiario" value="${esc(p.beneficiario)}"></div>
          <div data-mcampo="cart"><label class="lbl mk">Carteira informada no e-mail</label><div style="min-height:34px;display:flex;align-items:center" class="num">${esc(p.carteiraBruta || '—')}</div></div>
          <div data-mcampo="cart"><label class="lbl mk" for="cartUsada">Carteira usada no sistema ${origemDe(g, 'carteira')}</label><div class="linha-flex" style="flex-wrap:nowrap;gap:6px"><input type="text" id="cartUsada" class="num ${cartInvalida ? 'invalido' : ''}" value="${esc(g.carteiraUsada)}" maxlength="30" placeholder="17 caracteres, sem espaços" aria-describedby="cartAjuda" style="flex:1;min-width:0">${btnCopiaCampo(g, 'carteira', 'cartUsada', 'carteira usada no sistema')}</div>${cartInvalida ? `<div class="campo-erro" id="cartAjuda">${ic('alert', 'sm')}Carteira fora do padrão (15 dígitos + 2 caracteres).</div>` : ''}</div>
          <div data-mcampo="medico"><label class="lbl mk" for="f-medico">Médico ${origemDe(g, 'medico')}</label><input type="text" id="f-medico" data-campo="medico" value="${esc(p.medico.bruto)}">${!p.medico.nome && LS.get(chaveMedico(), '') ? `<button type="button" class="btn sm line" style="margin-top:6px" data-act="usarMedicoAnterior" title="Médico do último pedido deste remetente (confira no anexo)">${ic('user', 'sm')}Usar ${esc(LS.get(chaveMedico(), ''))}</button>` : ''}</div>
          <div data-mcampo="cid"><label class="lbl mk" for="f-cid">CID ${origemDe(g, 'cid')}</label><input type="text" id="f-cid" data-campo="cid" value="${esc(p.cid)}"></div>
          <div data-mcampo="data"><label class="lbl mk" for="f-em">Data do pedido médico ${origemDe(g, 'emissao')}</label><input type="text" id="f-em" data-campo="emissao" value="${esc(p.emissao.bruto)}" placeholder="dd/mm/aaaa ou SEM DATA"></div>
          <div><label class="lbl" for="f-local">Local do pedido ${origemDe(g, 'local')}</label><input type="text" id="f-local" data-campo="local" value="${esc(p.local)}"></div>
          ${p.obs ? `<div style="grid-column:1/-1"><label class="lbl">Observações do pedido</label><div>${esc(p.obs)}</div></div>` : ''}
        </div>
        <div class="card-h" style="margin-top:18px"><h3 style="margin:0">Serviços do pedido (${p.itens.length})</h3><span class="esp"></span>
          <button class="btn sm line" data-act="editarItens" title="Corrige a leitura deste e-mail, sem alterar cadastros">${ic('edit', 'sm')}${g.editandoItens ? 'Cancelar correção' : 'Corrigir leitura'}</button>
          <button class="btn sm" data-act="parametrizar" title="Registra médico, data e terapias como referência para os próximos atendimentos desta clínica">${ic('layers', 'sm')}Parametrizar</button></div>
        ${g.editandoItens ? htmlEditarItens(g) : htmlTabelaItens(g)}
      </div>
      ${htmlBannerParam(g)}
      <div class="card">
        <div class="card-h"><h2>Responder sem gerar guia</h2></div>
        ${htmlRespSemGuia()}
      </div>
    </div>
  </div>
  ${htmlPainelAlertas(g, st)}
  <div class="acoes acoes-sec" style="margin-top:0"><span class="esp"></span>
    ${S.guias.length > 1 ? `<button class="btn sm ghost" data-act="ignorarGuia">${ic('x', 'sm')}Ignorar esta solicitação</button>` : ''}
    <button class="btn sm dng" data-act="descartar">${ic('trash', 'sm')}Descartar e-mail</button>
  </div>
  ${htmlBarraAcao({ voltar: `<button class="btn" data-act="irVista" data-v="1">${ic('left')}Voltar ao e-mail</button>`,
    status: st.bloqueios.length ? statusBarra(g, st) + `<span class="barra-msg muted">Corrija os dados ou responda à clínica.</span>` : statusBarra(g, st),
    seguir: `<button class="btn pri" data-act="irVista" data-v="3" ${st.pode ? '' : 'disabled'}>Seguir para a guia${ic('right')}</button>` })}`;
}

/* ====================================================================
   Etapa 3: guia e conferência
   ==================================================================== */
function valorCopia(g, campo) {
  const p = g.pedido, cl = clinicaDe(S);
  return ({
    executante: g.executante ?? (cl ? cl.executante : '') ?? '', medico_nome: p.medico.nome || '', medico_crm: p.medico.crm || '',
    local: p.local || '', data: dataPedidoTxt(p), carteira: g.carteiraUsada || '', benef: p.beneficiario || '', cid: (p.cid || '').replace(/\./g, '')
  })[campo] ?? '';
}
function btnCopiaCampo(g, campo, ref, rotulo) {
  const v = valorCopia(g, campo).trim(), ok = v !== '' && g.copiados[campo] === v;
  return `<button class="btn cp ${ok ? 'copiado' : ''}" data-act="copiarCampo" data-campo="${campo}" data-ref="${ref}" aria-label="Copiar ${esc(rotulo)}">${ok ? ic('check', 'sm') : ic('copy', 'sm')}</button>`;
}
function campoCopia(g, { campo, rot, sub, curto, mid, ph, mono }) {
  const id = 'cp-' + campo, v = valorCopia(g, campo);
  return `<div class="cp-campo ${curto ? 'curto' : ''} ${mid ? 'mid' : ''}"><div class="wrapin">${sub ? `<span class="sub">${sub}</span>` : ''}<input type="text" id="${id}" class="${mono ? 'num' : ''}" data-cpcampo="${campo}" value="${esc(v)}" placeholder="${esc(ph || '')}" aria-label="${esc(rot)}"></div>${btnCopiaCampo(g, campo, id, rot)}</div>`;
}
function renderGuia(alvo, g) {
  const p = g.pedido, cl = clinicaDe(S), st = situacaoGuia(g), podeSeguir = podeFinal(g, st);
  const exec = valorCopia(g, 'executante');
  const navGuia = htmlBarraAcao({ voltar: `<button class="btn" data-act="irVista" data-v="2">${ic('left')}Voltar ao pedido</button>`, status: statusBarra(g, st, podeSeguir || st.bloqueios.length ? [] : ['Falta conferir a grade: cole os prints do sistema ou faça a conferência sem prints.']), seguir: `<button class="btn pri" data-act="irVista" data-v="4" ${podeSeguir ? '' : 'disabled'}>Seguir para finalizar${ic('right')}</button>` });
  const botoesModo = Mini.aberto() ? `<span class="tag ok">${ic('pip', 'sm')}Painel flutuante aberto</span>` : '';
  if (Vis.simples()) {   // tela única: campos para copiar, prints, alertas e seguir
    alvo.innerHTML = `<div class="stack"><div class="card"><div class="card-h"><h2>Gerar a guia${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${botoesModo}</div>${htmlMini(g, { semPrints: true })}</div>${htmlCartaoPrints(g)}${htmlPainelAlertas(g, st)}${navGuia}</div>`;
    return;
  }
  alvo.innerHTML = `
  <div class="stack">
  <div class="card">
    <div class="card-h"><h2>Dados da guia${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${botoesModo}${cl ? htmlClinica(cl) : ''}${tagParam(g.param)}</div>
    <div class="cp-grupo"><span class="eyebrow">Executante e solicitação</span>
      <div class="cp-linha"><div class="rot">1. Credenciado executante ${origemDe(g, 'executante')}${!exec ? '<small>Não cadastrado: informe aqui</small>' : ''}</div><div class="cp-campos">${campoCopia(g, { campo: 'executante', rot: 'Credenciado executante', ph: 'Executante no sistema' })}</div></div>
      <div class="cp-linha"><div class="rot">2. Médico ${origemDe(g, 'medico')}</div><div class="cp-campos">${campoCopia(g, { campo: 'medico_nome', rot: 'Nome do médico', sub: 'Nome' })}${campoCopia(g, { campo: 'medico_crm', rot: 'CRM do médico', sub: p.medico.conselho || 'CRM', curto: true, mono: true })}</div></div>
      <div class="cp-linha"><div class="rot">3. Local do pedido ${origemDe(g, 'local')}</div><div class="cp-campos">${campoCopia(g, { campo: 'local', rot: 'Local do pedido' })}</div></div>
      <div class="cp-linha"><div class="rot">4. Data do pedido médico ${origemDe(g, 'emissao')}</div><div class="cp-campos">${campoCopia(g, { campo: 'data', rot: 'Data do pedido médico', ph: 'dd/mm/aaaa', curto: true, mono: true })}</div></div>
    </div>
    <div class="cp-grupo"><span class="eyebrow">Beneficiário</span>
      <div class="cp-linha"><div class="rot">5. Carteira / beneficiário ${origemDe(g, 'carteira')}</div><div class="cp-campos">${campoCopia(g, { campo: 'carteira', rot: 'Carteira', sub: 'Carteira', mono: true, mid: true })}${campoCopia(g, { campo: 'benef', rot: 'Nome do beneficiário', sub: 'Beneficiário' })}</div></div>
    </div>
    <div class="cp-grupo"><span class="eyebrow">Diagnóstico</span>
      <div class="cp-linha"><div class="rot">6. CID ${origemDe(g, 'cid')}</div><div class="cp-campos">${campoCopia(g, { campo: 'cid', rot: 'CID', curto: true, mono: true })}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-h"><h2>Serviços para lançar</h2><span class="esp"></span>
      <button class="btn sm line" data-act="editarItens3" title="Corrige a leitura deste e-mail, sem alterar cadastros">${ic('edit', 'sm')}${g.editandoItens ? 'Cancelar correção' : 'Corrigir leitura'}</button>
      <button class="btn sm" data-act="parametrizar">${ic('layers', 'sm')}Parametrizar</button></div>
    ${g.editandoItens ? htmlEditarItens(g) : !g.cega.iniciada ? `
    ${htmlTabelaItens(g, { copiar: true })}
    <div class="acoes">${cegaExigida() ? `<button class="btn link" data-act="iniciarCega" ${p.itens.length ? '' : 'disabled'}>Sem prints? Conferir a grade manualmente (conferência cega)</button>` : ''}</div>` :
      `<p class="muted">Lista oculta durante a conferência cega. <button class="btn sm line" data-act="verItens">${ic('refresh', 'sm')}Ver itens de novo (reinicia a conferência)</button></p>`}
  </div>
  ${htmlCartaoPrints(g)}
  ${g.cega.iniciada && cegaExigida() ? `
  <div class="card">
    <div class="card-h"><h2>Conferência cega</h2>${g.cega.ok ? `<span class="tag ok">${ic('check', 'sm')}Conferido</span>` : ''}${g.cega.tentativas > 1 ? `<span class="tag warn">${ic('alert', 'sm')}Tentativa ${g.cega.tentativas}</span>` : ''}</div>
    <div class="cega">
      <p style="margin:0 0 8px"><b>Olhe só para a grade do sistema</b> e informe o que está lá, linha por linha.</p>
      <div class="linha-flex"><label for="cegaN">Quantas linhas preenchidas a grade tem?</label><input type="number" id="cegaN" min="0" max="20" value="${esc(g.cega.linhas)}" style="width:90px;text-align:center" ${g.cega.ok ? 'disabled' : ''}></div>
      <div id="cegaLinhas">${htmlLinhasCega(g)}</div>
      ${ambiguos(g).length ? `<p class="dica" style="margin-top:8px">Os códigos terminados em ${ambiguos(g).join(', ')} se repetem neste pedido: para eles, digite os 8 dígitos.</p>` : ''}
      ${g.cega.resultado ? htmlResultadoCega(g.cega.resultado) : ''}
      <div class="acoes">${g.cega.ok ? '' : (g.cega.resultado && !g.cega.resultado.ok ? `<button class="btn pri" data-act="refazerCega">${ic('refresh')}Corrigi no sistema: conferir de novo</button>` : `<button class="btn pri" data-act="conferir">${ic('check')}Conferir a grade</button>`)}</div>
    </div>
  </div>` : ''}
  ${htmlPainelAlertas(g, st)}
  ${htmlBarraAcao({ voltar: `<button class="btn" data-act="irVista" data-v="2">${ic('left')}Voltar ao pedido</button>`,
    status: statusBarra(g, st, podeSeguir || st.bloqueios.length ? [] : ['Falta conferir a grade: cole os prints do sistema ou faça a conferência sem prints.']),
    seguir: `<button class="btn pri" data-act="irVista" data-v="4" ${podeSeguir ? '' : 'disabled'}>Seguir para finalizar${ic('right')}</button>` })}
  </div>`;
}
function ambiguos(g) {
  const fins = {}; g.pedido.itens.forEach(i => { const f = i.codigo.slice(-4); fins[f] = (fins[f] || 0) + 1; });
  return Object.keys(fins).filter(f => fins[f] > 1);
}
function htmlLinhasCega(g) {
  const n = Math.min(20, Math.max(0, parseInt(g.cega.linhas, 10) || 0));
  if (!n) return '';
  let h = '<div class="cega-linhas"><span class="h">Linha</span><span class="h">Final do código</span><span class="h">Qtd.</span>';
  for (let i = 0; i < n; i++) {
    const v = g.cega.entradas[i] || {};
    h += `<span class="num">${i + 1}</span><input type="text" inputmode="numeric" maxlength="8" placeholder="4 últimos" data-cega="fim" data-i="${i}" value="${esc(v.fim || '')}" ${g.cega.ok ? 'disabled' : ''} aria-label="Final do código, linha ${i + 1}"><input type="text" inputmode="numeric" maxlength="1" data-cega="qtd" data-i="${i}" value="${esc(v.qtd || '')}" ${g.cega.ok ? 'disabled' : ''} aria-label="Quantidade, linha ${i + 1}">`;
  }
  return h + '</div>';
}
function compararCega(itens, n, entradas) {
  const res = { ok: true, erros: [], porItem: [], extras: [], n, m: itens.length };
  const lin = [];
  for (let i = 0; i < n; i++) {
    const e = entradas[i] || {}; const fim = String(e.fim || '').replace(/\D/g, ''); const qtd = String(e.qtd || '').replace(/\D/g, '');
    if (fim.length < 4 || qtd === '') res.erros.push(`Linha ${i + 1}: preencha pelo menos 4 dígitos do código e a quantidade.`);
    const cands = fim.length >= 4 ? itens.filter(it => it.codigo.endsWith(fim)) : [];
    lin.push({ i, fim, qtd, match: cands.length === 1 ? cands[0] : null, ambig: cands.length > 1 });
  }
  if (res.erros.length) { res.ok = false; res.incompleto = true; return res; }
  if (n !== itens.length) res.erros.push(`A grade tem ${pl(n, 'linha', 'linhas')} e o pedido tem ${pl(itens.length, 'item', 'itens')}.`);
  for (const it of itens) {
    const ls = lin.filter(l => l.match === it);
    if (!ls.length) res.porItem.push({ it, st: 'omitido' });
    else if (ls.length > 1) res.porItem.push({ it, st: 'duplicado', linhas: ls.map(l => l.i + 1) });
    else if (Number(ls[0].qtd) !== Number(it.qtd)) res.porItem.push({ it, st: 'qtd', informado: ls[0].qtd, linha: ls[0].i + 1 });
    else res.porItem.push({ it, st: 'ok', linha: ls[0].i + 1 });
  }
  lin.filter(l => !l.match).forEach(l => res.extras.push({ linha: l.i + 1, fim: l.fim, ambig: l.ambig }));
  res.ok = !res.erros.length && !res.extras.length && res.porItem.every(x => x.st === 'ok');
  return res;
}
function htmlResultadoCega(r) {
  if (r.ok) return `<div class="res-ok" style="margin-top:12px">${ic('check')}Grade confere com o pedido: ${pl(r.m, 'item', 'itens')}, códigos e quantidades corretos.</div>`;
  const li = [];
  r.erros.forEach(e => li.push(e));
  if (!r.incompleto) {
    r.porItem.forEach(x => {
      if (x.st === 'omitido') li.push(`<b>Omitido:</b> ${x.it.codigo} (${esc(x.it.desc)}) não está na grade.`);
      if (x.st === 'duplicado') li.push(`<b>Duplicado na grade:</b> ${x.it.codigo} aparece nas linhas ${x.linhas.join(' e ')}.`);
      if (x.st === 'qtd') li.push(`<b>Quantidade divergente:</b> ${x.it.codigo} está com ${x.informado} na linha ${x.linha}; o pedido pede <b>${x.it.qtd}</b>.`);
    });
    r.extras.forEach(x => li.push(x.ambig ? `<b>Linha ${x.linha}:</b> final "${x.fim}" combina com mais de um código; digite os 8 dígitos.` : `<b>Inclusão indevida:</b> a linha ${x.linha} (final ${x.fim}) não está no pedido.`));
  }
  return `<div class="res-bad" style="margin-top:12px"><b>${ic('alert', 'sm')} ${r.incompleto ? 'Conferência incompleta' : 'A grade não confere com o pedido'}</b><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
}

/* ====================================================================
   Etapa 4: finalizar a guia (resultado real, resposta e observação)
   ==================================================================== */
function pendenciasConclusao(g, st) {
  const P = [], r = g.resultado;
  if (g.semGuia) { if (mostraResposta(g) && r.emailPrestador && !emailValido(r.emailPrestador)) P.push('O e-mail da clínica não parece válido.'); return P; }
  if (!/^[TS]\d{7,8}$/.test(g.numero)) P.push('Informe o número da guia gerada no sistema oficial (T ou S + 7 ou 8 dígitos).');
  if (!r.situacao) P.push('Selecione a situação da autorização.');
  if (r.situacao === 'autorizada' || r.situacao === 'parcial') {
    const gl = glosaDe(g);
    if (!gl.resp) P.push('Responda: retirou alguma glosa?');
    else if (gl.resp === 'sim') {
      const its = glosasValidas(g);
      if (!its.length) P.push('Selecione o(s) item(ns) em que a glosa foi retirada.');
      its.forEach(([c, x]) => { if (!(x.glosa || '').trim()) P.push(`Informe a glosa do item ${c}.`); if (!(x.motivo || '').trim()) P.push(`Informe por que a glosa do item ${c} foi retirada.`); });
    }
  }
  if (r.situacao === 'parcial') {
    const n = Object.keys(r.naoAut).length;
    if (!n) P.push('Marque os itens que não foram autorizados.');
    else if (n >= g.pedido.itens.length) P.push('Todos os itens estão marcados como não autorizados: use a situação “Não autorizada”.');
  }
  if (mostraResposta(g) && r.emailPrestador && !emailValido(r.emailPrestador)) P.push('O e-mail da clínica não parece válido.');
  if (!st.pode) P.push('Há bloqueio nesta guia (veja Alertas e ocorrências).');
  if (cegaExigida() && !g.cega.ok) P.push('Falta concluir a conferência da grade.');
  return P;
}
// Itens em que a glosa pode ser retirada: na parcial, só os autorizados (os negados ficam de fora)
const itensGlosaveis = g => g.resultado.situacao === 'parcial' ? g.pedido.itens.filter(it => g.resultado.naoAut[it.codigo] == null) : g.pedido.itens;
const glosasValidas = g => { const ok = new Set(itensGlosaveis(g).map(i => i.codigo)); return Object.entries(glosaDe(g).itens).filter(([c]) => ok.has(c)); };
function htmlGlosa(g) {
  const gl = glosaDe(g), lista = cfg.glosas || [];
  const campo = (it, x) => lista.length
    ? `<select data-glf="glosa" data-c="${it.codigo}" aria-label="Glosa do item ${it.codigo}"><option value="">Selecione a glosa…</option>${[...new Set([...(x.glosa && !lista.includes(x.glosa) ? [x.glosa] : []), ...lista])].map(v => `<option value="${esc(v)}" ${v === x.glosa ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`
    : `<input type="text" data-glf="glosa" data-c="${it.codigo}" value="${esc(x.glosa || '')}" placeholder="Glosa (cadastre a lista em Configurações)" aria-label="Glosa do item ${it.codigo}">`;
  return `<div class="glosa"><div class="linha-flex" style="margin-top:10px"><b>Retirou alguma glosa?</b><div class="seg" role="radiogroup" aria-label="Retirou alguma glosa?"><button type="button" role="radio" aria-checked="${gl.resp === 'sim'}" class="${gl.resp === 'sim' ? 'on igual' : ''}" data-act="setGlosa" data-v="sim">Sim</button><button type="button" role="radio" aria-checked="${gl.resp === 'nao'}" class="${gl.resp === 'nao' ? 'on igual' : ''}" data-act="setGlosa" data-v="nao">Não</button></div>${gl.resp ? '' : '<span class="tag warn">Obrigatório</span>'}</div>
    ${gl.resp === 'sim' ? `<div class="negados">${itensGlosaveis(g).map(it => { const x = gl.itens[it.codigo], ref = descRefItem(g, it); return `<div class="negado gl ${x ? 'on' : ''}" style="grid-template-columns:auto 1fr"><input type="checkbox" id="gl-${it.codigo}" data-gl="${it.codigo}" ${x ? 'checked' : ''}><label for="gl-${it.codigo}"><b class="num">${it.codigo}</b> — Qtd. ${it.qtd ?? '?'} — ${esc(ref.texto || it.desc)}</label>${x ? `<div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 2fr;gap:8px">${campo(it, x)}<input type="text" data-glf="motivo" data-c="${it.codigo}" value="${esc(x.motivo || '')}" placeholder="Por que a glosa foi retirada" aria-label="Motivo da retirada do item ${it.codigo}"></div>` : ''}</div>`; }).join('')}</div>` : ''}</div>`;
}
function optsMotivos(sel) { return `<option value="">Selecione o motivo…</option>` + cfg.motivos.map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.nome)}</option>`).join(''); }
function htmlSituacao(g) {
  const r = g.resultado;
  const op = (v, i, t, d) => `<button type="button" class="sit ${v === 'nao' ? 'nao' : v} ${r.situacao === v ? 'on' : ''}" role="radio" aria-checked="${r.situacao === v}" data-act="setSit" data-v="${v}">${ic(i, 'lg')}<span><b>${t}</b></span></button>`;
  let extra = '';
  if (r.situacao === 'parcial') {
    extra = `<div class="negados">${g.pedido.itens.map(it => { const neg = r.naoAut[it.codigo] != null; const ref = descRefItem(g, it); return `<div class="negado ${neg ? 'on' : ''}"><input type="checkbox" id="neg-${it.codigo}" data-neg="${it.codigo}" ${neg ? 'checked' : ''}><label for="neg-${it.codigo}"><b class="num">${it.codigo}</b> — Qtd. ${it.qtd ?? '?'} — ${esc(ref.texto || it.desc)}</label><select data-negmot="${it.codigo}" ${neg ? '' : 'disabled'} aria-label="Motivo da não autorização de ${it.codigo}">${optsMotivos(r.naoAut[it.codigo])}</select></div>`; }).join('')}</div>`;
  }
  if (r.situacao === 'nao') {
    extra = `<div class="form-grid" style="margin-top:12px"><div><label class="lbl" for="rMotivo">Motivo da não autorização</label><select id="rMotivo" data-resf="motivoId">${optsMotivos(r.motivoId)}</select></div><div><label class="lbl" for="rMotivoTxt">Detalhe do motivo (opcional)</label><input type="text" id="rMotivoTxt" data-resf="motivoTxt" value="${esc(r.motivoTxt)}"></div></div>`;
  }
  if (r.situacao === 'autorizada') extra = htmlGlosa(g);
  else if (r.situacao === 'parcial') extra += htmlGlosa(g);
  return `<div class="sit-opcoes" role="radiogroup" aria-label="Situação da autorização">
    ${op('autorizada', 'check', 'Autorizada', 'Todos os itens aplicáveis foram autorizados.')}
    ${op('parcial', 'halfcircle', 'Parcialmente autorizada', 'Somente parte dos itens foi autorizada.')}
    ${op('nao', 'x', 'Não autorizada', 'A guia foi gerada, mas a autorização não foi concedida.')}</div>${extra}`;
}
function htmlCardObs(g) {
  const obsTxt = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g);
  return `<div class="card">
  <div class="card-h"><h2>Observação da guia</h2><span class="tag info" title="O campo de observação do sistema oficial aceita só texto simples.">${ic('info', 'sm')}Texto simples</span><span class="esp"></span>
</div>
  <textarea id="txtObs" rows="9" aria-label="Observação da guia">${esc(obsTxt)}</textarea>
  <div class="acoes"><button class="btn cp ${g.copiados.obs === obsTxt ? 'copiado' : ''}" data-act="copiarObs" data-rot="Copiar observação">${g.copiados.obs === obsTxt ? ic('check', 'sm') + 'Copiado' : ic('copy', 'sm') + 'Copiar observação'}</button>${g.obsEdit != null ? `<button class="btn sm ghost" data-act="resetObs">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}</div>
      </div>`;
}
/* Situação da autorização pela leitura dos prints: todos liberados = autorizada; alguns fora do sistema
   ou não liberados = parcial (esses marcados); nenhum = não autorizada. O operador confere e pode trocar. */
function situacaoPelosPrints(g) {
  const av = prontoPrints(g) ? avaliarPrints(g) : null; if (!av || !av.linhas.length) return null;
  const doPedido = av.linhas.filter(l => l.qPed != null);
  if (!doPedido.length || av.avisos.some(a => /Falta o print/.test(a))) return null;
  const naoLib = doPedido.filter(l => l.qSis == null || (l.stSis && l.stSis !== 'L')).map(l => l.codigo);
  const menor = doPedido.filter(l => l.qSis != null && l.qPed != null && l.qSis < l.qPed).map(l => l.codigo);
  const v = naoLib.length >= g.pedido.itens.length ? 'nao' : naoLib.length ? 'parcial' : 'autorizada';
  return { v, naoLib, menor };
}
function aplicarSugestaoSituacao(g) {
  const r = g.resultado; if (r.situacao || g.sitSug) return;
  const s = situacaoPelosPrints(g); if (!s) return;
  r.situacao = s.v; r.naoAut = {}; if (s.v === 'parcial') s.naoLib.forEach(c => { r.naoAut[c] = ''; });
  g.sitSug = { v: s.v, menor: s.menor, em: agora() };
  evento(g, 'regra', `Situação sugerida pelos prints: ${({ autorizada: 'autorizada', parcial: 'parcialmente autorizada', nao: 'não autorizada' })[s.v]}`);
  persistir();
}
function renderFinal(alvo, g) {
  if (g.semGuia) return renderFinalSemGuia(alvo, g);
  if (g.status !== 'concluido') aplicarSugestaoSituacao(g);
  const r = g.resultado, st = situacaoGuia(g), guiaOk = /^[TS]\d{7,8}$/.test(g.numero);
  const pend = pendenciasConclusao(g, st);
  const showResp = mostraResposta(g), multi = usaConsolidada(), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  const resp = showResp && (r.situacao || multi) ? respostaDaGuia(g, true) : null;
  const html = g.respEdit != null ? g.respEdit : (resp ? resp.html : '');
  const obsTxt = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g);
  const emailOk = r.emailPrestador && g.copiados.email === r.emailPrestador;
  alvo.innerHTML = `
  ${multi && !showResp ? `<div class="aviso">${ic('info')}<div>Este e-mail tem ${guiasAtivas().length} guias. Aqui você registra o número, o resultado e a observação desta guia. A <b>resposta à clínica, com todas as guias</b>, aparece na última guia (faltam ${faltam}).</div></div>` : ''}
  ${multi && showResp ? `<div class="banner-param">${ic('mail', 'lg')}<div class="esp"><b>Última guia do e-mail.</b> A resposta abaixo reúne o resultado de todas as guias geradas neste e-mail.</div></div>` : ''}
  <div class="${showResp ? 'grid2' : ''}">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Número e resultado da guia${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${tagParam(g.param)}</div>
        ${g.prints && g.prints.ign && Object.keys(g.prints.ign).length ? `<div class="aviso" style="margin-bottom:12px">${ic('alert')}<div><b>Divergências ignoradas na conferência pelos prints.</b> As observações marcadas na etapa 3 já estão nas <b>observações adicionais</b> abaixo (e vão para a resposta à clínica): detalhe o motivo. Você pode finalizar normalmente.</div></div>` : ''}
        <div class="guia-destaque ${guiaOk ? 'ok' : (g.numero ? 'erro' : '')}"><label class="lbl" for="guia">${ic('filecheck')}Número da guia gerada no sistema oficial</label>
          <div class="guia-linha"><input type="text" id="guia" class="num ${g.numero && !guiaOk ? 'invalido' : ''}" value="${esc(g.numero)}" maxlength="10" placeholder="T00000000 ou S00000000" autocomplete="off" aria-describedby="guiaAjuda">
          <button class="btn cp btn-obs ${g.copiados.obs === obsTxt ? 'copiado' : ''}" data-act="copiarObs" data-rot="Copiar observação da guia" title="Copia o texto da observação (abaixo) para colar no sistema">${g.copiados.obs === obsTxt ? ic('check') + 'Copiado' : ic('copy') + 'Copiar observação da guia'}</button></div>
          <div class="${g.numero && !guiaOk ? 'campo-erro' : 'campo-ajuda'}" id="guiaAjuda">${g.numero && !guiaOk ? ic('alert', 'sm') : ''}${g.numero && !guiaOk ? 'Formato: T ou S + 7 ou 8 dígitos.' : ''}</div></div>
        <div class="form-grid">
          ${showResp ? `<div><label class="lbl" for="emailPrest">E-mail da clínica</label>
            <div class="cp-campo"><div class="wrapin"><input type="text" id="emailPrest" data-resf="emailPrestador" value="${esc(r.emailPrestador)}" class="${r.emailPrestador && !emailValido(r.emailPrestador) ? 'invalido' : ''}" placeholder="contato@clinica.com.br"></div>
              <button class="btn cp ${emailOk ? 'copiado' : ''}" data-act="copiarEmail" aria-label="Copiar somente o e-mail da clínica">${emailOk ? ic('check', 'sm') : ic('copy', 'sm')}</button></div>
            </div>` : ''}
        </div>
        <h3>Situação da autorização</h3>
        ${g.sitSug && r.situacao === g.sitSug.v ? `<div class="aviso-simples" style="margin-bottom:8px">${ic('info', 'sm')}<div><b>Sugerida pelos prints.</b> Confira antes de concluir; se não for isso, escolha outra.${g.sitSug.menor && g.sitSug.menor.length ? ` ${pl(g.sitSug.menor.length, 'item veio', 'itens vieram')} com quantidade menor (${g.sitSug.menor.join(', ')}): veja se é parcial.` : ''}</div></div>` : ''}
        ${htmlSituacao(g)}
        <div style="margin-top:12px"><div class="linha-flex" style="justify-content:space-between;margin-bottom:3px"><label class="lbl" for="rObs" style="margin:0">Observações adicionais (entram na resposta à clínica)</label><button class="btn sm" data-act="incluirObs">${ic('plus', 'sm')}Incluir observação</button></div><textarea id="rObs" data-resf="obsAdicionais" rows="2">${esc(r.obsAdicionais)}</textarea></div>
      </div>
      ${htmlCardObs(g)}
    </div>
    ${showResp ? `<div class="stack">
      <div class="card">
        <div class="card-h"><h2>${multi ? 'Resposta à clínica (todas as guias)' : 'Resposta à clínica'}</h2>${resp ? `<span class="tag ac">${ic('mail', 'sm')}${esc(nomeModelo(resp.modelo))}</span>` : ''}<span class="esp"></span>
          ${!multi && r.situacao === 'autorizada' && /^\s*(re|res)\s*:/i.test(S.email.assunto) ? `<label class="chk" style="font-size:var(--fs-sm)"><input type="checkbox" data-resf="usarCorrecao" ${g.usarCorrecao ? 'checked' : ''}>Usar modelo de correção</label>` : ''}</div>
        ${!resp ? (() => { const sv = r.situacao; r.situacao = 'autorizada'; let pv = null; try { pv = respostaDaGuia(g, true); } catch (er) { } r.situacao = sv;
          return `<div class="aviso-simples" style="margin-bottom:8px">${ic('info', 'sm')}<div>Prévia com o modelo provável (<b>autorizada</b>). Escolha a situação para confirmar o modelo e liberar a cópia.</div></div>${pv ? `<div class="previa previa-provavel"><div class="previa-c">${pv.html}</div></div>` : ''}`; })() : `
        ${resp.faltando.length ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>Campos sem valor, destacados no texto: <b>${resp.faltando.map(k => esc((CAMPO[k] || {}).nome || k)).join(', ')}</b>. Preencha-os acima ou edite o texto.</div></div>` : ''}
        ${htmlEditor({ id: 'edResp', valor: html, minAltura: 240 })}
        <div class="acoes"><button class="btn pri" data-act="copiarResp" ${guiaOk ? '' : 'disabled'} title="${guiaOk ? 'Copia texto formatado, para colar no e-mail' : 'Informe o número da guia'}">${ic('copy')}Copiar com formatação</button>
          <button class="btn line" data-act="copiarRespSimples" ${guiaOk ? '' : 'disabled'}>${ic('copy')}Copiar texto simples</button>
          ${btnWebmail('editor', !guiaOk)}
          ${(g.respEdit != null || g.respExtras.length) ? `<button class="btn sm ghost" data-act="resetResp">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}
          ${g.copiados.resp ? `<span class="tag ok">${ic('check', 'sm')}Resposta copiada</span>` : ''}</div>`}
      </div>
    </div>` : ''}
  </div>
  ${htmlPainelAlertas(g, st)}
  ${pend.length > 1 ? `<ul class="dica" style="margin:0;padding-left:20px">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${htmlBarraAcao({ voltar: `<button class="btn" data-act="irVista" data-v="3">${ic('left')}Voltar à guia</button>`, status: statusBarra(g, st, pend),
    seguir: `<button class="btn pri" data-act="concluirGuia" ${pend.length ? 'disabled' : ''}>${ic('check')}Concluir guia</button>` })}`;
}
function renderFinalSemGuia(alvo, g) {
  const multi = usaConsolidada(), showResp = mostraResposta(g), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  const frag = renderModelo(g.semGuia + '_multi', ctxDe(g, extrasSemGuia(g, g.semGuia)), { marcar: true });
  const resp = showResp ? respostaDaGuia(g, true) : null, r = g.resultado;
  const html = g.respEdit != null ? g.respEdit : (resp ? resp.html : '');
  const emailOk = r.emailPrestador && g.copiados.email === r.emailPrestador, pend = pendenciasConclusao(g, situacaoGuia(g));
  alvo.innerHTML = `<div class="stack">
  <div class="card"><div class="card-h"><h2>Responder sem gerar guia${multi ? ` — guia ${g.idx + 1}` : ''}</h2><span class="tag obs">${ic('mail', 'sm')}${esc(nomeModelo(g.semGuia))}</span><span class="esp"></span><button class="btn sm line" data-act="desfazerSemGuia">${ic('left', 'sm')}Voltar e gerar a guia</button></div>
    ${multi && !showResp ? `<div class="aviso" style="margin-top:10px">${ic('info')}<div>A resposta única com todas as guias aparece na última guia (faltam ${faltam}). Abaixo, o trecho desta guia.</div></div>` : ''}
    ${multi ? `<h3>Trecho desta guia na resposta única</h3><div class="previa"><div class="previa-c">${frag.html}</div></div>` : ''}
  </div>
  ${showResp ? `<div class="card"><div class="card-h"><h2>${multi ? 'Resposta à clínica (todas as guias)' : 'Resposta à clínica'}</h2><span class="esp"></span></div>
    <div class="cp-campo" style="margin-bottom:10px"><div class="wrapin"><label class="lbl" for="emailPrest">E-mail da clínica</label><input type="text" id="emailPrest" data-resf="emailPrestador" value="${esc(r.emailPrestador)}" class="${r.emailPrestador && !emailValido(r.emailPrestador) ? 'invalido' : ''}"></div>
      <button class="btn cp ${emailOk ? 'copiado' : ''}" data-act="copiarEmail" style="align-self:flex-end" aria-label="Copiar somente o e-mail da clínica">${emailOk ? ic('check', 'sm') : ic('copy', 'sm')}</button></div>
    ${resp && resp.faltando.length ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>Campos sem valor, destacados no texto: <b>${resp.faltando.map(k => esc((CAMPO[k] || {}).nome || k)).join(', ')}</b>. Edite o texto antes de copiar.</div></div>` : ''}
    ${htmlEditor({ id: 'edResp', valor: html, minAltura: 240 })}
    <div class="acoes"><button class="btn pri" data-act="copiarResp">${ic('copy')}Copiar com formatação</button><button class="btn line" data-act="copiarRespSimples">${ic('copy')}Copiar texto simples</button>${btnWebmail('editor')}
      ${(g.respEdit != null || g.respExtras.length) ? `<button class="btn sm ghost" data-act="resetResp">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}${g.copiados.resp ? `<span class="tag ok">${ic('check', 'sm')}Resposta copiada</span>` : ''}</div></div>` : ''}
  </div>
  ${pend.length > 1 ? `<ul class="dica" style="margin:0;padding-left:20px">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${htmlBarraAcao({ voltar: `<button class="btn" data-act="desfazerSemGuia">${ic('left')}Voltar ao pedido</button>`, status: statusBarra(g, { bloqueios: [], A: [] }, pend),
    seguir: `<button class="btn pri" data-act="concluirGuia" ${pend.length ? 'disabled' : ''}>${ic('check')}Concluir guia</button>` })}`;
}
/* "Responder no webmail": aparece sempre; sem a extensão, o clique explica como instalar */
const btnWebmail = (fonte = 'editor', desativado = false) => `<button class="btn line" data-act="responderWebmail" data-fonte="${fonte}" ${desativado ? 'disabled' : ''} title="${extInstalada() ? 'Leva a resposta ao webmail: lá, clique em Responder, no corpo do texto e em Colar resposta. O envio continua sendo feito por você.' : 'Com a extensão do Chrome, a resposta vai direto para o webmail. Clique para ver como instalar.'}">${ic('send')}Responder no webmail</button>`;
function renderConcluida(alvo, g) {
  const r = g.resultado, resp = respostaDaGuia(g, false), a = autorizadosDe(g), n = negadosDe(g);
  const prox = S.guias.findIndex(x => !guiaTerminal(x)), todas = S.guias.every(guiaTerminal);
  alvo.innerHTML = `<div class="grid2"><div class="stack">
    <div class="card"><div class="card-h"><h2>Guia concluída${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${tagResultado(r.situacao)}${tagParam(g.param)}</div>
      <dl class="kv">${g.semGuia ? `<dt>Situação</dt><dd>Guia não gerada: ${esc(nomeModelo(g.semGuia))}</dd>` : `<dt>Número da guia</dt><dd class="num"><b>${esc(g.numero)}</b></dd>`}<dt>Beneficiário</dt><dd>${esc(nomeGuia(g))}</dd><dt>Carteira</dt><dd class="num">${esc(g.carteiraUsada)}</dd>
      ${a.length ? `<dt>Autorizados</dt><dd>${a.map(i => `<span class="num">${i.codigo}</span> × ${i.qtd ?? '?'}`).join('<br>')}</dd>` : ''}
      ${n.length ? `<dt>Não autorizados</dt><dd>${n.map(x => `<span class="num">${x.it.codigo}</span> × ${x.it.qtd ?? '?'}${x.motivo ? ' — ' + esc(x.motivo) : ''}`).join('<br>')}</dd>` : ''}
      ${r.situacao === 'nao' && (r.motivoId || r.motivoTxt) ? `<dt>Motivo</dt><dd>${esc([motivoNome(r.motivoId), r.motivoTxt].filter(Boolean).join(' — '))}</dd>` : ''}</dl>
      <div class="acoes"><button class="btn line" data-act="reabrirGuia">${ic('edit')}Reabrir para correção</button><span class="esp"></span>
        ${prox >= 0 ? `<button class="btn pri" data-act="selGuia" data-i="${prox}">Próxima guia pendente${ic('right')}</button>` : ''}
        ${todas ? `<button class="btn pri" data-act="encerrar">${ic('check')}Encerrar atendimento</button>` : ''}</div></div>${g.semGuia ? '' : htmlCardObs(g)}</div>
    ${usaConsolidada() && !todas ? '' : `<div class="card"><div class="card-h"><h2>Resposta à clínica${usaConsolidada() ? ' (todas as guias)' : ''}</h2></div>
      <div class="previa"><div class="previa-c">${resp.html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')}</div></div>
      <div class="acoes"><button class="btn line" data-act="copiarRespConcluida">${ic('copy')}Copiar com formatação</button>${btnWebmail('concluida')}</div></div>`}</div>`;
}

/* ====================================================================
   Modais: resposta rápida, resposta do e-mail, observação, parametrização
   ==================================================================== */
function abrirRespostaEmail() {
  const g = guiaAtiva() || S.guias[0], pend = S.guias.filter(x => !guiaTerminal(x)).length;
  const r = renderModelo('resposta_multipla', ctxDe(g), { marcar: true });
  M = { tipo: 'resp', modelo: 'resposta_multipla', semGuia: false, copiou: false };
  abrirModal({
    titulo: 'Resposta do e-mail', sub: `${pl(S.guias.filter(x => x.status !== 'descartado').length, 'guia', 'guias')} neste e-mail`, icone: 'mail', tamanho: 'g',
    corpo: `${pend ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>${pend === 1 ? '1 guia ainda não foi processada' : pend + ' guias ainda não foram processadas'}. O texto indica essas guias como pendentes; envie esta resposta só se for o caso.</div></div>` : ''}
      ${htmlEditor({ id: 'edModal', valor: r.html, minAltura: 280 })}`,
    rodape: `<span class="dica" id="modalEstado"></span><button class="btn" data-act="fecharModal">Fechar</button><button class="btn line" data-act="copiarModalSimples">${ic('copy')}Copiar texto simples</button><button class="btn pri" data-act="copiarModalRico">${ic('copy')}Copiar com formatação</button>`
  });
}

/* ---------- Incluir observação ---------- */
function opcoesObservacao(g, st) {
  const L = [];
  st.obs.forEach(a => L.push({ id: 'a:' + a.key, titulo: ALERTAS[a.tipo].nome, texto: a.obsTexto, pre: true }));
  const mo = renderModelo('observacao', ctxDe(g)).texto; if ((mo || '').trim()) L.push({ id: 'm:obs', titulo: nomeModelo('observacao') + ' (modelo)', texto: mo, pre: false });
  if (g.param) {
    L.push({ id: 'p:obs', titulo: 'Atendimento parametrizado', texto: renderModelo('obs_parametrizado', ctxDe(g)).texto, pre: !!cfg.preferencias.obsParametrizadoAuto });
    const prm = Param.porId(g.param.id); if (prm && prm.texto) L.push({ id: 'p:txt', titulo: 'Dados da parametrização', texto: prm.texto, pre: false });
  }
  if (!g.param) { const mp = renderModelo('obs_parametrizado', ctxDe(g)).texto; if ((mp || '').trim()) L.push({ id: 'm:par', titulo: nomeModelo('obs_parametrizado') + ' (modelo)', texto: mp, pre: false }); }
  if (g.pedido.obs) L.push({ id: 'o:ped', titulo: 'Observações do pedido (e-mail)', texto: g.pedido.obs, pre: false });
  return L;
}
const textoSelObs = () => M.itens.filter(i => M.sel.has(i.id) && !M.g.obsInc.includes(i.id)).map(i => i.texto).join('\n');
function htmlModalObs() {
  return `${M.itens.length ? M.itens.map(i => { const ja = M.g.obsInc.includes(i.id); return `<label class="chk" style="margin:6px 0;${ja ? 'opacity:.6' : ''}"><input type="checkbox" data-obssel="${esc(i.id)}" ${M.sel.has(i.id) && !ja ? 'checked' : ''} ${ja ? 'disabled' : ''}><span><b>${esc(i.titulo)}</b> ${ja ? `<span class="tag ok">${ic('check', 'sm')}Já incluída</span>` : ''}<br><span class="muted" style="font-size:var(--fs-sm)">${esc(i.texto)}</span></span></label>`; }).join('') : '<p class="muted">Nenhuma observação disponível para esta guia. Escreva abaixo se quiser.</p>'}
    <label class="lbl" for="obsTxt" style="margin-top:10px">Texto a inserir (editável)</label><textarea id="obsTxt" data-obstxt="txt" rows="4">${esc(M.txt)}</textarea>`;
}
function abrirModalObs() {
  const g = guiaAtiva(), st = situacaoGuia(g), itens = opcoesObservacao(g, st);
  M = { tipo: 'obs', g, itens, sel: new Set(itens.filter(i => i.pre).map(i => i.id)), txt: '', editado: false };
  M.txt = textoSelObs();
  abrirModal({ titulo: 'Incluir observação', sub: 'Vai para as observações adicionais da resposta à clínica', icone: 'message', tamanho: 'g', corpo: htmlModalObs(),
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="inserirObs">${ic('check')}Inserir observação</button>` });
}

/* ---------- Parametrização ---------- */
function novoParamModal(g, prm) {
  const cl = clinicaDe(S);
  if (prm) return { tipo: 'param', id: prm.id, guiaId: g ? g.id : null, clinicaId: prm.clinicaId, carteira: prm.carteira, medico: prm.medico, data: prm.emissao ? diaBR(prm.emissao) : '', terapias: prm.terapias.map(t => ({ ...t })), texto: prm.texto || '', textoEditado: !!prm.texto, criadoEm: prm.criadoEm, criadoPor: prm.criadoPor };
  const p = g.pedido;
  return { tipo: 'param', id: null, guiaId: g.id, clinicaId: cl.id, carteira: g.carteiraUsada, medico: p.medico.nome || '', data: p.emissao.estado === 'valida' ? fmtData(p.emissao.data) : '',
    terapias: p.itens.map(it => ({ id: uid(), codigo: it.codigo, descricao: descRefItem(g, it).texto, qtd: it.qtd ?? '' })), texto: '', textoEditado: false };
}
function htmlModalParam() {
  const m = M, cl = cfg.clinicas.find(c => c.id === m.clinicaId);
  return `<div class="stack">
    <div class="linha-flex">${cl ? htmlClinica(cl) : ''}<span class="tag"><span class="muted">Carteira</span> <b class="num">${esc(m.carteira || '—')}</b></span>${m.id ? '<span class="tag ac">Parametrização existente</span>' : '<span class="tag info">Nova parametrização</span>'}</div>
    ${m.livre ? `<div class="form-grid"><div><label class="lbl" for="pmClinica">Clínica</label><select id="pmClinica" class="sel-busca" data-pm="clinicaId"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(c => `<option value="${c.id}" ${c.id === m.clinicaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div><div><label class="lbl" for="pmCart">Carteira (17 caracteres)</label><input type="text" id="pmCart" data-pm="carteira" class="num" value="${esc(m.carteira)}" maxlength="20"></div></div>` : ''}
    <div class="aviso-simples">${ic('info')}<div>A parametrização é uma referência para os <b>próximos atendimentos desta clínica e carteira</b>. É independente de “Corrigir leitura”: alterar aqui não muda os itens deste e-mail, e o contrário também.</div></div>
    <div class="form-grid">
      <div><label class="lbl" for="pmMedico">Nome do médico</label><input type="text" id="pmMedico" data-pm="medico" value="${esc(m.medico)}"></div>
      <div><label class="lbl" for="pmData">Data de emissão do pedido médico</label><input type="text" id="pmData" data-pm="data" value="${esc(m.data)}" placeholder="dd/mm/aaaa"></div>
    </div>
    <div><div class="card-h" style="margin-bottom:6px"><h3 style="margin:0">Terapias</h3><span class="esp"></span><button class="btn sm line" data-act="pmAdd">${ic('plus', 'sm')}Adicionar terapia</button></div>
      <div class="tabela-scroll"><table class="t"><thead><tr><th style="width:130px">Código (opcional)</th><th>Descrição da terapia</th><th style="width:90px">Qtd.</th><th style="width:48px"></th></tr></thead><tbody>
      ${m.terapias.map((t, i) => `<tr><td><input type="text" inputmode="numeric" data-pt="codigo" data-i="${i}" value="${esc(t.codigo || '')}" maxlength="8" aria-label="Código da terapia ${i + 1}"></td><td><input type="text" data-pt="descricao" data-i="${i}" value="${esc(t.descricao)}" aria-label="Descrição da terapia ${i + 1}"></td><td><input type="text" inputmode="numeric" data-pt="qtd" data-i="${i}" value="${esc(t.qtd)}" maxlength="3" aria-label="Quantidade da terapia ${i + 1}"></td><td class="c"><button class="btn sm ghost ico" data-act="pmRem" data-i="${i}" aria-label="Remover terapia ${i + 1}" title="Remover terapia">${ic('trash', 'sm')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhuma terapia. Use “Adicionar terapia”.</td></tr>'}
      </tbody></table></div></div>
    <div><div class="card-h" style="margin-bottom:6px"><h3 style="margin:0">Texto estruturado</h3>${m.textoEditado ? `<span class="tag warn" id="pmTag">${ic('edit', 'sm')}Editado manualmente</span>` : '<span class="tag ac" id="pmTag">Gerado automaticamente</span>'}<span class="esp"></span><button class="btn sm line" data-act="pmGerar" ${m.textoEditado ? '' : 'disabled'}>${ic('refresh', 'sm')}Gerar novamente</button></div>
      <textarea id="pmTexto" rows="6" data-pm="texto" aria-label="Texto estruturado da parametrização">${esc(m.texto)}</textarea>
      <p class="dica" style="margin:6px 0 0">O texto acompanha os campos enquanto você não o editar. O formato vem dos modelos (Configurações › Parametrizações).</p></div>
  </div>`;
}
function abrirModalParam(g, prm, livre) {
  M = novoParamModal(g, prm); M.livre = !!livre;
  if (!M.textoEditado) M.texto = textoParametrizacao(M);
  abrirModal({ lateral: true, titulo: M.id ? 'Parametrização' : 'Nova parametrização', sub: 'Referência para os próximos atendimentos', icone: 'layers', tamanho: 'g', corpo: htmlModalParam(),
    rodape: `${M.id ? `<button class="btn dng" data-act="pmExcluir">${ic('trash')}Excluir parametrização</button>` : ''}<span class="esp" style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="pmSalvar">${ic('save')}Salvar parametrização</button>` });
}

/* ---------- Cadastrar código (descrição provisória → cadastro da clínica) ---------- */
function abrirModalCadCodigo(codigo) {
  const g = guiaAtiva(), it = g.pedido.itens.find(x => x.codigo === codigo);
  M = { tipo: 'codcad', codigo };
  abrirModal({ titulo: 'Cadastrar código', sub: codigo, icone: 'tag', tamanho: 'p',
    corpo: `<div class="form-grid"><div style="grid-column:1/-1"><label class="lbl" for="ccClinica">Clínica</label><select id="ccClinica" class="sel-busca"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(c => `<option value="${esc(c.id)}" ${S.clinicaId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div style="grid-column:1/-1"><label class="lbl" for="ccDesc">Descrição da terapia</label><input type="text" id="ccDesc" value="${esc((it && it.desc) || '')}" autofocus></div></div>`,
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="cadCodigoOk">${ic('check')}Cadastrar código</button>` });
}

function htmlModalCorrigir() {
  return `<div class="form-grid"><div><label class="lbl" for="cgCart">Carteira</label><input type="text" id="cgCart" class="num" data-cgc="1" value="${esc(M.carteira)}" maxlength="20"></div></div>
    <div class="card-h" style="margin-top:12px"><h3 style="margin:0">Serviços e quantidades</h3><span class="esp"></span><button class="btn sm line" data-act="cgAdd">${ic('plus', 'sm')}Adicionar serviço</button></div>
    <div class="tabela-scroll"><table class="t"><thead><tr><th style="width:140px">Código</th><th>Descrição</th><th style="width:80px">Qtd.</th><th style="width:48px"></th></tr></thead><tbody>
    ${M.itens.map((i, k) => `<tr><td><input type="text" inputmode="numeric" data-cgi="c" data-i="${k}" value="${esc(i.c)}" maxlength="8" aria-label="Código ${k + 1}"></td><td><input type="text" data-cgi="d" data-i="${k}" value="${esc(i.d)}" aria-label="Descrição ${k + 1}"></td><td><input type="text" inputmode="numeric" data-cgi="q" data-i="${k}" value="${esc(i.q)}" maxlength="2" aria-label="Quantidade ${k + 1}"></td><td class="c"><button class="btn sm ghost ico" data-act="cgRem" data-i="${k}" aria-label="Remover serviço" title="Remover serviço">${ic('trash', 'sm')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum serviço.</td></tr>'}
    </tbody></table></div>`;
}

/* ====================================================================
   Painel do dia: visão operacional (sem caixa de pendências por operador)
   ==================================================================== */
let painelDia = isoDia(new Date());
let painelModo = 'dia';   // 'dia' | 'semana' | 'mes'
let painelMes = isoDia(new Date()).slice(0, 7);
// Semana ISO (segunda a domingo), no formato do <input type="week">: AAAA-Www
function semanaDe(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow); const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - a) / 864e5 + 1) / 7)).padStart(2, '0'); }
function intervaloSemana(v) { const m = /^(\d{4})-W(\d{2})$/.exec(v || ''); if (!m) return null; const j4 = new Date(Date.UTC(+m[1], 0, 4)); const seg = new Date(j4); seg.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() || 7) - 1) + (+m[2] - 1) * 7); const dom = new Date(seg); dom.setUTCDate(seg.getUTCDate() + 6); const f = x => x.toISOString().slice(0, 10); return { ini: f(seg), fim: f(dom) }; }
let painelSemana = semanaDe(new Date());
const rotuloSemana = v => { const i = intervaloSemana(v); return i ? diaBR(i.ini).slice(0, 5) + ' a ' + diaBR(i.fim).slice(0, 5) : v; };
const regsDoPeriodo = () => painelModo === 'mes' ? Reg.doMes(painelMes) : painelModo === 'semana' ? (i => Reg.doPeriodo(i.ini, i.fim))(intervaloSemana(painelSemana) || { ini: '', fim: '' }) : Reg.doDia(painelDia);
let painelFiltro = { q: '', status: '', res: '', clinica: '', param: '' };
let conc = null;    // resultado da conciliação
let amostra = null;
const resultadoDe = r => r.status === 'cancelado' ? '' : ((r.resultado && r.resultado.situacao) || (r.status === 'concluido' ? 'autorizada' : ''));
const regPorId = id => [Reg.cache.find(x => x.id === id), Reg.todos[id]].filter(Boolean).sort((a, b) => ((a.atualizadoEm || '') < (b.atualizadoEm || '') ? 1 : -1))[0] || null;   // a versão mais recente (o histórico completo pode estar desatualizado)
function descDiv(d) { let m; if ((m = /^omitido:(.+)$/.exec(d))) return `Omitido na grade: ${m[1]}`; if ((m = /^qtd:(\d+)=(\d+)$/.exec(d))) return `Quantidade divergente em ${m[1]} (informado ${m[2]})`; if ((m = /^duplicado:(.+)$/.exec(d))) return `Duplicado na grade: ${m[1]}`; if ((m = /^indevida:(.+)$/.exec(d))) return `Inclusão indevida (final ${m[1]})`; return String(d).replace(/<[^>]+>/g, ''); }
const descreverDivergencias = divs => divs.map((d, i) => `Tentativa ${i + 1}: ` + (Array.isArray(d) ? d : [d]).map(descDiv).join('; ')).join('\n');
function obsCelula(r) {
  const T = [], rs = r.resultado || {}, divs = (r.conferencia && r.conferencia.divergencias) || [];
  if (r.parametrizado) T.push(tagParam(r.parametrizado));
  if (divs.length) T.push(`<span class="tag warn" title="${esc(descreverDivergencias(divs))}">${ic('alert', 'sm')}${pl(divs.length, 'divergência', 'divergências')}</span>`);
  const ao = (r.alertas || []).filter(a => a.m === 'obs'); if (ao.length) T.push(`<span class="tag obs" title="${esc(ao.map(a => a.t).join('\n'))}">${ic('message', 'sm')}Aviso c/ obs.</span>`);
  if (rs.situacao === 'sem_guia') T.push(`<span class="tag obs" title="${esc('Sem guia gerada: ' + nomeModelo(rs.modelo) + ((r.bloqueios || []).length ? '\n' + r.bloqueios.join('\n') : ''))}">${ic('mail', 'sm')}Sem guia: ${esc(nomeModelo(rs.modelo))}</span>`);
  if ((rs.glosas || []).length) T.push(`<span class="tag warn" title="${esc(rs.glosas.map(x => `${x.c}: glosa ${x.g || '—'}\nMotivo da retirada: ${x.m || '—'}`).join('\n\n'))}">${ic('check', 'sm')}Glosa retirada</span>`);
  if (r.status === 'cancelado') T.push(`<span class="tag bad" title="${esc(r.canceladoMotivo ? 'Motivo: ' + r.canceladoMotivo : 'Guia cancelada')}">${ic('ban', 'sm')}Cancelada</span>`);
  if (r.reaberta) T.push(`<span class="tag info" title="${esc('Reaberta em ' + fmtDH(r.reaberta.em) + ' por ' + (r.reaberta.por || '—') + (r.reaberta.antes && r.reaberta.antes.guia ? '\nAntes: nº ' + r.reaberta.antes.guia + (r.reaberta.antes.situacao ? ' (' + (SIT_ROTULO[r.reaberta.antes.situacao] || r.reaberta.antes.situacao) + ')' : '') : ''))}">${ic('edit', 'sm')}Reaberta</span>`);
  if (r.corrigida) T.push(`<span class="tag info" title="${esc('Corrigida em ' + fmtDH(r.corrigida.em) + ' por ' + (r.corrigida.por || '—') + '\nAntes: carteira ' + (r.corrigida.antes.carteira || '—') + '; itens ' + (r.corrigida.antes.itens || []).join(', '))}">${ic('edit', 'sm')}Corrigida</span>`);
  return T.join(' ');
}
function proximoPasso(r) {
  if (r.status !== 'em_andamento') return '';
  const e = r.etapa || 2;
  return e <= 2 ? 'Resolver alertas e confirmar os dados do pedido' : e === 3 ? 'Lançar no sistema e conferir a grade' : 'Informar número e resultado da guia';
}
const SEM_CLINICA = '__sem';
function filtrarRegs(regs) {
  const f = painelFiltro, termos = norm(f.q).split(' ').filter(Boolean), compacto = String(f.q || '').replace(/[^0-9a-z]/gi, '').toLowerCase();
  return regs.filter(r => {
    if (f.status && r.status !== f.status) return false;
    if (f.res && resultadoDe(r) !== f.res) return false;
    if (f.clinica === SEM_CLINICA ? !!r.clinicaId : f.clinica && (r.clinicaId || '') !== f.clinica) return false;
    if (f.param === 'sim' && !r.parametrizado) return false;
    if (f.param === 'nao' && r.parametrizado) return false;
    if (termos.length) {
      const txt = norm([r.paciente, r.pacienteIni, r.carteira, r.guia, r.assunto, r.clinica, r.remetente, r.operador, r.listaNome, (r.itens || []).map(i => [i.c, i.dc, i.d].filter(Boolean).join(' ')).join(' ')].filter(Boolean).join(' '));
      const doc = String((r.carteira || '') + ' ' + (r.guia || '')).replace(/[^0-9a-z ]/gi, '').toLowerCase().replace(/ /g, '|');
      if (!termos.every(t => txt.includes(t)) && !(compacto.length >= 4 && doc.split('|').some(d => d.includes(compacto)))) return false;
    }
    return true;
  });
}
function csvRegistros(regs) {
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['dia', 'abertura', 'conclusao', 'clinica', 'remetente', 'guia_n', 'guias_no_email', 'carteira', 'itens', 'numero_guia', 'status', 'resultado', 'itens_nao_autorizados', 'motivo_nao_autorizacao', 'parametrizado', 'alertas', 'bloqueios', 'tentativas_conferencia', 'divergencias_conferencia', 'editado_a_mao', 'duracao_min', 'registrado_por', 'aberto_por', 'glosas_retiradas'];
  const linhas = regs.map(r => {
    const rs = r.resultado || {}, neg = (r.itens || []).filter(i => i.aut === false).map(i => i.c).join(' ');
    return [r.dia, fmtHora(r.abertoEm), r.concluidoEm ? fmtHora(r.concluidoEm) : '', r.clinica, r.remetente, (r.idxGuia ?? 0) + 1, r.totalGuias ?? 1, r.carteira, (r.itens || []).map(i => i.c + 'x' + (i.q ?? '?')).join(' '), r.guia, STATUS[r.status] || r.status, SIT_ROTULO[resultadoDe(r)] || '',
      neg, [motivoNome(rs.motivoId), rs.motivoTxt].filter(Boolean).join(' — '), r.parametrizado ? (r.parametrizado.origem || 'sim') : '', (r.alertas || []).map(a => (a.m || '') + ':' + (a.k || a.t)).join(' | '), (r.bloqueios || []).join(' | '),
      r.conferencia?.tentativas ?? '', (r.conferencia?.divergencias || []).map(d => d.join ? d.join('; ') : d).join(' | '), r.editadoAMao ? 'sim' : '', ((r.duracaoSeg || 0) / 60).toFixed(1), r.operador, r.abertoPor || '', ((rs.glosas || []).map(x => `${x.c}: ${x.g} — retirada: ${x.m}`).join(' | '))].map(c).join(';');
  });
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n');
}
/* Esqueleto de carregamento (no lugar de "Carregando…") */
const htmlEsqueleto = (linhas = 6, cartoes = 0) => `<div class="esq" aria-busy="true" aria-label="Carregando">${cartoes ? `<div class="esq-kpis">${'<div class="esq-b esq-kpi"></div>'.repeat(cartoes)}</div>` : ''}<div class="card">${'<div class="esq-b esq-linha"></div>'.repeat(linhas)}</div></div>`;
/* Tempo médio por operador e por clínica, leitura do e-mail sem correção por clínica e clínicas que mais geram correção */
function htmlTempoQualidade(concl) {
  const fmtMin = l => { const c = l.filter(r => r.duracaoSeg); return c.length ? (c.reduce((s, r) => s + r.duracaoSeg, 0) / c.length / 60).toFixed(1).replace('.', ',') + ' min' : '—'; };
  const grupo = (chave, nome) => { const m = new Map(); concl.forEach(r => { const k = chave(r); if (!m.has(k)) m.set(k, { nome: nome(r), regs: [] }); m.get(k).regs.push(r); }); return [...m.values()].sort((a, b) => b.regs.length - a.regs.length); };
  const semCorr = l => { const c = l.filter(r => r.leituraCorrigida != null); if (!c.length) return '<span class="muted">—</span>'; const pc = Math.round(100 * c.filter(r => !r.leituraCorrigida).length / c.length); return `<span class="tag ${pc >= 90 ? 'ok' : pc >= 70 ? 'warn' : 'bad'}">${pc}%</span> <span class="muted">de ${c.length}</span>`; };
  const porOp = grupo(r => r.operadorId || r.operador || '?', r => r.operador || 'Operador');
  const porCl = grupo(r => r.clinicaId || r.clinica || 'sem', r => r.clinica || 'Clínica não identificada');
  const apr = new Map(); Apr.lista.forEach(x => { const k = x.clinica || x.clinicaId || '—'; const o = apr.get(k) || { n: 0, campos: {} }; o.n += x.n || 1; o.campos[x.campo] = (o.campos[x.campo] || 0) + (x.n || 1); apr.set(k, o); });
  const topApr = [...apr.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const CAMPO_N = { codigo: 'código', quantidade: 'quantidade', medico: 'médico', crm: 'CRM', cid: 'CID', local: 'local', emissao: 'data', paciente: 'nome (print)', ident: 'carteira (print)', registro: 'CRM (print)', guia: 'nº da guia (print)', item: 'item (print)' };
  const tab = (cab, linhas) => `<div class="tabela-scroll"><table class="t"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas || `<tr><td colspan="${cab.length}" class="muted">Sem dados no período.</td></tr>`}</tbody></table></div>`;
  return `<div class="card"><div class="card-h"><h2>Tempo e qualidade</h2></div>
    <div class="grid3">
      <div><h3 style="margin-top:0">Por operador</h3>${tab(['Operador', 'Guias', 'Tempo médio'], porOp.map(x => `<tr><td>${esc(x.nome)}</td><td class="c num">${x.regs.length}</td><td class="c num">${fmtMin(x.regs)}</td></tr>`).join(''))}</div>
      <div><h3 style="margin-top:0">Por clínica</h3>${tab(['Clínica', 'Guias', 'Tempo médio', 'E-mail lido sem correção'], porCl.map(x => `<tr><td>${esc(x.nome)}</td><td class="c num">${x.regs.length}</td><td class="c num">${fmtMin(x.regs)}</td><td class="c">${semCorr(x.regs)}</td></tr>`).join(''))}</div>
      <div><h3 style="margin-top:0">Clínicas que mais geram correção</h3>${tab(['Clínica', 'Correções', 'Mais corrigido'], topApr.map(([k, o]) => { const c = Object.entries(o.campos).sort((a, b) => b[1] - a[1])[0]; return `<tr><td>${esc(k)}</td><td class="c num">${o.n}</td><td>${esc(CAMPO_N[c[0]] || c[0])}</td></tr>`; }).join(''))}<p class="dica" style="margin-top:6px">Todas as correções guardadas em Configurações › Aprendizado.</p></div>
    </div>
    <p class="dica" style="margin:8px 0 0">“E-mail lido sem correção”: guias em que ninguém precisou corrigir à mão nome, médico, CID, data, local ou serviços (conta só os atendimentos registrados a partir desta versão). Abaixo de 70%, vale criar uma regra de leitura para a clínica.</p></div>`;
}
async function renderPainel(app) {
  const gen = Redesenho.gen, mesma = !!$('#painelTopo'), y = scrollY;   // redesenho da mesma tela: fica o conteúdo até os dados chegarem e a rolagem volta ao lugar
  if (!mesma) app.innerHTML = htmlEsqueleto(8, 3);
  const mes = painelModo === 'mes', sem = painelModo === 'semana', longo = mes || sem;
  if (longo) await Reg.carregarTudo(); else { const dif = Math.round((new Date() - new Date(painelDia + 'T12:00')) / 864e5); await Reg.carregar(Math.max(0, dif - HIST_DIAS) + 1); }
  await Param.carregar();
  if (gen !== Redesenho.gen) return;   // outra tela foi aberta enquanto carregava
  const base = regsDoPeriodo();
  const todos = base.filter(r => !r.tipo).sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : -1));
  const regs = todos.filter(r => r.status !== 'descartado' && r.status !== 'devolvido');
  const ativos = regs.filter(r => r.status !== 'cancelado');
  const lista = filtrarRegs(regs);
  const n = fn => ativos.filter(fn).length;
  const concl = ativos.filter(r => r.status === 'concluido');
  const emails = unicos(ativos.map(r => r.atendimentoId || r.messageId)).length;
  const pegos = concl.filter(r => (r.conferencia?.divergencias || []).length).length;
  const tempo = concl.length ? (concl.reduce((s, r) => s + (r.duracaoSeg || 0), 0) / concl.length / 60).toFixed(1).replace('.', ',') + ' min' : '—';
  const porClinica = {}; ativos.forEach(r => { const k = r.clinicaId || r.clinica || 'sem'; (porClinica[k] = porClinica[k] || { nome: r.clinica || 'Clínica não identificada', id: r.clinicaId, n: 0 }).n++; });
  const maxC = Math.max(1, ...Object.values(porClinica).map(x => x.n));
  const clinicasDia = unicos(regs.map(r => r.clinicaId).filter(Boolean)), semClinica = regs.some(r => !r.clinicaId);
  if (painelFiltro.clinica && painelFiltro.clinica !== SEM_CLINICA && !clinicasDia.includes(painelFiltro.clinica)) clinicasDia.push(painelFiltro.clinica);   // filtro escolhido em outro período continua visível no seletor
  const per = mes ? 'mês' : sem ? 'semana' : 'dia';
  app.innerHTML = `
  <div class="card" id="painelTopo"><div class="linha-flex">
    <div class="seg" role="radiogroup" aria-label="Visualização"><button type="button" role="radio" aria-checked="${!longo}" class="${!longo ? 'on igual' : ''}" data-act="painelModo" data-v="dia">${ic('calendar', 'sm')} Dia</button><button type="button" role="radio" aria-checked="${sem}" class="${sem ? 'on igual' : ''}" data-act="painelModo" data-v="semana">${ic('calweek', 'sm')} Semana</button><button type="button" role="radio" aria-checked="${mes}" class="${mes ? 'on igual' : ''}" data-act="painelModo" data-v="mes">${ic('calmonth', 'sm')} Mês</button></div>
    ${sem ? `<div><label class="lbl" for="painelSemana">Semana</label><input type="week" id="painelSemana" value="${painelSemana}" style="width:auto"></div>` : mes ? `<div><label class="lbl" for="painelMes">Mês</label><input type="month" id="painelMes" value="${painelMes}" style="width:auto"></div>` : `<div><label class="lbl" for="painelDia">Dia</label><input type="date" id="painelDia" value="${painelDia}" style="width:auto"></div>`}
    <button class="btn" data-act="atualizarPainel" style="align-self:flex-end">${ic('refresh')}Atualizar</button>
    <span style="flex:1"></span>
    <button class="btn line" id="btnCsv" data-act="exportarCsv" style="align-self:flex-end" ${lista.length ? '' : 'disabled'} title="Exporta as linhas exibidas na tabela (respeita os filtros)">${ic('download')}Exportar CSV (<span id="nCsv">${lista.length}</span>)</button></div></div>
  <div class="kpis">${[
    ['info', emails, 'E-mails com atendimento', true], ['', ativos.length, 'Guias no ' + per, true],
    ['ok', n(r => resultadoDe(r) === 'autorizada'), 'Autorizadas'], ['warn', n(r => resultadoDe(r) === 'parcial'), 'Parcialmente autorizadas'], ['bad', n(r => resultadoDe(r) === 'nao'), 'Não autorizadas'],
    ['obs', n(r => resultadoDe(r) === 'sem_guia'), 'Sem guia gerada (pendência)'], ['info', n(r => r.status === 'em_andamento'), 'Em andamento'], ['ac', n(r => r.parametrizado), 'Parametrizadas'],
    ['bad', regs.filter(r => r.status === 'cancelado').length, 'Canceladas'], ['', pegos, 'Divergências pegas na conferência'], ['', concl.length ? tempo : 0, 'Tempo médio por guia']
  ].filter(k => k[3] || (k[1] && k[1] !== 0)).map(([c, v, t]) => `<div class="kpi ${c}"><b>${v}</b><span>${t}</span></div>`).join('')}
  </div>
  <div class="card"><div class="card-h"><h2>Guias por clínica</h2></div>
    ${Object.values(porClinica).sort((a, b) => b.n - a.n).map(x => { const cl = cfg.clinicas.find(c => c.id === x.id); return `<div class="barra-clinica idc ${cl ? corClinica(cl) : ''}"><div>${htmlClinica(cl, x.nome)}</div><div class="trilho"><i style="width:${Math.round(x.n / maxC * 100)}%"></i></div><b class="num">${x.n}</b></div>`; }).join('') || '<p class="muted">Sem registros neste período.</p>'}</div>
  ${htmlTempoQualidade(concl)}
  <div class="card">
    <div class="card-h"><h2 id="guiasPainelTit">${tituloGuiasPainel(per, lista, regs)}</h2></div>
    <div class="filtros" style="margin-bottom:12px">
      <div><label class="lbl" for="fQ">Buscar</label><div class="busca">${ic('search', 'sm')}<input type="search" id="fQ" data-fp="q" value="${esc(painelFiltro.q)}" placeholder="Beneficiário, carteira, guia, clínica, código…" autocomplete="off"></div></div>
      <div><label class="lbl" for="fS">Status</label><select id="fS" data-fp="status"><option value="">Todos</option>${['em_andamento', 'concluido', 'cancelado'].map(s => `<option value="${s}" ${painelFiltro.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></div>
      <div><label class="lbl" for="fR">Resultado</label><select id="fR" data-fp="res"><option value="">Todos</option>${Object.entries(SIT_ROTULO).map(([k, v]) => `<option value="${k}" ${painelFiltro.res === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label class="lbl" for="fC">Clínica</label><select id="fC" data-fp="clinica"><option value="">Todas</option>${clinicasDia.map(id => { const c = cfg.clinicas.find(x => x.id === id); return `<option value="${esc(id)}" ${painelFiltro.clinica === id ? 'selected' : ''}>${esc(c ? c.nome : id)}</option>`; }).join('')}${semClinica || painelFiltro.clinica === SEM_CLINICA ? `<option value="${SEM_CLINICA}" ${painelFiltro.clinica === SEM_CLINICA ? 'selected' : ''}>Clínica não identificada</option>` : ''}</select></div>
      <div><label class="lbl" for="fP">Parametrização</label><select id="fP" data-fp="param"><option value="">Todas</option><option value="sim" ${painelFiltro.param === 'sim' ? 'selected' : ''}>Parametrizadas</option><option value="nao" ${painelFiltro.param === 'nao' ? 'selected' : ''}>Não parametrizadas</option></select></div>
      <div><button class="btn ghost" id="btnLimparFiltros" data-act="limparFiltros" ${Object.values(painelFiltro).some(Boolean) ? '' : 'disabled'}>${ic('x', 'sm')}Limpar filtros</button></div>
    </div>
    <div class="tabela-scroll"><table class="t" id="tabGuiasPainel"><thead><tr><th>${longo ? 'Data' : 'Hora'}</th><th>Clínica</th><th>Guia</th><th>Carteira</th><th>Serviços</th><th>Nº da guia</th><th>Status</th><th>Resultado</th><th>Observações</th><th></th></tr></thead><tbody>
    ${htmlLinhasGuiasPainel(lista, regs, longo)}
    </tbody></table></div>
  </div>
  ${longo ? '' : `<div class="card">
    <div class="card-h"><h2>Amostragem do apoio</h2></div>
    <p class="dica" style="margin:0 0 8px">Sorteia até 10 guias concluídas no dia (primeiro as com 4 ou mais itens) para a equipe de apoio conferir por amostragem no sistema. A lista aparece aqui depois do sorteio e não fica gravada.</p>
    <div class="acoes" style="margin-top:0"><button class="btn" data-act="sortear">${ic('refresh')}Sortear amostra</button></div>
    ${amostra ? `<div class="tabela-scroll" style="margin-top:10px"><table class="t"><thead><tr><th>Guia</th><th>Resultado</th><th>Carteira</th><th>Itens (código × qtd.)</th></tr></thead><tbody>${amostra.map(r => `<tr><td class="num">${esc(r.guia)}</td><td>${tagResultado(resultadoDe(r))}</td><td class="num">${esc(r.carteira)}</td><td class="num">${r.itens.map(i => i.c + ' × ' + i.q).join(' · ')}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div>
  <div class="card">
    <div class="card-h"><h2>Conciliação de fim de dia</h2></div>
    <div class="grid2">
      <div>
        <h3 style="margin-top:0">E-mails recebidos × registros</h3>
        <p class="dica">ZIP do SmarterMail ou vários .eml.</p>
        <input type="file" id="arqConc" accept=".zip,.eml" multiple>
      </div>
      <div>
        <h3 style="margin-top:0">Relatório de guias do sistema × registros</h3>
        <p class="dica">Cole o relatório de guias do dia.</p>
        <textarea id="txtRelatorio" rows="5"></textarea>
        <div class="acoes"><button class="btn" data-act="conciliarGuias">${ic('check')}Comparar guias</button></div>
      </div>
    </div>
    <div id="resConc">${conc || ''}</div>
  </div>`}`;
  if (mesma) window.scrollTo(0, y);
}
/* botão só com ícone na tabela de guias: o nome aparece na dica (passar o mouse ou focar com Tab) e é lido pelo leitor de tela */
const btnIcone = (act, id, icone, nome, dica, cls = 'line') => `<button class="btn sm ico ${cls}" data-act="${act}" data-id="${esc(id)}" title="${esc(nome + ': ' + dica)}" aria-label="${esc(nome)}">${ic(icone, 'sm')}</button>`;
const tituloGuiasPainel = (per, lista, regs) => `Guias do ${per} (${lista.length}${lista.length !== regs.length ? ' de ' + regs.length : ''})`;
function htmlLinhasGuiasPainel(lista, regs, longo) {
  return lista.map(r => {
      const tot = r.totalGuias || 1, canc = r.status === 'cancelado';
      return `<tr style="${canc ? 'opacity:.7' : ''}"><td class="c num">${longo ? fmtData(r.abertoEm) + '<br>' : ''}${fmtHora(r.abertoEm)}</td><td>${htmlClinica(cfg.clinicas.find(c => c.id === r.clinicaId), r.clinica || r.remetente)}${r.operador ? `<div style="margin-top:4px" title="Quem gerou">${htmlOperador(r.operador, r.operadorId)}</div>` : ''}</td>
      <td class="c">${tot > 1 ? `<span class="sq idc idc-${(r.idxGuia || 0) % 10}" title="Guia ${(r.idxGuia || 0) + 1} de ${tot}">${(r.idxGuia || 0) + 1}/${tot}</span>` : '—'}</td>
      <td class="num">${esc(r.carteira || '')}</td><td class="num">${(r.itens || []).map(i => `${i.c} × ${i.q ?? '?'}${i.aut === false ? ' <span class="tag bad">' + ic('x', 'sm') + 'negado</span>' : ''}`).join('<br>')}</td><td class="num"><b>${esc(r.guia || '')}</b></td>
      <td>${tagStatus(r.status)}${r.status === 'em_andamento' ? `<div class="proximo">${esc(proximoPasso(r))}</div>` : ''}</td>
      <td>${tagResultado(resultadoDe(r))}</td>
      <td>${obsCelula(r)}</td>
      <td class="c"><div class="acoes-ic">${podeReabrir(r) ? btnIcone('reabrirRegistro', r.id, 'undo', 'Reabrir', 'abre a guia de novo na etapa 4 para corrigir número, situação, observação ou resposta (o registro só muda ao concluir)') : ''}${r.status === 'concluido' ? btnIcone('corrigirGuia', r.id, 'edit', 'Corrigir guia', 'troca só a carteira e os serviços, sem reabrir') + btnIcone('cancelarGuia', r.id, 'ban', 'Cancelar guia', 'marca a guia como cancelada (com motivo)') : ''}${btnIcone('verGuia', r.id, 'eye', 'Ver histórico', 'prints enviados, o que foi lido, ignorado, copiado e respondido')}${btnIcone('excluirGuia', r.id, 'trash', 'Excluir guia', 'apaga o registro (não dá para desfazer)', 'dng')}</div></td></tr>`;
    }).join('') || `<tr><td colspan="10" class="muted">${regs.length ? 'Nenhuma guia corresponde aos filtros.' : 'Nenhum registro neste período.'}</td></tr>`;
}
/* filtros e busca: repinta só a tabela com os registros já carregados (sem reler a pasta, sem tirar o foco da busca, sem mexer na rolagem) */
function repintarGuiasPainel() {
  const tab = $('#tabGuiasPainel'); if (aba !== 'painel' || !tab) { render(); return; }
  const longo = painelModo !== 'dia', per = painelModo === 'mes' ? 'mês' : painelModo === 'semana' ? 'semana' : 'dia';
  const regs = regsDoPeriodo().filter(r => !r.tipo && r.status !== 'descartado' && r.status !== 'devolvido').sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : -1)), lista = filtrarRegs(regs);
  tab.tBodies[0].innerHTML = htmlLinhasGuiasPainel(lista, regs, longo);
  $('#guiasPainelTit').textContent = tituloGuiasPainel(per, lista, regs);
  const csv = $('#btnCsv'); if (csv) { csv.disabled = !lista.length; $('#nCsv').textContent = lista.length; }
  const lf = $('#btnLimparFiltros'); if (lf) lf.disabled = !Object.values(painelFiltro).some(Boolean);
}
async function conciliarEmails(files) {
  const emails = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) { for (const x of await lerZip(await f.arrayBuffer())) if (/\.eml$/i.test(x.nome)) { try { emails.push(lerEml(x.dados)); } catch (e) { } } }
    else if (/\.eml$/i.test(f.name)) { try { emails.push(lerEml(await f.arrayBuffer())); } catch (e) { } }
  }
  emails.sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1);
  await Reg.carregar(7);
  const porMsg = {}; Reg.cache.filter(r => !r.tipo).forEach(r => (porMsg[r.messageId] = porMsg[r.messageId] || []).push(r));
  const semReg = [], naoConcl = [], varias = [];
  for (const e of emails) {
    const todos = porMsg[e.messageId] || [];
    const rs = todos.filter(r => r.status !== 'descartado');
    if (!todos.length) semReg.push(e);
    else if (!rs.length) continue;
    else if (!rs.some(r => ['concluido', 'aguardando_clinica'].includes(r.status))) naoConcl.push([e, rs]);
    else if (rs.some(r => r.status === 'em_andamento')) naoConcl.push([e, rs.filter(r => r.status === 'em_andamento')]);
    const porIdx = {}; rs.filter(r => r.status === 'concluido').forEach(r => (porIdx[r.idxGuia || 0] = porIdx[r.idxGuia || 0] || []).push(r));
    Object.values(porIdx).filter(x => x.length > 1).forEach(x => varias.push([e, x]));
  }
  const ehResposta = e => /^\s*(re|res)\s*:/i.test(e.assunto);
  const lin = (e, x) => `<li><b>${fmtHora(e.data)}</b> · ${esc(e.remetente.email)} · ${esc(e.assunto)}${x ? ' — ' + x : ''}</li>`;
  conc = `<h3>Resultado: ${pl(emails.length, 'e-mail lido', 'e-mails lidos')}</h3>
  <p class="linha-flex"><span class="tag ${semReg.length ? 'bad' : 'ok'}">${ic(semReg.length ? 'alert' : 'check', 'sm')}${semReg.length} sem nenhum registro</span> <span class="tag ${naoConcl.length ? 'warn' : 'ok'}">${ic(naoConcl.length ? 'alert' : 'check', 'sm')}${naoConcl.length} com guia sem conclusão</span> <span class="tag ${varias.length ? 'bad' : 'ok'}">${ic(varias.length ? 'alert' : 'check', 'sm')}${varias.length} com a mesma guia concluída mais de uma vez</span></p>
  ${semReg.length ? `<p class="dica">Sem registro: não passaram pela página (podem ser respostas, evoluções ou pedidos esquecidos).</p><ul>${semReg.map(e => lin(e, ehResposta(e) ? 'resposta' : '')).join('')}</ul>` : ''}
  ${naoConcl.length ? `<p class="dica">Abertos mas não concluídos:</p><ul>${naoConcl.map(([e, rs]) => lin(e, rs.map(r => `guia ${(r.idxGuia || 0) + 1}: ${STATUS[r.status]}`).join(', '))).join('')}</ul>` : ''}
  ${varias.length ? `<p class="dica">Mesma guia do e-mail concluída mais de uma vez:</p><ul>${varias.map(([e, rs]) => lin(e, rs.map(r => r.guia + ' (' + r.operador + ')').join(', '))).join('')}</ul>` : ''}`;
  $('#resConc').innerHTML = conc;
}
function conciliarGuias() {
  const txt = $('#txtRelatorio').value.toUpperCase();
  const doRel = new Set([...txt.matchAll(/([TS])\s?(\d{7,8})/g)].map(m => m[1] + m[2]));
  const regs = Reg.doDia(painelDia).filter(r => !r.tipo && r.status === 'concluido');
  const daPag = new Set(regs.map(r => r.guia));
  const soRel = [...doRel].filter(g => !daPag.has(g)), soPag = regs.filter(r => !doRel.has(r.guia));
  conc = `<h3>Guias: ${doRel.size} no relatório · ${daPag.size} na página</h3>
  <p class="linha-flex"><span class="tag ${soRel.length ? 'bad' : 'ok'}">${ic(soRel.length ? 'alert' : 'check', 'sm')}${soRel.length} só no relatório</span> <span class="tag ${soPag.length ? 'bad' : 'ok'}">${ic(soPag.length ? 'alert' : 'check', 'sm')}${soPag.length} só na página</span></p>
  ${soRel.length ? `<p class="dica">Guias geradas no sistema sem conferência registrada na página:</p><p class="num">${soRel.join(' · ')}</p>` : ''}
  ${soPag.length ? `<p class="dica">Registradas na página mas ausentes no relatório (número digitado errado?):</p><ul>${soPag.map(r => `<li class="num">${esc(r.guia)} — ${esc(r.operador)} · ${esc(r.clinica || '')} · ${esc(r.carteira)}</li>`).join('')}</ul>` : ''}`;
  $('#resConc').innerHTML = conc;
}

/* ====================================================================
   Aba Ações: onde está cada guia (lendo o pedido, gerando guia, anexando e-mail)
   ==================================================================== */
async function renderQuadro(app) {
  const gen = Redesenho.gen;
  app.innerHTML = htmlEsqueleto(5);
  await Reg.carregar();
  await Presenca.bater(); await Presenca.ler();
  if (gen !== Redesenho.gen) return;   // outra tela foi aberta enquanto a pasta respondia: não pinta por cima dela
  app.innerHTML = htmlPresenca() + htmlAuditar() + htmlQuadroGuias();
}
/* repinta só a presença e o quadro (a busca do Auditar fica como está); chamado a cada 30 s com a aba aberta */
function repintarQuadro() {
  if (aba !== 'quadro' || Redesenho.baixo) return;
  const pres = $('#cardPresenca'), cab = $('#cardQuadro'), cols = $('#quadroCols'); if (!pres || !cab || !cols) return;
  pres.outerHTML = htmlPresenca(); cols.remove(); cab.outerHTML = htmlQuadroGuias();
}
function htmlQuadroGuias() {
  const lim = Number(cfg.preferencias.acoesMinutos) || 0, hoje = isoDia(new Date());
  const lista = guiasEmAndamento();
  const cols = [
    [2, 'Lendo o pedido', 'search', 'Pedido e alertas (etapas 1 e 2)'],
    [3, 'Gerando guia', 'filecheck', 'Guia e conferência (etapa 3)'],
    [4, 'Anexando e-mail', 'mail', 'Finalizar: observação e resposta (etapa 4)']
  ];
  const col = r => { const v = r.vista || r.etapa || 2; return v <= 2 ? 2 : v >= 4 ? 4 : 3; };
  return `<div class="card" id="cardQuadro"><div class="card-h"><h2>Guias em andamento hoje</h2><span class="tag ${lista.length ? 'info' : 'ok'}">${ic(lista.length ? 'clip' : 'check', 'sm')}${lista.length ? pl(lista.length, 'guia', 'guias') : 'Nada em andamento'}</span><span class="esp"></span><span class="muted" style="font-size:var(--fs-sm)">${diaBR(hoje)}</span><button class="btn sm line" data-act="atualizarQuadro">${ic('refresh', 'sm')}Atualizar lista</button></div>
    <p class="dica" style="margin:0">Beneficiário × clínica de cada guia aberta, na etapa em que está. <b>Ao vivo</b>: alguém está com ela aberta agora (atualiza a cada 30 s). ${lim ? `Guia parada (ninguém com ela aberta) some depois de ${lim} min sem movimento.` : ''}</p></div>
  <div class="quadro" id="quadroCols">${cols.map(([n, t, i, d]) => { const its = lista.filter(r => col(r) === n);
    return `<section class="col-q"><h3>${ic(i)}${t} <span class="tag">${its.length}</span></h3><p class="dica" style="margin:-6px 0 10px">${d}</p>
    ${its.map(r => { const cl = cfg.clinicas.find(c => c.id === r.clinicaId), ms = Date.now() - new Date(r.desde), min = r.desde && Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
      const tot = presInt(r.totalGuias, 1, 99, 1), idx = presInt(r.idxGuia, 0, 98, 0), par = presInt(r.parado, 0, 99999, 0), nIt = presInt((r.itens || []).length, 0, 999, 0);   // números vindos de arquivos da pasta
      const estado = r.aoVivo ? `<span class="tag ok">${ic('activity', 'sm')}ao vivo</span>${r.ativa ? '' : ' <span class="tag">aberta, em outra guia do e-mail</span>'}${r.visivel === false ? ' <span class="tag">em outra janela</span>' : ''}` : `<span class="tag warn">${ic('pause', 'sm')}parada há ${pl(par, 'min', 'min')}</span>`;
      return `<div class="card-q ${r.aoVivo ? '' : 'parada'}"><div class="t1">${esc(r.paciente || r.pacienteIni || 'Beneficiário')} <span class="muted">×</span> ${htmlClinica(cl, r.clinica || r.remetente)}</div>
      <div class="proximo">${tot > 1 ? `Guia ${idx + 1} de ${tot} · ` : ''}<span class="num">${esc(r.carteira || 'sem carteira')}</span> · ${pl(nIt, 'item', 'itens')}${min != null ? ` · nesta etapa há ${min < 1 ? 'menos de 1 min' : min + ' min'}` : ''}</div>
      <div class="linha-flex" style="margin-top:6px">${htmlOperador(r.operador, r.operadorId)}${estado}</div></div>`; }).join('') || '<p class="muted" style="font-size:var(--fs-sm)">Nenhuma guia nesta etapa.</p>'}</section>`; }).join('')}</div>`;
}
