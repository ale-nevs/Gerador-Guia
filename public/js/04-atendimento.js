'use strict';
/* ====================================================================
   Estado do atendimento: um e-mail = um atendimento; cada beneficiário/solicitação = uma guia
   ==================================================================== */
let S = null;          // atendimento em andamento
let aba = 'atend';
let ultimoConcluido = LS.get('ultimo', null);
const guiaAtiva = () => (S ? S.guias[S.ativa] : null);
// Último médico lido por remetente, só neste computador: serve de sugestão quando um pedido da mesma clínica vem sem médico
const chaveMedico = () => (S && S.email && S.email.remetente && S.email.remetente.email) ? 'medico.' + S.email.remetente.email.toLowerCase() : '';
function lembrarMedico() { const k = chaveMedico(); if (!k) return; const g = S.guias.find(x => x.pedido.medico && x.pedido.medico.nome); if (g) LS.set(k, g.pedido.medico.bruto); }
function persistir() { if (Abas.pausada) return; if (S) { LS.set('atual', S); lembrarMedico(); } else LS.del('atual'); }
function clinicaDe(s) { return s && s.clinicaId ? cfg.clinicas.find(c => c.id === s.clinicaId) || null : null; }
const PALAVRAS_VAZIAS = new Set(['clinica', 'clinicas', 'de', 'da', 'do', 'das', 'dos', 'e', 'autorizacao', 'convenio', 'contato', 'espaco', 're', 'res', 'enc', 'fw', 'fwd', 'pedido', 'guia', 'guias', 'terapia', 'terapias', 'integrada', 'multidisciplinar']);
const tokens = s => semAcento(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !PALAVRAS_VAZIAS.has(w));
function acharClinica(email) {
  const e = (email.remetente.email || '').toLowerCase();
  let cl = cfg.clinicas.find(c => c.emails.includes(e));
  if (cl) return { cl, como: 'email' };
  const dom = e.split('@')[1] || '';
  if (dom && !/(gmail|hotmail|outlook|yahoo|live|icloud|bol|uol|terra)\./.test(dom)) {
    cl = cfg.clinicas.find(c => c.emails.some(x => x.endsWith('@' + dom)));
    if (cl) return { cl, como: 'dominio' };
  }
  return null;
}
function sugerirClinica(email) {
  const tk = new Set(tokens(email.remetente.nome + ' ' + email.assunto + ' ' + email.remetente.email.split('@')[0]));
  let melhor = null, pts = 0;
  for (const c of cfg.clinicas) { const n = tokens(c.nome).filter(t => tk.has(t)).length; if (n > pts) { pts = n; melhor = c; } }
  return melhor;
}
function novaGuia(bloco, idx, st) {
  const p = bloco.pedido, e = st.email;
  return {
    id: uid(), idx, chave: bloco.chave, multi: bloco.multi, pedido: p, textoBloco: bloco.texto.trim(),
    carteiraUsada: p.carteira || '', executante: null,
    status: 'em_andamento', vista: 2, etapa: 2, abertoEm: agora(), abertoPor: operador(),
    copiados: {}, itensEditados: false, editandoItens: false,
    cega: { iniciada: false, tentativas: 0, linhas: '', entradas: [], resultado: null, ok: false, historico: [] },
    numero: '',
    resultado: { situacao: null, motivoId: '', motivoTxt: '', naoAut: {}, obsAdicionais: '', glosa: { resp: null, itens: {} }, emailPrestador: (e.responderPara && e.responderPara.email) || e.remetente.email || '' },
    usarCorrecao: /^\s*(re|res)\s*:/i.test(e.assunto),
    respEdit: null, respExtras: [], respInc: [], obsEdit: null, obsExtras: [], obsInc: [],
    param: null, semGuia: null, semGuiaCopiado: false, conf: {}
  };
}
/* ---------- Regras de leitura da clínica (Configurações › Clínicas): corrigem erros que a clínica repete ---------- */
function normLeitura(l) {
  l = l || {}; const q = parseInt(l.qtdPadrao, 10);
  return { qtdPadrao: q >= 1 && q <= 99 ? q : '', completarCodigo: !!l.completarCodigo, qtdColada: !!l.qtdColada, trocas: typeof l.trocas === 'string' ? l.trocas : '' };
}
/* "5000470 = 50000470" (um por linha; aceita =, ->, →, ; ou espaço) */
function lerTrocas(txt) {
  const mapa = {}, erros = [];
  String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    const m = l.match(/^(\d{4,12})\s*(?:=|->|→|=>|;|:|\s)\s*(\d{8})$/);
    if (m) mapa[m[1]] = m[2]; else erros.push(l);
  });
  return { mapa, erros };
}
/* corrige no texto os códigos que a clínica escreve errado; devolve o texto e a lista do que mudou */
function corrigirCodigosTexto(texto, cl, R) {
  const correcoes = []; if (!cl) return { texto, correcoes };
  const { mapa } = lerTrocas(R.trocas), conhecidos = Object.keys(cl.codigos || {}).filter(c => /^\d{8}$/.test(c));
  texto = texto.replace(/(?<![\dA-Za-z])(\d{4,12})(?![\dA-Za-z])/g, (n, x, off, str) => {
    if (mapa[n]) { correcoes.push({ de: n, para: mapa[n], como: 'troca' }); return mapa[n]; }
    if (R.completarCodigo && (n.length === 7 || n.length === 9)) {
      const cand = conhecidos.filter(c => distanciaTexto(c, n) === 1);
      if (cand.length === 1) { correcoes.push({ de: n, para: cand[0], como: 'completar' }); return cand[0]; }
    }
    return n;
  });
  return { texto, correcoes };
}
/* lê os pedidos do e-mail aplicando as regras de leitura da clínica (cl pode ser null) */
function pedidosDoEmail(email, cl) {
  const R = normLeitura(cl && cl.leitura);
  REGRAS_LEITURA = R;
  try {
    let c = corrigirCodigosTexto(email.textoPrincipal, cl, R), lp = lerPedidos(c.texto, email.data);
    if (email.cortado && lp.blocos.every(b => !b.pedido.itens.length && !b.pedido.carteiraBruta)) {
      email.textoPrincipal = email.textoCompleto; email.cortado = false; email.restante = '';
      c = corrigirCodigosTexto(email.textoCompleto, cl, R); lp = lerPedidos(c.texto, email.data);
    }
    lp.blocos.forEach(b => {
      const p = b.pedido; p.regras = [];
      c.correcoes.filter(x => p.itens.some(it => it.codigo === x.para)).forEach(x => { p.itens.filter(it => it.codigo === x.para).forEach(it => { it.origemCod = 'regra'; }); }); c.correcoes.filter(x => p.itens.some(it => it.codigo === x.para)).forEach(x => p.regras.push(`Código ${x.de} lido como ${x.para} pela regra da clínica (${x.como === 'troca' ? 'código que a clínica escreve errado' : 'dígito a mais ou a menos, corrigido para o código cadastrado'}). Confira no e-mail.`));
      p.itens.forEach(it => {
        if (it.qtd == null && R.qtdPadrao) { it.qtd = R.qtdPadrao; it.origemQtd = 'regra'; p.regras.push(`O e-mail não informa a quantidade de ${it.codigo}: usada ${R.qtdPadrao}, pela regra da clínica.`); }
        if (it.origemQtd === 'colada-crm') p.regras.push(`Quantidade 1 de ${it.codigo} separada do número colado no CRM (ex.: "119741" = 1 + CRM 19741). Confira no e-mail.`);
      });
    });
    return lp;
  } finally { REGRAS_LEITURA = {}; }
}
function novoEstado(email) {
  const achou = acharClinica(email), sug = achou ? null : sugerirClinica(email);
  const lp = pedidosDoEmail(email, achou ? achou.cl : null);
  lp.blocos.forEach(b => { b.pedido.aprendidos = Apr.sugestoes(b.pedido, achou ? achou.cl : null); });
  relacionarBlocos(lp.blocos);
  const st = {
    v: 2, atendId: uid(), email, preambulo: lp.preambulo, ativa: 0, vista: 2,
    clinicaId: achou ? achou.cl.id : null, clinicaComo: achou ? achou.como : null, clinicaSugerida: sug ? sug.id : null,
    abertoEm: agora(), dia: isoDia(new Date()), guias: []
  };
  st.guias = lp.blocos.map((b, i) => novaGuia(b, i, st));
  return st;
}
/* ---------- Serviços: descrição de referência e estado de cadastro ---------- */
function descCadastro(cl, codigo) { return cl && cl.codigos ? cl.codigos[codigo] : undefined; }
function divergeDesc(cad, desc) {
  const a = tokens(cad), b = tokens(desc || '');
  if (!b.length || !a.length) return false;
  return !a.some(t => b.includes(t));
}
/* estado: 'cadastrado' | 'sem-cadastro' | 'divergente' | 'sem-clinica' */
function estadoItem(g, it) {
  const cl = clinicaDe(S); if (!cl) return 'sem-clinica';
  const cad = descCadastro(cl, it.codigo);
  if (cad === undefined) return 'sem-cadastro';
  return divergeDesc(cad, it.desc) ? 'divergente' : 'cadastrado';
}
function descRefItem(g, it) {
  const cl = clinicaDe(S), cad = descCadastro(cl, it.codigo);
  return cad !== undefined && cad !== '' ? { texto: cad, provisoria: false } : { texto: it.desc || '', provisoria: true };
}

/* ---------- Alertas (regras centralizadas; o comportamento vem de cfg.alertas) ---------- */
/* Para um código com tamanho errado, procura um código de 8 dígitos já cadastrado a 1 caractere de distância */
function sugestaoCodigo(c, cl) {
  const conhecidos = new Map();
  (cl ? [cl] : []).concat(cfg.clinicas).forEach(x => Object.entries(x.codigos || {}).forEach(([k, d]) => { if (/^\d{8}$/.test(k) && !conhecidos.has(k)) conhecidos.set(k, d); }));
  const cand = [...conhecidos.keys()].filter(k => Math.abs(k.length - c.length) <= 1 && distanciaTexto(k, c) === 1);
  if (cand.length !== 1) return '';
  return ` Provável: ${cand[0]}${conhecidos.get(cand[0]) ? ' (' + conhecidos.get(cand[0]) + ')' : ''}.`;
}
function distanciaTexto(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function avaliar(g) {
  const A = [], p = g.pedido, e = S.email, cl = clinicaDe(S), P = cfg.preferencias, mu = g.multi;
  const add = (tipo, texto, extra = {}) => {
    const modo = modoDe(tipo); if (modo === 'desativado') return;
    const c = cfg.alertas[tipo] || {};
    A.push({ tipo, key: tipo + (extra.sub ? ':' + extra.sub : ''), modo, nivel: ALERTAS[tipo].nivel || 'alerta', texto, dest: c.dest === 'prestador' ? 'prestador' : 'guia', obsTexto: (c.texto || '').trim() || texto, ...extra });
  };
  /* vários beneficiários */
  if (mu.excesso) add('excesso-benef', `Este e-mail traz mais de ${MAX_BENEFICIARIOS} beneficiários diferentes e esta solicitação passou do limite.`, { clinica: `O e-mail contém mais de ${MAX_BENEFICIARIOS} beneficiários diferentes. Por gentileza, envie os demais em outro e-mail.` });
  if (mu.mesmo > 1) add('mesmo-benef', `O mesmo beneficiário aparece em ${mu.mesmo} solicitações deste e-mail (esta é a ${mu.ocorrencia}ª). Cada uma gera uma guia independente, com os dados completos do beneficiário.`);
  if (S.preambulo && g.idx === 0) add('preambulo', 'Há campos antes do primeiro beneficiário (por exemplo, médico ou CID). Eles não foram aplicados a nenhuma guia: confira se cada beneficiário tem os próprios dados.');
  if (mu.mesmo > 1) {
    const outras = S.guias.filter(o => o !== g && o.chave === g.chave && o.status !== 'descartado');
    outras.forEach(o => {
      const comuns = g.pedido.itens.filter(i => o.pedido.itens.some(x => x.codigo === i.codigo));
      comuns.forEach(i => { const x = o.pedido.itens.find(y => y.codigo === i.codigo); add('serv-repetido-guias', x.qtd !== i.qtd ? `O serviço ${i.codigo} também está na guia ${o.idx + 1} deste e-mail, com quantidade diferente (${x.qtd ?? '?'} × ${i.qtd ?? '?'}). Pedido possivelmente contraditório.` : `O serviço ${i.codigo} também está na guia ${o.idx + 1} deste e-mail, com a mesma quantidade. Possível duplicidade.`, { sub: i.codigo + '-' + o.idx }); });
    });
  }
  /* identificação */
  if (!p.beneficiario) add('falta-benef', 'Beneficiário não informado.', { clinica: 'Nome do beneficiário não informado.' });
  if (!cartValida(g.carteiraUsada)) {
    if (!p.beneficiario && !p.carteiraBruta) add('cart', 'Carteira e nome do beneficiário não informados.', { clinica: 'Número da carteira Promédica não informado.' });
    else add('cart', p.carteiraBruta ? `Carteira fora do padrão: "${p.carteiraBruta}" (${normCart(p.carteiraBruta).length} caracteres; o correto são 17: 15 dígitos + 2 caracteres). Localize o beneficiário pelo nome no sistema e informe a carteira usada.` : 'Carteira não informada. Localize o beneficiário pelo nome no sistema e informe a carteira usada.', { acaoCarteira: true });
  } else if (p.carteira !== g.carteiraUsada) {
    add('cart-dif', `Carteira usada (${g.carteiraUsada}) diferente da informada no e-mail (${p.carteiraBruta || 'não informada'}). Confirme que nome e carteira são do mesmo beneficiário.`);
  }
  /* serviços */
  if (!p.itens.length) add('falta-serv', 'Nenhum código de serviço de 8 dígitos foi encontrado.', { clinica: 'Código do serviço (8 dígitos) não informado.' });
  unicos([...p.invalidos, p.codigoSuspeito].filter(Boolean)).forEach(c => add('cod-invalido', `Código "${c}" tem ${c.length} dígitos (o correto são 8).${sugestaoCodigo(c, cl)}`, { sub: c, clinica: `O código "${c}" está incorreto ou incompleto: os códigos de serviço têm 8 dígitos.` }));
  const cont = {}; p.itens.forEach(i => cont[i.codigo] = (cont[i.codigo] || 0) + 1);
  Object.entries(cont).filter(([, n]) => n > 1).forEach(([c, n]) => add('cod-repetido', `Código ${c} aparece ${n} vezes no pedido.`, { sub: c, clinica: `O código ${c} foi informado mais de uma vez. Por gentileza, informe a quantidade total em uma única linha.` }));
  p.itens.forEach(it => {
    if (it.qtd == null) add('qtd-ausente', `Quantidade não encontrada para ${it.codigo}.`, { sub: it.codigo, clinica: `Quantidade não informada para o serviço ${it.codigo}.` });
    else if (it.qtd < 1 || it.qtd > P.qtdMax) add('qtd-invalida', `Quantidade ${it.qtd} inválida para ${it.codigo} (aceita de 1 a ${P.qtdMax}).`, { sub: it.codigo, clinica: `Quantidade inválida (${it.qtd}) para o serviço ${it.codigo}.` });
  });
  if (p.qtdUnicaAplicada) add('qtd-unica', 'Havia uma única "Quantidade" para vários serviços e ela foi aplicada a todos. Confirme no e-mail.');
  p.itens.filter(i => i.origemQtd === 'fim-da-linha').forEach(i => add('qtd-inferida', `A quantidade ${i.qtd} de ${i.codigo} foi lida como o número solto no fim da linha. Confirme no e-mail.`, { sub: i.codigo }));
  if (p.herdados && p.herdados.length) add('dados-comuns', `Dados escritos uma única vez no e-mail foram aplicados a esta guia: ${p.herdados.join(', ')}. Confira se valem para este beneficiário.`);
  if (p.semRotulo) add('sem-rotulo', 'O pedido não tem o rótulo "Serviço"; os códigos foram lidos de linhas soltas. Confira a lista de itens.');
  (p.regras || []).forEach((t, k) => add('regra-clinica', t, { sub: String(k) }));
  (p.aprendidos || []).forEach((e, k) => add('aprendido', `${{ codigo: 'Código', medico: 'Médico', crm: 'CRM', cid: 'CID', local: 'Local', emissao: 'Data' }[e.campo] || e.campo} "${e.lido}" já foi corrigido para "${e.correto}" ${pl(e.n, 'vez', 'vezes')} em atendimentos desta clínica.`, { sub: e.campo + ':' + e.lido, aprendidoI: k }));
  p.soltos.forEach(n => add('solto', `O número ${n} (8 dígitos) está no texto mas não virou item. Confirme que não é um serviço esquecido.`, { sub: n }));
  if (g.itensEditados) add('editado', 'Dados ou itens foram corrigidos à mão. Confira de novo com o e-mail original.');
  /* pedido médico */
  if (!p.medico.nome && !p.medico.crm) add('falta-med', 'Médico solicitante não informado.', { clinica: 'Nome do médico solicitante não informado.' });
  const em = p.emissao;
  if (em.estado === 'invalida') add('em-inv', `Data de emissão não reconhecida: "${em.bruto}".`);
  if (em.estado === 'valida' && em.futura) add('em-fut', `Data de emissão no futuro (${fmtData(em.data)}).`);
  if (em.estado === 'sem_data') add('em-sd', 'Emissão: "SEM DATA", informado pela clínica.');
  if (em.estado === 'ausente') add('em-aus', 'Data de emissão não informada (não obrigatória).');
  if (p.medico.nome && !p.medico.crm) add('crm', 'CRM do médico não informado.');
  if (!p.cid) add('cid', 'CID não informado (não obrigatório).');
  else if (!p.cid.split(' + ').every(c => /^[A-Z]\d{2}(\.?\d{1,2})?$/i.test(c))) add('cid-fmt', `CID "${p.cid}" fora do padrão (ex.: F84 ou F84.0). Confira no e-mail.`);
  if (em.anoInferido) add('em-inf', `A clínica escreveu "${em.bruto}" sem o ano; foi considerado ${fmtData(em.data)}. Confirme no pedido médico.`);
  if (!p.beneficiario && !p.carteiraBruta && !p.itens.length && !p.invalidos.length && !p.codigoSuspeito) add('nao-pedido', 'Este e-mail não traz beneficiário, carteira nem código de serviço: pode não ser um pedido de autorização (dúvida, retificação ou conversa).');
  /* mesmo código já autorizado para a mesma carteira nesta semana (segunda a domingo), em outro e-mail */
  const cartSem = normCart(g.carteiraUsada || p.carteira || '');
  if (cartSem) {
    const ini = new Date(); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
    const daSemana = Reg.cache.filter(r => !r.tipo && r.status === 'concluido' && r.id !== g.id && r.messageId !== e.messageId && normCart(r.carteira || '') === cartSem && new Date(r.concluidoEm || r.atualizadoEm || 0) >= ini && ['autorizada', 'parcial'].includes(resultadoDe(r)));
    p.itens.forEach(it => {
      const r = daSemana.find(x => (x.itens || []).some(i => i.c === it.codigo && i.aut !== false));
      if (r) add('dup-semana', `O código ${it.codigo} já foi autorizado para esta carteira nesta semana: guia ${r.guia || 'sem número'} em ${fmtDH(r.concluidoEm)}${r.operador ? ' por ' + r.operador : ''}${r.clinica ? ' (' + r.clinica + ')' : ''}. Confira se não é pedido repetido.`, { sub: it.codigo });
    });
  }
  /* e-mail */
  if (!cl) add('remetente', `Remetente ${e.remetente.email || '(sem endereço)'} não está no cadastro de clínicas.`, { vincular: true });
  else {
    if (S.clinicaComo === 'manual') add('rem-manual', `Clínica escolhida manualmente (${cl.nome}); o remetente ${e.remetente.email} não está no cadastro dela.`);
    const ta = tokens(e.assunto);
    if (ta.length && !tokens(cl.nome + ' ' + (cl.apelidos || '')).some(t => ta.includes(t))) add('assunto', `O assunto ("${e.assunto}") não cita ${cl.nome}, a clínica do remetente.`);
  }
  if (/^\s*(re|res|enc|fw|fwd|tr)\s*:/i.test(e.assunto)) add('resposta', 'Assunto de resposta ou encaminhamento. Verifique se é correção, cobrança ou pedido novo antes de gerar guia.');
  if (e.responderPara && e.responderPara.email && e.responderPara.email !== e.remetente.email) add('replyto', `A resposta irá para ${e.responderPara.email}, diferente do remetente ${e.remetente.email}.`);
  if (e.cortado) add('cortado', 'Mensagens anteriores da conversa foram ignoradas na leitura (em cinza no e-mail).');
  if (e.origem === 'colado') add('colado', 'Texto colado: remetente informado à mão, sem verificação pelo cabeçalho do e-mail.');
  /* duplicidade */
  Reg.cache.filter(r => !r.tipo && r.messageId === e.messageId && r.atendimentoId !== S.atendId && r.status !== 'descartado').slice(0, 1).forEach(r =>
    add('mesmo-email', `Este e-mail já tem registro de outro atendimento: ${r.operador || 'operador'} em ${fmtDH(r.atualizadoEm)} (${STATUS[r.status] || r.status}).`));
  if (/^[TS]\d{7,8}$/.test(g.numero)) {
    const o = Reg.cache.find(r => !r.tipo && r.guia === g.numero && r.id !== g.id);
    if (o) add('guia-repetida', `A guia ${g.numero} já foi registrada por ${o.operador || 'operador'} em ${fmtDH(o.atualizadoEm)} (${o.clinica || 'sem clínica'}). Confira o número.`);
  }
  /* cadastro de serviços da clínica (nunca cria cadastro, nunca troca o código) */
  if (cl) {
    const n = Object.keys(cl.codigos || {}).length;
    if (!n && p.itens.length) add('clinica-sem-codigos', `${cl.nome} ainda não tem códigos cadastrados; as descrições exibidas vêm do e-mail.`);
    p.itens.forEach(it => {
      const cad = descCadastro(cl, it.codigo);
      if (cad === undefined) add('cod-sem-cadastro', `Código ${it.codigo} sem cadastro para ${cl.nome}. A descrição do e-mail ("${it.desc || 'sem descrição'}") é usada como referência provisória.`, { sub: it.codigo, cadastrarCodigo: it.codigo });
      else if (divergeDesc(cad, it.desc)) add('cod-divergente', `Código ${it.codigo}: o e-mail descreve "${it.desc}", mas o cadastro de ${cl.nome} diz "${cad}". O código solicitado foi mantido.`, { sub: it.codigo });
    });
  }
  /* parametrização */
  const prm = cl && cartValida(g.carteiraUsada) ? Param.achar(cl.id, g.carteiraUsada) : null;
  if (cl && cartValida(g.carteiraUsada) && !prm && e.anexos.length) add('primeiro-atendimento', `O e-mail tem anexo (${e.anexos.join(', ')}) e ainda não existe parametrização para esta carteira em ${cl.nome}. Provável primeiro atendimento: use "Parametrizar" com os dados do pedido médico.`);
  if (prm) {
    const mp = norm(prm.medico), mn = norm(p.medico.nome);
    if (mp && mn && !mp.includes(mn) && !mn.includes(mp)) add('param-diverge', `O médico do e-mail (${p.medico.nome}) difere do parametrizado (${prm.medico}).`, { sub: 'medico' });
    if (prm.emissao && em.estado === 'valida' && isoDia(new Date(em.data)) !== prm.emissao) add('param-diverge', `A data do pedido no e-mail (${fmtData(em.data)}) difere da parametrizada (${diaBR(prm.emissao)}).`, { sub: 'data' });
    const comCod = prm.terapias.filter(t => t.codigo);
    if (comCod.length) p.itens.forEach(it => {
      const t = comCod.find(x => x.codigo === it.codigo);
      if (!t) add('param-servico', `O serviço ${it.codigo} não consta nas terapias parametrizadas desta carteira.`, { sub: it.codigo });
      else if (it.qtd != null && Number(t.qtd) && it.qtd > Number(t.qtd)) add('param-qtd', `Quantidade ${it.qtd} de ${it.codigo} acima da parametrizada (${t.qtd}).`, { sub: it.codigo });
    });
  }
  return A;
}
function situacaoGuia(g) {
  const A = avaliar(g);
  const bloqueios = A.filter(a => a.modo === 'bloqueio');
  return { A, bloqueios, obs: A.filter(a => a.modo === 'obs'), atencao: A.filter(a => a.modo === 'atencao'), pode: !bloqueios.length };
}
/* avisos de atenção que pedem o "Conferi" (os meramente informativos não) */
const pedeConferi = a => a.modo === 'atencao' && a.nivel !== 'info';
const atencaoPendente = (g, st) => st.A.filter(a => pedeConferi(a) && !(g.conf && g.conf[a.key]));
const cegaExigida = () => !!cfg.preferencias.conferenciaCega;
const podeFinal = (g, st) => st.pode && (!cegaExigida() || g.cega.ok);
const glosaDe = g => (g.resultado.glosa = g.resultado.glosa || { resp: null, itens: {} });
const guiasAtivas = () => S.guias.filter(x => x.status !== 'descartado');
const usaConsolidada = () => guiasAtivas().length > 1;
const ehUltima = g => S.guias.every(x => x === g || guiaTerminal(x));
const mostraResposta = g => !usaConsolidada() || ehUltima(g);
const guiaTerminal = g => ['concluido', 'aguardando_clinica', 'descartado'].includes(g.status);

/* ---------- Parametrização ---------- */
function paramDaGuia(g) { const cl = clinicaDe(S); return cl && cartValida(g.carteiraUsada) ? Param.achar(cl.id, g.carteiraUsada) : null; }
function textoParametrizacao(m) {
  const linhas = m.terapias.filter(t => t.descricao.trim()).map(t => renderModelo('parametrizacao_linha', { S, g: null, extra: { terapia: { descricao: t.descricao.trim(), qtd: String(t.qtd || '').trim() || '?' } } }).texto).join('\n');
  return renderModelo('parametrizacao', { S, g: null, extra: { param: { medico: m.medico.trim() || '(não informado)', data: m.data.trim() || 'SEM DATA', terapias: linhas || '(sem terapias)' } } }).texto;
}
/* Aplica uma parametrização existente: só preenche o que falta, e registra o fato */
function aplicarParametrizacao(g) {
  const prm = paramDaGuia(g); if (!prm) return false;
  const p = g.pedido, feitos = [];
  if (!p.medico.nome && !p.medico.crm && prm.medico) { p.medico = lerMedico(prm.medico); feitos.push('médico'); marcarOrigem(g, 'medico', 'param'); }
  if (p.emissao.estado === 'ausente' && prm.emissao) { p.emissao = lerEmissao(diaBR(prm.emissao), S.email.data); feitos.push('data do pedido'); marcarOrigem(g, 'emissao', 'param'); }
  p.itens.forEach(it => {
    const t = prm.terapias.find(x => (x.codigo && x.codigo === it.codigo) || (!x.codigo && it.desc && norm(x.descricao) === norm(it.desc)));
    if (!t) return;
    if (it.qtd == null && Number(t.qtd)) { it.qtd = Number(t.qtd); it.origemQtd = 'parametrizacao'; feitos.push('quantidade de ' + it.codigo); }
    if (!it.desc && t.descricao) { it.desc = t.descricao; feitos.push('descrição de ' + it.codigo); }
  });
  g.param = { id: prm.id, origem: 'aplicada', preenchido: feitos, em: agora() };
  return true;
}

/* ---------- Registro gravado (sem nome, CID ou médico) ---------- */
function resultadoParaRegistro(g) { const r = g.resultado; if (g.semGuia) return { situacao: 'sem_guia', modelo: g.semGuia }; const gl = glosaDe(g), temGlosa = (r.situacao === 'autorizada' || r.situacao === 'parcial') && gl.resp === 'sim', okI = new Set(itensGlosaveis(g).map(i => i.codigo));
  return { situacao: r.situacao, motivoId: r.motivoId || '', motivoTxt: r.motivoTxt || '', naoAut: r.naoAut, glosaResp: (r.situacao === 'autorizada' || r.situacao === 'parcial') ? gl.resp : null, glosas: temGlosa ? Object.entries(gl.itens).filter(([c]) => okI.has(c)).map(([c, x]) => ({ c, g: x.glosa || '', m: x.motivo || '' })) : [] }; }
const leituraCorrigida = g => !!(g.itensEditados || ['beneficiario', 'medico', 'cid', 'emissao', 'local'].some(k => ['digitado', 'aprendido'].includes((g.origem || {})[k])) || g.pedido.itens.some(i => ['digitado', 'aprendido'].includes(i.origemCod)));
function montarRegistro(g, status, extra = {}) {
  const p = g.pedido, cl = clinicaDe(S), A = avaliar(g), op = operadorObj();
  const neg = negadosDe(g).map(x => x.it.codigo);
  return {
    id: g.id, atendimentoId: S.atendId, idxGuia: g.idx, totalGuias: S.totalGuias || S.guias.length, versao: VERSAO,
    messageId: S.email.messageId, recebidoEm: S.email.data, assunto: S.email.assunto, remetente: S.email.remetente.email,
    clinica: cl ? cl.nome : null, clinicaId: cl ? cl.id : null, operador: g.reaberta && g.reaberta.operador ? g.reaberta.operador : op ? op.nome : '', operadorId: g.reaberta && g.reaberta.operador ? g.reaberta.operadorId : op ? op.id : null, abertoPor: g.abertoPor || (op ? op.nome : ''), dia: S.dia,
    abertoEm: g.abertoEm, vista: g.vista, leituraCorrigida: leituraCorrigida(g), pacienteIni: iniciais(g.pedido.beneficiario || ''), paciente: g.pedido.beneficiario || '', atualizadoEm: agora(), concluidoEm: status === 'concluido' ? agora() : null, status, etapa: g.etapa,
    carteira: g.carteiraUsada || p.carteira || null,
    itens: p.itens.map(i => ({ c: i.codigo, q: i.qtd, d: i.desc, dc: descCadastro(cl, i.codigo) ?? null, aut: status === 'concluido' && !g.semGuia ? !neg.includes(i.codigo) : null })),
    guia: g.semGuia ? null : (g.numero || null), resultado: status === 'concluido' ? resultadoParaRegistro(g) : null,
    parametrizado: g.param ? { id: g.param.id, origem: g.param.origem } : null,
    alertas: A.filter(a => a.modo !== 'bloqueio').map(a => ({ k: a.tipo, m: a.modo, t: a.texto, c: !!(g.conf && g.conf[a.key]) })),
    bloqueios: A.filter(a => a.modo === 'bloqueio').map(a => a.texto),
    conferencia: { tentativas: g.cega.tentativas, divergencias: g.cega.historico, ...(g.prints ? { prints: { ok: g.prints.ok, em: g.prints.em, divergencias: g.prints.divergencias } } : {}) },
    correcoes: (g.eventos || []).filter(e => EV_CORRECAO.includes(e.tipo)).length, ignorados: g.prints && g.prints.ign ? Object.keys(g.prints.ign).length : 0,
    editadoAMao: g.itensEditados, obsIncluidas: g.obsInc.length + g.respInc.length,
    duracaoSeg: g.reaberta ? (g.reaberta.duracaoAntes || 0) + Math.round((Date.now() - new Date(g.reaberta.em)) / 1000) : Math.round((Date.now() - new Date(g.abertoEm)) / 1000),   // reaberta: soma só o tempo da correção
    ...(g.reaberta ? { reaberta: { em: g.reaberta.em, por: g.reaberta.por, antes: g.reaberta.antes }, ...(g.reaberta.corrigida ? { corrigida: g.reaberta.corrigida } : {}) } : {}), ...extra
  };
}
async function gravarGuia(g, status, extra) {
  if (g.reaberta && status !== 'concluido') { g.status = status; return; }   // guia reaberta: o registro concluído só muda quando ela for concluída de novo
  g.status = status; await Reg.salvar(montarRegistro(g, status, extra));
  if (status !== 'em_andamento') await Aud.salvar(g, status);   // histórico detalhado da guia (prints, ignorados, copiados)
}
/* ---------- Reabrir uma guia concluída para corrigir (Painel, histórico da guia ou o próprio atendimento) ----------
   Reabrir não mexe no registro: ele continua como estava até a guia ser concluída de novo.
   Descartar o atendimento (ou Desistir da correção) deixa a guia como estava registrada. */
const podeReabrir = r => !!r && !r.tipo && r.status === 'concluido';   // guia da lista do dia reabre numa janela própria (nº da guia e Autorizar)
function marcarReaberta(g, r, de) {
  const copia = de === 'atendimento' ? clonar({ ...g, reaberta: null }) : null;   // para Desistir da correção no mesmo atendimento
  g.reaberta = { em: agora(), por: operador(), de, copia, operador: (r && r.operador) || '', operadorId: (r && r.operadorId) || null,
    duracaoAntes: (r && r.duracaoSeg) || 0, corrigida: (r && r.corrigida) || null,
    antes: { guia: (r ? r.guia : g.numero) || '', situacao: (r && r.resultado && r.resultado.situacao) || g.resultado.situacao || '', concluidoEm: (r && r.concluidoEm) || '' } };
  g.status = 'em_andamento'; g.vista = 4; g.etapa = Math.max(g.etapa || 0, 4);
  evento(g, 'reaberta', `Guia reaberta para correção${g.reaberta.antes.guia ? ' (nº ' + g.reaberta.antes.guia + ')' : ''}`);
}
/* monta o atendimento de novo a partir do e-mail guardado no histórico (auditoria) e do registro (que vale mais: tem as correções do Painel) */
function estadoReaberto(r, a) {
  const email = emailDeTexto(a.email.texto, a.email.remetente || r.remetente || '');
  Object.assign(email, { messageId: r.messageId || email.messageId, assunto: r.assunto || a.email.assunto || email.assunto, data: r.recebidoEm || a.email.recebidoEm || email.data, origem: 'reaberto' });
  const st = novoEstado(email); if (!st.guias.length) return null;
  const nc = normCart(r.carteira || ''), mesma = x => nc && normCart(x.pedido.carteira || x.carteiraUsada || '') === nc, porIdx = st.guias[r.idxGuia || 0];
  const g = (porIdx && mesma(porIdx) ? porIdx : st.guias.find(mesma)) || porIdx || st.guias[0];
  const p = g.pedido, ap = a.pedido || {}, res = r.resultado || {};
  Object.assign(g, { id: r.id, idx: r.idxGuia || 0, abertoEm: r.abertoEm || g.abertoEm, abertoPor: r.abertoPor || r.operador || g.abertoPor, carteiraUsada: r.carteira || a.carteiraUsada || g.carteiraUsada, itensEditados: !!r.editadoAMao,
    numero: r.guia || '', numeroOrigem: a.numeroOrigem || (r.guia ? 'digitado' : ''), semGuia: res.situacao === 'sem_guia' ? (res.modelo || null) : null, eventos: Array.isArray(a.eventos) ? a.eventos.slice() : [] });
  if (a.paciente || r.paciente) { p.beneficiario = a.paciente || r.paciente; p.beneficiarios = [p.beneficiario]; }
  if (ap.medico || ap.crm) { const nome = ap.medico || p.medico.nome || '', crm = ap.crm || p.medico.crm || ''; p.medico = { ...p.medico, nome, crm, bruto: [nome, crm ? `${p.medico.conselho || 'CRM'} ${crm}` : ''].filter(Boolean).join(' ') }; }
  if (ap.cid) p.cid = ap.cid; if (ap.local) p.local = ap.local; if (ap.emissao) p.emissao = lerEmissao(ap.emissao, email.data);
  if ((r.itens || []).length) p.itens = r.itens.map(i => { const x = p.itens.find(y => y.codigo === i.c); return { ...(x || { origemQtd: '' }), codigo: i.c, qtd: i.q ?? (x ? x.qtd : null), desc: (x && x.desc) || i.d || '' }; });
  Object.assign(g.resultado, { situacao: res.situacao && res.situacao !== 'sem_guia' ? res.situacao : null, motivoId: res.motivoId || '', motivoTxt: res.motivoTxt || '', naoAut: { ...(res.naoAut || {}) },
    obsAdicionais: (a.resultado && a.resultado.obsAdicionais) || '', glosa: { resp: res.glosaResp || null, itens: Object.fromEntries((res.glosas || []).map(x => [x.c, { glosa: x.g || '', motivo: x.m || '' }])) } });
  const cf = r.conferencia || {}; Object.assign(g.cega, { ok: true, via: 'reaberta', tentativas: cf.tentativas || 0, historico: cf.divergencias || [] });   // a grade já foi conferida quando a guia foi concluída
  if (r.parametrizado) g.param = { id: r.parametrizado.id, origem: r.parametrizado.origem };
  Object.assign(st, { atendId: r.atendimentoId || st.atendId, dia: r.dia || st.dia, totalGuias: r.totalGuias || 1, guias: [g], ativa: 0, vista: 4 });
  if (r.clinicaId && cfg.clinicas.some(c => c.id === r.clinicaId)) { st.clinicaId = r.clinicaId; st.clinicaSugerida = null; }
  marcarReaberta(g, r, 'painel');
  return st;
}
function htmlAvisoReaberta(g) {
  if (!g || !g.reaberta || g.status === 'concluido') return '';
  const an = g.reaberta.antes;
  return `<div class="aviso" role="status">${ic('edit')}<div class="esp"><b>Guia reaberta para correção</b> por ${esc(g.reaberta.por || '—')} às ${fmtHora(g.reaberta.em)}. O registro anterior${an.guia ? ` (nº <span class="num">${esc(an.guia)}</span>${an.situacao ? ', ' + esc(SIT_ROTULO[an.situacao] || an.situacao) : ''})` : ''} continua valendo até você clicar em <b>Concluir guia</b>.</div><button class="btn sm line" data-act="desistirReabertura">${ic('undo', 'sm')}Desistir da correção</button></div>`;
}
async function gravarTodas(status, soPendentes) { for (const g of S.guias) { if (soPendentes && guiaTerminal(g)) continue; await gravarGuia(g, status === 'descartado' ? 'descartado' : g.status); } }
const STATUS = { em_andamento: 'Em andamento', concluido: 'Concluída', cancelado: 'Cancelada', aguardando_clinica: 'Aguardando clínica', devolvido: 'Devolvido (legado)', descartado: 'Descartada' };

/* ---------- Textos gerados ---------- */
function problemasDe(g) { return avaliar(g).filter(a => a.modo === 'bloqueio').map(a => '• ' + (a.clinica || a.texto)).join('\n') || '• (descreva a pendência)'; }
function guiaAnterior(g) {
  const meus = new Set(g.pedido.itens.map(i => i.codigo));
  const r = Reg.cache.filter(x => !x.tipo && x.status === 'concluido' && x.carteira === g.carteiraUsada && x.messageId !== S.email.messageId && x.guia && (x.itens || []).some(i => meus.has(i.c))).sort((a, b) => (a.concluidoEm < b.concluidoEm ? 1 : -1))[0];
  if (!r) return null;
  return { guia: r.guia, data: fmtData(r.concluidoEm), itens: (r.itens || []).filter(i => meus.has(i.c)).map(i => `• ${i.c} – ${i.dc || i.d || 'serviço'} – quantidade: ${i.q}`).join('\n') };
}
function extrasSemGuia(g, modelo) {
  const e = {};
  if (modelo === 'pendencia') e.problemas = problemasDe(g);
  if (modelo === 'ja_autorizado') { const a = guiaAnterior(g); if (a) e.anterior = a; }
  return e;
}
function respostaDaGuia(g, marcar) {
  if (g.semGuia && !usaConsolidada()) {
    const r = renderModelo(g.semGuia, ctxDe(g, extrasSemGuia(g, g.semGuia)), { marcar });
    let html = r.html; g.respExtras.forEach(x => { html += x.html; });
    return { modelo: g.semGuia, html, texto: htmlPlano(html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')), faltando: r.faltando };
  }
  const sit = g.resultado.situacao;
  const k = usaConsolidada() ? 'resposta_multipla' : sit === 'parcial' ? 'parcial' : sit === 'nao' ? 'nao_autorizada' : (g.usarCorrecao ? 'correcao' : 'autorizada');
  const r = renderModelo(k, ctxDe(g), { marcar });
  let html = r.html;
  g.respExtras.forEach(x => { html += x.html; });
  return { modelo: k, html, texto: htmlPlano(html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')), faltando: r.faltando };
}
function observacaoDaGuia(g) {
  const base = renderModelo('observacao', ctxDe(g)).texto;
  return [base, ...g.obsExtras.map(x => x.texto)].join('\n');
}
