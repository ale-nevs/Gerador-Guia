'use strict';
/* ====================================================================
   Conferência pelos prints do sistema oficial ("Liberação de Senhas")
   Leitura por OCR dentro do navegador (Tesseract hospedado em /ocr), sem IA de visão e sem enviar nada para fora.
   A tela tem layout fixo: ancoramos pelas barras amarelas do topo e lemos campo por campo.
   As imagens ficam só na memória desta aba; o que é salvo são os resultados (sem nome, CID ou imagens).
   ==================================================================== */
/* Cada layout conhecido da tela: posição das barras amarelas (âncora) e das caixas, em pixels do print de referência a 100%.
   "compacto": janela estreita (primeiros prints). "largo": PS Web em tela cheia (formulário com ~1365 px de largura). */
const PRINTS_LAYOUTS = [
  { nome: 'compacto',
    ancora: { x: 307, y: 36, w: 402 },
    guia: [541, 99, 657, 113], credNome: [14, 151, 257, 165], credCgc: [260, 151, 364, 165],
    ident: [48, 301, 160, 317], paciente: [163, 301, 318, 317], cid: [16, 445, 62, 459],
    profissional: [14, 197, 276, 213], registro: [307, 197, 378, 213], dtSolic: [724, 197, 794, 213],
    rotGuia: [[10, 118, 330, 134, /credenc|executant/i]], rotProc: [[10, 60, 52, 78, /item|tem/i]], rotCid: [[120, 420, 390, 442, /cid|descri|ricao do c/i]],
    linhas: { topo: 88, passo: 18, alt: 18, sep: 0, max: 6, item: [14, 36], cod: [484, 556], qtd: [557, 575], st: [599, 610], gradeX: [483, 556], gradeY: [90, 190] } },
  { nome: 'largo',
    ancora: { x: 322, y: 85, w: 598 },
    guia: [1000, 149, 1150, 166], credNome: [7, 203, 424, 220], credCgc: [428, 203, 553, 220],
    ident: [98, 353, 240, 369], paciente: [243, 353, 729, 369], cid: [10, 501, 62, 518],
    profissional: [7, 246, 484, 262], registro: [514, 246, 591, 262], dtSolic: [1249, 246, 1347, 262],
    rotGuia: [[1050, 131, 1112, 150, /guia/i], [120, 131, 235, 150, /plano|credenc/i]], rotCid: [[300, 480, 560, 499, /cid|descri|ricao do c/i]], rotProc: [[880, 123, 968, 142, /c[oó]d|servi/i], [670, 124, 800, 142, /servi|descri/i]],
    linhas: { topo: 146, passo: 20, alt: 18, sep: -2, max: 7, item: [8, 30], cod: [895, 961], qtd: [991, 1015], st: [1120, 1136], gradeX: [893, 962], gradeY: [150, 280] } }
];
const PRINTS_GEO = PRINTS_LAYOUTS[0];   // compatibilidade
const PRINTS_MEM = new Map();   // guia.id -> { leituras: [{tipo, campos, itens}], crops } (só em memória)

const OCR = {
  worker: null, carregando: null, tarefa: Promise.resolve(),
  async iniciar(aviso) {
    if (this.worker) return this.worker;
    if (this.carregando) return this.carregando;
    this.carregando = (async () => {
      if (location.protocol === 'file:') throw new Error('A leitura de prints precisa do site publicado (não funciona abrindo o arquivo direto).');
      if (aviso) aviso('Carregando o leitor de imagens (só na primeira vez, alguns segundos)…');
      if (!window.Tesseract) await new Promise((ok, erro) => { const s = document.createElement('script'); s.src = 'ocr/tesseract.min.js'; s.onload = ok; s.onerror = () => erro(new Error('Não consegui carregar o leitor de imagens (pasta ocr).')); document.head.appendChild(s); });
      this.worker = await Tesseract.createWorker('por', 1, { workerPath: 'ocr/worker.min.js', corePath: 'ocr/', langPath: 'ocr/', gzip: false });
      return this.worker;
    })();
    try { return await this.carregando; } finally { this.carregando = null; }
  },
  /* uma leitura por vez (o worker é sequencial) */
  ler(canvas, { psm = '7', lista = '' } = {}) {
    const rodar = async () => {
      const w = await this.iniciar();
      await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: lista, preserve_interword_spaces: '1' });
      // como PNG em data URL (síncrono): o canvas direto ou o toBlob podem custar ~1 s por leitura em alguns navegadores
      const img = canvas && canvas.toDataURL ? canvas.toDataURL('image/png') : canvas;
      const { data } = await w.recognize(img);
      return { texto: (data.text || '').replace(/\s+/g, ' ').trim(), conf: data.confidence };
    };
    const p = this.tarefa.then(rodar, rodar); this.tarefa = p.catch(() => { }); return p;
  }
};

/* ---------- imagem: âncora, recorte e preparo ---------- */
function desenharImagem(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return c;
}
async function abrirImagem(file) {
  if (window.createImageBitmap) return desenharImagem(await createImageBitmap(file));
  return new Promise((ok, erro) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { ok(desenharImagem(i)); URL.revokeObjectURL(u); }; i.onerror = () => erro(new Error('imagem inválida')); i.src = u; });
}
/* acha as barras amarelas do cabeçalho (255,224,128): devolve a barra (x0, x1, topo) em pixels da imagem */
function acharBarra(cv) {
  const W = cv.width, H = Math.min(cv.height, 1600), d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;   // o print pode ser a tela inteira: procura as barras em qualquer altura
  // amarelo das barras (255,224,128), com folga para compressão JPEG e zoom
  const amarelo = i => Math.abs(d[i] - 255) < 40 && Math.abs(d[i + 1] - 224) < 45 && Math.abs(d[i + 2] - 128) < 70;
  const lin = new Uint16Array(H);
  for (let y = 12; y < H; y++) for (let x = 0; x < W; x++) if (amarelo((y * W + x) * 4)) lin[y]++;
  let y0 = -1; for (let y = 12; y < H; y++) if (lin[y] >= 90) { y0 = y; break; }      // topo das barras amarelas
  if (y0 < 0) return null;
  let y1 = y0; while (y1 + 1 < H && lin[y1 + 1] >= 90) y1++;
  const alt = y1 - y0 + 1, col = new Uint16Array(W);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (amarelo((y * W + x) * 4)) col[x]++;
  /* extensão horizontal: colunas "fortes" (quase só amarelo); no print comprimido, afrouxa. Franjas de texto (ClearType) são esparsas e ficam de fora. */
  const medir = (frac, folga, minimo) => {
    const lim = Math.max(3, Math.round(alt * frac)); let melhor = null, ini = -1, ult = -1;
    const fecha = () => { if (ini >= 0 && ult - ini + 1 >= minimo && (!melhor || ult - ini > melhor[1] - melhor[0])) melhor = [ini, ult]; };
    for (let x = 0; x < W; x++) if (col[x] >= lim) { if (ini < 0) ini = ult = x; else if (x - ult <= folga) ult = x; else { fecha(); ini = ult = x; } }
    fecha(); return melhor;
  };
  const curto = r => !r || r[1] - r[0] + 1 < 240;
  /* 1º: as linhas da barra acima e abaixo do texto (sem letras) dão a extensão exata, mesmo com JPEG */
  const corridas = [];
  const faixas = [];
  for (let k = 2; k <= Math.max(3, Math.round(alt * 0.2)); k++) faixas.push(y0 + k);
  for (let k = 2; k <= Math.max(3, Math.round(alt * 0.12)); k++) faixas.push(y1 - k);
  for (const y of faixas) {
    if (y <= y0 || y >= y1) continue;
    let melhor = null, ini = -1, ult = -1;
    const fecha = () => { if (ini >= 0 && (!melhor || ult - ini > melhor[1] - melhor[0])) melhor = [ini, ult]; };
    for (let x = 0; x < W; x++) if (amarelo((y * W + x) * 4)) { if (ini < 0) ini = ult = x; else if (x - ult <= 10) ult = x; else { fecha(); ini = ult = x; } }   // a folga junta as duas barras do layout compacto (8 px entre elas), sem alcançar o botão "Histórico"
    fecha(); if (melhor && melhor[1] - melhor[0] + 1 >= 240) corridas.push(melhor);
  }
  if (corridas.length >= 2) {
    const med = arr => arr.sort((a, b) => a - b)[arr.length >> 1];
    const r0 = [med(corridas.map(c => c[0])), med(corridas.map(c => c[1]))];
    const rc = medir(0.7, 26, 40);
    // a medição por colunas fortes só vale se concordar (no print limpo, ela pega a quina arredondada com mais precisão)
    const r = rc && Math.abs(rc[0] - r0[0]) <= 3 && Math.abs(rc[1] - r0[1]) <= 3 ? rc : r0;
    return { x0: r[0], x1: r[1], y0, alt };
  }
  let r = medir(0.7, 26, 40);
  if (curto(r)) r = medir(0.4, 12, 40) || r;
  if (curto(r)) r = medir(0.3, 12, 30) || r;
  if (!r) return null;
  return { x0: r[0], x1: r[1], y0, alt };
}
/* para cada layout conhecido, a escala e o deslocamento que a barra encontrada implica; os mais próximos de um zoom comum vêm primeiro */
function ancorasPossiveis(barra) {
  const zooms = [1, 1.25, 1.5, 1.75, 2, 0.8, 0.9, 1.1, 1.33];
  return PRINTS_LAYOUTS.map(L => {
    let esc = (barra.x1 - barra.x0 + 1) / L.ancora.w;
    if (esc < 0.5 || esc > 3.5) return null;
    const perto = zooms.reduce((m, z) => Math.abs(esc - z) < Math.abs(esc - m) ? z : m, 99);
    if (Math.abs(esc - 1) < 0.045) esc = 1;                                   // print em 100%
    const xRef = L.ancora.x + L.ancora.w - 1;
    return { L, esc, dx: barra.x1 - xRef * esc, dy: barra.y0 - L.ancora.y * esc, ordem: Math.abs(esc - perto) / perto };   // alinha pela borda direita (a esquerda borra)
  }).filter(Boolean).sort((a, b) => a.ordem - b.ordem);
}
function acharAncora(cv) { const b = acharBarra(cv); if (!b) return null; return ancorasPossiveis(b)[0] || null; }
/* recorta uma caixa (em coordenadas do print de referência), amplia, equilibra contraste e inverte se o fundo for escuro */
function prepararCampo(cv, an, caixa, ampl = 4, opc = {}) {
  const [a, b, c, d] = caixa, kx = an.sx || an.esc, ky = an.sy || an.esc;
  const sx = Math.round(an.dx + a * kx), sy = Math.round(an.dy + b * ky), sw = Math.max(2, Math.round((c - a) * kx)), sh = Math.max(2, Math.round((d - b) * ky));
  ampl = ampl / ky;   // com zoom do print, amplia menos: o tamanho final do texto fica igual ao do print em 100%
  const o = document.createElement('canvas'); o.width = Math.max(8, Math.round(sw * ampl)); o.height = Math.max(8, Math.round(sh * ampl));
  const x = o.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cv, sx, sy, sw, sh, 0, 0, o.width, o.height);
  const im = x.getImageData(0, 0, o.width, o.height), p = im.data, n = o.width * o.height, g = new Uint8Array(n);
  let soma = 0, mn = 255, mx = 0;
  for (let i = 0; i < n; i++) { const v = (p[i * 4] * 0.299 + p[i * 4 + 1] * 0.587 + p[i * 4 + 2] * 0.114) | 0; g[i] = v; soma += v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const invertido = soma / n < 128, faixa = Math.max(1, mx - mn);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { let v = ((g[i] - mn) * 255 / faixa) | 0; if (invertido) v = 255 - v; g[i] = v; }
  /* borda da célula na lateral do recorte: coluna escura e uniforme na altura toda (no JPEG fica cinza e borrada e escapa do limiar).
     Letras não são uniformes na altura do recorte, que tem margem acima e abaixo do texto. */
  { const Wc = o.width, Hc = o.height, lado = Math.max(2, Math.round(Wc * 0.04));
    for (const cx0 of [...Array(lado).keys(), ...Array.from({ length: lado }, (_, i) => Wc - 1 - i)]) {
      let sm = 0, s2 = 0; for (let cy = 0; cy < Hc; cy++) { const v = g[cy * Wc + cx0]; sm += v; s2 += v * v; }
      const med = sm / Hc, dp = Math.sqrt(Math.max(0, s2 / Hc - med * med));
      if (med < 205 && dp < 38) for (let cy = 0; cy < Hc; cy++) g[cy * Wc + cx0] = 255;
    } }
  for (let i = 0; i < n; i++) hist[g[i]]++;
  let tot = n, sB = 0; for (let t = 0; t < 256; t++) sB += t * hist[t];
  let wB = 0, sumB = 0, melhor = 0, lim = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sB - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > melhor) { melhor = v; lim = t; } }
  const W = o.width, Hh = o.height, bin = new Uint8Array(n);
  // opc.limite desloca o limiar (mais alto = traço mais fino; ajuda quando letras coladas viram uma só); opc.cinza mantém tons de cinza
  const lim2 = Math.min(250, Math.max(5, lim + (opc.limite || 0)));
  const pb = new Uint8Array(n); for (let i = 0; i < n; i++) pb[i] = g[i] > lim2 ? 255 : 0;
  for (let i = 0; i < n; i++) bin[i] = opc.cinza ? g[i] : pb[i];
  // apaga as linhas de grade (colunas/linhas quase inteiras pretas), que o OCR confunde com dígitos ou com "I"/"J";
  // a detecção usa o preto e branco também no modo em tons de cinza (senão a borda cinza da célula ficava)
  const borda = Math.round(ampl * 3);   // nas bordas do recorte, coluna escura quase inteira é a moldura do campo
  for (let cx = 0; cx < W; cx++) { let k = 0; for (let cy = 0; cy < Hh; cy++) if (!pb[cy * W + cx]) k++; const naBorda = cx < borda || cx >= W - borda, lim = naBorda ? 0.75 : 0.93; if (k >= Hh * lim && (!opc.cinza || (naBorda && opc.bordaCinza))) for (let cy = 0; cy < Hh; cy++) bin[cy * W + cx] = 255; }
  for (let cy = 0; cy < Hh; cy++) { let k = 0; for (let cx = 0; cx < W; cx++) if (!pb[cy * W + cx]) k++; if (k >= W * 0.93 && (!opc.cinza || (opc.bordaCinza && (cy < borda || cy >= Hh - borda)))) for (let cx = 0; cx < W; cx++) bin[cy * W + cx] = 255; }
  for (let i = 0; i < n; i++) { const v = bin[i]; p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v; p[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  // moldura branca ao redor: ajuda o reconhecimento de linhas curtas
  const f = document.createElement('canvas'); f.width = o.width + 24; f.height = o.height + 24;
  const fx = f.getContext('2d'); fx.fillStyle = '#fff'; fx.fillRect(0, 0, f.width, f.height); fx.drawImage(o, 12, 12);
  return { canvas: f, vazio: mx - mn < 40 && !invertido, tinta: (() => { let t = 0; for (let i = 0; i < n; i++) if (p[i * 4] === 0) t++; return t / n; })() };
}
/* recorte pequeno, colorido, só para o operador conferir com os próprios olhos */
function miniatura(cv, an, caixa, ampl = 2) {
  const [a, b, c, d] = caixa, kx = an.sx || an.esc, ky = an.sy || an.esc;
  const o = document.createElement('canvas'), sw = Math.max(2, Math.round((c - a) * kx)), sh = Math.max(2, Math.round((d - b) * ky)); o.width = sw * ampl; o.height = sh * ampl;
  o.getContext('2d').drawImage(cv, Math.round(an.dx + a * kx), Math.round(an.dy + b * ky), sw, sh, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}

/* ---------- limpeza do que o OCR devolve ---------- */
const soAlfaNum = t => (t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const soDigitos = t => (t || '').replace(/\D/g, '');
function limparGuia(t) {
  let s = soAlfaNum(t); const m = s.match(/[TS]\d{7,8}/); if (m) return m[0];
  if (/^[1I7L]\d{8}$/.test(s)) return 'T' + s.slice(1);   // "T" lido como outro caractere
  return s;
}
function limparCid(t) {
  let s = soAlfaNum(t); if (!s) return '';
  if (/^[IL1|][A-Z]/.test(s)) s = s.slice(1);   // linha da grade à esquerda lida como I
  // o CID começa pela letra; depois só dígitos (letras parecidas com dígitos são trocadas: "M7T71" não vira "T71")
  const ini = { 2: 'Z', 0: 'O', 8: 'B', 5: 'S', 1: 'I', 6: 'G' }, dig = { O: '0', D: '0', Q: '0', I: '1', L: '1', T: '7', Z: '2', S: '5', B: '8', G: '6', A: '4' };
  const c0 = /[A-Z]/.test(s[0]) ? s[0] : (ini[s[0]] || s[0]);
  return c0 + s.slice(1).replace(/[A-Z]/g, ch => dig[ch] || ch);
}
const limparNome = t => semAcento((t || '').toUpperCase()).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- leitura de um print ---------- */
/* Cada campo é lido com mais de um preparo da imagem (ampliação, limiar, tons de cinza) até o valor passar na validação do seu formato
   (ex.: guia = T/S + dígitos; carteira = 15 dígitos + 2 caracteres). Se duas leituras válidas concordam, ou uma válida tem boa confiança, para. */
const VAR_PADRAO = [{ ampl: 4 }, { ampl: 4, cinza: true }, { ampl: 3, limite: 15 }, { ampl: 5, limite: -15 }, { ampl: 6, cinza: true }, { ampl: 5, cinza: true }, { ampl: 3, cinza: true }, { ampl: 4, limite: 30 }, { ampl: 5, limite: 10 }];
const VAR_CURTO = [{ ampl: 4 }, { ampl: 4, psm: '13' }, { ampl: 6, psm: '13' }, { ampl: 4, cinza: true }, { ampl: 3, limite: 15, psm: '13' }];
const VAR_TEXTO = [{ ampl: 4, cinza: true, bordaCinza: true }, { ampl: 4 }, { ampl: 3, cinza: true, bordaCinza: true }, { ampl: 5 }];   // nomes: vence a leitura repetida (texto cinza perde letras finas no preto e branco)
const LISTA_NOME = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ .-/&';
const dataCalendario = v => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (!m) return false; const d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 && +m[3] > 2000; };
const DEF_GUIA = {
  guia: { lista: 'TS0123456789', norm: limparGuia, valida: v => /^[TS]\d{7,8}$/.test(v) },
  credNome: { lista: LISTA_NOME + '0123456789', norm: limparNome, variantes: VAR_TEXTO },
  ident: { lista: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', norm: soAlfaNum, valida: v => /^\d{15}(?:[A-Z][A-Z0-9]|\d\d)$/.test(v) },   // final = sigla do plano (EQ, IE, A2) ou dois dígitos (61)   // no sistema o final é a sigla do plano (EQ, IE…)
  paciente: { lista: LISTA_NOME, norm: limparNome, variantes: VAR_TEXTO },
  cid: { lista: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', norm: limparCid, valida: v => /^[A-Z]\d{2,3}$/.test(v) },
  profissional: { lista: LISTA_NOME, norm: limparNome, variantes: VAR_TEXTO },
  registro: { lista: '0123456789', norm: soDigitos, valida: v => /^\d{3,7}$/.test(v) },
  dtSolic: { lista: '0123456789/', norm: v => (v || '').replace(/[^0-9/]/g, ''), valida: dataCalendario }
};
async function lerCampo(cv, an, def) {
  const vars = def.variantes || (def.valida ? VAR_PADRAO : VAR_TEXTO), norm = def.norm || (x => x), leituras = [];
  for (const v of vars) {
    const c = prepararCampo(cv, an, def.caixa, v.ampl, v);
    if (def.vazioOk && !leituras.length && c.tinta < 0.012) return { valor: '', vazio: true, conf: 100, leituras };
    const r = await OCR.ler(c.canvas, { psm: v.psm || def.psm || '7', lista: def.lista });
    const valor = norm(r.texto), valido = def.valida ? !!valor && def.valida(valor) : !!valor;
    leituras.push({ valor, conf: r.conf, bruto: r.texto, valido, tinta: c.tinta });
    if (!def.valida) { if (leituras.filter(x => x.valor === valor).length >= 2 || (vars.length === 1)) break; continue; }
    const validos = leituras.filter(x => x.valido);
    if (valido && validos.filter(x => x.valor === valor).length >= (def.consenso || 2) + (r.conf >= 75 ? -1 : 0)) break;   // leituras válidas iguais encerram; senão passa por todos os preparos e vence a maioria
  }
  const validos = leituras.filter(x => x.valido), pool = validos.length ? validos : leituras;
  const freq = new Map(); pool.forEach(x => freq.set(x.valor, (freq.get(x.valor) || 0) + 1));
  const melhor = [...pool].sort((a, b) => (freq.get(b.valor) - freq.get(a.valor)) || (b.conf - a.conf))[0] || { valor: '', conf: 0, bruto: '' };
  return { valor: melhor.valor, bruto: melhor.bruto, conf: melhor.conf, incerto: def.valida ? !validos.length : melhor.conf < 50, leituras };
}
/* acerta o alinhamento fino da grade de procedimentos (±3 px) procurando as linhas da tabela */
function refinarGrade(cv, an) {
  const L = an.L.linhas, W = cv.width, H = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const kx = an.sx || an.esc, ky = an.sy || an.esc, lum = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 255; const i = (y * W + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
  const [gx0, gx1] = L.gradeX, [gy0, gy1] = L.gradeY;
  let melhor = null, nPts = 0;
  for (let ddy = -3; ddy <= 3; ddy++) for (let ddx = -3; ddx <= 3; ddx++) {
    let sc = 0, n = 0;
    for (let k = 0; k <= L.max; k++) { const y = Math.round(an.dy + (L.topo + L.sep + L.passo * k) * ky) + ddy; for (let xr = gx0 + 5; xr <= gx1 - 4; xr += 2) { sc += 255 - lum(Math.round(an.dx + xr * kx) + ddx, y); n++; } }
    for (const xr of [gx0, gx1]) for (let yr = gy0; yr <= gy1; yr += 2) { sc += 255 - lum(Math.round(an.dx + xr * kx) + ddx, Math.round(an.dy + yr * ky) + ddy); n++; }
    sc -= (Math.abs(ddx) + Math.abs(ddy)) * 40; nPts = n;
    if (!melhor || sc > melhor.sc) melhor = { sc, ddx, ddy };
  }
  return { ...an, dx: an.dx + melhor.ddx, dy: an.dy + melhor.ddy, nota: melhor.sc / nPts / 255 };   // nota = quão escuras estão as linhas da grade nas posições esperadas (0 a 1)
}
/* cor da célula "ST" da linha: L liberada (verde), C cancelada (ciano), N negada (vermelho), A aberta (amarelo) */
function statusLinha(cv, an, y0) {
  const L = an.L.linhas, [a, b, c, d] = [L.st[0], y0 + 3, L.st[1], y0 + L.alt - 3], kx = an.sx || an.esc, ky = an.sy || an.esc, sx = Math.round(an.dx + a * kx), sy = Math.round(an.dy + b * ky), sw = Math.max(2, Math.round((c - a) * kx)), sh = Math.max(2, Math.round((d - b) * ky));
  const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(sx, sy, sw, sh).data; let r = 0, g = 0, bl = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) { const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); if (mx - mn > 140 && mx > 180) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; } }
  if (n < 8) return '';
  r /= n; g /= n; bl /= n;
  if (g > 180 && r < 100 && bl < 100) return 'L';
  if (g > 180 && bl > 180 && r < 100) return 'C';
  if (r > 180 && g < 100 && bl < 100) return 'N';
  if (r > 180 && g > 180 && bl < 100) return 'A';
  return '?';
}
/* confere rótulos fixos da tela (ex.: "Nº Guia", "Código Serviço"): diz se o layout e a aba são estes */
async function confereRotulos(cv, an, lista) {
  let acertos = 0;
  for (const [a, b, c, d, re] of lista) { const t = (await lerCampo(cv, an, { caixa: [a, b, c, d], lista: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzçãóéíº ', variantes: [{ ampl: 4 }] })).bruto || ''; if (re.test(semAcento(t))) acertos++; }
  return acertos;
}
/* Títulos fixos de cada tela (texto sem acento, minúsculo) e o centro de cada um no print de referência.
   Lidos no print inteiro, dizem onde está cada parte da tela, mesmo com zoom, recorte ou linhas mais altas. */
const PRINTS_ROTULOS = {
  compacto: {
    guia: { aberta: [447, 384], anexar: [720, 346], atendimento: [412, 88], beneficiario: [497, 292], cadastro: [696, 292], carater: [28, 260], executante: [178, 124], liberacao: [62, 16], negada: [396, 384], outros: [137, 42], procedimentos: [251, 44], profissional: [698, 224], razao: [318, 124], senhas: [98, 16], servico: [406, 126], sexo: [606, 292], social: [362, 124], status: [223, 384], validcarteira: [757, 291] },
    proc: { aberta: [450, 385], atendimento: [458, 326], carater: [238, 325], caso: [209, 266], diferente: [348, 266], evento: [182, 326], internacao: [652, 385], manual: [333, 282], negada: [396, 384], nome: [300, 282], outros: [136, 44], porte: [501, 206], preencher: [165, 266], procedimentos: [252, 44], razao: [574, 325], senhas: [98, 16], solicitante: [101, 266], status: [222, 385], tipo: [398, 326] },
    cid: { descricao: [151, 434], indicacao: [562, 435], principal: [90, 434] }, terapia: { detalhamento: [631, 436], matriz: [340, 439], prescricao: [182, 494] }
  },
  largo: {
    guia: { alterar: [1138, 290], ambulatorio: [890, 446], anexar: [1242, 398], arquivo: [1286, 398], auditado: [624, 174], auditar: [570, 50], auditoria: [804, 50], autorizacao: [1252, 120], cadastro: [1218, 344], carater: [28, 310], carteira: [1324, 344], codigo: [68, 490], consulta: [752, 50], consultar: [892, 50], copia: [595, 344], covid19: [864, 620], descricao: [420, 490], doenca: [972, 620], executante: [166, 176], filiacao: [1185, 194], gerar: [834, 176], historico: [1140, 96], impressora: [1134, 50], incluidos: [1248, 619], indicacao: [1014, 490], internacao: [1056, 446], itens: [1184, 619], medico: [792, 157], nova: [864, 176], pericia: [1137, 310], preexistente: [1032, 619], principal: [90, 490], procedimentos: [260, 96], reserva: [656, 52], servico: [538, 176], sexo: [1100, 344], solicitante: [93, 228], telefone: [1202, 272], tiss: [1023, 194], validade: [1280, 344], versao: [990, 194], vigencia: [1024, 399] },
    proc: { ambulatorio: [890, 445], atendimento: [839, 395], auditar: [570, 51], auditoria: [804, 50], cancelar: [1123, 334], carater: [586, 395], caso: [207, 335], cgccpf: [746, 355], class: [442, 124], classificacao: [393, 316], codigo: [68, 490], conselho: [268, 315], consulta: [752, 50], consultar: [892, 50], covid19: [864, 619], dataliberacao: [1186, 133], diferente: [354, 335], diretriz: [1296, 392], divergencia: [786, 335], doenca: [972, 621], espec: [538, 137], evento: [500, 395], executante: [240, 133], gerar: [1276, 334], glosa: [1023, 334], importa: [1184, 395], impressora: [1134, 51], incluidos: [1248, 619], indicacao: [1014, 491], internacao: [1056, 445], item: [20, 132], manual: [514, 355], motivos: [1296, 375], nome: [478, 355], observacoes: [1295, 295], opme: [1218, 395], paciente: [828, 619], participacao: [870, 316], porte: [978, 133], preencher: [163, 335], preexistente: [1032, 619], principal: [90, 490], procedimentos: [264, 95], prorrogar: [1180, 295], razao: [962, 394], reserva: [656, 51], revalidar: [583, 334], seja: [314, 337], servico: [768, 133], solicitante: [95, 335], tecnica: [841, 334], tipo: [780, 395], tiss: [400, 136], total: [974, 295], validade: [1306, 133] },
    cid: { descricao: [420, 490], indicacao: [1014, 490], principal: [90, 490] }, terapia: {}
  }
};
/* ---------- localização pelos títulos da tela ---------- */
const normPalavra = t => semAcento(String(t || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
/* lê o print inteiro uma vez e devolve as palavras com a posição (em pixels do print) */
OCR.palavras = function (cv, reg) {
  const rodar = async () => {
    const w = await this.iniciar();
    // reg: só a região da janela (print da tela inteira); ampliada para o texto ficar com ~2x o tamanho original
    const [rx, ry, rw, rh] = reg || [0, 0, cv.width, cv.height];
    const e = Math.max(1, Math.min(2, 2800 / rw));
    const c = document.createElement('canvas'); c.width = Math.round(rw * e); c.height = Math.round(rh * e);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cv, rx, ry, rw, rh, 0, 0, c.width, c.height);
    await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '', preserve_interword_spaces: '0' });
    const { data } = await w.recognize(c.toDataURL('image/png'), {}, { blocks: true, text: false });
    const ws = [];
    for (const bk of data.blocks || []) for (const pa of bk.paragraphs || []) for (const l of pa.lines || []) for (const wd of l.words || []) {
      const b = wd.bbox; ws.push({ t: wd.text, n: normPalavra(wd.text), x0: rx + b.x0 / e, y0: ry + b.y0 / e, x1: rx + b.x1 / e, y1: ry + b.y1 / e, cx: rx + (b.x0 + b.x1) / 2 / e, cy: ry + (b.y0 + b.y1) / 2 / e, conf: wd.confidence });
    }
    return ws;
  };
  const p = this.tarefa.then(rodar, rodar); this.tarefa = p.catch(() => { }); return p;
};
/* um título do print confere com o de referência? (aceita um caractere trocado nos títulos longos) */
function confereTitulo(lido, ref) {
  if (!lido || lido.length < 3) return false;
  if (lido === ref) return true;
  if (ref.length >= 7 && Math.abs(lido.length - ref.length) <= 1 && distanciaTexto(lido, ref) <= 1) return true;
  if (ref.length >= 9 && lido.length >= 6 && (ref.startsWith(lido) || ref.endsWith(lido) || lido.includes(ref))) return true;   // "entificacao", "dataliberacao"
  return false;
}
/* acha a transformação  x = sx·X + tx ;  y = sy·Y + ty  (X,Y: print de referência) que põe o maior número de títulos no lugar */
function calibrar(ws, ref) {
  const pares = [];
  for (const [n, [X, Y]] of Object.entries(ref)) for (const w of ws) if (confereTitulo(w.n, n)) pares.push({ n, X, Y, x: w.cx, y: w.cy });
  if (pares.length < 3) return { n: 0, pares };
  let melhor = null;
  for (let i = 0; i < pares.length; i++) for (let j = i + 1; j < pares.length; j++) {
    const a = pares[i], b = pares[j]; if (a.n === b.n) continue;
    const dX = b.X - a.X, dY = b.Y - a.Y; if (Math.abs(dX) < 60 || Math.abs(dY) < 30) continue;
    const sx = (b.x - a.x) / dX, sy = (b.y - a.y) / dY;
    if (!(sx > 0.45 && sx < 3.2 && sy > 0.45 && sy < 3.2) || sy / sx < 0.75 || sy / sx > 1.35) continue;
    const tx = a.x - sx * a.X, ty = a.y - sy * a.Y, tol = 5 + 3 * Math.max(sx, sy);
    const usados = new Set(); let n = 0, err = 0;
    for (const p of pares) { if (usados.has(p.n)) continue; const ex = Math.abs(sx * p.X + tx - p.x), ey = Math.abs(sy * p.Y + ty - p.y); if (ex < tol * 2 && ey < tol) { usados.add(p.n); n++; err += ex + ey; } }
    if (!melhor || n > melhor.n || (n === melhor.n && err < melhor.err)) melhor = { n, err, sx, sy, tx, ty, tol };
  }
  if (!melhor || melhor.n < 3) return { n: 0, pares };
  // refaz com mínimos quadrados só com os títulos que conferem (um por nome: o mais perto)
  const porNome = new Map();
  for (const p of pares) { const ex = Math.abs(melhor.sx * p.X + melhor.tx - p.x), ey = Math.abs(melhor.sy * p.Y + melhor.ty - p.y); if (ex < melhor.tol * 2 && ey < melhor.tol && (!porNome.has(p.n) || ex + ey < porNome.get(p.n).e)) porNome.set(p.n, { ...p, e: ex + ey }); }
  const ok = [...porNome.values()];
  const ajuste = (A, a) => { const m = A.length, sA = A.reduce((s, v) => s + v, 0), sa = a.reduce((s, v) => s + v, 0), sAA = A.reduce((s, v) => s + v * v, 0), sAa = A.reduce((s, v, i) => s + v * a[i], 0), den = m * sAA - sA * sA; if (Math.abs(den) < 1e-6) return null; const k = (m * sAa - sA * sa) / den; return [k, (sa - k * sA) / m]; };
  const fx = ajuste(ok.map(p => p.X), ok.map(p => p.x)) || [melhor.sx, melhor.tx], fy = ajuste(ok.map(p => p.Y), ok.map(p => p.y)) || [melhor.sy, melhor.ty];
  // escala muito perto de um zoom comum (100%, 125%…): usa o zoom exato e recalcula o deslocamento pela mediana (mais estável com poucos títulos)
  const med = a => { const v = [...a].sort((x, y) => x - y); return v[v.length >> 1]; };
  const ZOOMS = [1, 1.25, 1.5, 1.75, 2, 0.8, 0.9, 1.1, 1.333, 0.75, 0.667];
  for (const [f, A, a] of [[fx, 'X', 'x'], [fy, 'Y', 'y']]) { const z = ZOOMS.find(z => Math.abs(f[0] - z) / z < 0.012); if (z) { f[0] = z; f[1] = med(ok.map(p => p[a] - z * p[A])); } }
  const r = { n: ok.length, sx: fx[0], tx: fx[1], sy: fy[0], ty: fy[1], ok, nomes: ok.map(p => p.n) };
  r.ok.forEach(p => { p.rx = p.x - (r.sx * p.X + r.tx); p.ry = p.y - (r.sy * p.Y + r.ty); });
  return r;
}
/* posição para ler uma caixa: transformação geral + correção pelos títulos mais próximos (a tela pode ter linhas mais altas num trecho) */
function anLocal(cal, L, caixa) {
  const X = (caixa[0] + caixa[2]) / 2, Y = (caixa[1] + caixa[3]) / 2;
  let wx = 0, wy = 0, cx = 0, cy = 0;
  for (const p of cal.ok) { const d = Math.hypot((p.X - X) * 0.6, p.Y - Y); if (d > 260) continue; const w = 1 / Math.pow(1 + d / 50, 2); cx += w * p.rx; cy += w * p.ry; wx += w; wy += w; }
  // no eixo x o centro da palavra varia com a largura do texto lido: a correção local entra pela metade
  return { L, sx: cal.sx, sy: cal.sy, esc: (cal.sx + cal.sy) / 2, dx: cal.tx + (wx ? cx / wx : 0) * 0.5, dy: cal.ty + (wy ? cy / wy : 0) };
}
/* palavra lida no print inteiro dentro da caixa (reserva para quando o recorte não passa na validação) */
function palavraNaCaixa(ws, an, caixa, norm, valida) {
  const kx = an.sx || an.esc, ky = an.sy || an.esc, x0 = an.dx + caixa[0] * kx - 4, x1 = an.dx + caixa[2] * kx + 4, y0 = an.dy + caixa[1] * ky - 3, y1 = an.dy + caixa[3] * ky + 3;
  const dentro = ws.filter(w => w.cx > x0 && w.cx < x1 && w.cy > y0 && w.cy < y1).sort((a, b) => a.x0 - b.x0);
  for (const w of dentro) { const v = norm(w.t); if (v && valida(v)) return v; }
  const junto = norm(dentro.map(w => w.t).join('')); return junto && valida(junto) ? junto : '';
}
const SISTEMAS_PRINT = { largo: 'Sistema novo (PS Web, tela larga)', compacto: 'Sistema antigo (janela Liberação de Senhas)' };
const sistemaPrint = () => { const v = LS.get('printSistema', 'largo'); return SISTEMAS_PRINT[v] ? v : 'largo'; };
/* escolha do sistema dos prints (fica lembrada neste computador) */
/* seletor do topo: Sistema: Novo | Antigo (vale para colar, capturar e testar prints) */
function htmlSistemaTopo(compacto) {
  const v = sistemaPrint(), ROT = { largo: 'Novo', compacto: 'Antigo' };
  return `<div class="seg seg-vis seg-sis-topo" role="radiogroup" aria-label="Sistema dos prints"><span class="seg-rot">Sistema</span>${Object.keys(SISTEMAS_PRINT).map(k => `<button type="button" role="radio" aria-checked="${k === v}" class="${k === v ? 'on' : ''}" data-act="sistemaPrint" data-v="${k}" title="Prints do ${esc(SISTEMAS_PRINT[k].replace(/^S/, 's'))}">${ROT[k] || k}</button>`).join('')}</div>`;
}
function htmlSeletorSistema() {
  const v = sistemaPrint();
  return `<div class="seg-sis"><span class="lbl" style="margin:0">Os prints são de qual sistema?</span><div class="seg" role="radiogroup" aria-label="Sistema dos prints">
    ${Object.entries(SISTEMAS_PRINT).map(([k, t]) => `<button type="button" role="radio" aria-checked="${k === v}" class="${k === v ? 'ativo' : ''}" data-act="sistemaPrint" data-v="${k}">${k === v ? ic('check', 'sm') : ''}${esc(t)}</button>`).join('')}</div></div>`;
}
/* a tela está vazia (nenhuma guia aberta)? */
function telaVazia(cv, anDe) {
  let tinta = 0;
  for (const k of ['guia', 'ident', 'paciente']) { const a = anDe(k); tinta += prepararCampo(cv, a, a.L[k], 2).tinta; }
  return tinta < 0.02;
}
/* títulos de um grupo (ex.: aba CID) que aparecem onde a calibração diz que deveriam estar */
function titulosNoLugar(ws, cal, grupo) {
  let n = 0;
  for (const [nome, [X, Y]] of Object.entries(grupo || {})) {
    const x = cal.sx * X + cal.tx, y = cal.sy * Y + cal.ty, tol = 14 * Math.max(cal.sx, cal.sy);
    if (ws.some(w => confereTitulo(w.n, nome) && Math.abs(w.cx - x) < tol * 2.5 && Math.abs(w.cy - y) < tol)) n++;
  }
  return n;
}
async function lerPrintTela(file, aviso, sistema) {
  sistema = SISTEMAS_PRINT[sistema] ? sistema : sistemaPrint();
  const cv = await abrirImagem(file), L = PRINTS_LAYOUTS.find(x => x.nome === sistema), R = PRINTS_ROTULOS[sistema];
  const diag = { imagem: [cv.width, cv.height], sistema };
  await OCR.iniciar(aviso);
  if (aviso) aviso('Localizando os campos na tela…');
  // print da tela inteira: lê só a região da janela, achada pela barra amarela (o texto fica maior e mais legível)
  const barra0 = acharBarra(cv); let reg = null;
  if (barra0) {
    const k = (barra0.x1 - barra0.x0 + 1) / L.ancora.w, x0 = Math.max(0, Math.round(barra0.x0 - (L.ancora.x + 40) * k)), y0 = Math.max(0, Math.round(barra0.y0 - (L.ancora.y + 60) * k));
    const x1 = Math.min(cv.width, Math.round(barra0.x0 + (sistema === 'largo' ? 1100 : 560) * k)), y1 = Math.min(cv.height, Math.round(barra0.y0 + (sistema === 'largo' ? 620 : 580) * k));
    if (x1 - x0 > 200 && y1 - y0 > 200 && (x1 - x0) * (y1 - y0) < cv.width * cv.height * 0.85) reg = [x0, y0, x1 - x0, y1 - y0];
  }
  diag.regiao = reg;
  const ws = await OCR.palavras(cv, reg);
  diag.palavras = ws.length;
  /* 1) qual aba e onde está cada parte: pelos títulos fixos da tela do sistema escolhido */
  const cg = calibrar(ws, R.guia), cp = calibrar(ws, R.proc);
  const exclusivos = (cal, deste, outro) => (cal.nomes || []).filter(n => !(n in outro)).length;
  const eg = exclusivos(cg, R.guia, R.proc), ep = exclusivos(cp, R.proc, R.guia);
  diag.titulos = { guia: cg.n, proc: cp.n, exclusivosGuia: eg, exclusivosProc: ep };
  // o print é do outro sistema? (a escolha é do operador, mas avisamos quando a tela claramente é a outra)
  const outro = sistema === 'largo' ? 'compacto' : 'largo', R2 = PRINTS_ROTULOS[outro];
  const nOutro = Math.max(calibrar(ws, R2.guia).n, calibrar(ws, R2.proc).n), nEste = Math.max(cg.n, cp.n);
  diag.titulosOutroSistema = nOutro;
  if (nOutro >= 8 && nOutro >= nEste * 2) return { erro: `Este print parece ser do ${SISTEMAS_PRINT[outro].replace(/^S/, 's')}. Troque a seleção do sistema, acima dos prints, e cole de novo.`, diag, outroSistema: outro };
  let tipo = null, cal = null, an = null;
  if (nEste >= 4) {
    if (ep > eg) tipo = 'proc'; else if (eg > ep) tipo = 'guia'; else tipo = cp.n > cg.n ? 'proc' : 'guia';
    cal = tipo === 'proc' ? cp : cg;
    an = { L, sx: cal.sx, sy: cal.sy, esc: (cal.sx + cal.sy) / 2, dx: cal.tx, dy: cal.ty };
    diag.calibracao = { sx: +cal.sx.toFixed(4), sy: +cal.sy.toFixed(4), tx: +cal.tx.toFixed(1), ty: +cal.ty.toFixed(1), titulos: cal.nomes };
  } else {
    /* 2) plano B: poucos títulos legíveis (imagem ruim): barra amarela do topo, só no layout do sistema escolhido */
    const barra = acharBarra(cv); diag.barra = barra;
    const c = barra && ancorasPossiveis(barra).find(x => x.L.nome === sistema);
    if (c) { const g = await confereRotulos(cv, c, L.rotGuia), p = await confereRotulos(cv, c, L.rotProc); if (g || p) { an = c; tipo = p > g ? 'proc' : 'guia'; diag.planoB = true; } }
    if (!an) return { erro: 'Não consegui localizar os campos neste print: os títulos da tela "Liberação de Senhas" não ficaram legíveis. Use a tecla Print Screen (ou a Ferramenta de Captura) sem reduzir a imagem e cole de novo.', diag };
  }
  const anDe = k => cal ? anLocal(cal, L, L[k]) : an;
  const crops = {}, G = L;
  if (tipo === 'guia') {
    if (telaVazia(cv, anDe)) return { erro: 'A tela deste print está vazia (nenhuma guia aberta). Abra a guia no sistema e tire o print de novo.', diag };
    // parte de baixo: aba CID aberta? (pode estar em Terapia, Internação...)
    let abaCid;
    if (cal) { const sc = titulosNoLugar(ws, cal, R.cid), st = titulosNoLugar(ws, cal, R.terapia); abaCid = sc > 0 ? true : st > 0 ? false : null; }
    if (abaCid == null) abaCid = !G.rotCid || !!(await confereRotulos(cv, cal ? anLocal(cal, L, G.rotCid[0]) : an, G.rotCid));
    diag.abaCid = abaCid;
    const campos = {};
    for (const [k, base] of Object.entries(DEF_GUIA)) {
      if (k === 'cid' && !abaCid) continue;
      const cx = G[k];
      const def = { ...base, caixa: cx }, a = anDe(k);
      const r = await lerCampo(cv, a, def);
      let valor = r.valor, incerto = r.incerto, origem = 'recorte';
      if (incerto && def.valida) {   // reserva: a palavra lida no print inteiro, dentro da mesma caixa
        const v = palavraNaCaixa(ws, a, cx, def.norm || (x => x), def.valida); if (v) { valor = v; incerto = false; origem = 'tela'; }
      }
      if (!def.valida && valor) {   // nomes: letra a mais no começo (borda da célula borrada no JPEG: "IMRA", "HJANY")? confere com a leitura do print inteiro
        const kx = a.sx || a.esc, ky = a.sy || a.esc, x0 = a.dx + cx[0] * kx - 3, x1 = a.dx + cx[2] * kx, y0 = a.dy + cx[1] * ky - 2, y1 = a.dy + cx[3] * ky + 2;
        const prim = ws.filter(w => w.cx > x0 && w.cx < x1 && w.cy > y0 && w.cy < y1).sort((p, q) => p.x0 - q.x0)[0];
        const pw = prim ? limparNome(prim.t) : '', [t0, ...resto] = valor.split(' ');
        if (pw.length >= 2 && t0.length === pw.length + 1 && t0.slice(1) === pw && /^[IJHLW1|]/.test(t0)) { valor = [pw, ...resto].join(' '); origem = 'recorte+tela'; }
      }
      campos[k] = { valor, bruto: r.bruto, conf: r.conf, incerto, origem, var: r.leituras.map(x => `${x.bruto} (${Math.round(x.conf)})`) };
      crops[k] = miniatura(cv, a, def.caixa);
    }
    return { tipo, layout: G.nome, campos, crops, diag, ctx: { cv, anDe, G, ws } };
  }
  const Lg = G.linhas, caixaGrade = [Lg.cod[0], Lg.topo, Lg.qtd[1], Lg.topo + Lg.passo * Lg.max];
  an = refinarGrade(cv, cal ? anLocal(cal, L, caixaGrade) : an);
  const itens = [];
  for (let i = 0; i < Lg.max; i++) {
    const y0 = Lg.topo + Lg.passo * i, y1 = y0 + Lg.alt;
    const cxCod = [Lg.cod[0], y0 + 2, Lg.cod[1], y1 - 1];
    const normCod = v => { const t = soDigitos(v); return t.length > 8 ? t.slice(-8) : t; };
    const cod = await lerCampo(cv, an, { caixa: cxCod, lista: '0123456789', norm: normCod, valida: v => /^\d{8}$/.test(v), vazioOk: true, variantes: VAR_PADRAO });
    if (cod.vazio) continue;
    if (cod.incerto) { const v = palavraNaCaixa(ws, an, cxCod, normCod, v => /^\d{8}$/.test(v)); if (v) { cod.valor = v; cod.incerto = false; } }
    const qtd = await lerCampo(cv, an, { caixa: [Lg.qtd[0], y0 + 2, Lg.qtd[1], y1 - 1], lista: '0123456789', norm: soDigitos, valida: v => /^\d{1,3}$/.test(v) && +v >= 1, variantes: VAR_CURTO });
    const num = await lerCampo(cv, an, { caixa: [Lg.item[0], y0 + 2, Lg.item[1], y1 - 1], lista: '0123456789', norm: soDigitos, valida: v => /^\d{1,2}$/.test(v) && +v >= 1, variantes: VAR_CURTO });
    if (cod.valor.length < 5) continue;   // sem código legível não é linha de item (borda da grade, barra de rolagem)
    itens.push({ fila: i, n: Number(num.valor) || null, codigo: cod.valor, qtd: qtd.valor === '' ? null : Number(qtd.valor), st: statusLinha(cv, an, y0), conf: Math.min(cod.conf, qtd.conf), incerto: cod.incerto || qtd.incerto,
      img: miniatura(cv, an, [Lg.cod[0] - 2, y0 + 1, Lg.qtd[1] + 2, y1], 2), varCod: cod.leituras.map(x => `${x.bruto} (${Math.round(x.conf)})`), varQtd: qtd.leituras.map(x => `${x.bruto} (${Math.round(x.conf)})`) });
  }
  // numeração: as linhas são consecutivas; vale o deslocamento mais frequente entre o nº lido e a posição na grade
  const cont = new Map(); itens.forEach(it => { if (it.n) cont.set(it.n - it.fila, (cont.get(it.n - it.fila) || 0) + 1); });
  const desl = [...cont.entries()].sort((a, b) => b[1] - a[1])[0];
  if (desl) itens.forEach(it => { it.n = desl[0] + it.fila; });
  diag.ajusteGrade = { dx: +an.dx.toFixed(1), dy: +an.dy.toFixed(1), nota: +(an.nota || 0).toFixed(3) };
  return { tipo, layout: G.nome, maxLinhas: Lg.max, itens, crops, diag, ctx: { cv, an, G } };
}

/* ---------- comparação com o pedido ---------- */
function distancia(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function similaridade(a, b) {
  a = limparNome(a).replace(/ /g, ''); b = limparNome(b).replace(/ /g, '');
  if (!a || !b) return 0;
  return 1 - distancia(a, b) / Math.max(a.length, b.length);
}
/* O print não traz acentos nem o nome completo: confere por palavras (sem acento), aceitando só os primeiros nomes */
function nomeConfere(ped, lido) {
  const A0 = limparNome(ped).split(' ').filter(Boolean), B0 = limparNome(lido).split(' ').filter(Boolean);
  if (A0.join(' ') === B0.join(' ') && A0.length) return { ok: true, exato: true };
  // o print corta o nome no fim do campo (e lê mal as últimas letras): vale conferir só os 3 primeiros nomes
  const A = A0.slice(0, 3), B = B0.slice(0, 3), n = Math.min(A.length, B.length);
  if (n < 2) return { ok: false };
  for (let i = 0; i < n; i++) {
    const a = A[i], b = B[i], ult = i === n - 1;
    if (a === b) continue;
    if (ult && Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) continue;   // último nome cortado na tela
    if (Math.min(a.length, b.length) >= 5 && distancia(a, b) <= 1) continue;                            // um caractere lido errado
    return { ok: false };
  }
  return { ok: true, exato: false };
}
const prefixo = (a, b) => { a = limparNome(a).replace(/ /g, ''); b = limparNome(b).replace(/ /g, ''); return a.length >= 8 && b.length >= 8 && (a.startsWith(b) || b.startsWith(a)); };
const ST_ROT = { L: 'Liberada', C: 'Cancelada', N: 'Negada', A: 'Aberta', '?': 'status não reconhecido' };
const ROT_PRINT = { profissional: 'Médico solicitante', registro: 'Registro do médico (CRM)', dtSolic: 'Data da solicitação', guia: 'Nº da guia', paciente: 'Nome do beneficiário', credNome: 'Credenciado executante', ident: 'Carteira (identificação)', cid: 'CID' };

function avaliarPrints(g) {
  const mem = PRINTS_MEM.get(g.id); if (!mem) return null;
  const campos = {}, itensSis = new Map();
  mem.leituras.forEach(l => { if (l.tipo === 'guia') Object.assign(campos, l.campos); else l.itens.forEach((it, k) => itensSis.set(it.n || ('x' + it.codigo + k), it)); });
  const p = g.pedido, C = [];
  const add = (k, ped, lido, st, nota = '') => {
    const conhecida = (st === 'bad' || st === 'warn') && Apr.leituraConhecida(k, lido, ped);   // o mesmo erro de leitura já foi confirmado por um operador
    if (conhecida) { st = 'warn'; nota = `Esta mesma leitura ("${lido}" no lugar de "${ped}") já foi confirmada ${pl(conhecida.n, 'vez', 'vezes')} como erro de leitura: confira a imagem.`; }
    C.push({ k, rot: ROT_PRINT[k], ped, lido, st, nota });   // st: ok | warn | bad | info
  };
  if (campos.guia) {
    const v = campos.guia.valor, ok8 = /^[TS]\d{7,8}$/.test(v);
    if (!g.numero) add('guia', '—', v, ok8 ? 'ok' : 'warn', ok8 ? 'Preenchido na etapa 4.' : 'Fora do padrão do app (T ou S + 7 ou 8 dígitos): confira.');
    else add('guia', g.numero, v, g.numero === v ? 'ok' : 'bad', g.numero === v ? '' : 'Diferente do número já digitado.');
  }
  if (campos.paciente) {
    const ped = p.beneficiario || '', s = similaridade(ped, campos.paciente.valor), nc = nomeConfere(ped, campos.paciente.valor);
    add('paciente', ped || '—', campos.paciente.valor, !ped ? 'info' : (nc.ok || s >= 0.93) ? 'ok' : s >= 0.8 ? 'warn' : 'bad', !ped ? '' : nc.exato ? '' : nc.ok ? 'Confere pelos 3 primeiros nomes, sem acentos (o print não mostra o nome completo).' : s >= 0.93 ? 'Pequena diferença de leitura da imagem (ignorada): confira a imagem.' : s >= 0.8 ? 'Quase igual: veja a imagem ao lado.' : 'Nomes diferentes.');
  }
  if (campos.credNome) {
    const ped = valorCopia(g, 'executante'), lido = campos.credNome.valor;
    if (!ped) add('credNome', '—', lido, 'info', 'Credenciado não cadastrado para comparar.');
    else { const s = similaridade(ped, lido), ok = s >= 0.9 || prefixo(ped, lido); add('credNome', ped, lido, ok ? 'ok' : s >= 0.7 ? 'warn' : 'bad', ok ? '' : 'Diferente do credenciado cadastrado.'); }
  }
  if (campos.ident) {
    const ped = soAlfaNum(g.carteiraUsada), lido = campos.ident.valor;
    if (!ped) add('ident', '—', lido, 'info');
    else { const igual = ped === lido, dif = distancia(ped, lido); const fino = s => s.replace(/[IL1]/g, ''), soFino = !igual && dif === 1 && fino(ped) === fino(lido); add('ident', ped, lido, igual || soFino ? 'ok' : dif <= 1 ? 'warn' : 'bad', igual ? '' : soFino ? 'Letra fina (I, L ou 1) não lida na imagem: ignorada.' : dif <= 1 ? 'Um caractere diferente: pode ser leitura da imagem.' : 'Diferente da carteira usada.'); }
  }
  if (campos.cid) {
    const ped = (p.cid || '').replace(/\./g, '').toUpperCase(), lido = campos.cid.valor;
    if (!ped) add('cid', '—', lido, 'info', 'Pedido sem CID.');
    else { const ok = lido === ped || lido.startsWith(ped) || ped.startsWith(lido); add('cid', ped, lido, ok ? 'ok' : 'bad', ok ? '' : 'CID diferente do pedido.'); }
  }
  if (!campos.cid && mem.leituras.some(l => l.tipo === 'guia')) add('cid', (p.cid || '—').replace(/\./g, '').toUpperCase(), '(aba CID fechada)', 'info', 'No print, a parte de baixo mostra outra aba (ex.: Terapia): confira o CID na tela ou envie o print com a aba CID aberta.');
  if (campos.profissional) {
    const ped = p.medico.nome || '', lido = campos.profissional.valor, nc = nomeConfere(ped, lido), s = similaridade(ped, lido);
    add('profissional', ped || '—', lido, !ped ? 'info' : (nc.ok || s >= 0.93) ? 'ok' : s >= 0.8 ? 'warn' : 'bad', !ped ? 'Pedido sem nome do médico.' : nc.exato ? '' : nc.ok ? 'Confere pelos 3 primeiros nomes, sem acentos.' : s >= 0.8 ? 'Quase igual: veja a imagem.' : 'Médico diferente do pedido.');
  }
  if (campos.registro) {
    const sz = x => (x || '').replace(/\D/g, '').replace(/^0+/, ''), ped = sz(p.medico.crm), lido = sz(campos.registro.valor);
    add('registro', p.medico.crm || '—', campos.registro.valor, !ped ? 'info' : ped === lido ? 'ok' : (distancia(ped, lido) === 1 ? 'warn' : 'bad'), !ped ? 'Pedido sem CRM.' : ped === lido ? '' : distancia(ped, lido) === 1 ? 'Um dígito diferente: pode ser leitura da imagem.' : 'Registro diferente do pedido.');
  }
  if (campos.dtSolic) {
    const em = p.emissao, lido = campos.dtSolic.valor, ped = em.estado === 'valida' ? fmtData(em.data) : '';
    if (!lido && ped) add('dtSolic', ped, '(em branco)', 'warn', 'A data da solicitação está em branco no print: confira se foi preenchida no sistema.');
    else add('dtSolic', ped || (em.estado === 'sem_data' ? 'SEM DATA' : '—'), lido, !ped ? 'info' : ped === lido ? 'ok' : 'bad', !ped ? 'Pedido sem data para comparar.' : ped === lido ? '' : 'Data diferente da data do pedido.');
  }
  // itens: pedido × sistema
  const sis = [...itensSis.values()].sort((a, b) => (a.n || 99) - (b.n || 99));
  const usados = new Set(), linhas = [];
  p.itens.forEach(it => {
    const i = sis.findIndex((s, k) => !usados.has(k) && s.codigo === it.codigo); if (i >= 0) usados.add(i);
    const s = i >= 0 ? sis[i] : null, qOk = s && s.qtd === it.qtd, stOk = !s || !s.st || s.st === 'L';
    linhas.push({ codigo: it.codigo, qPed: it.qtd, qSis: s ? s.qtd : null, stSis: s ? s.st : '', img: s ? s.img : null, st: !s ? 'bad' : !qOk ? 'bad' : stOk ? 'ok' : 'warn',
      nota: !s ? 'Não aparece nos prints.' : !qOk ? 'Quantidade diferente.' : stOk ? '' : 'Status no sistema: ' + (ST_ROT[s.st] || s.st) + '.' });
  });
  sis.forEach((s, k) => { if (!usados.has(k)) linhas.push({ codigo: s.codigo, qPed: null, qSis: s.qtd, stSis: s.st, img: s.img, st: 'bad', nota: 'Está no sistema e não está no pedido.' }); });
  const temProc = mem.leituras.some(l => l.tipo === 'proc'), temGuia = mem.leituras.some(l => l.tipo === 'guia');
  const faltam = linhas.filter(l => l.nota === 'Não aparece nos prints.').length, sobram = linhas.filter(l => l.nota.startsWith('Está')).length, qtdDif = linhas.filter(l => l.nota === 'Quantidade diferente.').length;
  const avisos = [];
  if (!temGuia) avisos.push('Falta o print da aba Dados da Guia: abra essa aba no sistema e cole (ou capture) o print.');
  if (!temProc) avisos.push('Falta o print da aba Procedimentos: abra essa aba no sistema e cole (ou capture) o print.');
  const maxLin = Math.min(...mem.leituras.filter(l => l.tipo === 'proc').map(l => l.maxLinhas || 6));
  if (temProc && faltam && sis.length >= maxLin) avisos.push('A grade mostra só ' + maxLin + ' itens por vez: se há mais, envie outro print com a barra de rolagem no fim da lista.');
  const ign = (g.prints && g.prints.ign) || {};
  const checks = C.map(({ k, rot, ped, lido, st, nota }) => ({ k, rot, ped, lido, st, nota, chave: 'c:' + k, crop: (mem.leituras.find(l => l.tipo === 'guia') || {}).crops && mem.leituras.find(l => l.tipo === 'guia').crops[k] }));
  linhas.forEach(l => { l.chave = 'i:' + l.codigo; });
  [...checks, ...linhas].forEach(x => { x.ign = (x.st === 'bad' || x.st === 'warn') && ign[x.chave] ? ign[x.chave] : null; x.sit = x.ign ? 'ign' : x.st; });
  const todos = [...checks.map(c => c.sit), ...linhas.map(l => l.sit)];
  const completo = temGuia && temProc;
  const ok = completo && !todos.includes('bad') && !todos.includes('warn') && p.itens.length > 0 && linhas.length > 0;
  return { checks, linhas, avisos, completo, ok, ressalvas: todos.filter(t => t === 'ign').length, faltam, sobram, qtdDif, nPedido: p.itens.length, nSistema: sis.length };
}

/* resumo que fica salvo no atendimento (sem nomes nem imagens) */
function resumoPrints(av, ign) {
  return { em: agora(), ok: av.ok, completo: av.completo, itens: av.nSistema, ign: ign || {}, ressalvas: av.ressalvas,
    divergencias: [...av.checks.filter(c => c.sit === 'bad' || c.sit === 'warn').map(c => c.rot + (c.sit === 'bad' ? ': diverge' : ': conferir')), ...av.linhas.filter(l => l.sit !== 'ok' && l.sit !== 'ign').map(l => `${l.codigo}: ${l.nota}`)] };
}
/* texto que vai para as observações adicionais da resposta à clínica (sem nome, CID ou carteira) */
function linhaIgnorada(x) {
  let key, t = 'ign';
  if (x.chave.startsWith('i:')) {
    if (x.nota === 'Não aparece nos prints.') { key = 'item-ausente'; t = 'menor'; }
    else if (x.nota === 'Quantidade diferente.') { const menor = x.qSis != null && x.qPed != null && x.qSis < x.qPed; key = menor ? 'item-menor' : 'item-qtd'; t = menor ? 'menor' : 'ign'; }
    else if (/^Status no sistema/.test(x.nota)) { key = 'item-status'; t = 'ign'; }
    else key = 'item-extra';
  } else key = x.chave.slice(2);
  const o = (cfg.obsAuto && cfg.obsAuto[key]) || OBS_AUTO[key] || { texto: x.rot + ': diferente do pedido.', padrao: true };
  const linha = o.texto.replace(/\{CODIGO\}/g, x.codigo || '').replace(/\{QTD_PEDIDO\}/g, x.qPed ?? '—').replace(/\{QTD_SISTEMA\}/g, x.qSis ?? '—').replace(/\{STATUS\}/g, (ST_ROT[x.stSis] || x.stSis || '').toLowerCase());
  return { t, key, linha, on: o.padrao !== false };
}
function sincronizarObsPrints(g) {
  const ign = (g.prints && g.prints.ign) || {}, linhas = Object.values(ign).filter(x => x.on !== false).map(x => x.linha);
  const novo = linhas.length ? 'Conferência da guia pelo sistema:\n' + linhas.join('\n') : '';
  const r = g.resultado; let atual = r.obsAdicionais || '';
  if (g.obsPrintsTxt && atual.includes(g.obsPrintsTxt)) atual = atual.replace(g.obsPrintsTxt, '').replace(/\n{2,}/g, '\n').trim();
  r.obsAdicionais = novo ? (atual ? atual.replace(/\s+$/, '') + '\n' + novo : novo) : atual;
  g.obsPrintsTxt = novo; g.respEdit = null;
}
/* aplica a avaliação ao atendimento: resumo salvo, conferência da grade, número da guia e observação */
function aplicarPrints(g) {
  const av = avaliarPrints(g); if (!av) return null;
  const ign = (g.prints && g.prints.ign) || {};
  const lido = ((PRINTS_MEM.get(g.id).leituras.find(l => l.tipo === 'guia')) || {}).campos;
  if (lido && lido.guia && !g.numero && /^[TS]\d{7,8}$/.test(lido.guia.valor)) { g.numero = lido.guia.valor; g.numeroOrigem = 'print'; evento(g, 'numero', 'Nº da guia preenchido pelo print: ' + g.numero); }
  g.prints = resumoPrints(av, ign);
  if (av.ok) { if (!g.cega.ok) { g.cega.ok = true; g.cega.via = 'prints'; } }
  else if (g.cega.via === 'prints') { g.cega.ok = false; g.cega.via = null; }
  sincronizarObsPrints(g);
  return av;
}

async function processarPrints(files, aviso) {
  const g = guiaAtiva(); if (!g) { if (aviso) aviso('Nenhum atendimento aberto para receber o print.'); return; }
  const msg = t => { const el = $('#printsEstado'); if (el) el.innerHTML = t ? `<span class="tag info">${ic('refresh', 'sm')}${esc(t)}</span>` : ''; if (aviso && t) aviso(t); };
  const erros = [];
  const mem = PRINTS_MEM.get(g.id) || { leituras: [] }; PRINTS_MEM.set(g.id, mem);
  for (const f of files) {
    try {
      msg('Lendo ' + (f.name || 'imagem colada') + '…');
      const r = await lerPrintTela(f, msg, sistemaPrint());
      if (r.erro) { erros.push(r.erro); evento(g, 'print-erro', `${f.name || 'print'}: ${r.erro}`); continue; }
      evento(g, 'print', `${r.tipo === 'guia' ? 'Dados da Guia' : 'Procedimentos'} (${SISTEMAS_PRINT[sistemaPrint()]})${r.tipo === 'proc' ? ': ' + r.itens.map(i => `${i.codigo} × ${i.qtd ?? '?'}`).join(', ') : ''}`);
      if (r.tipo === 'guia') { const i = mem.leituras.findIndex(l => l.tipo === 'guia'); if (i >= 0) mem.leituras.splice(i, 1); }
      const ABA_N = { guia: 'Dados da Guia', proc: 'Procedimentos' }, outraAba = r.tipo === 'guia' ? 'proc' : 'guia';
      if (mem.leituras.some(l => l.tipo === r.tipo) && !mem.leituras.some(l => l.tipo === outraAba) && files.length === 1)
        erros.push(`Este print é de novo da aba ${ABA_N[r.tipo]}. Falta a aba ${ABA_N[outraAba]}: abra-a no sistema e capture (ou cole) de novo.`);
      mem.leituras.push(r); mem.sistema = sistemaPrint();
      if (cfg.preferencias.guardarPrints !== false) { mem.imagens = mem.imagens || []; mem.imagens.push({ tipo: r.tipo, nome: f.name || 'print colado', em: agora(), img: await jpegDoPrint(f) }); }   // para o histórico da guia
    } catch (e) { console.error(e); erros.push(e.message || 'Não consegui ler esta imagem. Tire o print de novo (a janela inteira do sistema) e cole aqui.'); }
  }
  msg('');
  aplicarPrints(g);
  persistir(); render();
  if (erros.length) toast(erros[0], 'bad');
  if (aviso) { const lidas = (PRINTS_MEM.get(g.id) || { leituras: [] }).leituras.map(l => l.tipo === 'guia' ? 'Dados da Guia' : 'Procedimentos'); aviso(erros.length ? erros[0] : `Print lido. Já lidos: ${unicos(lidas).join(' e ') || '—'}.`); }
}
const prontoPrints = g => !!PRINTS_MEM.get(g.id);

/* ---------- cartão da etapa 3 (no lugar da conferência cega) ---------- */
function htmlCartaoPrints(g) {
  const av = prontoPrints(g) ? avaliarPrints(g) : null, res = g.prints;
  const nIgn = res && res.ign ? Object.keys(res.ign).length : 0;
  const tag = av ? (av.ok ? `<span class="tag ok">${ic('check', 'sm')}Conferido pelos prints${av.ressalvas ? ' (com ressalva)' : ''}</span>` : `<span class="tag warn">${ic('alert', 'sm')}Há pontos para conferir</span>`)
    : res ? `<span class="tag ${res.ok ? 'ok' : 'warn'}">${ic(res.ok ? 'check' : 'alert', 'sm')}${res.ok ? 'Conferido pelos prints' + (nIgn ? ' (com ressalva)' : '') : 'Prints com divergência'} em ${fmtHora(res.em)}</span>` : (cegaExigida() ? '<span class="tag warn">Obrigatório</span>' : '<span class="tag">Opcional</span>');
  const st = { ok: ['ok', 'check', 'Confere'], warn: ['warn', 'alert', 'Conferir'], bad: ['bad', 'x', 'Diverge'], info: ['', 'info', 'Sem base'] };
  const tg = x => {
    if (x.ign) return `<span class="tag obs">${ic('alert', 'sm')}${x.ign.leitura ? 'Erro de leitura' : x.ign.t === 'menor' ? 'Autorizado a menor' : 'Ignorado'}</span>${x.ign.motivo ? `<div class="dica" style="margin:4px 0 0">Motivo: ${esc(x.ign.motivo.texto)}${x.ign.motivo.detalhe ? ' — ' + esc(x.ign.motivo.detalhe) : ''}</div>` : ''} <button class="btn sm ghost" data-act="desfazerPrint" data-key="${esc(x.chave)}">${ic('undo', 'sm')}Desfazer aceite</button>
      <label class="chk" style="margin-top:6px"><input type="checkbox" data-obsp="${esc(x.chave)}" ${x.ign.on !== false ? 'checked' : ''}><span>Incluir na observação à clínica<br><span class="muted" style="font-size:var(--fs-sm)">${esc(x.ign.linha)}</span></span></label>`;
    const [c, i, t] = st[x.st];
    return `<span class="tag ${c}">${ic(i, 'sm')}${t}</span>` + (x.st === 'bad' || x.st === 'warn' ? ` <button class="btn sm line" data-act="ignorarPrint" data-key="${esc(x.chave)}" title="Aceita esta divergência, gera a observação para a clínica e deixa continuar">${ic('shield', 'sm')}Ignorar</button>` : '');
  };
  const corpo = av ? `
    ${av.avisos.map(a => `<div class="aviso" style="margin:8px 0">${ic('info')}<div>${esc(a)}</div></div>`).join('')}
    ${av.ressalvas ? `<div class="aviso" style="margin:8px 0">${ic('alert')}<div><b>${pl(av.ressalvas, 'divergência ignorada', 'divergências ignoradas')}.</b> Marque, em cada uma, se quer incluir a observação para a clínica (vai para as <b>observações adicionais</b>, etapa 4). Detalhe o motivo lá; isso não bloqueia a finalização.</div></div>` : ''}
    <div class="tabela-scroll"><table class="t prints-t"><thead><tr><th>Campo</th><th>Pedido</th><th>Lido no print</th><th>Imagem</th><th>Resultado</th></tr></thead><tbody>
      ${av.checks.map(c => { const dif = (c.st === 'bad' || c.st === 'warn') && c.ped && c.lido && c.ped !== '—' ? marcasDiferenca(c.ped, c.lido) : null; return `<tr class="r-${c.ign ? 'ign' : c.st}"><td>${esc(c.rot)}</td><td class="num">${dif ? dif[0] : esc(c.ped)}</td><td class="num"><b>${dif ? dif[1] : esc(c.lido || '—')}</b></td><td>${c.crop ? `<img class="mini" src="${c.crop}" alt="">` : ''}</td><td>${tg(c)}${c.nota && !c.ign ? `<div class="dica">${esc(c.nota)}</div>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>
    <h3>Itens: pedido × sistema (${av.nPedido} no pedido, ${av.nSistema} nos prints)</h3>
    <div class="tabela-scroll"><table class="t prints-t"><thead><tr><th>Código</th><th>Qtd. pedido</th><th>Qtd. no sistema</th><th>Imagem</th><th>Resultado</th></tr></thead><tbody>
      ${av.linhas.map(l => `<tr class="r-${l.ign ? 'ign' : l.st}"><td class="num"><b>${esc(l.codigo)}</b></td><td class="num">${l.qPed ?? '—'}</td><td class="num">${l.qSis ?? '—'}${l.stSis ? `<div class="dica">${esc(ST_ROT[l.stSis] || l.stSis)}</div>` : ''}</td><td>${l.img ? `<img class="mini" src="${l.img}" alt="">` : ''}</td><td>${tg(l)}${l.nota && !l.ign ? `<div class="dica">${esc(l.nota)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum item lido nos prints.</td></tr>'}
    </tbody></table></div>
    <div class="acoes"><button class="btn line" data-act="limparPrints">${ic('trash', 'sm')}Limpar prints</button><span class="esp"></span><button class="btn ghost" data-act="relatarGuia">${ic('help', 'sm')}Relatar problema na leitura</button></div>` : '';
  return `<div class="card" id="cartaoPrints">
    <div class="card-h"><h2>Conferência pelos prints do sistema</h2>${tag}<span class="esp"></span><span id="printsEstado"></span></div>
    ${htmlComoFazer('prints', 'Capture ou cole os prints das abas <b>Dados da Guia</b> e <b>Procedimentos</b>.', `<ol><li>No sistema, abra a guia na tela "Liberação de Senhas", aba <b>Dados da Guia</b>.</li><li>Clique em <b>Capturar a janela do sistema</b> (ou tire o print e use <b>Ctrl+V</b> aqui).</li><li>Abra a aba <b>Procedimentos</b> e capture de novo. Se a grade não couber na tela, role até o fim e capture mais uma vez.</li></ol><p>A leitura é feita neste navegador; ${cfg.preferencias.guardarPrints !== false ? 'os prints ficam no histórico da guia (pasta compartilhada).' : 'as imagens não são guardadas.'} O número da guia vai sozinho para a etapa 4.</p>`)}
    <p class="dica" style="margin:0 0 8px">${ic('monitor', 'sm')} Prints do <b>${esc(SISTEMAS_PRINT[sistemaPrint()].replace(/^S/, 's'))}</b>. Para trocar, use <b>Sistema: Novo | Antigo</b> no topo.</p>
    <div class="acoes" style="margin-top:0">
      ${htmlBotoesCaptura()}
      <button class="btn ${Captura.ativa() ? 'line' : 'pri'}" data-act="colarPrint" title="Cola o print que está na área de transferência (o mesmo que Ctrl+V)">${ic('clip')}Colar print</button>
      <label class="btn line" for="arqPrints" id="zonaPrints" title="Ou escolha/arraste os arquivos de imagem">${ic('upload')}Escolher arquivos</label>
      <input type="file" id="arqPrints" accept="image/*" multiple class="oculto">
    </div>
    ${corpo}</div>`;
}
