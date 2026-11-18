import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* Mini-DOM leve sem dependências externas para exercitar sanitizar(), htmlParaTexto() e lerHtml() */
class MiniText {
  constructor(val) { this.nodeType = 3; this.nodeValue = String(val ?? ''); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
  set textContent(v) { this.nodeValue = String(v ?? ''); }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(x => x !== this); }
}

class MiniElement {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag || 'DIV').toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.style = { color: '' };
    this.dataset = {};
  }
  get classList() {
    const cls = () => (this.attrs.get('class') || '').split(/\s+/).filter(Boolean);
    return { contains: c => cls().includes(c), add: c => { if (!cls().includes(c)) this.attrs.set('class', [...cls(), c].join(' ')); } };
  }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const els = this.parentNode.children, i = els.indexOf(this);
    return i > 0 ? els[i - 1] : null;
  }
  setAttribute(k, v) {
    const kl = k.toLowerCase(), sv = String(v ?? '');
    this.attrs.set(kl, sv);
    if (kl.startsWith('data-')) this.dataset[kl.slice(5)] = sv;
    if (kl === 'style') { const m = sv.match(/color\s*:\s*([^;]+)/i); if (m) this.style.color = m[1].trim(); }
  }
  getAttribute(k) { return this.attrs.has(k.toLowerCase()) ? this.attrs.get(k.toLowerCase()) : null; }
  hasAttribute(k) { return this.attrs.has(k.toLowerCase()); }
  removeAttribute(k) { this.attrs.delete(k.toLowerCase()); }
  appendChild(n) {
    if (n.parentNode) n.remove();
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter(x => x !== this); this.parentNode = null; } }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v) { this.childNodes = v ? [new MiniText(v)] : []; this.childNodes.forEach(c => { c.parentNode = this; }); }
  get outerHTML() {
    const tag = this.tagName.toLowerCase();
    const at = [];
    if (this.style.color) at.push(`style="color: ${this.style.color}"`);
    for (const [k, v] of this.attrs) if (k !== 'style') at.push(`${k}="${v.replace(/"/g, '&quot;')}"`);
    const open = `<${tag}${at.length ? ' ' + at.join(' ') : ''}>`;
    if (tag === 'br' || tag === 'hr' || tag === 'img') return open;
    return open + this.innerHTML + `</${tag}>`;
  }
  get innerHTML() {
    return this.childNodes.map(c => c.nodeType === 3 ? c.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : c.outerHTML).join('');
  }
  set innerHTML(html) {
    this.childNodes = [];
    parseHtmlInto(String(html ?? ''), this);
  }
  matchesTag(sel) { return sel.split(',').some(s => s.trim().toUpperCase() === this.tagName); }
  querySelectorAll(sel) {
    const out = [];
    const walk = el => { for (const c of el.children) { if (c.matchesTag(sel)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function decEnt(s) {
  return s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
}
function parseHtmlInto(html, root) {
  const VOID = new Set(['BR', 'HR', 'IMG', 'META', 'LINK', 'INPUT']);
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[3] != null) { if (m[3]) stack[stack.length - 1].appendChild(new MiniText(decEnt(m[3]))); continue; }
    const closing = m[0].startsWith('</');
    const tag = m[1].toUpperCase();
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName === tag) { stack.length = i; break; }
      continue;
    }
    const el = new MiniElement(tag);
    const attrRe = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let am;
    while ((am = attrRe.exec(m[2] || ''))) el.setAttribute(am[1], decEnt(am[2] ?? am[3] ?? am[4] ?? ''));
    stack[stack.length - 1].appendChild(el);
    if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(el);
  }
}

class MiniDOMParser {
  parseFromString(str) {
    const docEl = new MiniElement('HTML');
    parseHtmlInto(String(str ?? ''), docEl);
    const body = docEl.querySelector('body') || docEl;
    return { documentElement: docEl, body, querySelectorAll: s => docEl.querySelectorAll(s), querySelector: s => docEl.querySelector(s) };
  }
}

function criarSandbox() {
  const store = new Map();
  const mkStorage = () => ({
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; }
  });
  const docRoot = new MiniElement('HTML');
  const documentStub = {
    documentElement: docRoot,
    body: new MiniElement('BODY'),
    activeElement: null,
    hidden: false,
    createElement: tag => new MiniElement(tag),
    createTextNode: txt => new MiniText(txt),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    contains: () => false
  };
  const ctx = {
    console, Math, Date, JSON, Map, Set, Promise, Uint8Array, Array, Object, String, Number, RegExp, Error,
    TextEncoder, TextDecoder, URL, Blob, crypto: globalThis.crypto,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    localStorage: mkStorage(), sessionStorage: mkStorage(),
    DOMParser: MiniDOMParser,
    document: documentStub,
    location: { origin: 'https://gerador-guia.vercel.app', href: 'https://gerador-guia.vercel.app/' },
    navigator: { clipboard: { writeText: async () => {} } },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    acoes: {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const arq of ['01-base.js', '02-email.js', '03-dados.js', '04-atendimento.js', '05-telas.js', '09-ferramentas.js']) {
    const p = path.join(ROOT, 'public', 'js', arq);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: arq });
  }
  ctx.eval = code => vm.runInContext(code, ctx);
  return ctx;
}

test('Sintaxe válida em todos os scripts JS e JSONs do projeto', () => {
  const jsPublic = fs.readdirSync(path.join(ROOT, 'public', 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'public', 'js', f));
  const jsExt = fs.readdirSync(path.join(ROOT, 'extensao')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'extensao', f));
  for (const f of [...jsPublic, ...jsExt]) {
    execFileSync(process.execPath, ['--check', f]);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extensao', 'manifest.json'), 'utf8'));
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(manifest.version, '1.3.0');
  assert.ok(vercel.headers[0].headers.some(h => h.key === 'Content-Security-Policy'));
});

test('lerEml e emailDeWebmail extraem remetente, Reply-To, assunto codificado e cortam histórico', () => {
  const ctx = criarSandbox();
  assert.equal(ctx.eval('VERSAO'), '2.2.0');
  assert.equal(ctx.eval('EXT_VERSAO'), '1.3.0');
  const rawEml = [
    'From: "Sistema Clinica" <no-reply@sistema.com.br>',
    'Reply-To: Autorizacoes Clinica Vida <aut@clinicavida.com.br>',
    'Subject: =?UTF-8?Q?Solicita=C3=A7=C3=A3o_de_Terapia?=',
    'Date: Mon, 16 Nov 2026 10:30:00 -0300',
    'Message-ID: <msg-123@clinicavida.com.br>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Benefici=C3=A1rio: JOAO PEDRO ALMEIDA',
    'Carteira: 412200000123456EQ',
    'Servi=C3=A7o: 50000470 - FONOAUDIOLOGIA - 10',
    'M=C3=A9dico: Dra. Helena Costa CRM 12345',
    '',
    '----- Mensagem original -----',
    'Texto antigo citado que nao deve entrar no pedido'
  ].join('\r\n');
  const buf = new TextEncoder().encode(rawEml).buffer;
  const email = ctx.lerEml(buf);
  assert.equal(email.assunto, 'Solicitação de Terapia');
  assert.equal(email.remetente.email, 'no-reply@sistema.com.br');
  assert.equal(email.responderPara.email, 'aut@clinicavida.com.br');
  assert.equal(email.cortado, true);
  assert.ok(!email.textoPrincipal.includes('Texto antigo citado'));

  const wm = ctx.emailDeWebmail({
    uid: 99, folder: 'Inbox', messageId: '<wm-1@promedica>', assunto: 'Pedido',
    fromNome: 'Clinica', fromEmail: 'envio@clinica.com.br', responderPara: 'retorno@clinica.com.br',
    plain: 'Beneficiário: MARIA SILVA\nCarteira: 412200000999888AB'
  });
  assert.equal(wm.responderPara.email, 'retorno@clinica.com.br');
});

test('pedidosDoEmail e lerPedidos interpretam múltiplos beneficiários e aplicam regras da clínica', () => {
  const ctx = criarSandbox();
  const clinica = {
    id: 'cl-1', nome: 'Clínica Teste', emails: ['aut@clinicateste.com.br'],
    codigos: { '50000470': 'SESSÃO DE FONOAUDIOLOGIA', '50000489': 'TERAPIA OCUPACIONAL' },
    leitura: { qtdPadrao: 4, completarCodigo: true, qtdColada: false, trocas: '50009999 = 50000489' }
  };
  const email = ctx.emailDeTexto([
    'Beneficiário: ANA CLARA SOUZA',
    'Carteira: 412200000111222AB',
    'Serviço: 50000470 - Fono',
    'Serviço: 50009999 - TO - 8',
    'Médico: Dr. Carlos Lima CRM 44556',
    'CID: F84.0',
    'Emissão: 10/11/2026',
    '-----',
    'Beneficiário: LUCAS MENDES',
    'Carteira: 412200000333444CD',
    'Serviço: 5000470 - Fono - 6',
    'Médico: Dr. Carlos Lima CRM 44556',
    'Emissão: 10/11/2026'
  ].join('\n'), 'aut@clinicateste.com.br');

  const lido = ctx.pedidosDoEmail(email, clinica);
  assert.equal(lido.blocos.length, 2);
  assert.equal(lido.blocos[0].pedido.beneficiario, 'ANA CLARA SOUZA');
  assert.equal(lido.blocos[0].pedido.itens[0].codigo, '50000470');
  assert.equal(lido.blocos[0].pedido.itens[0].qtd, 4); // aplicado por qtdPadrao
  assert.equal(lido.blocos[0].pedido.itens[1].codigo, '50000489'); // trocado de 50009999 -> 50000489
  assert.equal(lido.blocos[0].pedido.itens[1].qtd, 8);
  assert.equal(lido.blocos[1].pedido.beneficiario, 'LUCAS MENDES');
  assert.equal(lido.blocos[1].pedido.itens[0].codigo, '50000470'); // completado de 7 dígitos (5000470) -> 50000470
});

test('sanitizar bloqueia scripts/atributos perigosos e preserva formatação e tokens seguros', () => {
  const ctx = criarSandbox();
  const sujo = `<div>Olá <b>Clínica</b><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:evil()">link</a><span class="tok" data-k="BENEFICIARIO">tok</span><span style="color:#1e4678" onclick="bad()">azul</span></div>`;
  const limpo = ctx.sanitizar(sujo);
  assert.ok(!limpo.includes('<script'));
  assert.ok(!limpo.includes('onerror'));
  assert.ok(!limpo.includes('onclick'));
  assert.ok(!limpo.includes('javascript:'));
  assert.ok(limpo.includes('<b>Clínica</b>'));
  assert.ok(limpo.includes('{BENEFICIARIO}'));
  assert.ok(limpo.includes('color: #1e4678'));
});

test('Mesclagem concorrente SMB (juntarDocsReg / juntarDocsParam) e anonimização LGPD (> 180 dias)', async () => {
  const ctx = criarSandbox();
  const remReg = {
    operador: 'Tiago', dia: '2026-11-17', excluidos: ['r-del'],
    registros: [
      { id: 'r-1', atualizadoEm: '2026-11-17T10:00:00Z', status: 'em_andamento' },
      { id: 'r-del', atualizadoEm: '2026-11-17T09:00:00Z', status: 'em_andamento' }
    ]
  };
  const locReg = {
    operador: 'Tiago', dia: '2026-11-17', excluidos: [],
    registros: [
      { id: 'r-1', atualizadoEm: '2026-11-17T10:05:00Z', status: 'concluido', guia: 'T12345678' },
      { id: 'r-2', atualizadoEm: '2026-11-17T10:02:00Z', status: 'concluido', guia: 'T87654321' },
      { id: 'r-del', atualizadoEm: '2026-11-17T10:01:00Z', status: 'em_andamento' }
    ]
  };
  const mReg = ctx.juntarDocsReg(remReg, locReg);
  assert.equal(mReg.registros.length, 2);
  assert.equal(mReg.registros.find(r => r.id === 'r-1').status, 'concluido');
  assert.ok(!mReg.registros.some(r => r.id === 'r-del'));

  const mParam = ctx.juntarDocsParam(
    { versao: 2, itens: [{ id: 'p1', atualizadoEm: '2026-11-01T00:00:00Z', medico: 'Antigo' }, { id: 'p2', atualizadoEm: '2026-11-01T00:00:00Z' }], excluidos: ['p2'] },
    { versao: 2, itens: [{ id: 'p1', atualizadoEm: '2026-11-10T00:00:00Z', medico: 'Novo' }, { id: 'p2', atualizadoEm: '2026-11-05T00:00:00Z' }], excluidos: [] }
  );
  assert.equal(mParam.itens.length, 1);
  assert.equal(mParam.itens[0].medico, 'Novo');
  assert.ok(mParam.excluidos.includes('p2'));

  // Anonimização LGPD em registros locais > 180 dias
  const LS = ctx.eval('LS'), Reg = ctx.eval('Reg');
  LS.set('reg.2025-01-10.tiago', {
    operador: 'Tiago', dia: '2025-01-10',
    registros: [{ id: 'ant-1', dia: '2025-01-10', paciente: 'MARIA FERNANDA OLIVEIRA', carteira: '412200000123456EQ', status: 'concluido' }]
  });
  const alterados = await Reg.anonimizarAntigos(180);
  assert.equal(alterados, 1);
  const pos = LS.get('reg.2025-01-10.tiago');
  assert.equal(pos.registros[0].paciente, 'MARIA F. O.');
  assert.equal(pos.registros[0].carteira, '4122*********56EQ');
  assert.equal(pos.registros[0].anonimizado, true);
});

test('compararCega, glosa inicial padrão ("nao") e fila do Modo Turbo (filaCopia / proximoParaCopiar)', () => {
  const ctx = criarSandbox();
  const itens = [{ codigo: '50000470', desc: 'Fono', qtd: 10 }, { codigo: '50000489', desc: 'TO', qtd: 5 }];
  assert.equal(ctx.compararCega(itens, 2, [{ fim: '0470', qtd: '10' }, { fim: '0489', qtd: '5' }]).ok, true);
  const div = ctx.compararCega(itens, 2, [{ fim: '0470', qtd: '8' }, { fim: '9999', qtd: '5' }]);
  assert.equal(div.ok, false);
  assert.equal(div.porItem.find(x => x.it.codigo === '50000470').st, 'qtd');
  assert.equal(div.porItem.find(x => x.it.codigo === '50000489').st, 'omitido');

  const g = ctx.eval(`
    cfg.clinicas.push({ id: 'c1', nome: 'Clínica 1', emails: ['c@c1.com'], executante: 'CLINICA UM LTDA', codigos: {} });
    S = novoEstado(emailDeTexto('Beneficiário: PAULO REIS\\nCarteira: 412200000555666EF\\nServiço: 50000470 - Fono - 4\\nMédico: Dra. Ana CRM 7788', 'c@c1.com'));
    S.guias[0];
  `);
  assert.equal(g.resultado.glosa.resp, 'nao'); // padrão otimizado sem clique extra
  const fila = ctx.filaCopia(g);
  assert.ok(fila.length >= 6);
  assert.equal(ctx.proximoParaCopiar(g).key, 'executante');
  g.copiados.executante = fila[0].val;
  assert.equal(ctx.proximoParaCopiar(g).key, 'medico_nome');
});

test('Fila de atendimentos pausados (Fila.estacionar / Fila.achar / Fila.retomar)', async () => {
  const ctx = criarSandbox();
  const Fila = ctx.eval('Fila');
  const st1 = ctx.eval(`novoEstado(emailDeTexto('Beneficiário: JOANA LIMA\\nCarteira: 412200000111222AA\\nServiço: 50000470 - Fono - 2\\nMédico: Dr. Pedro CRM 1234', 'x@clinica.com'))`);
  const ok = await Fila.estacionar(st1);
  assert.equal(ok, true);
  assert.ok(Fila.achar(st1.atendId));
  assert.ok(Fila.achar(st1.email.messageId));
  const retomado = await Fila.retomar(st1.atendId);
  assert.ok(retomado && typeof retomado === 'object');
  assert.equal(retomado.atendId, st1.atendId);
  assert.equal(ctx.eval('S.atendId'), st1.atendId);
  assert.equal(Fila.achar(st1.atendId), null);
});
