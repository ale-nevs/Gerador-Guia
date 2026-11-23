'use strict';
/* ====================================================================
   Listas do dia (clínica Erasmo Neto): a clínica manda a agenda do dia num e-mail só, com muitos beneficiários
   ("Beneficiário:", "Carteira:", "Serviço:", "Quantidade:", "Médico:", "CID:", "Emissão:", "Local de emissão:", "Obs:").
   O e-mail vira uma lista dividida entre os operadores escolhidos (cada beneficiário inteiro com um operador, em blocos
   alfabéticos de tamanho parecido). Cada operador gera as guias da sua parte, registra o número ou uma observação
   ("Paciente excluso"...), pode passar um item para outro operador, e no fim sai o e-mail de entrega com a tabela.
   Na pasta compartilhada: listas/AAAA-MM-DD/<lista>/lista.json (cabeçalho e itens), res-<operador>.json (o que cada
   operador registrou) e transf-<operador>.json (o que cada um passou adiante). Cada operador grava só os próprios
   arquivos: duas pessoas trabalhando ao mesmo tempo não apagam o trabalho uma da outra.
   ==================================================================== */
const SEM_GUIA_LISTA = ['Paciente excluso', 'Guia já liberada em', 'Carteira não localizada', 'Sem cobertura para o serviço', 'Carência', 'Aguardando documentação'];

/* ---------- leitura do e-mail da lista ---------- */
function lerListaTexto(texto) {
  const t = String(texto || '').replace(/\r/g, '').replace(/ /g, ' ');
  const linhas = t.split('\n');
  const ini = []; linhas.forEach((l, i) => { if (/^\s*benefici[aá]ri[oa]s?\s*:/i.test(l)) ini.push(i); });
  const ROT = [['carteira', /^cart(eira|eirinha|ão|ao|\.)?\b/i], ['servico', /^(servi[cç]o|procedimento|terapia)/i], ['qtd', /^(quantidade|qtde?|qnt)/i],
    ['medico', /^(m[eé]dico|solicitante|profissional)/i], ['cid', /^cid/i], ['emissao', /^(emiss[aã]o|data)/i], ['local', /^local/i], ['obs', /^obs/i]];
  return ini.map((a, k) => {
    const bloco = linhas.slice(a, k + 1 < ini.length ? ini[k + 1] : linhas.length);
    const it = { benef: bloco[0].replace(/^\s*benefici[aá]ri[oa]s?\s*:/i, '').replace(/\t/g, ' ').trim(), carteiraBruta: '', servicoBruto: '', qtd: null, medicoBruto: '', cid: '', emissao: '', local: '', obs: '' };
    let ultimo = null;
    bloco.slice(1).forEach(l0 => {
      const l = l0.replace(/\t/g, ' ').trim(); if (!l) return;
      const m = l.match(/^([A-Za-zÀ-ÿ .]{2,30}?)\s*:\s*(.*)$/);
      if (m) { const r = ROT.find(([, re]) => re.test(m[1].trim())); if (r) { ultimo = r[0]; const v = m[2].trim();
        if (r[0] === 'carteira') it.carteiraBruta = v; else if (r[0] === 'servico') it.servicoBruto = v; else if (r[0] === 'qtd') { const q = v.match(/\d{1,3}/); it.qtd = q ? Number(q[0]) : null; }
        else if (r[0] === 'medico') it.medicoBruto = v; else if (r[0] === 'cid') it.cid = v.replace(/\s+/g, '').toUpperCase(); else if (r[0] === 'emissao') it.emissao = v; else if (r[0] === 'local') it.local = v; else if (r[0] === 'obs') it.obs = v;
        return; } }
      if (ultimo === 'obs' && !/^(atenciosamente|att|obrigad)/i.test(l)) it.obs = (it.obs ? it.obs + ' ' : '') + l;   // observação em mais de uma linha
    });
    const cod = it.servicoBruto.match(/(?<!\d)(\d{8})(?!\d)/);
    it.codigo = cod ? cod[1] : '';
    it.servico = it.servicoBruto.replace(/(?<!\d)\d{8}(?!\d)/, '').replace(/^[\s\-–—:]+/, '').trim();
    const md = it.medicoBruto.match(/^(?:crm\s*)?(\d{3,7})\s*[-–—:]?\s*(.*)$/i);
    it.crm = md ? md[1] : ''; it.medico = (md ? md[2] : it.medicoBruto).replace(/^[\s\-–—]+/, '').trim();
    it.carteira = normCart(it.carteiraBruta);
    if (/^[\s\-–—.]*$/.test(it.obs)) it.obs = '';
    it.bloco = bloco.join('\n').trim();
    return it;
  }).filter(it => it.benef || it.carteira);
}
/* clínica que manda a agenda em lista: marcada no cadastro, ou (sem marcação) o domínio/assunto da Erasmo Neto */
function clinicaListaDe(email) {
  const ac = acharClinica(email), cl = ac && ac.cl;
  if (cl && cl.lista) return cl;
  const rem = (email.remetente && email.remetente.email || '').toLowerCase();
  if (/@clinicaserasmoneto\.com\.br$/.test(rem) || /erasmo\s*neto/i.test(email.assunto || '')) return cl || cfg.clinicas.find(c => /erasmo/i.test(c.nome)) || { id: 'erasmo-neto', nome: 'Erasmo Neto', emails: [] };
  return null;
}
const ehEmailLista = email => { const cl = clinicaListaDe(email); return cl && lerListaTexto(email.textoCompleto || email.textoPrincipal).length >= 2 ? cl : null; };
const normNomeLista = s => norm(String(s || '')).replace(/\s+/g, ' ').trim();
const chaveItemLista = it => [normCart(it.carteira), it.codigo, normNomeLista(it.benef), it.qtd ?? ''].join('|');

/* divide em blocos alfabéticos de tamanho parecido, sem separar os itens do mesmo beneficiário */
function dividirLista(itens, ops) {
  const grupos = new Map();
  [...itens].sort((a, b) => normNomeLista(a.benef).localeCompare(normNomeLista(b.benef)) || (a.ord - b.ord)).forEach(it => { const k = normNomeLista(it.benef) + '|' + normCart(it.carteira); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); });
  const total = itens.length, n = Math.max(1, ops.length), alvo = total / n; let k = 0, acum = 0;
  [...grupos.values()].forEach(g => { const meio = acum + g.length / 2; while (k < n - 1 && meio > alvo * (k + 1)) k++; g.forEach(it => { it.para = ops[k]; }); acum += g.length; });
  return itens;
}
function resumoDivisao(itens, ops) {
  return ops.map(op => { const meus = itens.filter(i => i.para === op).sort((a, b) => normNomeLista(a.benef).localeCompare(normNomeLista(b.benef)));
    const pac = new Set(meus.map(i => normNomeLista(i.benef)));
    return { op, n: meus.length, pac: pac.size, de: meus[0] ? meus[0].benef.split(' ')[0] : '', ate: meus.length ? meus[meus.length - 1].benef.split(' ')[0] : '' }; });
}
const nomeOp = id => { const o = cfg.operadores.find(x => x.id === id); return o ? o.nome : (id || '—'); };

/* ---------- arquivos (pasta compartilhada; sem ela, só neste computador) ---------- */
const Lista = {
  sub: 'continuar', dia: isoDia(new Date()), listas: [], sel: null, rascunho: {}, carregadoEm: null, carregando: false, filtro: { op: '', st: '', q: '' }, introEdit: {},
  chaveLS: (dia, id, nome) => `lst|${dia}|${id}|${nome}`,
  async ler(dia, id, nome) { if (Pasta.ok) { const d = await Pasta.ler(['listas', dia, id], nome); if (d) return d; } return LS.get(this.chaveLS(dia, id, nome), null); },
  async gravar(dia, id, nome, obj) {
    LS.set(this.chaveLS(dia, id, nome), obj);
    if (Pasta.ok) { try { await Pasta.gravar(['listas', dia, id], nome, obj); } catch (e) { toast('Não consegui gravar a lista na pasta compartilhada; ficou neste computador.', 'bad'); } }
  },
  async idsDoDia(dia) {
    const s = new Set();
    if (Pasta.ok) for (const [n, h] of await Pasta.listar(['listas', dia])) if (!h.kind || h.kind === 'directory') s.add(n);
    LS.chaves(`lst|${dia}|`).forEach(k => s.add(k.split('|')[2]));
    return [...s];
  },
  async arquivosDe(dia, id, prefixo) {
    const docs = new Map();
    if (Pasta.ok) for (const [n, h] of await Pasta.listar(['listas', dia, id])) { if (!n.startsWith(prefixo) || !n.endsWith('.json')) continue; try { docs.set(n, JSON.parse(await (await h.getFile()).text())); } catch (e) { } }
    LS.chaves(`lst|${dia}|${id}|${prefixo}`).forEach(k => { const n = k.split('|')[3]; if (!docs.has(n)) { const d = LS.get(k, null); if (d) docs.set(n, d); } });
    return [...docs.values()];
  },
  /* junta cabeçalho + resultados + transferências: vale o mais recente de cada item */
  montar(cab, res, tr) {
    const L = { ...cab, itens: (cab.itens || []).map(i => ({ ...i })) };
    const ultimo = (docs, id) => { let m = null; docs.forEach(d => { const x = d.itens && d.itens[id]; if (x && (!m || (x.em || '') > (m.em || ''))) m = x; }); return m; };
    L.itens.forEach(it => {
      const t = ultimo(tr, it.id); it.resp = t ? t.para : it.para; it.transf = t;
      const r = ultimo(res, it.id); it.r = r && r.st !== 'pendente' ? r : null;
      const guias = new Set(res.map(d => d.itens && d.itens[it.id]).filter(x => x && x.st === 'gerada').map(x => x.guia)); it.duplicada = guias.size > 1 && !(r && r.reaberta) ? [...guias] : null;   // reaberta pelo Painel: o número novo substitui o antigo de propósito
    });
    L.ativos = res.map(d => ({ op: d.op, em: Object.values(d.itens || {}).reduce((m, x) => (x.em || '') > m ? x.em : m, '') })).filter(x => x.em);
    return L;
  },
  async carregar(dia = this.dia) {
    if (this.carregando) return; this.carregando = true;
    try {
      const out = [];
      for (const id of await this.idsDoDia(dia)) {
        const cab = await this.ler(dia, id, 'lista.json'); if (!cab || !cab.itens) continue;
        out.push(this.montar(cab, await this.arquivosDe(dia, id, 'res-'), await this.arquivosDe(dia, id, 'transf-')));
      }
      this.listas = out.sort((a, b) => (a.criadaEm < b.criadaEm ? -1 : 1)); this.carregadoEm = agora();
      if (this.sel && !this.listas.some(l => l.id === this.sel)) this.sel = null;
      if (!this.sel && this.listas.length) this.sel = (this.listas.find(l => !l.finalizadaEm) || this.listas[this.listas.length - 1]).id;
    } finally { this.carregando = false; }
  },
  atual() { return this.listas.find(l => l.id === this.sel) || null; },
  /* uma lista de qualquer dia, sem mexer na lista aberta na aba (usada para reabrir pelo Painel) */
  async umaLista(dia, id) { if (!dia || !id) return null; const cab = await this.ler(dia, id, 'lista.json'); return cab && cab.itens ? this.montar(cab, await this.arquivosDe(dia, id, 'res-'), await this.arquivosDe(dia, id, 'transf-')) : null; },
  meus(L, op = operadorObj() && operadorObj().id) { return L ? L.itens.filter(i => i.resp === op) : []; },
  pendentesMeus() { const op = operadorObj(); if (!op) return 0; return this.listas.filter(l => !l.finalizadaEm).reduce((s, L) => s + L.itens.filter(i => i.resp === op.id && !i.r).length, 0); },
  async meuArquivo(L, prefixo) { const op = operadorObj(); const nome = `${prefixo}${slug(op.id || op.nome)}.json`; const d = (await this.ler(L.dia, L.id, nome)) || { op: op.id, opNome: op.nome, itens: {} }; return { nome, d }; },

  /* ---------- criar / adicionar ---------- */
  async abrirEmail(email, cl) {
    const itens = lerListaTexto(email.textoCompleto || email.textoPrincipal);
    if (!itens.length) { toast('Não encontrei beneficiários neste e-mail da lista.', 'bad'); return; }
    await this.carregar(isoDia(new Date()));
    const abertas = this.listas.filter(l => !l.finalizadaEm && (l.clinicaId === cl.id || normNomeLista(l.clinica) === normNomeLista(cl.nome)));
    const jaTem = new Set(this.listas.flatMap(l => l.itens.map(chaveItemLista)));
    const novos = itens.filter(i => !jaTem.has(chaveItemLista(i)));
    if (this.listas.some(l => (l.messageIds || []).includes(email.messageId)) && !novos.length) { aba = 'lista'; render(); toast('Este e-mail já está na lista do dia.'); return; }
    await Presenca.ler().catch(() => { });
    const online = new Set(Presenca.lista.map(p => p.operadorId)); const eu = operadorObj();
    const marcados = cfg.operadores.filter(o => online.has(o.id) || (eu && o.id === eu.id)).map(o => o.id);
    M = { tipo: 'lstNova', email, cl, itens, novos, abertas, modo: abertas.length ? 'adicionar' : 'nova', alvo: abertas.length ? abertas[abertas.length - 1].id : null, ops: marcados.length ? marcados : cfg.operadores.map(o => o.id) };
    this.modalNova();
  },
  modalNova() {
    const m = M, base = m.modo === 'adicionar' ? m.novos : m.itens;
    const prev = dividirLista(base.map((i, k) => ({ ...i, ord: k })), m.ops);
    const pac = new Set(base.map(i => normNomeLista(i.benef))).size, q2 = base.filter(i => (i.qtd || 1) > 1).length;
    const corpo = `<p style="margin:0 0 10px"><b>${esc(m.cl.nome)}</b>: ${pl(m.itens.length, 'guia', 'guias')} de ${pl(new Set(m.itens.map(i => normNomeLista(i.benef))).size, 'beneficiário', 'beneficiários')}${q2 ? ` · <span class="tag warn">${q2} com quantidade maior que 1</span>` : ''}${m.itens.some(i => !i.codigo) ? ` · <span class="tag bad">${m.itens.filter(i => !i.codigo).length} sem código</span>` : ''}</p>
      ${m.abertas.length ? `<div class="stack" role="radiogroup" style="margin-bottom:12px">
        <label class="chk"><input type="radio" name="lstModo" value="adicionar" ${m.modo === 'adicionar' ? 'checked' : ''}><span><b>Adicionar à lista do dia</b> (${esc(m.abertas[m.abertas.length - 1].nome)}): ${pl(m.novos.length, 'guia nova', 'guias novas')}${m.itens.length - m.novos.length ? `, ${m.itens.length - m.novos.length} já estão na lista e ficam de fora` : ''}</span></label>
        <label class="chk"><input type="radio" name="lstModo" value="nova" ${m.modo === 'nova' ? 'checked' : ''}><span><b>Criar uma lista separada</b> (Lista ${this.listas.filter(l => l.dia === isoDia(new Date())).length + 1}) com as ${m.itens.length} guias deste e-mail</span></label></div>` : ''}
      <h3 style="margin-top:0">Dividir entre</h3>
      <div class="lst-ops">${cfg.operadores.map(o => `<label class="chk"><input type="checkbox" data-lstop="${esc(o.id)}" ${m.ops.includes(o.id) ? 'checked' : ''}><span>${htmlAvatar(o)} ${esc(o.nome)}${Presenca.lista.some(p => p.operadorId === o.id) ? ' <span class="tag ok">on-line</span>' : ''}</span></label>`).join('')}</div>
      <div class="tabela-scroll" style="margin-top:10px"><table class="t"><thead><tr><th>Operador</th><th>Guias</th><th>Beneficiários</th><th>Nomes</th></tr></thead><tbody>
      ${resumoDivisao(prev, m.ops).map(x => `<tr><td>${esc(nomeOp(x.op))}</td><td class="c num">${x.n}</td><td class="c num">${x.pac}</td><td>${x.n ? `${esc(x.de)} a ${esc(x.ate)}` : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="dica" style="margin-top:8px">Cada beneficiário fica inteiro com um operador (todos os serviços dele), em blocos por ordem alfabética, com quantidades parecidas. Depois dá para passar qualquer guia para outro operador.</p>`;
    abrirModal({ titulo: 'Lista do dia — ' + m.cl.nome, sub: `${esc(m.email.assunto || '')} · ${fmtDH(m.email.data)}`, icone: 'rows', tamanho: 'g', corpo,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="lstCriar" ${m.ops.length && base.length ? '' : 'disabled'}>${ic('check')}Dividir e começar</button>` });
    M = m;   // abrirModal limpa o estado do modal anterior
  },
  async criar() {
    const m = M; if (!m || m.tipo !== 'lstNova') return;
    const dia = isoDia(new Date()), op = operadorObj(), quando = agora();
    const base = (m.modo === 'adicionar' ? m.novos : m.itens).map((i, k) => ({ ...i, ord: k }));
    dividirLista(base, m.ops);
    const novos = base.map(i => ({ id: 'i' + hashTexto(m.email.messageId + '|' + i.ord + '|' + chaveItemLista(i)) + Math.random().toString(36).slice(2, 5), ord: i.ord, benef: i.benef, carteira: i.carteira, carteiraBruta: i.carteiraBruta, codigo: i.codigo, servico: i.servico, servicoBruto: i.servicoBruto, qtd: i.qtd, medico: i.medico, crm: i.crm, medicoBruto: i.medicoBruto, cid: i.cid, emissao: i.emissao, local: i.local, obs: i.obs, bloco: i.bloco, para: i.para, messageId: m.email.messageId, distribuidoEm: quando, distribuidoPor: op ? op.nome : '' }));
    let cab;
    if (m.modo === 'adicionar' && m.alvo) {
      cab = await this.ler(dia, m.alvo, 'lista.json');   // relê antes de juntar (outro operador pode ter mexido)
      const ja = new Set(cab.itens.map(chaveItemLista));
      cab.itens = [...cab.itens, ...novos.filter(i => !ja.has(chaveItemLista(i))).map((i, k) => ({ ...i, ord: cab.itens.length + k }))];
      cab.messageIds = unicos([...(cab.messageIds || []), m.email.messageId]); cab.operadores = unicos([...(cab.operadores || []), ...m.ops]); cab.atualizadoEm = quando;
    } else {
      const n = this.listas.filter(l => l.dia === dia).length + 1;
      cab = { v: 1, id: 'L' + Date.now().toString(36), dia, nome: 'Lista ' + n, clinicaId: m.cl.id || '', clinica: m.cl.nome, assunto: m.email.assunto || '', remetente: m.email.remetente.email || '', recebidoEm: m.email.data, messageIds: [m.email.messageId], operadores: m.ops, criadaEm: quando, criadaPor: op ? op.nome : '', itens: novos };
    }
    await this.gravar(dia, cab.id, 'lista.json', cab);
    fecharModal(true); this.dia = dia; this.sel = cab.id; this.sub = 'continuar'; aba = 'lista';
    await this.carregar(dia); render(); window.scrollTo(0, 0);
    toast(m.modo === 'adicionar' ? `${pl(novos.length, 'guia adicionada', 'guias adicionadas')} à ${cab.nome}.` : `${cab.nome} criada: ${pl(novos.length, 'guia', 'guias')} entre ${pl(m.ops.length, 'operador', 'operadores')}.`);
  },

  /* ---------- registrar, desfazer, transferir ---------- */
  async registrar(L, it, r) {
    const op = operadorObj(); if (!op) { toast('Escolha o operador no topo.', 'bad'); return false; }
    const { nome, d } = await this.meuArquivo(L, 'res-');
    d.itens[it.id] = { ...r, em: agora(), por: op.nome, porId: op.id };
    await this.gravar(L.dia, L.id, nome, d);
    it.r = r.st === 'pendente' ? null : d.itens[it.id];
    if (r.st === 'pendente') { try { await Reg.excluir('lst-' + it.id); } catch (e) { } }
    else { await Reg.salvar(this.registroDe(L, it)); this.salvarAuditoria(L, it).catch(() => { }); }
    delete this.rascunho[it.id];
    return true;
  },
  async transferir(L, it, para) {
    const op = operadorObj(); if (!op || !para || para === it.resp) return;
    const { nome, d } = await this.meuArquivo(L, 'transf-');
    const ant = d.itens[it.id];
    d.itens[it.id] = { para, de: it.resp, em: agora(), por: op.nome, hist: [...((ant && ant.hist) || []), { de: it.resp, para, em: agora(), por: op.nome }].slice(-10) };
    await this.gravar(L.dia, L.id, nome, d);
    it.resp = para; it.transf = d.itens[it.id];
  },
  registroDe(L, it) {
    const op = operadorObj(), r = it.r, gerada = r.st === 'gerada';
    return { id: 'lst-' + it.id, atendimentoId: L.id, messageId: it.messageId, lista: L.id, listaNome: `${L.clinica} · ${L.nome}`, dia: L.dia, operador: op.nome, operadorId: op.id,
      clinica: L.clinica, clinicaId: L.clinicaId, remetente: L.remetente, carteira: it.carteira, paciente: it.benef, pacienteIni: iniciais(it.benef),
      itens: [{ c: it.codigo, q: it.qtd, d: it.servico, dc: it.servico, aut: gerada }], guia: gerada ? r.guia : null, status: 'concluido',
      resultado: gerada ? { situacao: 'autorizada' } : { situacao: 'sem_guia', modelo: 'lista', motivoTxt: r.obs },
      abertoEm: it.distribuidoEm || r.em, concluidoEm: r.em, atualizadoEm: r.em, versao: VERSAO, origem: 'lista',
      ...(r.reaberta ? { reaberta: { em: r.em, por: r.por, antes: { guia: r.reaberta.guia || '', situacao: r.reaberta.st === 'gerada' ? 'autorizada' : 'sem_guia' } } } : {}) };
  },
  async salvarAuditoria(L, it) {
    const r = it.r, eventos = [{ em: it.distribuidoEm, op: it.distribuidoPor, tipo: 'regra', texto: `Lista ${L.nome} (${L.clinica}): distribuída para ${nomeOp(it.para)}` }];
    ((it.transf && it.transf.hist) || []).forEach(h => eventos.push({ em: h.em, op: h.por, tipo: 'regra', texto: `Passada de ${nomeOp(h.de)} para ${nomeOp(h.para)}` }));
    if (r.reaberta) eventos.push({ em: r.em, op: r.por, tipo: 'reaberta', texto: `Guia reaberta pelo Painel. Antes: ${r.reaberta.st === 'gerada' ? 'guia ' + r.reaberta.guia : 'sem guia (' + (r.reaberta.obs || '—') + ')'}, registrado por ${r.reaberta.por || '—'} em ${fmtDH(r.reaberta.em)}` });
    eventos.push({ em: r.em, op: r.por, tipo: 'numero', texto: r.st === 'gerada' ? `Guia ${r.guia} registrada por ${r.por}` : `Sem guia: ${r.obs} (registrado por ${r.por})` });
    const a = { id: 'lst-' + it.id, dia: L.dia, status: 'concluido', versao: VERSAO, salvoEm: agora(), operador: r.por, abertoEm: it.distribuidoEm,
      email: { remetente: L.remetente, assunto: L.assunto, recebidoEm: L.recebidoEm, texto: it.bloco }, clinica: L.clinica, paciente: it.benef, carteiraInformada: it.carteiraBruta, carteiraUsada: it.carteira,
      pedido: { medico: it.medico, crm: it.crm, cid: it.cid, emissao: it.emissao, local: it.local, itens: [{ codigo: it.codigo, qtd: it.qtd, desc: it.servico }], invalidos: [], soltos: [], regras: [] },
      editadoAMao: false, alertas: [], copiados: [], numero: r.st === 'gerada' ? r.guia : '', numeroOrigem: r.st === 'gerada' ? 'digitado' : '', eventos, prints: null, cega: null,
      resultado: { situacao: r.st === 'gerada' ? 'autorizada' : 'sem_guia', motivo: r.st === 'gerada' ? '' : r.obs, naoAutorizados: {}, obsAdicionais: it.obs || '', semGuia: r.st === 'gerada' ? '' : r.obs }, lista: { id: L.id, nome: L.nome } };
    if (Pasta.ok) { try { await Pasta.gravar(Aud.partes(L.dia), a.id + '.json', a); return; } catch (e) { } }
    try { await idbSet('aud:' + a.id, a); } catch (e) { }
  },
  /* Painel / histórico: reabre uma guia da lista para lançar (ou trocar) o número e autorizar */
  async reabrirDoRegistro(r) {
    if (!operadorObj()) { toast('Escolha o operador no topo da página.', 'bad'); return; }
    const L = await this.umaLista(r.dia, r.lista), it = L && L.itens.find(i => 'lst-' + i.id === r.id);
    if (!it) { toast('Não achei esta guia na lista do dia (a lista pode ter sido apagada). Use Corrigir guia.', 'bad'); return; }
    const a = it.r, q = it.qtd ?? 1, ja = this.jaAutorizada(it);
    const atual = !a ? 'Pendente' : a.st === 'gerada' ? `Guia <b class="num">${esc(a.guia)}</b>` : `Sem guia: ${esc(a.obs || '—')}`;
    abrirModal({ titulo: 'Reabrir guia da lista', sub: `${L.clinica} · ${L.nome} · ${diaBR(L.dia)}`, icone: 'undo', tamanho: 'p',
      corpo: `<dl class="kv"><dt>Beneficiário</dt><dd>${esc(it.benef)}</dd><dt>Carteira</dt><dd class="num">${esc(it.carteira || '—')}</dd>
        <dt>Serviço</dt><dd><span class="num">${esc(it.codigo)}</span> ${esc(it.servico || '')} × <b>${esc(q)}</b>${q > 1 ? ' <span class="tag warn">quantidade maior que 1</span>' : ''}</dd>
        <dt>Registrado</dt><dd>${atual}${a ? ` <span class="muted">— ${esc(a.por || '')}, ${fmtDH(a.em)}</span>` : ''}</dd></dl>
        ${ja ? `<div class="aviso" style="margin:8px 0">${ic('alert')}<div>Já há guia autorizada para esta carteira e este código: <b class="num">${esc(ja.guia)}</b> em ${fmtData(ja.concluidoEm)} (${esc(ja.operador || '')}).</div></div>` : ''}
        <label class="lbl" for="lstReGuia" style="margin-top:10px">Nº da guia</label><input type="text" id="lstReGuia" class="num" value="${esc(a && a.st === 'gerada' ? a.guia : '')}" placeholder="Ex.: T1234567" autocomplete="off" data-enter="lstReAutorizar" autofocus>
        <p class="dica" style="margin-top:8px">Autorizar registra a guia com este número em seu nome, com a situação <b>Autorizada</b>. Ela entra no e-mail de entrega da lista, e o histórico guarda o que estava registrado antes.</p>`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn line" data-act="lstReAutorizarEmail" title="Autoriza e abre o e-mail avisando a clínica que a guia foi ajustada">${ic('mail')}Autorizar e gerar e-mail de ajuste</button><button class="btn pri" data-act="lstReAutorizar">${ic('check')}Autorizar</button>` });
    M = { tipo: 'lstReabrir', L, it };   // depois de abrir (abrirModal limpa o estado)
  },
  /* guia já autorizada para a mesma carteira e código nos últimos 7 dias (fora desta lista) */
  jaAutorizada(it) {
    const c = normCart(it.carteira), lim = isoDia(addDias(new Date(), -7));
    return Reg.cache.filter(r => !r.tipo && r.status === 'concluido' && r.id !== 'lst-' + it.id && normCart(r.carteira || '') === c && (r.dia || '') >= lim && (r.itens || []).some(x => x.c === it.codigo && x.aut !== false) && r.guia)
      .sort((a, b) => ((a.concluidoEm || '') < (b.concluidoEm || '') ? 1 : -1))[0] || null;
  },

  /* ---------- e-mail de entrega ---------- */
  linhasEmail(L) { return [...L.itens].sort((a, b) => normNomeLista(a.benef).localeCompare(normNomeLista(b.benef)) || a.ord - b.ord); },
  htmlEmail(L) {
    const linhas = this.linhasEmail(L), ger = linhas.filter(i => i.r && i.r.st === 'gerada').length, sem = linhas.filter(i => i.r && i.r.st === 'semguia').length, pend = linhas.filter(i => !i.r).length;
    const intro = (this.introEdit[L.id] ?? `${saudacao()}!\n\nSeguem as autorizações da agenda de ${diaBR(L.dia)}: ${pl(ger, 'guia gerada', 'guias geradas')}${sem ? ` e ${sem} sem guia (motivo na tabela)` : ''}.`);
    const th = 'background:#2c4a70;color:#ffffff;text-align:left;padding:9px 12px;border:1px solid #2c4a70;font-weight:bold;font-size:13px';
    const td = 'padding:8px 12px;border:1px solid #d5dde8;font-size:13px;vertical-align:top';
    const corpo = linhas.map((i, k) => {
      const fundo = k % 2 ? '#ffffff' : '#f4f6f9';
      const guia = !i.r ? `<span style="color:#b91c1c;font-weight:bold">Pendente</span>` : i.r.st === 'gerada' ? `<b style="font-family:Consolas,monospace;font-size:14px;color:#1c2431">${esc(i.r.guia)}</b>` : `<span style="color:#b45309;font-weight:bold">${esc(i.r.obs)}</span>`;
      return `<tr style="background:${fundo}"><td style="${td};white-space:nowrap">${guia}</td><td style="${td}">${esc(i.benef)}</td><td style="${td};font-family:Consolas,monospace;white-space:nowrap">${esc(i.carteira || i.carteiraBruta)}</td><td style="${td}">${esc([i.codigo, i.servico].filter(Boolean).join(' - '))}${(i.qtd || 1) > 1 ? ` <span style="color:#b45309;font-weight:bold">(${i.qtd} sessões)</span>` : ''}</td></tr>`;
    }).join('');
    return { pend, html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c2431;line-height:1.5">
${intro.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:960px;margin:6px 0 14px">
<thead><tr><th style="${th}">Nº da Guia</th><th style="${th}">Beneficiário</th><th style="${th}">Carteira</th><th style="${th}">Serviço</th></tr></thead>
<tbody>${corpo}</tbody></table>
<p style="margin:0 0 4px;color:#566174;font-size:12px">${pl(linhas.length, 'linha', 'linhas')} · ${pl(ger, 'guia gerada', 'guias geradas')}${sem ? ` · ${sem} sem guia` : ''}</p>
<p style="margin:12px 0 0">Ficamos à disposição.<br>Atenciosamente,<br><b>Núcleo Gestão de Terapias · Promédica</b></p></div>` };
  },
  textoEmail(L) { return htmlPlano(this.htmlEmail(L).html.replace(/<\/td><td/g, '</td> | <td').replace(/<\/th><th/g, '</th> | <th').replace(/<tr/g, '\n<tr')); },
  async responderWebmail(id) {
    const L = this.listas.find(l => l.id === id); if (!L) return;
    const { html, pend } = this.htmlEmail(L);
    if (pend && !confirm(`Ainda há ${pl(pend, 'guia pendente', 'guias pendentes')}. Levar o e-mail assim mesmo?`)) return;
    enviarAoWebmail({ html, texto: this.textoEmail(L), quem: `${L.clinica} · ${L.nome}`, assunto: L.assunto || '' });
  },

  /* ---------- telas ---------- */
  async render(app) {
    if (!this.carregadoEm || Date.now() - new Date(this.carregadoEm) > 8000) { const gen = Redesenho.gen; if (!this.listas.length) app.innerHTML = htmlEsqueleto(6); await this.carregar(this.dia); if (gen !== Redesenho.gen) return; }   // outra tela foi aberta enquanto carregava
    const L = this.atual(), eu = operadorObj();
    const abas = [['continuar', 'filecheck', 'Continuar ' + this.nomeCurto(L)], ['acompanhar', 'activity', 'Acompanhar'], ['email', 'mail', 'E-mail de entrega']];
    const topo = `<div class="card lst-topo"><div class="linha-flex">
      <div><label class="lbl" for="lstDia">Dia</label><input type="date" id="lstDia" value="${this.dia}" style="width:auto"></div>
      ${this.listas.length ? `<div><label class="lbl" for="lstSel">Lista</label><select id="lstSel" style="width:auto">${this.listas.map(l => `<option value="${esc(l.id)}" ${l.id === this.sel ? 'selected' : ''}>${esc(l.clinica)} · ${esc(l.nome)} (${l.itens.filter(i => i.r).length}/${l.itens.length})${l.finalizadaEm ? ' · entregue' : ''}</option>`).join('')}</select></div>` : ''}
      <button class="btn line" data-act="lstAtualizar" style="align-self:flex-end">${ic('refresh', 'sm')}Atualizar</button>
      <span class="esp"></span><span class="dica" style="align-self:flex-end;margin:0">${Pasta.ok ? `Atualiza sozinho a cada 10 s · ${this.carregadoEm ? 'agora há pouco' : ''}` : 'Sem a pasta compartilhada: a lista fica só neste computador.'}</span></div>
      ${L ? `<div class="seg lst-subs" role="tablist" style="margin-top:10px">${abas.map(([k, i, t]) => `<button type="button" role="tab" aria-selected="${this.sub === k}" class="${this.sub === k ? 'on' : ''}" data-act="lstSub" data-v="${k}">${ic(i, 'sm')}${esc(t)}${k === 'continuar' && eu ? ` <span class="tag ${this.meus(L).filter(x => !x.r).length ? 'warn' : 'ok'}">${this.meus(L).filter(x => !x.r).length}</span>` : ''}</button>`).join('')}</div>` : ''}</div>`;
    if (!L) { app.innerHTML = topo + `<div class="vazio"><div class="ico">${ic('rows', 'xl')}</div><h2>Nenhuma lista neste dia</h2><p>Abra o e-mail da agenda da Erasmo Neto (pela extensão, pelo .eml ou colando o texto em Atendimento): ele vira uma lista dividida entre os operadores.</p><button class="btn pri" data-act="lstColar">${ic('clip')}Colar o texto da agenda</button></div>`; return; }
    app.innerHTML = topo + (this.sub === 'acompanhar' ? this.htmlAcompanhar(L) : this.sub === 'email' ? this.htmlEntrega(L) : this.htmlContinuar(L));
  },
  nomeCurto(L) { const n = (L && L.clinica) || (cfg.clinicas.find(c => c.lista) || {}).nome || 'Erasmo'; return /erasmo/i.test(n) ? 'Erasmo' : n.split(' ').slice(0, 2).join(' '); },
  htmlCompacto(L, it) {
    const r = it.r, q = it.qtd ?? 1;
    return `<div class="lst-item compacto ${r ? 'feito' : ''}" data-item="${esc(it.id)}"><b>${esc(it.benef)}</b><span class="num">${esc(it.codigo || '—')}</span><span class="muted">${esc(it.servico || '')}</span>${q > 1 ? `<span class="tag warn">×${q}</span>` : ''}${it.obs ? `<span class="tag info" title="${esc(it.obs)}">${ic('message', 'sm')}obs.</span>` : ''}
      ${r ? (r.st === 'gerada' ? `<span class="tag ok">${ic('check', 'sm')}${esc(r.guia)}</span>` : `<span class="tag warn">${esc(r.obs)}</span>`) : ''}<span class="esp"></span>
      ${r ? `<button class="btn sm ghost" data-act="lstDesfazer" data-item="${esc(it.id)}">${ic('undo', 'sm')}Desfazer</button>` : `<button class="btn sm line" data-act="lstFoco" data-item="${esc(it.id)}">${ic('right', 'sm')}Gerar esta</button>`}</div>`;
  },
  htmlItem(L, it, atual) {
    const r = it.r, eu = operadorObj(), ja = !r ? this.jaAutorizada(it) : null, q = it.qtd ?? 1;
    const irmaos = L.itens.filter(x => x !== it && !x.r && x.resp === it.resp && normNomeLista(x.benef) === normNomeLista(it.benef)).length;
    const cp = (v, rot, cls = '') => v ? `<button type="button" class="lst-cp ${cls}" data-act="lstCopiar" data-v="${esc(v)}" title="Copiar ${esc(rot)}"><small>${esc(rot)}</small><span>${esc(v)}</span>${ic('copy', 'sm')}</button>` : `<span class="lst-cp vazio"><small>${esc(rot)}</small><span>—</span></span>`;
    const situ = !r ? '<span class="tag">Pendente</span>' : r.st === 'gerada' ? `<span class="tag ok">${ic('check', 'sm')}Guia ${esc(r.guia)}</span>` : `<span class="tag warn">${ic('info', 'sm')}${esc(r.obs)}</span>`;
    return `<div class="lst-item ${atual ? 'atual' : ''} ${r ? 'feito' : ''}" data-item="${esc(it.id)}" id="lst-${esc(it.id)}">
      <div class="lst-cab"><b>${esc(it.benef)}</b>${situ}${irmaos ? `<span class="tag info">+${pl(irmaos, 'serviço', 'serviços')} deste beneficiário</span>` : ''}${r ? `<span class="dica" style="margin:0">por ${esc(r.por)} às ${fmtHora(r.em)}</span>` : ''}${it.duplicada ? `<span class="tag bad">Registrada duas vezes: ${esc(it.duplicada.join(' e '))}</span>` : ''}<span class="esp"></span>
        ${!r && L.itens.length ? `<label class="sr" for="lstPara-${esc(it.id)}">Passar para</label><select id="lstPara-${esc(it.id)}" class="lst-para" data-lstpara="${esc(it.id)}" title="Passar esta guia para outro operador"><option value="">Passar para…</option>${cfg.operadores.filter(o => o.id !== it.resp).map(o => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select>` : ''}
        ${r ? `<button class="btn sm ghost" data-act="lstDesfazer" data-item="${esc(it.id)}">${ic('undo', 'sm')}Desfazer</button>` : ''}</div>
      ${atual || !r ? `<div class="lst-campos">
        ${cp(it.benef, 'Beneficiário', 'largo')}${cp(it.carteira || it.carteiraBruta, 'Carteira', 'mono')}${cp(it.codigo, 'Serviço', 'mono')}
        <span class="lst-cp ${q > 1 ? 'qtd-alta' : ''}" ${q > 1 ? 'title="Quantidade maior que 1"' : ''}><small>Qtd.</small><span>${q > 1 ? '×' + q : q}</span>${q ? `<button type="button" class="lst-cpi" data-act="lstCopiar" data-v="${q}" aria-label="Copiar quantidade">${ic('copy', 'sm')}</button>` : ''}</span>
        ${cp(it.cid, 'CID', 'mono')}${cp(it.emissao, 'Emissão')}${cp(it.local, 'Local')}${cp(it.crm, 'CRM', 'mono')}${cp(it.medico, 'Médico', 'largo')}
        <span class="lst-desc">${esc(it.servico || '')}</span>
        ${it.obs ? `<div class="lst-obs">${ic('message', 'sm')}<b>Obs. da clínica:</b> ${esc(it.obs)}</div>` : ''}
        ${!it.codigo ? `<div class="lst-obs bad">${ic('alert', 'sm')}Sem código de serviço no e-mail: confira o texto (${esc(it.servicoBruto || 'vazio')}).</div>` : ''}
        ${ja ? `<div class="lst-obs warn">${ic('alert', 'sm')}Já autorizada para esta carteira e serviço: guia <b>${esc(ja.guia)}</b> em ${fmtDH(ja.concluidoEm)} por ${esc(ja.operador || '—')}. Confira antes de gerar de novo.</div>` : ''}
      </div>` : ''}
      ${!r ? `<div class="lst-acoes">
        <label class="sr" for="lstGuia-${esc(it.id)}">Nº da guia</label><input type="text" id="lstGuia-${esc(it.id)}" class="num lst-guia" data-lstguia="${esc(it.id)}" value="${esc(this.rascunho[it.id] || '')}" maxlength="10" placeholder="Nº da guia" autocomplete="off" ${atual ? 'autofocus' : ''}>
        <button class="btn pri" data-act="lstRegistrar" data-item="${esc(it.id)}">${ic('check', 'sm')}Registrar guia</button>
        <details class="menu-resp"><summary class="btn line">${ic('info', 'sm')}Sem guia ▾</summary><div class="menu-lista">${SEM_GUIA_LISTA.map(t => `<button class="btn ghost menu-op" data-act="lstSemGuia" data-item="${esc(it.id)}" data-v="${esc(t)}">${esc(t)}${/em$/.test(t) ? '…' : ''}</button>`).join('')}<button class="btn ghost menu-op" data-act="lstSemGuia" data-item="${esc(it.id)}" data-v="">Outro motivo…</button></div></details>
      </div>` : ''}
    </div>`;
  },
  htmlContinuar(L) {
    const eu = operadorObj(); if (!eu) return `<div class="aviso">${ic('user')}<div>Escolha seu nome em <b>Operador</b>, no topo.</div></div>`;
    const meus = this.linhasEmail({ itens: this.meus(L) }), pend = meus.filter(i => !i.r), feitos = meus.filter(i => i.r);
    const pc = meus.length ? Math.round(100 * feitos.length / meus.length) : 0;
    const atual = pend.find(i => i.id === this.foco) || pend[0];
    return `<div class="card"><div class="card-h"><h2>Minhas guias · ${esc(L.clinica)} · ${esc(L.nome)}</h2><span class="tag ${pend.length ? 'warn' : 'ok'}">${feitos.length} de ${meus.length}</span><span class="esp"></span>
        ${pend.length ? `<label class="sr" for="lstTodosPara">Passar todas as pendentes</label><select id="lstTodosPara" class="lst-todos" data-lsttodos="1" title="Passar todas as minhas pendentes para outro operador"><option value="">Passar todas as pendentes para…</option>${cfg.operadores.filter(o => o.id !== eu.id).map(o => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select>` : ''}</div>
      <div class="lst-barra"><i style="width:${pc}%"></i></div>
      ${!meus.length ? `<p class="muted">Nenhuma guia desta lista está com você. Veja em <b>Acompanhar</b>.</p>` : !pend.length ? `<div class="ultimo">${ic('check')}<div>Você terminou a sua parte. ${L.itens.some(i => !i.r) ? `Faltam ${pl(L.itens.filter(i => !i.r).length, 'guia', 'guias')} de outros operadores.` : 'A lista toda está pronta: veja o <b>E-mail de entrega</b>.'}</div></div>` : ''}
      <div class="lst-fila">${atual ? this.htmlItem(L, atual, true) : ''}${pend.length > 1 ? `<h3 style="margin:6px 0 0">Próximas (${pend.length - 1})</h3>` : ''}${pend.filter(i => i !== atual).map(i => this.htmlCompacto(L, i)).join('')}
      ${feitos.length ? `<details class="lst-feitos"><summary>${pl(feitos.length, 'guia registrada', 'guias registradas')} por você</summary>${feitos.map(i => this.htmlCompacto(L, i)).join('')}</details>` : ''}</div></div>`;
  },
  htmlAcompanhar(L) {
    const tot = L.itens.length, ger = L.itens.filter(i => i.r && i.r.st === 'gerada').length, sem = L.itens.filter(i => i.r && i.r.st === 'semguia').length, pend = tot - ger - sem;
    const ops = unicos([...(L.operadores || []), ...L.itens.map(i => i.resp)]).filter(Boolean);
    const f = this.filtro, q = norm(f.q || '');
    const lin = this.linhasEmail(L).filter(i => (!f.op || i.resp === f.op) && (!f.st || (f.st === 'pend' ? !i.r : i.r && i.r.st === f.st)) && (!q || norm([i.benef, i.carteira, i.codigo, i.r && i.r.guia].join(' ')).includes(q)));
    return `<div class="kpis"><div class="kpi"><b>${tot}</b><span>Guias na lista</span></div><div class="kpi ok"><b>${ger}</b><span>Geradas</span></div><div class="kpi warn"><b>${sem}</b><span>Sem guia (com motivo)</span></div><div class="kpi ${pend ? 'bad' : 'ok'}"><b>${pend}</b><span>Pendentes</span></div></div>
    <div class="card"><div class="card-h"><h2>Por operador</h2><span class="dica" style="margin:0">Lista criada por ${esc(L.criadaPor || '—')} às ${fmtHora(L.criadaEm)}${L.finalizadaEm ? ` · entregue por ${esc(L.finalizadaPor || '')} às ${fmtHora(L.finalizadaEm)}` : ''}</span></div>
      <div class="lst-opsprog">${ops.map(op => { const its = L.itens.filter(i => i.resp === op), fe = its.filter(i => i.r).length, at = (L.ativos.find(a => a.op === op) || {}).em, on = Presenca.lista.some(p => p.operadorId === op); const o = cfg.operadores.find(x => x.id === op);
        return `<div class="lst-opprog"><div class="linha-flex" style="gap:8px">${htmlAvatar(o)}<b>${esc(nomeOp(op))}</b>${on ? '<span class="tag ok">on-line</span>' : ''}<span class="esp"></span><span class="num">${fe}/${its.length}</span></div><div class="lst-barra"><i style="width:${its.length ? Math.round(100 * fe / its.length) : 0}%"></i></div><small class="dica">${at ? 'último registro às ' + fmtHora(at) : 'sem registros ainda'}</small></div>`; }).join('')}</div></div>
    <div class="card"><div class="card-h"><h2>Todas as guias (${lin.length}${lin.length !== tot ? ' de ' + tot : ''})</h2></div>
      <div class="filtros" style="margin-bottom:10px">
        <div><label class="lbl" for="lstQ">Buscar</label><input type="search" id="lstQ" data-lstf="q" value="${esc(f.q)}" placeholder="Nome, carteira, código ou guia"></div>
        <div><label class="lbl" for="lstFO">Operador</label><select id="lstFO" data-lstf="op"><option value="">Todos</option>${ops.map(o => `<option value="${esc(o)}" ${f.op === o ? 'selected' : ''}>${esc(nomeOp(o))}</option>`).join('')}</select></div>
        <div><label class="lbl" for="lstFS">Situação</label><select id="lstFS" data-lstf="st"><option value="">Todas</option><option value="pend" ${f.st === 'pend' ? 'selected' : ''}>Pendentes</option><option value="gerada" ${f.st === 'gerada' ? 'selected' : ''}>Geradas</option><option value="semguia" ${f.st === 'semguia' ? 'selected' : ''}>Sem guia</option></select></div></div>
      <div class="tabela-scroll" style="max-height:60vh"><table class="t"><thead><tr><th>Beneficiário</th><th>Carteira</th><th>Serviço</th><th>Qtd.</th><th>Operador</th><th>Situação</th><th>Passar para</th></tr></thead><tbody>
      ${lin.map(i => `<tr class="${!i.r ? '' : i.r.st === 'gerada' ? 'r-ok' : 'r-warn'}"><td>${esc(i.benef)}</td><td class="num">${esc(i.carteira || i.carteiraBruta)}</td><td><span class="num">${esc(i.codigo || '—')}</span> <span class="muted">${esc(i.servico || '')}</span></td><td class="c">${(i.qtd || 1) > 1 ? `<span class="tag warn">×${i.qtd}</span>` : i.qtd ?? '—'}</td>
        <td>${esc(nomeOp(i.resp))}${i.transf ? ` <span class="dica" title="Passada por ${esc(i.transf.por)} às ${fmtHora(i.transf.em)}">(de ${esc(nomeOp(i.transf.de))})</span>` : ''}</td>
        <td>${!i.r ? '<span class="tag">Pendente</span>' : i.r.st === 'gerada' ? `<b class="num">${esc(i.r.guia)}</b> <span class="dica">${esc(i.r.por)} ${fmtHora(i.r.em)}</span>` : `<span class="tag warn">${esc(i.r.obs)}</span> <span class="dica">${esc(i.r.por)}</span>`}${i.duplicada ? ' <span class="tag bad">duplicada</span>' : ''}</td>
        <td>${!i.r ? `<select data-lstpara="${esc(i.id)}" aria-label="Passar ${esc(i.benef)} para outro operador"><option value="">—</option>${cfg.operadores.filter(o => o.id !== i.resp).map(o => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nada com esses filtros.</td></tr>'}
      </tbody></table></div></div>`;
  },
  htmlEntrega(L) {
    const { html, pend } = this.htmlEmail(L);
    const intro = this.introEdit[L.id] ?? `${saudacao()}!\n\nSeguem as autorizações da agenda de ${diaBR(L.dia)}: ${pl(L.itens.filter(i => i.r && i.r.st === 'gerada').length, 'guia gerada', 'guias geradas')}${L.itens.some(i => i.r && i.r.st === 'semguia') ? ` e ${L.itens.filter(i => i.r && i.r.st === 'semguia').length} sem guia (motivo na tabela)` : ''}.`;
    return `<div class="card"><div class="card-h"><h2>E-mail de entrega · ${esc(L.clinica)} · ${esc(L.nome)}</h2>${pend ? `<span class="tag bad">${pl(pend, 'guia pendente', 'guias pendentes')}</span>` : `<span class="tag ok">${ic('check', 'sm')}Todas registradas</span>`}${L.finalizadaEm ? `<span class="tag ok">Entregue às ${fmtHora(L.finalizadaEm)}</span>` : ''}</div>
      ${pend ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>Ainda há ${pl(pend, 'guia pendente', 'guias pendentes')}: elas aparecem como “Pendente” na tabela. Veja quem está com elas em <b>Acompanhar</b>.</div></div>` : ''}
      <label class="lbl" for="lstIntro">Texto de abertura</label><textarea id="lstIntro" rows="3" data-lstintro="${esc(L.id)}">${esc(intro)}</textarea>
      <div class="acoes"><button class="btn pri" data-act="lstCopiarEmail" data-lista="${esc(L.id)}">${ic('copy')}Copiar com formatação</button><button class="btn line" data-act="lstCopiarTexto" data-lista="${esc(L.id)}">${ic('copy')}Copiar texto simples</button>${btnWebmail('lista').replace('data-fonte="lista"', `data-fonte="lista" data-lista="${esc(L.id)}"`)}
        <span class="esp"></span>${L.finalizadaEm ? '' : `<button class="btn line" data-act="lstEntregue" data-lista="${esc(L.id)}">${ic('check', 'sm')}Marcar lista como entregue</button>`}</div>
      <h3>Prévia</h3><div class="previa"><div class="previa-c lst-previa">${html}</div></div></div>`;
  }
};

/* ---------- ações ---------- */
Object.assign(acoes, {
  lstCriar() { return Lista.criar(); },
  lstSub(b) { Lista.sub = b.dataset.v; render(); },
  async lstAtualizar(b) { if (b) b.classList.add('carregando'); Lista.carregadoEm = null; await Lista.carregar(); render(); },
  async lstCopiar(b) { const v = b.dataset.v; if (await copiar(v)) { b.classList.add('copiado'); toast('Copiado: ' + v); } else toast('Não foi possível copiar.', 'bad'); },
  async lstRegistrar(b) {
    const L = Lista.atual(), it = L && L.itens.find(i => i.id === b.dataset.item); if (!it) return;
    const inp = $(`[data-lstguia="${CSS.escape(it.id)}"]`), v = String((inp && inp.value) || Lista.rascunho[it.id] || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[TS]\d{7,8}$/.test(v)) { toast('Informe o número da guia: T ou S + 7 ou 8 dígitos.', 'bad'); if (inp) inp.focus(); return; }
    const dup = L.itens.find(i => i !== it && i.r && i.r.st === 'gerada' && i.r.guia === v);
    if (dup && !confirm(`A guia ${v} já foi registrada para ${dup.benef}. Registrar de novo?`)) return;
    if (await Lista.registrar(L, it, { st: 'gerada', guia: v })) { Lista.foco = null; toast(`Guia ${v} registrada.`); render(); setTimeout(() => { const n = $('.lst-item.atual .lst-guia'); if (n) n.focus(); }, 30); }
  },
  async lstSemGuia(b) {
    const L = Lista.atual(), it = L && L.itens.find(i => i.id === b.dataset.item); if (!it) return;
    let obs = b.dataset.v;
    if (!obs || /em$/.test(obs)) {
      const extra = await confirmar({ titulo: 'Sem guia', texto: `<b>${esc(it.benef)}</b> · ${esc(it.codigo)} ${esc(it.servico)}`, ok: 'Registrar sem guia', risco: 'warn', icone: 'info', campo: { rot: obs ? obs + '… (data ou nº da guia)' : 'Motivo (vai para o e-mail de entrega)', ph: obs ? 'Ex.: 12/11 (T10055123)' : 'Ex.: beneficiário sem autorização para o local' } });
      if (extra == null) return; if (!extra && !obs) { toast('Escreva o motivo.', 'bad'); return; }
      obs = obs ? `${obs} ${extra}`.trim() : extra;
    }
    if (await Lista.registrar(L, it, { st: 'semguia', obs })) { Lista.foco = null; toast('Registrado sem guia: ' + obs); render(); }
  },
  lstReAutorizarEmail() { return acoes.lstReAutorizar(null, true); },
  async lstReAutorizar(b, gerarEmail) {
    const m = M; if (!m || m.tipo !== 'lstReabrir') return;
    const inp = $('#lstReGuia'), v = String((inp && inp.value) || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[TS]\d{7,8}$/.test(v)) { toast('Informe o número da guia: T ou S + 7 ou 8 dígitos.', 'bad'); if (inp) inp.focus(); return; }
    const dup = m.L.itens.find(i => i !== m.it && i.r && i.r.st === 'gerada' && i.r.guia === v);
    if (dup && !confirm(`A guia ${v} já foi registrada para ${dup.benef} nesta lista. Registrar de novo?`)) return;
    const a = m.it.r, antes = a ? { st: a.st, guia: a.guia || '', obs: a.obs || '', por: a.por || '', em: a.em || '' } : { st: 'pendente', guia: '', obs: '', por: '', em: '' };
    if (!(await Lista.registrar(m.L, m.it, { st: 'gerada', guia: v, reaberta: antes }))) return;
    fecharModal(true); Lista.carregadoEm = null; render(); toast(`Guia ${v} autorizada (${m.it.benef.split(' ')[0]}).`);
    if (gerarEmail === true) abrirEmailAjuste('lst-' + m.it.id);
  },
  async lstDesfazer(b) {
    const L = Lista.atual(), it = L && L.itens.find(i => i.id === b.dataset.item); if (!it || !it.r) return;
    if (!(await confirmar({ titulo: 'Desfazer registro', texto: `Voltar <b>${esc(it.benef)}</b> (${esc(it.codigo)}) para pendente? ${it.r.st === 'gerada' ? `A guia ${esc(it.r.guia)} sai do registro.` : ''}`, ok: 'Desfazer', risco: 'warn', icone: 'undo' }))) return;
    await Lista.registrar(L, it, { st: 'pendente' }); it.r = null; render();
  },
  async lstEntregue(b) { const L = Lista.listas.find(l => l.id === b.dataset.lista); if (!L) return; const cab = await Lista.ler(L.dia, L.id, 'lista.json'); cab.finalizadaEm = agora(); cab.finalizadaPor = operador(); await Lista.gravar(L.dia, L.id, 'lista.json', cab); await Lista.carregar(); render(); toast('Lista marcada como entregue.'); },
  async lstCopiarEmail(b) { const L = Lista.listas.find(l => l.id === b.dataset.lista); if (!L) return; const { html, pend } = Lista.htmlEmail(L); if (pend && !confirm(`Ainda há ${pl(pend, 'guia pendente', 'guias pendentes')}. Copiar assim mesmo?`)) return; const r = await copiarRico(html, Lista.textoEmail(L)); toast(r === 'rico' ? 'E-mail copiado com a tabela formatada.' : r ? 'O navegador só permitiu texto simples.' : 'Não foi possível copiar.', r === 'rico' ? '' : 'bad'); },
  async lstCopiarTexto(b) { const L = Lista.listas.find(l => l.id === b.dataset.lista); if (!L) return; toast((await copiar(Lista.textoEmail(L))) ? 'Texto simples copiado.' : 'Não foi possível copiar.'); },
  lstColar() { aba = 'atend'; render(); setTimeout(() => { const d = $('#app details'); if (d) { d.open = true; const t = $('#coladoTxt'); if (t) t.focus(); } toast('Cole o texto da agenda e o e-mail do remetente da clínica (ex.: …@clinicaserasmoneto.com.br).'); }, 50); },
  irLista() { aba = 'lista'; Lista.sub = 'continuar'; render(); window.scrollTo(0, 0); },
  lstFoco(b) { Lista.foco = b.dataset.item; render(); setTimeout(() => { const n = $('.lst-item.atual'); if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = n.querySelector('.lst-guia'); if (i) i.focus({ preventScroll: true }); } }, 40); }
});
/* campos da tela da lista: rascunho do nº da guia, Enter registra, filtros, passar para, dia e lista */
document.addEventListener('input', e => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.lstguia) Lista.rascunho[t.dataset.lstguia] = t.value;
  if (t.dataset.lstintro) Lista.introEdit[t.dataset.lstintro] = t.value;
  if (t.dataset.lstf === 'q') { Lista.filtro.q = t.value; clearTimeout(Lista.tq); Lista.tq = setTimeout(render, 250); }
});
document.addEventListener('keydown', e => { const t = e.target; if (e.key === 'Enter' && t && t.dataset && t.dataset.lstguia) { e.preventDefault(); acoes.lstRegistrar({ dataset: { item: t.dataset.lstguia } }); } });
document.addEventListener('change', async e => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.lstop != null && M && M.tipo === 'lstNova') { M.ops = $$('[data-lstop]').filter(x => x.checked).map(x => x.dataset.lstop); Lista.modalNova(); return; }
  if (t.name === 'lstModo' && M && M.tipo === 'lstNova') { M.modo = t.value; Lista.modalNova(); return; }
  if (t.dataset.lstf) { Lista.filtro[t.dataset.lstf] = t.value; render(); return; }
  if (t.id === 'lstDia') { Lista.dia = t.value || isoDia(new Date()); Lista.sel = null; Lista.carregadoEm = null; await Lista.carregar(); render(); return; }
  if (t.id === 'lstSel') { Lista.sel = t.value; render(); return; }
  if (t.dataset.lstintro) { Lista.introEdit[t.dataset.lstintro] = t.value; render(); return; }
  const L = Lista.atual();
  if (t.dataset.lstpara && t.value && L) { const it = L.itens.find(i => i.id === t.dataset.lstpara); if (it) { await Lista.transferir(L, it, t.value); toast(`${it.benef.split(' ')[0]} (${it.codigo}) passada para ${nomeOp(t.value)}.`); render(); } return; }
  if (t.dataset.lsttodos && t.value && L) {
    const eu = operadorObj(), pend = Lista.meus(L).filter(i => !i.r);
    if (!(await confirmar({ titulo: 'Passar minhas pendentes', texto: `Passar ${pl(pend.length, 'guia pendente', 'guias pendentes')} para <b>${esc(nomeOp(t.value))}</b>?`, ok: 'Passar', risco: 'warn', icone: 'right' }))) { t.value = ''; return; }
    for (const it of pend) await Lista.transferir(L, it, t.value);
    toast(`${pl(pend.length, 'guia passada', 'guias passadas')} para ${nomeOp(t.value)}.`); render(); return;
  }
});
/* tempo real: a tela da lista se atualiza a cada 10 s (sem atrapalhar quem está digitando); o contador do topo, a cada 30 s */
setInterval(async () => {
  if (document.hidden || aba !== 'lista' || M) return;
  const ae = document.activeElement; if (ae && ae.matches && ae.matches('#app input, #app textarea, #app select')) return;
  if ($('#app details.menu-resp[open]')) return;
  await Lista.carregar(); render();
}, 10000);
setInterval(async () => { if (document.hidden || aba === 'lista' || !operadorObj() || Lista.dia !== isoDia(new Date())) return; const antes = Lista.pendentesMeus(); await Lista.carregar(isoDia(new Date())).catch(() => { }); if (Lista.pendentesMeus() !== antes) renderTopo(); }, 30000);
