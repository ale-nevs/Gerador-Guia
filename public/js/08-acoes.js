'use strict';
/* ====================================================================
   Entrada de arquivos e início do atendimento
   ==================================================================== */
async function abrirArquivo(f) {
  if (!operador()) { toast('Escolha o operador no topo da página.', 'bad'); return; }
  if (!/\.eml$/i.test(f.name) && f.type !== 'message/rfc822') { toast('Esse arquivo não é um .eml. Envie o e-mail baixado do SmarterMail.', 'bad'); return; }
  try { aba = 'atend'; await iniciar(lerEml(await f.arrayBuffer())); }
  catch (e) { console.error(e); toast('Não consegui ler esse .eml: ' + e.message, 'bad'); }
}
/* Quem abre o e-mail é quem o finaliza. Se um colega já trabalhou nele, avisa antes de abrir. */
function avisoEmailJaAtendido(email) {
  const outros = Reg.cache.filter(r => !r.tipo && r.messageId === email.messageId && r.status !== 'descartado');
  if (!outros.length) return null;
  const quem = unicos(outros.map(r => `${r.operador || 'um operador'} (${r.status === 'concluido' ? 'concluído' : 'em andamento'} em ${fmtDH(r.atualizadoEm)})`));
  return `Este e-mail já foi aberto por: ${quem.join('; ')}.\n\nAbrir mesmo assim?`;
}
/* Webmail (extensão do Chrome): o botão flutuante "Abrir no conferidor" do webmail entrega o e-mail aqui */
const webmailParaEmail = m => emailDeWebmail({
  uid: m.uid, folder: m.folder, messageId: m.messageId, assunto: m.assunto, fromNome: m.de && m.de.nome, fromEmail: m.de && m.de.email,
  plain: m.plain, html: m.html, data: m.data, datas: m.datas, anexos: m.anexos
});
const nomesAtend = () => S ? unicos(S.guias.map(g => nomeCurto(g.pedido.beneficiario)).filter(Boolean)) : [];
async function abrirDoWebmail(m) {
  let email; try { email = webmailParaEmail(m); } catch (e) { console.error(e); toast('Não consegui ler o e-mail enviado pelo webmail. Abra o e-mail de novo no webmail e clique em "Abrir no conferidor".', 'bad'); return { ok: false, motivo: 'Não consegui ler este e-mail.' }; }
  if (!operador()) { toast('Escolha o operador no topo da página e clique de novo em "Abrir no conferidor".', 'bad'); return { ok: false, motivo: 'Escolha o operador no Conferidor.' }; }
  if (S && S.email && S.email.messageId === email.messageId) { toast('Esse e-mail já está aberto aqui.'); return { ok: true, nomes: nomesAtend() }; }
  if (S && !confirm('Há um atendimento aberto. Abrir o e-mail do webmail no lugar dele?\n(o atendimento atual continua salvo como em andamento)')) return { ok: false, motivo: 'O atendimento aberto foi mantido.' };
  aba = 'atend';
  try { await iniciar(email); } catch (e) { console.error(e); toast('Não consegui abrir esse e-mail: ' + e.message, 'bad'); return { ok: false, motivo: e.message }; }
  return { ok: !!S, nomes: nomesAtend() };
}
/* para o botão do webmail: este e-mail já está em atendimento ou já foi atendido? */
async function statusWebmail(m) {
  let id; try { id = webmailParaEmail(m).messageId; } catch (e) { return { info: null }; }
  if (S && S.email && S.email.messageId === id) return { info: { nivel: 'info', texto: 'Já está aberto no Conferidor.' } };
  try { await Reg.carregar(); } catch (e) { }
  const rs = Reg.cache.filter(r => r.messageId === id && !r.tipo).sort((a, b) => (carimboReg(a) < carimboReg(b) ? 1 : -1));
  const r = rs[0]; if (!r) return { info: null };
  if (r.status === 'concluido') return { info: { nivel: 'ok', texto: `Já atendido por ${r.operador || 'operador'} em ${fmtDH(r.concluidoEm || r.atualizadoEm)}${r.guia ? ' · guia ' + r.guia : ''}` } };
  if (r.status === 'em_andamento') return { info: { nivel: 'warn', texto: `Em atendimento ${r.operador === operador() ? 'por você' : 'agora por ' + (r.operador || 'outro operador')} desde ${fmtHora(r.abertoEm || r.atualizadoEm)}` } };
  return { info: { nivel: 'info', texto: `${STATUS[r.status] || r.status} por ${r.operador || 'operador'} em ${fmtDH(r.atualizadoEm)}` } };
}
window.addEventListener('message', ev => {
  const d = ev.data;
  if (ev.source !== window || ev.origin !== location.origin || !d) return;
  if (d.__conferidorExt === 'instalada') { render(); return; }
  const responder = r => { if (d.pid) window.postMessage({ __conferidorPagina: 'resposta', pid: d.pid, ...r }, location.origin); };
  if (d.__conferidorExt === 'webmail' && d.msg) { if (Abas.pausada) Abas.assumir(); abrirDoWebmail(d.msg).then(responder, () => responder({ ok: false })); }
  if (d.__conferidorExt === 'status' && d.msg) statusWebmail(d.msg).then(responder, () => responder({ info: null }));
  if (d.__conferidorExt === 'respostaEntregue') toast(d.ok ? 'Resposta enviada ao webmail: lá, clique em Responder, no corpo do texto e no botão "Colar resposta".' : 'Não consegui levar a resposta ao webmail: ' + (d.motivo || 'tente de novo.'), d.ok ? '' : 'bad');
});
async function iniciar(email) {
  await Reg.carregarTudo(); await Param.carregar();
  const aviso = avisoEmailJaAtendido(email);
  if (aviso && !confirm(aviso)) return;
  S = novoEstado(email);
  S.ativa = 0; S.vista = S.guias.length > 1 ? 1 : 2;
  for (const x of S.guias) await gravarGuia(x, 'em_andamento');
  persistir(); render(); window.scrollTo(0, 0);
}
function finalizarAtendimento(texto) {
  if (texto) { ultimoConcluido = { texto, em: agora() }; LS.set('ultimo', ultimoConcluido); }
  S = null; persistir(); render(); window.scrollTo(0, 0); toast('Registrado.');
}
function resumoUltimo(g) { const cl = clinicaDe(S); if (g.semGuia) return `Sem guia gerada (${nomeModelo(g.semGuia)}) · ${cl ? cl.nome : S.email.remetente.email}`; return `${g.numero || 'sem número'} — ${SIT_ROTULO[g.resultado.situacao] || STATUS[g.status]} · ${pl(g.pedido.itens.length, 'item', 'itens')}, ${cl ? cl.nome : S.email.remetente.email}`; }
async function depoisDeGuiaTratada(g, texto) {
  ultimoConcluido = { texto, em: agora() }; LS.set('ultimo', ultimoConcluido);
  if (S.guias.length === 1) { finalizarAtendimento(texto); return; }
  const prox = S.guias.findIndex(x => !guiaTerminal(x));
  if (prox >= 0) { S.ativa = prox; S.vista = Math.max(2, S.guias[prox].vista || 2); toast('Guia registrada. Seguindo para a próxima.'); }
  else { S.vista = 1; toast('Todas as guias deste e-mail foram processadas.'); }
  persistir(); render(); window.scrollTo(0, 0);
}
function mudarVista(v) {
  const g = guiaAtiva(); if (S.vista !== v) { S.vistaDesde = agora(); S.avisoParado = null; } S.vista = v;
  if (v >= 2) { g.vista = v; g.etapa = Math.max(g.etapa, v); if (g.status === 'em_andamento') gravarGuia(g, 'em_andamento'); }
  persistir(); render(); window.scrollTo(0, 0);
}
const alterarCampoGuia = (g, campo, v) => {
  const p = g.pedido; v = v.trim();
  if (v !== valorCopia(g, campo).trim()) marcarOrigem(g, { medico_nome: 'medico', medico_crm: 'medico', data: 'emissao', benef: 'beneficiario' }[campo] || campo, 'digitado');
  switch (campo) {
    case 'executante': g.executante = v; break;
    case 'medico_nome': p.medico = { ...p.medico, nome: v, bruto: [v, p.medico.crm ? `${p.medico.conselho || 'CRM'} ${p.medico.crm}` : ''].filter(Boolean).join(' ') }; break;
    case 'medico_crm': p.medico = { ...p.medico, crm: v.replace(/\D/g, ''), bruto: [p.medico.nome, v ? `${p.medico.conselho || 'CRM'} ${v}` : ''].filter(Boolean).join(' ') }; break;
    case 'local': p.local = v; break;
    case 'data': p.emissao = lerEmissao(v, S.email.data); break;
    case 'carteira': g.carteiraUsada = normCart(v); break;
    case 'benef': p.beneficiario = v; p.beneficiarios = v ? [v] : []; break;
    case 'cid': p.cid = v.toUpperCase(); break;
  }
};
/* Reavalia o botão Concluir enquanto se digita (sem redesenhar a tela e perder o foco) */
function atualizarConcluir(g) {
  const pend = pendenciasConclusao(g, situacaoGuia(g)), bt = $('[data-act=concluirGuia]'); if (bt) bt.disabled = pend.length > 0;
  const ul = $('#etapa ul.dica'); if (ul) { ul.innerHTML = pend.map(x => `<li>${esc(x)}</li>`).join(''); ul.classList.toggle('oculto', !pend.length); }
}
function estadoCopiaBtn(b, ok) { b.classList.toggle('copiado', ok); const r = b.dataset.rot; b.innerHTML = ok ? `${ic('check', 'sm')}${r ? 'Copiado' : ''}` : `${ic('copy', 'sm')}${r ? esc(r) : ''}`; }

/* ====================================================================
   Ações (data-act)
   ==================================================================== */
const acoes = {
  /* ---- gerais ---- */
  aba(b) {
    if (aba === 'config' && cfgDirty && b.dataset.aba !== 'config' && !confirm('Há alterações não salvas nas configurações. Sair e descartá-las?')) return;
    aba = b.dataset.aba; if (aba === 'atend' && !S) { /* nada */ } if (aba !== 'config') { cfgEdit = null; cfgDirty = false; cfgErros = []; } render();
  },
  async pasta() {
    if (!Pasta.suportado) { toast('Use o Google Chrome ou o Edge para acessar a pasta compartilhada.', 'bad'); return; }
    try {
      if (Pasta.handle && !Pasta.ok) await Pasta.reautorizar(); else await Pasta.conectar();
      await carregarConfig(); await Param.carregar(); await Reg.carregar(); await Apr.carregar(); await Notas.carregar(); cfgEdit = null; cfgDirty = false; render();
      Reg.conferirLocais().catch(() => { });
      toast(Pasta.ok ? 'Pasta conectada.' : 'Permissão não concedida.', Pasta.ok ? '' : 'bad');
    } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível usar a pasta: ' + e.message, 'bad'); }
  },
  baixarExtensao() {
    abrirModal({ titulo: 'Extensão do Chrome', sub: 'Abre o e-mail do webmail aqui com um clique', icone: 'download', tamanho: 'g',
      corpo: `<ol class="passos-ext" style="margin:0 0 0 18px;display:grid;gap:8px">
        <li>Baixe o arquivo abaixo e <b>descompacte</b> (clique direito > Extrair tudo).</li>
        <li>Abra <b>chrome://extensions</b> (no Edge: <b>edge://extensions</b>) e ative o <b>Modo do desenvolvedor</b>.</li>
        <li>Clique em <b>Carregar sem compactação</b> e escolha a pasta descompactada.</li>
        <li>Deixe esta página aberta numa aba e o webmail em outra (recarregue o webmail com F5).</li>
        <li>Ao abrir um e-mail no webmail aparece o botão flutuante <b>Abrir no conferidor</b>. O clique abre o pedido aqui, nesta aba.</li></ol>
        <p class="dica" style="margin-top:12px">A extensão só atua no webmail da Promédica e nesta página. Nada é enviado nem respondido automaticamente.</p>`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Fechar</button><a class="btn pri" href="extensao/conferidor-guias-extensao.zip" download>${ic('download')}Baixar extensão (.zip)</a>` });
  },
  usarMedicoAnterior() { const g = guiaAtiva(); g.pedido.medico = lerMedico(LS.get(chaveMedico(), '')); marcarOrigem(g, 'medico', 'anterior'); persistir(); render(); toast('Médico preenchido com o do último pedido deste remetente. Confira no anexo.'); },
  async colarPrint() {
    try {
      const itens = await navigator.clipboard.read(), fs = [];
      for (const it of itens) for (const t of it.types) if (/^image\//.test(t)) fs.push(new File([await it.getType(t)], 'print-colado.png', { type: t }));
      if (!fs.length) { toast('Não há imagem na área de transferência. Copie o print e clique em Colar (ou use Ctrl+V).', 'bad'); return; }
      processarPrints(fs);
    } catch (e) { toast('O navegador não liberou a área de transferência. Use Ctrl+V com a página selecionada.', 'bad'); }
  },
  limparPrints() { const g = guiaAtiva(); PRINTS_MEM.delete(g.id); g.prints = null; sincronizarObsPrints(g); if (g.cega.via === 'prints') { g.cega.ok = false; g.cega.via = null; } persistir(); render(); },
  obsAutoRestaurar() { if (!confirm('Restaurar os textos e as marcações padrão das observações automáticas?')) return; cfgEdit.obsAuto = obsAutoPadrao(); marcarSujo(); render(); },
  topoMini() { Vis.set(Vis.simples() ? 'completa' : 'simples'); render(); },
  async visualizacao(b) {
    const v = b.dataset.v;
    if (v === 'flutuante') { Vis.set('flutuante'); await Mini.abrir(); if (!Mini.aberto()) Vis.set('completa'); render(); return; }
    Vis.set(v); if (Mini.aberto()) { try { Mini.win.close(); } catch (er) { } Mini.win = null; }
    render(); window.scrollTo(0, 0);
  },
  densidade(b) { LS.set(Vis.chave('densidade'), b.dataset.v); render(); },
  alternarTema() { Tema.alternar(); render(); },
  setTema(b) { Tema.definir(b.dataset.v); render(); },
  fecharModal() { fecharModal(); },
  modalContinuar() { const b = $('.modal-desc'); if (b) b.remove(); const c = $('#modalFundo textarea, #modalFundo input[type=text]'); if (c) c.focus(); },
  modalDescartar() { if (modalAtual) modalAtual.descartar = true; fecharModal(); },
  escolherEml() { $('#arquivoEml').click(); },
  async usarColado() {
    const t = $('#coladoTxt').value; if (!t.trim()) { toast('Cole o texto do e-mail.', 'bad'); return; }
    if (!operador()) { toast('Escolha o operador no topo da página.', 'bad'); return; }
    await iniciar(emailDeTexto(t, $('#coladoDe').value));
  },

  /* ---- navegação do atendimento ---- */
  selGuia(b) {
    S.ativa = +b.dataset.i; const g = guiaAtiva(); const st = situacaoGuia(g);
    let v = g.status === 'concluido' ? 4 : (g.vista || 2);
    if (v >= 3 && !st.pode) v = 2; if (v === 4 && g.status !== 'concluido' && !podeFinal(g, st)) v = 3;
    mudarVista(v);
  },
  irVista(b) {
    const v = +b.dataset.v, g = guiaAtiva(), st = situacaoGuia(g);
    if (g.semGuia && g.status !== 'concluido' && v >= 2 && v !== 4) { acoes.desfazerSemGuia(); return; }
    if (v === 3 && !st.pode) { toast('Há bloqueios na etapa 2: corrija os dados apontados nos alertas ou responda à clínica sem gerar a guia.', 'bad'); return; }
    if (v === 4 && g.status !== 'concluido' && !podeFinal(g, st)) { toast('Falta conferir a grade: cole os prints do sistema (ou faça a conferência sem prints) na etapa 3.', 'bad'); return; }
    if (v >= 3 && g.status !== 'concluido') gravarGuia(g, g.status);
    mudarVista(v);
  },
  async descartar() {
    const de = clinicaDe(S) ? clinicaDe(S).nome : (S.email.remetente.email || 'remetente');
    if (!(await confirmar({ titulo: 'Descartar e-mail', texto: `Descartar o e-mail de <b>${esc(de)}</b> (“${esc(curtoTxt(S.email.assunto || 'sem assunto', 70))}”)? Use para mensagens que não são pedidos (evoluções, avisos, arquivo errado). As guias já concluídas são mantidas.`, ok: 'Descartar e-mail', icone: 'trash' }))) return;
    for (const g of S.guias) if (g.status !== 'concluido') await gravarGuia(g, 'descartado');
    finalizarAtendimento('Descartado — ' + S.email.assunto);
  },
  async ignorarGuia() {
    const g = guiaAtiva();
    if (!confirm(`Ignorar a solicitação de ${nomeGuia(g)}? Use quando a leitura separou o pedido por engano. As demais guias continuam.`)) return;
    await gravarGuia(g, 'descartado');
    const prox = S.guias.findIndex(x => !guiaTerminal(x));
    if (prox >= 0) { S.ativa = prox; mudarVista(Math.max(2, S.guias[prox].vista || 2)); } else mudarVista(1);
  },
  encerrar() { finalizarAtendimento(S.guias.length > 1 ? `${pl(S.guias.filter(g => g.status === 'concluido').length, 'guia concluída', 'guias concluídas')} — ${clinicaDe(S) ? clinicaDe(S).nome : S.email.remetente.email}` : resumoUltimo(S.guias[0])); },

  /* ---- clínica do remetente ---- */
  async vincularClinica() {
    const id = $('#selClinica').value; if (!id) { toast('Escolha a clínica.', 'bad'); return; }
    const email = S.email.remetente.email;
    await alterarConfig(c => { const cl = c.clinicas.find(x => x.id === id); if (cl && email && !cl.emails.includes(email)) cl.emails.push(email); });
    S.clinicaId = id; S.clinicaComo = 'email'; persistir(); render(); toast('E-mail vinculado à clínica.');
  },
  clinicaSoAgora() { const id = $('#selClinica').value; if (!id) { toast('Escolha a clínica.', 'bad'); return; } S.clinicaId = id; S.clinicaComo = 'manual'; persistir(); render(); },

  /* ---- itens: corrigir leitura (só este e-mail) ---- */
  editarItens() { const g = guiaAtiva(); g.editandoItens = !g.editandoItens; g._edit = null; persistir(); render(); },
  editarItens3() { acoes.editarItens(); },
  addItem() { const g = guiaAtiva(); g._edit = lerTabelaEdicao(); g._edit.push({ codigo: '', desc: '', qtd: '' }); render(); },
  remItem(b) { const g = guiaAtiva(); g._edit = lerTabelaEdicao(); g._edit.splice(+b.dataset.i, 1); render(); },
  cancelarItens() { const g = guiaAtiva(); g.editandoItens = false; g._edit = null; render(); },
  salvarItens() {
    const g = guiaAtiva(), p = g.pedido, it = lerTabelaEdicao().filter(x => x.codigo);
    { // o que mudou na leitura: vai para a linha do tempo e para o aprendizado da clínica
      const antes = p.itens.map(i => `${i.codigo} × ${i.qtd ?? '?'}`), depois = it.map(x => `${x.codigo} × ${x.qtd || '?'}`);
      if (antes.join('|') !== depois.join('|')) evento(g, 'edicao-email', `Serviços: ${antes.join(', ') || '—'} → ${depois.join(', ') || '—'}`);
      const cl = clinicaDe(S);
      if (cl) {
        const velhos = [...p.itens.map(i => i.codigo), ...p.invalidos], novos = it.map(x => x.codigo);
        const sairam = velhos.filter(c => !novos.includes(c)), entraram = novos.filter(c => !velhos.includes(c));
        if (sairam.length === 1 && entraram.length === 1) Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo: 'codigo', lido: sairam[0], correto: entraram[0] });
        it.forEach(x => { const o = p.itens.find(i => i.codigo === x.codigo); if (o && String(o.qtd ?? '?') !== String(x.qtd || '?') && /^\d+$/.test(x.qtd)) Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo: 'quantidade', lido: o.qtd ?? '?', correto: x.qtd, ref: x.codigo }); });
      }
    }
    p.invalidos = it.filter(x => x.codigo.length !== 8).map(x => x.codigo);
    p.itens = it.filter(x => x.codigo.length === 8).map(x => { const o = p.itens.find(i => i.codigo === x.codigo), q = /^\d+$/.test(x.qtd) ? Number(x.qtd) : null;
      return { codigo: x.codigo, desc: x.desc, qtd: q, origemQtd: o && o.qtd === q ? o.origemQtd : 'manual', origemCod: o ? o.origemCod : 'digitado' }; });
    const usados = new Set(p.itens.map(i => i.codigo)); p.soltos = p.soltos.filter(c => !usados.has(c));
    p.semRotulo = false; p.qtdUnicaAplicada = false;
    g.itensEditados = true; g.editandoItens = false; g._edit = null;
    g.cega = { iniciada: false, tentativas: 0, linhas: '', entradas: [], resultado: null, ok: false, historico: [] };
    persistir(); render(); toast('Leitura corrigida neste e-mail. Cadastros e parametrizações não foram alterados.');
  },

  /* ---- parametrização ---- */
  parametrizar() {
    const g = guiaAtiva();
    if (!clinicaDe(S)) { toast('Identifique a clínica (vincule o remetente) antes de parametrizar.', 'bad'); return; }
    if (!cartValida(g.carteiraUsada)) { toast('Informe a carteira usada (17 caracteres) antes de parametrizar.', 'bad'); return; }
    abrirModalParam(g, paramDaGuia(g), false);
  },
  aplicarParam() { const g = guiaAtiva(); if (aplicarParametrizacao(g)) { gravarGuia(g, g.status); persistir(); render(); toast('Parametrização aplicada. Só foram preenchidos dados que faltavam.'); } },
  pmAdd() { M.terapias.push({ id: uid(), codigo: '', descricao: '', qtd: '' }); $('#modalCorpo').innerHTML = htmlModalParam(); },
  pmRem(b) { M.terapias.splice(+b.dataset.i, 1); if (!M.textoEditado) M.texto = textoParametrizacao(M); $('#modalCorpo').innerHTML = htmlModalParam(); },
  pmGerar() { M.texto = textoParametrizacao(M); M.textoEditado = false; $('#modalCorpo').innerHTML = htmlModalParam(); },
  async pmSalvar() {
    const m = M, E = [];
    if (!m.clinicaId) E.push('Escolha a clínica.');
    const cart = normCart(m.carteira); if (!cartValida(cart)) E.push('Informe a carteira com 17 caracteres.');
    if (!m.medico.trim()) E.push('Informe o nome do médico.');
    let emissao = '';
    if (m.data.trim()) { const em = lerEmissao(m.data.trim(), null); if (em.estado === 'valida') emissao = isoDia(new Date(em.data)); else E.push('A data do pedido deve estar no formato dd/mm/aaaa.'); }
    const terap = m.terapias.filter(t => t.descricao.trim() || String(t.qtd).trim() || String(t.codigo || '').trim());
    if (!terap.length) E.push('Inclua ao menos uma terapia.');
    terap.forEach((t, i) => { if (!t.descricao.trim()) E.push(`Terapia ${i + 1}: informe a descrição.`); if (!/^\d{1,3}$/.test(String(t.qtd).trim()) || Number(t.qtd) < 1) E.push(`Terapia ${i + 1}: informe a quantidade (número de 1 a 999).`); if (t.codigo && !/^\d{8}$/.test(String(t.codigo).trim())) E.push(`Terapia ${i + 1}: o código deve ter 8 dígitos ou ficar vazio.`); });
    if (E.length) { toast(E[0], 'bad'); return; }
    const existente = m.id ? Param.porId(m.id) : Param.lista.find(x => x.clinicaId === m.clinicaId && x.carteira === cart);
    const obj = {
      id: existente ? existente.id : uid(), clinicaId: m.clinicaId, carteira: cart, medico: m.medico.trim(), emissao,
      terapias: terap.map(t => ({ id: t.id || uid(), codigo: String(t.codigo || '').trim(), descricao: t.descricao.trim(), qtd: Number(t.qtd) })),
      texto: m.texto.trim(), criadoEm: existente ? existente.criadoEm : agora(), criadoPor: existente ? existente.criadoPor : operador(), atualizadoEm: agora(), atualizadoPor: operador()
    };
    try { await Param.salvar(obj); } catch (e) { toast('Não foi possível salvar a parametrização: ' + e.message, 'bad'); return; }
    const gid = m.guiaId; fecharModal(true);
    if (gid && S) { const g = S.guias.find(x => x.id === gid); if (g) { g.param = { id: obj.id, origem: g.param && g.param.origem === 'aplicada' ? 'aplicada' : 'criada', preenchido: (g.param && g.param.preenchido) || [], em: agora() }; await gravarGuia(g, g.status); persistir(); } }
    render(); toast('Parametrização salva' + (Pasta.ok ? ' na pasta compartilhada.' : ' neste computador.'));
  },
  async pmExcluir() {
    const id = M.id, cl = cfg.clinicas.find(c => c.id === M.clinicaId); if (!confirm(`Excluir a parametrização de ${cl ? cl.nome : 'esta clínica'}, carteira ${M.carteira || '—'}? Os próximos atendimentos deixam de usá-la.`)) return;
    await Param.remover(id); if (S) S.guias.forEach(g => { if (g.param && g.param.id === id) g.param = null; });
    fecharModal(true); persistir(); render(); toast('Parametrização excluída.');
  },

  /* ---- etapa 3: cópia de campos e itens ---- */
  async copiarCampo(b) {
    const g = guiaAtiva(), campo = b.dataset.campo, el = $('#' + b.dataset.ref), v = (el ? el.value : '').trim();
    if (!v) { toast('O campo está vazio: preencha-o antes de copiar.', 'bad'); return; }
    if (!(await copiar(v))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados[campo] = v; persistir(); estadoCopiaBtn(b, true); toast('Copiado: ' + v);
  },
  async copiarItem(b) {
    const g = guiaAtiva(), it = g.pedido.itens.find(x => x.codigo === b.dataset.codigo); if (!it) return;
    const v = b.dataset.tipo === 'c' ? it.codigo : String(it.qtd);
    if (!(await copiar(v))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados[b.dataset.tipo + ':' + it.codigo] = v; persistir(); estadoCopiaBtn(b, true); toast('Copiado: ' + v);
  },
  iniciarCega() { const g = guiaAtiva(); g.cega.iniciada = true; g.cega.tentativas = Math.max(1, g.cega.tentativas); persistir(); render(); $('#cegaN')?.focus(); },
  verItens() { const g = guiaAtiva(); g.cega = { ...g.cega, iniciada: false, linhas: '', entradas: [], resultado: null, ok: false }; persistir(); render(); },
  conferir() {
    const g = guiaAtiva(), n = parseInt(g.cega.linhas, 10);
    if (!(n >= 0)) { toast('Informe quantas linhas a grade tem.', 'bad'); return; }
    const r = compararCega(g.pedido.itens, n, g.cega.entradas);
    g.cega.resultado = r; g.cega.ok = r.ok;
    if (!r.ok && !r.incompleto) g.cega.historico.push([...r.erros, ...r.porItem.filter(x => x.st !== 'ok').map(x => `${x.st}:${x.it.codigo}${x.informado ? '=' + x.informado : ''}`), ...r.extras.map(x => 'indevida:' + x.fim)]);
    persistir(); render();
  },
  refazerCega() { const g = guiaAtiva(); g.cega.tentativas++; g.cega.resultado = null; g.cega.entradas = []; g.cega.linhas = ''; persistir(); render(); $('#cegaN')?.focus(); },

  /* ---- etapa 4: resultado, observação e resposta ---- */
  setGlosa(b) { const g = guiaAtiva(), gl = glosaDe(g); gl.resp = b.dataset.v; if (gl.resp === 'nao') gl.itens = {}; persistir(); render(); },
  setSit(b) { const g = guiaAtiva(), r = g.resultado; if (g.sitSug && g.sitSug.v !== b.dataset.v) evento(g, 'edicao-campo', `Situação trocada: sugerida ${g.sitSug.v}, escolhida ${b.dataset.v}`); r.situacao = b.dataset.v; if (r.situacao !== 'parcial') r.naoAut = {}; if (r.situacao === 'nao') glosaDe(g).itens = {}; g.respEdit = null; persistir(); render(); },
  async copiarEmail(b) {
    const g = guiaAtiva(), v = $('#emailPrest').value.trim();
    if (!emailValido(v)) { toast('Informe um e-mail da clínica válido para copiar.', 'bad'); return; }
    if (!(await copiar(v))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados.email = v; persistir(); estadoCopiaBtn(b, true); toast('E-mail copiado: ' + v);
  },
  async copiarObs(b) {
    const g = guiaAtiva(), v = $('#txtObs').value;
    if (!(await copiar(v))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados.obs = v; persistir(); $$('[data-act=copiarObs]').forEach(x => estadoCopiaBtn(x, true)); toast('Observação copiada (texto simples).');
  },
  resetObs() { const g = guiaAtiva(); g.obsEdit = null; g.obsExtras = []; g.obsInc = []; persistir(); render(); },
  incluirObs() { abrirModalObs(); },
  inserirObs() {
    const g = M.g, t = (M.txt || '').trim();
    if (!t) { toast('Nada para inserir.', 'bad'); return; }
    const atual = g.resultado.obsAdicionais || '';
    if (atual.includes(t)) { toast('Esse texto já está nas observações adicionais.', 'bad'); return; }
    g.resultado.obsAdicionais = atual.trim() ? atual.replace(/\s+$/, '') + '\n' + t : t;
    g.obsInc.push(...M.sel); g.respEdit = null;
    fecharModal(true); persistir(); render(); toast('Incluído nas observações adicionais.');
  },
  async copiarResp() {
    const g = guiaAtiva(), html = serializarEditor($('#edResp')), texto = htmlPlano(html);
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    const r = await copiarRico(htmlParaEmail(html), texto);
    if (!r) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados.resp = true; persistir(); render(); toast(r === 'rico' ? 'Resposta copiada com formatação.' : 'O navegador só permitiu copiar texto simples (sem formatação).', r === 'rico' ? '' : 'bad');
  },
  responderWebmail(b) {
    if (!extInstalada()) { toast('Para levar a resposta direto ao webmail, instale a extensão do Chrome (passo a passo abaixo).'); acoes.baixarExtensao(); return; }
    const fonte = (b && b.dataset.fonte) || 'editor';
    if (fonte === 'lista') { Lista.responderWebmail(b.dataset.lista); return; }
    const g = guiaAtiva(); if (!g) return;
    let html;
    if (fonte === 'concluida') html = htmlParaEmail(respostaDaGuia(g, false).html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1'));
    else { const ed = $('#edResp'); if (!ed) { toast('Abra a resposta na etapa 4 para levá-la ao webmail.', 'bad'); return; } html = htmlParaEmail(serializarEditor(ed)); }
    const texto = htmlPlano(html);
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Levar mesmo assim?')) return;
    const quem = nomesAtend();
    enviarAoWebmail({ html, texto, quem: quem[0] ? quem[0] + (quem.length > 1 ? ` e mais ${quem.length - 1}` : '') : '', assunto: S.email.assunto || '' });
    g.copiados.resp = true; evento(g, 'regra', 'Resposta levada ao webmail pela extensão'); persistir(); render();
  },
  async copiarRespSimples() {
    const g = guiaAtiva(), texto = htmlPlano(serializarEditor($('#edResp')));
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    if (!(await copiar(texto))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    g.copiados.resp = true; persistir(); render(); toast('Resposta copiada como texto simples.');
  },
  resetResp() { const g = guiaAtiva(); g.respEdit = null; g.respExtras = []; g.respInc = []; persistir(); render(); },
  async copiarRespConcluida() { const r = respostaDaGuia(guiaAtiva(), false); const ok = await copiarRico(htmlParaEmail(r.html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')), r.texto); toast(ok ? 'Resposta copiada.' : 'Não foi possível copiar.', ok ? '' : 'bad'); },
  async concluirGuia() {
    const g = guiaAtiva(), st = situacaoGuia(g), pend = pendenciasConclusao(g, st);
    if (pend.length) { toast(pend[0], 'bad'); return; }
    if (g.semGuia) { g.resultado.situacao = 'sem_guia'; g.numero = ''; }
    await gravarGuia(g, 'concluido'); g.vista = 4; g.etapa = 4;
    await depoisDeGuiaTratada(g, resumoUltimo(g));
  },
  async reabrirGuia() { const g = guiaAtiva(); g.status = 'em_andamento'; g.vista = 4; await gravarGuia(g, 'em_andamento'); mudarVista(4); toast('Guia reaberta para correção.'); },

  /* ---- respostas rápidas ---- */
  respSemGuia(b) {
    const g = guiaAtiva(); g.semGuia = b.dataset.modelo; g.respEdit = null; g.respExtras = []; g.respInc = []; g.resultado.situacao = null;
    g.vista = 4; g.etapa = 4; gravarGuia(g, 'em_andamento'); mudarVista(4);
  },
  desfazerSemGuia() { const g = guiaAtiva(); g.semGuia = null; g.respEdit = null; g.respExtras = []; mudarVista(2); },
  respostaEmail() { abrirRespostaEmail(); },
  async copiarModalRico() {
    const html = serializarEditor($('#edModal')), texto = htmlPlano(html);
    if (!texto) { toast('O texto está vazio.', 'bad'); return; }
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    const r = await copiarRico(htmlParaEmail(html), texto); if (!r) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    M.copiou = true;
    $('#modalEstado').innerHTML = `${ic('check', 'sm')} ${r === 'rico' ? 'Copiado com formatação.' : 'Copiado como texto simples (o navegador não permitiu formatação).'}`; toast(r === 'rico' ? 'Copiado com formatação.' : 'Copiado como texto simples.');
  },
  async copiarModalSimples() {
    const texto = htmlPlano(serializarEditor($('#edModal')));
    if (!texto) { toast('O texto está vazio.', 'bad'); return; }
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    if (!(await copiar(texto))) { toast('Não foi possível copiar: clique em qualquer lugar da página e tente de novo.', 'bad'); return; }
    M.copiou = true;
    $('#modalEstado').innerHTML = `${ic('check', 'sm')} Copiado como texto simples.`; toast('Copiado como texto simples.');
  },
  /* ---- painel do dia ---- */
  atualizarQuadro() { render(); },
  atualizarPainel() { if ($('#painelSemana')) painelSemana = $('#painelSemana').value || painelSemana; if ($('#painelMes')) painelMes = $('#painelMes').value || painelMes; if ($('#painelDia')) painelDia = $('#painelDia').value || isoDia(new Date()); conc = null; amostra = null; render(); },
  painelModo(b) { painelModo = b.dataset.v; render(); },
  limparFiltros() { painelFiltro = { q: '', status: '', res: '', clinica: '', param: '' }; render(); },
  exportarCsv() {
    const base = regsDoPeriodo();
    const regs = filtrarRegs(base.filter(r => !r.tipo && r.status !== 'descartado' && r.status !== 'devolvido'));
    if (!regs.length) { toast('Não há linhas para exportar com os filtros atuais.', 'bad'); return; }
    baixar(painelModo === 'semana' ? `Conferidor_Guias_Registros_Semana_${painelSemana}.csv` : painelModo === 'mes' ? `Conferidor_Guias_Registros_Mes_${painelMes.split('-').reverse().join('-')}.csv` : nomeArquivo('Registros', painelDia, 'csv'), csvRegistros(regs), 'text/csv;charset=utf-8');
  },
  /* ---- corrigir / cancelar / excluir guia (Painel) ---- */
  corrigirGuia(b) {
    const r = regPorId(b.dataset.id); if (!r) return;
    M = { tipo: 'corrigir', id: r.id, carteira: r.carteira || '', itens: (r.itens || []).map(i => ({ c: i.c, d: i.d || '', q: i.q ?? '' })) };
    abrirModal({ titulo: 'Corrigir guia', sub: r.guia || '', icone: 'edit', tamanho: 'g', corpo: htmlModalCorrigir(),
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="cgSalvar">${ic('save')}Salvar correção</button>` });
  },
  cgAdd() { M.itens.push({ c: '', d: '', q: '' }); $('#modalCorpo').innerHTML = htmlModalCorrigir(); },
  cgRem(b) { M.itens.splice(+b.dataset.i, 1); $('#modalCorpo').innerHTML = htmlModalCorrigir(); },
  async cgSalvar() {
    const r = regPorId(M.id), cart = normCart(M.carteira), E = [];
    if (!cartValida(cart)) E.push('A carteira deve ter 17 caracteres (15 dígitos + 2).');
    const its = M.itens.filter(i => i.c || i.q !== '' || i.d);
    if (!its.length) E.push('Inclua ao menos um serviço.');
    const vistos = new Set();
    its.forEach((i, k) => { if (!/^\d{8}$/.test(i.c)) E.push(`Serviço ${k + 1}: o código deve ter 8 dígitos.`); else if (vistos.has(i.c)) E.push(`Código ${i.c} repetido.`); vistos.add(i.c); if (!/^\d{1,2}$/.test(String(i.q)) || Number(i.q) < 1) E.push(`Serviço ${k + 1}: quantidade inválida.`); });
    if (E.length) { toast(E[0], 'bad'); return; }
    const novo = clonar(r), cl = cfg.clinicas.find(c => c.id === r.clinicaId);
    novo.corrigida = { em: agora(), por: operador(), antes: { carteira: r.carteira, itens: (r.itens || []).map(i => `${i.c}×${i.q ?? '?'}`) } };
    novo.carteira = cart;
    novo.itens = its.map(i => { const antes = (r.itens || []).find(x => x.c === i.c); return { c: i.c, q: Number(i.q), d: i.d || (antes && antes.d) || '', dc: descCadastro(cl, i.c) ?? null, aut: antes ? antes.aut : true }; });
    novo.atualizadoEm = agora();
    fecharModal(true); await Reg.salvar(novo); Reg.mesclarHist([novo]); render(); toast('Guia corrigida.');
  },
  async cancelarGuia(b) {
    const r = regPorId(b.dataset.id); if (!r) return;
    const quem = nomeCurto(r.paciente) || r.pacienteIni || '';
    const motivo = await confirmar({ titulo: 'Cancelar guia', texto: `Cancelar a guia <b>${esc(r.guia || 'sem número')}</b>${quem ? ` de <b>${esc(quem)}</b>` : ''}? O registro fica marcado como cancelado.`, ok: 'Cancelar guia', campo: { rot: 'Motivo (opcional)', ph: 'Ex.: guia gerada em duplicidade' } });
    if (motivo === null) return;
    const novo = clonar(r); novo.status = 'cancelado'; novo.canceladoEm = agora(); novo.canceladoPor = operador(); novo.canceladoMotivo = motivo.trim(); novo.atualizadoEm = agora();
    await Reg.salvar(novo); Reg.mesclarHist([novo]); render(); toast('Guia cancelada.');
  },
  async excluirGuia(b) {
    const r = regPorId(b.dataset.id); if (!r) return;
    const quem = nomeCurto(r.paciente) || r.pacienteIni || '';
    if (!(await confirmar({ titulo: 'Excluir guia', texto: `Excluir a guia <b>${esc(r.guia || 'sem número')}</b>${quem ? ` de <b>${esc(quem)}</b>` : ''}? O registro some do Painel e do Auditar. Esta ação não pode ser desfeita.`, ok: 'Excluir guia', icone: 'trash' }))) return;
    await Reg.excluir(r.id); render(); toast('Registro excluído.');
  },
  async regSync() { const n = await Reg.sincronizar(); await Reg.carregar(); render(); toast(Reg.nPendentes() ? 'Ainda não consegui gravar na pasta. Confira a conexão e tente de novo.' : n ? `${n} ${n === 1 ? 'atendimento enviado' : 'atendimentos enviados'} para a pasta.` : 'Nada pendente.', Reg.nPendentes() ? 'bad' : ''); },
  conferiAlerta(b) {
    const g = guiaAtiva(); if (!g) return; const k = b.dataset.conf, on = !(g.conf && g.conf[k]);
    g.conf = g.conf || {}; g.conf[k] = on; const al = situacaoGuia(g).A.find(a => a.key === k);
    evento(g, 'conferido', `${on ? 'Conferido' : 'Desmarcado'}: ${al ? al.texto : k}`); persistir(); render();
  },
  async pinLiberar() { const v = ($('#pinIn') || {}).value || ''; if (await Pin.confere(v)) { Pin.liberar(); render(); toast('Liberado por 15 minutos.'); } else { toast('PIN incorreto.', 'bad'); const i = $('#pinIn'); if (i) i.select(); } },
  async pinModalOk() { const v = ($('#pinModal') || {}).value || ''; if (await Pin.confere(v)) { Pin.liberar(); fecharModal(true); const d = Pin.depois; Pin.depois = null; render(); toast('Liberado por 15 minutos.'); if (d) d(); } else { toast('PIN incorreto.', 'bad'); $('#pinModal').select(); } },
  pinPedir() { pedirPin(null); },
  pinTrancar() { Pin.ate = 0; render(); },
  async pinDefinir() {
    const a = ($('#pinNovo') || {}).value || '', b = ($('#pinConf') || {}).value || '';
    if (!/^\d{4,12}$/.test(a)) { toast('O PIN deve ter de 4 a 12 dígitos.', 'bad'); return; }
    if (a !== b) { toast('A confirmação não confere com o PIN.', 'bad'); return; }
    const sal = Senha.novoSal(); cfgEdit.supervisor = { pinHash: await Senha.hash(a, sal), pinSalt: sal }; Pin.liberar(); marcarSujo(); render();
    toast('PIN pronto. Clique em Salvar configurações para gravar.');
  },
  pinRemover() { if (!Pin.liberado()) return; cfgEdit.supervisor = null; marcarSujo(); render(); toast('PIN removido. Clique em Salvar configurações para gravar.'); },
  async audMedir(b) { if (b) b.classList.add('carregando'); AUD_TAM = await medirAuditoria(); render(); },
  async audLimpar() {
    if (!Pin.liberado()) { pedirPin(() => acoes.audLimpar()); return; }
    const meses = Number(($('#audPrazo') || {}).value || 6); LS.set('audPrazo', meses);
    const lim = new Date(); lim.setMonth(lim.getMonth() - meses); const limM = isoDia(lim).slice(0, 7);
    if (!(await confirmar({ titulo: 'Apagar prints antigos', texto: `Apagar as imagens dos prints das guias anteriores a <b>${limM.slice(5)}/${limM.slice(0, 4)}</b>? O texto do histórico (lido, ignorado, linha do tempo) continua. As imagens não podem ser recuperadas.`, ok: 'Apagar imagens', icone: 'trash' }))) return;
    let n = 0, livres = 0;
    for (const [m, hm] of await Pasta.listar(['auditoria'])) {
      if (hm.kind !== 'directory' || m >= limM) continue;
      for (const [nome, h] of await Pasta.listar(['auditoria', m])) {
        if (!nome.endsWith('.json')) continue;
        try { const f = await h.getFile(), a = JSON.parse(await f.text()); if (semImagens(a)) { await Pasta.gravar(['auditoria', m], nome, a); n++; livres += f.size - JSON.stringify(a, null, 1).length; } } catch (er) { }
      }
    }
    AUD_TAM = null; render(); toast(n ? `Imagens apagadas de ${pl(n, 'guia', 'guias')} (cerca de ${fmtBytes(Math.max(0, livres))} liberados).` : 'Nenhuma imagem antiga para apagar.');
  },
  relatarGuia() { const g = guiaAtiva(); if (g) abrirRelato({ g }); },
  async relatarHist(b) { const r = Reg.todos[b.dataset.id] || Reg.cache.find(x => x.id === b.dataset.id); if (!r) return; const a = await Aud.ler(r); const g = S && S.guias.find(x => x.id === r.id); abrirRelato({ r, a, g }); },
  async relatoOk() {
    const al = M && M.alvo; if (!al) return;
    const nota = ($('#relNota') || {}).value || '', imagens = !!($('#relImg') || {}).checked;
    const rel = montarRelato({ ...al, nota: nota.trim(), imagens });
    const nome = `relato-${(al.r && al.r.guia) || (al.g && al.g.numero) || 'guia'}-${isoDia(new Date())}-${Date.now().toString(36).slice(-4)}.json`;
    baixar(nome, JSON.stringify(rel, null, 1), 'application/json');
    if (Pasta.ok) { try { await Pasta.gravar(['relatos', isoDia(new Date()).slice(0, 7)], nome, rel); } catch (er) { } }
    fecharModal(true); toast('Arquivo baixado' + (Pasta.ok ? ' (cópia na pasta “relatos”).' : '.') + ' Envie para o suporte do Conferidor.');
  },
  notaBenef() {
    const g = guiaAtiva(); if (!g) return; const cart = g.carteiraUsada || g.pedido.carteira;
    if (!normCart(cart || '')) { toast('Informe a carteira usada antes de criar a nota.', 'bad'); return; }
    const n = Notas.de(cart);
    abrirModal({ titulo: 'Nota fixa do beneficiário', sub: `Carteira ${normCart(cart)}`, icone: 'message', tamanho: 'p',
      corpo: `<label class="lbl" for="notaTxt">Aparece sempre que esta carteira for atendida, para todos os operadores. Deixe vazio para remover.</label><textarea id="notaTxt" rows="3" autofocus placeholder="Ex.: dependente do titular 413100003537300EQ; clínica costuma mandar o nome abreviado">${esc(n ? n.texto : '')}</textarea>`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="notaBenefOk">${ic('check', 'sm')}Salvar nota</button>` });
  },
  async notaBenefOk() {
    const g = guiaAtiva(), cart = g.carteiraUsada || g.pedido.carteira, t = ($('#notaTxt') || {}).value || '';
    if (await Notas.salvar(cart, t)) { evento(g, 'regra', t.trim() ? 'Nota fixa do beneficiário: ' + t.trim() : 'Nota fixa do beneficiário removida'); fecharModal(true); persistir(); render(); toast(t.trim() ? 'Nota salva.' : 'Nota removida.'); }
  },
  okParado() { if (S) { S.vistaDesde = agora(); S.avisoParado = null; persistir(); render(); } },
  erroInicio() { aba = 'atend'; if (S) { S.vista = 1; } render(); },
  async erroCopiar() { if (await copiar(window.__ultimoErro || '')) toast('Detalhes copiados.'); },
  erroSemAtend() { try { LS.set('atual.copia', S); } catch (e) { } S = null; persistir(); aba = 'atend'; render(); toast('Atendimento fechado. Uma cópia ficou guardada neste computador.'); },
  verAlertas() { const el = $('.painel-al'); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('piscar'); void el.offsetWidth; el.classList.add('piscar'); },
  sortear() {
    const c = Reg.doDia(painelDia).filter(r => !r.tipo && r.status === 'concluido');
    const emb = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    amostra = [...emb(c.filter(r => r.itens.length >= 4)), ...emb(c.filter(r => r.itens.length < 4))].slice(0, 10); render();
  },
  conciliarGuias() { conciliarGuias(); },
  /* ---- configurações: navegação e salvamento ---- */
  cfgSecao(b) { cfgSecao = b.dataset.s; render(); },
  async salvarCfg() {
    prepararSalvar(cfgEdit); cfgErros = validarCfg(cfgEdit);
    if (cfgErros.length) { await render(); window.scrollTo(0, 0); toast(`${pl(cfgErros.length, 'problema encontrado', 'problemas encontrados')}. Nada foi salvo.`, 'bad'); return; }
    try {
      await mesclarOperadoresDaPasta(cfgEdit);
      if (!Pin.liberado() || (Pin.definido() && JSON.stringify(cfgEdit.supervisor || null) !== JSON.stringify(cfg.supervisor || null) && !Pin.liberado())) cfgEdit.supervisor = cfg.supervisor || null;   // sem PIN, o PIN salvo não muda
      if (Pasta.ok && !Pin.liberado()) { const p = await Pasta.ler([], 'config.json'); if (p && p.supervisor && p.supervisor.pinHash) cfgEdit.supervisor = p.supervisor; }
      await salvarConfig(cfgEdit); iniciarCfgEdit(); await render();
      toast('Configurações salvas' + (Pasta.ok ? ' na pasta compartilhada.' : ' neste computador.'));
    } catch (e) { toast('Erro ao salvar: ' + e.message, 'bad'); }
  },
  descartarCfg() { if (cfgDirty && !confirm('Descartar todas as alterações não salvas?')) return; iniciarCfgEdit(); render(); },
  exportarCfg() { const c = clonar(cfgEdit); prepararSalvar(c); baixar('config.json', JSON.stringify(configParaSalvar(c), null, 2), 'application/json'); },
  async exportarParam() { await Param.carregar(); baixar('parametrizacoes.json', JSON.stringify({ versao: 2, itens: Param.lista }, null, 2), 'application/json'); },
  async exportarPeriodo() {
    const ini = $('#expIni').value, fim = $('#expFim').value;
    if (!ini || !fim || ini > fim) { toast('Informe um período válido (a data inicial não pode ser maior que a final).', 'bad'); return; }
    const dias = Math.round((new Date() - new Date(ini + 'T12:00')) / 864e5);
    await Reg.carregar(Math.max(0, dias - HIST_DIAS) + 1);
    const regs = Reg.cache.filter(r => !r.tipo && r.dia >= ini && r.dia <= fim && r.status !== 'descartado' && r.status !== 'devolvido').sort((a, b) => (a.abertoEm < b.abertoEm ? -1 : 1));
    if (!regs.length) { toast('Nenhum registro no período informado.', 'bad'); return; }
    baixar(nomeArquivo('Registros_' + diaBR(ini).replace(/\//g, '-') + '_a', fim, 'csv'), csvRegistros(regs), 'text/csv;charset=utf-8'); toast(`${pl(regs.length, 'linha exportada', 'linhas exportadas')}.`);
  },
  async limparAntigos() {
    if (!confirm('Apagar registros com mais de 180 dias (pasta compartilhada e este computador)?')) return;
    const lim = isoDia(addDias(new Date(), -180)); let n = 0;
    for (const k of LS.chaves('reg.')) if (k.slice(4, 14) < lim) { LS.del(k); n++; }
    if (Pasta.ok) for (const [m] of await Pasta.listar(['registros'])) for (const [f] of await Pasta.listar(['registros', m])) if (f.slice(0, 10) < lim && await Pasta.apagar(['registros', m], f)) n++;
    toast(n + ' arquivo(s) apagado(s).');
  },
  /* ---- operadores ---- */
  opAdd() { cfgEdit.operadores.push({ id: 'op-' + Date.now().toString(36), nome: '', icone: animalAleatorio(), corRgb: CORES_PADRAO_HEX[cfgEdit.operadores.length % 10], corAlfa: 25 }); marcarSujo(); render(); },
  opRem(b) { const o = cfgEdit.operadores[+b.dataset.i]; if (!perfilEditavel(o)) { toast('Perfil protegido por senha.', 'bad'); return; } if (cfgEdit.operadores.length < 2) { toast('Mantenha ao menos um operador.', 'bad'); return; } if (!confirm('Remover este operador da lista? Os registros antigos continuam com o nome dele.')) return; cfgEdit.operadores.splice(+b.dataset.i, 1); marcarSujo(); render(); },
  opIcone(b) { const o = cfgEdit.operadores[+b.dataset.i]; if (!perfilEditavel(o)) { toast('Perfil protegido por senha.', 'bad'); return; } o.icone = b.dataset.v; marcarSujo(); render(); },
  async opSenha(b) {
    const i = +b.dataset.i, o = cfgEdit.operadores[i], s1 = $('#sn-' + i).value, s2 = $('#sc-' + i).value;
    if (!perfilEditavel(o)) { toast('Perfil protegido por senha.', 'bad'); return; }
    if (s1.length < 4) { toast('A senha deve ter ao menos 4 caracteres.', 'bad'); return; }
    if (s1 !== s2) { toast('A confirmação não confere com a senha.', 'bad'); return; }
    o.senhaSalt = Senha.novoSal(); o.senhaHash = await Senha.hash(s1, o.senhaSalt); marcarSujo(); render(); toast('Senha definida. Clique em Salvar configurações para valer.');
  },
  opSenhaRem(b) { const o = cfgEdit.operadores[+b.dataset.i]; if (!perfilEditavel(o) || !confirm('Remover a senha deste operador?')) return; delete o.senhaHash; delete o.senhaSalt; marcarSujo(); render(); },
  async senhaOk(el) {
    const op = cfg.operadores.find(x => x.id === M.opId), v = $('#senhaIn').value;
    if (!op) return;
    let ok = false; try { ok = await Senha.confere(op, v); } catch (e) { toast('Não foi possível verificar a senha: ' + e.message, 'bad'); return; }
    if (!ok) { toast('Senha incorreta.', 'bad'); $('#senhaIn').select(); return; }
    Senha.marcar(op.id); LS.set('operadorId', op.id); fecharModal(true); render(); toast('Operador: ' + op.nome);
  },
  /* ---- clínicas ---- */
  clSel(b) { cfgClinicaSel = +b.dataset.i; render(); },
  clNova() { cfgEdit.clinicas.push({ id: 'nova-' + Date.now().toString(36), nome: '', cidade: '', executante: '', emails: [], apelidos: '', codigos: {}, leitura: normLeitura(), _lista: [] }); cfgClinicaSel = cfgEdit.clinicas.length - 1; marcarSujo(); render(); setTimeout(() => $('#cl-nome')?.focus(), 30); },
  clRem(b) { const cl = cfgEdit.clinicas[+b.dataset.i]; if (!confirm(`Remover “${cl.nome || 'esta clínica'}” do cadastro? Os registros antigos são mantidos.`)) return; cfgEdit.clinicas.splice(+b.dataset.i, 1); cfgClinicaSel = Math.max(0, cfgClinicaSel - 1); marcarSujo(); render(); },
  clAddEmail(b) {
    const i = +b.dataset.i, cl = cfgEdit.clinicas[i], el = $('#novoEmail'), v = el.value.trim().toLowerCase();
    if (!v) return; if (!emailValido(v)) { toast('E-mail inválido.', 'bad'); return; }
    const outra = cfgEdit.clinicas.find(c => c !== cl && c.emails.includes(v)); if (outra) { toast(`Esse e-mail já pertence a ${outra.nome || 'outra clínica'}.`, 'bad'); return; }
    if (!cl.emails.includes(v)) cl.emails.push(v); marcarSujo(); render(); setTimeout(() => $('#novoEmail')?.focus(), 30);
  },
  clRemEmail(b) { cfgEdit.clinicas[+b.dataset.i].emails.splice(+b.dataset.j, 1); marcarSujo(); render(); },
  codAdd(b) { const cl = cfgEdit.clinicas[+b.dataset.i]; cl._lista.push({ c: '', d: '' }); marcarSujo(); render(); setTimeout(() => { const ins = $$('#tabCod tbody tr input[data-cfg$=".c"]'); ins[ins.length - 1]?.focus(); }, 30); },
  codRem(b) { cfgEdit.clinicas[+b.dataset.i]._lista.splice(+b.dataset.j, 1); marcarSujo(); render(); },
  cadastrarCodigo(b) { abrirModalCadCodigo(b.dataset.codigo); },
  async cadCodigoOk() {
    const id = $('#ccClinica').value, desc = $('#ccDesc').value.trim(), codigo = M.codigo;
    if (!id) { toast('Escolha a clínica.', 'bad'); return; }
    if (!desc) { toast('Informe a descrição da terapia.', 'bad'); return; }
    const cl = cfg.clinicas.find(c => c.id === id);
    if (cl && cl.codigos[codigo] !== undefined && cl.codigos[codigo] !== desc && !confirm(`O código ${codigo} já está cadastrado em ${cl.nome} como “${cl.codigos[codigo]}”. Substituir a descrição?`)) return;
    await alterarConfig(c => { const x = c.clinicas.find(y => y.id === id); if (x) x.codigos[codigo] = desc; });
    fecharModal(true); persistir(); render(); toast(`Código ${codigo} cadastrado em ${cl ? cl.nome : 'clínica'}.`);
  },
  codImportar(b) {
    M = { tipo: 'codimp', i: +b.dataset.i };
    abrirModal({ titulo: 'Colar lista de códigos', sub: 'Um código por linha: 80000001 - Descrição', icone: 'upload', tamanho: 'p',
      corpo: `<textarea id="impTxt" rows="10" placeholder="80000001 - CONSULTA / SESSÃO DE FONOAUDIOLOGIA&#10;80000002 - ..." aria-label="Lista de códigos"></textarea><label class="chk" style="margin-top:10px"><input type="checkbox" id="impAtualizar"><span>Atualizar a descrição de códigos que já estão cadastrados</span></label><p class="dica" style="margin-top:8px">Linhas sem código de 8 dígitos são ignoradas. Nada é gravado até clicar em “Salvar configurações”.</p>`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="codImportarOk">${ic('check')}Adicionar à lista</button>` });
  },
  codImportarOk() {
    const cl = cfgEdit.clinicas[M.i], atualizar = $('#impAtualizar').checked; let add = 0, upd = 0;
    $('#impTxt').value.split('\n').forEach(l => { const m = l.match(/(?<!\d)(\d{8})(?!\d)\s*[-–—:;\t]?\s*(.*)$/); if (!m) return; const ex = cl._lista.find(x => x.c.trim() === m[1]); if (ex) { if (atualizar && m[2].trim() && ex.d !== m[2].trim()) { ex.d = m[2].trim(); upd++; } } else { cl._lista.push({ c: m[1], d: m[2].trim() }); add++; } });
    cl._lista.sort((a, b) => a.c < b.c ? -1 : 1); fecharModal(true); if (add || upd) marcarSujo(); render(); toast(`${pl(add, 'código adicionado', 'códigos adicionados')}, ${pl(upd, 'atualizado', 'atualizados')}. Salve para gravar.`);
  },
  async codSugerir(b) {
    const i = +b.dataset.i, cl = cfgEdit.clinicas[i]; await Reg.carregar(60);
    const jaTem = new Set(cl._lista.map(x => x.c.trim())), mapa = {};
    Reg.cache.filter(r => !r.tipo && r.status === 'concluido' && r.clinicaId === cl.id).sort((a, c) => (a.concluidoEm < c.concluidoEm ? -1 : 1)).forEach(r => (r.itens || []).forEach(it => { if (!jaTem.has(it.c)) mapa[it.c] = it.d || ''; }));
    const cands = Object.entries(mapa);
    M = { tipo: 'codsug', i, cands };
    abrirModal({ titulo: 'Sugerir códigos a partir de atendimentos', sub: cl.nome, icone: 'search', tamanho: 'p',
      corpo: cands.length ? `<p class="dica">Códigos de atendimentos concluídos desta clínica que ainda não estão no cadastro. As descrições vêm dos e-mails: <b>revise antes de adicionar</b>. Nada é adicionado sem sua seleção.</p>${cands.map(([c, d], k) => `<div class="linha-flex" style="margin:6px 0"><input type="checkbox" id="sg-${k}" data-sg="${k}"><label for="sg-${k}" style="flex:1"><b class="num">${c}</b> — ${esc(d) || '<span class="muted">sem descrição</span>'}</label></div>`).join('')}` : '<p class="muted">Nenhum código novo encontrado nos atendimentos concluídos desta clínica.</p>',
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button>${cands.length ? `<button class="btn pri" data-act="codSugerirOk">${ic('check')}Adicionar selecionados</button>` : ''}` });
  },
  codSugerirOk() {
    const cl = cfgEdit.clinicas[M.i]; let n = 0;
    $$('[data-sg]').forEach(ch => { if (ch.checked) { const [c, d] = M.cands[+ch.dataset.sg]; cl._lista.push({ c, d }); n++; } });
    cl._lista.sort((a, b) => a.c < b.c ? -1 : 1); fecharModal(true); if (n) marcarSujo(); render(); toast(`${pl(n, 'código adicionado', 'códigos adicionados')}. Salve para gravar.`);
  },
  /* ---- modelos ---- */
  modeloSel(b) { cfgModeloSel[b.dataset.c] = b.dataset.k; render(); },
  modeloRestaurar(b) { const k = b.dataset.k; if (!confirm('Restaurar o texto padrão deste modelo? Suas alterações nele serão perdidas (até você descartar as alterações).')) return; cfgEdit.modelos[k].html = padraoHtml(MODELOS_PADRAO[k].texto); marcarSujo(); render(); },
  inserirCampo(b) { const ed = $('#edModelo'); const f = CAMPO[b.dataset.k]; inserirNoEditor(ed, `<span class="tok" contenteditable="false" data-k="${f.k}" title="${esc(f.desc)}">${esc(f.nome)}</span>&nbsp;`); ed.dispatchEvent(new Event('input', { bubbles: true })); },
  glosaAdd() { cfgEdit.glosas.push(''); marcarSujo(); render(); },
  glosaRem(b) { cfgEdit.glosas.splice(+b.dataset.i, 1); marcarSujo(); render(); },
  motAdd() { cfgEdit.motivos.push({ id: 'm-' + Date.now().toString(36), nome: '', modelo: '' }); marcarSujo(); render(); },
  motRem(b) { cfgEdit.motivos.splice(+b.dataset.i, 1); marcarSujo(); render(); },
  paramNova() { abrirParamLivre(); },
  paramVer(b) { const p = Param.porId(b.dataset.id); if (p) abrirModalParam(null, p, false); }
};
function abrirParamLivre() {
  M = { tipo: 'param', id: null, guiaId: null, livre: true, clinicaId: '', carteira: '', medico: '', data: '', terapias: [{ id: uid(), codigo: '', descricao: '', qtd: '' }], texto: '', textoEditado: false };
  M.texto = textoParametrizacao(M);
  abrirModal({ lateral: true, titulo: 'Nova parametrização', sub: 'Referência para os próximos atendimentos', icone: 'layers', tamanho: 'g', corpo: htmlModalParam(), rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="pmSalvar">${ic('save')}Salvar parametrização</button>` });
}

/* ====================================================================
   Eventos
   ==================================================================== */
document.addEventListener('click', e => {
  const cmd = e.target.closest('[data-cmd]');
  if (cmd) { const ed = cmd.closest('.ed-barra').nextElementSibling; ed.focus(); if (selSalva && ed.contains(selSalva.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(selSalva); } document.execCommand(cmd.dataset.cmd, false, null); ed.dispatchEvent(new Event('input', { bubbles: true })); return; }
  const cor = e.target.closest('[data-cor]');
  if (cor) { const ed = cor.closest('.ed-barra').nextElementSibling; ed.focus(); if (selSalva && ed.contains(selSalva.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(selSalva); } document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, cor.dataset.cor); ed.dispatchEvent(new Event('input', { bubbles: true })); return; }
  const b = e.target.closest('[data-act]'); if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
  const f = acoes[b.dataset.act]; if (!f) { console.warn('Ação sem função:', b.dataset.act); return; }
  e.preventDefault();
  let r; try { r = f(b, e); } catch (err) { console.error(err); toast('Erro: ' + err.message, 'bad'); return; }
  if (r && typeof r.then === 'function') { b.classList.add('carregando'); b.setAttribute('aria-busy', 'true'); r.catch(err => { console.error(err); toast('Erro: ' + err.message, 'bad'); }).finally(() => { b.classList.remove('carregando'); b.removeAttribute('aria-busy'); }); }
});
function onEditorInput(ed) {
  if (ed.id === 'edResp') { const g = guiaAtiva(); if (g) { g.respEdit = serializarEditor(ed); persistir(); } }
  else if (ed.id === 'edModelo') { const k = cfgModeloSel[cfgSecao]; cfgEdit.modelos[k].html = serializarEditor(ed); marcarSujo(); atualizarPrevia(); }
}
function setCfg(t) {
  const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
  try { setPath(cfgEdit, t.dataset.cfg, v); } catch (e) { return; } marcarSujo();
  if (typeof v === 'string') $$('[data-eco="' + t.dataset.cfg + '"]').forEach(e => { e.textContent = v || '(sem nome)'; });
}
let tFiltro;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('ed')) return onEditorInput(t);
  if (t.dataset.opcor && cfgEdit) {
    const [i, campo] = t.dataset.opcor.split(':'), o = cfgEdit.operadores[+i]; if (!o || !perfilEditavel(o)) return;
    if (campo === 'rgb') { o.corRgb = t.value.toLowerCase(); const hx = $(`[data-opcor="${i}:hex"]`); if (hx) hx.value = o.corRgb; }
    else if (campo === 'hex') { const v = t.value.startsWith('#') ? t.value : '#' + t.value; if (!hexValido(v)) return; o.corRgb = v.toLowerCase(); const rg = $(`[data-opcor="${i}:rgb"]`); if (rg) rg.value = o.corRgb; }
    else { o.corAlfa = 100 - Number(t.value); const e = $(`[data-opteco="${i}"]`); if (e) e.textContent = t.value + '%'; }
    marcarSujo(); $$(`[data-opprev="${i}"]`).forEach(e => e.setAttribute('style', estiloOp(o))); return;
  }
  if (t.dataset.cfg !== undefined && cfgEdit) { setCfg(t); return; }
  if (t.dataset.filtro) {
    const q = norm(t.value), alvo = t.dataset.filtro === 'cl' ? '#listaCl .cl-item' : '#tabCod tbody tr';
    $$(alvo).forEach(x => x.classList.toggle('oculto', !!q && !(x.dataset.busca || '').includes(q))); return;
  }
  if (t.dataset.fp === 'q') { painelFiltro.q = t.value; clearTimeout(tFiltro); tFiltro = setTimeout(async () => { await render(); const i = $('#fQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); return; }
  /* modais */
  if (M && M.tipo === 'param') {
    if (t.dataset.pm) {
      const k = t.dataset.pm; M[k] = k === 'carteira' ? normCart(t.value) : t.value;
      if (k === 'texto') { M.textoEditado = true; const bt = $('[data-act=pmGerar]'); if (bt) bt.disabled = false; const tg = $('#pmTag'); if (tg) tg.outerHTML = `<span class="tag warn" id="pmTag">${ic('edit', 'sm')}Editado manualmente</span>`; }
      else if (!M.textoEditado) { M.texto = textoParametrizacao(M); $('#pmTexto').value = M.texto; }
      return;
    }
    if (t.dataset.pt) { const tr = M.terapias[+t.dataset.i]; tr[t.dataset.pt] = t.dataset.pt === 'qtd' || t.dataset.pt === 'codigo' ? t.value.replace(/\D/g, '') : t.value; if (t.dataset.pt !== 'descricao' && t.value !== tr[t.dataset.pt]) t.value = tr[t.dataset.pt]; if (!M.textoEditado) { M.texto = textoParametrizacao(M); $('#pmTexto').value = M.texto; } return; }
  }
  if (M && M.tipo === 'corrigir') {
    if (t.dataset.cgc !== undefined) { M.carteira = t.value; return; }
    if (t.dataset.cgi) { const x = M.itens[+t.dataset.i]; const v = t.dataset.cgi === 'd' ? t.value : t.value.replace(/\D/g, ''); x[t.dataset.cgi] = v; if (t.value !== v) t.value = v; return; }
  }
  if (M && M.tipo === 'obs' && t.dataset.obstxt) { M.txt = t.value; M.editado = true; return; }
  if (!S) return;
  const g = guiaAtiva();
  if (t.dataset.glf) { const gl = glosaDe(g); if (gl.itens[t.dataset.c]) gl.itens[t.dataset.c][t.dataset.glf] = t.value; persistir(); atualizarConcluir(g); return; }
  if (t.dataset.cega) {
    const i = +t.dataset.i; g.cega.entradas[i] = { ...(g.cega.entradas[i] || {}), [t.dataset.cega]: t.value.replace(/\D/g, '') };
    if (t.value !== t.value.replace(/\D/g, '')) t.value = t.value.replace(/\D/g, '');
    g.cega.resultado = null; persistir();
    if (t.dataset.cega === 'qtd' && t.value) { const prox = $(`[data-cega=fim][data-i="${i + 1}"]`); if (prox) prox.focus(); }
    return;
  }
  if (t.id === 'cegaN') { g.cega.linhas = t.value; g.cega.resultado = null; $('#cegaLinhas').innerHTML = htmlLinhasCega(g); persistir(); return; }
  if (t.dataset.cpcampo) {
    alterarCampoGuia(g, t.dataset.cpcampo, t.value);
    const bt = $(`[data-act=copiarCampo][data-campo="${t.dataset.cpcampo}"]`); if (bt) estadoCopiaBtn(bt, t.value.trim() !== '' && g.copiados[t.dataset.cpcampo] === t.value.trim());
    persistir(); return;
  }
  if (t.id === 'guia') {
    let v = t.value.toUpperCase().replace(/\s/g, ''); if (/^\d{8}$/.test(v)) v = 'T' + v;
    g.numero = v; persistir();
    clearTimeout(window._tg); window._tg = setTimeout(() => { const pos = t.selectionStart; render(); const gi = $('#guia'); if (gi) { gi.focus(); gi.setSelectionRange(pos, pos); } }, 400);
    return;
  }
  if (t.id === 'txtObs') { g.obsEdit = t.value; persistir(); const bt = $('[data-act=copiarObs]'); if (bt && g.copiados.obs !== t.value) $$('[data-act=copiarObs].copiado').forEach(x => estadoCopiaBtn(x, false)); return; }
  if (t.dataset.resf === 'emailPrestador') { g.resultado.emailPrestador = t.value.trim(); const bt = $('[data-act=copiarEmail]'); if (bt) estadoCopiaBtn(bt, g.copiados.email === t.value.trim() && t.value.trim() !== ''); persistir(); return; }
  if (t.dataset.resf === 'motivoTxt' || t.dataset.resf === 'obsAdicionais') { g.resultado[t.dataset.resf] = t.value; persistir(); return; }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'operador') {
    const op = cfg.operadores.find(x => x.id === t.value);
    if (op && op.senhaHash && Senha.autenticado() !== op.id) {
      M = { tipo: 'senha', opId: op.id };
      abrirModal({ titulo: 'Senha do operador', sub: op.nome, icone: 'lock', tamanho: 'p', aoFechar: () => render(),
        corpo: `<label class="lbl" for="senhaIn">Senha de ${esc(op.nome)}</label><input type="password" id="senhaIn" data-enter="senhaOk" autocomplete="current-password" autofocus>`,
        rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="senhaOk">${ic('check')}Entrar</button>` });
      render(); return;
    }
    LS.set('operadorId', t.value); render(); return;
  }
  if (t.dataset.obsp) { const g = guiaAtiva(); const x = g.prints && g.prints.ign && g.prints.ign[t.dataset.obsp]; if (x) { x.on = t.checked; sincronizarObsPrints(g); persistir(); render(); } return; }
  if (t.id === 'arqPrints') { const fs = [...t.files]; t.value = ''; if (fs.length) processarPrints(fs); return; }
  if (t.id === 'arquivoEml') { const f = t.files[0]; t.value = ''; if (f) abrirArquivo(f); return; }
  if (t.id === 'arqConc') { try { await conciliarEmails([...t.files]); } catch (err) { toast('Erro ao ler: ' + err.message, 'bad'); } return; }
  if (t.id === 'painelDia' || t.id === 'painelMes' || t.id === 'painelSemana') { acoes.atualizarPainel(); return; }
  if (t.id === 'impCfg') {
    const f = t.files[0]; if (!f) return;
    if (!Pin.liberado()) { t.value = ''; toast('Importar configurações exige o PIN do supervisor.', 'bad'); pedirPin(null); return; }
    try { const novo = mesclarConfig(configPadrao(), JSON.parse(await f.text())); const keep = cfgEdit; cfgEdit = novo; cfgEdit.clinicas.forEach(cl => { cl._lista = Object.entries(cl.codigos || {}).map(([c, d]) => ({ c, d })).sort((a, b) => a.c < b.c ? -1 : 1); }); cfgDirty = true; render(); toast('Importado como rascunho. Confira e clique em Salvar configurações.'); } catch (err) { toast('Arquivo inválido: não é um config.json do sistema.', 'bad'); }
    return;
  }
  if (t.dataset.fp !== undefined && t.dataset.fp !== 'q') { painelFiltro[t.dataset.fp] = t.value; render(); return; }
  if (t.dataset.cfg !== undefined && cfgEdit) { setCfg(t); if (t.dataset.rr) render(); return; }
  if (M && M.tipo === 'param' && t.dataset.pm === 'clinicaId') { M.clinicaId = t.value; $('#modalCorpo').innerHTML = htmlModalParam(); return; }
  if (M && M.tipo === 'obs' && t.dataset.obssel) {
    t.checked ? M.sel.add(t.dataset.obssel) : M.sel.delete(t.dataset.obssel);
    if (!M.editado) { M.txt = textoSelObs(); const ta = $('#obsTxt'); if (ta) ta.value = M.txt; } return;
  }
  if (!S) return;
  const g = guiaAtiva();
  if (t.dataset.conf) { g.conf = g.conf || {}; g.conf[t.dataset.conf] = t.checked; const al = situacaoGuia(g).A.find(a => a.key === t.dataset.conf); evento(g, 'conferido', `${t.checked ? 'Conferido' : 'Desmarcado'}: ${al ? al.texto : t.dataset.conf}`); persistir(); render(); return; }
  if (t.dataset.campo) {
    const k = t.dataset.campo, v = t.value.trim(), p = g.pedido;
    const antes = k === 'medico' ? [p.medico.nome, p.medico.crm && 'CRM ' + p.medico.crm].filter(Boolean).join(' ') : k === 'emissao' ? (p.emissao.estado === 'valida' ? fmtData(p.emissao.data) : p.emissao.bruto || '') : k === 'beneficiario' ? p.beneficiario : (p[k] || '');
    if (String(antes || '') !== v) {
      evento(g, 'edicao-campo', `${{ medico: 'Médico', emissao: 'Data do pedido', cid: 'CID', beneficiario: 'Beneficiário', local: 'Local' }[k] || k}: "${antes || '—'}" → "${v || '—'}"`);
      const cl = clinicaDe(S); if (cl && k !== 'beneficiario') { const novo = k === 'medico' ? lerMedico(v) : null; if (k === 'medico') { if (p.medico.nome !== novo.nome) Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo: 'medico', lido: p.medico.nome, correto: novo.nome }); if (p.medico.crm !== novo.crm && novo.crm) Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo: 'crm', lido: p.medico.crm, correto: novo.crm }); } else Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo: k, lido: antes, correto: v }); }
    }
    if (k === 'medico') p.medico = lerMedico(v); else if (k === 'emissao') p.emissao = lerEmissao(v, S.email.data); else if (k === 'cid') p.cid = v.toUpperCase(); else if (k === 'beneficiario') { p.beneficiario = v; p.beneficiarios = v ? [v] : []; } else p[k] = v;
    marcarOrigem(g, { beneficiario: 'beneficiario', medico: 'medico', emissao: 'emissao', cid: 'cid', local: 'local' }[k] || k, 'digitado');
    g.itensEditados = true; persistir(); render(); return;
  }
  if (t.id === 'cartUsada') { const ant = g.carteiraUsada; g.carteiraUsada = normCart(t.value); if (ant !== g.carteiraUsada) marcarOrigem(g, 'carteira', 'digitado'); if (ant !== g.carteiraUsada) evento(g, 'carteira', `Carteira usada no sistema: "${ant || '—'}" → "${g.carteiraUsada || '—'}"`); persistir(); render(); return; }
  if (t.dataset.cpcampo) {
    g.itensEditados = true;
    const k = t.dataset.cpcampo, de = t.dataset.orig ?? '', para = t.value.trim();
    if (de !== para) {
      evento(g, 'edicao-campo', `${ROT_COPIA[k] || k}: "${de || '—'}" → "${para || '—'}"`);
      const cl = clinicaDe(S), campo = { medico_nome: 'medico', medico_crm: 'crm', cid: 'cid', local: 'local', data: 'emissao' }[k];
      if (cl && campo && de) Apr.registrar({ tipo: 'email', clinicaId: cl.id, clinica: cl.nome, campo, lido: de, correto: para });
      t.dataset.orig = para;
    }
    persistir(); return;
  }
  if (t.dataset.gl) { const gl = glosaDe(g); if (t.checked) gl.itens[t.dataset.gl] = gl.itens[t.dataset.gl] || { glosa: '', motivo: '' }; else delete gl.itens[t.dataset.gl]; persistir(); render(); return; }
  if (t.dataset.neg) { const r = g.resultado; if (t.checked) { r.naoAut[t.dataset.neg] = r.naoAut[t.dataset.neg] ?? ''; delete glosaDe(g).itens[t.dataset.neg]; } else delete r.naoAut[t.dataset.neg]; g.respEdit = null; persistir(); render(); return; }
  if (t.dataset.negmot) { g.resultado.naoAut[t.dataset.negmot] = t.value; g.respEdit = null; persistir(); render(); return; }
  if (t.dataset.resf) {
    if (t.dataset.resf === 'usarCorrecao') { g.usarCorrecao = t.checked; g.respEdit = null; }
    else if (t.dataset.resf === 'emailPrestador') { g.resultado.emailPrestador = t.value.trim(); }
    else { g.resultado[t.dataset.resf] = t.value; if (g.respEdit == null) { /* o texto gerado acompanha */ } }
    persistir(); render(); return;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-cega], #cegaN')) {
    e.preventDefault();
    const campos = $$('#cegaN, [data-cega]'); const i = campos.indexOf(e.target);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else acoes.conferir();
  }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); acoes[e.target.dataset.enter](e.target); }
});
document.addEventListener('dragover', e => { if (aba === 'atend' && !S) e.preventDefault(); });
document.addEventListener('drop', e => { if (aba === 'atend' && !S && !e.target.closest('#zona')) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) abrirArquivo(f); } });
window.addEventListener('beforeunload', e => { if (cfgDirty) { e.preventDefault(); e.returnValue = ''; } });

/* prints colados (Ctrl+V) ou arrastados na etapa 3 */
document.addEventListener('paste', e => {
  if (aba !== 'atend' || !S || S.vista !== 3 || !$('#arqPrints')) return;
  const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return;
  e.preventDefault(); processarPrints(fs);
});
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('#zonaPrints')) { e.preventDefault(); e.target.closest('#zonaPrints').classList.add('sobre'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#zonaPrints'); if (z) z.classList.remove('sobre'); });
document.addEventListener('drop', e => {
  const z = e.target.closest && e.target.closest('#zonaPrints'); if (!z) return;
  e.preventDefault(); z.classList.remove('sobre');
  const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (fs.length) processarPrints(fs);
});

// Ao voltar para a janela, relê o config.json da pasta (operadores e senhas de colegas) se não houver edição em curso
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) { const antes = Pasta.ok; await Pasta.verificar(); if (antes !== Pasta.ok) { pintarSync(); renderTopo(); } }
  if (document.hidden || !Pasta.ok || cfgDirty || M) return;
  try { const antes = JSON.stringify(cfg.operadores); await carregarConfig(); if (JSON.stringify(cfg.operadores) !== antes) { if (cfgEdit) iniciarCfgEdit(); render(); } } catch (e) { }
});

// Botões secundários viram só ícone (o texto vai para dica e leitor de tela)
const ROT_ICONE = /^(Copiar.*|Atualizar|Lista|Numerada|Limpar formatação|Corrigir guia|Cancelar guia|Excluir guia|Incluir observação|Exportar CSV.*|Baixar config\.json|Limpar filtros|Ver ou editar|Descartar.*|Remover.*|Adicionar.*)$/;
/* Antes, esta função tirava o texto de vários botões secundários (Corrigir guia, Excluir guia, Adicionar…, Remover…),
   obrigando a decorar ícones. Agora os botões mantêm o texto; só os botões feitos para ser só ícone (classe "so", como os de
   copiar) ficam sem texto, sempre com dica e nome acessível. */
const enviarAoWebmail = resposta => window.postMessage({ __conferidorPagina: 'responderWebmail', resposta }, location.origin);
function soIcone(raiz) {
  raiz.querySelectorAll('.btn.so').forEach(b => { const t = b.getAttribute('aria-label') || b.dataset.dica || ''; if (t && !b.title && !b.dataset.dica) b.title = t; });
  return;
  raiz.querySelectorAll('.btn:not(.so):not(.pri)').forEach(b => {
    if (!b.querySelector('svg.ic')) return;
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if (!t || !ROT_ICONE.test(t)) return;
    b.classList.add('so'); if (!b.title) b.title = t; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', t);
  });
}
/* Escolha de clínica com busca: o <select> continua no lugar (escondido) e recebe a escolha */
const buscaClinica = cl => [cl.nome, cl.cidade, ...(cl.emails || [])].filter(Boolean).join(' ');
function realcarSelects(raiz) {
  raiz.querySelectorAll('select.sel-busca:not([data-realce])').forEach(sel => {
    sel.dataset.realce = '1';
    const ops = [...sel.options].filter(o => o.value).map(o => {
      const cl = cfg.clinicas.find(c => c.id === o.value);
      return { v: o.value, t: o.textContent, s: cl ? [cl.cidade, (cl.emails || [])[0]].filter(Boolean).join(' · ') : '', b: norm((o.dataset.busca || '') + ' ' + o.textContent) };
    });
    const caixa = document.createElement('div'); caixa.className = 'combo';
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'combo-in'; inp.autocomplete = 'off';
    inp.placeholder = 'Digite o nome, a cidade ou o e-mail da clínica…'; inp.id = (sel.id || 'sel') + 'Busca';
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Clínica');
    const lista = document.createElement('div'); lista.className = 'combo-lista'; lista.setAttribute('role', 'listbox'); lista.hidden = true;
    const lbl = sel.id && raiz.querySelector(`label[for="${sel.id}"]`); if (lbl) lbl.htmlFor = inp.id;
    sel.parentNode.insertBefore(caixa, sel); caixa.append(inp, lista, sel); sel.hidden = true; sel.tabIndex = -1;
    const atual = () => ops.find(o => o.v === sel.value);
    inp.value = atual() ? atual().t : '';
    let vis = [], ativo = 0;
    const pintar = () => {
      const q = norm(inp.value).split(/\s+/).filter(Boolean), sel0 = atual();
      vis = (!q.length || (sel0 && inp.value === sel0.t) ? ops : ops.filter(o => q.every(w => o.b.includes(w)))).slice(0, 60);
      ativo = Math.min(ativo, Math.max(0, vis.length - 1));
      lista.innerHTML = vis.length ? vis.map((o, i) => `<div class="combo-op ${i === ativo ? 'ativo' : ''} ${o.v === sel.value ? 'sel' : ''}" role="option" data-v="${esc(o.v)}" aria-selected="${o.v === sel.value}"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</div>`).join('') : '<div class="combo-vazio">Nenhuma clínica encontrada.</div>';
      lista.hidden = false; inp.setAttribute('aria-expanded', 'true');
      const a = lista.querySelector('.ativo'); if (a) a.scrollIntoView({ block: 'nearest' });
    };
    const fechar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); const a = atual(); if (!a || inp.value !== a.t) inp.value = a ? a.t : ''; };
    const escolher = v => { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); const a = atual(); inp.value = a ? a.t : ''; lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
    inp.addEventListener('focus', () => { inp.select(); ativo = Math.max(0, ops.findIndex(o => o.v === sel.value)); pintar(); });
    inp.addEventListener('input', () => { ativo = 0; pintar(); });
    inp.addEventListener('blur', () => setTimeout(fechar, 160));
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (lista.hidden) pintar(); else { ativo = Math.min(vis.length - 1, ativo + 1); pintar(); } }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); ativo = Math.max(0, ativo - 1); pintar(); }
      else if (ev.key === 'Enter') { if (!lista.hidden && vis[ativo]) { ev.preventDefault(); ev.stopPropagation(); escolher(vis[ativo].v); } }
      else if (ev.key === 'Escape' && !lista.hidden) { ev.preventDefault(); ev.stopPropagation(); fechar(); }
    });
    lista.addEventListener('mousedown', ev => { const o = ev.target.closest('.combo-op'); if (o) { ev.preventDefault(); escolher(o.dataset.v); } });
  });
}
/* Dicas de mouse: o title vira uma dica no estilo do sistema (o texto continua acessível) */
const Dica = {
  el: null, alvo: null, t: null,
  iniciar() {
    document.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('[title],[data-dica]'); if (!a || a === this.alvo || a.closest('svg') && !a.matches('svg')) return; this.preparar(a); }, true);
    document.addEventListener('mouseout', e => { if (this.alvo && !(e.relatedTarget && this.alvo.contains(e.relatedTarget))) this.esconder(); }, true);
    ['mousedown', 'keydown', 'scroll', 'wheel'].forEach(t => document.addEventListener(t, () => this.esconder(), true));
    document.addEventListener('focusin', e => { const a = e.target.closest && e.target.closest('[title],[data-dica]'); if (a && a.matches(':focus-visible')) { this.preparar(a); } });
    document.addEventListener('focusout', () => this.esconder());
  },
  preparar(a) {
    this.esconder();
    if (a.hasAttribute('title')) { const t = a.getAttribute('title'); a.removeAttribute('title'); if (!t) return; a.dataset.dica = t; if (!a.getAttribute('aria-label') && !a.textContent.trim()) a.setAttribute('aria-label', t); }
    if (!a.dataset.dica) return;
    this.alvo = a; this.t = setTimeout(() => this.mostrar(a), 380);
  },
  mostrar(a) {
    if (!document.body.contains(a)) return;
    const el = document.createElement('div'); el.className = 'dica-flut'; el.setAttribute('role', 'tooltip'); el.textContent = a.dataset.dica; document.body.appendChild(el); this.el = el;
    const r = a.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8; x = Math.max(8, Math.min(x, innerWidth - w - 8));
    if (y + h > innerHeight - 8) { y = r.top - h - 8; el.classList.add('acima'); }
    el.style.left = x + 'px'; el.style.top = y + 'px';
  },
  esconder() { clearTimeout(this.t); this.alvo = null; if (this.el) { this.el.remove(); this.el = null; } }
};
function iniciarSoIcone() {
  const alvos = ['#app', '#modalRoot'].map(s => document.querySelector(s)).filter(Boolean);
  const mo = new MutationObserver(() => alvos.forEach(a => { soIcone(a); realcarSelects(a); }));
  alvos.forEach(a => { mo.observe(a, { childList: true, subtree: true }); soIcone(a); realcarSelects(a); });
}
