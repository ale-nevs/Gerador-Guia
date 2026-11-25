'use strict';
const VERSAO = '2.2.14';
const HIST_DIAS = 30;        // janela técnica de leitura dos registros (não configurável)
const MAX_BENEFICIARIOS = 5; // beneficiários diferentes por e-mail

/* ====================================================================
   Utilidades
   ==================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/* singular/plural pela quantidade: pl(2, 'bloqueio', 'bloqueios') → "2 bloqueios" */
const pl = (n, s, p) => `${n} ${Number(n) === 1 ? s : p}`;
const slug = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const norm = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtData = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtHora = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDH = v => `${fmtData(v)} ${fmtHora(v)}`;
/* as autorizações são semanais: a semana vai de segunda a domingo */
const inicioDaSemana = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const diaBR = iso => (iso || '').split('-').reverse().join('/');
const agora = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const cartValida = c => /^\d{15}[A-Z0-9]{2}$/.test(c || '');
const normCart = c => String(c || '').toUpperCase().replace(/[\s.\-\/]/g, '');
const fmtCart = c => cartValida(c) ? c.replace(/^(\d{4})(\d{4})(\d{4})(\d{3})(..)$/, '$1 $2 $3 $4 $5') : (c || '');
const emailValido = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const clonar = o => JSON.parse(JSON.stringify(o));
const unicos = a => [...new Set(a)];

const LS = {
  get(k, d) { try { const v = localStorage.getItem('conferidor.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('conferidor.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('conferidor.' + k); } catch (e) { } },
  chaves(prefixo) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('conferidor.' + prefixo)) out.push(k.slice(11)); } } catch (e) { } return out; }
};

/* ---------- Ícones (traço fino, estilo Lucide) ---------- */
const ICONES = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calweek: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M7 15h10"/>',
  calmonth: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pip: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1"/>',
  rows: '<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  filecheck: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
  left: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  listnum: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  textcolor: '<path d="M4 20h16"/><path d="m6 16 6-12 6 12M8.5 12h7"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  building: '<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/>',
  clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  palette: '<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="10" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  halfcircle: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  folderx: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="m9.5 10.5 5 5M14.5 10.5l-5 5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V22h16"/>',
  chevup: '<path d="m18 15-6-6-6 6"/>',
  chevdown: '<path d="m6 9 6 6 6-6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n] || ''}</svg>`;
const ANIMAIS = [['🐶', 'Cachorro'], ['🐱', 'Gato'], ['🦊', 'Raposa'], ['🐻', 'Urso'], ['🐼', 'Panda'], ['🐨', 'Coala'], ['🦁', 'Leão'], ['🐯', 'Tigre'], ['🐸', 'Sapo'], ['🐵', 'Macaco'], ['🦉', 'Coruja'], ['🐧', 'Pinguim'], ['🐢', 'Tartaruga'], ['🦄', 'Unicórnio'], ['🐙', 'Polvo'], ['🦋', 'Borboleta']];
const AVATARES = ANIMAIS.map(a => a[0]);
const AVATAR_NOME = Object.fromEntries(ANIMAIS);
const animalAleatorio = () => AVATARES[Math.floor(Math.random() * AVATARES.length)];
const glifo = e => `<span class="emoji" aria-hidden="true">${e}</span>`;
const CORES_ID = [
  ['idc-0', 'Azul'], ['idc-1', 'Ciano'], ['idc-2', 'Verde-água'], ['idc-3', 'Verde'], ['idc-4', 'Oliva'],
  ['idc-5', 'Índigo'], ['idc-6', 'Violeta'], ['idc-7', 'Magenta'], ['idc-8', 'Rosa'], ['idc-9', 'Terra']
];
const corClasse = c => (CORES_ID.some(x => x[0] === c) ? c : 'idc-0');
const corPorTexto = s => 'idc-' + (parseInt(hashTexto(String(s)), 36) % 10);

/* ---------- Tema (claro / escuro / automático) ---------- */
const Tema = {
  pref() { return LS.get('tema', 'auto'); },
  efetivo() { const p = this.pref(); return p === 'escuro' || (p !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; },
  aplicar() { document.documentElement.setAttribute('data-theme', this.efetivo()); },
  definir(p) { LS.set('tema', p); this.aplicar(); },
  alternar() { this.definir(this.efetivo() === 'dark' ? 'claro' : 'escuro'); }
};
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (Tema.pref() === 'auto') { Tema.aplicar(); render(); } }); } catch (e) { }

/* ---------- Avisos, cópia e download ---------- */
let toastT;
function toast(msg, tipo) {
  const t = $('#toast'); t.innerHTML = `${ic(tipo === 'bad' ? 'alert' : 'check', 'sm')}<span>${esc(msg)}</span>`; t.className = 'toast vis' + (tipo ? ' ' + tipo : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', tipo === 'bad' ? 5000 : 2200);
}
/* Copia texto simples. Devolve true só se a cópia realmente aconteceu. */
/* w: janela onde está o clique (o painel flutuante tem a própria área de transferência) */
async function copiar(texto, w = window) {
  try { if (w.navigator.clipboard && w.isSecureContext !== false) { await w.navigator.clipboard.writeText(texto); return true; } } catch (e) { }
  try { const d = w.document, ta = d.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0'; d.body.appendChild(ta); ta.select(); const ok = d.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
}
/* Copia com formatação (HTML + texto simples), para colar em e-mail. */
async function copiarRico(html, texto, w = window) {
  try {
    if (w.navigator.clipboard && w.ClipboardItem && w.isSecureContext !== false) {
      await w.navigator.clipboard.write([new w.ClipboardItem({ 'text/html': new w.Blob([html], { type: 'text/html' }), 'text/plain': new w.Blob([texto], { type: 'text/plain' }) })]);
      return 'rico';
    }
  } catch (e) { }
  try {
    const doc = w.document, d = doc.createElement('div'); d.contentEditable = 'true'; d.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; d.innerHTML = html; doc.body.appendChild(d);
    const r = doc.createRange(); r.selectNodeContents(d); const s = w.getSelection(); s.removeAllRanges(); s.addRange(r);
    const ok = doc.execCommand('copy'); s.removeAllRanges(); d.remove(); if (ok) return 'rico';
  } catch (e) { }
  return (await copiar(texto, w)) ? 'simples' : false;
}
function baixar(nome, conteudo, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo || 'text/plain' }));
  a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const nomeArquivo = (contexto, dataISO, ext) => `Conferidor_Guias_${semAcento(contexto).replace(/[^A-Za-z0-9-]+/g, '_')}_${diaBR(dataISO || isoDia(new Date())).replace(/\//g, '-')}.${ext}`;

/* ---------- HTML seguro e conversões (modelos de texto) ---------- */
const TAGS_OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'SPAN']);
const COR_OK = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;
function sanitizar(html) {
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  const limpar = (n, out) => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) { out.appendChild(document.createTextNode(c.nodeValue)); continue; }
      if (c.nodeType !== 1) continue;
      let tag = c.tagName;
      if (c.classList && c.classList.contains('tok')) { out.appendChild(document.createTextNode('{' + c.dataset.k + '}')); continue; }
      if (tag === 'DIV' || tag === 'H1' || tag === 'H2' || tag === 'H3') tag = 'P';
      if (tag === 'FONT') {
        const cor = c.getAttribute('color'); const s = document.createElement('span'); if (cor && COR_OK.test(cor)) s.style.color = cor; limpar(c, s); out.appendChild(s); continue;
      }
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      if (!TAGS_OK.has(tag)) { limpar(c, out); continue; }
      const e = document.createElement(tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag.toLowerCase());
      if (tag === 'SPAN') { const cor = c.style && c.style.color; if (cor && COR_OK.test(cor)) e.style.color = cor; else { limpar(c, out); continue; } }
      limpar(c, e); out.appendChild(e);
    }
  };
  const raiz = document.createElement('div'); limpar(doc.body, raiz);
  // texto solto no topo vira parágrafo
  const frag = document.createElement('div'); let atual = null;
  for (const n of [...raiz.childNodes]) {
    if (n.nodeType === 1 && /^(P|UL|OL)$/.test(n.tagName)) { atual = null; frag.appendChild(n); }
    else { if (!atual) { atual = document.createElement('p'); frag.appendChild(atual); } atual.appendChild(n); }
  }
  frag.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.querySelector('br')) p.remove(); });
  return frag.innerHTML;
}
function htmlPlano(html) {
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  let s = '';
  (function andar(n, ctx) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/ /g, ' '); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName;
      if (t === 'BR') s += '\n';
      else if (t === 'P' || t === 'DIV') { andar(c, ctx); s += '\n\n'; }
      else if (t === 'UL' || t === 'OL') { let i = 0; for (const li of c.children) { i++; s += (t === 'OL' ? i + '. ' : '• '); andar(li, ctx); s += '\n'; } s += '\n'; }
      else if (t === 'LI') { andar(c, ctx); }
      else andar(c, ctx);
    }
  })(doc.body, null);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function textoParaHtml(t) {
  return String(t || '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).map(par => '<p>' + esc(par).replace(/\n/g, '<br>') + '</p>').join('');
}
/* Parágrafos com espaço entre eles ao colar em e-mail: cada <p> vira um bloco seguido de uma linha em branco */
function htmlParaEmail(html) {
  const d = document.createElement('div'); d.innerHTML = html; let out = '';
  for (const n of [...d.childNodes]) {
    if (n.nodeType === 3) { if (n.textContent.trim()) out += `<div>${esc(n.textContent)}</div><div><br></div>`; continue; }
    if (n.tagName === 'P') out += `<div>${n.innerHTML}</div><div><br></div>`;
    else if (n.tagName === 'UL' || n.tagName === 'OL') out += n.outerHTML + '<div><br></div>';
    else out += n.outerHTML;
  }
  return out.replace(/(<div><br><\/div>)+$/, '');
}
const escH = s => esc(s).replace(/\n/g, '<br>');

/* ---------- Modal ---------- */
let modalAtual = null;
function abrirModal({ titulo, sub = '', icone = 'info', corpo, rodape = '', tamanho = '', aoFechar = null, risco = '', lateral = false }) {
  fecharModal(true);
  const fundo = document.createElement('div'); fundo.className = 'modal-fundo' + (lateral ? ' lateral' : ''); fundo.id = 'modalFundo';
  fundo.innerHTML = `<div class="modal ${tamanho} ${risco ? 'risco-' + risco : ''} ${lateral ? 'lateral' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">
    <div class="modal-h"><span class="caixa">${ic(icone, 'lg')}</span><div><h2 id="modalTitulo">${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <button class="btn ico" data-act="fecharModal" aria-label="Fechar" title="Fechar">${ic('x')}</button></div>
    <div class="modal-b" id="modalCorpo">${corpo}</div>${rodape ? `<div class="modal-f" id="modalRodape">${rodape}</div>` : ''}</div>`;
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fundo.dataset.fechar = '1'; else delete fundo.dataset.fechar; });
  fundo.addEventListener('click', e => { if (e.target === fundo && fundo.dataset.fechar) fecharModal(); });
  $('#modalRoot').appendChild(fundo);
  modalAtual = { aoFechar, sujo: false };
  fundo.addEventListener('input', ev => { if (modalAtual && ev.target.matches('textarea, input[type=text], [contenteditable]')) modalAtual.sujo = true; });
  const foco = $('[autofocus],input,textarea,select,.ed', fundo); if (foco) setTimeout(() => foco.focus(), 30);
}
/* Confirmação em modal (com o nome do item). Resolve true / texto do campo, ou null se a pessoa voltar. */
function confirmar({ titulo, texto, ok = 'Confirmar', risco = 'bad', icone = 'alert', campo = null }) {
  return new Promise(res => {
    let feito = false;
    abrirModal({ titulo, icone, risco, tamanho: 'p', corpo: `<p style="margin:0 0 10px">${texto}</p>${campo ? `<label class="lbl" for="cfCampo">${esc(campo.rot)}</label><textarea id="cfCampo" rows="2" placeholder="${esc(campo.ph || '')}"></textarea>` : ''}`,
      rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal" id="cfVoltar">Voltar</button><button class="btn ${risco === 'bad' ? 'perigo' : 'pri'}" id="cfOk">${ok}</button>`,
      aoFechar: () => { if (!feito) res(null); } });
    $('#cfOk').addEventListener('click', () => { feito = true; const v = campo ? $('#cfCampo').value.trim() : true; fecharModal(true); res(v); });
    if (!campo) setTimeout(() => { const b = $('#cfVoltar'); if (b) b.focus(); }, 40);
  });
}
/* "JANY GLEYDE DA SILVA" → "JANY G. D. S." */
const nomeCurto = n => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? p[0] + (p.length > 1 ? ' ' + p.slice(1).map(w => w[0] + '.').join(' ') : '') : ''; };
function fecharModal(silencioso) {
  const f = $('#modalFundo'); if (!f) return;
  if (!silencioso && modalAtual && modalAtual.sujo && !modalAtual.descartar) {   // texto digitado: pergunta antes de descartar
    const m = f.querySelector('.modal'); let bar = m.querySelector('.modal-desc');
    if (!bar) { bar = document.createElement('div'); bar.className = 'modal-desc'; bar.setAttribute('role', 'alert');
      bar.innerHTML = `${ic('alert', 'sm')}<span class="esp">Há texto digitado que será perdido.</span><button class="btn sm" data-act="modalContinuar">Continuar editando</button><button class="btn sm perigo" data-act="modalDescartar">Descartar</button>`;
      m.appendChild(bar); }
    bar.querySelector('[data-act=modalContinuar]').focus(); return;
  }
  const cb = modalAtual && modalAtual.aoFechar; f.remove(); modalAtual = null; M = null;
  if (cb && !silencioso) cb();
}
let M = null; // estado do modal aberto
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalFundo')) { e.preventDefault(); fecharModal(); } });

/* ---------- Cor de identificação do operador (RGB + transparência) ---------- */
const CORES_PADRAO_HEX = ['#2563eb', '#0891b2', '#0d9488', '#16a34a', '#65a30d', '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#b45309'];
const hexValido = h => /^#[0-9a-f]{6}$/i.test(h || '');
function estiloCor(hex, alfaPct) {
  const h = hexValido(hex) ? hex.slice(1) : '2c4a70';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = Math.min(1, Math.max(.05, (Number(alfaPct) || 30) / 100));
  const base = Tema.efetivo() === 'dark' ? [21, 28, 42] : [255, 255, 255];
  const mix = [r, g, b].map((v, i) => v * a + base[i] * (1 - a));
  const L = (0.2126 * mix[0] + 0.7152 * mix[1] + 0.0722 * mix[2]) / 255;
  return `--c-bg:rgba(${r},${g},${b},${a.toFixed(2)});--c-br:rgba(${r},${g},${b},${Math.min(1, a + .35).toFixed(2)});--c-fg:${L > 0.58 ? '#111827' : '#ffffff'};--c-solid:rgb(${r},${g},${b})`;
}
/* ---------- Senha do operador (trava de uso; o hash fica no config.json) ---------- */
const Senha = {
  async hash(senha, sal) {
    if (!(window.crypto && crypto.subtle)) throw new Error('este navegador não permite criar senha');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + ':' + senha));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  novoSal() { return [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join(''); },
  async confere(op, senha) { return !!op.senhaHash && (await this.hash(senha, op.senhaSalt)) === op.senhaHash; },
  autenticado() { try { return sessionStorage.getItem('conferidor.auth') || ''; } catch (e) { return ''; } },
  marcar(id) { try { sessionStorage.setItem('conferidor.auth', id); } catch (e) { } }
};
