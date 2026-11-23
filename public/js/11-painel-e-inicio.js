'use strict';
/* ====================================================================
   Modo simples (tela única) e painel flutuante no canto da tela (fica por cima do sistema)
   ==================================================================== */
const MINI_CAMPOS = [['executante', 'Credenciado executante'], ['carteira', 'Carteira'], ['benef', 'Beneficiário'], ['medico_nome', 'Médico'], ['medico_crm', 'CRM'], ['data', 'Data do pedido'], ['local', 'Local do pedido'], ['cid', 'CID']];
let miniMsg = '';
/* sequência de lançamento da guia: campos na ordem do sistema e, depois, código e quantidade de cada serviço */
function sequenciaGuia(g) {
  const s = MINI_CAMPOS.map(([k, r], n) => ({ k, rot: `${n + 1}. ${r}`, v: valorCopia(g, k).trim() }));
  g.pedido.itens.forEach(it => { s.push({ k: 'c:' + it.codigo, rot: 'Código', v: it.codigo, it }); s.push({ k: 'q:' + it.codigo, rot: 'Qtd. de ' + it.codigo, v: it.qtd == null ? '' : String(it.qtd), it }); });
  s.forEach(x => { x.ok = x.v !== '' && g.copiados[x.k] === x.v; });
  return s;
}
const guiaNumOk = g => /^[TS]\d{7,8}$/.test((g && g.numero) || '');
const campoDeTexto = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/i.test(el.type || '')));
/* sininho do painel: quantos alertas pedem ação (bloqueios + "Conferi" pendentes); o clique abre a lista */
function htmlMiniSino(g, st) {
  const b = st.bloqueios.length, cr = st.criticos.length, pend = atencaoPendente(g, st).length, tot = st.A.length, n = b + pend;
  const cls = b || cr ? 'bad' : pend ? 'warn' : tot ? 'ok' : '';
  const tit = tot ? [b && pl(b, 'bloqueio', 'bloqueios'), cr && pl(cr, 'confirmação obrigatória', 'confirmações obrigatórias'), pend && pend + ' a conferir', st.obs.length && st.obs.length + ' com observação', pl(tot, 'alerta no total', 'alertas no total')].filter(Boolean).join(' · ') + '. Clique para ver e conferir.' : 'Nenhum alerta nesta guia.';
  return `<button type="button" class="mini-sino ${cls} ${Mini.verAlertas ? 'on' : ''}" data-mact="alertas" aria-expanded="${Mini.verAlertas ? 'true' : 'false'}" aria-label="Alertas e ocorrências: ${esc(tit)}" title="${esc(tit)}">${ic(b ? 'ban' : 'bell', 'sm')}${n ? `<span class="n">${n}</span>` : tot ? ic('check', 'sm') : ''}</button>`;
}
function htmlMiniAlertas(g, st) {
  const ordem = a => ({ bloqueio: 0, obs: 1, atencao: 2 }[a.modo] ?? 3) + (a.nivel === 'info' ? 1 : 0);
  const L = [...st.A].sort((a, b) => ordem(a) - ordem(b));
  if (!L.length) return `<div class="mini-alertas"><div class="mini-al ok">${ic('check', 'sm')}Nenhum alerta para esta guia.</div></div>`;
  return `<div class="mini-alertas" role="region" aria-label="Alertas e ocorrências">${L.map(a => {
    const pede = pedeConferi(a), conf = pede && g.conf && g.conf[a.key], crit = ehCritico(a);
    const cls = a.modo === 'bloqueio' || (crit && !conf) ? 'bad' : a.modo === 'obs' ? 'obs' : a.nivel === 'info' ? 'info' : conf ? 'ok' : 'warn';
    const rot = a.modo === 'bloqueio' ? 'Bloqueio' : crit ? 'Confirmação obrigatória' : a.modo === 'obs' ? 'Com observação' : a.nivel === 'info' ? 'Informativo' : 'Atenção';
    const noConferidor = a.vincular || a.acaoCarteira || a.cadastrarCodigo || a.aprendidoI != null;
    return `<div class="mini-alerta ${cls}"><div class="ma-t"><b>${rot}:</b> ${esc(a.texto)}</div>${pede || noConferidor ? `<div class="mini-btns">${pede ? `<button type="button" class="btn sm conferi-btn ${conf ? 'on' : ''}" data-mact="conferi" data-conf="${esc(a.key)}" aria-pressed="${conf ? 'true' : 'false'}">${ic('check', 'sm')}${conf ? 'Conferido' : 'Conferi'}${a.conferiRot ? ': ' + esc(a.conferiRot) : ''}</button>` : ''}${noConferidor ? `<button type="button" class="btn sm ghost" data-mact="abrir">${ic('right', 'sm')}Resolver no conferidor</button>` : ''}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
const htmlMiniMsg = () => miniMsg ? `<div class="mini-msg" role="status">${esc(miniMsg)}</div>` : '';
const htmlMiniPend = pend => pend.length ? `<ul class="mini-pend">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
/* depois do nº da guia (botão Próximo): a guia, a observação, a situação da autorização, a resposta e Concluir */
function htmlMiniFinal(g, st) {
  if (g.semGuia) return htmlMiniSemGuia(g, st);
  if (g.status !== 'concluido') aplicarSugestaoSituacao(g);
  const r = g.resultado, ok = guiaNumOk(g), pend = pendenciasConclusao(g, st);
  const obsTxt = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g), obsOk = g.copiados.obs === obsTxt;
  const showResp = mostraResposta(g), podeResp = showResp && !!(r.situacao || usaConsolidada()), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  const lib = ok && podeResp;
  return `<div class="mini-final">
    <div class="mini-num mini-num-final"><label for="miniGuia">Nº da guia</label><input type="text" id="miniGuia" class="num ${g.numero && !ok ? 'invalido' : ''}" value="${esc(g.numero || '')}" maxlength="10" placeholder="T00000000" autocomplete="off">
      <button type="button" class="btn sm ${obsOk ? 'copiado' : ''}" data-mact="copObs" title="Copia a observação da guia (texto simples) para colar no sistema">${ic(obsOk ? 'check' : 'copy', 'sm')}${obsOk ? 'Observação copiada' : 'Copiar observação'}</button></div>
    <div class="mini-sec">Situação da autorização</div>
    ${g.sitSug && r.situacao === g.sitSug.v ? `<div class="mini-div">${ic('info', 'sm')} Sugerida pelos prints: confira antes de concluir.</div>` : ''}
    <div class="mini-sit">${htmlSituacao(g)}</div>
    <div class="mini-sec">Resposta à clínica</div>
    ${showResp ? `<div class="mini-btns"><button type="button" class="btn sm ${g.copiados.resp ? 'copiado' : 'pri'}" data-mact="copResp" ${lib ? '' : 'disabled'} title="Copia a resposta com formatação, para colar no e-mail">${ic(g.copiados.resp ? 'check' : 'copy', 'sm')}${g.copiados.resp ? 'Resposta copiada' : 'Copiar resposta'}</button>${extInstalada() ? `<button type="button" class="btn sm line" data-mact="webmail" ${lib ? '' : 'disabled'} title="Abre o Responder a todos no webmail com a resposta colada">${ic('send', 'sm')}Responder no webmail</button>` : ''}</div>
      ${!podeResp ? '<div class="mini-div muted">Escolha a situação para liberar a resposta.</div>' : !ok ? '<div class="mini-div muted">Informe o nº da guia para liberar a resposta.</div>' : ''}`
      : `<div class="mini-div muted">Este e-mail tem ${guiasAtivas().length} guias: a resposta com todas sai na última (faltam ${faltam}).</div>`}
    ${htmlMiniMsg()}${htmlMiniPend(pend)}
    <div class="mini-btns mini-rodape"><button type="button" class="btn sm ghost" data-mact="voltar">${ic('left', 'sm')}Voltar</button><button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Conferidor</button><button type="button" class="btn sm pri" data-mact="concluir" ${pend.length ? 'disabled' : ''}>${ic('check', 'sm')}Concluir guia</button></div>
  </div>`;
}
function htmlMiniSemGuia(g, st) {
  const pend = pendenciasConclusao(g, st), showResp = mostraResposta(g), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  return `<div class="mini-final"><div class="mini-al">${ic('mail', 'sm')}<span>Responder sem gerar guia: <b>${esc(nomeModelo(g.semGuia))}</b></span></div>
    ${showResp ? `<div class="mini-btns"><button type="button" class="btn sm ${g.copiados.resp ? 'copiado' : 'pri'}" data-mact="copResp">${ic(g.copiados.resp ? 'check' : 'copy', 'sm')}${g.copiados.resp ? 'Resposta copiada' : 'Copiar resposta'}</button>${extInstalada() ? `<button type="button" class="btn sm line" data-mact="webmail">${ic('send', 'sm')}Responder no webmail</button>` : ''}</div>` : `<div class="mini-div muted">A resposta com todas as guias sai na última (faltam ${faltam}).</div>`}
    ${htmlMiniMsg()}${htmlMiniPend(pend)}
    <div class="mini-btns mini-rodape"><button type="button" class="btn sm ghost" data-mact="voltar">${ic('left', 'sm')}Voltar e gerar a guia</button><button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Conferidor</button><button type="button" class="btn sm pri" data-mact="concluir" ${pend.length ? 'disabled' : ''}>${ic('check', 'sm')}Concluir</button></div></div>`;
}
/* guia já tratada (o e-mail ainda aberto): resposta, próxima guia ou encerrar */
function htmlMiniFeita(g) {
  const prox = S.guias.findIndex(x => !guiaTerminal(x)), todas = S.guias.every(guiaTerminal), conc = g.status === 'concluido';
  const podeResp = conc && (!usaConsolidada() || todas);
  return `<div class="mini-final"><div class="mini-al ${conc ? 'ok' : ''}">${ic(conc ? 'check' : 'info', 'sm')}<span>${conc ? (g.semGuia ? `Respondida sem guia (${esc(nomeModelo(g.semGuia))})` : `Guia <b class="num">${esc(g.numero)}</b> concluída · ${esc(SIT_ROTULO[g.resultado.situacao] || '')}`) : esc(STATUS[g.status] || g.status)}</span></div>
    ${podeResp ? `<div class="mini-btns"><button type="button" class="btn sm line" data-mact="copRespFeita">${ic('copy', 'sm')}Copiar resposta</button>${extInstalada() ? `<button type="button" class="btn sm line" data-mact="webmailFeita">${ic('send', 'sm')}Responder no webmail</button>` : ''}</div>` : ''}
    ${htmlMiniMsg()}
    <div class="mini-btns mini-rodape"><button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Conferidor</button>${prox >= 0 ? `<button type="button" class="btn sm pri" data-mact="selGuia" data-i="${prox}">Próxima guia pendente${ic('right', 'sm')}</button>` : ''}${todas ? `<button type="button" class="btn sm pri" data-mact="encerrar">${ic('check', 'sm')}Encerrar atendimento</button>` : ''}</div></div>`;
}
function htmlMini(g, { flutuante = false, semPrints = false } = {}) {
  const modo = flutuante ? Mini.modoAtual() : 'guia';
  const abas = flutuante && (S || Lista.listas.length) ? `<div class="mini-abas" role="tablist"><button type="button" role="tab" class="${modo === 'guia' ? 'on' : ''}" data-mact="modo" data-v="guia">${ic('filecheck', 'sm')}Guia atual</button><button type="button" role="tab" class="${modo === 'lista' ? 'on' : ''}" data-mact="modo" data-v="lista">${ic('rows', 'sm')}${esc(Lista.nomeCurto())}${Lista.pendentesMeus() ? ` <span class="tag warn">${Lista.pendentesMeus()}</span>` : ''}</button></div>` : '';
  if (modo === 'lista') return `<div class="mini">${abas}${htmlMiniLista()}</div>`;
  if (!g || !S) return `<div class="mini">${abas}<div class="mini-vazio">${ic('mail', 'lg')}<b>Nenhum atendimento aberto</b><span class="muted">Abra um e-mail no conferidor (ou pelo botão do webmail) e os campos aparecem aqui.</span>${flutuante ? htmlMiniMsg() : ''}</div></div>`;
  const p = g.pedido, st = situacaoGuia(g), av = prontoPrints(g) ? avaliarPrints(g) : null, cl = clinicaDe(S);
  const seq = sequenciaGuia(g), comValor = seq.filter(x => x.v), feitos = comValor.filter(x => x.ok).length, prox = comValor.find(x => !x.ok);
  const etapa = !flutuante ? 'campos' : guiaTerminal(g) ? 'feita' : S.vista === 4 ? 'final' : 'campos';
  const linha = x => `<button type="button" class="mini-row ${x.ok ? 'ok' : ''} ${x.v ? '' : 'vazio'} ${prox && x.k === prox.k ? 'prox' : ''}" data-mcopy="${esc(x.k)}" ${x.v ? '' : 'disabled'} title="${x.v ? 'Copiar' : 'Vazio'}"><span class="r">${esc(x.rot.replace(/^Qtd\. de \d+$/, 'Qtd.'))}</span><span class="v num">${esc(x.v || '—')}</span>${x.ok ? ic('check', 'sm') : ic('copy', 'sm')}</button>`;
  const prob = av ? [...av.checks, ...av.linhas].filter(x => x.sit === 'bad' || x.sit === 'warn') : [];
  const pc = comValor.length ? Math.round(100 * feitos / comValor.length) : 0;
  const ult = ultimaDaGuia(g), ultOk = ult && g.copiados.ultima === ult.guia;
  const htmlUlt = ult ? `<button type="button" class="mini-ult ${ultOk ? 'ok' : ''}" data-mcopy="ultima" title="Copiar o nº da última guia deste paciente${ult.clinica ? ' (' + esc(ult.clinica) + ')' : ''}"><span>Última guia deste paciente:</span> <b class="num">${esc(ult.guia)}</b> <span class="muted">${fmtData(ult.concluidoEm)}</span>${ic(ultOk ? 'check' : 'copy', 'sm')}</button>` : '';
  const htmlCrit = st.criticos.map(a => `<div class="mini-critico" role="alert"><div><b>Confirmação obrigatória:</b> ${esc(a.texto)}</div><div class="mini-btns">${a.guiaAnterior ? `<button type="button" class="btn sm line" data-mact="copValor" data-v="${esc(a.guiaAnterior)}" title="Copiar o nº da guia anterior">${ic('copy', 'sm')}${esc(a.guiaAnterior)}</button>` : ''}<button type="button" class="btn sm conferi-btn critico" data-mact="conferi" data-conf="${esc(a.key)}">${ic('check', 'sm')}Conferi${a.conferiRot ? ': ' + esc(a.conferiRot) : ''}</button></div></div>`).join('');
  const cab = `<div class="mini-h"><div style="min-width:0"><b class="mini-nome">${esc(p.beneficiario || 'Beneficiário não informado')}</b>${htmlUlt}<div class="muted">${esc(cl ? cl.nome : S.email.remetente.email)}${S.guias.length > 1 ? ` · guia ${g.idx + 1} de ${S.guias.length}` : ''} · etapa ${S.vista}</div></div><div class="mini-h-d">${flutuante ? htmlMiniSino(g, st) : ''}<span class="tag ${pc === 100 ? 'ok' : ''}" title="Campos copiados">${feitos}/${comValor.length}</span></div></div>
    <div class="lst-barra"><i style="width:${pc}%"></i></div>${etapa !== 'feita' ? htmlCrit : ''}${flutuante && Mini.verAlertas ? htmlMiniAlertas(g, st) : ''}`;
  if (etapa === 'final') return `<div class="mini">${abas}${cab}${htmlMiniFinal(g, st)}</div>`;
  if (etapa === 'feita') return `<div class="mini">${abas}${cab}${htmlMiniFeita(g)}</div>`;
  return `<div class="mini">${abas}${cab}
    ${st.bloqueios.length ? `<div class="mini-al bad">${ic('ban', 'sm')}<span><b>${pl(st.bloqueios.length, 'bloqueio', 'bloqueios')}:</b> ${esc(curtoTxt(st.bloqueios[0].texto, 90))}</span></div>` : ''}
    ${prox ? `<button type="button" class="mini-prox" data-mcopy="${esc(prox.k)}" title="Copia o próximo campo (atalho: barra de espaço)"><small>Copiar próximo</small><b>${esc(prox.rot)}</b><span class="num">${esc(prox.v)}</span></button>` : `<div class="mini-al ok">${ic('check', 'sm')}Todos os campos foram copiados.</div>`}
    <div class="mini-lista">${seq.slice(0, MINI_CAMPOS.length).map(linha).join('')}
      <div class="mini-sec">Serviços</div>
      ${p.itens.map(it => { const sc = seq.find(x => x.k === 'c:' + it.codigo), sq = seq.find(x => x.k === 'q:' + it.codigo), d = descRefItem(g, it).texto; return `<div class="mini-item ${(it.qtd || 1) > 1 ? 'qtd-alta' : ''}">${linha(sc)}${linha(sq)}${d ? `<div class="mini-desc" title="${esc(d)}">${esc(d)}</div>` : ''}</div>`; }).join('') || '<p class="muted">Sem serviços.</p>'}</div>
    ${semPrints ? '' : `<div class="mini-sec">Conferência pelos prints</div>
    <div class="mini-prints">
      ${av ? `<div class="mini-al ${av.ok ? 'ok' : prob.length ? 'warn' : ''}">${ic(av.ok ? 'check' : 'alert', 'sm')}${av.ok ? 'Conferido pelos prints' + (av.ressalvas ? ' (com ressalva)' : '') : prob.length ? pl(prob.length, 'ponto para conferir', 'pontos para conferir') : av.avisos[0] || 'Faltam prints'}</div>
        <div class="mini-conf">${[...av.checks, ...av.linhas.map(l => ({ ...l, rot: 'Item ' + l.codigo, lido: l.qSis, ped: l.qPed }))].map(x => { const s = x.ign ? 'ign' : x.sit; return `<div class="mc ${s}"><span class="mc-i">${s === 'ok' ? '✓' : s === 'bad' ? '✕' : s === 'ign' ? '–' : s === 'info' ? 'i' : '!'}</span><span class="mc-r">${esc(x.rot)}</span><span class="mc-v num">${esc(String(x.lido ?? '—'))}${s === 'bad' || s === 'warn' ? ` <span class="muted">pedido ${esc(String(x.ped ?? '—'))}</span>` : ''}</span></div>`; }).join('')}</div>
        ${prob.length ? `<button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Resolver divergências no conferidor</button>` : ''}
        ${av.avisos.filter(a => /Falta/.test(a)).map(a => `<div class="mini-div">• ${esc(a)}</div>`).join('')}` : '<p class="muted" style="margin:0 0 6px">Nenhum print lido ainda.</p>'}
      <div class="mini-btns">${Captura.suportada() ? `<button type="button" class="btn sm pri" data-mact="capturar">${ic('monitor', 'sm')}${Captura.ativa() ? 'Capturar janela' : 'Conectar janela'}</button>` : ''}<button type="button" class="btn sm" data-mact="colar">${ic('clip', 'sm')}Colar print</button></div>
      ${htmlMiniMsg()}
      <div class="mini-num"><label for="miniGuia">Nº da guia</label><input type="text" id="miniGuia" class="num" value="${esc(g.numero || '')}" maxlength="10" placeholder="T00000000" autocomplete="off">${g.numero ? `<span class="muted">${g.numeroOrigem === 'print' ? 'do print' : 'digitado'}</span>` : ''}</div>
    </div>`}
    <div class="mini-btns" style="margin-top:8px">${flutuante ? `<button type="button" class="btn sm line" data-mact="abrir">${ic('right', 'sm')}Ir para o conferidor</button>${guiaNumOk(g) ? `<button type="button" class="btn sm pri" data-mact="proximo" title="Observação, situação da autorização, resposta e Concluir guia">Próximo${ic('right', 'sm')}</button>` : ''}<span class="dica" style="margin:0">Espaço = copiar próximo</span>` : `<button type="button" class="btn sm line" data-act="visualizacao" data-v="completa">${ic('monitor', 'sm')}Voltar à visualização completa</button>`}</div>
  </div>`;
}
/* painel flutuante, modo lista do dia: a próxima guia da minha fila, para gerar sem sair do sistema */
function itemMiniLista() {
  const eu = operadorObj(); if (!eu) return {};
  const Ls = Lista.listas.filter(l => !l.finalizadaEm && l.itens.some(i => i.resp === eu.id && !i.r)); const L = Ls.find(l => l.id === Lista.sel) || Ls[0];
  if (!L) return {};
  const pend = Lista.linhasEmail({ itens: Lista.meus(L) }).filter(i => !i.r);
  return { L, pend, it: pend.find(i => i.id === Lista.foco) || pend[0] };
}
function camposMiniLista(it) { const q = it.qtd ?? 1; return [['benef', 'Beneficiário', it.benef], ['carteira', 'Carteira', it.carteira || it.carteiraBruta], ['codigo', 'Serviço', it.codigo], ['qtd', 'Quantidade', String(q)], ['cid', 'CID', it.cid], ['emissao', 'Emissão', it.emissao], ['local', 'Local', it.local], ['crm', 'CRM', it.crm], ['medico', 'Médico', it.medico]]; }
function htmlMiniLista() {
  const { L, pend, it } = itemMiniLista();
  if (!L || !it) return `<div class="mini-vazio">${ic('check', 'lg')}<b>Nada pendente na sua fila</b><span class="muted">Quando uma lista do dia for dividida com você, as guias aparecem aqui.</span></div>`;
  const cps = Mini.lstCopiados[it.id] || {}, campos = camposMiniLista(it), prox = campos.find(([k, , v]) => v && !cps[k]);
  const meus = Lista.meus(L), feitos = meus.filter(i => i.r).length, pc = meus.length ? Math.round(100 * feitos / meus.length) : 0, q = it.qtd ?? 1;
  const ja = Lista.jaAutorizada(it);
  return `<div class="mini-h"><div style="min-width:0"><b class="mini-nome">${esc(it.benef)}</b><div class="muted">${esc(L.clinica)} · ${esc(L.nome)} · faltam ${pend.length}</div></div><span class="tag">${feitos}/${meus.length}</span></div>
    <div class="lst-barra"><i style="width:${pc}%"></i></div>
    ${q > 1 ? `<div class="mini-al warn">${ic('alert', 'sm')}<b>Quantidade ${q}</b> neste serviço.</div>` : ''}
    ${it.obs ? `<div class="mini-al">${ic('message', 'sm')}<span><b>Obs.:</b> ${esc(it.obs)}</span></div>` : ''}
    ${ja ? `<div class="mini-critico" role="alert"><div><b>Possível pedido repetido:</b> serviço já autorizado para esta carteira na guia <b class="num">${esc(ja.guia)}</b> em ${fmtDH(ja.concluidoEm)}${ja.operador ? ' por ' + esc(ja.operador) : ''}. Ao registrar, o painel pede confirmação.</div></div>` : ''}
    ${prox ? `<button type="button" class="mini-prox" data-mact="lstCopiar" data-k="${prox[0]}" title="Copia o próximo campo (atalho: barra de espaço)"><small>Copiar próximo</small><b>${esc(prox[1])}</b><span class="num">${esc(prox[2])}</span></button>` : `<div class="mini-al ok">${ic('check', 'sm')}Campos copiados. Registre o nº da guia.</div>`}
    <div class="mini-lista">${campos.map(([k, r, v]) => `<button type="button" class="mini-row ${cps[k] ? 'ok' : ''} ${v ? '' : 'vazio'} ${prox && prox[0] === k ? 'prox' : ''} ${k === 'qtd' && q > 1 ? 'qtd-alta' : ''}" data-mact="lstCopiar" data-k="${k}" ${v ? '' : 'disabled'}><span class="r">${esc(r)}</span><span class="v num">${esc(v || '—')}</span>${cps[k] ? ic('check', 'sm') : ic('copy', 'sm')}</button>`).join('')}
      <div class="mini-div muted">${esc(it.servico || '')}</div></div>
    <div class="mini-num"><label for="miniLstGuia">Nº da guia</label><input type="text" id="miniLstGuia" class="num" value="${esc(Lista.rascunho[it.id] || '')}" maxlength="10" placeholder="T00000000" autocomplete="off"><button type="button" class="btn sm pri" data-mact="lstRegistrar">${ic('check', 'sm')}Registrar</button></div>
    <div class="mini-btns"><button type="button" class="btn sm line" data-mact="lstSem" data-v="Paciente excluso">Paciente excluso</button><button type="button" class="btn sm line" data-mact="lstSem" data-v="Guia já liberada em">Já liberada em…</button><button type="button" class="btn sm line" data-mact="lstSem" data-v="">Outro motivo…</button>${pend.length > 1 ? `<button type="button" class="btn sm ghost" data-mact="lstPular">${ic('right', 'sm')}Pular</button>` : ''}</div>
    ${miniMsg ? `<div class="mini-msg">${esc(miniMsg)}</div>` : ''}
    <div class="mini-btns" style="margin-top:8px"><button type="button" class="btn sm line" data-mact="abrirLista">${ic('right', 'sm')}Ver a lista no conferidor</button><span class="dica" style="margin:0">Espaço = copiar próximo · Enter = registrar</span></div>`;
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
const MINI_ACOES_TELA = new Set(['setSit', 'setGlosa']);
const Mini = {
  win: null, modo: null, lstCopiados: {}, pendente: false, semPend: null, verAlertas: false, focoProx: false,
  aberto() { return !!(this.win && !this.win.closed); },
  modoAtual() { return this.modo || (!S && Lista.pendentesMeus() ? 'lista' : 'guia'); },
  avisar(t) { miniMsg = t || ''; this.pendente = false; this.atualizar(); },
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
    d.addEventListener('keydown', e => this.tecla(e));
    d.addEventListener('input', e => {
      const t = e.target; if (t.id === 'miniLstGuia') { const it = itemMiniLista().it; if (it) Lista.rascunho[it.id] = t.value; return; }
      if (S && t.id !== 'miniGuia' && guiaAtiva()) digitouFinal(t, guiaAtiva());   // etapa final: detalhe do motivo, glosa
    });
    d.addEventListener('change', e => { const t = e.target; if (t.id === 'miniGuia') { this.salvarGuia(t.value); return; } if (S && guiaAtiva()) mudouFinal(t, guiaAtiva()); });   // itens não autorizados, motivos, glosa
    d.addEventListener('focusout', () => setTimeout(() => { if (this.pendente && this.aberto() && !campoDeTexto(this.win.document.activeElement)) { this.pendente = false; this.atualizar(); } }, 50));
    d.addEventListener('paste', e => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); if (!S) { this.avisar('Nenhum atendimento aberto para receber o print.'); return; } this.avisar('Lendo o print…'); processarPrints(fs, t => this.avisar(t)); });
    this.win.addEventListener('pagehide', () => { this.win = null; if (Vis.get() === 'flutuante') Vis.set('completa'); render(); });
    this.atualizar(); render();
  },
  atualizar() {
    if (!this.aberto()) { this.win = null; return; }
    const d = this.win.document, el = d.getElementById('miniApp'); if (!el) return;
    const ae = d.activeElement; if (campoDeTexto(ae) && el.contains(ae)) { this.pendente = true; return; }   // não apaga o que está sendo digitado
    const rol = d.scrollingElement ? d.scrollingElement.scrollTop : 0;
    el.innerHTML = htmlMini(S ? guiaAtiva() : null, { flutuante: true }) + (this.semPend ? this.htmlSemGuia() : '');
    if (d.scrollingElement) d.scrollingElement.scrollTop = rol;   // redesenhar não volta o painel para o topo
    if (this.semPend) { const i = d.getElementById('miniMot'); if (i) i.focus(); }
    if (this.focoProx) { this.focoProx = false; const b = d.querySelector('[data-mact=proximo]'); if (b) b.focus(); }   // Enter no nº da guia: o Próximo fica no foco
  },
  htmlSemGuia() { return `<div class="mini-sem"><label for="miniMot">${esc(this.semPend.v ? this.semPend.v + '… (data ou nº da guia)' : 'Motivo (vai para o e-mail de entrega)')}</label><input type="text" id="miniMot" autocomplete="off"><div class="mini-btns"><button type="button" class="btn sm pri" data-mact="lstSemOk">Registrar sem guia</button><button type="button" class="btn sm ghost" data-mact="lstSemCancela">Cancelar</button></div></div>`; },
  salvarGuia(v) {
    const g = guiaAtiva(); if (!g) return; v = String(v || '').trim().toUpperCase().replace(/\s+/g, ''); if (/^\d{8}$/.test(v)) v = 'T' + v;
    if (v && !/^[TS]\d{7,8}$/.test(v)) { miniMsg = 'Nº da guia: T ou S + 7 ou 8 dígitos.'; this.pendente = false; this.atualizar(); return; }
    if (v === (g.numero || '')) return;
    g.numero = v; g.numeroOrigem = 'digitado'; evento(g, 'numero', `Nº da guia digitado no painel flutuante: ${v || '(apagado)'}`); miniMsg = v ? 'Nº da guia salvo: ' + v : '';
    persistir(); render();
  },
  tecla(e) {
    const d = this.win.document, t = e.target, emCampo = t && /INPUT|TEXTAREA|SELECT/.test(t.tagName);
    if (e.key === 'Enter' && t.id === 'miniLstGuia') { e.preventDefault(); this.acao('lstRegistrar'); return; }
    if (e.key === 'Enter' && t.id === 'miniMot') { e.preventDefault(); this.acao('lstSemOk'); return; }
    if (e.key === 'Enter' && t.id === 'miniGuia') { e.preventDefault(); this.focoProx = true; t.blur(); return; }
    if (e.key === 'Escape' && this.semPend) { this.semPend = null; this.atualizar(); return; }
    if ((e.key === ' ' || e.code === 'Space') && !emCampo) { const b = d.querySelector('.mini-prox'); if (b) { e.preventDefault(); b.click(); } }
  },
  async acao(a, b) {
    const d = this.win.document;
    if (a === 'modo') { this.modo = b.dataset.v; if (this.modo === 'lista') await Lista.carregar(isoDia(new Date())).catch(() => { }); this.atualizar(); return; }
    if (a === 'abrirLista') { window.focus(); aba = 'lista'; Lista.sub = 'continuar'; render(); return; }
    const { L, pend, it } = itemMiniLista();
    if (a === 'lstCopiar' && it) {
      const v = (camposMiniLista(it).find(([k]) => k === b.dataset.k) || [])[2]; if (!v) return;
      try { await this.win.navigator.clipboard.writeText(v); } catch (er) { miniMsg = 'Não consegui copiar: clique de novo.'; this.atualizar(); return; }
      (this.lstCopiados[it.id] = this.lstCopiados[it.id] || {})[b.dataset.k] = true; miniMsg = 'Copiado: ' + v; this.atualizar(); return;
    }
    if (a === 'lstPular' && it) { const i = pend.indexOf(it); Lista.foco = (pend[i + 1] || pend[0]).id; miniMsg = ''; this.atualizar(); return; }
    if (a === 'lstRegistrar' && it) {
      const inp = d.getElementById('miniLstGuia'), v = String((inp && inp.value) || '').trim().toUpperCase().replace(/\s+/g, '');
      if (inp) inp.blur(); this.pendente = false;
      if (!/^[TS]\d{7,8}$/.test(v)) { miniMsg = 'Nº da guia: T ou S + 7 ou 8 dígitos.'; this.atualizar(); return; }
      const ja = Lista.jaAutorizada(it); if (ja && !this.win.confirm(Lista.textoJa(it, ja))) { miniMsg = 'Registro cancelado: confira o pedido repetido.'; this.atualizar(); return; }
      await Lista.registrar(L, it, { st: 'gerada', guia: v }); Lista.foco = null; miniMsg = `Guia ${v} registrada (${it.benef.split(' ')[0]}).`;
      render(); this.atualizar(); const n = d.getElementById('miniLstGuia'); if (n) n.focus(); return;
    }
    if (a === 'lstSem' && it) { if (b.dataset.v && !/em$/.test(b.dataset.v)) { await Lista.registrar(L, it, { st: 'semguia', obs: b.dataset.v }); Lista.foco = null; miniMsg = `${it.benef.split(' ')[0]}: ${b.dataset.v}.`; render(); this.atualizar(); } else { this.semPend = { v: b.dataset.v, item: it.id }; this.atualizar(); } return; }
    if (a === 'lstSemCancela') { this.semPend = null; this.atualizar(); return; }
    if (a === 'lstSemOk' && it && this.semPend) {
      const extra = (d.getElementById('miniMot') || {}).value || ''; if (!extra.trim() && !this.semPend.v) { miniMsg = 'Escreva o motivo.'; return; }
      const obs = `${this.semPend.v} ${extra}`.trim(), alvo = L.itens.find(x => x.id === this.semPend.item) || it; this.semPend = null;
      await Lista.registrar(L, alvo, { st: 'semguia', obs }); Lista.foco = null; miniMsg = `${alvo.benef.split(' ')[0]}: ${obs}.`; render(); this.atualizar(); return;
    }
  },
  /* etapa final e alertas (guia atual) */
  async guiaAcao(a, b) {
    const g = S && guiaAtiva(); if (!g) return false;
    const w = this.win;
    switch (a) {
      case 'alertas': this.verAlertas = !this.verAlertas; this.atualizar(); return true;
      case 'conferi': acoes.conferiAlerta(b); return true;
      case 'copValor': { const v = b.dataset.v || ''; this.avisar(v && await copiar(v, w) ? 'Copiado: ' + v : 'Não consegui copiar: clique de novo.'); return true; }
      case 'proximo': {
        const st = situacaoGuia(g);
        if (!guiaNumOk(g)) { this.avisar('Informe o nº da guia (T ou S + 7 ou 8 dígitos).'); return true; }
        if (st.bloqueios.length) { this.verAlertas = true; this.avisar('Há bloqueio nesta guia: veja os alertas no sino ou resolva no conferidor.'); return true; }
        if (!st.pode) { this.avisar('Possível pedido repetido: confira o aviso em vermelho e marque "Conferi: não é repetido".'); return true; }
        if (!podeFinal(g, st)) { this.avisar('Falta a conferência da grade: leia os prints do sistema (ou confira no conferidor).'); return true; }
        if (g.status !== 'concluido') gravarGuia(g, g.status);
        miniMsg = ''; mudarVista(4); return true;
      }
      case 'voltar': miniMsg = ''; if (g.semGuia) acoes.desfazerSemGuia(); else mudarVista(3); return true;
      case 'copObs': {
        const v = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g);
        if (!(await copiar(v, w))) { this.avisar('Não consegui copiar: clique de novo.'); return true; }
        g.copiados.obs = v; miniMsg = 'Observação copiada: cole no sistema.'; persistir(); render(); return true;
      }
      case 'copResp': case 'copRespFeita': {
        const { html, texto } = respostaParaCopiar(g, a === 'copRespFeita');
        if (/\{[A-Z_]+\}/.test(texto) && !w.confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return true;
        const r = await copiarRico(html, texto, w);
        if (!r) { this.avisar('Não consegui copiar: clique de novo.'); return true; }
        if (a === 'copResp') g.copiados.resp = true;
        miniMsg = r === 'rico' ? 'Resposta copiada com formatação: cole no e-mail.' : 'Resposta copiada como texto simples.'; persistir(); render(); return true;
      }
      case 'webmail': case 'webmailFeita': {
        if (!extInstalada()) { this.avisar('Instale a extensão do Chrome para levar a resposta ao webmail.'); return true; }
        const { html, texto } = respostaParaCopiar(g, a === 'webmailFeita');
        if (/\{[A-Z_]+\}/.test(texto) && !w.confirm('Ainda há campos sem valor (entre chaves) no texto. Levar mesmo assim?')) return true;
        levarRespostaAoWebmail(g, html, texto); miniMsg = 'Levando a resposta ao webmail…'; render(); return true;
      }
      case 'concluir': {
        const pend = pendenciasConclusao(g, situacaoGuia(g));
        if (pend.length) { this.avisar(pend[0]); return true; }
        const txt = g.semGuia ? 'Respondida sem guia e registrada.' : `Guia ${g.numero} concluída e registrada.`;
        await acoes.concluirGuia(); this.verAlertas = false; this.avisar(txt); return true;
      }
      case 'selGuia': miniMsg = ''; acoes.selGuia(b); return true;
      case 'encerrar': acoes.encerrar(); this.avisar('Atendimento encerrado.'); return true;
    }
    return false;
  },
  async clique(e) {
    const c = e.target.closest('[data-mcopy]'); if (c) { await miniCopiar(c.dataset.mcopy, this.win); return; }
    const ba = e.target.closest('[data-act]');
    if (ba && !ba.disabled && MINI_ACOES_TELA.has(ba.dataset.act)) { e.preventDefault(); acoes[ba.dataset.act](ba); return; }   // botões da etapa 4 reaproveitados (situação, glosa)
    const b = e.target.closest('[data-mact]'); if (!b || b.disabled) return;
    const a = b.dataset.mact;
    if (/^(modo|abrirLista|lst)/.test(a)) { await this.acao(a, b); return; }
    if (await this.guiaAcao(a, b)) return;
    if (a === 'abrir') { window.focus(); return; }
    if (a === 'capturar') { this.avisar(Captura.ativa() ? 'Capturando a janela do sistema…' : 'Escolha a janela do sistema na lista do Chrome…'); await capturarJanela(this.win.navigator, t => this.avisar(t)); return; }
    if (a === 'colar') {
      let fs = [];
      try {
        const itens = await this.win.navigator.clipboard.read();
        for (const it of itens) for (const t of it.types) if (/^image\//.test(t)) fs.push(new File([await it.getType(t)], 'print-colado.png', { type: t }));
      } catch (er) { this.avisar('O Chrome não liberou a área de transferência aqui: clique no painel e use Ctrl+V.'); return; }
      if (!fs.length) { this.avisar('Não há imagem copiada. Copie o print e clique de novo (ou Ctrl+V aqui).'); return; }
      this.avisar('Lendo o print…'); await processarPrints(fs, t => this.avisar(t));
    }
  }
};
setInterval(async () => { if (!Mini.aberto() || Mini.modoAtual() !== 'lista') return; await Lista.carregar(isoDia(new Date())).catch(() => { }); Mini.atualizar(); }, 15000);
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

/* ---------- Quem está com o Conferidor aberto agora (batimento na pasta a cada 30 s) ----------
   Cada navegador grava o próprio arquivo (presenca/<operador>--<sessão>.json): o mesmo operador em dois computadores
   não apaga o retrato do outro, e na leitura os arquivos do mesmo operador são somados.
   Os arquivos vêm da pasta compartilhada: cada campo é conferido (tipo, tamanho, faixa) antes de ir para a tela. */
const PRES_VIVO_MS = 3 * 60000;
const presTxt = (v, n = 120) => (typeof v === 'string' ? v.slice(0, n) : '');
const presInt = (v, min, max, padrao) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const presData = v => (typeof v === 'string' && !isNaN(new Date(v)) ? v : null);
function limparPresenca(d) {
  if (!d || typeof d !== 'object') return null;
  const em = presData(d.em); if (!em) return null;
  const guias = (Array.isArray(d.guias) ? d.guias : []).slice(0, 30).filter(x => x && typeof x === 'object' && typeof x.id === 'string' && x.id).map(x => ({
    id: x.id.slice(0, 120), paciente: presTxt(x.paciente), carteira: presTxt(x.carteira, 40), clinica: presTxt(x.clinica), clinicaId: presTxt(x.clinicaId, 80),
    vista: presInt(x.vista, 1, 4, 2), ativa: x.ativa === true, itens: presInt(x.itens, 0, 99, 0), idx: presInt(x.idx, 0, 98, 0), total: presInt(x.total, 1, 99, 1), desde: presData(x.desde) }));
  return { operador: presTxt(d.operador, 80), operadorId: presTxt(d.operadorId, 80), em, aba: presTxt(d.aba, 20), visivel: d.visivel !== false, lista: presInt(d.lista, 0, 9999, 0), guias };
}
/* o mesmo operador em mais de um computador: um registro só, com as guias de todos (a mais recente vale) */
function juntarPresenca(docs) {
  const por = new Map();
  docs.sort((a, b) => new Date(a.em) - new Date(b.em)).forEach(d => {
    const k = d.operadorId || d.operador, a = por.get(k);
    const guias = new Map(a ? a.guias.map(x => [x.id, x]) : []); d.guias.forEach(x => guias.set(x.id, x));
    por.set(k, a ? { ...d, visivel: a.visivel || d.visivel, lista: Math.max(a.lista, d.lista), guias: [...guias.values()] } : d);
  });
  return [...por.values()];
}
/* início da etapa atual: zera quando muda a etapa (mudarVista) ou a guia ativa, para a guia nova não herdar o tempo da anterior */
function inicioEtapa() {
  if (!S) return null;
  const g = guiaAtiva(), id = g ? g.id : '';
  if (S.vistaGuia === undefined) S.vistaGuia = id;   // atendimento salvo antes desta versão: mantém o tempo que já tinha
  if (S.vistaGuia !== id) { S.vistaGuia = id; S.vistaDesde = agora(); S.avisoParado = null; persistir(); }
  return S.vistaDesde || null;
}
const Presenca = {
  lista: [], erro: null, lidoEm: null,
  sessao() { let s = LS.get('presencaSessao', ''); if (!/^[a-z0-9]{6,16}$/.test(s)) { s = Math.random().toString(36).slice(2, 10) || 'sessao'; LS.set('presencaSessao', s); } return s; },
  async bater() {
    if (!Pasta.ok || Abas.pausada) return;
    const op = operadorObj(), nome = op ? `${slug(op.id || op.nome)}--${this.sessao()}.json` : null, ant = LS.get('presencaArquivo', '');
    if (ant && ant !== nome) { await Pasta.apagar(['presenca'], ant); LS.set('presencaArquivo', ''); }   // trocou de operador (ou saiu): o anterior deixa de aparecer ao vivo
    if (!op) return;
    const g = S ? guiaAtiva() : null, cl = S ? clinicaDe(S) : null, desde = inicioEtapa();
    const guias = S ? S.guias.filter(x => !guiaTerminal(x)).map(x => ({ id: x.id, paciente: x.pedido.beneficiario || '', carteira: x.carteiraUsada || x.pedido.carteira || '', clinica: cl ? cl.nome : ((S.email.remetente || {}).email || ''), clinicaId: cl ? cl.id : '', vista: x === g ? S.vista : (x.vista || x.etapa || 2), ativa: x === g, itens: x.pedido.itens.length, idx: x.idx, total: S.guias.length, desde: x === g ? desde : null })) : [];
    try { await Pasta.gravar(['presenca'], nome, { operador: op.nome, operadorId: op.id, em: agora(), aba, etapa: S ? S.vista : 0, atendendo: !!S, visivel: !document.hidden, guias, lista: typeof Lista !== 'undefined' ? Lista.pendentesMeus() : 0 }); LS.set('presencaArquivo', nome); } catch (e) { }
  },
  agendar() { clearTimeout(this.t); this.t = setTimeout(() => this.bater(), 1500); },
  /* falha ao ler a pasta: fica o último retrato (sem quem já passou do prazo) e o aviso na tela, em vez de uma lista vazia */
  async ler() {
    if (!Pasta.ok) { this.lista = []; this.erro = null; return []; }
    const vivo = d => Date.now() - new Date(d.em) < PRES_VIVO_MS;
    let ents;
    try { ents = await Pasta.listarSeguro(['presenca']); }
    catch (e) { this.erro = { msg: (e && e.message) || 'falha ao ler a pasta', em: agora() }; this.lista = this.lista.filter(vivo); return this.lista; }
    const docs = []; let falhas = 0;
    for (const [n, h] of ents) {
      if (!n.endsWith('.json')) continue;
      let txt; try { txt = await (await h.getFile()).text(); } catch (e) { falhas++; continue; }
      let d = null; try { d = limparPresenca(JSON.parse(txt)); } catch (e) { d = null; }   // arquivo gravado pela metade: o próximo batimento corrige
      if (d && vivo(d)) docs.push(d);
    }
    this.erro = falhas ? { msg: pl(falhas, 'arquivo de presença não pôde ser lido', 'arquivos de presença não puderam ser lidos'), em: agora() } : null;
    this.lidoEm = agora();
    this.lista = juntarPresenca(docs).sort((a, b) => a.operador.localeCompare(b.operador)); return this.lista;
  }
};
setInterval(async () => {
  await Presenca.bater();
  if (document.hidden || Abas.pausada) return;
  if (aba === 'quadro') { try { await Reg.carregar(); await Presenca.ler(); repintarQuadro(); } catch (e) { } }   // quadro aberto acompanha os outros computadores sem clicar em Atualizar
}, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) Presenca.bater(); });
function htmlPresenca() {
  if (!Pasta.ok) return `<div class="card" id="cardPresenca"><div class="card-h"><h2>Com o Conferidor aberto agora</h2></div><p class="muted" style="margin:0">Conecte a pasta compartilhada para ver quem está on-line.</p></div>`;
  const L = Presenca.lista, er = Presenca.erro;
  const aviso = er ? `<div class="aviso" role="status" style="margin:0 0 8px">${ic('alert')}<div>Não consegui ler a presença na pasta às ${fmtHora(er.em)} (${esc(er.msg)}). ${Presenca.lidoEm ? `Mostrando o último retrato, de ${fmtHora(Presenca.lidoEm)}: pode faltar gente.` : 'A lista abaixo pode estar incompleta.'}</div></div>` : '';
  return `<div class="card" id="cardPresenca"><div class="card-h"><h2>Com o Conferidor aberto agora</h2><span class="tag ${er ? 'warn' : L.length ? 'ok' : ''}">${pl(L.length, 'pessoa', 'pessoas')}${er ? ' (incompleto)' : ''}</span></div>${aviso}
    <div class="presenca">${L.map(d => { const o = cfg.operadores.find(x => x.id === d.operadorId); const min = Math.max(0, Math.round((Date.now() - new Date(d.em)) / 60000));
      const ga = d.guias.find(x => x.ativa) || d.guias[0], ETP = { 1: 'E-mail', 2: 'Pedido e alertas', 3: 'Guia e conferência', 4: 'Finalizar' };
      const ondeTxt = ga ? `<b>${esc(nomeCurto(ga.paciente) || 'beneficiário')}</b> × ${esc(ga.clinica || 'clínica')} · ${esc(ETP[ga.vista] || 'etapa ' + ga.vista)}${ga.desde ? ` há ${Math.max(0, Math.round((Date.now() - new Date(ga.desde)) / 60000))} min` : ''}${d.guias.length > 1 ? ` · ${d.guias.length} guias abertas` : ''}` : d.aba === 'lista' ? `na lista do dia${d.lista ? ` · ${d.lista} pendentes` : ''}` : 'sem atendimento aberto';
      return `<div class="pres-op">${htmlAvatar(o)}<div><b>${esc(d.operador)}</b><small>${ondeTxt}${d.lista && d.aba !== 'lista' ? ` · lista: ${d.lista} pendentes` : ''}${d.visivel === false ? ' · em outra janela' : ''}${min >= 1 ? ` · sinal há ${min} min` : ''}</small></div></div>`; }).join('') || '<p class="muted" style="margin:0">Ninguém além de você, no momento.</p>'}</div></div>`;
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
  const desde = inicioEtapa(); if (!desde) { S.vistaDesde = agora(); return; }
  const min = Math.floor((Date.now() - new Date(desde)) / 60000);
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

/* Abertura: cada etapa é isolada e tem prazo. Se uma falhar ou travar (ex.: pasta compartilhada lenta), as outras seguem e a página abre. */
const ERROS_INICIO = [];
async function passoInicio(nome, fn, prazo = 15000) {
  try { await Promise.race([Promise.resolve().then(fn), new Promise((_, rej) => setTimeout(() => rej(new Error(`demorou mais de ${prazo / 1000} s`)), prazo))]); }
  catch (e) { console.error(nome, e); ERROS_INICIO.push(`${nome}: ${e && e.message || e}`); }
}
async function init() {
  for (const [n, f] of [['abas', () => Abas.iniciar()], ['dicas', () => Dica.iniciar()], ['ícones', () => iniciarSoIcone()], ['tema', () => Tema.aplicar()]]) { try { f(); } catch (e) { ERROS_INICIO.push(n + ': ' + e.message); } }
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
  const hoje = new Date();
  try { $('#printData').textContent = 'Emitido em ' + fmtData(hoje) + ', ' + fmtHora(hoje) + ' · Criado por Alexandre Neves'; $('#anoRodape').textContent = hoje.getFullYear(); } catch (e) { }
  await passoInicio('Pasta compartilhada', () => Pasta.init(), 10000);
  await passoInicio('Configurações', () => carregarConfig());
  await passoInicio('Parametrizações', () => Param.carregar());
  await passoInicio('Registros', () => Reg.carregar(), 20000);
  Reg.conferirLocais().catch(() => { });
  Presenca.bater().catch(() => { });
  await passoInicio('Aprendizado', () => Apr.carregar());
  await passoInicio('Notas', () => Notas.carregar());
  try { S = LS.get('atual', null); if (S && (S.v !== 2 || !Array.isArray(S.guias) || !S.guias.length)) S = null; } catch (e) { S = null; }
  render();
  if (ERROS_INICIO.length) toast('Parte dos dados não carregou: ' + ERROS_INICIO.join(' · '), 'bad');
}
init().catch(e => { (window.__erros || []).push('Abertura: ' + (e && e.stack || e)); try { render(); } catch (er) { if (window.__falhaAbrir) window.__falhaAbrir(); } });
