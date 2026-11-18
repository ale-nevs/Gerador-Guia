'use strict';
/* ====================================================================
   Configurações (seções) — rascunho em cfgEdit, salvo só ao clicar em Salvar
   ==================================================================== */
let cfgEdit = null, cfgSecao = 'aparencia', cfgDirty = false, cfgErros = [], cfgClinicaSel = 0;
const cfgModeloSel = { modelos: 'autorizada', obs: 'observacao', param: 'parametrizacao' };
const CFG_SECOES = [
  ['aparencia', 'palette', 'Aparência'], ['perfil', 'user', 'Perfil e identificação'], ['clinicas', 'building', 'Clínicas e cadastros'],
  ['modelos', 'mail', 'Modelos de e-mail'], ['obs', 'message', 'Modelo de observação da guia'], ['obsauto', 'zap', 'Observações automáticas'], ['param', 'layers', 'Parametrizações'],
  ['alertas', 'bell', 'Alertas e regras de validação'], ['export', 'download', 'Exportação'], ['prefs', 'sliders', 'Preferências operacionais'], ['testes', 'search', 'Testar leitura (prints e e-mails)'], ['aprendizado', 'book', 'Aprendizado (correções)'], ['info', 'info', 'Informações e versão do sistema']
];
let cfgOpsIni = [];
function iniciarCfgEdit() {
  cfgEdit = clonar(cfg); cfgOpsIni = cfg.operadores.map(o => o.id); cfgDirty = false; cfgErros = [];
  cfgEdit.clinicas.forEach(cl => { cl.leitura = normLeitura(cl.leitura); cl._lista = Object.entries(cl.codigos || {}).map(([c, d]) => ({ c, d })).sort((a, b) => a.c < b.c ? -1 : 1); });
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const alvo = ks.reduce((a, k) => a[k], o); alvo[last] = v; }
function marcarSujo() { cfgDirty = true; const b = $('#cfgBarra'); if (b) atualizarBarraCfg(); }
function atualizarBarraCfg() {
  const b = $('#cfgBarra'); if (!b) return;
  $('#cfgSalvar').disabled = !cfgDirty; $('#cfgDescartar').disabled = !cfgDirty;
  $('#cfgEstado').innerHTML = cfgDirty ? `<span class="tag warn">${ic('alert', 'sm')}Alterações não salvas</span>` : `<span class="muted" style="font-size:var(--fs-sm)">${ic('check', 'sm')} Tudo salvo</span>`;
}
function validarCfg(c) {
  const E = [], add = (s, m) => E.push({ s, m });
  const ops = new Set();
  c.operadores.forEach((o, i) => { if (!hexValido(o.corRgb)) add('perfil', `Operador ${i + 1}: cor inválida.`); const n = norm(o.nome); if (!n) add('perfil', `Operador ${i + 1}: informe o nome de exibição.`); else if (ops.has(n)) add('perfil', `Há dois operadores chamados “${o.nome}”.`); ops.add(n); });
  if (!c.operadores.length) add('perfil', 'Cadastre ao menos um operador.');
  const nomes = new Set(), emails = {};
  c.clinicas.forEach((cl, i) => {
    const rot = cl.nome || `Clínica ${i + 1}`;
    if (!cl.nome.trim()) add('clinicas', `Clínica ${i + 1}: informe o nome.`); else if (nomes.has(norm(cl.nome))) add('clinicas', `Há duas clínicas chamadas “${cl.nome}”.`); nomes.add(norm(cl.nome));
    cl.emails.forEach(e => { if (!emailValido(e)) add('clinicas', `${rot}: e-mail inválido “${e}”.`); else if (emails[e] && emails[e] !== cl.id) add('clinicas', `O e-mail ${e} está em mais de uma clínica.`); emails[e] = cl.id; });
    const cods = new Set();
    lerTrocas(cl.leitura && cl.leitura.trocas).erros.forEach(l => add('clinicas', `${rot}: na regra de códigos, a linha “${l}” não está no formato escrito = certo (ex.: 5000470 = 50000470).`));
    cl._lista.forEach(x => { if (!x.c.trim() && !x.d.trim()) return; if (!/^\d{8}$/.test(x.c.trim())) add('clinicas', `${rot}: código “${x.c}” não tem 8 dígitos.`); else if (cods.has(x.c.trim())) add('clinicas', `${rot}: código ${x.c} repetido.`); cods.add(x.c.trim()); });
  });
  Object.entries(c.modelos).forEach(([k, m]) => {
    if (!htmlPlano(m.html).trim()) add(MODELOS_META[k].destino === 'texto' ? (k.startsWith('parametrizacao') ? 'param' : 'obs') : 'modelos', `Modelo “${c.modelos[k].nome}”: o texto não pode ficar vazio.`);
    [...m.html.matchAll(/\{([A-Z_]+)\}/g)].forEach(x => { if (!CAMPO[x[1]]) add(MODELOS_META[k].destino === 'texto' ? 'obs' : 'modelos', `Modelo “${c.modelos[k].nome}”: campo desconhecido {${x[1]}}.`); });
  });
  MODELOS_PERSONALIZADOS.forEach(k => { if (!(c.modelos[k].nome || '').trim()) add('modelos', 'Modelo personalizado: informe o nome.'); });
  const mots = new Set();
  c.motivos.forEach((m, i) => { const n = norm(m.nome); if (!n) add('prefs', `Motivo ${i + 1}: informe o texto.`); else if (mots.has(n)) add('prefs', `Motivo repetido: “${m.nome}”.`); mots.add(n); });
  if (!Number.isInteger(c.preferencias.acoesMinutos) || c.preferencias.acoesMinutos < 0 || c.preferencias.acoesMinutos > 1440) add('prefs', 'O tempo para limpar a aba Ações deve ser um número de 0 a 1440 minutos.');
  if (!Number.isInteger(c.preferencias.qtdMax) || c.preferencias.qtdMax < 1 || c.preferencias.qtdMax > 99) add('prefs', 'A quantidade máxima por serviço deve ser um número de 1 a 99.');
  return E;
}
function prepararSalvar(c) {
  c.operadores.forEach(o => { o.nome = o.nome.trim(); });
  c.clinicas.forEach(cl => {
    cl.nome = cl.nome.trim(); cl.cidade = (cl.cidade || '').trim(); cl.executante = (cl.executante || '').trim(); cl.apelidos = (cl.apelidos || '').trim();
    cl.emails = unicos(cl.emails.map(e => e.trim().toLowerCase()).filter(Boolean));
    cl.codigos = {}; cl._lista.forEach(x => { const k = x.c.trim(); if (k) cl.codigos[k] = x.d.trim(); });
  });
  c.motivos.forEach(m => { m.nome = m.nome.trim(); m.id = m.id || slug(m.nome); });
  c.preferencias.qtdMax = Number(c.preferencias.qtdMax); c.preferencias.acoesMinutos = Number(c.preferencias.acoesMinutos);
  c.glosas = unicos((c.glosas || []).map(g => String(g).trim()).filter(Boolean));
}

async function renderConfig(app) {
  if (!cfgEdit) iniciarCfgEdit();
  if (cfgSecao === 'param') await Param.carregar();
  const nErr = cfgErros.length;
  // redesenhar não pode mover a tela: guarda rolagem da página, da lista de clínicas e dos filtros, e devolve depois
  const ant = $('.cfg') ? { y: scrollY, secao: renderConfig.secao, clin: renderConfig.clin, lista: ($('#listaCl') || {}).scrollTop || 0, cod: ($('#tabCod') && $('#tabCod').closest('.tabela-scroll') || {}).scrollTop || 0, nav: ($('.cfg-nav') || {}).scrollLeft || 0, bCl: ($('#buscaCl') || {}).value || '', bCod: ($('#buscaCod') || {}).value || '' } : null;
  renderConfig.secao = cfgSecao; renderConfig.clin = cfgClinicaSel;
  app.innerHTML = `<div class="cfg"><nav class="card cfg-nav" aria-label="Seções de configuração">${CFG_SECOES.map(([k, i, t]) => `<button data-act="cfgSecao" data-s="${k}" class="${cfgSecao === k ? 'ativo' : ''}" ${cfgSecao === k ? 'aria-current="true"' : ''}>${ic(i)}${t}</button>`).join('')}</nav>
    <div id="cfgCorpo">${nErr ? `<div class="erros-cfg" role="alert"><b>${ic('alert', 'sm')} Não foi possível salvar. Corrija os itens abaixo:</b><ul>${cfgErros.map(e => `<li>${esc(e.m)} <a href="#" data-act="cfgSecao" data-s="${e.s}">(ir para ${esc(CFG_SECOES.find(x => x[0] === e.s)[2])})</a></li>`).join('')}</ul></div>` : ''}${htmlCfgSecao()}</div></div>
    <div class="cfg-barra" id="cfgBarra" ${cfgSecao === 'testes' ? 'hidden' : ''}><span id="cfgEstado"></span><span class="esp"></span>
      <button class="btn" id="cfgDescartar" data-act="descartarCfg">${ic('undo')}Descartar alterações</button>
      <button class="btn pri" id="cfgSalvar" data-act="salvarCfg">${ic('save')}Salvar configurações</button></div>`;
  atualizarBarraCfg();
  if (cfgSecao === 'modelos' || cfgSecao === 'obs' || cfgSecao === 'param') montarEditorModelo();
  if (ant) {
    const nav = $('.cfg-nav'); if (nav) nav.scrollLeft = ant.nav;
    if (ant.secao === cfgSecao) {
      const filtrar = (sel, v) => { const el = $(sel); if (el && v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
      filtrar('#buscaCl', ant.bCl);
      const l = $('#listaCl'); if (l) l.scrollTop = ant.lista;
      if (ant.clin === cfgClinicaSel) { filtrar('#buscaCod', ant.bCod); const tc = $('#tabCod') && $('#tabCod').closest('.tabela-scroll'); if (tc) tc.scrollTop = ant.cod; }
      window.scrollTo(0, ant.y);
    } else {   // outra seção: fica onde está, só sobe até o começo das configurações se a tela estiver abaixo dele
      const topo = $('.cfg').getBoundingClientRect().top + scrollY - 80;
      window.scrollTo(0, Math.min(ant.y, Math.max(0, topo)));
    }
  }
}
/* ---------- PIN do supervisor: regras de leitura, alertas e modelos ---------- */
const Pin = {
  ate: 0,
  definido() { return !!(cfg.supervisor && cfg.supervisor.pinHash); },
  liberado() { return !this.definido() || Date.now() < this.ate; },
  async confere(pin) { const s = cfg.supervisor; return !!(s && s.pinHash) && (await Senha.hash(pin, s.pinSalt)) === s.pinHash; },
  liberar() { this.ate = Date.now() + 15 * 60000; }
};
const SECOES_PIN = ['modelos', 'obs', 'obsauto', 'alertas'];
const htmlTrancado = oque => `<div class="card trancado-pin">${ic('lock', 'xl')}<h2>Seção protegida pelo PIN do supervisor</h2><p class="dica">${oque}</p>
  <div class="linha-flex" style="justify-content:center"><input type="password" id="pinIn" inputmode="numeric" maxlength="12" placeholder="PIN" data-enter="pinLiberar" style="width:160px" autocomplete="off" aria-label="PIN do supervisor"><button class="btn pri" data-act="pinLiberar">${ic('lock', 'sm')}Liberar</button></div>
  <p class="dica" style="margin-top:8px">Fica liberado por 15 minutos neste computador.</p></div>`;
function pedirPin(depois) {
  abrirModal({ titulo: 'PIN do supervisor', sub: 'Necessário para mudar regras, alertas e modelos', icone: 'lock', tamanho: 'p',
    corpo: `<label class="lbl" for="pinModal">PIN</label><input type="password" id="pinModal" inputmode="numeric" maxlength="12" autocomplete="off" data-enter="pinModalOk">`,
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="pinModalOk">${ic('lock', 'sm')}Liberar</button>` });
  Pin.depois = depois;
}
function cfgPin() {
  const s = cfgEdit.supervisor, def = !!(s && s.pinHash);
  return `<div class="card">${cabSecao('PIN do supervisor', 'Protege as regras de leitura das clínicas, os alertas, os modelos de texto, a importação de configurações e o “Virar regra” do Aprendizado. Os operadores continuam atendendo normalmente.')}
    ${!def ? `<div class="form-grid" style="max-width:520px"><div><label class="lbl" for="pinNovo">Novo PIN (4 a 12 dígitos)</label><input type="password" id="pinNovo" inputmode="numeric" maxlength="12" autocomplete="new-password"></div><div><label class="lbl" for="pinConf">Repita o PIN</label><input type="password" id="pinConf" inputmode="numeric" maxlength="12" autocomplete="new-password"></div></div>
      <div class="acoes"><button class="btn pri" data-act="pinDefinir">${ic('lock', 'sm')}Definir PIN</button></div>`
    : !Pin.liberado() ? `<p style="margin:0 0 8px">${ic('lock', 'sm')} PIN definido. Libere para trocar ou remover.</p><button class="btn" data-act="pinPedir">${ic('lock', 'sm')}Liberar com o PIN</button>`
    : `<p style="margin:0 0 8px">${ic('check', 'sm')} PIN definido e liberado neste computador (até ${fmtHora(new Date(Pin.ate))}).</p>
      <div class="form-grid" style="max-width:520px"><div><label class="lbl" for="pinNovo">Novo PIN</label><input type="password" id="pinNovo" inputmode="numeric" maxlength="12" autocomplete="new-password"></div><div><label class="lbl" for="pinConf">Repita o novo PIN</label><input type="password" id="pinConf" inputmode="numeric" maxlength="12" autocomplete="new-password"></div></div>
      <div class="acoes"><button class="btn" data-act="pinDefinir">${ic('lock', 'sm')}Trocar PIN</button><button class="btn dng" data-act="pinRemover">${ic('trash', 'sm')}Remover PIN</button><button class="btn ghost" data-act="pinTrancar">Trancar agora</button></div>`}
  </div>`;
}
function htmlCfgSecao() {
  if (SECOES_PIN.includes(cfgSecao) && !Pin.liberado()) return htmlTrancado('Alertas, modelos de texto e observações automáticas só podem ser alterados pelo supervisor.');
  switch (cfgSecao) {
    case 'aparencia': return cfgAparencia();
    case 'perfil': return cfgPerfil() + cfgPin();
    case 'clinicas': return cfgClinicas();
    case 'modelos': return cfgModelos('modelos', k => MODELOS_META[k].destino === 'email', 'Modelos de e-mail', 'Textos das respostas enviadas às clínicas. Aceitam negrito, itálico, cor, listas e campos dinâmicos.');
    case 'obs': return cfgModelos('obs', k => ['observacao', 'obs_parametrizado'].includes(k), 'Modelo de observação da guia', 'Textos do campo de observação da guia no sistema oficial. São copiados como texto simples.');
    case 'obsauto': return cfgObsAuto();
    case 'param': return cfgParam();
    case 'alertas': return cfgAlertas();
    case 'export': return cfgExport();
    case 'prefs': return cfgPrefs() + htmlArmazenamento();
    case 'info': return cfgInfo();
    case 'testes': return cfgTestes();
    case 'aprendizado': return cfgAprendizado();
  }
  return '';
}
const cabSecao = (t, d) => `<div class="card-h"><h2>${t}</h2></div>`;

/* ---------- 1. Aparência ---------- */
function cfgAparencia() {
  const p = Tema.pref(), dz = Vis.densa() ? 'compacta' : 'confortavel';
  const den = (v, i, t) => `<button type="button" class="sit ${dz === v ? 'on autorizada' : ''}" role="radio" aria-checked="${dz === v}" data-act="densidade" data-v="${v}">${ic(i, 'lg')}<span><b>${t}</b></span></button>`;
  const op = (v, i, t, d) => `<button type="button" class="sit ${p === v ? 'on autorizada' : ''}" role="radio" aria-checked="${p === v}" data-act="setTema" data-v="${v}">${ic(i, 'lg')}<span><b>${t}</b></span></button>`;
  return `<div class="card">${cabSecao('Aparência', 'Vale para este computador e é lembrada ao reabrir o sistema. Também pode ser alternada pelo botão no topo da página.')}
    <div class="sit-opcoes" role="radiogroup" aria-label="Tema">${op('auto', 'settings', 'Automático', 'Acompanha o tema do Windows.')}${op('claro', 'sun', 'Modo claro', 'Fundo claro, ideal para ambientes iluminados.')}${op('escuro', 'moon', 'Modo escuro', 'Fundo escuro, reduz o brilho da tela.')}</div>
    <h3>Densidade (só para você, neste computador)</h3>
    <p class="dica">A compacta reduz alturas e espaços para a etapa 3 caber num monitor pequeno (768 px de altura).</p>
    <div class="sit-opcoes" role="radiogroup" aria-label="Densidade">${den('confortavel', 'rows', 'Confortável')}${den('compacta', 'monitor', 'Compacta')}</div>
</div>`;
}

/* ---------- 2. Perfil e identificação ---------- */
const perfilEditavel = o => { const eu = operadorObj(); return !o.senhaHash || (eu && eu.id === o.id); };
function cfgPerfil() {
  const eu = operadorObj();
  return `<div class="card">${cabSecao('Perfil e identificação')}
  ${cfgEdit.operadores.map((o, i) => { const meu = eu && eu.id === o.id, tranc = !perfilEditavel(o), dis = tranc ? 'disabled' : '';
    return `<div class="op-card ${tranc ? 'trancado' : ''}"><div class="linha-flex" style="margin-bottom:8px"><span data-opprev="${i}" class="tag id" style="${estiloOp(o)}">${glifo(o.icone)}<span data-eco="operadores.${i}.nome">${esc(o.nome || 'Novo operador')}</span></span>
      ${o.senhaHash ? `<span class="tag ok">${ic('lock', 'sm')}Com senha</span>` : '<span class="tag">Sem senha</span>'}${tranc ? `<span class="tag warn">${ic('lock', 'sm')}Protegido: selecione este operador para editar</span>` : ''}${meu ? '<span class="tag info">Você</span>' : ''}
      <span style="flex:1"></span><button class="btn sm dng" data-act="opRem" data-i="${i}" ${dis}>${ic('trash', 'sm')}Remover</button></div>
    <div class="form-grid"><div><label class="lbl" for="opn-${i}">Nome de exibição</label><input type="text" id="opn-${i}" data-cfg="operadores.${i}.nome" value="${esc(o.nome)}" ${dis}></div>
      <div><span class="lbl">Cor de identificação (RGB) e transparência</span><div class="cor-linha"><input type="color" data-opcor="${i}:rgb" value="${esc(o.corRgb)}" aria-label="Cor" ${dis}><input type="text" data-opcor="${i}:hex" value="${esc(o.corRgb)}" maxlength="7" style="width:92px" aria-label="Cor em hexadecimal" ${dis}>
        <label class="lbl" style="margin:0" for="opt-${i}">Transparência</label><input type="range" id="opt-${i}" min="0" max="95" value="${100 - o.corAlfa}" data-opcor="${i}:transp" ${dis}><span class="num" data-opteco="${i}">${100 - o.corAlfa}%</span></div></div></div>
    <div style="margin-top:10px"><span class="lbl">Animal</span><div class="av-op" role="radiogroup" aria-label="Animal">${AVATARES.map(a => `<button type="button" class="${o.icone === a ? 'on' : ''}" role="radio" aria-checked="${o.icone === a}" data-act="opIcone" data-i="${i}" data-v="${a}" title="${AVATAR_NOME[a]}" aria-label="${AVATAR_NOME[a]}" ${dis}>${glifo(a)}</button>`).join('')}</div></div>
    ${meu ? `<div style="margin-top:10px"><span class="lbl">Senha deste operador (pedida ao trocar para ele; protege a edição do perfil)</span><div class="cor-linha"><input type="password" id="sn-${i}" placeholder="Nova senha (mín. 4)" autocomplete="new-password" style="width:170px"><input type="password" id="sc-${i}" placeholder="Confirmar senha" autocomplete="new-password" style="width:170px"><button class="btn sm" data-act="opSenha" data-i="${i}">${ic('lock', 'sm')}${o.senhaHash ? 'Trocar senha' : 'Definir senha'}</button>${o.senhaHash ? `<button class="btn sm dng" data-act="opSenhaRem" data-i="${i}">Remover senha</button>` : ''}</div></div>` : ''}</div>`; }).join('')}
  <div class="acoes"><button class="btn line" data-act="opAdd">${ic('plus')}Adicionar operador</button></div></div>`;
}

/* ---------- 3. Clínicas e cadastros ---------- */
function cfgClinicas() {
  const cls = cfgEdit.clinicas; cfgClinicaSel = Math.min(cfgClinicaSel, cls.length - 1); if (cfgClinicaSel < 0) cfgClinicaSel = 0;
  const cl = cls[cfgClinicaSel];
  return `<div class="card">${cabSecao(`Clínicas e cadastros (${cls.length})`, 'Informações usadas para reconhecer o remetente, preencher o credenciado executante e mostrar a descrição oficial de cada código. Campos sem informação ficam vazios: nada é preenchido por suposição.')}
  <div class="mestre"><div>
    <div class="linha-flex"><div class="busca" style="flex:1;min-width:150px"><span class="sr"><label for="buscaCl">Buscar clínica</label></span>${ic('search', 'sm')}<input type="search" id="buscaCl" placeholder="Nome, cidade, e-mail ou código" data-filtro="cl"></div><button class="btn sm pri" data-act="clNova">${ic('plus', 'sm')}Nova clínica</button><button class="btn sm line" data-act="clImportar" title="Cola a lista de clínicas da planilha (nome, cidade e e-mails)">${ic('upload', 'sm')}Importar lista</button></div>
    <div class="lista-cl" id="listaCl">${cls.map((c, i) => `<button class="cl-item idc ${corClinica(c)} ${i === cfgClinicaSel ? 'ativa' : ''}" data-act="clSel" data-i="${i}" data-busca="${esc(norm([c.nome, c.cidade, c.emails.join(' '), Object.keys(c.codigos || {}).join(' '), c.apelidos].join(' ')))}"><span class="sq">${esc(iniciais(c.nome))}</span><span><span class="n" data-eco="clinicas.${i}.nome">${esc(c.nome || 'Sem nome')}</span><br><span class="s">${esc(c.cidade || 'Cidade não informada')} · ${pl(c.emails.length, 'e-mail', 'e-mails')} · ${pl(c._lista.filter(x => x.c).length, 'código', 'códigos')}</span></span></button>`).join('') || '<p class="muted">Nenhuma clínica cadastrada.</p>'}</div>
  </div>
  <div>${cl ? cfgClinicaDetalhe(cl, cfgClinicaSel) : '<div class="vazio"><h2>Nenhuma clínica selecionada</h2><p>Cadastre a primeira clínica para começar.</p><button class="btn pri" data-act="clNova">' + ic('plus') + 'Nova clínica</button></div>'}</div></div></div>`;
}
function cfgClinicaDetalhe(cl, i) {
  const P = `clinicas.${i}`;
  return `<div class="card" style="box-shadow:none"><div class="card-h idc ${corClinica(cl)}"><span class="sq lg">${esc(iniciais(cl.nome))}</span><h2 data-eco="clinicas.${i}.nome">${esc(cl.nome || 'Nova clínica')}</h2><span class="esp"></span><button class="btn sm dng" data-act="clRem" data-i="${i}">${ic('trash', 'sm')}Remover clínica</button></div>
    <div class="form-grid">
      <div><label class="lbl" for="cl-nome">Nome da clínica</label><input type="text" id="cl-nome" data-cfg="${P}.nome" value="${esc(cl.nome)}"></div>
      <div><label class="lbl" for="cl-cidade">Cidade</label><input type="text" id="cl-cidade" data-cfg="${P}.cidade" value="${esc(cl.cidade)}"></div>
      <div style="grid-column:1/-1"><label class="lbl" for="cl-exec">Credenciado executante no sistema</label><input type="text" id="cl-exec" data-cfg="${P}.executante" value="${esc(cl.executante)}" placeholder="Não informado"></div>
      <div style="grid-column:1/-1"><label class="lbl" for="cl-apel">Apelidos usados no assunto</label><input type="text" id="cl-apel" data-cfg="${P}.apelidos" value="${esc(cl.apelidos)}" placeholder="Ex.: Criar, MRA"></div>
      <div style="grid-column:1/-1"><label class="lbl" for="cl-nota">Nota fixa da clínica (aparece em todo atendimento dela)</label><textarea id="cl-nota" rows="2" data-cfg="${P}.nota" placeholder="Ex.: sempre manda o CID sem ponto; confirmar quantidade por telefone">${esc(cl.nota || '')}</textarea></div>
    </div>
    <h3>E-mails do remetente</h3>
    <div class="chips-e">${cl.emails.map((e, j) => `<span class="chip-e">${esc(e)}<button data-act="clRemEmail" data-i="${i}" data-j="${j}" aria-label="Remover ${esc(e)}" title="Remover">${ic('x', 'sm')}</button></span>`).join('') || '<span class="muted" style="font-size:var(--fs-sm)">Nenhum e-mail cadastrado. Ao receber um pedido de remetente desconhecido, é possível vincular o e-mail à clínica na hora.</span>'}</div>
    <div class="linha-flex"><input type="email" id="novoEmail" placeholder="contato@clinica.com.br" style="flex:1;min-width:200px;width:auto" aria-label="Novo e-mail" data-enter="clAddEmail" data-i="${i}"><button class="btn line" data-act="clAddEmail" data-i="${i}">${ic('plus', 'sm')}Adicionar e-mail</button></div>
    <h3 style="margin-top:20px">Regras de leitura do e-mail</h3>
    <p class="dica">Use quando a clínica repete o mesmo erro no e-mail. As regras valem só para os e-mails desta clínica, e cada ajuste aparece como alerta para o operador conferir. Para ver o efeito, salve e use Configurações › Testar leitura.</p>
    ${Pin.liberado() ? '' : `<div class="aviso-simples" style="margin-bottom:8px">${ic('lock', 'sm')}<div>Regras protegidas pelo PIN do supervisor. <button class="btn link" data-act="pinPedir">Liberar</button></div></div>`}
    <fieldset class="regras-fs" ${Pin.liberado() ? '' : 'disabled'}><div class="regras-cl">
      <div><label class="lbl" for="cl-qtdp">Quantidade quando o e-mail não informar</label><input type="number" min="1" max="99" id="cl-qtdp" data-cfg="${P}.leitura.qtdPadrao" value="${esc(cl.leitura.qtdPadrao)}" placeholder="Vazio: não preencher (bloqueia)" style="max-width:260px"></div>
      <label class="chk"><input type="checkbox" data-cfg="${P}.leitura.completarCodigo" ${cl.leitura.completarCodigo ? 'checked' : ''}><span><b>Código com um dígito a mais ou a menos</b>: corrigir para o código cadastrado desta clínica que só difere nesse dígito (ex.: 5000470 → 50000470). Precisa dos códigos cadastrados abaixo.</span></label>
      <label class="chk"><input type="checkbox" data-cfg="${P}.leitura.qtdColada" ${cl.leitura.qtdColada ? 'checked' : ''}><span><b>Quantidade colada no CRM</b>: número de 5 dígitos começando com 1 logo depois do serviço e seguido de hífen é quantidade 1 + CRM (ex.: "PSICOLOGIA 19700-" = 1 + CRM 9700). Com 6 dígitos ("119741") isso já é automático.</span></label>
      <div><label class="lbl" for="cl-trocas">Códigos que a clínica escreve errado (um por linha: escrito = certo)</label><textarea id="cl-trocas" rows="3" class="num" data-cfg="${P}.leitura.trocas" placeholder="5000470 = 50000470">${esc(cl.leitura.trocas)}</textarea></div>
    </div></fieldset>
    <div class="card-h" style="margin-top:20px"><h3 style="margin:0">Códigos e descrições (${cl._lista.filter(x => x.c).length})</h3><span class="esp"></span>
      <button class="btn sm line" data-act="codImportar" data-i="${i}">${ic('upload', 'sm')}Colar lista</button><button class="btn sm line" data-act="codSugerir" data-i="${i}" title="Lista códigos de atendimentos concluídos que ainda não estão no cadastro, para você escolher quais adicionar">${ic('search', 'sm')}Sugerir a partir de atendimentos</button><button class="btn sm pri" data-act="codAdd" data-i="${i}">${ic('plus', 'sm')}Adicionar código</button></div>
    ${cl._lista.length ? `<div class="busca" style="margin-bottom:8px"><span class="sr"><label for="buscaCod">Buscar código</label></span>${ic('search', 'sm')}<input type="search" id="buscaCod" placeholder="Filtrar por código ou descrição" data-filtro="cod"></div>
    <div class="tabela-scroll" style="max-height:46vh"><table class="t" id="tabCod"><thead><tr><th style="width:150px">Código (8 dígitos)</th><th>Descrição oficial</th><th style="width:56px"></th></tr></thead><tbody>
    ${cl._lista.map((x, j) => `<tr data-busca="${esc(norm(x.c + ' ' + x.d))}"><td><input type="text" inputmode="numeric" class="num ${x.c && !/^\d{8}$/.test(x.c.trim()) ? 'invalido' : ''}" data-cfg="${P}._lista.${j}.c" value="${esc(x.c)}" maxlength="8" aria-label="Código ${j + 1}"></td><td><input type="text" data-cfg="${P}._lista.${j}.d" value="${esc(x.d)}" aria-label="Descrição do código ${j + 1}"></td><td class="c"><button class="btn sm ghost ico" data-act="codRem" data-i="${i}" data-j="${j}" aria-label="Remover código" title="Remover código">${ic('trash', 'sm')}</button></td></tr>`).join('')}
    </tbody></table></div>` : `<div class="vazio" style="padding:24px"><p style="margin-bottom:12px">Nenhum código cadastrado para esta clínica.</p><button class="btn pri" data-act="codAdd" data-i="${i}">${ic('plus')}Adicionar o primeiro código</button></div>`}
  </div>`;
}

/* ---------- 4/5/6. Modelos ---------- */
const nomeCfg = k => k.endsWith('_multi') ? nomeCfg(k.slice(0, -6)) + ' (várias guias)' : cfgEdit.modelos[k].nome;
function cfgModelos(chave, filtro, titulo, desc) {
  const keys = Object.keys(MODELOS_PADRAO).filter(filtro);
  if (!keys.includes(cfgModeloSel[chave])) cfgModeloSel[chave] = keys[0];
  const grupos = unicos(keys.map(k => MODELOS_META[k].grupo));
  return `<div class="card">${cabSecao(titulo, desc)}<div class="mestre" style="grid-template-columns:minmax(220px,280px) minmax(0,1fr)">
    <div class="modelo-lista" role="listbox" aria-label="Modelos">${grupos.map(gr => `<div class="eyebrow" style="margin:10px 0 4px">${esc(gr)}</div>${keys.filter(k => MODELOS_META[k].grupo === gr).map(k => `<button class="modelo-item ${cfgModeloSel[chave] === k ? 'ativa' : ''}" role="option" aria-selected="${cfgModeloSel[chave] === k}" data-act="modeloSel" data-c="${chave}" data-k="${k}"><b ${k.endsWith('_multi') ? '' : `data-eco="modelos.${k}.nome"`}>${esc(nomeCfg(k))}</b><small>${MODELOS_META[k].destino === 'email' ? 'E-mail com formatação' : 'Texto simples'}</small></button>`).join('')}`).join('')}</div>
    <div id="modeloArea">${htmlModeloArea(cfgModeloSel[chave])}</div></div></div>`;
}
function htmlModeloArea(k) {
  const meta = MODELOS_META[k], m = cfgEdit.modelos[k], rico = meta.destino === 'email';
  return `<div class="stack">
    <div class="card" style="box-shadow:none"><div class="card-h"><h2 ${k.endsWith('_multi') ? '' : `data-eco="modelos.${k}.nome"`}>${esc(nomeCfg(k))}</h2>${rico ? `<span class="tag ac">${ic('mail', 'sm')}E-mail com formatação</span>` : `<span class="tag info">${ic('info', 'sm')}Texto simples</span>`}<span class="esp"></span><button class="btn sm ghost" data-act="modeloRestaurar" data-k="${k}" title="Volta ao texto original do sistema">${ic('undo', 'sm')}Restaurar texto padrão</button></div>
      ${meta.custom ? `<div class="form-grid" style="margin-bottom:12px"><div><label class="lbl" for="mdNome">Nome do modelo (aparece no botão)</label><input type="text" id="mdNome" data-cfg="modelos.${k}.nome" value="${esc(m.nome)}" maxlength="60"></div>
        <div style="grid-column:1/-1"><label class="lbl" for="mdUso">Descrição (quando usar)</label><input type="text" id="mdUso" data-cfg="modelos.${k}.uso" value="${esc(m.uso || '')}" maxlength="200"></div></div>` : `<p class="dica"><b>Quando é usado:</b> ${esc(meta.uso)}</p>`}
      ${rico ? '' : `<div class="aviso-simples" style="margin-bottom:10px">${ic('info')}<div>Copiado como <b>texto simples</b>: sem negrito, cor ou listas.</div></div>`}
      ${htmlEditor({ id: 'edModelo', valor: htmlComEtiquetas(m.html), rico, minAltura: 220 })}</div>
    <div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <div class="card" style="box-shadow:none"><div class="card-h"><h3 style="margin:0">Campos disponíveis</h3></div>
        ${CAMPOS_CATS.map((cat, ci) => `<details class="campos-cat" ${ci === 0 ? 'open' : ''}><summary>${esc(cat)}</summary>${CAMPOS.filter(f => f.cat === cat).map(f => `<div class="campo-it"><b>${esc(f.nome)}</b><span class="d">${esc(f.desc)}</span><span class="ex">Exemplo: <code>${esc(f.ex)}</code></span><button class="btn sm" data-act="inserirCampo" data-k="${f.k}" aria-label="Inserir ${esc(f.nome)}">${ic('plus', 'sm')}Inserir</button></div>`).join('')}</details>`).join('')}</div>
      <div class="card" style="box-shadow:none"><div class="card-h"><h3 style="margin:0">Pré-visualização</h3></div><div id="modeloPrevia"></div></div>
    </div></div>`;
}
function montarEditorModelo() {
  const ed = $('#edModelo'); if (!ed) return;
  atualizarPrevia();
}
function atualizarPrevia() {
  const k = cfgModeloSel[cfgSecao]; const alvo = $('#modeloPrevia'); if (!alvo || !cfgEdit.modelos[k]) return;
  const m = cfgEdit.modelos[k], rico = MODELOS_META[k].destino === 'email';
  const r = renderModelo(k, { exemplo: true }, { html: m.html });
  alvo.innerHTML = rico
    ? `<div class="previa"><div class="previa-h"><span class="tag ac">${ic('eye', 'sm')}Como o destinatário vê (com formatação)</span></div><div class="previa-c">${r.html || '<span class="muted">Texto vazio.</span>'}</div></div>
       <div class="previa" style="margin-top:10px"><div class="previa-h"><span class="tag">${ic('copy', 'sm')}Se copiado como texto simples</span></div><div class="previa-c"><pre class="simples">${esc(r.texto)}</pre></div></div>`
    : `<div class="previa"><div class="previa-h"><span class="tag info">${ic('copy', 'sm')}Texto simples, como será copiado</span></div><div class="previa-c"><pre class="simples">${esc(r.texto)}</pre></div></div>`;
}

/* ---------- 6. Parametrizações ---------- */
function cfgParam() {
  const lista = [...Param.lista].sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
  return `<div class="card">${cabSecao(`Parametrizações (${lista.length})`, 'Referências por clínica e carteira, criadas pelo botão “Parametrizar” no atendimento. Servem de base para os atendimentos seguintes. São salvas ao confirmar no modal, independentemente do botão Salvar configurações.')}
  <div class="acoes" style="margin-top:0;margin-bottom:10px"><button class="btn pri" data-act="paramNova">${ic('plus')}Nova parametrização</button></div>
  ${lista.length ? `<div class="tabela-scroll"><table class="t"><thead><tr><th>Clínica</th><th>Carteira</th><th>Médico</th><th>Data do pedido</th><th>Terapias</th><th>Atualizada em</th><th></th></tr></thead><tbody>
  ${lista.map(p => { const cl = cfgEdit.clinicas.find(c => c.id === p.clinicaId); return `<tr><td>${htmlClinica(cl, p.clinicaId)}</td><td class="num">${esc(p.carteira)}</td><td>${esc(p.medico)}</td><td class="c num">${p.emissao ? diaBR(p.emissao) : '—'}</td><td>${p.terapias.map(t => `${esc(t.descricao)} × ${esc(t.qtd)}`).join('<br>')}</td><td class="c num">${fmtDH(p.atualizadoEm)}</td><td class="c"><button class="btn sm" data-act="paramVer" data-id="${p.id}">${ic('edit', 'sm')}Ver ou editar</button></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="vazio" style="padding:24px"><p>Nenhuma parametrização cadastrada.</p></div>`}
  </div>` + cfgModelos('param', k => k.startsWith('parametrizacao'), 'Formato do texto da parametrização', 'Define como o texto estruturado é gerado no modal “Parametrizar”.');
}

/* ---------- 7. Alertas ---------- */
function cfgAlertas() {
  return `<div class="card">${cabSecao('Alertas e regras de validação', 'Defina o comportamento real de cada alerta do sistema. A escolha altera o atendimento imediatamente após salvar.')}
  <div class="modos">${['bloqueio', 'obs', 'atencao', 'desativado'].map(m => `<div class="modo-card"><b>${tagModo(m)}</b>${MODOS[m].desc}</div>`).join('')}</div>
  ${ALERTAS_GRUPOS.map(gr => `<h3>${esc(gr)}</h3>${Object.entries(ALERTAS).filter(([, a]) => a.grupo === gr).map(([k, a]) => { const c = cfgEdit.alertas[k];
    return `<div class="al-cfg"><div class="topo-al"><div><div class="n" title="${esc(a.desc)}">${esc(a.nome)}</div></div>
      <div><label class="sr" for="al-${k}">Comportamento de ${esc(a.nome)}</label><select id="al-${k}" data-cfg="alertas.${k}.modo" data-rr="1">${Object.entries(MODOS).map(([m, x]) => `<option value="${m}" ${c.modo === m ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></div></div>
      ${c.modo === 'obs' ? `<div class="extra" style="grid-template-columns:1fr"><div><label class="lbl" for="alt-${k}">Texto da observação (vai para “Observações adicionais” da resposta)</label><textarea id="alt-${k}" data-cfg="alertas.${k}.texto" rows="2" placeholder="Se vazio, usa o texto do próprio alerta.">${esc(c.texto)}</textarea></div></div>` : ''}</div>`; }).join('')}`).join('')}</div>`;
}

/* ---------- 8. Exportação ---------- */
function cfgExport() {
  const fim = isoDia(new Date()), ini = isoDia(addDias(new Date(), -7));
  return `<div class="card">${cabSecao('Exportação', 'Cópias de segurança e relatórios. Nenhum dado é enviado pela internet: os arquivos são gerados neste computador.')}
    <h3 style="margin-top:0">Registros de atendimento (CSV)</h3>
    <div class="linha-flex"><div><label class="lbl" for="expIni">De</label><input type="date" id="expIni" value="${ini}" style="width:auto"></div><div><label class="lbl" for="expFim">Até</label><input type="date" id="expFim" value="${fim}" style="width:auto"></div>
      <button class="btn line" data-act="exportarPeriodo" style="align-self:flex-end">${ic('download')}Baixar CSV do período</button></div>
    <h3>Configurações (cópia de segurança)</h3>
    <div class="linha-flex"><button class="btn line" data-act="exportarCfg">${ic('download')}Baixar config.json</button>
      <label class="btn line" for="impCfg" style="cursor:pointer">${ic('upload')}Importar config.json</label><input type="file" id="impCfg" accept=".json" class="oculto">
      <button class="btn line" data-act="exportarParam">${ic('download')}Baixar parametrizações</button></div></div>`;
}

/* ---------- 9. Preferências operacionais ---------- */
function cfgObsAuto() {
  const o = cfgEdit.obsAuto;
  const linha = ([k, v]) => `<div class="card" style="box-shadow:none;margin:0 0 10px;padding:12px">
    <div class="linha-flex" style="justify-content:space-between"><b>${esc(v.nome)}</b>
      <label class="switch"><input type="checkbox" data-cfg="obsAuto.${k}.padrao" ${o[k].padrao ? 'checked' : ''}><span>Marcada por padrão</span></label></div>
    <label class="lbl" for="oa-${k}">Texto da observação</label><input type="text" id="oa-${k}" data-cfg="obsAuto.${k}.texto" value="${esc(o[k].texto)}"></div>`;
  return `<div class="card">${cabSecao('Observações automáticas')}
    <p class="dica">Quando você usa <b>Ignorar</b> numa divergência da conferência pelos prints, o sistema sugere uma observação para a clínica. Aqui você muda o texto e define se ela já vem <b>marcada</b>. Em qualquer caso, ela só entra na resposta se estiver marcada (a marcação pode ser mudada em cada atendimento).</p>
    <p class="dica">Campos para os itens: <code>{CODIGO}</code>, <code>{QTD_PEDIDO}</code>, <code>{QTD_SISTEMA}</code> e <code>{STATUS}</code>.</p>
    <h3>Itens</h3>${Object.entries(OBS_AUTO).filter(([, v]) => v.itens).map(linha).join('')}
    <h3>Campos da guia</h3>${Object.entries(OBS_AUTO).filter(([, v]) => !v.itens).map(linha).join('')}
    <div class="acoes"><button class="btn line" data-act="obsAutoRestaurar">${ic('undo', 'sm')}Restaurar padrões</button></div></div>`;
}
/* ---------- Tamanho da pasta "auditoria" e limpeza dos prints antigos (o texto fica) ---------- */
let AUD_TAM = null;
const fmtBytes = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
async function medirAuditoria() {
  const meses = [];
  for (const [m, hm] of await Pasta.listar(['auditoria'])) {
    if (hm.kind !== 'directory') continue; let n = 0, bytes = 0;
    for (const [nome, h] of await Pasta.listar(['auditoria', m])) { if (!nome.endsWith('.json')) continue; try { bytes += (await h.getFile()).size; n++; } catch (er) { } }
    meses.push({ m, n, bytes });
  }
  meses.sort((a, b) => (a.m < b.m ? 1 : -1));
  return { total: meses.reduce((s, x) => s + x.bytes, 0), n: meses.reduce((s, x) => s + x.n, 0), meses, em: agora() };
}
function semImagens(a) {
  const p = a && a.prints; if (!p) return false; let mudou = false;
  (p.imagens || []).forEach(x => { if (x.img) { x.img = ''; mudou = true; } });
  (p.checks || []).forEach(c => { if (c.recorte) { c.recorte = ''; mudou = true; } });
  (p.itens || []).forEach(l => { if (l.recorte) { l.recorte = ''; mudou = true; } });
  if (mudou) a.printsApagadosEm = agora();
  return mudou;
}
function htmlArmazenamento() {
  const T = AUD_TAM, pz = LS.get('audPrazo', 6);
  return `<div class="card">${cabSecao('Histórico detalhado (pasta “auditoria”)', 'Fica separado dos registros: apagar prints daqui não mexe no Painel nem nos registros. O texto do histórico (lido, ignorado, linha do tempo) continua.')}
    ${!Pasta.ok ? '<p class="muted">Conecte a pasta compartilhada para medir e limpar.</p>' : `
    <div class="acoes" style="margin-top:0"><button class="btn line" data-act="audMedir">${ic('search', 'sm')}Calcular tamanho</button>
      ${T ? `<span class="tag info">${fmtBytes(T.total)} em ${pl(T.n, 'guia', 'guias')}</span><span class="dica" style="margin:0">medido às ${fmtHora(T.em)}</span>` : ''}</div>
    ${T && T.meses.length ? `<div class="tabela-scroll" style="max-height:240px;margin-top:8px"><table class="t"><thead><tr><th>Mês</th><th>Guias</th><th>Tamanho</th></tr></thead><tbody>${T.meses.map(x => `<tr><td class="c">${x.m.slice(5)}/${x.m.slice(0, 4)}</td><td class="c num">${x.n}</td><td class="c num">${fmtBytes(x.bytes)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="linha-flex" style="margin-top:12px"><label for="audPrazo">Apagar as imagens dos prints com mais de</label>
      <select id="audPrazo" style="width:auto">${[3, 6, 12, 24].map(m => `<option value="${m}" ${pz === m ? 'selected' : ''}>${m} meses</option>`).join('')}</select>
      <button class="btn dng" data-act="audLimpar">${ic('trash', 'sm')}Apagar prints antigos</button></div>`}
  </div>`;
}
function cfgPrefs() {
  const p = cfgEdit.preferencias;
  return `<div class="card">${cabSecao('Preferências operacionais')}
    <div class="stack">
      <label class="switch"><input type="checkbox" data-cfg="preferencias.conferenciaCega" ${p.conferenciaCega ? 'checked' : ''}><span><b>Exigir a conferência da grade antes de finalizar (pelos prints ou, sem prints, a conferência cega)</b></span></label>
      <label class="switch"><input type="checkbox" data-cfg="preferencias.guardarPrints" ${p.guardarPrints !== false ? 'checked' : ''}><span><b>Guardar os prints e o que foi lido no histórico de cada guia</b> (pasta compartilhada › auditoria). Usado em “Histórico” do Painel e em Ações › Auditar. Contém dados do beneficiário.</span></label>
      <div style="max-width:300px"><label class="lbl" for="pAcoes">Limpar da aba Ações após (minutos sem movimento; 0 = não limpar)</label><input type="number" id="pAcoes" min="0" max="1440" data-cfg="preferencias.acoesMinutos" value="${p.acoesMinutos}"></div>
      <div style="max-width:300px"><label class="lbl" for="pParado">Avisar “atendimento parado” após (minutos na mesma etapa; 0 = não avisar)</label><input type="number" id="pParado" min="0" max="240" data-cfg="preferencias.minutosParado" value="${p.minutosParado ?? 10}"></div>
      <div style="max-width:300px"><label class="lbl" for="pQtd">Quantidade máxima por serviço</label><input type="number" id="pQtd" min="1" max="99" data-cfg="preferencias.qtdMax" value="${p.qtdMax}"></div>
      <label class="switch"><input type="checkbox" data-cfg="preferencias.obsParametrizadoAuto" ${p.obsParametrizadoAuto ? 'checked' : ''}><span><b>Pré-selecionar o texto de “atendimento parametrizado”</b></span></label>
      <label class="switch"><input type="checkbox" data-cfg="preferencias.exigirConfirmarGlosa" ${p.exigirConfirmarGlosa ? 'checked' : ''}><span><b>Exigir marcação manual de “Retirou alguma glosa?” em toda guia</b> (desligado = pré-marca “Não” e só pede detalhes quando o operador mudar para “Sim”)</span></label>
    </div></div>
  <div class="card"><div class="card-h"><h2>Motivos de não autorização</h2></div>
    ${cfgEdit.motivos.map((m, i) => `<div class="linha-flex" style="margin-bottom:8px"><input type="text" data-cfg="motivos.${i}.nome" value="${esc(m.nome)}" style="flex:2;min-width:220px;width:auto" aria-label="Motivo ${i + 1}">
      <select data-cfg="motivos.${i}.modelo" style="flex:1;min-width:200px;width:auto" aria-label="Modelo vinculado ao motivo ${i + 1}"><option value="">Sem modelo vinculado</option>${MODELOS_SITUACAO.map(k => `<option value="${k}" ${m.modelo === k ? 'selected' : ''}>${esc(MODELOS_PADRAO[k].nome)}</option>`).join('')}</select>
      <button class="btn sm ghost ico" data-act="motRem" data-i="${i}" aria-label="Remover motivo" title="Remover motivo">${ic('trash', 'sm')}</button></div>`).join('')}
    <div class="acoes" style="margin-top:6px"><button class="btn line" data-act="motAdd">${ic('plus')}Adicionar motivo</button></div></div>
  <div class="card"><div class="card-h"><h2>Glosas (sugestões)</h2></div>
    ${cfgEdit.glosas.map((g, i) => `<div class="linha-flex" style="margin-bottom:6px"><input type="text" data-cfg="glosas.${i}" value="${esc(g)}" style="flex:1;min-width:220px;width:auto" aria-label="Glosa ${i + 1}"><button class="btn sm ghost ico" data-act="glosaRem" data-i="${i}" aria-label="Remover glosa" title="Remover glosa">${ic('trash', 'sm')}</button></div>`).join('')}
    <div class="acoes" style="margin-top:6px"><button class="btn line" data-act="glosaAdd">${ic('plus')}Adicionar glosa</button></div></div>
  <div class="card"><div class="card-h"><h2>Privacidade dos registros</h2></div>
    <p class="dica" style="margin:0 0 10px">Você pode anonimizar apenas o nome do beneficiário nos registros antigos (mantendo estatísticas e carteiras para conciliação) ou apagar completamente os registros antigos.</p>
    <div class="linha-flex">
      <button class="btn line" data-act="anonimizarAntigos">${ic('shield')}Anonimizar nomes com mais de 180 dias</button>
      <button class="btn dng" data-act="limparAntigos">${ic('trash')}Apagar registros com mais de 180 dias</button>
    </div></div>`;
}

/* ---------- 10. Informações ---------- */
function cfgInfo() {
  return `<div class="card">${cabSecao('Informações e versão do sistema')}
    <dl class="kv"><dt>Sistema</dt><dd>Conferidor de Guias · Núcleo Gestão de Terapias · Promédica</dd><dt>Versão</dt><dd class="num">${VERSAO}</dd>
    <dt>Criado por</dt><dd>Alexandre Neves</dd>
    <dt>Pasta compartilhada</dt><dd>${Pasta.ok ? `Conectada: ${esc(Pasta.handle.name)}` : Pasta.handle ? 'Lembrada, precisa de autorização' : Pasta.suportado ? 'Não conectada' : 'Navegador sem suporte (use Chrome ou Edge)'}</dd>
    <dt>Onde ficam as configurações</dt><dd>${Pasta.ok ? 'Arquivos config.json e parametrizacoes.json na pasta compartilhada, com cópia neste computador.' : 'Somente neste computador (sem pasta compartilhada).'}</dd>
    <dt>Preferência de tema</dt><dd>Neste computador (${Tema.pref() === 'auto' ? 'automático' : Tema.pref()}).</dd>
    <dt>Operadores / clínicas</dt><dd>${cfg.operadores.length} / ${cfg.clinicas.length}</dd>
    <dt>Dados guardados</dt><dd>Pasta <code>registros/</code>: carteira, nome/iniciais do beneficiário (para acompanhamento e conciliação), códigos, quantidades, número e resultado da guia (sem CID ou médico). Pasta <code>auditoria/</code>: texto do e-mail, dados lidos e prints da conferência (se habilitado em Preferências). Parametrizações incluem o nome do médico informado por você.</dd></dl></div>`;
}
