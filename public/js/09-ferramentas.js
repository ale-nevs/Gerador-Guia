'use strict';
/* ====================================================================
   Configurações › Testar leitura: lê prints e e-mails sem abrir atendimento, o operador corrige o que saiu errado
   e baixa um registro (.json) para enviar ao suporte ajustar os leitores. Nada é salvo na pasta nem no navegador.
   ==================================================================== */
const TESTE = { prints: [], emails: [], lendo: '', recortes: true, imagem: false, texto: true, anonimo: false };
const ROT_EMAIL_T = { beneficiario: 'Beneficiário', carteira: 'Carteira', medico: 'Médico', crm: 'CRM', cid: 'CID', emissao: 'Data do pedido', local: 'Local do pedido', itens: 'Serviços (código x qtd, um por linha)' };
const normT = v => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const normItensT = v => String(v || '').split('\n').map(l => l.replace(/\s+/g, '').toUpperCase().replace(/[×*]/g, 'X')).filter(Boolean).join('|');
const certoT = c => c.k === 'itens' ? normItensT(c.lido) === normItensT(c.correto) : normT(c.lido) === normT(c.correto);

async function testarPrints(files) {
  for (const f of files) {
    TESTE.lendo = 'Lendo ' + (f.name || 'print colado') + '…'; render();
    const t0 = performance.now(); let r;
    try { r = await lerPrintTela(f, m => { TESTE.lendo = m; }, sistemaPrint()); } catch (e) { r = { erro: 'Falha na leitura: ' + (e.message || e) }; }
    const img = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(''); fr.readAsDataURL(f); });
    const t = { id: uid(), nome: f.name && f.name !== 'image.png' ? f.name : 'print ' + (TESTE.prints.length + 1), ms: Math.round(performance.now() - t0), r, img, obs: '', faltando: '', campos: [], itens: [] };
    if (r.campos) t.campos = Object.entries(r.campos).map(([k, c]) => ({ k, rot: ROT_PRINT[k] || k, lido: c.valor, correto: c.valor, bruto: c.bruto, conf: Math.round(c.conf), incerto: !!c.incerto, var: c.var || [], crop: r.crops[k] }));
    if (r.itens) t.itens = r.itens.map(it => ({ n: it.n, codLido: it.codigo, cod: it.codigo, qtdLida: it.qtd ?? '', qtd: it.qtd ?? '', st: it.st, incerto: !!it.incerto, varCod: it.varCod || [], varQtd: it.varQtd || [], crop: it.img }));
    TESTE.prints.unshift(t);
  }
  TESTE.lendo = ''; render();
}
/* clínica do e-mail para o teste: a versão em edição nas Configurações (rascunho), para testar regras antes de salvar */
function clinicaDoTeste(email) {
  const a = acharClinica(email); if (!a) return null;
  return (cfgEdit && cfgEdit.clinicas.find(c => c.id === a.cl.id)) || a.cl;
}
async function testarEmails(lista, substituir) {
  for (const { nome, email: original } of lista) {
    const email = clonar(original), cl = clinicaDoTeste(email);
    const lp = pedidosDoEmail(email, cl);
    const blocos = lp.blocos.map((b, i) => {
      const p = b.pedido, em = p.emissao;
      const lidos = { beneficiario: p.beneficiario, carteira: p.carteira || p.carteiraBruta, medico: p.medico.nome, crm: p.medico.crm, cid: p.cid,
        emissao: em.estado === 'valida' ? fmtData(em.data) : em.estado === 'sem_data' ? 'SEM DATA' : (em.bruto || ''), local: p.local,
        itens: p.itens.map(it => `${it.codigo} x ${it.qtd ?? '?'}`).join('\n') };
      return { n: i + 1, campos: Object.entries(lidos).map(([k, v]) => ({ k, rot: ROT_EMAIL_T[k], lido: v || '', correto: v || '' })), soltos: p.soltos || [], invalidos: p.invalidos || [], regras: p.regras || [] };
    });
    const t = { id: uid(), nome, email: original, clinica: cl ? cl.nome : '', blocos, obs: '' };
    const i = substituir ? TESTE.emails.findIndex(x => x.id === substituir) : -1;
    if (i >= 0) {   // "Ler de novo": mantém as correções que o operador já digitou
      const ant = TESTE.emails[i]; t.id = ant.id; t.obs = ant.obs;
      t.blocos.forEach(b => { const ab = ant.blocos.find(x => x.n === b.n); if (ab) b.campos.forEach(c => { const ac = ab.campos.find(x => x.k === c.k); if (ac && ac.correto !== ac.lido) c.correto = ac.correto; }); });
      TESTE.emails[i] = t;
    } else TESTE.emails.unshift(t);
  }
  render();
}

function htmlTesteCampo(tipo, tid, c, extra = '') {
  const ok = certoT(c), area = c.k === 'itens';
  return `<tr class="${ok ? '' : 'tst-errado'}" data-linha="${tipo}:${tid}:${c.k}">
    <td class="pri">${esc(c.rot)}</td>${extra}
    <td class="num">${area ? esc(c.lido).replace(/\n/g, '<br>') || '<span class="muted">—</span>' : esc(c.lido) || '<span class="muted">(vazio)</span>'}</td>
    <td>${area ? `<textarea rows="${Math.max(2, c.correto.split('\n').length)}" class="num" data-teste="${tipo}:${tid}:${c.k}">${esc(c.correto)}</textarea>` : `<input type="text" class="num" data-teste="${tipo}:${tid}:${c.k}" value="${esc(c.correto)}">`}</td>
    <td class="c tst-st">${ok ? `<span class="tag ok">${ic('check', 'sm')}Certo</span>` : `<span class="tag bad">${ic('x', 'sm')}Errado</span>`}</td></tr>`;
}
function htmlTestePrint(t) {
  const r = t.r;
  const cab = `<div class="card-h"><h2>${ic('eye')} ${esc(t.nome)}</h2><span class="tag">${r.erro ? 'não lido' : r.tipo === 'guia' ? 'Dados da Guia' : 'Procedimentos'}</span>${r.layout ? `<span class="tag">layout ${esc(r.layout)}</span>` : ''}<span class="muted" style="font-size:var(--fs-xs)">${t.ms} ms</span><span class="esp"></span><button class="btn sm line" data-act="tstRemover" data-tipo="p" data-id="${t.id}">${ic('trash', 'sm')}Remover teste</button></div>`;
  if (r.erro) return `<div class="card">${cab}<div class="al bloqueio"><span>${ic('ban', 'sm')}</span><div class="tx">${esc(r.erro)}</div></div>
    <label class="lbl" style="margin-top:10px">O que deveria acontecer?</label><textarea rows="2" data-teste="p:${t.id}:obs" placeholder="Ex.: é a aba Dados da Guia, tela em tela cheia, zoom 125%">${esc(t.obs)}</textarea></div>`;
  let corpo = '';
  if (r.tipo === 'guia') corpo = `<div class="tabela-scroll"><table class="t"><thead><tr><th>Campo</th><th>Imagem</th><th>Lido</th><th>Correto (corrija se estiver errado)</th><th></th></tr></thead><tbody>
    ${t.campos.map(c => htmlTesteCampo('p', t.id, c, `<td>${c.crop ? `<img class="mini tst-img" src="${c.crop}" alt="">` : ''}</td>`)).join('')}</tbody></table></div>`;
  else corpo = `<div class="tabela-scroll"><table class="t"><thead><tr><th>Item</th><th>Imagem</th><th>Código lido</th><th>Código correto</th><th>Qtd. lida</th><th>Qtd. correta</th><th>ST</th><th></th></tr></thead><tbody>
    ${t.itens.map((it, i) => { const ok = it.codLido === String(it.cod).trim() && String(it.qtdLida) === String(it.qtd).trim(); return `<tr class="${ok ? '' : 'tst-errado'}" data-linha="i:${t.id}:${i}"><td class="c">${it.n ?? '—'}</td><td><img class="mini tst-img" src="${it.crop}" alt=""></td>
      <td class="num">${esc(it.codLido)}</td><td><input type="text" class="num" data-teste="i:${t.id}:${i}:cod" value="${esc(it.cod)}" style="width:110px"></td>
      <td class="num c">${esc(it.qtdLida)}</td><td><input type="text" class="num" data-teste="i:${t.id}:${i}:qtd" value="${esc(it.qtd)}" style="width:60px"></td>
      <td class="c">${esc(ST_ROT[it.st] || it.st || '—')}</td><td class="c tst-st">${ok ? `<span class="tag ok">${ic('check', 'sm')}Certo</span>` : `<span class="tag bad">${ic('x', 'sm')}Errado</span>`}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nenhum item lido.</td></tr>'}</tbody></table></div>
    <label class="lbl" style="margin-top:10px">Itens que estão no print e não foram lidos (código x qtd, um por linha)</label><textarea rows="2" class="num" data-teste="p:${t.id}:faltando" placeholder="50000470 x 4">${esc(t.faltando)}</textarea>`;
  return `<div class="card">${cab}${corpo}<label class="lbl" style="margin-top:10px">Observação (opcional)</label><textarea rows="2" data-teste="p:${t.id}:obs" placeholder="Ex.: print com zoom 125%, colado pelo WhatsApp">${esc(t.obs)}</textarea></div>`;
}
function htmlTesteEmail(t) {
  const e = t.email;
  return `<div class="card"><div class="card-h"><h2>${ic('mail')} ${esc(t.nome)}</h2><span class="tag">${pl(t.blocos.length, 'pedido lido', 'pedidos lidos')}</span>${t.clinica ? `<span class="tag">${ic('building', 'sm')}${esc(t.clinica)}</span>` : '<span class="tag warn">remetente fora do cadastro (sem regras)</span>'}<span class="esp"></span><button class="btn sm line" data-act="tstReler" data-id="${t.id}" title="Lê de novo com as regras atuais da clínica (inclusive as ainda não salvas)">${ic('refresh', 'sm')}Ler de novo</button><button class="btn sm line" data-act="tstRemover" data-tipo="e" data-id="${t.id}">${ic('trash', 'sm')}Remover teste</button></div>
    <details style="margin-bottom:10px"><summary class="muted">Ver o texto que o leitor recebeu</summary><pre class="original">${esc(e.textoPrincipal)}</pre></details>
    ${t.blocos.map(b => `<h3 style="margin:10px 0 6px">Pedido ${b.n}${t.blocos.length > 1 ? ` de ${t.blocos.length}` : ''}</h3>
      <div class="tabela-scroll"><table class="t"><thead><tr><th>Campo</th><th>Lido</th><th>Correto (corrija se estiver errado)</th><th></th></tr></thead><tbody>
      ${b.campos.map(c => htmlTesteCampo('e', t.id + ':' + b.n, c)).join('')}</tbody></table></div>
      ${b.regras && b.regras.length ? `<div class="al info" style="margin-top:6px"><span>${ic('info', 'sm')}</span><div class="tx"><b>Regras da clínica aplicadas:</b><br>${b.regras.map(esc).join('<br>')}</div></div>` : ''}
      ${b.soltos.length || b.invalidos.length ? `<p class="dica" style="margin-top:6px">Números que não viraram item: ${esc([...b.soltos, ...b.invalidos].join(', '))}</p>` : ''}`).join('')}
    <label class="lbl" style="margin-top:10px">Observação (ex.: faltou um beneficiário inteiro, juntou dois pedidos)</label><textarea rows="2" data-teste="e:${t.id}:obs">${esc(t.obs)}</textarea></div>`;
}
function cfgTestes() {
  const nP = TESTE.prints.length, nE = TESTE.emails.length;
  const erros = contarErrosTeste();
  return `<div class="card">${cabSecao('Testar leitura')}
    <p class="dica">Teste aqui os leitores de print e de e-mail sem abrir um atendimento. Na coluna <b>Correto</b>, corrija o que saiu errado. Depois baixe o registro e envie ao suporte: com vários registros juntos dá para ajustar os leitores. Nada daqui é salvo na pasta nem fica no navegador ao recarregar a página.</p>
    <div class="aviso" style="margin-top:8px">${ic('shield')}<div>O registro pode conter dados de beneficiários (nome, carteira, recortes da imagem, texto do e-mail). Envie só por canal interno e apague depois.</div></div>
    <div class="form-grid" style="margin-top:12px">
      <label class="chk"><input type="checkbox" data-tst-op="recortes" ${TESTE.recortes ? 'checked' : ''}>Incluir recortes da imagem dos campos errados</label>
      <label class="chk"><input type="checkbox" data-tst-op="imagem" ${TESTE.imagem ? 'checked' : ''}>Incluir o print inteiro (ajuda muito quando a tela não é reconhecida)</label>
      <label class="chk"><input type="checkbox" data-tst-op="texto" ${TESTE.texto ? 'checked' : ''}>Incluir o texto do e-mail (necessário para ajustar o leitor de e-mail)</label>
      <label class="chk"><input type="checkbox" data-tst-op="anonimo" ${TESTE.anonimo ? 'checked' : ''}>Trocar nomes e carteiras do e-mail por letras e números fictícios</label>
    </div>
    <div class="acoes"><span class="tag ${erros ? 'bad' : ''}">${pl(nP, 'print', 'prints')} · ${pl(nE, 'e-mail', 'e-mails')} · ${pl(erros, 'campo marcado', 'campos marcados')} como errado(s)</span><span class="esp"></span>
      <button class="btn" data-act="tstCopiar" ${nP + nE ? '' : 'disabled'}>${ic('copy')}Copiar resumo</button>
      <button class="btn pri" data-act="tstBaixar" ${nP + nE ? '' : 'disabled'}>${ic('download')}Baixar registro (.json)</button>
      <button class="btn line" data-act="tstLimpar" ${nP + nE ? '' : 'disabled'}>${ic('x')}Limpar testes</button></div></div>

  <div class="card"><div class="card-h"><h2>Prints do sistema</h2><span class="esp"></span>${TESTE.lendo ? `<span class="tag info">${ic('refresh', 'sm')}${esc(TESTE.lendo)}</span>` : ''}</div>
    ${htmlSeletorSistema()}
    <div class="zona-prints" id="zonaTstPrint" data-act="tstEscolherPrint">${ic('upload', 'lg')}<div><b>Cole o print (Ctrl+V)</b>, arraste aqui ou clique para escolher. Aceita vários de uma vez.</div></div>
    <div class="acoes"><button class="btn pri" data-act="tstColarPrint">${ic('clip')}Colar print</button><button class="btn" data-act="tstEscolherPrint">${ic('upload')}Escolher arquivos</button></div>
    <input type="file" id="tstPrintArq" accept="image/*" multiple hidden></div>
  ${TESTE.prints.map(htmlTestePrint).join('')}

  <div class="card"><div class="card-h"><h2>E-mails</h2></div>
    <div class="zona-prints" id="zonaTstEml" data-act="tstEscolherEml">${ic('upload', 'lg')}<div><b>Arraste o .eml aqui</b> ou clique para escolher. Aceita vários de uma vez.</div></div>
    <details style="margin-top:10px"><summary class="muted">Ou cole o texto do e-mail</summary>
      <div class="form-grid" style="margin-top:8px"><div style="grid-column:1/-1"><label class="lbl" for="tstTexto">Corpo do e-mail</label><textarea id="tstTexto" rows="7"></textarea></div></div>
      <div class="acoes"><button class="btn pri" data-act="tstLerTexto">${ic('search')}Ler texto</button></div></details>
    <input type="file" id="tstEmlArq" accept=".eml,message/rfc822" multiple hidden></div>
  ${TESTE.emails.map(htmlTesteEmail).join('')}`;
}

/* ---------- registro (.json) e resumo ---------- */
function contarErrosTeste() {
  let n = 0;
  TESTE.prints.forEach(t => { n += t.campos.filter(c => !certoT(c)).length + t.itens.filter(it => it.codLido !== String(it.cod).trim() || String(it.qtdLida) !== String(it.qtd).trim()).length + (t.faltando.trim() ? t.faltando.trim().split('\n').length : 0) + (t.r.erro ? 1 : 0); });
  TESTE.emails.forEach(t => t.blocos.forEach(b => { n += b.campos.filter(c => !certoT(c)).length; }));
  return n;
}
function anonimizador() {
  const nomes = new Set(), carts = new Set();
  TESTE.emails.forEach(t => t.blocos.forEach(b => b.campos.forEach(c => {
    if (c.k === 'beneficiario' || c.k === 'medico') [c.lido, c.correto].forEach(v => String(v).split(/\s+/).forEach(w => { if (w.replace(/[^\p{L}]/gu, '').length >= 3) nomes.add(w.replace(/[^\p{L}]/gu, '')); }));
    if (c.k === 'carteira') [c.lido, c.correto].forEach(v => { if (v) carts.add(String(v)); });
  })));
  const listaN = [...nomes].sort((a, b) => b.length - a.length);
  return s => {
    let x = String(s ?? '');
    [...carts].sort((a, b) => b.length - a.length).forEach(c => { x = x.split(c).join(c.replace(/\d/g, '9')); const so = c.replace(/\D/g, ''); if (so.length >= 10) x = x.split(so).join(so.replace(/\d/g, '9')); });
    x = x.replace(new RegExp(CART_RE.source, 'g'), m => m.replace(/\d/g, '9'));   // qualquer carteira escrita no texto, com ou sem separadores
    listaN.forEach(w => { x = x.replace(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'), m => 'X'.repeat(m.length)); });
    return x;
  };
}
function montarRegistroTeste() {
  const an = TESTE.anonimo ? anonimizador() : (x => x);
  const prints = TESTE.prints.map(t => {
    const o = { arquivo: t.nome, aba: t.r.tipo || null, layout: t.r.layout || null, ms: t.ms, erro: t.r.erro || null, diag: t.r.diag || null, observacao: t.obs || '' };
    if (t.campos.length) o.campos = t.campos.map(c => { const ok = certoT(c), x = { campo: c.k, lido: c.lido, correto: c.correto, ok, bruto: c.bruto, conf: c.conf, incerto: c.incerto };
      if (!ok) { x.variantes = c.var; if (TESTE.recortes) x.recorte = c.crop; } return x; });
    if (t.r.tipo === 'proc') {
      o.itens = t.itens.map(it => { const ok = it.codLido === String(it.cod).trim() && String(it.qtdLida) === String(it.qtd).trim(), x = { item: it.n, codigoLido: it.codLido, codigoCorreto: String(it.cod).trim(), qtdLida: it.qtdLida, qtdCorreta: String(it.qtd).trim(), status: it.st, ok, incerto: it.incerto };
        if (!ok) { x.variantesCodigo = it.varCod; x.variantesQtd = it.varQtd; if (TESTE.recortes) x.recorte = it.crop; } return x; });
      o.itensNaoLidos = t.faltando.split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (TESTE.imagem) o.imagem = t.img;
    return o;
  });
  const emails = TESTE.emails.map(t => ({
    arquivo: t.nome, origem: t.email.origem, clinica: t.clinica || '', remetente: t.email.remetente && t.email.remetente.email ? t.email.remetente.email.replace(/^[^@]*/, '*') : '', assunto: an(t.email.assunto || ''),
    texto: TESTE.texto ? an(t.email.textoPrincipal) : undefined, textoCompleto: TESTE.texto && t.email.cortado ? an(t.email.textoCompleto) : undefined,
    pedidos: t.blocos.map(b => ({ n: b.n, campos: b.campos.map(c => ({ campo: c.k, lido: an(c.lido), correto: an(c.correto), ok: certoT(c) })), naoViraramItem: [...b.soltos, ...b.invalidos], regrasAplicadas: b.regras || [] })),
    observacao: an(t.obs || '')
  }));
  return { tipo: 'conferidor-teste-leitura', versao: VERSAO, gerado: agora(), navegador: navigator.userAgent, camposErrados: contarErrosTeste(), prints, emails };
}
function resumoTeste() {
  const L = [`Teste de leitura — Conferidor v${VERSAO} — ${fmtDH(agora())}`];
  TESTE.prints.forEach(t => {
    const r = t.r; L.push(`\nPRINT ${t.nome} (${r.erro ? 'não lido' : (r.tipo === 'guia' ? 'Dados da Guia' : 'Procedimentos') + ', layout ' + r.layout})`);
    if (r.erro) L.push(`  erro: ${r.erro}`);
    t.campos.filter(c => !certoT(c)).forEach(c => L.push(`  ${c.rot}: lido "${c.lido}" | correto "${c.correto}"`));
    t.itens.forEach(it => { if (it.codLido !== String(it.cod).trim() || String(it.qtdLida) !== String(it.qtd).trim()) L.push(`  item ${it.n ?? '?'}: lido ${it.codLido} x ${it.qtdLida} | correto ${String(it.cod).trim()} x ${String(it.qtd).trim()}`); });
    if (t.faltando.trim()) L.push(`  itens não lidos: ${t.faltando.trim().split('\n').join('; ')}`);
    if (t.obs) L.push(`  obs: ${t.obs}`);
    if (!r.erro && L[L.length - 1].startsWith('\nPRINT')) L.push('  tudo certo');
  });
  const an = TESTE.anonimo ? anonimizador() : (x => x);
  TESTE.emails.forEach(t => {
    L.push(`\nE-MAIL ${t.nome} (${pl(t.blocos.length, 'pedido', 'pedidos')})`); let algum = false;
    t.blocos.forEach(b => b.campos.filter(c => !certoT(c)).forEach(c => { algum = true; L.push(`  pedido ${b.n} · ${c.rot}: lido "${an(c.lido).replace(/\n/g, '; ')}" | correto "${an(c.correto).replace(/\n/g, '; ')}"`); }));
    if (t.obs) { algum = true; L.push(`  obs: ${an(t.obs)}`); }
    if (!algum) L.push('  tudo certo');
  });
  return L.join('\n');
}

/* ---------- ações e eventos ---------- */
Object.assign(acoes, {
  sistemaPrint(b) { LS.set('printSistema', b.dataset.v); render(); },
  tstEscolherPrint() { $('#tstPrintArq').click(); },
  tstEscolherEml() { $('#tstEmlArq').click(); },
  async tstColarPrint() {
    try {
      const itens = await navigator.clipboard.read(), fs = [];
      for (const it of itens) for (const t of it.types) if (/^image\//.test(t)) fs.push(new File([await it.getType(t)], 'print-colado.png', { type: t }));
      if (!fs.length) { toast('Não há imagem na área de transferência. Copie o print e clique em Colar (ou use Ctrl+V).', 'bad'); return; }
      testarPrints(fs);
    } catch (e) { toast('O navegador não liberou a área de transferência. Use Ctrl+V com a página selecionada.', 'bad'); }
  },
  tstLerTexto() { const t = $('#tstTexto').value; if (!t.trim()) { toast('Cole o texto do e-mail.', 'bad'); return; } testarEmails([{ nome: 'texto colado ' + (TESTE.emails.length + 1), email: emailDeTexto(t, '') }]); },
  tstReler(b) { const t = TESTE.emails.find(x => x.id === b.dataset.id); if (t) testarEmails([{ nome: t.nome, email: t.email }], t.id); },
  tstRemover(b) { const k = b.dataset.tipo === 'p' ? 'prints' : 'emails'; TESTE[k] = TESTE[k].filter(t => t.id !== b.dataset.id); render(); },
  async tstLimpar() { if (!(await confirmar({ titulo: 'Limpar testes', texto: 'Apagar todos os testes de leitura desta tela?', ok: 'Limpar testes', icone: 'trash' }))) return; TESTE.prints = []; TESTE.emails = []; render(); },
  async tstCopiar() { try { await navigator.clipboard.writeText(resumoTeste()); toast('Resumo copiado.'); } catch (e) { baixar('teste-leitura.txt', resumoTeste()); } },
  tstBaixar() { baixar(nomeArquivo('teste_leitura', isoDia(new Date()), 'json').replace('.json', `_${new Date().toTimeString().slice(0, 5).replace(':', 'h')}.json`), JSON.stringify(montarRegistroTeste(), null, 1), 'application/json'); toast('Registro baixado. Envie o arquivo ao suporte.'); }
});
function emTesteCfg() { return aba === 'config' && cfgSecao === 'testes'; }
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'tstPrintArq' && t.files.length) { const fs = [...t.files]; t.value = ''; testarPrints(fs); }
  else if (t.id === 'tstEmlArq' && t.files.length) {
    const fs = [...t.files]; t.value = ''; const lista = [];
    for (const f of fs) { try { lista.push({ nome: f.name, email: lerEml(await f.arrayBuffer()) }); } catch (er) { toast('Não consegui ler ' + f.name, 'bad'); } }
    testarEmails(lista);
  } else if (t.dataset && t.dataset.tstOp) { TESTE[t.dataset.tstOp] = t.checked; }
});
document.addEventListener('input', e => {
  const t = e.target, k = t.dataset && t.dataset.teste; if (!k) return;
  const p = k.split(':');
  if (p[0] === 'p') { const x = TESTE.prints.find(y => y.id === p[1]); if (!x) return; if (p[2] === 'obs' || p[2] === 'faltando') x[p[2]] = t.value; else { const c = x.campos.find(y => y.k === p[2]); if (c) c.correto = t.value; } }
  else if (p[0] === 'i') { const x = TESTE.prints.find(y => y.id === p[1]); if (!x) return; x.itens[+p[2]][p[3]] = t.value; }
  else if (p[0] === 'e') { const x = TESTE.emails.find(y => y.id === p[1]); if (!x) return; if (p[2] === 'obs') x.obs = t.value; else { const b = x.blocos.find(y => y.n === +p[2]); const c = b && b.campos.find(y => y.k === p[3]); if (c) c.correto = t.value; } }
  // atualiza só a marcação Certo/Errado da linha, sem redesenhar (para não perder o cursor)
  const tr = t.closest('tr[data-linha]'); if (!tr) return;
  let ok = true;
  if (p[0] === 'i') { const it = TESTE.prints.find(y => y.id === p[1]).itens[+p[2]]; ok = it.codLido === String(it.cod).trim() && String(it.qtdLida) === String(it.qtd).trim(); }
  else { const lin = tr.dataset.linha.split(':'), cid = lin[lin.length - 1]; let c;
    if (p[0] === 'p') c = TESTE.prints.find(y => y.id === p[1]).campos.find(y => y.k === cid);
    else c = TESTE.emails.find(y => y.id === p[1]).blocos.find(y => y.n === +p[2]).campos.find(y => y.k === cid);
    ok = c ? certoT(c) : true; }
  tr.classList.toggle('tst-errado', !ok);
  const st = tr.querySelector('.tst-st'); if (st) st.innerHTML = ok ? `<span class="tag ok">${ic('check', 'sm')}Certo</span>` : `<span class="tag bad">${ic('x', 'sm')}Errado</span>`;
});
document.addEventListener('paste', e => {
  if (!emTesteCfg()) return;
  const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return;
  e.preventDefault(); testarPrints(fs);
});
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#zonaTstPrint, #zonaTstEml'); if (z) { e.preventDefault(); z.classList.add('sobre'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#zonaTstPrint, #zonaTstEml'); if (z) z.classList.remove('sobre'); });
document.addEventListener('drop', async e => {
  const z = e.target.closest && e.target.closest('#zonaTstPrint, #zonaTstEml'); if (!z) return;
  e.preventDefault(); z.classList.remove('sobre');
  if (z.id === 'zonaTstPrint') { const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (fs.length) testarPrints(fs); return; }
  const lista = []; for (const f of [...e.dataTransfer.files].filter(f => /\.eml$/i.test(f.name) || f.type === 'message/rfc822')) { try { lista.push({ nome: f.name, email: lerEml(await f.arrayBuffer()) }); } catch (er) { toast('Não consegui ler ' + f.name, 'bad'); } }
  if (lista.length) testarEmails(lista);
});

/* ---------- Importar lista de clínicas (colada de planilha): nome, cidade e e-mails; junta com o cadastro sem duplicar ---------- */
const CIDADES_BA = ['Salvador', 'Lauro De Freitas', 'Camaçari', 'Simões Filho', 'Candeias', 'Dias D\'Ávila', 'Feira De Santana', 'Alagoinhas', 'Barreiras', 'Jequié', 'Vitória Da Conquista', 'Paulo Afonso', 'Santo Antônio De Jesus', 'Entre Rios', 'Ilhéus', 'Itabuna', 'Juazeiro', 'Teixeira De Freitas', 'Porto Seguro', 'Eunápolis', 'Jacobina', 'Irecê', 'Guanambi', 'Brumado', 'Valença', 'Cruz Das Almas', 'Senhor Do Bonfim', 'Itapetinga', 'Serrinha', 'Conceição Do Coité', 'Santo Amaro', 'Catu', 'Pojuca', 'Mata De São João', 'Esplanada', 'Ribeira Do Pombal', 'Euclides Da Cunha', 'Bom Jesus Da Lapa', 'Luís Eduardo Magalhães', 'Santa Maria Da Vitória', 'Ipirá', 'Amargosa', 'Itaberaba', 'Seabra'];
const tokClinica = s => semAcento(String(s || '')).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 1 && !['CLINICA', 'CLINICAS', 'ESPACO', 'LTDA', 'ME', 'EIRELI', 'DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'CENTRO'].includes(w));
function mesmaClinica(a, b) {
  const x = tokClinica(a), y = tokClinica(b); if (!x.length || !y.length) return false;
  const [m, M] = x.length <= y.length ? [x, y] : [y, x];
  return m.every(w => M.includes(w)) && m.join('').length >= 3;
}
function lerListaClinicas(texto) {
  const linhas = [];
  String(texto || '').split('\n').forEach(l => {
    const emails = unicos((l.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(e => e.toLowerCase().replace(/\.$/, '')));
    let antes = l.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '\t').replace(/;/g, '\t');
    antes = antes.replace(/^\s*\d{1,3}\s*[.)\-–\t ]\s*/, '');   // número da linha
    let cols = antes.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
    if (!cols.length || /^prestadores?$/i.test(cols[0]) || (!emails.length && cols.length < 2)) return;   // cabeçalho ou linha vazia
    let nome = cols[0], cidade = cols[1] || '';
    if (cols.length === 1) {   // sem tabulação: a cidade é o fim da linha, se for uma cidade conhecida
      const n = semAcento(nome).toUpperCase(), c = [...CIDADES_BA].sort((a, b) => b.length - a.length).find(c => n.endsWith(' ' + semAcento(c).toUpperCase()));
      if (c) { cidade = nome.slice(nome.length - c.length).trim(); nome = nome.slice(0, nome.length - c.length).trim(); }
    }
    nome = nome.replace(/[*]+/g, '').replace(/\s+/g, ' ').replace(/[\s\-–—]+$/, '').trim();
    cidade = cidade.replace(/\s+/g, ' ').trim();
    const ok = CIDADES_BA.find(c => semAcento(c).toLowerCase() === semAcento(cidade).toLowerCase());   // grafia padrão (Jequie → Jequié)
    if (ok) cidade = ok;
    if (nome) linhas.push({ nome, cidade, emails });
  });
  return linhas;
}
/* plano: o que cada linha faz no cadastro (sem alterar nada ainda) */
function planoImportClinicas(texto, base) {
  const donoEmail = {}; base.forEach((c, i) => c.emails.forEach(e => { donoEmail[e] = i; }));
  return lerListaClinicas(texto).map(r => {
    let alvo = base.findIndex(c => r.emails.some(e => c.emails.includes(e)));
    if (alvo < 0) alvo = base.findIndex(c => mesmaClinica(c.nome, r.nome));
    const conflito = r.emails.filter(e => donoEmail[e] != null && donoEmail[e] !== alvo);
    const novos = r.emails.filter(e => !conflito.includes(e) && !(alvo >= 0 && base[alvo].emails.includes(e)));
    const cidadeNova = alvo >= 0 ? (!base[alvo].cidade && r.cidade ? r.cidade : '') : r.cidade;
    const acao = alvo < 0 ? 'nova' : (novos.length || cidadeNova ? 'atualizar' : 'igual');
    return { ...r, alvo, acao, novos, conflito, cidadeNova, nomeAtual: alvo >= 0 ? base[alvo].nome : '' };
  });
}
function htmlPrevImport(plano) {
  if (!plano.length) return '<p class="muted">Nenhuma clínica reconhecida no texto.</p>';
  const n = k => plano.filter(p => p.acao === k).length;
  return `<p style="margin:10px 0 6px"><span class="tag ok">${pl(n('nova'), 'nova', 'novas')}</span> <span class="tag info">${n('atualizar')} a atualizar</span> <span class="tag">${n('igual') === 1 ? '1 já cadastrada' : n('igual') + ' já cadastradas'}, sem mudança</span></p>
  <div class="tabela-scroll" style="max-height:42vh"><table class="t"><thead><tr><th>Ação</th><th>Clínica</th><th>Cidade</th><th>E-mails</th></tr></thead><tbody>
  ${plano.map(p => `<tr><td>${p.acao === 'nova' ? '<span class="tag ok">Nova</span>' : p.acao === 'atualizar' ? '<span class="tag info">Atualizar</span>' : '<span class="tag">Sem mudança</span>'}</td>
    <td class="pri">${esc(p.nome)}${p.nomeAtual && p.nomeAtual !== p.nome ? `<br><span class="muted" style="font-weight:400">no cadastro: ${esc(p.nomeAtual)}</span>` : ''}</td>
    <td>${esc(p.cidade || '—')}${p.alvo >= 0 && !p.cidadeNova && p.cidade ? '<br><span class="muted">mantém a do cadastro</span>' : ''}</td>
    <td class="num">${p.novos.map(e => `<div>+ ${esc(e)}</div>`).join('')}${p.conflito.map(e => `<div style="color:var(--bad-fg)">${esc(e)} (já é de outra clínica: ignorado)</div>`).join('')}${!p.novos.length && !p.conflito.length ? '<span class="muted">nenhum novo</span>' : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
Object.assign(acoes, {
  clImportar() {
    M = { tipo: 'climp' };
    abrirModal({ titulo: 'Importar lista de clínicas', sub: 'Cole a tabela da planilha: nome, cidade e e-mails', icone: 'upload', tamanho: 'g',
      corpo: `<textarea id="clImpTxt" rows="8" placeholder="1&#9;CLÍNICA EXEMPLO&#9;Salvador&#9;contato@exemplo.com.br;&#9;financeiro@exemplo.com.br" aria-label="Lista de clínicas"></textarea>
        <p class="dica" style="margin-top:8px">Uma clínica por linha, como vem da planilha (o número da linha e o cabeçalho são ignorados). Clínica já cadastrada (pelo e-mail ou pelo nome) ganha só os e-mails que faltam e a cidade, se estiver vazia; nada é apagado. Nada é gravado até clicar em “Salvar configurações”.</p>
        <div id="clImpPrev"></div>`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn" data-act="clImportarPrev">${ic('eye')}Pré-visualizar</button><button class="btn pri" data-act="clImportarOk">${ic('check')}Importar para o cadastro</button>` });
  },
  clImportarPrev() { $('#clImpPrev').innerHTML = htmlPrevImport(planoImportClinicas($('#clImpTxt').value, cfgEdit.clinicas)); },
  clImportarOk() {
    const plano = planoImportClinicas($('#clImpTxt').value, cfgEdit.clinicas);
    if (!plano.length) { toast('Nenhuma clínica reconhecida no texto.', 'bad'); return; }
    let nov = 0, atu = 0;
    plano.forEach(p => {
      if (p.acao === 'nova') { cfgEdit.clinicas.push({ id: slug(p.nome) + '-' + Date.now().toString(36).slice(-4) + nov, nome: p.nome, cidade: p.cidade, executante: '', emails: p.novos, apelidos: '', codigos: {}, leitura: normLeitura(), _lista: [] }); nov++; }
      else if (p.acao === 'atualizar') { const c = cfgEdit.clinicas[p.alvo]; c.emails = unicos([...c.emails, ...p.novos]); if (p.cidadeNova) c.cidade = p.cidadeNova; atu++; }
    });
    fecharModal(true); if (nov || atu) marcarSujo(); render();
    toast(`${pl(nov, 'clínica nova', 'clínicas novas')}, ${pl(atu, 'atualizada', 'atualizadas')}. Confira e clique em Salvar configurações.`);
  }
});

/* ====================================================================
   Histórico detalhado de cada guia (auditoria): prints enviados, o que foi lido, ignorado, copiado e respondido.
   Fica na pasta compartilhada em auditoria/AAAA-MM/<id da guia>.json (sem pasta: só neste navegador).
   ==================================================================== */
const ROT_COPIA = { executante: 'Credenciado executante', medico_nome: 'Nome do médico', medico_crm: 'CRM', local: 'Local do pedido', data: 'Data do pedido', carteira: 'Carteira', benef: 'Beneficiário', cid: 'CID' };
/* print reduzido para guardar (JPEG, no máximo 1600 px de largura) */
async function jpegDoPrint(file) {
  try {
    const cv = await abrirImagem(file), e = Math.min(1, 1600 / cv.width);
    const c = document.createElement('canvas'); c.width = Math.round(cv.width * e); c.height = Math.round(cv.height * e);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  } catch (e) { return ''; }
}
const Aud = {
  partes: dia => ['auditoria', String(dia || isoDia(new Date())).slice(0, 7)],
  montar(g, status) {
    const p = g.pedido, cl = clinicaDe(S), op = operadorObj(), mem = PRINTS_MEM.get(g.id), av = mem ? avaliarPrints(g) : null, guardar = cfg.preferencias.guardarPrints !== false;
    const st = situacaoGuia(g), em = p.emissao;
    return {
      id: g.id, dia: S.dia, status, versao: VERSAO, salvoEm: agora(), operador: op ? op.nome : '', abertoEm: g.abertoEm,
      atendimentoId: S.atendId, idxGuia: g.idx, totalGuias: S.guias.length,
      email: { remetente: S.email.remetente.email, assunto: S.email.assunto, recebidoEm: S.email.data, texto: (S.email.textoPrincipal || '').slice(0, 20000) },
      clinica: cl ? cl.nome : '', paciente: p.beneficiario || '', carteiraInformada: p.carteiraBruta || '', carteiraUsada: g.carteiraUsada || '',
      pedido: { medico: p.medico.nome || '', crm: p.medico.crm || '', cid: p.cid || '', emissao: em.estado === 'valida' ? fmtData(em.data) : (em.estado === 'sem_data' ? 'SEM DATA' : (em.bruto || '')), local: p.local || '',
        itens: p.itens.map(i => ({ codigo: i.codigo, qtd: i.qtd, desc: i.desc || '', origemQtd: i.origemQtd || '' })), invalidos: p.invalidos || [], soltos: p.soltos || [], regras: p.regras || [] },
      editadoAMao: !!g.itensEditados,
      alertas: st.A.map(a => ({ tipo: a.tipo, modo: a.modo, texto: a.texto, conferido: !!(g.conf && g.conf[a.key]) })),
      copiados: Object.entries(g.copiados || {}).map(([k, v]) => ({ campo: k.startsWith('c:') ? 'Código ' + k.slice(2) : k.startsWith('q:') ? 'Quantidade de ' + k.slice(2) : (ROT_COPIA[k] || k), valor: v })),
      numero: g.numero || '', numeroOrigem: g.numeroOrigem || (g.numero ? 'digitado' : ''), eventos: g.eventos || [],
      prints: av ? {
        sistema: mem.sistema || '', ok: av.ok, avisos: av.avisos,
        checks: av.checks.map(c => ({ campo: c.rot, pedido: c.ped, lido: c.lido, resultado: c.sit, nota: c.nota || '', ignorado: c.ign ? { como: c.ign.leitura ? 'leitura' : c.ign.t, obs: c.ign.linha, incluida: c.ign.on !== false, motivo: c.ign.motivo || null } : null, recorte: guardar ? c.crop || '' : '' })),
        itens: av.linhas.map(l => ({ codigo: l.codigo, qtdPedido: l.qPed, qtdSistema: l.qSis, status: l.stSis || '', resultado: l.sit, nota: l.nota || '', ignorado: l.ign ? { como: l.ign.leitura ? 'leitura' : l.ign.t, obs: l.ign.linha, incluida: l.ign.on !== false, motivo: l.ign.motivo || null } : null, recorte: guardar ? l.img || '' : '' })),
        imagens: guardar ? (mem.imagens || []).map(x => ({ tipo: x.tipo, nome: x.nome, em: x.em, img: x.img })) : []
      } : (g.prints ? { resumo: g.prints } : null),
      cega: g.cega && g.cega.historico && g.cega.historico.length ? { ok: g.cega.ok, via: g.cega.via || 'cega', tentativas: g.cega.tentativas, historico: g.cega.historico } : null,
      resultado: { situacao: g.resultado.situacao, motivo: [motivoNome(g.resultado.motivoId), g.resultado.motivoTxt].filter(Boolean).join(' — '), naoAutorizados: g.resultado.naoAut, obsAdicionais: g.resultado.obsAdicionais || '', semGuia: g.semGuia ? nomeModelo(g.semGuia) : '' }
    };
  },
  async salvar(g, status) {
    let a; try { a = this.montar(g, status); } catch (e) { console.error(e); return; }
    if (Pasta.ok) { try { await Pasta.gravar(this.partes(a.dia), a.id + '.json', a); return; } catch (e) { } }
    try { await idbSet('aud:' + a.id, a); } catch (e) { }
  },
  async ler(r) {
    if (Pasta.ok) { const d = await Pasta.ler(this.partes(r.dia), r.id + '.json'); if (d) return d; }
    try { return (await idbGet('aud:' + r.id)) || null; } catch (e) { return null; }
  }
};
const SIT_PRINT = { ok: ['ok', 'Confere'], warn: ['warn', 'Conferir'], bad: ['bad', 'Diverge'], info: ['', 'Sem base'], ign: ['obs', 'Ignorado'] };
function htmlHistoricoGuia(r, a) {
  const linha = (t, v) => v ? `<dt>${t}</dt><dd>${v}</dd>` : '';
  const tagSit = s => { const [c, t] = SIT_PRINT[s] || ['', s || '—']; return `<span class="tag ${c}">${esc(t)}</span>`; };
  const ign = x => x ? `<div class="dica" style="margin:4px 0 0">${x.como === 'leitura' ? 'Erro de leitura do print' : x.como === 'menor' ? 'Autorizado a menor' : 'Ignorado'}${x.motivo ? ` · motivo: ${esc(x.motivo.texto)}${x.motivo.detalhe ? ' — ' + esc(x.motivo.detalhe) : ''}` : ''}${x.obs && x.como !== 'leitura' ? ` · observação ${x.incluida ? 'incluída' : 'não incluída'}: “${esc(x.obs)}”` : ''}</div>` : '';
  const P = a && a.prints;
  return `<dl class="email-meta">
      ${linha('Paciente', esc((a && a.paciente) || r.paciente || r.pacienteIni || '—'))}
      ${linha('Carteira', `<span class="num">${esc((a && a.carteiraUsada) || r.carteira || '—')}</span>${a && a.carteiraInformada && normCart(a.carteiraInformada) !== a.carteiraUsada ? ` <span class="muted">(no e-mail: ${esc(a.carteiraInformada)})</span>` : ''}`)}
      ${linha('Nº da guia', r.guia ? `<b class="num">${esc(r.guia)}</b>${a && a.numeroOrigem ? ` <span class="muted">(${a.numeroOrigem === 'print' ? 'lido do print' : 'digitado'})</span>` : ''}` : '—')}
      ${linha('Clínica', esc(r.clinica || r.remetente || '—'))}
      ${linha('Operador', esc(r.operador || '—'))}
      ${linha('Situação', tagStatus(r.status) + ' ' + tagResultado(resultadoDe(r)))}
      ${linha('Aberto / concluído', `${fmtDH(r.abertoEm)}${r.concluidoEm ? ' → ' + fmtDH(r.concluidoEm) : ''}${r.duracaoSeg ? ` <span class="muted">(${Math.round(r.duracaoSeg / 60)} min)</span>` : ''}`)}
    </dl>
    ${!a ? `<div class="aviso" style="margin-top:12px">${ic('info')}<div>Esta guia é anterior ao histórico detalhado (ou foi gravada sem a pasta compartilhada em outro computador). Abaixo, só o que está no registro.</div></div>` : ''}
    <h3 style="margin-top:16px">Pedido lido do e-mail${a && a.editadoAMao ? ' <span class="tag warn">corrigido à mão</span>' : ''}</h3>
    ${a ? `<dl class="email-meta">${linha('Médico', esc([a.pedido.medico, a.pedido.crm && 'CRM ' + a.pedido.crm].filter(Boolean).join(' · ') || '—'))}${linha('CID', esc(a.pedido.cid || '—'))}${linha('Data do pedido', esc(a.pedido.emissao || '—'))}${linha('Local', esc(a.pedido.local || '—'))}</dl>` : ''}
    <div class="tabela-scroll"><table class="t"><thead><tr><th>Código</th><th>Qtd.</th><th>Descrição</th></tr></thead><tbody>
      ${(a ? a.pedido.itens.map(i => [i.codigo, i.qtd, i.desc]) : (r.itens || []).map(i => [i.c, i.q, i.dc || i.d])).map(([c, q, d]) => `<tr><td class="num">${esc(c)}</td><td class="num c">${q ?? '?'}</td><td>${esc(d || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sem itens.</td></tr>'}
    </tbody></table></div>
    ${a && (a.pedido.invalidos.length || a.pedido.soltos.length) ? `<p class="dica" style="margin-top:6px">Números que não viraram item: ${esc([...a.pedido.invalidos, ...a.pedido.soltos].join(', '))}</p>` : ''}
    ${a && a.pedido.regras.length ? `<p class="dica">Regras da clínica aplicadas: ${esc(a.pedido.regras.join(' / '))}</p>` : ''}
    ${a && a.email.texto ? `<details style="margin-top:8px"><summary class="muted">E-mail recebido (${esc(a.email.remetente || '')} · ${esc(a.email.assunto || '')})</summary><pre class="original">${esc(a.email.texto)}</pre></details>` : ''}
    <h3 style="margin-top:16px">Conferência pelos prints</h3>
    ${P && P.checks ? `<p class="dica">${P.sistema ? esc(SISTEMAS_PRINT[P.sistema] || P.sistema) + ' · ' : ''}${P.ok ? 'conferido' : 'com pendências'}</p>
      <div class="tabela-scroll"><table class="t prints-t"><thead><tr><th>Campo</th><th>Pedido</th><th>Lido no print</th><th>Imagem</th><th>Resultado</th></tr></thead><tbody>
      ${P.checks.map(c => `<tr><td>${esc(c.campo)}</td><td class="num">${esc(c.pedido)}</td><td class="num"><b>${esc(c.lido || '—')}</b></td><td>${c.recorte ? `<img class="mini" src="${c.recorte}" alt="">` : ''}</td><td>${tagSit(c.resultado)}${c.nota && !c.ignorado ? `<div class="dica">${esc(c.nota)}</div>` : ''}${ign(c.ignorado)}</td></tr>`).join('')}
      ${P.itens.map(l => `<tr><td>Item ${esc(l.codigo)}</td><td class="num">${l.qtdPedido ?? '—'}</td><td class="num"><b>${l.qtdSistema ?? '—'}</b>${l.status ? ` <span class="muted">${esc(ST_ROT[l.status] || l.status)}</span>` : ''}</td><td>${l.recorte ? `<img class="mini" src="${l.recorte}" alt="">` : ''}</td><td>${tagSit(l.resultado)}${l.nota && !l.ignorado ? `<div class="dica">${esc(l.nota)}</div>` : ''}${ign(l.ignorado)}</td></tr>`).join('')}
      </tbody></table></div>
      ${P.imagens && P.imagens.length ? `<h3 style="margin-top:12px">Prints enviados (${P.imagens.length})</h3>${a.printsApagadosEm ? `<p class="dica">As imagens foram apagadas em ${fmtData(a.printsApagadosEm)} pelo prazo de guarda; o texto lido continua aqui.</p>` : ''}<div class="prints-hist">${P.imagens.filter(x => x.img).map(x => `<figure><figcaption>${esc(x.tipo === 'guia' ? 'Dados da Guia' : x.tipo === 'proc' ? 'Procedimentos' : 'Print')} · ${fmtHora(x.em)}</figcaption><a href="${x.img}" target="_blank" rel="noopener" title="Abrir em tamanho real"><img src="${x.img}" alt="Print enviado"></a></figure>`).join('')}</div>` : '<p class="dica">Os prints não foram guardados (opção desligada em Preferências).</p>'}`
      : (r.conferencia && r.conferencia.prints ? `<p class="dica">${r.conferencia.prints.ok ? 'Conferido pelos prints' : 'Prints com divergência'} em ${fmtDH(r.conferencia.prints.em)}</p>${(r.conferencia.prints.divergencias || []).map(d => `<div class="dica">• ${esc(d)}</div>`).join('')}` : a && a.cega ? `<p class="dica">Conferência manual (cega): ${a.cega.ok ? 'concluída' : 'não concluída'}, ${pl(a.cega.tentativas, 'tentativa', 'tentativas')}.</p>` : '<p class="dica">Sem conferência pelos prints.</p>')}
    ${a && a.eventos && a.eventos.length ? `<h3 style="margin-top:16px">Linha do tempo (${pl(a.eventos.filter(e => EV_CORRECAO.includes(e.tipo)).length, 'correção', 'correções')} e aceites)</h3><div class="linha-tempo">${a.eventos.map(e => `<div class="ev ${EV_CORRECAO.includes(e.tipo) ? 'corr' : ''}"><span class="num">${fmtHora(e.em)}</span><b>${esc(EV_ROT[e.tipo] || e.tipo)}</b><span>${esc(e.texto)}${e.op ? ` <span class="muted">· ${esc(e.op)}</span>` : ''}</span></div>`).join('')}</div>` : ''}
    ${a && a.copiados.length ? `<h3 style="margin-top:16px">Copiado para o sistema</h3><div class="tabela-scroll"><table class="t"><thead><tr><th>Campo</th><th>Valor copiado</th></tr></thead><tbody>${a.copiados.map(c => `<tr><td>${esc(c.campo)}</td><td class="num">${esc(c.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3 style="margin-top:16px">Alertas</h3>
    ${(a ? a.alertas : [...(r.bloqueios || []).map(t => ({ modo: 'bloqueio', texto: t })), ...(r.alertas || []).map(x => ({ modo: x.m, texto: x.t, conferido: x.c }))]).map(x => `<div class="dica">• <b>${esc(TAG_MODO[x.modo] ? TAG_MODO[x.modo][2] : x.modo)}:</b> ${esc(x.texto)}${x.conferido ? ' <span class="tag ok">conferido</span>' : ''}</div>`).join('') || '<p class="dica">Nenhum alerta.</p>'}
    ${a && (a.resultado.obsAdicionais || a.resultado.motivo || a.resultado.semGuia) ? `<h3 style="margin-top:16px">Resposta</h3><dl class="email-meta">${linha('Sem guia', esc(a.resultado.semGuia))}${linha('Motivo', esc(a.resultado.motivo))}${linha('Observações adicionais', `<span style="white-space:pre-wrap">${esc(a.resultado.obsAdicionais)}</span>`)}</dl>` : ''}`;
}
/* ---------- Relatar problema: junta leitura dos prints, imagens, correções e histórico num arquivo ---------- */
function montarRelato({ g, r, a, nota, imagens }) {
  const mem = g ? PRINTS_MEM.get(g.id) : null;
  let guia = a || null; if (!guia && g) { try { guia = Aud.montar(g, g.status); } catch (er) { guia = null; } }
  guia = guia ? JSON.parse(JSON.stringify(guia)) : null;
  if (guia && !imagens) semImagens(guia);
  const campo = c => ({ valor: c.valor, incerto: !!c.incerto, origem: c.origem || '', variantes: c.var || null, ...(imagens && c.crop ? { recorte: c.crop } : {}) });
  return {
    tipo: 'relato-conferidor', versaoApp: VERSAO, em: agora(), operador: operador(), navegador: navigator.userAgent, tela: `${screen.width}×${screen.height} (zoom ${Math.round(devicePixelRatio * 100)}%)`,
    oQueAconteceu: nota, registro: r ? { id: r.id, guia: r.guia, dia: r.dia, clinica: r.clinica, status: r.status } : null,
    sistemaDosPrints: mem ? mem.sistema : null,
    leituras: mem ? mem.leituras.map(l => ({ aba: l.tipo, layout: l.layout || null, diag: l.diag || null,
      campos: l.campos ? Object.fromEntries(Object.entries(l.campos).map(([k, c]) => [k, campo(c || {})])) : null,
      itens: l.itens ? l.itens.map(i => ({ codigo: i.codigo, qtd: i.qtd, status: i.st || '', variantesCodigo: i.varCod || null, variantesQtd: i.varQtd || null, ...(imagens && i.img ? { recorte: i.img } : {}) })) : null })) : [],
    historico: guia
  };
}
function abrirRelato(alvo) {
  M = { tipo: 'relato', alvo };
  abrirModal({ titulo: 'Relatar problema', sub: 'Gera um arquivo para enviar ao suporte do Conferidor', icone: 'help', tamanho: 'p',
    corpo: `<label class="lbl" for="relNota">O que aconteceu? (ex.: “leu a carteira com um 1 a mais”, “não achou o código 50000616”)</label><textarea id="relNota" rows="4" autofocus></textarea>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="relImg" checked><span>Incluir as imagens dos prints e os recortes (ajuda a corrigir a leitura)</span></label>
      <p class="dica" style="margin-top:10px">${ic('lock', 'sm')} O arquivo tem dados do beneficiário (nome, carteira, pedido). Envie só por canal interno da Promédica.</p>`,
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="relatoOk">${ic('download', 'sm')}Baixar arquivo</button>` });
}
async function abrirHistoricoGuia(id) {
  const r = Reg.todos[id] || Reg.cache.find(x => x.id === id); if (!r) { toast('Registro não encontrado: ele pode ter sido excluído. Atualize a lista e tente de novo.', 'bad'); return; }
  const a = await Aud.ler(r);
  abrirModal({ lateral: true, titulo: 'Histórico da guia', sub: `${r.paciente || r.pacienteIni || 'Beneficiário'} · ${r.guia || 'sem número'}`, icone: 'eye', tamanho: 'g', corpo: htmlHistoricoGuia(r, a),
    rodape: `<button class="btn line" data-act="relatarHist" data-id="${esc(r.id)}">${ic('help', 'sm')}Relatar problema</button><span style="flex:1"></span><button class="btn" data-act="fecharModal">Fechar</button>` });
}
/* ---------- Auditar (aba Ações): busca em todos os registros ---------- */
let AUD_BUSCA = { q: '', res: null, buscando: false };
function htmlAuditar() {
  const R = AUD_BUSCA.res;
  return `<div class="card" id="cardAuditar"><div class="card-h"><h2>${ic('search')} Auditar</h2></div>
    <p class="dica" style="margin:0 0 8px">Busca em todos os dias pelo nome do beneficiário, pela carteira ou pelo número da guia (ou, com a caixa marcada e a busca vazia, lista todas as guias com correções). O nome completo só está nos registros feitos a partir desta versão (nos antigos, só as iniciais).</p>
    <div class="linha-flex"><input type="search" id="audQ" value="${esc(AUD_BUSCA.q)}" placeholder="Ex.: Maria Helena, 800000701023900IE ou T10068052" data-enter="auditarBuscar" style="flex:1;min-width:220px;width:auto" aria-label="Buscar beneficiário, carteira ou guia">
      <button class="btn pri" data-act="auditarBuscar">${ic('search')}Buscar</button></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="audCorr" ${AUD_BUSCA.soCorr ? 'checked' : ''}><span>Só guias com correções, releituras ou divergências aceitas</span></label>
    ${AUD_BUSCA.buscando ? `<div style="margin-top:10px">${'<div class="esq-b esq-linha"></div>'.repeat(5)}</div>` : R ? `<p class="dica" style="margin-top:8px">${pl(R.length, 'resultado', 'resultados')}${R.length > 200 ? ' (mostrando os 200 mais recentes)' : ''}.</p>
    ${R.length ? `<div class="tabela-scroll"><table class="t"><thead><tr><th>Data</th><th>Beneficiário</th><th>Carteira</th><th>Guia</th><th>Clínica</th><th>Operador</th><th>Situação</th><th></th></tr></thead><tbody>
      ${R.slice(0, 200).map(r => `<tr><td class="num">${fmtDH(r.concluidoEm || r.abertoEm)}</td><td>${esc(r.paciente || r.pacienteIni || '—')}${r.correcoes ? ` <span class="tag warn" title="Correções, releituras e aceites registrados">${pl(r.correcoes, 'correção', 'correções')}</span>` : ''}${r.ignorados ? ` <span class="tag obs">${pl(r.ignorados, 'aceite', 'aceites')}</span>` : ''}</td><td class="num">${esc(r.carteira || '—')}</td><td class="num"><b>${esc(r.guia || '—')}</b></td><td>${esc(r.clinica || r.remetente || '—')}</td><td>${esc(r.operador || '—')}</td><td>${tagStatus(r.status)} ${tagResultado(resultadoDe(r))}</td>
        <td class="c"><button class="btn sm line" data-act="verGuia" data-id="${esc(r.id)}">${ic('eye', 'sm')}Ver histórico</button></td></tr>`).join('')}</tbody></table></div>` : ''}` : ''}
  </div>`;
}
function buscarRegistros(q) {
  const t = norm(q).trim(), dig = q.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (t.length < 3) return [];
  return Object.values(Reg.todos).filter(r => {
    if (r.tipo) return false;
    if (dig.length >= 5 && ((r.guia || '').toUpperCase().includes(dig) || normCart(r.carteira || '').includes(dig))) return true;
    const nome = norm(r.paciente || r.pacienteNome || ''); return nome && t.split(/\s+/).every(w => nome.includes(w));
  }).sort((a, b) => ((a.concluidoEm || a.abertoEm || '') < (b.concluidoEm || b.abertoEm || '') ? 1 : -1));
}
Object.assign(acoes, {
  async auditarBuscar() {
    const q = ($('#audQ') || {}).value || ''; AUD_BUSCA.q = q; AUD_BUSCA.soCorr = !!($('#audCorr') || {}).checked;
    if (norm(q).trim().length < 3 && !AUD_BUSCA.soCorr) { toast('Digite ao menos 3 letras do nome, ou a carteira, ou o número da guia.', 'bad'); return; }
    AUD_BUSCA.buscando = true; render();
    await Reg.carregarTudo();
    AUD_BUSCA.res = (norm(q).trim().length >= 3 ? buscarRegistros(q) : Object.values(Reg.todos).filter(r => !r.tipo).sort((a, b) => ((a.concluidoEm || a.abertoEm || '') < (b.concluidoEm || b.abertoEm || '') ? 1 : -1))).filter(r => !AUD_BUSCA.soCorr || r.correcoes || r.ignorados);
    AUD_BUSCA.buscando = false; render();
  },
  verGuia(b) { abrirHistoricoGuia(b.dataset.id); }
});

/* ====================================================================
   Linha do tempo da guia: tudo o que foi corrigido, editado, relido, ignorado (vai para o histórico e o Auditar)
   ==================================================================== */
function evento(g, tipo, texto, dados) {
  g.eventos = g.eventos || [];
  g.eventos.push({ em: agora(), op: operador(), tipo, texto, ...(dados ? { dados } : {}) });
}
const EV_ROT = { 'edicao-email': 'Leitura do e-mail corrigida', 'edicao-campo': 'Campo editado', carteira: 'Carteira usada', print: 'Print lido', 'print-erro': 'Print recusado', numero: 'Nº da guia', releitura: 'Releitura do print', ignorado: 'Divergência aceita', desfeito: 'Ignorar desfeito', conferido: 'Alerta conferido', aprendido: 'Correção aprendida aplicada', regra: 'Regra da clínica' };
const EV_CORRECAO = ['edicao-email', 'edicao-campo', 'carteira', 'releitura', 'ignorado', 'aprendido'];

/* ====================================================================
   Aprendizado: cada correção feita pelos operadores fica registrada (pasta › aprendizado/correcoes.json).
   Correções repetidas viram sugestão no próximo atendimento da mesma clínica e podem virar regra da clínica.
   ==================================================================== */
const Apr = {
  lista: [], pronto: false,
  async carregar() {
    let d = LS.get('aprendizado', null);
    if (Pasta.ok) { const p = await Pasta.ler(['aprendizado'], 'correcoes.json'); if (p) { d = p; LS.set('aprendizado', p); } }
    this.lista = (d && Array.isArray(d.itens)) ? d.itens : []; this.pronto = true;
  },
  chave: e => [e.tipo, e.clinicaId || '', e.campo, e.lido, e.correto].join('|'),
  mesclarListas(remota, local, excluida) {
    const mapa = new Map();
    for (const src of [remota || [], local || []]) {
      for (const it of src) {
        const k = this.chave(it); if (excluida && k === excluida) continue;
        const ex = mapa.get(k);
        if (!ex) mapa.set(k, clonar(it));
        else {
          ex.n = Math.max(ex.n || 1, it.n || 1);
          if ((it.ultimo || '') > (ex.ultimo || '')) { ex.ultimo = it.ultimo; if (it.ref) ex.ref = it.ref; }
          if ((it.primeiro || '') && (!ex.primeiro || it.primeiro < ex.primeiro)) ex.primeiro = it.primeiro;
          ex.ops = unicos([...(ex.ops || []), ...(it.ops || [])]).slice(-5);
        }
      }
    }
    return [...mapa.values()];
  },
  async registrar(e) {
    if ((!e.lido && e.lido !== 0) || String(e.lido) === String(e.correto)) return;
    await this.carregar();
    const k = this.chave(e), x = this.lista.find(y => this.chave(y) === k), op = operador();
    if (x) { x.n++; x.ultimo = agora(); if (op && !x.ops.includes(op)) x.ops = [...x.ops, op].slice(-5); if (e.ref) x.ref = e.ref; }
    else this.lista.push({ tipo: e.tipo, clinicaId: e.clinicaId || '', clinica: e.clinica || '', campo: e.campo, lido: String(e.lido), correto: String(e.correto), ref: e.ref || '', sistema: e.sistema || '', n: 1, primeiro: agora(), ultimo: agora(), ops: op ? [op] : [] });
    const doc = { atualizadoEm: agora(), itens: this.lista };
    LS.set('aprendizado', doc);
    if (Pasta.ok) {
      try {
        const salvo = await Pasta.transacaoJson(['aprendizado'], 'correcoes.json', { itens: [] }, remoto => ({
          atualizadoEm: agora(),
          itens: this.mesclarListas(remoto && remoto.itens, this.lista, null)
        }));
        if (salvo && Array.isArray(salvo.itens)) { this.lista = salvo.itens; LS.set('aprendizado', salvo); }
      } catch (er) { }
    }
  },
  async remover(k) {
    await this.carregar();
    this.lista = this.lista.filter(y => this.chave(y) !== k);
    const doc = { atualizadoEm: agora(), itens: this.lista };
    LS.set('aprendizado', doc);
    if (Pasta.ok) {
      try {
        const salvo = await Pasta.transacaoJson(['aprendizado'], 'correcoes.json', { itens: [] }, remoto => ({
          atualizadoEm: agora(),
          itens: this.mesclarListas(remoto && remoto.itens, this.lista, k)
        }));
        if (salvo && Array.isArray(salvo.itens)) { this.lista = salvo.itens; LS.set('aprendizado', salvo); }
      } catch (er) { }
    }
  },
  /* correções de e-mail desta clínica que batem com o que acabou de ser lido */
  sugestoes(p, cl) {
    if (!cl) return [];
    const out = [], da = this.lista.filter(e => e.tipo === 'email' && e.clinicaId === cl.id);
    const atual = { codigo: [...p.itens.map(i => i.codigo), ...p.invalidos], medico: [p.medico.nome], crm: [p.medico.crm], cid: [p.cid], local: [p.local], emissao: [p.emissao.bruto] };
    for (const e of da) {
      if (e.campo === 'quantidade') continue;   // quantidade vira sugestão de regra (Configurações › Aprendizado)
      const vs = atual[e.campo] || []; if (vs.some(v => v && String(v) === e.lido)) out.push(e);
    }
    return out;
  },
  /* para o print: o mesmo erro de leitura (lido → correto) já confirmado antes? */
  leituraConhecida(campo, lido, correto) { return this.lista.find(e => e.tipo === 'print' && e.campo === campo && e.lido === String(lido) && e.correto === String(correto)) || null; }
};

/* ====================================================================
   Antes de aceitar uma divergência do print: lê de novo aquela parte com mais preparos e posições.
   Se alguma leitura bate com o pedido, era erro de leitura e nada é ignorado.
   ==================================================================== */
const VAR_FUNDO = [3, 4, 5, 6].flatMap(a => [{ ampl: a }, { ampl: a, cinza: true }, { ampl: a, limite: -25 }, { ampl: a, limite: 25 }]);
const deslocadas = c => [c, [c[0], c[1] - 2, c[2], c[3] - 2], [c[0], c[1] + 2, c[2], c[3] + 2], [c[0] - 2, c[1], c[2], c[3]], [c[0] + 2, c[1], c[2], c[3]], [c[0], c[1], c[2] + 8, c[3]]];
async function relerDivergencia(g, x, aviso) {
  const mem = PRINTS_MEM.get(g.id); if (!mem) return null;
  const tentar = async (cv, a, caixas, vars, lista, norm, aceita) => {
    for (const cx of caixas) for (const v of vars) {
      const c = prepararCampo(cv, a, cx, v.ampl, v); const r = await OCR.ler(c.canvas, { psm: v.psm || '7', lista });
      const val = norm(r.texto); if (val && aceita(val)) return val;
    }
    return null;
  };
  if (x.chave.startsWith('c:')) {
    const k = x.chave.slice(2), lt = mem.leituras.find(l => l.tipo === 'guia'); if (!lt || !lt.ctx || !lt.campos[k]) return null;
    const { cv, anDe, G } = lt.ctx, base = DEF_GUIA[k], orig = lt.campos[k].valor, norm = base.norm || (t => t);
    if (aviso) aviso('Lendo de novo: ' + (ROT_PRINT[k] || k) + '…');
    const confere = val => { if (val === orig || (base.valida && !base.valida(val))) return false; lt.campos[k].valor = val; const c = avaliarPrints(g).checks.find(y => y.chave === x.chave); const ok = c && c.st === 'ok'; lt.campos[k].valor = orig; return ok; };
    const val = await tentar(cv, anDe(k), deslocadas(G[k]), VAR_FUNDO, base.lista, norm, confere);
    if (!val) return null;
    lt.campos[k].valor = val; lt.campos[k].incerto = false; lt.campos[k].releitura = { antes: orig, depois: val };
    return { antes: orig, depois: val };
  }
  const codigo = x.chave.slice(2), ped = g.pedido.itens.find(i => i.codigo === codigo), pedCods = new Set(g.pedido.itens.map(i => i.codigo));
  for (const l of mem.leituras.filter(l => l.tipo === 'proc' && l.ctx)) {
    const { cv, an, G } = l.ctx, Lg = G.linhas, caixa = (i, col) => [col[0], Lg.topo + Lg.passo * i + 2, col[1], Lg.topo + Lg.passo * i + Lg.alt - 1];
    const it = l.itens.find(i => i.codigo === codigo);
    if (it && ped && ped.qtd != null && it.qtd !== ped.qtd) {   // quantidade diferente: relê só a quantidade daquela linha
      if (aviso) aviso('Lendo de novo a quantidade de ' + codigo + '…');
      const v = await tentar(cv, an, deslocadas(caixa(it.fila, Lg.qtd)), [...VAR_CURTO, ...VAR_FUNDO.map(x => ({ ...x, psm: '13' }))], '0123456789', soDigitos, v => v === String(ped.qtd));
      if (v) { const antes = it.qtd; it.qtd = Number(v); return { antes: `${codigo} × ${antes ?? '?'}`, depois: `${codigo} × ${v}` }; }
    }
    if (!it) {   // não apareceu: relê as linhas cujo código não está no pedido (podem ser este código lido errado)
      for (const o of l.itens.filter(i => !pedCods.has(i.codigo))) {
        if (aviso) aviso('Lendo de novo a linha ' + (o.n || o.fila + 1) + ' da grade…');
        const v = await tentar(cv, an, deslocadas(caixa(o.fila, Lg.cod)), VAR_FUNDO, '0123456789', t => { const d = soDigitos(t); return d.length > 8 ? d.slice(-8) : d; }, v => v === codigo);
        if (v) { const antes = o.codigo; o.codigo = v; return { antes, depois: v }; }
      }
    }
  }
  return null;
}
/* motivo ao aceitar uma divergência (obrigatório para nome e carteira) */
const MOTIVOS_IGN = {
  comum: [['leitura', 'Erro de leitura do print: conferi na tela do sistema e está igual ao pedido']],
  paciente: [['abreviado', 'Nome abreviado ou cortado no sistema'], ['cadastro', 'Nome diferente no cadastro (casamento, grafia, nome social)']],
  ident: [['nova', 'Carteira nova ou trocada no sistema (o e-mail veio com a antiga)'], ['dependente', 'Titular/dependente: carteira diferente da informada']],
  item: [['menor', 'Autorizado a menor (regra, limite ou saldo)'], ['naoLiberado', 'Item não liberado no sistema'], ['outroCodigo', 'Liberado com outro código equivalente']],
  outro: [['outro', 'Outro motivo (descreva)']]
};
const exigeMotivo = chave => chave === 'c:paciente' || chave === 'c:ident';
/* Diferença letra a letra: marca o que muda entre o pedido e o lido (ex.: 41310000353730[2]EQ × …0[1]EQ) */
function marcasDiferenca(a, b) {
  a = String(a); b = String(b); const n = a.length, m = b.length;
  if (n * m > 40000) return [esc(a), esc(b)];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ka = new Array(n).fill(false), kb = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) { if (a[i] === b[j]) { ka[i] = kb[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  const html = (s, k) => { let o = '', dif = false; for (let i = 0; i < s.length; i++) { if (!k[i] && !dif) { o += '<mark class="dif">'; dif = true; } if (k[i] && dif) { o += '</mark>'; dif = false; } o += esc(s[i]); } return o + (dif ? '</mark>' : ''); };
  return [html(a, ka), html(b, kb)];
}
function htmlDiferenca(ped, lido) {
  const [a, b] = marcasDiferenca(ped, lido);
  return `<div class="dif-box"><div><span class="lbl">Pedido</span><span class="num">${a}</span></div><div><span class="lbl">Lido no sistema</span><span class="num">${b}</span></div></div>`;
}
function abrirMotivoIgnorar(g, x) {
  const k = x.chave.startsWith('i:') ? 'item' : x.chave.slice(2), ops = [...MOTIVOS_IGN.comum, ...(MOTIVOS_IGN[k] || []), ...MOTIVOS_IGN.outro], obrig = exigeMotivo(x.chave);
  M = { tipo: 'motivoIgn', chave: x.chave };
  abrirModal({ risco: 'warn', titulo: 'Aceitar divergência', sub: `${x.rot || 'Item ' + x.codigo}: pedido "${x.ped ?? x.qPed ?? '—'}", lido "${x.lido ?? x.qSis ?? '—'}"`, icone: 'shield', tamanho: 'p',
    corpo: `<p class="dica" style="margin:0 0 10px">O print já foi lido de novo e continua diferente. ${obrig ? '<b>Para nome e carteira o motivo é obrigatório.</b>' : 'Diga o motivo: ele fica no histórico da guia.'}</p>
      ${(x.ped ?? x.qPed) != null && (x.lido ?? x.qSis) != null ? htmlDiferenca(String(x.ped ?? x.qPed), String(x.lido ?? x.qSis)) : ''}
      <div class="stack" role="radiogroup">${ops.map(([v, t], i) => `<label class="chk"><input type="radio" name="motIgn" value="${v}"><span><kbd>${i + 1}</kbd> <span class="mot-t">${esc(t)}</span></span></label>`).join('')}</div>
      <label class="lbl" for="motIgnTxt" style="margin-top:10px">Detalhe ${obrig ? '(obrigatório em "Outro")' : '(opcional)'}</label><textarea id="motIgnTxt" rows="2" placeholder="Ex.: no sistema está JANY G. DA SILVA"></textarea>`,
    rodape: `<span class="dica">Escolha o motivo (ou tecle 1 a ${ops.length}).</span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="motivoIgnOk" id="motIgnOk" disabled>${ic('check')}Aceitar divergência</button>` });
  const fundo = $('#modalFundo'), ok = $('#motIgnOk');
  fundo.addEventListener('change', ev => { if (ev.target.name === 'motIgn') ok.disabled = false; });
  fundo.addEventListener('keydown', ev => {
    if (ev.target.matches('textarea') || ev.ctrlKey || ev.altKey) return;
    const n = parseInt(ev.key, 10), r = $$('input[name=motIgn]', fundo);
    if (n >= 1 && n <= r.length) { ev.preventDefault(); r[n - 1].checked = true; r[n - 1].focus(); ok.disabled = false; if (r[n - 1].value === 'outro') $('#motIgnTxt').focus(); }
  });
  setTimeout(() => { const r = $('input[name=motIgn]', fundo); if (r) r.focus(); }, 40);
}
function confirmarIgnorar(g, x, motivo) {
  g.prints = g.prints || { ign: {} }; g.prints.ign = g.prints.ign || {};
  const ign = { ...linhaIgnorada(x), ...(motivo ? { motivo } : {}) };
  if (motivo && motivo.tipo === 'leitura') { ign.on = false; ign.leitura = true; }   // erro de leitura: não vai observação à clínica
  g.prints.ign[x.chave] = ign;
  evento(g, 'ignorado', `${x.rot || 'Item ' + x.codigo}: pedido "${x.ped ?? x.qPed ?? '—'}", lido "${x.lido ?? x.qSis ?? '—'}"${motivo ? ' — ' + motivo.texto + (motivo.detalhe ? ': ' + motivo.detalhe : '') : ''}`, { chave: x.chave, motivo: motivo || null });
  if (motivo && motivo.tipo === 'leitura') {
    const campo = x.chave.startsWith('c:') ? x.chave.slice(2) : 'item';
    Apr.registrar({ tipo: 'print', campo, lido: x.lido ?? x.qSis ?? '', correto: x.ped ?? x.qPed ?? '', sistema: (PRINTS_MEM.get(g.id) || {}).sistema || '', clinicaId: S.clinicaId, clinica: (clinicaDe(S) || {}).nome || '' });
  }
  aplicarPrints(g); persistir(); render();
  toast(ign.leitura ? 'Marcado como erro de leitura do print. Sem observação para a clínica.' : ign.on !== false ? 'Divergência aceita: a observação para a clínica foi incluída na etapa 4 (você pode desmarcar).' : 'Divergência aceita.');
}
Object.assign(acoes, {
  async ignorarPrint(b) {
    const g = guiaAtiva(), av = avaliarPrints(g); if (!av) return;
    const x = [...av.checks, ...av.linhas].find(y => y.chave === b.dataset.key); if (!x) return;
    const msg = t => { const el = $('#printsEstado'); if (el) el.innerHTML = t ? `<span class="tag info">${ic('refresh', 'sm')}${esc(t)}</span>` : ''; };
    b.disabled = true;
    let rr = null; try { rr = await relerDivergencia(g, x, msg); } catch (e) { console.error(e); }
    msg('');
    const rot = x.rot || 'Item ' + x.codigo;
    if (rr) { evento(g, 'releitura', `${rot}: lido de novo como "${rr.depois}" (antes "${rr.antes}") e agora confere com o pedido.`); aplicarPrints(g); persistir(); render(); toast('Lido de novo: agora confere com o pedido. Nada foi ignorado.'); return; }
    evento(g, 'releitura', `${rot}: lido de novo e continua diferente do pedido.`);
    b.disabled = false;
    abrirMotivoIgnorar(g, x);
  },
  motivoIgnOk() {
    const g = guiaAtiva(), av = avaliarPrints(g); const x = av && [...av.checks, ...av.linhas].find(y => y.chave === M.chave); if (!x) { fecharModal(true); return; }
    const sel = $('input[name="motIgn"]:checked'), det = ($('#motIgnTxt') || {}).value.trim();
    if (!sel) { toast('Escolha o motivo.', 'bad'); return; }
    if (sel.value === 'outro' && det.length < 4) { toast('Descreva o motivo.', 'bad'); $('#motIgnTxt').focus(); return; }
    const texto = (sel.closest('label').querySelector('.mot-t') || sel.closest('label')).textContent.trim();
    fecharModal(true);
    confirmarIgnorar(g, x, { tipo: sel.value, texto, detalhe: det });
  },
  desfazerPrint(b) {
    const g = guiaAtiva(); if (!g.prints || !g.prints.ign) return;
    const ant = g.prints.ign[b.dataset.key]; delete g.prints.ign[b.dataset.key];
    evento(g, 'desfeito', `Desfeito o aceite de ${b.dataset.key.startsWith('c:') ? (ROT_PRINT[b.dataset.key.slice(2)] || b.dataset.key) : 'item ' + b.dataset.key.slice(2)}${ant && ant.motivo ? ' (motivo era: ' + ant.motivo.texto + ')' : ''}.`);
    aplicarPrints(g); persistir(); render();
  },
  aplicarAprendido(b) {
    const g = guiaAtiva(), p = g.pedido, e = (p.aprendidos || [])[+b.dataset.i]; if (!e) return;
    if (e.campo === 'codigo') {
      const it = p.itens.find(i => i.codigo === e.lido);
      if (it) { it.codigo = e.correto; it.origemCod = 'aprendido'; }
      else {   // código que não virou item (dígito a mais/menos): relê o trecho do e-mail já com o código certo, para pegar a quantidade e a descrição
        const re = new RegExp('(?<![\\dA-Za-z])' + e.lido + '(?![\\dA-Za-z])', 'g');
        const novo = g.textoBloco ? lerPedido(g.textoBloco.replace(re, e.correto), S.email.data).itens.find(i => i.codigo === e.correto) : null;
        p.itens.push(novo ? { ...novo, origemCod: 'aprendido' } : { codigo: e.correto, desc: '', qtd: null, origemQtd: null, origemCod: 'aprendido' });
      }
      p.invalidos = p.invalidos.filter(c => c !== e.lido);
    } else if (e.campo === 'medico') p.medico = lerMedico(`${e.correto}${p.medico.crm ? ' CRM ' + p.medico.crm : ''}`);
    else if (e.campo === 'crm') { p.medico.crm = e.correto; }
    else if (e.campo === 'cid') p.cid = e.correto;
    else if (e.campo === 'local') p.local = e.correto;
    else if (e.campo === 'emissao') p.emissao = lerEmissao(e.correto, S.email.data);
    if (e.campo !== 'codigo') marcarOrigem(g, e.campo === 'crm' ? 'medico' : e.campo, 'aprendido');
    p.aprendidos.splice(+b.dataset.i, 1);
    evento(g, 'aprendido', `${e.campo}: "${e.lido}" → "${e.correto}" (correção já feita ${pl(e.n, 'vez', 'vezes')} nesta clínica).`);
    persistir(); render(); toast('Correção aplicada. Confira no e-mail.');
  }
});

/* ---------- Configurações › Aprendizado ---------- */
const CAMPO_APR = { codigo: 'Código', quantidade: 'Quantidade', medico: 'Médico', crm: 'CRM', cid: 'CID', local: 'Local', emissao: 'Data do pedido', paciente: 'Nome do beneficiário', ident: 'Carteira', guia: 'Nº da guia', credNome: 'Credenciado', profissional: 'Médico (print)', registro: 'CRM (print)', dtSolic: 'Data (print)', item: 'Item' };
function regraSugerida(e) {
  if (e.tipo !== 'email') return '';
  if (e.campo === 'codigo') return 'troca';
  if (e.campo === 'quantidade' && e.lido === '?' && /^\d+$/.test(e.correto)) return 'qtdPadrao';
  return '';
}
function cfgAprendizado() {
  const L = [...Apr.lista].sort((a, b) => b.n - a.n || (a.ultimo < b.ultimo ? 1 : -1));
  const em = L.filter(e => e.tipo === 'email'), pr = L.filter(e => e.tipo === 'print');
  const linha = e => { const k = Apr.chave(e), rg = regraSugerida(e), cl = cfgEdit.clinicas.find(c => c.id === e.clinicaId);
    const jaRegra = rg === 'troca' && cl && lerTrocas(cl.leitura.trocas).mapa[e.lido] === e.correto || rg === 'qtdPadrao' && cl && String(cl.leitura.qtdPadrao) === e.correto;
    return `<tr><td>${esc(e.clinica || (e.tipo === 'print' ? SISTEMAS_PRINT[e.sistema] || '—' : '—'))}</td><td>${esc(CAMPO_APR[e.campo] || e.campo)}${e.ref ? ` <span class="muted">(${esc(e.ref)})</span>` : ''}</td><td class="num">${esc(e.lido || '—')}</td><td class="num"><b>${esc(e.correto || '—')}</b></td><td class="c"><span class="tag ${e.n >= 3 ? 'warn' : ''}">${e.n}×</span></td><td class="num">${fmtData(e.ultimo)}</td><td>${esc((e.ops || []).join(', '))}</td>
      <td class="c"><div class="linha-flex" style="justify-content:center;gap:4px">${rg && cl ? (jaRegra ? '<span class="tag ok">já é regra</span>' : `<button class="btn sm" data-act="aprRegra" data-k="${esc(k)}" title="${rg === 'troca' ? 'Adiciona em “Códigos que a clínica escreve errado”' : 'Liga “Quantidade quando o e-mail não informar”'}">${ic('check', 'sm')}Virar regra</button>`) : ''}<button class="btn sm line" data-act="aprRemover" data-k="${esc(k)}" title="Esquecer esta correção">${ic('trash', 'sm')}</button></div></td></tr>`; };
  const tabela = (lista, vazio) => lista.length ? `<div class="tabela-scroll"><table class="t"><thead><tr><th>Clínica / sistema</th><th>Campo</th><th>Lido</th><th>Correto</th><th>Vezes</th><th>Última</th><th>Operadores</th><th></th></tr></thead><tbody>${lista.map(linha).join('')}</tbody></table></div>` : `<p class="muted">${vazio}</p>`;
  return `<div class="card">${cabSecao('Aprendizado (correções)')}
    <p class="dica">Cada correção que os operadores fazem fica registrada aqui (pasta compartilhada › aprendizado). No e-mail, quando o mesmo valor aparece de novo na mesma clínica, o atendimento sugere a mesma correção. No print, um erro de leitura confirmado vira aviso de “leitura conhecida”. Correções frequentes de código ou de quantidade podem <b>virar regra da clínica</b> (depois clique em Salvar configurações).</p>
    <div class="acoes" style="margin-top:0"><span class="tag">${em.length} do e-mail · ${pr.length} do print</span><span class="esp"></span><button class="btn" data-act="aprBaixar" ${L.length ? '' : 'disabled'}>${ic('download')}Baixar (.json) para ajuste dos leitores</button></div>
    <h3>Leitura do e-mail</h3>${tabela(em, 'Nenhuma correção de e-mail registrada ainda.')}
    <h3 style="margin-top:16px">Leitura dos prints (erros de leitura confirmados)</h3>${tabela(pr, 'Nenhum erro de leitura confirmado ainda.')}</div>`;
}
Object.assign(acoes, {
  aprRegra(b) {
    if (!Pin.liberado()) { pedirPin(() => acoes.aprRegra(b)); return; }
    const e = Apr.lista.find(y => Apr.chave(y) === b.dataset.k), cl = e && cfgEdit.clinicas.find(c => c.id === e.clinicaId); if (!e || !cl) return;
    if (regraSugerida(e) === 'troca') { const t = (cl.leitura.trocas || '').trim(); cl.leitura.trocas = (t ? t + '\n' : '') + `${e.lido} = ${e.correto}`; }
    else cl.leitura.qtdPadrao = Number(e.correto);
    marcarSujo(); render(); toast(`Regra adicionada em ${cl.nome}. Clique em Salvar configurações.`);
  },
  async aprRemover(b) { const x = Apr.lista.find(y => Apr.chave(y) === b.dataset.k); if (!(await confirmar({ titulo: 'Esquecer correção', texto: x ? `Esquecer a correção <b>“${esc(x.lido)}” → “${esc(x.correto)}”</b>${x.clinica ? ' de ' + esc(x.clinica) : ''}? Ela deixa de ser sugerida.` : 'Esquecer esta correção?', ok: 'Esquecer correção', risco: 'warn' }))) return; await Apr.remover(b.dataset.k); render(); },
  aprBaixar() { baixar(nomeArquivo('aprendizado', isoDia(new Date()), 'json'), JSON.stringify({ tipo: 'conferidor-aprendizado', versao: VERSAO, gerado: agora(), itens: Apr.lista }, null, 1), 'application/json'); }
});
/* ====================================================================
   Captura da janela do sistema pelo navegador (sem Print Screen): o operador escolhe a janela uma vez;
   cada "Capturar" pega a imagem atual dela e lê como um print colado.
   ==================================================================== */
const Captura = {
  stream: null, video: null,
  suportada: () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
  ativa() { return !!(this.stream && this.stream.getVideoTracks().some(t => t.readyState === 'live')); },
  async conectar(nav) {
    const md = (nav || navigator).mediaDevices;
    this.parar();
    this.stream = await md.getDisplayMedia({ video: { displaySurface: 'window', cursor: 'never', frameRate: 5 }, audio: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include' });
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = this.stream; this.video = v;
    await v.play(); await new Promise(ok => { if (v.videoWidth) ok(); else v.addEventListener('loadeddata', ok, { once: true }); });
    this.stream.getVideoTracks()[0].addEventListener('ended', () => { this.stream = null; this.video = null; render(); });
  },
  async quadro() {
    if (!this.ativa()) throw new Error('A janela do sistema não está conectada.');
    const v = this.video;
    await new Promise(ok => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => ok()) : setTimeout(ok, 120)));
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    const url = c.toDataURL('image/png'), bin = atob(url.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], `captura-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.png`, { type: 'image/png' });
  },
  parar() { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; this.video = null; }
};
async function capturarJanela(nav) {
  const g = guiaAtiva(); if (!g) return;
  try {
    if (!Captura.ativa()) { await Captura.conectar(nav); toast('Janela conectada. Deixe a aba certa (Dados da Guia ou Procedimentos) aberta no sistema e clique em Capturar.'); render(); return; }
    const f = await Captura.quadro(); await processarPrints([f]);
  } catch (e) { if (e && e.name === 'NotAllowedError') toast('Captura cancelada.', 'bad'); else toast('Não foi possível capturar a janela: ' + (e.message || e), 'bad'); render(); }
}
function htmlBotoesCaptura() {
  if (!Captura.suportada()) return '';
  return Captura.ativa()
    ? `<button class="btn pri" data-act="capturarJanela" title="Captura a janela do sistema agora (deixe aberta a aba que quer conferir)">${ic('monitor')}Capturar a janela do sistema</button><button class="btn sm line" data-act="trocarJanela" title="Escolher outra janela">${ic('refresh', 'sm')}Trocar janela</button>`
    : `<button class="btn" data-act="capturarJanela" title="Escolha a janela do sistema uma vez; depois cada clique captura a tela atual, sem Print Screen">${ic('monitor')}Conectar à janela do sistema</button>`;
}
