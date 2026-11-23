'use strict';
/* ====================================================================
   Leitura de .eml (MIME)
   ==================================================================== */
function bin2bytes(s) { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
function bytes2bin(u) { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return s; }
function decodificar(bytes, charset) {
  let cs = String(charset || 'utf-8').toLowerCase().replace(/["']/g, '').trim();
  if (cs === 'us-ascii' || cs === 'ascii') cs = 'windows-1252';
  try { return new TextDecoder(cs).decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
}
function talvezUtf8(s) {
  if (!/[\x80-\xff]/.test(s) || /[^\x00-\xff]/.test(s)) return s;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bin2bytes(s)); } catch (e) { return s; }
}
function decodificarPalavras(s) {
  if (!s) return '';
  s = s.replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?)/g, '$1');
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
    let bin;
    if (enc.toUpperCase() === 'B') { try { bin = atob(txt); } catch (e) { return m; } }
    else bin = txt.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)));
    return decodificar(bin2bytes(bin), cs.split('*')[0]);
  });
}
function parseCabecalhos(txt) {
  const h = {};
  txt.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => {
    const i = l.indexOf(':'); if (i <= 0) return;
    const k = l.slice(0, i).trim().toLowerCase(); (h[k] = h[k] || []).push(l.slice(i + 1).trim());
  });
  return h;
}
function parseCT(v) {
  const tipo = (v.split(';')[0] || 'text/plain').trim().toLowerCase();
  const params = {};
  for (const m of v.matchAll(/([\w*-]+)\s*=\s*("([^"]*)"|[^;\s]+)/g)) params[m[1].toLowerCase().replace(/\*.*$/, '')] = m[3] != null ? m[3] : m[2];
  return { tipo, params };
}
function parseParte(raw) {
  let cab, corpo;
  if (/^\r?\n/.test(raw)) { cab = ''; corpo = raw.replace(/^\r?\n/, ''); }
  else { const m = raw.match(/\r?\n\r?\n/); cab = m ? raw.slice(0, m.index) : raw; corpo = m ? raw.slice(m.index + m[0].length) : ''; }
  const h = parseCabecalhos(cab);
  const ct = parseCT((h['content-type'] || ['text/plain'])[0]);
  const parte = { h, tipo: ct.tipo, params: ct.params, corpo, partes: [] };
  if (ct.tipo.startsWith('multipart/') && ct.params.boundary) {
    const segs = corpo.split('--' + ct.params.boundary);
    for (let i = 1; i < segs.length; i++) {
      let s = segs[i]; if (s.startsWith('--')) break;
      s = s.replace(/^[ \t]*\r?\n/, '').replace(/\r?\n$/, '');
      parte.partes.push(parseParte(s));
    }
  } else if (ct.tipo === 'message/rfc822') {
    parte.partes.push(parseParte(corpo));
  }
  return parte;
}
function corpoTexto(p) {
  const enc = ((p.h['content-transfer-encoding'] || [''])[0]).toLowerCase().trim();
  let bin = p.corpo;
  if (enc === 'quoted-printable') bin = bin.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)));
  else if (enc === 'base64') { try { bin = atob(bin.replace(/[^A-Za-z0-9+/=]/g, '')); } catch (e) { } }
  return decodificar(bin2bytes(bin), p.params.charset);
}
function coletarPartes(p, out) {
  if (p.partes.length) { p.partes.forEach(x => coletarPartes(x, out)); return; }
  const disp = (p.h['content-disposition'] || [''])[0];
  const nomeM = disp.match(/filename\*?=\s*"?([^";]+)"?/i) || ((p.h['content-type'] || [''])[0]).match(/name\*?=\s*"?([^";]+)"?/i);
  const nome = nomeM ? decodificarPalavras(nomeM[1]) : '';
  const ehAnexo = /^\s*attachment/i.test(disp) || (nome && !p.tipo.startsWith('text/') && !p.tipo.startsWith('image/'));
  if (ehAnexo) { out.anexos.push(nome || p.tipo); return; }
  if (p.tipo === 'text/plain' && out.plain == null) out.plain = corpoTexto(p);
  else if (p.tipo === 'text/html' && out.html == null) out.html = corpoTexto(p);
}
function htmlParaTexto(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,head,title').forEach(n => n.remove());
  const bloco = /^(P|DIV|TR|LI|H[1-6]|TABLE|UL|OL|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|PRE)$/;
  let s = '';
  (function andar(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) s += c.nodeValue.replace(/[ \t\r\n]+/g, ' ');
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { s += '\n'; continue; }
        const b = bloco.test(c.tagName);
        if (b) s += '\n';
        if (c.tagName === 'TD' || c.tagName === 'TH') s += (c.previousElementSibling ? '\t' : '');   // células separadas por tabulação: o leitor reconstrói a tabela
        andar(c);
        if (b) s += '\n';
      }
    }
  })(doc.body || doc.documentElement);
  return s;
}
function limparTexto(t) {
  return String(t || '').replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ').replace(/[​‌‍﻿]/g, '')
    .split('\n').map(l => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function endereco(v) {
  const m = v.match(/<([^>]+)>/);
  const email = (m ? m[1] : (v.match(/[\w.+'-]+@[\w.-]+/) || [''])[0]).trim().toLowerCase();
  let nome = (m ? v.slice(0, m.index) : '').trim().replace(/^"|"$/g, '').trim();
  return { nome, email };
}
function hashTexto(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function cortarHistorico(t) {
  const L = t.split('\n');
  for (let i = 1; i < L.length; i++) {
    const l = L[i].trim();
    const prox = [L[i + 1], L[i + 2], L[i + 3]].map(x => (x || '').trim());
    const corte =
      /^(-{2,}\s*)?(mensagem original|original message|mensagem encaminhada|forwarded message)/i.test(l) ||
      /^(em|on)\s.{4,}(escreveu|wrote)\s*:?$/i.test(l) ||
      (/^(de|from)\s*:/i.test(l) && prox.some(x => /^(enviad[ao]|sent|data|date|para|to|assunto|subject)\s*:/i.test(x))) ||
      (/^>/.test(l) && i > 2);
    if (corte) return { principal: L.slice(0, i).join('\n').trim(), restante: L.slice(i).join('\n'), cortado: true };
  }
  return { principal: t.trim(), restante: '', cortado: false };
}
function lerEml(buf) {
  const raw = bytes2bin(new Uint8Array(buf));
  const raiz = parseParte(raw);
  const out = { plain: null, html: null, anexos: [] };
  coletarPartes(raiz, out);
  const H = n => decodificarPalavras(talvezUtf8((raiz.h[n] || [''])[0])).trim();
  let texto = out.plain != null && out.plain.trim() ? out.plain : (out.html != null ? htmlParaTexto(out.html) : (out.plain || ''));
  texto = limparTexto(texto);
  const remetente = endereco(H('from'));
  const responderPara = H('reply-to') ? endereco(H('reply-to')) : null;
  const d = new Date(H('date'));
  const assunto = H('subject');
  const messageId = H('message-id') || ('sem-id-' + hashTexto(remetente.email + H('date') + assunto + texto.slice(0, 500)));
  const corte = cortarHistorico(texto);
  return {
    messageId, data: isNaN(d) ? null : d.toISOString(), remetente, responderPara, assunto,
    textoCompleto: texto, textoPrincipal: corte.principal, restante: corte.restante, cortado: corte.cortado,
    anexos: out.anexos, origem: 'eml'
  };
}
function emailDeTexto(texto, remetenteTxt) {
  texto = limparTexto(texto);
  const corte = cortarHistorico(texto);
  return {
    messageId: 'colado-' + hashTexto(texto), data: new Date().toISOString(), remetente: endereco(remetenteTxt || ''), responderPara: null,
    assunto: '(colado manualmente)', textoCompleto: texto, textoPrincipal: corte.principal, restante: corte.restante, cortado: corte.cortado,
    anexos: [], origem: 'colado'
  };
}

/* E-mail aberto no webmail (extensão do Chrome): mesmo formato devolvido por lerEml */
function emailDeWebmail(m) {
  const html = m.html || '';
  let texto = (m.plain && m.plain.trim()) ? m.plain : (html ? htmlParaTexto(html) : '');
  texto = limparTexto(texto);
  const corte = cortarHistorico(texto);
  const remetente = endereco(m.fromEmail ? `${m.fromNome || ''} <${m.fromEmail}>` : (m.fromNome || ''));
  const cand = [m.data, ...(m.datas || [])].filter(Boolean);
  let d = null; for (const c of cand) { const x = new Date(c); if (!isNaN(x)) { d = x; break; } }
  if (!d && m.dataTexto) { const t = m.dataTexto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/); if (t) d = new Date(+t[3], +t[2] - 1, +t[1], +t[4], +t[5]); }
  const assunto = m.assunto || '';
  const messageId = m.messageId || ('sm-' + hashTexto((m.folder || '') + '|' + (m.uid || '') + '|' + remetente.email + assunto + texto.slice(0, 300)));
  return {
    messageId, data: (d || new Date()).toISOString(), remetente, responderPara: null, assunto,
    textoCompleto: texto, textoPrincipal: corte.principal, restante: corte.restante, cortado: corte.cortado,
    anexos: (m.anexos || []).map(String), origem: 'webmail'
  };
}

/* ZIP (para conciliação) — suporta armazenado e deflate */
async function lerZip(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Arquivo ZIP inválido.');
  const total = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const saida = [];
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nomeB = u.subarray(p + 46, p + 46 + nl);
    const nome = (flags & 0x800) ? new TextDecoder().decode(nomeB) : bytes2bin(nomeB);
    p += 46 + nl + el + cl;
    if (nome.endsWith('/')) continue;
    const inicio = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const dados = u.slice(inicio, inicio + tam);
    let conteudo;
    if (metodo === 0) conteudo = dados.buffer;
    else if (metodo === 8) conteudo = await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    else continue;
    saida.push({ nome, dados: conteudo });
  }
  return saida;
}

/* ====================================================================
   Leitura do pedido
   ==================================================================== */
const ROTULOS = [
  ['local', /^(local(\s+d[aeo]s?\s+(emissao|pedido|atendimento|solicitacao)(\s+d[ao]\s+(pedido|emissao))?)?|origem\s+do\s+pedido)(?![a-z0-9])/],
  ['emissao', /^(data\s+(da\s+|de\s+|do\s+)?(emissao(\s+d[oa]\s+(pedido|encaminhamento|solicitacao|requisicao|receita)(\s+medico)?)?|pedido(\s+medico)?|solicitacao|encaminhamento|requisicao|receita)|emissao(\s+do\s+pedido)?|data)(?![a-z0-9])/],
  ['beneficiario', /^(benefici[a]ri[oa]s?|benef\b\.?|pacientes?|usuari[oa]|segurad[oa]|nome(\s+(completo(\s+d[oa]s?\s+(benefici[a]ri[oa]|paciente|usuari[oa]))?|d[oa]s?\s+(benefici[a]ri[oa]|paciente|usuari[oa])))?)(?![a-z0-9])/],
  ['carteira', /^((n[or°º.]*\s*)?(d[ao]s?\s+)?(carteir(a|inha)\b|cart\b\.?|matricula\b|cartao\b)(\s+(promedica|do\s+benefici[a]ri[oa]|do\s+paciente|do\s+plano))?|codigo\s+do\s+benefici[a]ri[oa])/],
  ['servico', /^(servicos?|procedimentos?|terapias?|codigos?(\s+(e\s+descricao\s+)?d[oa]s?\s+(servicos?|procedimentos?|terapias?))?|tuss)(\s+(solicitad[oa]s?|autorizad[oa]s?|a\s+autorizar))?\b/],
  ['quantidade', /^(quantidades?(\s+(semanal|mensal|por\s+semana|de\s+sess(oes|ao)))?|numero\s+de\s+sess(oes|ao)|qtd[es]?|quant|sess(oes|ao)|n[oru°º.]*\s*(de\s+)?sess(oes|ao))\b\.?/],
  ['medico', /^(nome\s+e\s+(crm|registro)\s+d[oa]\s+medic[oa](\s+solicitante)?|nome\s+d[oa]\s+medic[oa]|medic[oa]s?(\s+(solicitante|assistente|responsavel))?|dr[a]?(?:\.|\b)|doutor[a]?|solicitante|profissional(\s+solicitante)?|nome\s+do\s+medic[oa])(?![a-z0-9])/],
  ['cid', /^(cid(?:-?10|\s*10)?|diagnostico|hipotese\s+diagnostica)(?![a-z0-9])/],
  ['obs', /^(obs|observac(ao|oes))\b\.?/]
];
/* rótulos que dispensam os dois-pontos quando o valor tem o formato esperado (ex.: "CID F84", "Carteira 4122...") */
const VALOR_SEM_SEPARADOR = {
  carteira: /^\s+\d[\d\s.\-]{9,}/, cid: /^\s+(?:cid(?:[\s\-]*10)?\s*[:\-]?\s*)?[A-Za-z]\s?\d{2}/i, quantidade: /^\s*\d{1,3}\s*(?:x|vezes|sess|$)/i, emissao: /^\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/
};
const CART_RE = /(?<![\dA-Za-z])(?:\d[ ./\-]?){14}\d[ ./\-]?[A-Za-z0-9]{2}(?![\dA-Za-z])/;
function normUnidades(l) { let s = ''; for (let i = 0; i < l.length; i++) { const n = semAcento(l[i]).toLowerCase(); s += n.length ? n[0] : l[i]; } return s; }
function detectarRotulo(linhaOrig) {
  const limpa = linhaOrig.replace(/[*_ ]/g, ' ').replace(/\((a|o|as|os|s)\)/gi, '').replace(/^\s*(?:\d{1,2}\s*[.)\-]\s+)?[^\p{L}\p{N}]*/u, '').trim();
  const norm = normUnidades(limpa);
  for (const [k, re] of ROTULOS) {
    const m = norm.match(re);
    if (!m) continue;
    const resto = limpa.slice(m[0].length).replace(/^\s*\([^)]{1,60}\)/, '');   // "Número da carteira (sem traços ou pontos): …"
    if (/^\s*([:=\-–—]|$)/.test(resto)) return { k, valor: resto.replace(/^\s*[:=\-–—]\s*/, '').trim() };
    if (VALOR_SEM_SEPARADOR[k] && VALOR_SEM_SEPARADOR[k].test(resto)) return { k, valor: resto.trim() };
  }
  return null;
}
/* Vários campos na mesma linha ("Beneficiário: Maria | Carteira: 4122...") viram uma linha por campo */
const PALAVRAS_ROTULO = 'benefici[aá]ri[oa]s?|pacientes?|nome(?:\\s+d[oa]\\s+(?:benefici[aá]ri[oa]|paciente|m[eé]dic[oa]))?|carteir(?:a|inha)(?:\\s+promédica|\\s+promedica)?|cart\\.?|matr[ií]cula|servi[cç]os?|procedimentos?|terapias?|quantidades?|qtd[e]?|sess[õo]es|m[eé]dic[oa](?:\\s+solicitante)?|solicitante|cid(?:-?10)?|diagn[oó]stico|data(?:\\s+d[aeo]\\s+(?:emiss[aã]o|pedido(?:\\s+m[eé]dico)?|solicita[cç][aã]o))?|emiss[aã]o|local(?:\\s+d[aeo]\\s+(?:emiss[aã]o|pedido))?|obs(?:erva[cç][aã]o|erva[cç][oõ]es)?\\.?';
const RE_ROTULO_INLINE = new RegExp('(^|[\\s|;,])((?:' + PALAVRAS_ROTULO + ')\\s*:)', 'gi');
function explodirLinha(l) {
  const pos = []; let m; RE_ROTULO_INLINE.lastIndex = 0;
  while ((m = RE_ROTULO_INLINE.exec(l))) pos.push(m.index + m[1].length);
  if (pos.length < 2) return [l];
  const out = []; if (pos[0] > 0 && l.slice(0, pos[0]).trim()) out.push(l.slice(0, pos[0]).trim());
  pos.forEach((ini, i) => out.push(l.slice(ini, i + 1 < pos.length ? pos[i + 1] : l.length).replace(/[\s|;,]+$/, '').trim()));
  return out;
}
/* links de e-mail ("[ https://… | CID ]" ou "[texto](https://…)") ficam só com o texto visível */
const limparLinks = t => t.replace(/\[\s*https?:\/\/[^\]|]*\|\s*([^\]]*?)\s*\]/gi, '$1').replace(/\[([^\]]+)\]\(\s*https?:\/\/[^)]*\)/gi, '$1');
const explodirTexto = t => limparLinks(t).split('\n').flatMap(explodirLinha).join('\n');
function secionar(texto) {
  const secoes = [{ k: null, linhas: [] }];
  for (const l of texto.split('\n')) {
    const r = detectarRotulo(l);
    if (r) secoes.push({ k: r.k, linhas: [r.valor] });
    else if (/^\s*[●•▪■◦]/.test(l) && secoes[secoes.length - 1].k) secoes.push({ k: null, linhas: [l.replace(/[*_●•▪■◦]/g, ' ').trim()] });   // "● CID ..." não é continuação do "● Médico:" vazio
    else secoes[secoes.length - 1].linhas.push(l.replace(/[*_]/g, ' ').trim());
  }
  return secoes;
}
const primeiraLinha = s => ((s && s.linhas.find(x => x.trim())) || '').trim().replace(/[.;,]+$/, '').trim();
function extrairItens(bloco) {
  const ehData = c => /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])20\d\d$/.test(c);
  const ms = [...bloco.matchAll(/(?<![\dA-Za-z])(\d{8})(?!\d)/g)].filter(m => !ehData(m[1]));
  const SEM_FREQ = '(?!\\s*(?:por|\\/|ao|na)\\s*(?:semana|m[eê]s|dia))';
  const pats = [
    /(?<!\d)(\d{1,2})\s*[x×]\s*(?:(?:por|\/|na|ao)\s*)?semana/i,   // "10 sessões - 03 x por semana": vale a frequência semanal, mesmo com "Quantidade: 10" antes
    /\(?\s*(?:quantidades?|qtde?|quant)\.?\s*[:=\-–—]?\s*(\d{1,3})\s*\)?/i,
    /(?<!\d)(\d{1,2})\s*(?:sess(?:[õo]es|[ãa]o)|vezes|atendimentos?|consultas?)\b/i,
    new RegExp('(?:^|\\s)[x×]\\s*(\\d{1,2})(?!\\d)' + SEM_FREQ, 'i'),
    new RegExp('(?<!\\d)(\\d{1,2})\\s*[x×](?=\\s|$)' + SEM_FREQ, 'i'),
    /[-–—:|]\s*(\d{1,2})\s*(?:sess(?:[õo]es|[ãa]o))?\s*\.?\s*$/im,
    /\(\s*(\d{1,2})\s*\)\s*\.?\s*$/m
  ];
  /* "DESCRIÇÃO - 80000001" (descrição antes do código, código no fim da linha): a descrição é o texto antes do código */
  const lin = m => { const ini = bloco.lastIndexOf('\n', m.index - 1) + 1, fim = bloco.indexOf('\n', m.index); return { antes: bloco.slice(ini, m.index), depois: bloco.slice(m.index + 8, fim < 0 ? bloco.length : fim) }; };
  const ctx = ms.map(lin);
  const descPrimeiro = ms.length > 0 && ctx.every(x => /[A-Za-zÀ-ÿ]{3,}/.test(x.antes) && !/:\s*$/.test(x.antes.trim()) && !x.depois.replace(/[*_.\-–—\s]/g, ''));
  const itens = ms.map((m, k) => {
    // com a descrição antes do código, a quantidade fica no resto da linha ou nas linhas seguintes, até a linha do próximo código
    const seg = descPrimeiro
      ? ctx[k].depois + bloco.slice((bloco.indexOf('\n', m.index) < 0 ? bloco.length : bloco.indexOf('\n', m.index)), k + 1 < ms.length ? bloco.lastIndexOf('\n', ms[k + 1].index - 1) + 1 : bloco.length)
      : bloco.slice(m.index + 8, k + 1 < ms.length ? ms[k + 1].index : bloco.length);
    let qtd = null, qm = null;
    for (const p of pats) { qm = seg.match(p); if (qm) { qtd = Number(qm[1]); break; } }
    let origem = qtd != null ? 'linha' : null;
    let desc = descPrimeiro ? ctx[k].antes.replace(/^[\s*_\-–—•●·]+/, '') : ((qm ? seg.slice(0, qm.index) : seg).split('\n').map(x => x.trim()).filter(Boolean)[0] || '');
    if (qtd == null && descPrimeiro) {
      const a = ctx[k].antes.match(/(?<!\d)(\d{1,2})\s*[x×]\s*(?:(?:por|\/|na|ao)\s*)?semana\w*|(?<!\d)(\d{1,2})\s*[x×](?![A-Za-z\d])|\(\s*(\d{1,2})\s*\)/i);
      if (a) { qtd = Number(a[1] || a[2] || a[3]); origem = 'linha'; desc = desc.replace(a[0], ' ').replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ').replace(/[\s\-–—]+$/, ''); }
    }
    if (qtd == null) {   // último recurso: número solto no fim da própria linha do serviço ("80000004 Terapia 2")
      const fim = desc.match(/^(.*\D)\s+(\d{1,2})$/);
      if (fim && fim[1].replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3) { qtd = Number(fim[2]); desc = fim[1]; origem = 'fim-da-linha'; }
    }
    desc = desc.replace(/\s+\d{4,6}\s*[-–]?\s*$/, '').replace(/\s+\d{1,3}\s*sess(?:[õo]es|[ãa]o)\b.*$/i, '').replace(/^[\s\-–—:|.]+/, '').replace(/[\s\-–—:|(.,]+$/, '').trim();
    return { codigo: m[1], desc, qtd, origemQtd: origem };
  });
  const invalidos = [...bloco.matchAll(/(?<!\d)(\d{5,7}|\d{9,12})(?!\d)/g)].map(m => m[1]);
  return { itens, invalidos };
}
const RE_CONSELHO_NUM = /\b(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b\s*(?:[-\/]?\s*[A-Z]{2}\b)?\s*[:\-nº°.]*\s*\d{3,7}/i;   // "CRM 1234", "CRM-BA 29341", "CRM/SE: 8797"
const UFS = 'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';
const RE_UF_DEPOIS = new RegExp('(\\d)\\s*[-\\/]?\\s*(?:' + UFS + ')(?![\\p{L}\\d])', 'gu');   // "15141-BA", "41345 BA": a UF depois do número não é nome
function lerMedico(bruto) {
  bruto = String(bruto || '').replace(/[*_]/g, ' ').replace(/\bRQE\b\s*[:\-nº°.]*\s*\d*/gi, ' ')   // RQE é a especialidade, não é nome nem CRM
    .replace(/([a-zà-ÿ])(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)(?=\s*[-\/:]?\s*(?:[A-Z]{2}\s*[:\-]?\s*)?\d)/g, '$1 $2')   // FariasCRM:50657
    .replace(RE_UF_DEPOIS, '$1 ').replace(/^\s*(?:o|a)\s+(?=(?:dr|dra|doutor|doutora)\b)/i, '');   // O Dr. Emanuel   // "CRM 18103 / RQE 10935 - LORENA": RQE é a especialidade, não é nome nem CRM
  const conselho = (bruto.match(/\b(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b/i) || [''])[0].toUpperCase();
  const dig = (bruto.match(/\d[\d.\s]{1,10}\d|\d{3,}/) || [''])[0].replace(/\D/g, '');
  const nome = bruto.replace(/(?<![\p{L}])(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)(?![\p{L}])/giu, ' ').replace(/(?<![\p{L}\d])[A-Z]{2}(?![\p{L}\d])(?=\s*[:\-\/]?\s*\d)/gu, ' ')
    .replace(/[\d.]+/g, ' ').replace(/[-–—:\/|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:dr|dra|doutor|doutora|prof|profa)\b\.?\s*/i, '');
  return { bruto, nome, crm: dig.length >= 3 ? dig : '', conselho };
}
const MESES_EXT = { janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12 };
const RE_DATA_EXT = /(?<!\d)(\d{1,2})\s*(?:º|°|o)?\s*(?:de\s+|\/|-|\.|\s)\s*(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s*(?:de\s+|\/|-|\.|\s)?\s*(\d{4}|\d{2})(?!\d)/i;
/* "5 de fevereiro de 2026" → "05/02/2026" (devolve '' se não houver data por extenso) */
function dataPorExtenso(t) {
  const m = (t || '').match(RE_DATA_EXT); if (!m) return '';
  const mes = MESES_EXT[semAcento(m[2]).toLowerCase()]; if (!mes) return '';
  const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${String(m[1]).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${a}`;
}
function lerEmissao(bruto, referencia) {
  const b = (bruto || '').trim();
  if (!b) return { estado: 'ausente', bruto: '' };
  if (/sem\s*data/i.test(b)) return { estado: 'sem_data', bruto: b };
  // "16 DE JULHO" (sem ano): usa o ano da data do e-mail, ou o anterior se a data cairia no futuro
  const dm = b.match(/(?<!\d)(\d{1,2})\s*(?:º|°)?\s*(?:de\s+)?(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?(?!\s*(?:de\s+|\/|-)?\s*\d)/i);
  if (dm && !/\d{1,2}\s*[\/.\-]\s*\d{1,2}/.test(b)) {
    const mes = MESES_EXT[semAcento(dm[2]).toLowerCase()], ref = referencia ? new Date(referencia) : new Date(); let a = ref.getFullYear();
    let dt = new Date(a, mes - 1, Number(dm[1])); if (dt.getDate() === Number(dm[1]) && dt > new Date(ref.getTime() + 7 * 864e5)) { a--; dt = new Date(a, mes - 1, Number(dm[1])); }
    if (dt.getDate() === Number(dm[1])) return { estado: 'valida', bruto: b, data: dt.toISOString(), futura: false, mesesAtras: (ref - dt) / (30.44 * 864e5), anoInferido: true };
  }
  const ext = dataPorExtenso(b);
  const m = (ext || b).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return { estado: 'invalida', bruto: b };
  let [, d, mo, a] = m.map(Number); if (a < 100) a += 2000;
  const dt = new Date(a, mo - 1, d);
  if (dt.getDate() !== d || dt.getMonth() !== mo - 1) return { estado: 'invalida', bruto: b };
  const ref = referencia ? new Date(referencia) : new Date();
  return { estado: 'valida', bruto: b, data: dt.toISOString(), futura: dt > ref, mesesAtras: (ref - dt) / (30.44 * 864e5) };
}
const RE_CABECALHO_NOME = /^(?:n[ºo°]?\s*)?(?:(?:carteira|nome|completo|beneficiario|paciente|usuario)\s*)+$/i;   // cabeçalho de tabela (Nº CARTEIRA  NOME COMPLETO), não nome
function lerPedido(texto, referencia) {
  texto = explodirTexto(texto);
  const secoes = secionar(texto);
  const de = k => secoes.filter(s => s.k === k);
  const p = { itens: [], invalidos: [], soltos: [], qtdUnicaAplicada: false, semRotulo: false, herdados: [] };
  p.beneficiarios = de('beneficiario').map(primeiraLinha).filter(Boolean);
  let cartDeLinha = false;
  p.beneficiario = p.beneficiarios[0] || '';
  p.carteiraBruta = primeiraLinha(de('carteira')[0]);
  if (!cartValida(normCart(p.carteiraBruta))) { const m = p.carteiraBruta.match(CART_RE) || (!p.carteiraBruta ? texto.match(CART_RE) : null); if (m) { if (!p.carteiraBruta) cartDeLinha = m[0]; p.carteiraBruta = m[0].trim(); } else if (!p.carteiraBruta) { const f = texto.match(/(?<![\dA-Za-z])\d{13,16}[A-Za-z]{0,3}(?![\dA-Za-z])/); if (f) { cartDeLinha = f[0]; p.carteiraBruta = f[0]; } } }
  if (!p.beneficiario && cartDeLinha) {   // linha livre: "NOME  carteira  código  serviço"
    const linha = texto.split('\n').find(l => l.includes(cartDeLinha)) || '';
    const nome = linha.slice(0, linha.indexOf(cartDeLinha)).replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (nome.replace(/[^\p{L}]/gu, '').length >= 3 && !RE_CABECALHO_NOME.test(semAcento(nome))) { p.beneficiario = nome; p.beneficiarios = [nome]; }
  }
  if (!p.beneficiario && cartDeLinha) {   // tabela "Nº CARTEIRA | NOME": carteira seguida do nome na mesma linha
    const linha = texto.split('\n').find(l => l.includes(cartDeLinha)) || '';
    const depois = linha.slice(linha.indexOf(cartDeLinha) + cartDeLinha.length);
    if (!/\d{8}/.test(depois)) {
      const nome = depois.replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (nome.split(' ').filter(w => w.length > 1).length >= 2 && nome.length <= 70) { p.beneficiario = nome; p.beneficiarios = [nome]; }
    }
  }
  if (p.beneficiario) {   // carteira escrita na mesma linha do nome: separa
    const m = p.beneficiario.match(CART_RE);
    if (m) { if (!p.carteiraBruta) p.carteiraBruta = m[0].trim(); p.beneficiario = p.beneficiario.replace(CART_RE, '').replace(/[\s\-–—,;|:()]*(cart\w*\.?)?[\s\-–—,;|:()]*$/i, '').trim(); p.beneficiarios[0] = p.beneficiario; }
  }
  if (!p.beneficiario && de('carteira').length) {   // nome sozinho na linha acima de "Carteira:"
    const L = texto.split('\n'); const i = L.findIndex(l => { const r = detectarRotulo(l); return r && r.k === 'carteira'; });
    for (let j = i - 1; j >= 0; j--) {
      const l = L[j].trim(); if (!l) continue; if (detectarRotulo(l)) break;
      const nome = l.replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (nome.split(' ').filter(w => w.length > 1).length >= 2 && nome.length <= 70 && !/\d/.test(l)) { p.beneficiario = nome; p.beneficiarios = [nome]; }
      break;
    }
  }
  const lc = normCart(p.carteiraBruta);
  p.carteira = cartValida(lc) ? lc : null;
  let medicoTxt = primeiraLinha(de('medico')[0]);
  const secMed = de('medico')[0];
  if (secMed) {   // "CONVÊNIO OU INSTITUIÇÃO ⏎ NOME DO MÉDICO ⏎ CRM-BA 12345" (Fortea): o nome é a linha logo acima do CRM, não a primeira
    const ls = secMed.linhas.map(x => x.trim()).filter(Boolean), k = ls.findIndex(l => RE_CONSELHO_NUM.test(l));
    if (k > 0) {   // nome antes do CRM na própria linha (PEDRO ALVES CRM-BA 6930) ou na linha de cima; depois do número vem a especialidade (CRM-17716 - ORTOPEDIA)
      const mc = ls[k].match(RE_CONSELHO_NUM), antes = ls[k].slice(0, mc.index), num = mc[0].replace(/\D/g, '');
      medicoTxt = lerMedico(antes).nome.replace(/[^\p{L}]/gu, '').length >= 4 ? `${antes} CRM ${num}` : `${ls[k - 1]} CRM ${num}`;
    }
  }
  let medicoPorDr = false;   // Dr. Edson, Dr.Juliana, O Dr. Emanuel: vale como médico (a leitura livre não troca)
  if (!medicoTxt) { const m = texto.match(/(?:^|\n)[ \t*_]*(?:[oa][ \t]+)?(?:dr|dra|doutor|doutora)\b[ \t]*[.:]?[ \t]*([A-ZÀ-Ýa-zà-ÿ][^\n]*)/i); if (m && lerMedico(m[1]).nome.split(' ').filter(w => w.length > 1).length >= 2) { medicoTxt = m[1].trim(); medicoPorDr = true; } }
  if (!medicoTxt) { const m = texto.match(/\bCRM\s*[:\-]?\s*(\d{3,7})[ \t]*([^\n]*)/i); if (m) medicoTxt = `${m[2].trim()} CRM ${m[1]}`.trim(); }
  p.medico = lerMedico(medicoTxt);
  if (p.medico.nome && !p.medico.crm) { const m = texto.match(/\bCRM\s*(?:[-\/]\s*[A-Z]{2}\b)?\s*[:\-]?\s*(\d{3,7})/i); if (m) { p.medico.crm = m[1]; p.medico.conselho = p.medico.conselho || 'CRM'; p.medico.bruto = `${p.medico.bruto} CRM ${m[1]}`.trim(); } }   // CRM em linha própria, abaixo do nome
  let cidTxt = primeiraLinha(de('cid')[0]);
  if (!cidTxt) { const m = texto.match(/\bCID(?:[\s\-]*10)?\s*[:\-]?\s*([A-Za-z])\s?(\d{2,3}(?:\.\d{1,2})?)/i); if (m) cidTxt = m[1] + m[2]; }
  if (cidTxt) {   // "CID 10 F84.0", "CID F 84.0 E F41.1": tira o rótulo repetido e junta os CIDs com " + "
    const cs = [...cidTxt.replace(/\bCID(?:[\s\-]*10)?\b\s*[:\-]?/gi, ' ').matchAll(/(?<![A-Za-z\d])([A-Za-z])\s?(\d{2}(?:\.\d{1,2}|\d)?)(?![\dA-Za-z])/g)].map(m => (m[1] + m[2]).toUpperCase());
    if (cs.length) cidTxt = unicos(cs).join(' + ');
  }
  cidTxt = cidTxt.replace(/(?<!\+)\s+(?!\+)/g, '');
  if (cidTxt && !/^[A-Za-z]\d{2}/.test(cidTxt) && /^\d{3,7}$/.test(cidTxt)) { // "CID : 31163" colado na linha do médico é, na verdade, o CRM
    if (!p.medico.crm) { p.medico.crm = cidTxt; p.medico.bruto = `${p.medico.bruto} CRM ${cidTxt}`.trim(); } cidTxt = '';
  }
  p.cid = cidTxt.toUpperCase();
  p.emissao = lerEmissao(primeiraLinha(de('emissao')[0]), referencia);
  if (p.emissao.estado === 'ausente' && /sem\s+data/i.test(texto)) p.emissao = lerEmissao('SEM DATA', referencia);
  if (p.emissao.estado === 'ausente') { const m = texto.replace(CART_RE, ' ').match(/(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d\d)(?!\d)/); if (m) p.emissao = lerEmissao(`${m[1]}/${m[2]}/${m[3]}`, referencia); }
  if (p.emissao.estado === 'ausente') { const ext = dataPorExtenso(texto.replace(CART_RE, ' ').split('\n').filter(l => !/escreveu|enviad[oa]|\bsent\b|\bàs\s+\d{1,2}:\d{2}|\bem\s+(seg|ter|qua|qui|sex|s[aá]b|dom)/i.test(l)).join('\n')); if (ext) p.emissao = lerEmissao(ext, referencia); }
  p.local = primeiraLinha(de('local')[0]);
  p.obs = de('obs').map(s => s.linhas.join(' ').trim()).filter(Boolean).join(' | ');
  const aplicarQtd = (lista, qsec) => {
    /* quantidade por código na própria seção ("50000470 (2x NA SEMANA)", um código por linha): cada serviço fica com a sua */
    const porCodigo = {};
    qsec.linhas.forEach(l => { const m = l.match(/(?<![\dA-Za-z])(\d{8})(?!\d)(.*)$/); if (!m) return; const q = m[2].match(/(?<!\d)(\d{1,2})\s*[x×]/i) || m[2].match(/(?<![\d,./:-])(\d{1,2})(?![\d,./:])/); if (q && porCodigo[m[1]] == null) porCodigo[m[1]] = Number(q[1]); });
    const semQtd = lista.filter(it => it.qtd == null);
    if (semQtd.some(it => porCodigo[it.codigo] != null)) { semQtd.forEach(it => { if (porCodigo[it.codigo] != null) { it.qtd = porCodigo[it.codigo]; it.origemQtd = 'campo'; } }); qsec.usada = true; return; }   // código sem quantidade na seção fica sem (o alerta pede para conferir)
    const lq = primeiraLinha(qsec), q = ((lq.match(/(?<!\d)(\d{1,2})\s*[x×]\s*(?:por|\/|na|ao)\s*semana/i) || lq.match(/\d+/) || [null, null])[1] ?? (lq.match(/\d+/) || [null])[0]);   // "10 sessões - 3 x por semana": vale o 3
    const sem = lista.filter(it => it.qtd == null);
    if (q != null && sem.length) { sem.forEach(it => { it.qtd = Number(q); it.origemQtd = 'campo'; }); if (sem.length > 1) p.qtdUnicaAplicada = true; qsec.usada = true; }
  };
  for (let i = 0; i < secoes.length; i++) {
    if (secoes[i].k !== 'servico') continue;
    const r = extrairItens(secoes[i].linhas.join('\n'));
    p.invalidos.push(...r.invalidos);
    for (let j = i + 1; j < secoes.length && secoes[j].k !== 'servico'; j++) if (secoes[j].k === 'quantidade' && !secoes[j].usada) { aplicarQtd(r.itens, secoes[j]); break; }
    p.itens.push(...r.itens);
  }
  if (!p.itens.length && !p.invalidos.length) {   // sem campo "Serviço" (ou com ele vazio, ex.: "TERAPIA SOLICITADA" no meio de uma frase)
    let livres = secoes.flatMap(s => s.k === null || s.k === 'obs' || s.k === 'servico' ? s.linhas : s.linhas.slice(1)).filter(l => /^\s*[^\p{L}\p{N}]*(?:\d{1,2}[.)]\s*)?\d{8}(?!\d)/u.test(l)
      || /\p{L}{3,}.*(?<![\dA-Za-z])\d{8,9}\s*[.;]?\s*$/u.test(l));   // lista "FONOAUDIOLOGO - 02 X SEMANAL - 80000008" (código no fim da linha)
    if (!livres.length && p.carteiraBruta) {   // código solto na mesma linha da carteira ("NOME carteira 50000616 FONO")
      livres = texto.split('\n').map(l => l.replace(CART_RE, ' ')).filter(l => /(?<![\dA-Za-z])\d{8}(?!\d)/.test(l)).map(l => l.slice(l.search(/(?<![\dA-Za-z])\d{8}(?!\d)/)));
    }
    const r = extrairItens(livres.join('\n'));
    if (r.itens.length) { p.semRotulo = true; p.itens = r.itens; p.invalidos.push(...r.invalidos.filter(c => c.length === 7 || c.length === 9)); }   // código com dígito a mais/menos na lista: vira alerta, não some
  }
  const qLivre = de('quantidade').filter(s => !s.usada);
  if (qLivre.length === 1 && p.itens.filter(i => i.qtd == null).length) aplicarQtd(p.itens, qLivre[0]);
  const usados = new Set(p.itens.map(i => i.codigo));
  const textoLivre = secoes.filter(s => !['carteira', 'medico', 'emissao', 'cid'].includes(s.k)).flatMap(s => s.linhas).join('\n');
  p.soltos = [...new Set([...textoLivre.matchAll(/(?<![\dA-Za-z])(\d{8})(?!\d)/g)].map(m => m[1]).filter(c => !usados.has(c)))];
  p.secoesEncontradas = [...new Set(secoes.map(s => s.k).filter(Boolean))];
  if (cartDeLinha) {   // sem rótulos ("NOME  CARTEIRA  CÓDIGO ..."): lê o que sobrou em texto livre
    const tem = k => de(k).some(x => primeiraLinha(x));
    aplicarLivre(texto, p, { medico: tem('medico') || medicoPorDr, cid: tem('cid') && /^[A-Za-z]\d{2,3}(\.\d)?$/.test(p.cid), local: tem('local'), emissao: tem('emissao') });
  }
  return p;
}


/* ====================================================================
   Vários beneficiários e várias solicitações no mesmo e-mail
   - Cada beneficiário (ou cada pedido do mesmo beneficiário, com médico/data próprios) vira uma guia independente.
   - Dados comuns a todos (médico, CID, data, local) escritos uma única vez fora dos blocos são aplicados
     apenas onde faltam, e o sistema avisa (alerta "Dados comuns"). Serviços e quantidades nunca são herdados.
   ==================================================================== */
const chaveBenef = p => norm(p.beneficiario) || (p.carteira ? 'c:' + p.carteira : '');
const RE_SEPARADOR = /^\s*(?:[-_=*#~.]{4,}|(?:paciente|benefici[aá]ri[oa]|solicita[cç][aã]o|pedido)\s*(?:n[ºo°.]*\s*)?\d+\s*[:.)\-]?)\s*$/i;
function rotulosDe(linhas) { return linhas.map(l => { const r = detectarRotulo(l); return r ? r.k : null; }); }
const contar = (ks, k) => ks.filter(x => x === k).length;
/* divide uma lista de linhas em blocos que começam a cada repetição do rótulo "abridor" */
function dividirPor(linhas, ks, tipos, cabecalhoCompartilhado) {
  const cont = Object.fromEntries(tipos.map(t => [t, contar(ks, t)]));
  const repetidos = tipos.filter(t => cont[t] >= 2);
  if (!repetidos.length) return null;
  const primeiro = ks.findIndex(k => repetidos.includes(k));
  const abridor = ks[primeiro];
  let inicios = ks.map((k, i) => (k === abridor ? i : -1)).filter(i => i >= 0);
  if (abridor === 'carteira') {   // nome do paciente sozinho na linha logo acima de "Carteira:" pertence ao bloco que começa nela
    inicios = inicios.map((ini, n) => {
      let j = ini - 1; while (j >= 0 && !linhas[j].trim()) j--;
      if (j >= 0 && (n > 0 || true) && ks[j] == null && !/\d/.test(linhas[j]) && linhas[j].trim().split(/\s+/).length >= 2 && linhas[j].length <= 70 && !(n > 0 && j <= inicios[n - 1])) return j;
      return ini;
    });
  }
  const cab = linhas.slice(0, inicios[0]);
  return { cab, blocos: inicios.map((ini, j) => linhas.slice(ini, j + 1 < inicios.length ? inicios[j + 1] : linhas.length)) };
}
/* ---------- Tabelas (e-mail em HTML): as células chegam separadas por tabulação ---------- */
const ROT_CANON = { beneficiario: 'Beneficiário', carteira: 'Carteira', servico: 'Serviço', quantidade: 'Quantidade', medico: 'Médico', cid: 'CID', emissao: 'Emissão', local: 'Local', obs: 'Obs' };
function rotuloDeCelula(cel) {
  const n = normUnidades(cel.replace(/[*_]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/^[^\p{L}\p{N}]*/u, '').trim());
  if (/^especialidades?\b|^terapias?\b/.test(n)) return 'servico';
  if (/^sess(oes|ao)(\s+por\s+semana)?\b|^quant|^qtd|^qtde/.test(n)) return 'quantidade';
  for (const [k, re] of ROTULOS) if (re.test(n)) return k;
  return null;
}
function converterTabelas(texto) {
  const L = texto.split('\n'); if (!L.some(l => l.includes('\t'))) return texto;
  const out = [], compartilhados = []; let i = 0, haPacientes = false;
  while (i < L.length) {
    if (!L[i].includes('\t')) { out.push(L[i]); i++; continue; }
    const rows = []; let j = i;
    while (j < L.length && (L[j].includes('\t') || (!L[j].trim() && j + 1 < L.length && L[j + 1].includes('\t')))) { if (L[j].trim()) rows.push(L[j].split('\t').map(c => c.trim())); j++; }
    i = j;
    // um grupo de linhas com tabulação pode juntar várias tabelas: uma linha só de nomes de coluna abre uma nova tabela
    const ehCab = r => r.filter(Boolean).length >= 2 && r.filter(Boolean).every(c => rotuloDeCelula(c));
    const tabelas = []; rows.forEach((r, k) => { if (!tabelas.length || (k > 0 && ehCab(r))) tabelas.push([]); tabelas[tabelas.length - 1].push(r); });
    for (const tab of tabelas) {
      const vertical = tab.length && tab.every(r => r.length === 2) && rotuloDeCelula(tab[0][0]) && !ehCab(tab[0]);
      if (vertical) { tab.forEach(r => out.push(`${r[0]}: ${r[1]}`)); continue; }
      const cab = tab[0].map(rotuloDeCelula);
      if (cab.filter(Boolean).length < 2 && !cab.some(k => k === 'carteira' || k === 'beneficiario')) { tab.forEach(r => out.push(r.filter(Boolean).join('   '))); continue; }
      const temPac = cab.includes('beneficiario') || cab.includes('carteira');
      const blocos = tab.slice(1).filter(r => r.some(Boolean)).map(r => r.map((c, k) => c ? (cab[k] ? `${ROT_CANON[cab[k]]}: ${c}` : c) : '').filter(Boolean));
      if (temPac) { haPacientes = true; blocos.forEach(b => { out.push(...b); out.push('-----'); }); }
      else blocos.forEach(b => compartilhados.push(...b));
    }
  }
  if (compartilhados.length) {   // tabela só de serviços: vale para todos os pacientes da tabela anterior; o que vem depois da última tabela é rodapé comum
    if (!haPacientes) return [...out, ...compartilhados].join('\n');
    const blocos = []; let atual = [];
    out.forEach(l => { if (l === '-----') { blocos.push(atual); atual = []; } else atual.push(l); });
    const rodape = atual.filter(x => x.trim());
    return blocos.map(b => [...b, ...compartilhados].join('\n')).join('\n-----\n') + (rodape.length ? '\n-----\n' + rodape.join('\n') : '');
  }
  return out.join('\n');
}
/* códigos escritos com ponto ("5000.0616", "5.00.00.47-0", "50.000.470") viram os 8 dígitos */
function juntarCodigos(t) {
  return String(t || '').replace(/(?<![\d.\-\/])(\d)\.(\d{2})\.(\d{2})\.(\d{2})-(\d)(?![\d.\-\/])/g, '$1$2$3$4$5')
    .replace(/(?<![\d.\-\/])([1-9]0)\.(\d{3})\.(\d{3})(?![\d.\-\/])/g, '$1$2$3')
    .replace(/(?<![\d.\-\/,])(\d{4})\.(\d{4})(?![\d.\-\/,])/g, '$1$2');
}
/* carta com tabela em texto (ex.: Psiconeuro): cabeçalhos quebrados, carteira colada no nome, Dr: e CRM no meio da linha */
function arrumarCarta(t) {
  t = t.replace(/N[ºo°]\s*CARTEIRA\s+NOME\s*\n?\s*COMPLETO/gi, '\nNº CARTEIRA  NOME COMPLETO\n')
    .replace(/[ \t]*ESPECIALIDADE\s*SESS[ÃA]O\s+POR\s+SEMANA[ \t]*/gi, '\nESPECIALIDADE SESSÃO POR SEMANA\n')
    .replace(/(\d\s*[x×])[ \t]*\n[ \t]*(por\s+semana)/gi, '$1 $2')   // 03 x / por semana quebrado em duas linhas
    .replace(/((?:\d[ .\/-]?){14}\d[ .\/-]?[A-Z]{2})(?=[A-ZÀ-Ý][a-zà-ÿ])/g, '$1 ')   // 413100003688700-EQRita: carteira colada no nome
    .replace(/([^\s])[ \t]+(?=D[Rr][Aa]?[ \t]*[:.][ \t]*[A-ZÀ-Ý])/g, '$1\n')   // ... por semana Dr: Rômulo: o médico começa linha
    .replace(/([a-zà-ÿ])(CRM|CREMEB|CRP)(?=\s*[-\/:]?\s*(?:[A-Z]{2}\s*[:\-]?\s*)?\d)/g, '$1\n$2');   // FariasCRM:50657
  const L = t.split('\n');   // nome que continua na linha de baixo (... Gomes de / Jesus ...)
  for (let i = 0; i + 1 < L.length; i++) {
    const m = L[i + 1].match(/^\s*([A-ZÀ-Ý][a-zà-ÿ]+)(?=\s|$)/);
    if (m && CART_RE.test(L[i]) && /\s(?:de|da|do|das|dos|e)\s*$/i.test(L[i])) { L[i] = L[i].trimEnd() + ' ' + m[1]; L[i + 1] = L[i + 1].slice(m[0].length); }
  }
  return L.join('\n');
}
function lerPedidos(texto, referencia) {
  texto = converterTabelas(juntarCodigos(arrumarCarta(texto)));
  const L = texto.split('\n').flatMap(explodirLinha);
  /* 1) separadores explícitos (linhas de traços, "Paciente 2") */
  const comDados = [], compartilhado = [];
  /* 0) linhas livres, sem rótulos (ex.: "NOME  CARTEIRA  CÓDIGO" + linha de detalhes): cada linha com carteira abre um paciente */
  const reCart = new RegExp(CART_RE.source, 'i'), idxCart = L.map((l, i) => reCart.test(l) ? i : -1).filter(i => i >= 0);
  const livres = idxCart.length >= 2 && !rotulosDe(L).some(k => k === 'beneficiario' || k === 'carteira');
  if (livres) {
    if (idxCart[0] > 0) compartilhado.push(L.slice(0, idxCart[0]));
    idxCart.forEach((ini, k) => comDados.push(L.slice(ini, k + 1 < idxCart.length ? idxCart[k + 1] : L.length)));
  } else {
  const chunks = [[]];
  L.forEach(l => { if (RE_SEPARADOR.test(l)) chunks.push([]); else chunks[chunks.length - 1].push(l); });
  chunks.forEach(c => {
    const ks = rotulosDe(c);
    if (ks.some(k => k === 'beneficiario' || k === 'carteira')) comDados.push(c);
    else if (ks.includes('servico') && comDados.length) comDados[comDados.length - 1].push(...c);   // serviços depois de um traço continuam o mesmo paciente
    else compartilhado.push(c);
  });
  }
  /* 2) dentro de cada trecho, repetição de beneficiário/carteira abre um novo paciente */
  let pacientes = [];
  comDados.forEach(c => {
    const ks = rotulosDe(c);
    const div = dividirPor(c, ks, ['beneficiario', 'carteira'], true);
    if (div) {
      const ksc = rotulosDe(div.cab), ib = ksc.indexOf('beneficiario');
      if (ib >= 0) {   // beneficiário escrito uma vez, antes de várias carteiras/pedidos: vale para todos os blocos
        const nomeLinhas = div.cab.slice(ib).filter(l => l.trim());
        div.blocos = div.blocos.map(b => rotulosDe(b).includes('beneficiario') ? b : [...nomeLinhas, ...b]);
        div.cab = div.cab.slice(0, ib);
      }
      if (div.cab.some(l => l.trim())) compartilhado.push(div.cab); pacientes.push(...div.blocos);
    } else pacientes.push(c);
  });
  if (!pacientes.length) pacientes = [L];
  /* 3) mesmo paciente com vários pedidos (médico ou data repetidos): cabeçalho do paciente replicado em cada pedido */
  const blocosL = [];
  pacientes.forEach(pl => {
    const ks = rotulosDe(pl);
    if (contar(ks, 'medico') >= 2 || contar(ks, 'emissao') >= 2) {
      const div = dividirPor(pl, ks, ['servico', 'medico', 'emissao'], false);
      if (div && div.blocos.length >= 2) { div.blocos.forEach(b => blocosL.push([...div.cab, ...b])); return; }
    }
    blocosL.push(pl);
  });
  /* dados comuns escritos no rodapé do último bloco (depois dos serviços) e que nenhum outro bloco tem: ficam compartilhados */
  const comunsK = ['medico', 'cid', 'emissao', 'local'];
  if (blocosL.length >= 2) {
    const ult = blocosL[blocosL.length - 1], ksU = rotulosDe(ult);
    let fimId = -1; ksU.forEach((k, i) => { if (['beneficiario', 'carteira', 'servico', 'quantidade'].includes(k)) fimId = i; });
    const outros = blocosL.slice(0, -1).flatMap(b => rotulosDe(b));
    const manter = ult.slice(0, fimId + 1), movidas = [];
    let i = fimId + 1;
    while (i < ult.length) {
      const k = ksU[i];
      let j = i + 1; while (j < ult.length && ksU[j] == null) j++;
      if (comunsK.includes(k) && !outros.includes(k) && !ksU.slice(0, fimId + 1).includes(k)) movidas.push(...ult.slice(i, j)); else manter.push(...ult.slice(i, j));
      i = j;
    }
    // linhas sem rótulo logo após o último item (continuação de um serviço) já estão em "manter"
    if (movidas.length) { blocosL[blocosL.length - 1] = manter; compartilhado.push(movidas); }
  }
  const blocos = blocosL.map(b => { const t = b.join('\n'); return { texto: t, pedido: lerPedido(t, referencia) }; });
  /* 4) dados comuns fora dos blocos */
  let preambulo = false;
  if (blocos.length >= 2 && compartilhado.length) {
    const ctexto = compartilhado.map(c => c.join('\n')).join('\n');
    const ks = rotulosDe(ctexto.split('\n'));
    const comuns = ['medico', 'cid', 'emissao', 'local'];
    preambulo = ks.some(k => k && !comuns.includes(k) && k !== 'obs');
    const sh = lerPedido(ctexto, referencia);
    blocos.forEach(b => {
      const p = b.pedido;
      if (!p.medico.nome && !p.medico.crm && (sh.medico.nome || sh.medico.crm)) { p.medico = sh.medico; p.herdados.push('médico'); }
      if (p.emissao.estado === 'ausente' && sh.emissao.estado !== 'ausente') { p.emissao = sh.emissao; p.herdados.push('data do pedido'); }
      if (!p.cid && sh.cid) { p.cid = sh.cid; p.herdados.push('CID'); }
      if (!p.local && sh.local) { p.local = sh.local; p.herdados.push('local'); }
    });
  } else if (blocos.length < 2) {
    preambulo = false;
  }
  return { blocos, preambulo };
}
/* Metadados de relação entre as solicitações do mesmo e-mail */
function relacionarBlocos(blocos) {
  const ordem = [], contagem = {};
  blocos.forEach(b => { const k = chaveBenef(b.pedido) || ('vazio-' + Math.random()); b.chave = k; contagem[k] = (contagem[k] || 0) + 1; if (!ordem.includes(k)) ordem.push(k); });
  const vistos = {};
  blocos.forEach((b, i) => {
    vistos[b.chave] = (vistos[b.chave] || 0) + 1;
    b.multi = { total: blocos.length, distintos: ordem.length, mesmo: contagem[b.chave], ocorrencia: vistos[b.chave], excesso: ordem.indexOf(b.chave) >= MAX_BENEFICIARIOS };
  });
}
/* ====================================================================
   Leitura de texto livre (sem rótulos): "NOME  CARTEIRA  CÓDIGO  DESCRIÇÃO" seguido de linhas soltas com
   CRM, médico, CID, data e local, em qualquer ordem. Só preenche o que a leitura por rótulos deixou vazio.
   ==================================================================== */
const LOCAIS_CONHECIDOS = [
  'CIDADE BAIXA', 'CENTRO MEDICO CIDADE BAIXA', 'ESPACO BOM VIVER', 'IGUATEMI', 'ITAIGARA', 'PITUBA', 'BARRA', 'BROTAS', 'RIO VERMELHO', 'CAMINHO DAS ARVORES',
  'STIEP', 'IMBUI', 'PERNAMBUES', 'CABULA', 'COSTA AZUL', 'PARALELA', 'ONDINA', 'GRACA', 'CANDEAL', 'ARMACAO', 'PROCARDIACO', 'PRO CARDIACO', 'SANTA IZABEL', 'SANTA ISABEL',
  'CENTRO', 'LAURO DE FREITAS', 'CAMACARI', 'SIMOES FILHO', 'FEIRA DE SANTANA', 'ALAGOINHAS', 'SALVADOR'
];
const RE_LOCAL_FIM = new RegExp('(?:^|[\\s,;/-])((?:(?:CENTRO|CETRO|CENTR|CTR)\\.?\\s+(?:MEDICO|MED\\.?|M\\.?)\\s*|PROMEDICA\\s+|CLINICA\\s+|UNIDADE\\s+)?(?:' + [...LOCAIS_CONHECIDOS].sort((a, b) => b.length - a.length).map(x => x.replace(/ /g, '\\s+')).join('|') + '))\\s*[.,;]?\\s*$', 'i');

/* palavras de especialidade que sobram ao lado do código (não são médico nem local) */
const SERVICOS_PALAVRAS = ['TERAPIA OCUPACIONAL', 'PSICOPEDAGOGIA', 'FONOAUDIOLOGIA', 'FISIOTERAPIA', 'PSICOMOTRICIDADE', 'PSICOLOGIA', 'NUTRICIONISTA', 'NUTRICAO', 'ATENDENTE TERAPEUTICO', 'ABA DENVER', 'FONO', 'PSICO'];
const RE_SERVICO_INI = new RegExp('^(?:' + SERVICOS_PALAVRAS.map(x => x.replace(/ /g, '\\s+')).join('|') + ')\\b[\\s.\\-–]*', 'i');
function limparPeca(s) { return (s || '').replace(/[\/|;:,_*+]+/g, ' ').replace(/^[\s\-–—.()]+|[\s\-–—(]+$/g, '').replace(/\s+/g, ' ').trim(); }

/* devolve {crm, medico, cid, data, local, qtd} do que for possível ler no texto livre */
let REGRAS_LEITURA = {};   // regras da clínica do e-mail (Configurações › Clínicas), valem durante a leitura
/* linha de carta (frase), não dado: 2 ou mais palavras típicas de texto corrido */
const PROSA = new Set('venho meio desta solicitar solicito solicitamos autorizacao referente ressaltamos segue anexo laudo encaminhamento analise providencias cabiveis abaixo citado citada paciente atendimento terapeutico obs semana mes novo contando quantidade terapias solicitadas outra clinica contrato eventual'.split(' '));
const RE_ESPECIALIDADE = /^(?:ortopedi(?:a|sta)|pediatr(?:ia|a)|neuropediatr(?:ia|a)|neurologi(?:a|sta)|psiquiatr(?:ia|a)|cardiologi(?:a|sta)|clinic[oa] geral|geriatr(?:ia|a)|fisiatr(?:ia|a)|otorrinolaringologi(?:a|sta)|oftalmologi(?:a|sta)|genetica medica|medicina de familia)$/i;
const ehProsa = l => (semAcento(l).toLowerCase().match(/[a-z]+/g) || []).filter(w => PROSA.has(w)).length >= 2;
/* cabeçalho de tabela em texto (Nº CARTEIRA  NOME COMPLETO, ESPECIALIDADE SESSÃO POR SEMANA): só palavras de cabeçalho */
const CABECALHO = new Set('n no carteira nome completo especialidade especialidades sessao sessoes por semana codigo codigos servico servicos quantidade qtd beneficiario paciente terapia terapias descricao'.split(' '));
const ehCabecalho = l => { const w = semAcento(l).toLowerCase().match(/[a-z]+/g) || []; return w.length >= 2 && w.every(x => CABECALHO.has(x)); };
function lerLivre(texto, p, rot = {}) {
  const r = {}, regra = REGRAS_LEITURA || {};
  // nas linhas com rótulo ("Médico: ...", "Número da carteira: ...") fica só o valor: o nome do campo não é médico nem local
  const LT = texto.split('\n'), curta = l => (l.match(/\p{L}+/gu) || []).length <= 3 && !/\d/.test(l);
  const semRotulos = LT.filter((l, i) => !ehProsa(l) && !ehCabecalho(l) && !(i > 0 && ehProsa(LT[i - 1]) && curta(l))).map(l => { const r = detectarRotulo(l); return r ? '   ' + r.valor + '   ' : l; }).join('\n');   // frases da carta (Venho por meio desta...) não são médico nem local
  let t = '\n' + semRotulos.normalize('NFC').replace(/[*_●•·]/g, ' ').replace(/\[\s*https?:[^\]]*\]/g, ' ').replace(/\[\s*image\s*:[^\]]*\]/gi, ' ') + '\n';
  // 1) tira o que já foi lido: carteira, nome do beneficiário; o código e a palavra do serviço viram a marca ¶
  //    (logo depois do serviço algumas clínicas escrevem a quantidade, às vezes colada no CRM: "PSICOLOGIA 119741-")
  t = t.replace(new RegExp(CART_RE.source, 'gi'), ' ');
  if (p.carteiraBruta && p.carteiraBruta.length >= 10) t = t.split(p.carteiraBruta).join(' ');   // carteira com dígito a menos (digitada errada pela clínica) não é local
  if (p.beneficiario) t = t.replace(new RegExp(p.beneficiario.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'), ' ');
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (rot.medico && p.medico && p.medico.nome && p.medico.nome.length >= 3) t = t.replace(new RegExp('(?:\\b(?:dr|dra|doutor|doutora)\\b\\.?\\s*)?' + escRe(p.medico.nome.trim()).replace(/\s+/g, '\\s+'), 'i'), ' | ');   // médico já lido pelo rótulo
  p.itens.forEach(i => {
    const pal = ((i.desc || '').match(/^(?:[A-Za-zÀ-ÿ]{2,}[.\/-]?(?:\s+|$))+/) || [''])[0].replace(/\b(CID|CRM)\b.*$/i, '').trim();
    const re = new RegExp('(?<!\\d)' + i.codigo + '(?!\\d)\\s*[-–—:]?\\s*' + (pal ? '(?:' + escRe(pal).replace(/\s+/g, '\\s+') + ')?' : ''), 'i');
    t = t.replace(re, ' ¶ ');
  });
  p.invalidos.forEach(c => { t = t.split(c).join(' '); });
  const suspeito = t.match(/(?<![\dA-Za-z])(\d{7}|\d{9,12})(?!\d)/);   // código com dígito a mais ou a menos: não é CRM
  if (suspeito) { r.codigoSuspeito = suspeito[1]; t = t.replace(suspeito[1], ' '); }
  const valida = (d, m, a) => { const x = new Date(+a, +m - 1, +d); return +a >= 2000 && x.getDate() === +d && x.getMonth() === +m - 1; };
  const dt = (d, m, a) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  let m;
  // 2) CID colado no dia ("Z0001  10 2025" = CID Z00, data 01/10/2025)
  if ((m = t.match(/(?<![A-Za-zÀ-ÿ\d])([A-Z])(\d{2})(\d{2})\s+(\d{1,2})\s+(20\d\d)(?!\d)/)) && valida(m[3], m[4], m[5])) { r.cid = m[1] + m[2]; r.data = dt(m[3], m[4], m[5]); t = t.replace(m[0], ' '); }
  // 3) data: ddmmaaaa, dd/mm/aaaa, "dd mm aaaa" (com espaços ou quebra de linha) ou SEM DATA
  if (!r.data) {
    if ((m = t.match(/(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d\d)(?!\d)/))) { r.data = `${m[1]}/${m[2]}/${m[3]}`; t = t.replace(m[0], ' '); }
    else if ((m = t.match(/(?<!\d)(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?!\d)/))) { r.data = m[0]; t = t.replace(m[0], ' '); }
    else if ((m = t.match(/(\d{1,2})[ \t]*\n?[ \t]*\s(\d{1,2})\s+(20\d\d)(?!\d)/)) && valida(m[1], m[2], m[3])) { r.data = dt(m[1], m[2], m[3]); t = t.replace(m[0], ' '); }
    else if ((m = t.match(/\bsem\s+data\b/i))) { r.data = 'SEM DATA'; t = t.replace(m[0], ' '); }
  }
  t = t.replace(/(?<!\d)\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d?(?!\d)/g, ' ');   // data cortada ("19/05/2"): não é CRM nem quantidade
  t = t.replace(/(?<![\d\/])(?:0?[1-9]|1[0-2])[\/.\-](?:19|20)\d\d(?!\d)/g, ' ');   // mês/ano (11/2026): não é CRM
  // 4) CID: letra maiúscula isolada + 2 ou 3 dígitos; pode haver mais de um ("F32+F41.2", "F09/F41.8")
  if (!r.cid) {
    const cids = [];
    t = t.replace(/(?<![A-Za-zÀ-ÿ\d])(?:[Cc][Ii][Dd](?:-?10)?\s*[:\-]?\s*)?([A-Z])\s?(\d{2}(?:\.\d{1,2}|\d)?)(?![\dA-Za-z])/g, (x, l, n) => { cids.push(l + n); return ' '; });
    if (cids.length) r.cid = unicos(cids).join(' + ');
  }
  t = t.replace(/\bCID(?:-?10)?\b\s*[:\-]?/gi, ' ').replace(/[+]/g, ' ');
  // 5) quantidade logo depois do serviço; "1" colado no CRM ("119741-" = 1 + CRM 19741)
  const aposS = t.indexOf('¶');
  if (aposS >= 0) {
    const resto = t.slice(aposS + 1), sem = resto.split('\n')[0].match(/(?<!\d)0?(\d{1,2})\s*[x×]\s*(?:(?:por|\/|na|ao)\s*)?semana/i);
    if (sem) { r.qtd = Number(sem[1]); r.qtdServico = true; t = t.slice(0, aposS + 1) + resto.replace(/^[^\n]*/, l => l.replace(sem[0], ' ').replace(/(?<!\d)\d{1,3}\s*sess(?:[oõ]es|[aã]o)\b/i, ' ')); }   // 10 sessões - 03 x por semana: vale a frequência semanal
    else if ((m = resto.match(/^\s*\(?\s*0?(\d{1,2})\s*\)?(?=\s|$)(?!\s*[\/.]\d)/)) && !/^\s*\d{1,2}\s+\d{1,2}\s+20\d\d/.test(resto)) { r.qtd = Number(m[1]); r.qtdServico = true; t = t.slice(0, aposS + 1) + resto.replace(m[0], ' '); }
    else if ((m = resto.match(/^\s*1(\d{5})(?!\d)/)) || (regra.qtdColada && (m = resto.match(/^\s*1(\d{4})(?!\d)(?=\s*[-–])/)))) { r.qtd = 1; r.qtdServico = true; r.crm = m[1]; r.qtdColada = true; t = t.slice(0, aposS + 1) + resto.replace(m[0], ' | '); }
  }
  if ((m = t.match(/\b(?:qnt|qtd|qtde|quant|quantidade)\b\.?\s*[:=\-]?\s*0?(\d{1,3})?(?!\d)/i))) { if (r.qtd == null && m[1]) r.qtd = Number(m[1]); t = t.replace(m[0], ' '); }   // "Qnt: 1"
  if (r.qtd == null && (m = t.match(/\(\s*0?(\d{1,2})\s*\)/))) { r.qtd = Number(m[1]); t = t.replace(m[0], ' '); }   // "(1)", "(01)"
  t = t.replace(/\(\s*\d{0,2}\s*[ºo°]?\s*[A-Za-zÀ-ÿ ]{0,25}\)/g, ' ').replace(/\(\s*\d{0,2}\s*[ºo°]?\s*$/gm, ' ').replace(/^\s*[A-Za-zÀ-ÿ ]{0,25}\)/gm, ' ');   // "(1º ATENDIMENTO)", mesmo quebrado em duas linhas
  t = t.replace(/¶/g, ' ');
  // 6) CRM: número de 3 a 6 dígitos, de preferência com "CRM" na frente
  if (!r.crm) {
    m = t.match(/\b(?:CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b[\s:.\-]*(?:[A-Z]{2}\b[\s:.\-]*)?(\d{3,6})(?!\d)/i) || t.match(/(?<!\d)(?!(?:19|20)\d\d(?!\d))(\d{3,6})(?!\d)/);   // sem CRM na frente, um ano não vale
    if (m) {
      r.crm = m[1];
      if (r.qtd == null && /^1\d{5}$/.test(r.crm)) { r.qtd = 1; r.crm = r.crm.slice(1); r.qtdColada = true; }   // "CRM 120583" sem quantidade no e-mail: 1 + CRM 20583
      t = t.replace(m[0], ' | ');
    }
  }
  t = t.replace(/\b(?:CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b[\s:.\-]*/gi, ' | ').replace(new RegExp('\\|[\\s*]*[-\\/]?\\s*(?:' + UFS + ')(?![\\p{L}])', 'gu'), ' | ');   // CRM:15141-BA: a UF não é local
  t = t.replace(/(?<!\d)\d{1,2}\s*[x×]\s*(?:(?:por|\/|na|ao)\s*)?semana\b/gi, ' | ').replace(/(?<!\d)\d{1,3}\s*sess(?:[oõ]es|[aã]o)\b/gi, ' | ');   // 3X POR SEMANA, 10 sessões (já lidos na quantidade)
  // 7) quantidade solta (último recurso): 1 ou 2 dígitos isolados
  if (r.qtd == null) { const q = t.match(/(?:^|\s)0?(\d{1,2})(?=\s{2,}|\s*\n|\s*\|)/); if (q) r.qtd = Number(q[1]); }
  t = t.replace(/(?<![\dA-Za-z])\d{1,3}(?![\dA-Za-z])/g, ' ');   // números soltos que sobraram não fazem parte de nome nem de local
  // 8) peças de texto: separadas por linha, "|" ou 3+ espaços
  let servico = '';
  let pecas = t.split(/\n|\||\s{3,}/).map(limparPeca).map(x => { const s = semAcento(x).match(RE_SERVICO_INI); if (s) { servico = servico || x.slice(0, s[0].length).trim(); return limparPeca(x.slice(s[0].length)); } return x; }).filter(x => /[A-Za-zÀ-ÿ]{2}/.test(x));
  let medico = '', local = '';
  pecas = pecas.filter(x => !new RegExp('^(?:' + UFS + ')$', 'i').test(x.trim()) && !RE_ESPECIALIDADE.test(semAcento(x.trim())));   // UF solta e especialidade do médico (ORTOPEDIA) não são local
  const juntas = pecas.join(' '), J = semAcento(juntas).toUpperCase(), lm = J.match(RE_LOCAL_FIM);
  if (lm) {   // local conhecido no fim do texto (com "Centro Médico", "Promédica"... na frente)
    const ini = lm.index + lm[0].indexOf(lm[1]);
    local = limparPeca(juntas.slice(ini)); medico = limparPeca(juntas.slice(0, ini));
  } else if (pecas.length >= 2) { medico = pecas[0]; local = pecas.slice(1).join(' '); }
  else if (pecas.length === 1) medico = pecas[0];
  medico = medico.replace(/\s+\b[A-Z]\b\.?$/, '').trim();   // letra solta no fim (resto de CID) não é parte do nome
  // o médico precisa parecer nome de pessoa: 2+ palavras (ou 1 palavra + inicial)
  if (medico && (medico.split(' ').filter(w => w.length > 1).length < 2 && !/\b[A-ZÀ-Ý]\.?\b/.test(medico))) { if (!local) local = medico; medico = ''; }
  if (medico) r.medico = medico;
  if (local) r.local = local;
  if (servico) r.servico = servico;
  return r;
}

/* aplica o que a leitura livre achou só nos campos que ficaram vazios */
function aplicarLivre(texto, p, rot = {}) {
  const r = lerLivre(texto, p, rot);
  if (!rot.medico) {
    const nome = r.medico || p.medico.nome, crm = r.crm || p.medico.crm;
    if (r.medico || r.crm) p.medico = lerMedico(`${nome || ''}${crm ? ' CRM ' + crm : ''}`.trim());
  }
  if (!rot.cid && r.cid) p.cid = r.cid.toUpperCase();
  if (!rot.local && r.local) p.local = r.local;
  if (!rot.emissao && r.data && p.emissao.estado === 'ausente') p.emissao = lerEmissao(r.data, null);
  if (r.qtd != null && p.itens.length === 1 && (p.itens[0].qtd == null || (r.qtdServico && p.itens[0].origemQtd !== 'campo'))) { p.itens[0].qtd = r.qtd; p.itens[0].origemQtd = r.qtdColada ? 'colada-crm' : 'linha'; }
  if (r.codigoSuspeito) p.codigoSuspeito = r.codigoSuspeito;
  if (r.servico && p.itens.length === 1 && !p.itens[0].desc) p.itens[0].desc = r.servico.toUpperCase();
}
