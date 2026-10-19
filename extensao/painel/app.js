'use strict';
const VERSAO = '2.0.0';
const HIST_DIAS = 30;        // janela técnica de leitura dos registros (não configurável)
const MAX_BENEFICIARIOS = 5; // beneficiários diferentes por e-mail

/* ====================================================================
   Utilidades
   ==================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const norm = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtData = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtHora = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDH = v => `${fmtData(v)} ${fmtHora(v)}`;
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
async function copiar(texto) {
  try { if (navigator.clipboard && window.isSecureContext !== false) { await navigator.clipboard.writeText(texto); return true; } } catch (e) { }
  try { const ta = document.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
}
/* Copia com formatação (HTML + texto simples), para colar em e-mail. */
async function copiarRico(html, texto) {
  try {
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext !== false) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })]);
      return 'rico';
    }
  } catch (e) { }
  try {
    const d = document.createElement('div'); d.contentEditable = 'true'; d.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; d.innerHTML = html; document.body.appendChild(d);
    const r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const ok = document.execCommand('copy'); s.removeAllRanges(); d.remove(); if (ok) return 'rico';
  } catch (e) { }
  return (await copiar(texto)) ? 'simples' : false;
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
function abrirModal({ titulo, sub = '', icone = 'info', corpo, rodape = '', tamanho = '', aoFechar = null }) {
  fecharModal(true);
  const fundo = document.createElement('div'); fundo.className = 'modal-fundo'; fundo.id = 'modalFundo';
  fundo.innerHTML = `<div class="modal ${tamanho}" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">
    <div class="modal-h"><span class="caixa">${ic(icone, 'lg')}</span><div><h2 id="modalTitulo">${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <button class="btn ico" data-act="fecharModal" aria-label="Fechar" title="Fechar">${ic('x')}</button></div>
    <div class="modal-b" id="modalCorpo">${corpo}</div>${rodape ? `<div class="modal-f" id="modalRodape">${rodape}</div>` : ''}</div>`;
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fundo.dataset.fechar = '1'; else delete fundo.dataset.fechar; });
  fundo.addEventListener('click', e => { if (e.target === fundo && fundo.dataset.fechar) fecharModal(); });
  $('#modalRoot').appendChild(fundo);
  modalAtual = { aoFechar };
  const foco = $('[autofocus],input,textarea,select,.ed', fundo); if (foco) setTimeout(() => foco.focus(), 30);
}
function fecharModal(silencioso) {
  const f = $('#modalFundo'); if (!f) return;
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
        if (c.tagName === 'TD' || c.tagName === 'TH') s += ' ';
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
  ['local', /^local(\s+d[aeo]s?\s+(emissao|pedido|atendimento|solicitacao))?\b/],
  ['emissao', /^(data\s+(da\s+|de\s+|do\s+)?(emissao|pedido(\s+medico)?|solicitacao|encaminhamento|requisicao|receita)|emissao(\s+do\s+pedido)?|data)\b/],
  ['beneficiario', /^(benefici[a]ri[oa]s?|pacientes?|usuari[oa]|segurad[oa]|nome(\s+(completo|d[oa]s?\s+(benefici[a]ri[oa]|paciente|usuari[oa])))?)\b/],
  ['carteira', /^((n[or°º.]*\s*)?(d[ao]s?\s+)?(carteir(a|inha)\b|cart\b\.?|matricula\b|cartao\b)(\s+(promedica|do\s+benefici[a]ri[oa]|do\s+paciente|do\s+plano))?|codigo\s+do\s+benefici[a]ri[oa])/],
  ['servico', /^(servicos?|procedimentos?|terapias?|codigos?(\s+d[oa]s?\s+(servicos?|procedimentos?))?|tuss)(\s+(solicitad[oa]s?|autorizad[oa]s?|a\s+autorizar))?\b/],
  ['quantidade', /^(quantidades?|qtd[es]?|quant|sess(oes|ao)|n[oru°º.]*\s*(de\s+)?sess(oes|ao))\b\.?/],
  ['medico', /^(medic[oa]s?(\s+(solicitante|assistente|responsavel))?|dr[a]?\.?|doutor[a]?|solicitante|profissional(\s+solicitante)?|nome\s+do\s+medic[oa])\b/],
  ['cid', /^(cid(-?10)?|diagnostico)\b/],
  ['obs', /^(obs|observac(ao|oes))\b\.?/]
];
/* rótulos que dispensam os dois-pontos quando o valor tem o formato esperado (ex.: "CID F84", "Carteira 4122...") */
const VALOR_SEM_SEPARADOR = {
  carteira: /^\s+\d[\d\s.\-]{9,}/, cid: /^\s+[A-Za-z]\d{2}/, emissao: /^\s+\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/
};
const CART_RE = /(?<![\dA-Za-z])(?:\d[ ./\-]?){14}\d[ ./\-]?[A-Za-z0-9]{2}(?![\dA-Za-z])/;
function normUnidades(l) { let s = ''; for (let i = 0; i < l.length; i++) { const n = semAcento(l[i]).toLowerCase(); s += n.length ? n[0] : l[i]; } return s; }
function detectarRotulo(linhaOrig) {
  const limpa = linhaOrig.replace(/[*_ ]/g, ' ').replace(/\((a|o|as|os|s)\)/gi, '').replace(/^\s*(?:\d{1,2}\s*[.)\-]\s+)?[^\p{L}\p{N}]*/u, '').trim();
  const norm = normUnidades(limpa);
  for (const [k, re] of ROTULOS) {
    const m = norm.match(re);
    if (!m) continue;
    const resto = limpa.slice(m[0].length);
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
    /\(?\s*(?:quantidades?|qtde?|quant)\.?\s*[:=\-–—]?\s*(\d{1,3})\s*\)?/i,
    /(?<!\d)(\d{1,2})\s*[x×]\s*(?:por|\/|na|ao)\s*semana/i,   // "10 sessões - 03 x por semana": vale a frequência semanal
    /(?<!\d)(\d{1,2})\s*(?:sess(?:[õo]es|[ãa]o)|vezes|atendimentos?|consultas?)\b/i,
    new RegExp('(?:^|\\s)[x×]\\s*(\\d{1,2})(?!\\d)' + SEM_FREQ, 'i'),
    new RegExp('(?<!\\d)(\\d{1,2})\\s*[x×](?=\\s|$)' + SEM_FREQ, 'i'),
    /[-–—:|]\s*(\d{1,2})\s*(?:sess(?:[õo]es|[ãa]o))?\s*\.?\s*$/im,
    /\(\s*(\d{1,2})\s*\)\s*\.?\s*$/m
  ];
  const itens = ms.map((m, k) => {
    const seg = bloco.slice(m.index + 8, k + 1 < ms.length ? ms[k + 1].index : bloco.length);
    let qtd = null, qm = null;
    for (const p of pats) { qm = seg.match(p); if (qm) { qtd = Number(qm[1]); break; } }
    let origem = qtd != null ? 'linha' : null;
    let desc = (qm ? seg.slice(0, qm.index) : seg).split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    if (qtd == null) {   // último recurso: número solto no fim da própria linha do serviço ("80000004 Terapia 2")
      const fim = desc.match(/^(.*\D)\s+(\d{1,2})$/);
      if (fim && fim[1].replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3) { qtd = Number(fim[2]); desc = fim[1]; origem = 'fim-da-linha'; }
    }
    desc = desc.replace(/\s+\d{1,3}\s*sess(?:[õo]es|[ãa]o)\b.*$/i, '').replace(/^[\s\-–—:|.]+/, '').replace(/[\s\-–—:|(.,]+$/, '').trim();
    return { codigo: m[1], desc, qtd, origemQtd: origem };
  });
  const invalidos = [...bloco.matchAll(/(?<!\d)(\d{5,7}|\d{9,12})(?!\d)/g)].map(m => m[1]);
  return { itens, invalidos };
}
function lerMedico(bruto) {
  const conselho = (bruto.match(/\b(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b/i) || [''])[0].toUpperCase();
  const dig = (bruto.match(/\d[\d.\s]{1,10}\d|\d{3,}/) || [''])[0].replace(/\D/g, '');
  const nome = bruto.replace(/\b(CRM|CREMEB|CRP|CREFITO|CRFA|CRO)\b/gi, ' ').replace(/\b[A-Z]{2}\b(?=\s*[:\-\/]?\s*\d)/g, ' ')
    .replace(/[\d.]+/g, ' ').replace(/[-–—:\/|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { bruto, nome, crm: dig.length >= 3 ? dig : '', conselho };
}
function lerEmissao(bruto, referencia) {
  const b = (bruto || '').trim();
  if (!b) return { estado: 'ausente', bruto: '' };
  if (/sem\s*data/i.test(b)) return { estado: 'sem_data', bruto: b };
  const m = b.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return { estado: 'invalida', bruto: b };
  let [, d, mo, a] = m.map(Number); if (a < 100) a += 2000;
  const dt = new Date(a, mo - 1, d);
  if (dt.getDate() !== d || dt.getMonth() !== mo - 1) return { estado: 'invalida', bruto: b };
  const ref = referencia ? new Date(referencia) : new Date();
  return { estado: 'valida', bruto: b, data: dt.toISOString(), futura: dt > ref, mesesAtras: (ref - dt) / (30.44 * 864e5) };
}
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
    if (nome.replace(/[^\p{L}]/gu, '').length >= 3) { p.beneficiario = nome; p.beneficiarios = [nome]; }
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
  if (!medicoTxt) { const m = texto.match(/(?:^|\n)\s*(?:dr\.?|dra\.?|doutor(?:a)?)\s+([^\n]+)/i); if (m) medicoTxt = m[0].trim().replace(/^(dr\.?|dra\.?|doutor(a)?)\s+/i, ''); }
  if (!medicoTxt) { const m = texto.match(/\bCRM\s*[:\-]?\s*(\d{3,7})[ \t]*([^\n]*)/i); if (m) medicoTxt = `${m[2].trim()} CRM ${m[1]}`.trim(); }
  p.medico = lerMedico(medicoTxt);
  if (p.medico.nome && !p.medico.crm) { const m = texto.match(/\bCRM\s*[:\-]?\s*(\d{3,7})/i); if (m) { p.medico.crm = m[1]; p.medico.conselho = p.medico.conselho || 'CRM'; p.medico.bruto = `${p.medico.bruto} CRM ${m[1]}`.trim(); } }   // CRM em linha própria, abaixo do nome
  let cidTxt = primeiraLinha(de('cid')[0]);
  if (!cidTxt) { const m = texto.match(/\bCID(?:-?10)?\s*[:\-]?\s*([A-Za-z])\s?(\d{2,3}(?:\.\d{1,2})?)/i); if (m) cidTxt = m[1] + m[2]; }
  cidTxt = cidTxt.replace(/\s+/g, '');
  if (cidTxt && !/^[A-Za-z]\d{2}/.test(cidTxt) && /^\d{3,7}$/.test(cidTxt)) { // "CID : 31163" colado na linha do médico é, na verdade, o CRM
    if (!p.medico.crm) { p.medico.crm = cidTxt; p.medico.bruto = `${p.medico.bruto} CRM ${cidTxt}`.trim(); } cidTxt = '';
  }
  p.cid = cidTxt.toUpperCase();
  p.emissao = lerEmissao(primeiraLinha(de('emissao')[0]), referencia);
  if (p.emissao.estado === 'ausente' && /sem\s+data/i.test(texto)) p.emissao = lerEmissao('SEM DATA', referencia);
  if (p.emissao.estado === 'ausente') { const m = texto.replace(CART_RE, ' ').match(/(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d\d)(?!\d)/); if (m) p.emissao = lerEmissao(`${m[1]}/${m[2]}/${m[3]}`, referencia); }
  p.local = primeiraLinha(de('local')[0]);
  p.obs = de('obs').map(s => s.linhas.join(' ').trim()).filter(Boolean).join(' | ');
  const aplicarQtd = (lista, qsec) => {
    const q = (primeiraLinha(qsec).match(/\d+/) || [null])[0];
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
  if (!de('servico').length) {
    let livres = secoes.filter(s => s.k === null || s.k === 'obs').flatMap(s => s.linhas).filter(l => /^\s*[^\p{L}\p{N}]*(?:\d{1,2}[.)]\s*)?\d{8}(?!\d)/u.test(l));
    if (!livres.length && p.carteiraBruta) {   // código solto na mesma linha da carteira ("NOME carteira 50000616 FONO")
      livres = texto.split('\n').map(l => l.replace(CART_RE, ' ')).filter(l => /(?<![\dA-Za-z])\d{8}(?!\d)/.test(l)).map(l => l.slice(l.search(/(?<![\dA-Za-z])\d{8}(?!\d)/)));
    }
    const r = extrairItens(livres.join('\n'));
    if (r.itens.length) { p.semRotulo = true; p.itens = r.itens; }
  }
  const qLivre = de('quantidade').filter(s => !s.usada);
  if (qLivre.length === 1 && p.itens.filter(i => i.qtd == null).length) aplicarQtd(p.itens, qLivre[0]);
  const usados = new Set(p.itens.map(i => i.codigo));
  const textoLivre = secoes.filter(s => !['carteira', 'medico', 'emissao', 'cid'].includes(s.k)).flatMap(s => s.linhas).join('\n');
  p.soltos = [...new Set([...textoLivre.matchAll(/(?<![\dA-Za-z])(\d{8})(?!\d)/g)].map(m => m[1]).filter(c => !usados.has(c)))];
  p.secoesEncontradas = [...new Set(secoes.map(s => s.k).filter(Boolean))];
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
function lerPedidos(texto, referencia) {
  const L = texto.split('\n').flatMap(explodirLinha);
  /* 1) separadores explícitos (linhas de traços, "Paciente 2") */
  const chunks = [[]];
  L.forEach(l => { if (RE_SEPARADOR.test(l)) chunks.push([]); else chunks[chunks.length - 1].push(l); });
  const comDados = [], compartilhado = [];
  chunks.forEach(c => {
    const ks = rotulosDe(c);
    if (ks.some(k => k === 'beneficiario' || k === 'carteira')) comDados.push(c);
    else if (ks.includes('servico') && comDados.length) comDados[comDados.length - 1].push(...c);   // serviços depois de um traço continuam o mesmo paciente
    else compartilhado.push(c);
  });
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
   Pasta compartilhada (File System Access API) + IndexedDB
   ==================================================================== */
function idbAbrir() { return new Promise((res, rej) => { const r = indexedDB.open('conferidor', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { try { const db = await idbAbrir(); return await new Promise(res => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbSet(k, v) { const db = await idbAbrir(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

const Pasta = {
  handle: null, ok: false, suportado: 'showDirectoryPicker' in window,
  async init() {
    if (!this.suportado) return;
    this.handle = await idbGet('pasta');
    if (this.handle) { try { this.ok = (await this.handle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.ok = false; } }
  },
  async conectar() {
    const h = await window.showDirectoryPicker({ id: 'conferidor-pasta', mode: 'readwrite' });
    this.handle = h; await idbSet('pasta', h); this.ok = true;
  },
  async reautorizar() {
    if (!this.handle) return this.conectar();
    this.ok = (await this.handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  },
  async dir(partes, criar) { let d = this.handle; for (const p of partes) d = await d.getDirectoryHandle(p, { create: !!criar }); return d; },
  async ler(partes, nome) { try { const d = await this.dir(partes, false); const f = await (await d.getFileHandle(nome)).getFile(); return JSON.parse(await f.text()); } catch (e) { return null; } },
  async gravar(partes, nome, obj) {
    const d = await this.dir(partes, true); const fh = await d.getFileHandle(nome, { create: true });
    const w = await fh.createWritable(); await w.write(JSON.stringify(obj, null, 1)); await w.close();
  },
  async listar(partes) { try { const d = await this.dir(partes, false); const out = []; for await (const [n, h] of d.entries()) out.push([n, h]); return out; } catch (e) { return []; } },
  async apagar(partes, nome) { try { const d = await this.dir(partes, false); await d.removeEntry(nome); return true; } catch (e) { return false; } }
};

/* Configuração */

/* ====================================================================
   Catálogos: modelos de texto, campos dinâmicos, alertas, motivos
   ==================================================================== */
const padraoHtml = t => String(t).replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).map(par => '<p>' + esc(par).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '</p>').join('');

/* Modelos: texto-base com campos entre chaves. O texto vira HTML ao carregar. */
const MODELOS_PADRAO = {
  autorizada: { nome: 'Guia autorizada', texto:
`{GUIA}

{SAUDACAO}!

Informamos que a guia acima foi devidamente **autorizada** e encaminhada pelo e-mail nao-responda@promedica.com.br.

Beneficiário: {BENEFICIARIO}
Serviços autorizados:
{ITENS_AUTORIZADOS}

Se algum serviço ou quantidade não corresponder ao solicitado, responda este e-mail informando a divergência.

{OBS_ADICIONAIS}

Permanecemos à disposição para eventuais esclarecimentos.
Desejamos um ótimo dia de trabalho!` },
  parcial: { nome: 'Guia parcialmente autorizada', texto:
`{GUIA}

{SAUDACAO}!

Informamos que a guia acima foi gerada e **autorizada parcialmente**, e encaminhada pelo e-mail nao-responda@promedica.com.br.

Beneficiário: {BENEFICIARIO}

Serviços autorizados:
{ITENS_AUTORIZADOS}

Serviços **não autorizados**:
{ITENS_NAO_AUTORIZADOS}

{OBS_ADICIONAIS}

Em caso de dúvidas, responda este e-mail.

Permanecemos à disposição para eventuais esclarecimentos.` },
  nao_autorizada: { nome: 'Guia não autorizada', texto:
`{GUIA}

{SAUDACAO}!

Informamos que a guia acima **não foi autorizada**.

Beneficiário: {BENEFICIARIO}
Serviços solicitados:
{ITENS_NAO_AUTORIZADOS}

Motivo: {MOTIVO_NAO_AUTORIZACAO}

{OBS_ADICIONAIS}

Em caso de dúvidas, responda este e-mail.

Permanecemos à disposição para eventuais esclarecimentos.` },
  correcao: { nome: 'Correção realizada', texto:
`{GUIA}

{SAUDACAO}!

A guia acima foi corrigida conforme solicitado e reencaminhada pelo e-mail nao-responda@promedica.com.br.

Beneficiário: {BENEFICIARIO}
Serviços autorizados:
{ITENS_AUTORIZADOS}

{OBS_ADICIONAIS}

Permanecemos à disposição para eventuais esclarecimentos.` },
  pendencia: { nome: 'Pendência de dados', texto:
`{SAUDACAO}!

Não foi possível gerar a guia de {BENEFICIARIO} pelo(s) motivo(s) abaixo:

{PROBLEMAS}

Por gentileza, responda este e-mail com as informações corrigidas para darmos continuidade.

Modelo de pedido:
{MODELO_PEDIDO}

Permanecemos à disposição.` },
  ja_autorizado: { nome: 'Já autorizado (cobrança)', texto:
`{SAUDACAO}!

O pedido de {BENEFICIARIO} já foi autorizado anteriormente na guia {GUIA_ANTERIOR}, em {DATA_ANTERIOR}, com os serviços:

{ITENS_ANTERIOR}

A guia foi encaminhada pelo e-mail nao-responda@promedica.com.br. Caso não a tenha recebido, responda este e-mail que faremos o reenvio.

Permanecemos à disposição.` },
  carteira_nao_localizada: { nome: 'Beneficiário não localizado', texto:
`{SAUDACAO}!

Não localizamos o beneficiário {BENEFICIARIO} com a carteira informada ({CARTEIRA_INFORMADA}).

Por gentileza, confirme o nome completo e o número da carteira Promédica (17 caracteres, sem espaços).

Permanecemos à disposição.` },
  nome_carteira: { nome: 'Nome e carteira não conferem', texto:
`{SAUDACAO}!

A carteira informada ({CARTEIRA_INFORMADA}) não pertence a {BENEFICIARIO}.

Por gentileza, confirme o nome completo e o número da carteira Promédica do beneficiário.

Permanecemos à disposição.` },
  outra_clinica: { nome: 'Paciente já realiza atendimento em outra clínica', texto:
`{SAUDACAO}!

Informamos que, na verificação realizada, consta que o beneficiário {BENEFICIARIO} (carteira {CARTEIRA}) já realiza atendimento em outra clínica para o(s) serviço(s) solicitado(s):

{ITENS}

Por esse motivo, a solicitação depende de análise e regularização, conforme o procedimento aplicável. Pedimos que aguarde o nosso retorno ou nos informe, em resposta a este e-mail, os dados necessários para a análise.

{OBS_ADICIONAIS}

Permanecemos à disposição para eventuais esclarecimentos.` },
  excluido_carencia: { nome: 'Paciente excluído ou com carência', texto:
`{SAUDACAO}!

Informamos que não foi possível realizar a autorização do(s) serviço(s) solicitado(s) para o beneficiário {BENEFICIARIO} (carteira {CARTEIRA}), devido à situação identificada na verificação realizada (exclusão ou carência, conforme o resultado da consulta).

Serviços solicitados:
{ITENS}

{OBS_ADICIONAIS}

Em caso de dúvidas, responda este e-mail.

Permanecemos à disposição.` },
  sem_direito_local: { nome: 'Paciente sem direito no local ou prestador', texto:
`{SAUDACAO}!

Informamos que não foi possível autorizar o(s) serviço(s) solicitado(s) para o beneficiário {BENEFICIARIO} (carteira {CARTEIRA}) no local ou prestador informado ({CLINICA}), de acordo com o resultado da verificação realizada.

Serviços solicitados:
{ITENS}

{OBS_ADICIONAIS}

Em caso de dúvidas, responda este e-mail.

Permanecemos à disposição.` },
  resposta_multipla: { nome: 'Resposta com várias guias', texto:
`{SAUDACAO}!

Segue o resultado das guias solicitadas neste e-mail:

{RESUMO_GUIAS}

Se algum serviço ou quantidade não corresponder ao solicitado, responda este e-mail informando a divergência.

Permanecemos à disposição para eventuais esclarecimentos.` },
  modelo_pedido: { nome: 'Modelo de pedido para as clínicas', texto:
`Beneficiário:
Carteira: (17 caracteres, sem espaços)
Serviços (um por linha: CÓDIGO - DESCRIÇÃO - QUANTIDADE):
Médico: (nome e CRM)
CID:
Emissão: (dd/mm/aaaa ou SEM DATA)
Local de emissão:
Observações:` },
  personalizado_1: { nome: 'Modelo personalizado 1', texto:
`{SAUDACAO}!

Escreva aqui o texto deste modelo.

Permanecemos à disposição.` },
  personalizado_2: { nome: 'Modelo personalizado 2', texto:
`{SAUDACAO}!

Escreva aqui o texto deste modelo.

Permanecemos à disposição.` },
  observacao: { nome: 'Observação da guia', texto:
`Solicitante: {REMETENTE}
Recebido em: {DATA_EMAIL}
Assunto: {ASSUNTO}
----- Pedido original -----
{TEXTO_ORIGINAL}` },
  obs_parametrizado: { nome: 'Observação de atendimento parametrizado', texto:
`Atendimento parametrizado conforme pedido médico. Não é necessário encaminhar novamente o pedido médico nos próximos e-mails, exceto em caso de alteração das informações ou do tratamento.` },
  parametrizacao: { nome: 'Texto da parametrização (cabeçalho)', texto:
`Médico — Data: {PARAM_MEDICO} — {PARAM_DATA}
{PARAM_TERAPIAS}` },
  parametrizacao_linha: { nome: 'Texto da parametrização (cada terapia)', texto:
`Terapia: {TERAPIA_DESCRICAO} — Quantidade: {TERAPIA_QTD}` }
};
/* Trecho de cada guia na resposta única, quando o e-mail tem várias guias e esta não foi gerada */
const MULTI_PADRAO = {
  pendencia: 'Beneficiário: {BENEFICIARIO}\nNão foi possível gerar a guia pelo(s) motivo(s) abaixo:\n{PROBLEMAS}',
  ja_autorizado: 'Beneficiário: {BENEFICIARIO}\nJá autorizado anteriormente na guia {GUIA_ANTERIOR}, em {DATA_ANTERIOR}, com os serviços:\n{ITENS_ANTERIOR}',
  carteira_nao_localizada: 'Beneficiário: {BENEFICIARIO}\nNão localizado com a carteira informada ({CARTEIRA_INFORMADA}). Por gentileza, confirme o nome completo e a carteira Promédica.',
  nome_carteira: 'Beneficiário: {BENEFICIARIO}\nA carteira informada ({CARTEIRA_INFORMADA}) não pertence ao beneficiário. Por gentileza, confirme o nome completo e a carteira Promédica.',
  outra_clinica: 'Beneficiário: {BENEFICIARIO} (carteira {CARTEIRA})\nConsta atendimento em outra clínica para o(s) serviço(s) solicitado(s). A solicitação depende de análise e regularização, conforme o procedimento aplicável.\n{ITENS}',
  excluido_carencia: 'Beneficiário: {BENEFICIARIO} (carteira {CARTEIRA})\nNão foi possível autorizar o(s) serviço(s) solicitado(s), devido à situação identificada na verificação (exclusão ou carência, conforme o resultado da consulta).\n{ITENS}',
  sem_direito_local: 'Beneficiário: {BENEFICIARIO} (carteira {CARTEIRA})\nNão foi possível autorizar o(s) serviço(s) solicitado(s) no local ou prestador informado ({CLINICA}), de acordo com o resultado da verificação.\n{ITENS}',
  personalizado_1: 'Beneficiário: {BENEFICIARIO}\nEscreva aqui o trecho deste modelo para e-mails com várias guias.',
  personalizado_2: 'Beneficiário: {BENEFICIARIO}\nEscreva aqui o trecho deste modelo para e-mails com várias guias.'
};
Object.entries(MULTI_PADRAO).forEach(([k, t]) => { MODELOS_PADRAO[k + '_multi'] = { nome: MODELOS_PADRAO[k].nome + ' (várias guias)', texto: t }; });
/* destino: 'email' (cola em e-mail, aceita formatação) | 'texto' (campo de texto simples do sistema oficial) */
const MODELOS_META = {
  autorizada: { grupo: 'Resposta pelo resultado da guia', destino: 'email', uso: 'Etapa Finalizar, quando a situação da guia é Autorizada.' },
  parcial: { grupo: 'Resposta pelo resultado da guia', destino: 'email', uso: 'Etapa Finalizar, quando a situação da guia é Parcialmente autorizada. Lista os itens autorizados e os não autorizados.' },
  nao_autorizada: { grupo: 'Resposta pelo resultado da guia', destino: 'email', uso: 'Etapa Finalizar, quando a situação da guia é Não autorizada. Inclui o motivo registrado.' },
  correcao: { grupo: 'Resposta pelo resultado da guia', destino: 'email', uso: 'Etapa Finalizar, para guia autorizada que corrige um pedido anterior (assunto com RE:). Pode ser escolhido no lugar de "Guia autorizada".' },
  pendencia: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão em Responder sem gerar guia: quando há bloqueio e a clínica precisa corrigir dados do pedido.' },
  ja_autorizado: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão em Responder sem gerar guia: quando a clínica cobra um pedido já autorizado. Preenche a guia anterior mais recente da mesma carteira e código, se existir.' },
  carteira_nao_localizada: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão em Responder sem gerar guia: quando o beneficiário não é localizado no sistema oficial pela carteira informada.' },
  nome_carteira: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão em Responder sem gerar guia: quando nome e carteira não pertencem à mesma pessoa.' },
  outra_clinica: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão "Já atende em outra clínica", em Responder sem gerar guia. A guia é concluída sem número, com este texto como resposta.' },
  excluido_carencia: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão "Excluído ou com carência", em Responder sem gerar guia.' },
  sem_direito_local: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Botão "Sem direito no local ou prestador", em Responder sem gerar guia.' },
  personalizado_1: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Descreva aqui quando usar este modelo (aparece como botão em Responder sem gerar guia).', custom: true },
  personalizado_2: { grupo: 'Sem gerar guia: guia única', destino: 'email', uso: 'Descreva aqui quando usar este modelo (aparece como botão em Responder sem gerar guia).', custom: true },
  resposta_multipla: { grupo: 'E-mail com várias guias', destino: 'email', uso: 'Resposta única que reúne o resultado de todas as guias do mesmo e-mail (botão "Resposta do e-mail").' },
  modelo_pedido: { grupo: 'Modelo de pedido para as clínicas', destino: 'email', uso: 'Inserido na resposta de pendência, para mostrar à clínica como enviar o pedido.' },
  observacao: { grupo: 'Observação da guia', destino: 'texto', uso: 'Texto base do campo de observação da guia no sistema oficial (remetente e pedido original).' },
  obs_parametrizado: { grupo: 'Observação da guia', destino: 'texto', uso: 'Oferecido em "Incluir observação" somente quando uma parametrização foi criada ou aplicada neste atendimento.' },
  parametrizacao: { grupo: 'Parametrização', destino: 'texto', uso: 'Formato do texto estruturado gerado no botão "Parametrizar".' },
  parametrizacao_linha: { grupo: 'Parametrização', destino: 'texto', uso: 'Formato de cada linha de terapia dentro do texto da parametrização.' }
};
Object.keys(MULTI_PADRAO).forEach(k => { MODELOS_META[k + '_multi'] = { grupo: 'Sem gerar guia: várias guias', destino: 'email', uso: 'Trecho desta guia dentro da resposta única do e-mail, quando ele tem várias guias e esta guia ficou sem ser gerada. Os trechos de todas as guias entram no campo "Resumo de todas as guias" do modelo "Resposta com várias guias".' }; });
const MODELOS_RESPOSTA_ORDEM = ['autorizada', 'parcial', 'nao_autorizada', 'correcao', 'pendencia', 'ja_autorizado', 'carteira_nao_localizada', 'nome_carteira', 'outra_clinica', 'excluido_carencia', 'sem_direito_local', 'personalizado_1', 'personalizado_2', 'resposta_multipla', 'modelo_pedido'];
const MODELOS_SEM_GUIA = ['pendencia', 'ja_autorizado', 'carteira_nao_localizada', 'nome_carteira', 'outra_clinica', 'excluido_carencia', 'sem_direito_local', 'personalizado_1', 'personalizado_2'];
const MODELOS_SITUACAO = ['outra_clinica', 'excluido_carencia', 'sem_direito_local'];
const MODELOS_PERSONALIZADOS = ['personalizado_1', 'personalizado_2'];
const nomeModelo = k => k.endsWith('_multi') ? nomeModelo(k.slice(0, -6)) + ' (várias guias)' : ((cfg.modelos[k] && cfg.modelos[k].nome) || (MODELOS_PADRAO[k] || {}).nome || k);
const usoModelo = k => ((cfg.modelos[k.replace(/_multi$/, '')] && cfg.modelos[k.replace(/_multi$/, '')].uso) || (MODELOS_META[k] || {}).uso || '');
const BOTOES_SITUACAO = { outra_clinica: 'Já atende em outra clínica', excluido_carencia: 'Excluído ou com carência', sem_direito_local: 'Sem direito no local ou prestador' };

/* ---------- Campos dinâmicos (organizados por categoria) ---------- */
const itensTxt = (its, dc) => its.map(i => `• ${i.codigo} – ${dc(i)} – quantidade: ${i.qtd ?? '?'}`).join('\n');
const SIT_ROTULO = { autorizada: 'Autorizada', parcial: 'Parcialmente autorizada', nao: 'Não autorizada', sem_guia: 'Sem guia gerada' };
function motivoNome(id) { const m = (cfg.motivos || []).find(x => x.id === id); return m ? m.nome : ''; }
function itensDaGuia(g) { return g.pedido.itens; }
function descRef(g, it) { const cl = clinicaDe(S); return (cl && cl.codigos && cl.codigos[it.codigo]) || it.desc || 'serviço'; }
function negadosDe(g) {
  const r = g.resultado; if (g.semGuia) return [];
  if (r.situacao === 'nao') return itensDaGuia(g).map(i => ({ it: i, motivo: '' }));
  if (r.situacao === 'parcial') return itensDaGuia(g).filter(i => r.naoAut[i.codigo] != null).map(i => ({ it: i, motivo: motivoNome(r.naoAut[i.codigo]) }));
  return [];
}
function autorizadosDe(g) {
  const r = g.resultado; if (g.semGuia) return [];
  if (r.situacao === 'nao') return [];
  if (r.situacao === 'parcial') return itensDaGuia(g).filter(i => r.naoAut[i.codigo] == null);
  return itensDaGuia(g);
}
function resumoGuiaTexto(g) {
  const r = g.resultado, L = [];
  if (g.semGuia && g.status !== 'descartado') return renderModelo(g.semGuia + '_multi', ctxDe(g, extrasSemGuia(g, g.semGuia))).texto;
  L.push(`Beneficiário: ${g.pedido.beneficiario || '(não informado)'}`);
  if (g.status === 'descartado') return L.concat('Solicitação ignorada.').join('\n');
  if (!r.situacao || (g.status !== 'concluido' && !g.numero)) return L.concat('Guia ainda não processada.').join('\n');
  L.push(`Guia: ${g.numero} — Situação: ${SIT_ROTULO[r.situacao]}`);
  const a = autorizadosDe(g), n = negadosDe(g);
  if (a.length) L.push('Serviços autorizados:', itensTxt(a, i => descRef(g, i)));
  if (n.length) L.push('Serviços não autorizados:', n.map(x => `• ${x.it.codigo} – ${descRef(g, x.it)} – quantidade: ${x.it.qtd ?? '?'}${x.motivo ? ' — motivo: ' + x.motivo : ''}`).join('\n'));
  const mot = [motivoNome(r.motivoId), r.motivoTxt].filter(Boolean).join(' — ');
  if (r.situacao === 'nao' && mot) L.push('Motivo: ' + mot);
  if (r.obsAdicionais) L.push('Observações: ' + r.obsAdicionais);
  return L.join('\n');
}
const CAMPOS = [
  // Beneficiário
  { k: 'BENEFICIARIO', cat: 'Dados do beneficiário', nome: 'Nome do beneficiário', desc: 'Nome lido no pedido (editável na etapa Pedido e alertas).', ex: 'Maria da Silva Souza', fn: c => c.g.pedido.beneficiario },
  { k: 'CARTEIRA', cat: 'Dados do beneficiário', nome: 'Carteira usada no sistema', desc: 'Carteira de 17 caracteres informada pelo operador.', ex: '412200000123456EQ', fn: c => c.g.carteiraUsada },
  { k: 'CARTEIRA_INFORMADA', cat: 'Dados do beneficiário', nome: 'Carteira informada no e-mail', desc: 'Como a clínica escreveu a carteira, mesmo fora do padrão.', ex: '4122 0000 0123 456 EQ', fn: c => c.g.pedido.carteiraBruta || 'não informada' },
  // Clínica
  { k: 'CLINICA', cat: 'Dados da clínica', nome: 'Nome da clínica', desc: 'Clínica identificada pelo remetente.', ex: 'Clínica Exemplo', fn: c => (clinicaDe(c.S) || {}).nome || '' },
  { k: 'EXECUTANTE', cat: 'Dados da clínica', nome: 'Credenciado executante', desc: 'Nome como aparece no sistema oficial.', ex: 'CLINICA EXEMPLO LTDA', fn: c => c.g.executante ?? (clinicaDe(c.S) || {}).executante ?? '' },
  { k: 'REMETENTE', cat: 'Dados da clínica', nome: 'Remetente do e-mail', desc: 'Nome e endereço de quem enviou o pedido.', ex: 'Atendimento <contato@clinicaexemplo.com.br>', fn: c => c.S.email.remetente.nome ? `${c.S.email.remetente.nome} <${c.S.email.remetente.email}>` : c.S.email.remetente.email },
  { k: 'EMAIL_PRESTADOR', cat: 'Dados da clínica', nome: 'E-mail do prestador', desc: 'Endereço para a resposta (etapa Finalizar).', ex: 'contato@clinicaexemplo.com.br', opc: true, fn: c => c.g.resultado.emailPrestador },
  // Médico
  { k: 'MEDICO', cat: 'Dados do médico', nome: 'Nome do médico', desc: 'Médico solicitante lido no pedido.', ex: 'Dr. João Pereira', fn: c => c.g.pedido.medico.nome },
  { k: 'CRM', cat: 'Dados do médico', nome: 'Conselho e número', desc: 'Registro profissional do médico.', ex: 'CRM 12345', opc: true, fn: c => c.g.pedido.medico.crm ? `${c.g.pedido.medico.conselho || 'CRM'} ${c.g.pedido.medico.crm}` : '' },
  // Pedido
  { k: 'DATA_PEDIDO', cat: 'Dados do pedido médico', nome: 'Data do pedido médico', desc: 'Data de emissão (ou "SEM DATA").', ex: '15/09/2026', opc: true, fn: c => dataPedidoTxt(c.g.pedido) },
  { k: 'LOCAL_PEDIDO', cat: 'Dados do pedido médico', nome: 'Local do pedido', desc: 'Local de emissão informado.', ex: 'Salvador - BA', opc: true, fn: c => c.g.pedido.local },
  { k: 'CID', cat: 'Dados do pedido médico', nome: 'CID', desc: 'Diagnóstico informado no pedido.', ex: 'F84', opc: true, fn: c => c.g.pedido.cid },
  { k: 'OBS_PEDIDO', cat: 'Dados do pedido médico', nome: 'Observações do pedido', desc: 'Texto do campo Observações do e-mail.', ex: 'Atendimento domiciliar', opc: true, fn: c => c.g.pedido.obs },
  // Guia
  { k: 'GUIA', cat: 'Dados da guia', nome: 'Número da guia', desc: 'Número gerado pelo sistema oficial (T ou S + 8 dígitos).', ex: 'T12345678', fn: c => c.g.numero },
  { k: 'GUIA_ANTERIOR', cat: 'Dados da guia', nome: 'Guia anterior', desc: 'Guia já autorizada para a mesma carteira e código (modelo "Já autorizado").', ex: 'T11112222', fn: c => (c.extra.anterior || {}).guia },
  { k: 'DATA_ANTERIOR', cat: 'Dados da guia', nome: 'Data da guia anterior', desc: 'Data em que a guia anterior foi concluída.', ex: '02/09/2026', fn: c => (c.extra.anterior || {}).data },
  { k: 'DATA_EMAIL', cat: 'Dados da guia', nome: 'Data do e-mail', desc: 'Data e hora de recebimento do pedido.', ex: '10/09/2026 08:15', fn: c => fmtDH(c.S.email.data) },
  { k: 'ASSUNTO', cat: 'Dados da guia', nome: 'Assunto do e-mail', desc: 'Assunto original da mensagem.', ex: 'Pedido de autorização', fn: c => c.S.email.assunto },
  // Serviços
  { k: 'ITENS', cat: 'Serviços e quantidades', nome: 'Serviços solicitados', desc: 'Todos os itens do pedido: código, descrição e quantidade.', ex: '• 80000004 – Terapia Ocupacional – quantidade: 2', fn: c => itensTxt(itensDaGuia(c.g), i => descRef(c.g, i)) },
  { k: 'ITENS_AUTORIZADOS', cat: 'Serviços e quantidades', nome: 'Serviços autorizados', desc: 'Itens autorizados conforme o resultado registrado na guia.', ex: '• 80000004 – Terapia Ocupacional – quantidade: 2', fn: c => itensTxt(autorizadosDe(c.g), i => descRef(c.g, i)) || '(nenhum)' },
  { k: 'ITENS_NAO_AUTORIZADOS', cat: 'Serviços e quantidades', nome: 'Serviços não autorizados', desc: 'Itens negados, com o motivo quando registrado.', ex: '• 80000010 – Fonoaudiologia – quantidade: 4 — motivo: Sem direito no local', fn: c => negadosDe(c.g).map(x => `• ${x.it.codigo} – ${descRef(c.g, x.it)} – quantidade: ${x.it.qtd ?? '?'}${x.motivo ? ' — motivo: ' + x.motivo : ''}`).join('\n') || '(nenhum)' },
  { k: 'ITENS_ANTERIOR', cat: 'Serviços e quantidades', nome: 'Serviços da guia anterior', desc: 'Itens da guia já autorizada (modelo "Já autorizado").', ex: '• 80000004 – Terapia Ocupacional – quantidade: 2', fn: c => (c.extra.anterior || {}).itens },
  // Situação
  { k: 'SITUACAO', cat: 'Situação da autorização', nome: 'Situação da guia', desc: 'Autorizada, Parcialmente autorizada ou Não autorizada.', ex: 'Parcialmente autorizada', fn: c => SIT_ROTULO[c.g.resultado.situacao] || '' },
  { k: 'MOTIVO_NAO_AUTORIZACAO', cat: 'Situação da autorização', nome: 'Motivo da não autorização', desc: 'Motivo selecionado na etapa Finalizar, com o detalhe digitado.', ex: 'Sem direito no local ou prestador', fn: c => [motivoNome(c.g.resultado.motivoId), c.g.resultado.motivoTxt].filter(Boolean).join(' — ') },
  { k: 'OBS_ADICIONAIS', cat: 'Situação da autorização', nome: 'Observações adicionais', desc: 'Texto livre digitado na etapa Finalizar. Se vazio, a linha some.', ex: 'Favor reenviar o pedido médico atualizado.', opc: true, fn: c => c.g.resultado.obsAdicionais },
  // Alertas
  { k: 'PROBLEMAS', cat: 'Alertas e observações', nome: 'Pendências identificadas', desc: 'Lista dos bloqueios do pedido, em linguagem para a clínica.', ex: '• Quantidade não informada para o serviço 80000004.', fn: c => c.extra.problemas },
  { k: 'TEXTO_ORIGINAL', cat: 'Alertas e observações', nome: 'Pedido original', desc: 'Texto do e-mail como recebido, sem as mensagens anteriores. É o mesmo para todas as guias do e-mail.', ex: 'Beneficiário: Maria... Serviço: 80000004...', fn: c => c.S.email.textoPrincipal },
  // Parametrização
  { k: 'PARAM_MEDICO', cat: 'Dados de parametrização', nome: 'Médico da parametrização', desc: 'Nome do médico informado no modal Parametrizar.', ex: 'Dr. João Pereira', fn: c => (c.extra.param || {}).medico },
  { k: 'PARAM_DATA', cat: 'Dados de parametrização', nome: 'Data da parametrização', desc: 'Data de emissão do pedido médico parametrizado.', ex: '15/09/2026', fn: c => (c.extra.param || {}).data },
  { k: 'PARAM_TERAPIAS', cat: 'Dados de parametrização', nome: 'Lista de terapias', desc: 'Todas as terapias da parametrização, uma por linha.', ex: 'Terapia: Terapia Ocupacional — Quantidade: 8', fn: c => (c.extra.param || {}).terapias },
  { k: 'TERAPIA_DESCRICAO', cat: 'Dados de parametrização', nome: 'Descrição da terapia', desc: 'Usado no modelo de cada linha de terapia.', ex: 'Terapia Ocupacional', fn: c => (c.extra.terapia || {}).descricao },
  { k: 'TERAPIA_QTD', cat: 'Dados de parametrização', nome: 'Quantidade da terapia', desc: 'Usado no modelo de cada linha de terapia.', ex: '8', fn: c => (c.extra.terapia || {}).qtd },
  // Outros
  { k: 'SAUDACAO', cat: 'Gerais', nome: 'Saudação', desc: 'Bom dia, Boa tarde ou Boa noite, conforme a hora.', ex: 'Bom dia', fn: () => saudacao() },
  { k: 'MODELO_PEDIDO', cat: 'Gerais', nome: 'Modelo de pedido', desc: 'Texto do modelo de pedido para as clínicas.', ex: 'Beneficiário: … Carteira: …', fn: c => htmlPlano(modeloHtmlBruto('modelo_pedido')), html: c => modeloHtmlBruto('modelo_pedido') },
  { k: 'RESUMO_GUIAS', cat: 'Gerais', nome: 'Resumo de todas as guias', desc: 'Resultado de cada guia do e-mail (usado na resposta com várias guias).', ex: 'Beneficiário: Maria… Guia: T… — Autorizada', fn: c => c.S.guias.filter(x => x.status !== 'descartado').map(resumoGuiaTexto).join('\n\n'),
    html: c => c.S.guias.filter(x => x.status !== 'descartado').map(x => '<p>' + resumoGuiaTexto(x).split('\n').map((l, i) => i === 0 ? '<b>' + esc(l) + '</b>' : esc(l)).join('<br>') + '</p>').join('') }
];
const CAMPO = Object.fromEntries(CAMPOS.map(f => [f.k, f]));
const CAMPOS_CATS = unicos(CAMPOS.map(f => f.cat));
function dataPedidoTxt(p) { const em = p.emissao; return em.estado === 'valida' ? fmtData(em.data) : em.estado === 'sem_data' ? 'SEM DATA' : (em.bruto || ''); }

/* ---------- Alertas: catálogo único. O comportamento real vem de cfg.alertas. ---------- */
/* modos: bloqueio | obs (aviso com observação) | atencao (aviso de atenção) | desativado */
const MODOS = {
  bloqueio: { nome: 'Bloqueio', icone: 'ban', desc: 'Impede seguir até resolver.' },
  obs: { nome: 'Aviso com observação', icone: 'message', desc: 'Continua, e oferece texto para a observação.' },
  atencao: { nome: 'Aviso de atenção', icone: 'alert', desc: 'Só avisa. Não impede nada.' },
  desativado: { nome: 'Desativado', icone: 'x', desc: 'Não é verificado.' }
};
const ALERTAS = {
  'falta-benef': { grupo: 'Identificação', nome: 'Beneficiário não informado', desc: 'O pedido não traz o nome do beneficiário.', modo: 'bloqueio' },
  'cart': { grupo: 'Identificação', nome: 'Carteira ausente ou fora do padrão', desc: 'A carteira não tem 15 dígitos + 2 caracteres. O operador informa a carteira usada no sistema.', modo: 'bloqueio' },
  'cart-dif': { grupo: 'Identificação', nome: 'Carteira usada diferente da informada', desc: 'A carteira usada no sistema não é a escrita no e-mail.', modo: 'atencao' },
  'excesso-benef': { grupo: 'Identificação', nome: 'Mais de 5 beneficiários diferentes no e-mail', desc: 'O limite é 5 beneficiários diferentes por e-mail. Os excedentes ficam bloqueados.', modo: 'bloqueio' },
  'mesmo-benef': { grupo: 'Identificação', nome: 'Mesmo beneficiário em mais de uma solicitação', desc: 'Cada solicitação gera uma guia independente. Confira se não há duplicidade.', modo: 'atencao' },
  'falta-serv': { grupo: 'Serviços', nome: 'Nenhum serviço encontrado', desc: 'Nenhum código de 8 dígitos foi lido no pedido.', modo: 'bloqueio' },
  'cod-invalido': { grupo: 'Serviços', nome: 'Código com tamanho incorreto', desc: 'Código com menos ou mais de 8 dígitos.', modo: 'bloqueio' },
  'cod-repetido': { grupo: 'Serviços', nome: 'Código repetido na mesma guia', desc: 'O mesmo código aparece mais de uma vez no mesmo pedido.', modo: 'bloqueio' },
  'qtd-ausente': { grupo: 'Serviços', nome: 'Quantidade não informada', desc: 'Não foi possível ler a quantidade de um serviço.', modo: 'bloqueio' },
  'qtd-invalida': { grupo: 'Serviços', nome: 'Quantidade fora do limite', desc: 'A quantidade é 0 ou maior que o máximo definido em Preferências operacionais.', modo: 'bloqueio' },
  'qtd-unica': { grupo: 'Serviços', nome: 'Quantidade única aplicada a vários serviços', desc: 'Havia uma só quantidade no e-mail e ela foi aplicada a todos os serviços.', modo: 'atencao' },
  'qtd-inferida': { grupo: 'Serviços', nome: 'Quantidade inferida do fim da linha', desc: 'A quantidade foi lida como o número solto no fim da linha do serviço (sem a palavra Quantidade).', modo: 'atencao' },
  'sem-rotulo': { grupo: 'Serviços', nome: 'Códigos lidos sem o rótulo "Serviço"', desc: 'Os códigos vieram de linhas soltas do e-mail.', modo: 'atencao' },
  'solto': { grupo: 'Serviços', nome: 'Número de 8 dígitos que não virou item', desc: 'Pode ser um serviço esquecido ou um telefone.', modo: 'atencao' },
  'serv-repetido-guias': { grupo: 'Serviços', nome: 'Mesmo serviço em outra guia do mesmo beneficiário', desc: 'Dois pedidos do mesmo beneficiário no e-mail pedem o mesmo código. Pode ser duplicidade ou contradição.', modo: 'atencao' },
  'editado': { grupo: 'Serviços', nome: 'Leitura corrigida à mão', desc: 'Dados ou itens foram corrigidos pelo operador em relação à leitura automática.', modo: 'atencao' },
  'falta-med': { grupo: 'Pedido médico', nome: 'Médico não informado', desc: 'O pedido não traz nome nem CRM do médico.', modo: 'bloqueio' },
  'em-inv': { grupo: 'Pedido médico', nome: 'Data de emissão não reconhecida', desc: 'O texto da data não é uma data válida.', modo: 'atencao' },
  'em-fut': { grupo: 'Pedido médico', nome: 'Data de emissão no futuro', desc: 'A emissão é posterior ao recebimento do e-mail.', modo: 'atencao' },
  'em-sd': { grupo: 'Pedido médico', nome: 'Emissão "SEM DATA"', desc: 'A clínica informou SEM DATA. Informativo.', modo: 'atencao', nivel: 'info' },
  'em-aus': { grupo: 'Pedido médico', nome: 'Data de emissão não informada', desc: 'Campo não obrigatório. Informativo.', modo: 'atencao', nivel: 'info' },
  'crm': { grupo: 'Pedido médico', nome: 'CRM não informado', desc: 'Há nome do médico, mas sem número de registro. Informativo.', modo: 'atencao', nivel: 'info' },
  'cid': { grupo: 'Pedido médico', nome: 'CID não informado', desc: 'Campo não obrigatório. Informativo.', modo: 'atencao', nivel: 'info' },
  'remetente': { grupo: 'E-mail', nome: 'Remetente fora do cadastro de clínicas', desc: 'O endereço não está em nenhuma clínica. Permite vincular à clínica certa.', modo: 'atencao' },
  'rem-manual': { grupo: 'E-mail', nome: 'Clínica escolhida manualmente', desc: 'A clínica foi escolhida só para este pedido; o remetente não está no cadastro dela.', modo: 'atencao' },
  'assunto': { grupo: 'E-mail', nome: 'Assunto não cita a clínica', desc: 'O assunto não menciona a clínica do remetente.', modo: 'atencao' },
  'resposta': { grupo: 'E-mail', nome: 'Assunto de resposta ou encaminhamento', desc: 'Assunto com RE:, ENC:, Fwd:. Pode ser correção, cobrança ou pedido novo.', modo: 'atencao' },
  'replyto': { grupo: 'E-mail', nome: 'Resposta vai para outro endereço', desc: 'O campo Responder-para é diferente do remetente.', modo: 'atencao' },
  'cortado': { grupo: 'E-mail', nome: 'Mensagens anteriores ignoradas', desc: 'O histórico da conversa foi ignorado na leitura. Informativo.', modo: 'atencao', nivel: 'info' },
  'colado': { grupo: 'E-mail', nome: 'Texto colado manualmente', desc: 'O remetente foi digitado, sem verificação pelo cabeçalho. Informativo.', modo: 'atencao', nivel: 'info' },
  'dados-comuns': { grupo: 'E-mail', nome: 'Dados comuns aplicados a esta guia', desc: 'Médico, CID, data ou local escritos uma única vez no e-mail foram aplicados às guias que não tinham o dado. Confira.', modo: 'atencao' },
  'preambulo': { grupo: 'E-mail', nome: 'Dados fora dos blocos de beneficiário', desc: 'Há campos antes do primeiro beneficiário. Eles não são herdados por nenhuma guia.', modo: 'atencao' },
  'mesmo-email': { grupo: 'Duplicidade', nome: 'E-mail já registrado em outro atendimento', desc: 'Existe registro anterior deste mesmo e-mail. Informa quem atendeu, sem impedir outro operador de continuar.', modo: 'atencao' },
  'guia-repetida': { grupo: 'Duplicidade', nome: 'Número de guia já registrado', desc: 'O número digitado já consta em outro registro.', modo: 'atencao' },
  'cod-sem-cadastro': { grupo: 'Cadastro de serviços', nome: 'Código sem cadastro na clínica', desc: 'A clínica ainda não tem esse código cadastrado. A descrição do e-mail é usada como referência provisória. Nada é cadastrado automaticamente.', modo: 'atencao' },
  'cod-divergente': { grupo: 'Cadastro de serviços', nome: 'Descrição do e-mail diverge do cadastro', desc: 'O código está cadastrado, mas a descrição do e-mail não corresponde. O código solicitado não é alterado.', modo: 'atencao' },
  'clinica-sem-codigos': { grupo: 'Cadastro de serviços', nome: 'Clínica sem nenhum código cadastrado', desc: 'Informativo: as descrições exibidas vêm do e-mail.', modo: 'atencao', nivel: 'info' },
  'primeiro-atendimento': { grupo: 'Parametrização', nome: 'Provável primeiro atendimento (anexo sem parametrização)', desc: 'Há anexo e ainda não existe parametrização para esta clínica e carteira. O anexo em si não é problema.', modo: 'atencao' },
  'param-diverge': { grupo: 'Parametrização', nome: 'Pedido difere da parametrização', desc: 'Médico ou data do e-mail diferem da parametrização salva. Pode indicar alteração do tratamento.', modo: 'atencao' },
  'param-servico': { grupo: 'Parametrização', nome: 'Serviço fora da parametrização', desc: 'O código pedido não consta nas terapias parametrizadas.', modo: 'atencao' },
  'param-qtd': { grupo: 'Parametrização', nome: 'Quantidade acima da parametrizada', desc: 'A quantidade pedida é maior que a da parametrização.', modo: 'atencao' }
};
const ALERTAS_GRUPOS = unicos(Object.values(ALERTAS).map(a => a.grupo));

const MOTIVOS_PADRAO = [
  { id: 'outra-clinica', nome: 'Beneficiário já realiza atendimento em outra clínica', modelo: 'outra_clinica' },
  { id: 'excluido-carencia', nome: 'Beneficiário excluído ou com carência', modelo: 'excluido_carencia' },
  { id: 'sem-direito-local', nome: 'Sem direito no local ou prestador', modelo: 'sem_direito_local' },
  { id: 'outro', nome: 'Outro motivo (descrever nas observações)', modelo: '' }
];
const PREFS_PADRAO = { conferenciaCega: true, qtdMax: 9, obsParametrizadoAuto: false, acoesMinutos: 10 };

/* Motor de modelos: campos entre chaves → texto/HTML. Falta de valor fica visível. */
function modeloHtmlBruto(k) { return (cfg.modelos[k] || {}).html || ''; }
function renderModelo(k, ctx, opcoes = {}) {
  const faltando = [];
  let html = opcoes.html != null ? opcoes.html : modeloHtmlBruto(k);
  html = html.replace(/\{([A-Z_]+)\}/g, (m, key) => {
    const f = CAMPO[key]; if (!f) return m;
    let v; try { v = ctx.exemplo ? f.ex : f.fn(ctx); } catch (e) { v = ''; }
    if (v == null || v === '') { if (f.opc) return ''; faltando.push(key); return opcoes.marcar ? `<mark class="lacuna">{${key}}</mark>` : m; }
    if (f.html && !ctx.exemplo) { try { return f.html(ctx); } catch (e) { return ''; } }
    return escH(String(v));
  });
  html = html.replace(/<p>(\s|<br>)*<\/p>/g, '');
  return { html, texto: htmlPlano(html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')), faltando: unicos(faltando) };
}
const ctxDe = (g, extra = {}) => ({ S, g, extra });

/* ====================================================================
   Configuração (config.json), parametrizações e registros
   ==================================================================== */
function configPadrao() {
  return {
    operadores: [
      { id: 'alipio', nome: 'Alípio', icone: '🦊', corRgb: '#2563eb', corAlfa: 25 },
      { id: 'rafael', nome: 'Rafael', icone: '🐻', corRgb: '#0891b2', corAlfa: 25 },
      { id: 'thiago', nome: 'Thiago', icone: '🦉', corRgb: '#0d9488', corAlfa: 25 },
      { id: 'apoio', nome: 'Apoio', icone: '🐧', corRgb: '#4f46e5', corAlfa: 25 }
    ],
    clinicas: [],
    modelos: Object.fromEntries(Object.entries(MODELOS_PADRAO).map(([k, m]) => [k, { nome: m.nome, html: padraoHtml(m.texto), uso: (MODELOS_META[k] || {}).custom ? MODELOS_META[k].uso : undefined }])),
    alertas: Object.fromEntries(Object.entries(ALERTAS).map(([k, a]) => [k, { modo: a.modo, dest: 'guia', texto: '' }])),
    motivos: clonar(MOTIVOS_PADRAO), glosas: [],
    preferencias: { ...PREFS_PADRAO }
  };
}
function normOperadores(lista) {
  const ids = new Set();
  return (lista || []).map(o => typeof o === 'string' ? { nome: o } : o).filter(o => o && String(o.nome || '').trim()).map((o, i) => {
    let id = o.id || slug(o.nome); while (ids.has(id)) id += '-' + i; ids.add(id);
    const idx = CORES_ID.findIndex(x => x[0] === o.cor);
    const corRgb = hexValido(o.corRgb) ? o.corRgb.toLowerCase() : CORES_PADRAO_HEX[(idx >= 0 ? idx : i) % CORES_PADRAO_HEX.length];
    const corAlfa = Number.isFinite(Number(o.corAlfa)) && o.corAlfa !== undefined ? Math.min(100, Math.max(5, Math.round(Number(o.corAlfa)))) : 25;
    const r = { id, nome: String(o.nome).trim(), icone: AVATARES.includes(o.icone) ? o.icone : AVATARES[(i * 3 + 2) % AVATARES.length], corRgb, corAlfa };
    if (o.senhaHash && o.senhaSalt) { r.senhaHash = String(o.senhaHash); r.senhaSalt = String(o.senhaSalt); }
    return r;
  });
}
function mesclarConfig(base, c) {
  const r = clonar(base);
  if (!c) return r;
  const ops = normOperadores(c.operadores); if (ops.length) r.operadores = ops;
  if (Array.isArray(c.clinicas)) r.clinicas = c.clinicas;
  r.clinicas.forEach(cl => { cl.id = cl.id || slug(cl.nome); cl.emails = unicos((cl.emails || []).map(e => String(e).toLowerCase().trim()).filter(Boolean)); cl.codigos = cl.codigos || {}; cl.executante = cl.executante || ''; cl.apelidos = cl.apelidos || ''; cl.cidade = cl.cidade || ''; });
  if (c.modelos) for (const k in c.modelos) {
    if (!MODELOS_PADRAO[k]) continue;           // modelos obsoletos (ex.: "Pedido em anexo") não são mais usados
    const s = c.modelos[k] || {};
    const html = s.html ? sanitizar(s.html) : (s.texto != null ? textoParaHtml(s.texto) : null);
    if (html) r.modelos[k].html = html;
    if (MODELOS_META[k].custom) { if (typeof s.nome === 'string' && s.nome.trim()) r.modelos[k].nome = s.nome.trim(); if (typeof s.uso === 'string') r.modelos[k].uso = s.uso; }
  }
  if (c.alertas) for (const k in r.alertas) {
    const s = c.alertas[k]; if (!s) continue;
    if (MODOS[s.modo]) r.alertas[k].modo = s.modo;
    if (s.dest === 'prestador') r.alertas[k].dest = 'prestador';
    if (typeof s.texto === 'string') r.alertas[k].texto = s.texto;
  }
  if (Array.isArray(c.motivos) && c.motivos.length) r.motivos = c.motivos.filter(m => m && m.nome).map(m => ({ id: m.id || slug(m.nome), nome: String(m.nome), modelo: MODELOS_PADRAO[m.modelo] ? m.modelo : '' }));
  if (c.preferencias) {
    const p = c.preferencias;
    if (typeof p.conferenciaCega === 'boolean') r.preferencias.conferenciaCega = p.conferenciaCega;
    if (Number.isInteger(p.qtdMax) && p.qtdMax >= 1 && p.qtdMax <= 99) r.preferencias.qtdMax = p.qtdMax;
    if (typeof p.obsParametrizadoAuto === 'boolean') r.preferencias.obsParametrizadoAuto = p.obsParametrizadoAuto;
    if (Number.isInteger(p.acoesMinutos) && p.acoesMinutos >= 0 && p.acoesMinutos <= 1440) r.preferencias.acoesMinutos = p.acoesMinutos;
  }
  if (Array.isArray(c.glosas)) r.glosas = unicos(c.glosas.map(g => String(g).trim()).filter(Boolean));
  return r;
}
let cfg = configPadrao();
async function carregarConfig() {
  let c = LS.get('config', null);
  if (Pasta.ok) { const p = await Pasta.ler([], 'config.json'); if (p) { c = p; LS.set('config', p); } }
  cfg = mesclarConfig(configPadrao(), c);
}
function configParaSalvar(c) {
  return {
    versao: VERSAO, atualizadoEm: agora(), atualizadoPor: operador(),
    operadores: c.operadores.map(o => ({ id: o.id, nome: o.nome, icone: o.icone, corRgb: o.corRgb, corAlfa: o.corAlfa, ...(o.senhaHash ? { senhaHash: o.senhaHash, senhaSalt: o.senhaSalt } : {}) })),
    clinicas: c.clinicas.map(cl => ({ id: cl.id, nome: cl.nome, cidade: cl.cidade || '', executante: cl.executante || '', emails: cl.emails || [], apelidos: cl.apelidos || '', codigos: cl.codigos || {} })),
    modelos: Object.fromEntries(Object.entries(c.modelos).map(([k, m]) => [k, { nome: m.nome, html: m.html, texto: htmlPlano(m.html), ...(MODELOS_META[k].custom ? { uso: m.uso || '' } : {}) }])),
    alertas: c.alertas, motivos: c.motivos, glosas: c.glosas || [], preferencias: c.preferencias
  };
}
// Antes de gravar, traz do config.json da pasta os operadores que colegas criaram ou protegeram com senha
// depois que esta tela foi aberta, para que salvar nunca desfaça o trabalho de outro operador.
async function mesclarOperadoresDaPasta(novo) {
  if (!Pasta.ok) return;
  const p = await Pasta.ler([], 'config.json'); if (!p || !Array.isArray(p.operadores)) return;
  const arq = normOperadores(p.operadores), eu = operadorObj();
  arq.forEach(o => {
    const i = novo.operadores.findIndex(x => x.id === o.id);
    if (i < 0) { if (!cfgOpsIni.includes(o.id)) novo.operadores.push(o); }                       // criado por outro
    else if (o.senhaHash && !(eu && eu.id === o.id)) novo.operadores[i] = { ...novo.operadores[i], ...o };   // protegido: vale o arquivo
  });
}
async function salvarConfig(novo) {
  const obj = configParaSalvar(novo);
  if (!LS.set('config', obj)) throw new Error('não foi possível gravar neste computador');
  if (Pasta.ok) await Pasta.gravar([], 'config.json', obj);
  cfg = mesclarConfig(configPadrao(), obj);
}
async function alterarConfig(fn) {
  // relê o arquivo da pasta antes de alterar, para não sobrescrever mudanças de outro operador
  await carregarConfig(); const c = clonar(cfg); fn(c); await salvarConfig(c);
}
const modoDe = tipo => (cfg.alertas[tipo] && MODOS[cfg.alertas[tipo].modo]) ? cfg.alertas[tipo].modo : ALERTAS[tipo].modo;

/* Operador atual (contexto e registro; nunca atribuição obrigatória) */
function operadorObj() {
  let id = LS.get('operadorId', '');
  let o = cfg.operadores.find(x => x.id === id);
  if (o && o.senhaHash && Senha.autenticado() !== o.id) o = null;   // com senha: precisa ter confirmado nesta sessão
  if (!o && !id) { const antigo = LS.get('operador', ''); o = cfg.operadores.find(x => x.nome === antigo && !x.senhaHash); if (o) LS.set('operadorId', o.id); }
  return o || null;
}
const operador = () => (operadorObj() || {}).nome || '';
const operadorPorNomeOuId = (nome, id) => cfg.operadores.find(o => o.id === id) || cfg.operadores.find(o => o.nome === nome) || null;
function htmlAvatar(o, lg) { return o ? `<span class="avatar ${lg ? 'lg' : ''}" style="${estiloOp(o)}" title="${esc(o.nome)}">${glifo(o.icone)}</span>` : `<span class="avatar ${lg ? 'lg' : ''}">${ic('user')}</span>`; }
const estiloOp = o => estiloCor(o.corRgb, o.corAlfa);
function htmlOperador(nome, id) {
  const o = operadorPorNomeOuId(nome, id);
  return o ? `<span class="tag id" style="${estiloOp(o)}">${glifo(o.icone)}${esc(o.nome)}</span>` : (nome ? `<span class="tag">${ic('user', 'sm')}${esc(nome)}</span>` : '');
}
const iniciais = nome => (String(nome).trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ý]/.test(w)).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
const corClinica = cl => cl ? corPorTexto(cl.id) : '';
function htmlClinica(cl, nomeFallback) {
  if (!cl) return nomeFallback ? `<span class="tag">${ic('building', 'sm')}${esc(nomeFallback)}</span>` : '';
  return `<span class="tag id idc ${corClinica(cl)}">${ic('building', 'sm')}${esc(cl.nome)}</span>`;
}

/* Parametrizações: referência por clínica + carteira (arquivo próprio na pasta compartilhada) */
const Param = {
  lista: [],
  async carregar() {
    let d = LS.get('param', null);
    if (Pasta.ok) { const p = await Pasta.ler([], 'parametrizacoes.json'); if (p) { d = p; LS.set('param', p); } }
    this.lista = (d && d.itens) || [];
  },
  async gravar() {
    const doc = { versao: 2, atualizadoEm: agora(), itens: this.lista };
    if (!LS.set('param', doc)) throw new Error('não foi possível gravar neste computador');
    if (Pasta.ok) await Pasta.gravar([], 'parametrizacoes.json', doc);
  },
  async salvar(p) {
    await this.carregar();
    const i = this.lista.findIndex(x => x.id === p.id);
    if (i >= 0) this.lista[i] = p; else this.lista.push(p);
    await this.gravar();
  },
  async remover(id) { await this.carregar(); this.lista = this.lista.filter(x => x.id !== id); await this.gravar(); },
  achar(clinicaId, carteira) { return this.lista.find(x => x.clinicaId === clinicaId && x.carteira === carteira) || null; },
  porId(id) { return this.lista.find(x => x.id === id) || null; }
};

/* Registros: um por guia. Sem nome do beneficiário, CID ou médico. */
const Reg = {
  cache: [],
  arquivo(dia, op) { return { partes: ['registros', dia.slice(0, 7)], nome: `${dia}_${slug(op)}.json` }; },
  async salvar(reg) {
    const { partes, nome } = this.arquivo(reg.dia, reg.operador || 'sem-operador');
    const chave = `reg.${reg.dia}.${slug(reg.operador || 'sem-operador')}`;
    let doc = LS.get(chave, null);
    if (Pasta.ok) { const lido = await Pasta.ler(partes, nome); if (lido) doc = lido; }
    if (!doc) doc = { operador: reg.operador, dia: reg.dia, registros: [] };
    const i = doc.registros.findIndex(r => r.id === reg.id);
    if (i >= 0) doc.registros[i] = reg; else doc.registros.push(reg);
    LS.set(chave, doc);
    let erro = null;
    if (Pasta.ok) { try { await Pasta.gravar(partes, nome, doc); } catch (e) { erro = e; } }
    const j = this.cache.findIndex(r => r.id === reg.id);
    if (j >= 0) this.cache[j] = reg; else this.cache.push(reg);
    if (erro) toast('Não consegui gravar na pasta compartilhada. O registro ficou só neste computador.', 'bad');
  },
  async carregar(diasExtra) {
    const dias = HIST_DIAS + (diasExtra || 0);
    const limite = isoDia(addDias(new Date(), -dias));
    const docs = [];
    if (Pasta.ok) {
      const meses = new Set(); for (let d = 0; d <= dias; d += 10) meses.add(isoDia(addDias(new Date(), -d)).slice(0, 7)); meses.add(limite.slice(0, 7));
      for (const m of meses) for (const [n, h] of await Pasta.listar(['registros', m])) {
        if (!n.endsWith('.json') || n.slice(0, 10) < limite) continue;
        try { docs.push(JSON.parse(await (await h.getFile()).text())); } catch (e) { }
      }
    } else {
      for (const k of LS.chaves('reg.')) if (k.slice(4, 14) >= limite) { const d = LS.get(k, null); if (d) docs.push(d); }
    }
    // o mesmo registro pode estar no arquivo de mais de um operador (quando outro continuou o atendimento): vale o mais recente
    const mapa = new Map();
    docs.flatMap(d => d.registros || []).forEach(r => { const a = mapa.get(r.id); if (!a || (r.atualizadoEm || r.registradoEm || '') >= (a.atualizadoEm || a.registradoEm || '')) mapa.set(r.id, r); });
    this.cache = [...mapa.values()];
  },
  doDia(dia) { return this.cache.filter(r => r.dia === dia); },
  /* Histórico completo (sem limite de dias): guia gerada mais recente de cada carteira */
  hist: {}, histPronto: false,
  todos: {},
  mesclarHist(regs) {
    regs.forEach(r => {
      if (r.tipo || !r.id) return;
      this.todos[r.id] = r;
      Object.values(this.hist).forEach(l => { const i = l.findIndex(x => x.id === r.id); if (i >= 0 && (r.status !== 'concluido' || r.carteira !== l[i].carteira)) l.splice(i, 1); });
      if (r.status !== 'concluido' || !r.guia || !r.carteira) return;
      const lista = (this.hist[r.carteira] = this.hist[r.carteira] || []);
      const i = lista.findIndex(x => x.id === r.id); if (i >= 0) lista[i] = r; else lista.push(r);
    });
  },
  async carregarTudo() {
    if (this.histPronto) { await this.carregar(); this.mesclarHist(this.cache); return; }
    const docs = [];
    if (Pasta.ok) for (const [m] of await Pasta.listar(['registros'])) for (const [n, h] of await Pasta.listar(['registros', m])) {
      if (!n.endsWith('.json')) continue;
      try { docs.push(JSON.parse(await (await h.getFile()).text())); } catch (e) { }
    }
    for (const k of LS.chaves('reg.')) { const d = LS.get(k, null); if (d) docs.push(d); }
    this.hist = {}; this.todos = {};
    const mapa = new Map();
    docs.flatMap(d => d.registros || []).forEach(r => { const a = mapa.get(r.id); if (!a || (r.atualizadoEm || '') >= (a.atualizadoEm || '')) mapa.set(r.id, r); });
    this.mesclarHist([...mapa.values()]);
    await this.carregar(); this.mesclarHist(this.cache); this.histPronto = true;
  },
  doPeriodo(ini, fim) { const ok = r => r.dia && r.dia >= ini && r.dia <= fim; const m = new Map(Object.values(this.todos).filter(ok).map(r => [r.id, r])); this.cache.filter(r => !r.tipo && ok(r)).forEach(r => m.set(r.id, r)); return [...m.values()]; },
  doMes(ym) { const m = new Map(Object.values(this.todos).filter(r => r.dia && r.dia.startsWith(ym)).map(r => [r.id, r])); this.cache.filter(r => !r.tipo && r.dia && r.dia.startsWith(ym)).forEach(r => m.set(r.id, r)); return [...m.values()]; },
  async excluir(id) {
    const r = this.cache.find(x => x.id === id) || this.todos[id]; if (!r) return false;
    for (const k of LS.chaves('reg.' + r.dia)) { const d = LS.get(k, null); if (d && (d.registros || []).some(x => x.id === id)) { d.registros = d.registros.filter(x => x.id !== id); LS.set(k, d); } }
    if (Pasta.ok) { const partes = ['registros', r.dia.slice(0, 7)]; for (const [n] of await Pasta.listar(partes)) { if (!n.startsWith(r.dia) || !n.endsWith('.json')) continue; const doc = await Pasta.ler(partes, n); if (doc && (doc.registros || []).some(x => x.id === id)) { doc.registros = doc.registros.filter(x => x.id !== id); await Pasta.gravar(partes, n, doc); } } }
    this.cache = this.cache.filter(x => x.id !== id); delete this.todos[id];
    Object.values(this.hist).forEach(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); });
    return true;
  },
  ultimaGuia(carteira, atendId) {
    const l = (this.hist[carteira] || []).filter(r => r.atendimentoId !== atendId).sort((a, b) => ((a.concluidoEm || '') < (b.concluidoEm || '') ? 1 : -1));
    return l[0] || null;
  }
};

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
function persistir() { if (S) { LS.set('atual', S); lembrarMedico(); } else LS.del('atual'); }
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
function novoEstado(email) {
  let lp = lerPedidos(email.textoPrincipal, email.data);
  if (email.cortado && lp.blocos.every(b => !b.pedido.itens.length && !b.pedido.carteiraBruta)) {
    email.textoPrincipal = email.textoCompleto; email.cortado = false; email.restante = '';
    lp = lerPedidos(email.textoCompleto, email.data);
  }
  relacionarBlocos(lp.blocos);
  const achou = acharClinica(email), sug = achou ? null : sugerirClinica(email);
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
    else add('cart', p.carteiraBruta ? `Carteira fora do padrão: "${p.carteiraBruta}". Localize o beneficiário pelo nome no sistema e informe a carteira usada.` : 'Carteira não informada. Localize o beneficiário pelo nome no sistema e informe a carteira usada.', { acaoCarteira: true });
  } else if (p.carteira !== g.carteiraUsada) {
    add('cart-dif', `Carteira usada (${g.carteiraUsada}) diferente da informada no e-mail (${p.carteiraBruta || 'não informada'}). Confirme que nome e carteira são do mesmo beneficiário.`);
  }
  /* serviços */
  if (!p.itens.length) add('falta-serv', 'Nenhum código de serviço de 8 dígitos foi encontrado.', { clinica: 'Código do serviço (8 dígitos) não informado.' });
  unicos(p.invalidos).forEach(c => add('cod-invalido', `Código "${c}" tem ${c.length} dígitos (o correto são 8).`, { sub: c, clinica: `O código "${c}" está incorreto ou incompleto: os códigos de serviço têm 8 dígitos.` }));
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
  if (/^[TS]\d{8}$/.test(g.numero)) {
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
  if (!p.medico.nome && !p.medico.crm && prm.medico) { p.medico = lerMedico(prm.medico); feitos.push('médico'); }
  if (p.emissao.estado === 'ausente' && prm.emissao) { p.emissao = lerEmissao(diaBR(prm.emissao), S.email.data); feitos.push('data do pedido'); }
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
function montarRegistro(g, status, extra = {}) {
  const p = g.pedido, cl = clinicaDe(S), A = avaliar(g), op = operadorObj();
  const neg = negadosDe(g).map(x => x.it.codigo);
  return {
    id: g.id, atendimentoId: S.atendId, idxGuia: g.idx, totalGuias: S.guias.length, versao: VERSAO,
    messageId: S.email.messageId, recebidoEm: S.email.data, assunto: S.email.assunto, remetente: S.email.remetente.email,
    clinica: cl ? cl.nome : null, clinicaId: cl ? cl.id : null, operador: op ? op.nome : '', operadorId: op ? op.id : null, abertoPor: g.abertoPor || (op ? op.nome : ''), dia: S.dia,
    abertoEm: g.abertoEm, vista: g.vista, pacienteIni: iniciais(g.pedido.beneficiario || ''), paciente: status === 'em_andamento' ? (g.pedido.beneficiario || '') : null, atualizadoEm: agora(), concluidoEm: status === 'concluido' ? agora() : null, status, etapa: g.etapa,
    carteira: g.carteiraUsada || p.carteira || null,
    itens: p.itens.map(i => ({ c: i.codigo, q: i.qtd, d: i.desc, dc: descCadastro(cl, i.codigo) ?? null, aut: status === 'concluido' && !g.semGuia ? !neg.includes(i.codigo) : null })),
    guia: g.semGuia ? null : (g.numero || null), resultado: status === 'concluido' ? resultadoParaRegistro(g) : null,
    parametrizado: g.param ? { id: g.param.id, origem: g.param.origem } : null,
    alertas: A.filter(a => a.modo !== 'bloqueio').map(a => ({ k: a.tipo, m: a.modo, t: a.texto, c: !!(g.conf && g.conf[a.key]) })),
    bloqueios: A.filter(a => a.modo === 'bloqueio').map(a => a.texto),
    conferencia: { tentativas: g.cega.tentativas, divergencias: g.cega.historico },
    editadoAMao: g.itensEditados, obsIncluidas: g.obsInc.length + g.respInc.length, duracaoSeg: Math.round((Date.now() - new Date(g.abertoEm)) / 1000), ...extra
  };
}
async function gravarGuia(g, status, extra) { g.status = status; await Reg.salvar(montarRegistro(g, status, extra)); }
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

/* ====================================================================
   Interface: componentes comuns, topo, abas, entrada e visão do e-mail
   ==================================================================== */
const TAG_STATUS = {
  em_andamento: ['info', 'clip'], concluido: ['ok', 'check'], cancelado: ['bad', 'ban'], aguardando_clinica: ['warn', 'mail'], descartado: ['', 'x'], devolvido: ['', 'x']
};
const tagStatus = s => { const [c, i] = TAG_STATUS[s] || ['', 'info']; return `<span class="tag ${c}">${ic(i, 'sm')}${esc(STATUS[s] || s)}</span>`; };
const TAG_RES = { autorizada: ['ok', 'check'], parcial: ['warn', 'halfcircle'], nao: ['bad', 'x'], sem_guia: ['obs', 'mail'] };
const tagResultado = s => s ? `<span class="tag ${TAG_RES[s][0]}">${ic(TAG_RES[s][1], 'sm')}${SIT_ROTULO[s]}</span>` : '';
const TAG_MODO = { bloqueio: ['bad', 'ban', 'Bloqueio'], obs: ['obs', 'message', 'Aviso com observação'], atencao: ['warn', 'alert', 'Atenção'], info: ['', 'info', 'Informativo'], desativado: ['', 'x', 'Desativado'] };
const tagModo = (modo, nivel) => { const k = modo === 'atencao' && nivel === 'info' ? 'info' : modo; const [c, i, t] = TAG_MODO[k]; return `<span class="tag ${c}">${ic(i, 'sm')}${t}</span>`; };
const tagParam = p => p ? `<span class="tag ac">${ic('layers', 'sm')}Parametrizado${p.origem === 'criada' ? ' (criada)' : p.origem === 'aplicada' ? ' (aplicada)' : ''}</span>` : '';
const tagItem = est => ({
  cadastrado: '<span class="tag ok">' + ic('check', 'sm') + 'Cadastrado</span>',
  'sem-cadastro': '<span class="tag obs">' + ic('info', 'sm') + 'Sem cadastro</span>',
  divergente: '<span class="tag warn">' + ic('alert', 'sm') + 'Descrição diverge</span>',
  'sem-clinica': '<span class="tag">' + ic('help', 'sm') + 'Clínica não identificada</span>'
}[est]);
const nomeGuia = g => `${g.pedido.beneficiario || 'Beneficiário não informado'}`;

/* ---------- Topo e abas ---------- */
/* ---------- Progresso dos operadores (topo compacto) ---------- */
const ROT_ETAPA = { 33: 'lendo o pedido', 66: 'gerando a guia', 100: 'anexando e respondendo' };
function listaProgresso() {
  const lim = cfg.preferencias.acoesMinutos || 60, idade = r => (Date.now() - new Date(r.atualizadoEm || r.abertoEm)) / 60000;
  const mapa = new Map();
  Reg.doDia(isoDia(new Date())).filter(r => !r.tipo && r.status === 'em_andamento' && idade(r) <= lim).forEach(r => mapa.set(r.id, r));
  if (S) S.guias.filter(g => !guiaTerminal(g)).forEach(g => mapa.set(g.id, montarRegistro(g, 'em_andamento')));
  const porOp = new Map();
  [...mapa.values()].sort((a, b) => ((a.atualizadoEm || '') < (b.atualizadoEm || '') ? 1 : -1)).forEach(r => { const k = r.operadorId || r.operador || '?'; if (!porOp.has(k)) porOp.set(k, r); });
  return [...porOp.values()].map(r => {
    const o = cfg.operadores.find(x => x.id === r.operadorId) || cfg.operadores.find(x => x.nome === r.operador) || null;
    const v = r.vista || r.etapa || 2, p = v <= 2 ? 33 : v >= 4 ? 100 : 66;
    const tip = `${r.operador || (o && o.nome) || 'Operador'}: ${r.paciente || r.pacienteIni || 'paciente'} × ${r.clinica || r.remetente || 'clínica não identificada'}${(r.totalGuias || 1) > 1 ? ` (guia ${(r.idxGuia || 0) + 1} de ${r.totalGuias})` : ''} · ${ROT_ETAPA[p]} (${p}%)`;
    return { o, p, tip };
  });
}
function pintarProgresso() {
  const el = $('#topoProg'); if (!el) return;
  const L = listaProgresso();
  el.innerHTML = L.length ? L.map(x => `<span class="prog" role="img" style="--p:${x.p};${x.o ? estiloOp(x.o) : ''}" title="${esc(x.tip)}" aria-label="${esc(x.tip)}"><span class="pe">${x.o ? glifo(x.o.icone) : ic('user', 'sm')}</span></span>`).join('')
    : `<span class="prog" role="img" style="--p:0" title="Nenhum atendimento em andamento" aria-label="Nenhum atendimento em andamento"><span class="pe">${ic('user', 'sm')}</span></span>`;
}
setInterval(async () => { if (document.hidden || !LS.get('topoMini', false)) return; try { await Reg.carregar(); pintarProgresso(); } catch (e) { } }, 20000);
function renderTopo() {
  const op = operadorObj(), hoje = new Date();
  const dataTxt = aba === 'painel' ? (painelModo === 'mes' ? 'Mês: ' + painelMes.split('-').reverse().join('/') : painelModo === 'semana' ? 'Semana: ' + rotuloSemana(painelSemana) : 'Dia: ' + diaBR(painelDia)) : fmtData(hoje);
  const pasta = !Pasta.suportado ? { c: 'alerta', i: 'alert', t: 'Use o Chrome ou Edge', d: 'Este navegador não permite acessar a pasta compartilhada.' }
    : Pasta.ok ? { c: 'ok', i: 'folder', t: 'Pasta: ' + Pasta.handle.name, d: 'Pasta compartilhada conectada. Configurações e registros ficam nela.' }
      : Pasta.handle ? { c: 'alerta', i: 'folder', t: 'Reautorizar pasta', d: 'A pasta lembrada precisa de autorização (um clique por dia).' }
        : { c: 'alerta', i: 'folderx', t: 'Pasta não conectada', d: 'Sem a pasta, os registros ficam só neste computador e não há visão conjunta entre operadores.' };
  const escuro = Tema.efetivo() === 'dark';
  const mini = !!LS.get('topoMini', false), cab = document.querySelector('header.topo');
  document.body.classList.toggle('topo-mini', mini);
  cab.style.cssText = mini && op ? estiloOp(op) : '';
  const nivel = !Pasta.suportado ? 'bad' : Pasta.ok ? 'ok' : Pasta.handle ? 'warn' : 'bad';
  if (mini) pintarProgresso();
  if (mini) {
    $('#topoAcoes').innerHTML = `
    <label class="chip chip-op mini-op" title="Operador">${htmlAvatar(op)}<select id="operador" aria-label="Operador"><option value="">Escolher operador</option>${cfg.operadores.map(o => `<option value="${esc(o.id)}" ${op && op.id === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
    <button class="chip mini-btn" data-act="pasta" title="${esc(pasta.t + ': ' + pasta.d)}" aria-label="${esc(pasta.t)}"><span class="luz ${nivel}"></span></button>
    <button class="chip mini-btn" data-act="topoMini" title="Mostrar menu e topo completo" aria-label="Mostrar menu e topo completo">${ic('chevdown', 'sm')}</button>`;
    $('#abas').innerHTML = '';
    document.title = 'Conferidor de Guias · Promédica';
    return;
  }
  $('#topoAcoes').innerHTML = `
    <span class="chip ctx" title="${aba === 'painel' ? 'Dia selecionado no Painel' : 'Data de hoje'}">${ic('calendar', 'sm')}${dataTxt}</span>
    <label class="chip chip-op" style="${op ? estiloOp(op) : ''}" title="Operador (identificação de contexto e registro)">${htmlAvatar(op)}<select id="operador" aria-label="Operador">
      <option value="">Escolher operador</option>${cfg.operadores.map(o => `<option value="${esc(o.id)}" ${op && op.id === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
    <button class="chip pasta ${pasta.c}" data-act="pasta" title="${esc(pasta.d)}" aria-label="${esc(pasta.t)}"><span class="luz ${nivel}"></span><span class="txt-fino">${esc(pasta.t)}</span></button>
    <button class="chip tema" data-act="alternarTema" title="${escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}" aria-label="Alternar tema">${ic(escuro ? 'sun' : 'moon', 'sm')}<span class="txt-fino">${escuro ? 'Claro' : 'Escuro'}</span></button>
    <button class="chip mini-btn" data-act="topoMini" title="Ocultar menu e topo (modo compacto)" aria-label="Ocultar menu e topo">${ic('chevup', 'sm')}</button>`;
  $('#abas').innerHTML = [['atend', 'filecheck', 'Atendimento'], ['quadro', 'layers', 'Ações'], ['painel', 'chart', 'Painel do dia'], ['config', 'settings', 'Configurações']]
    .map(([k, i, t]) => `<button data-act="aba" data-aba="${k}" class="${aba === k ? 'ativo' : ''}" title="${t}" ${aba === k ? 'aria-current="page"' : ''}>${ic(i)}<span class="txt-fino">${t}</span></button>`).join('');
  $('#verRodape').textContent = 'v' + VERSAO;
  document.title = 'Conferidor de Guias · Promédica';
}

/* ---------- Editor de texto rico ---------- */
const CORES_TEXTO = [['#b91c1c', 'Vermelho'], ['#c2410c', 'Laranja'], ['#15803d', 'Verde'], ['#1d4f91', 'Azul'], ['#6d28d9', 'Roxo'], ['#475569', 'Cinza']];
function htmlEditor({ id, valor, rico = true, minAltura = 200 }) {
  const barra = rico ? `<div class="ed-barra" role="toolbar" aria-label="Formatação do texto">
    <button type="button" class="btn sm line" data-cmd="bold" title="Negrito (Ctrl+B)" aria-label="Negrito">${ic('bold', 'sm')}<span class="sr">Negrito</span></button>
    <button type="button" class="btn sm line" data-cmd="italic" title="Itálico (Ctrl+I)" aria-label="Itálico">${ic('italic', 'sm')}<span class="sr">Itálico</span></button>
    <span class="sep"></span>
    <button type="button" class="btn sm line" data-cmd="insertUnorderedList" title="Lista com marcadores" aria-label="Lista com marcadores">${ic('list', 'sm')}Lista</button>
    <button type="button" class="btn sm line" data-cmd="insertOrderedList" title="Lista numerada" aria-label="Lista numerada">${ic('listnum', 'sm')}Numerada</button>
    <span class="sep"></span>
    <span class="ed-cores" title="Cor do texto">${ic('textcolor', 'sm')}${CORES_TEXTO.map(([c, n]) => `<button type="button" class="ed-cor" data-cor="${c}" style="background:${c}" title="Texto ${n}" aria-label="Cor ${n}"></button>`).join('')}</span>
    <span class="sep"></span>
    <button type="button" class="btn sm ghost" data-cmd="removeFormat" title="Limpar formatação da seleção">${ic('undo', 'sm')}Limpar formatação</button>
  </div>` : '';
  return `${barra}<div class="ed ${rico ? '' : 'solo'}" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" style="min-height:${minAltura}px" data-rico="${rico ? 1 : 0}">${valor}</div>`;
}
function serializarEditor(el, comoModelo) {
  const c = el.cloneNode(true);
  c.querySelectorAll('mark.lacuna').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
  c.querySelectorAll('.tok').forEach(t => t.replaceWith(document.createTextNode('{' + t.dataset.k + '}')));
  return sanitizar(c.innerHTML);
}
/* Converte {CAMPO} em "etiquetas" legíveis no editor de modelos */
function htmlComEtiquetas(html) {
  return html.replace(/\{([A-Z_]+)\}/g, (m, k) => CAMPO[k] ? `<span class="tok" contenteditable="false" data-k="${k}" title="${esc(CAMPO[k].desc)}">${esc(CAMPO[k].nome)}</span>` : `<span class="tok desc" contenteditable="false" data-k="${k}" title="Campo desconhecido">${esc(k)}</span>`);
}
let selSalva = null;
document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest('.ed')) selSalva = s.getRangeAt(0).cloneRange(); });
function inserirNoEditor(el, html) {
  el.focus();
  if (selSalva && el.contains(selSalva.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(selSalva); }
  else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.execCommand('insertHTML', false, html);
}
document.addEventListener('mousedown', e => { if (e.target.closest('.ed-barra .btn, .ed-cor')) e.preventDefault(); });
document.addEventListener('paste', e => {
  const ed = e.target.closest && e.target.closest('.ed'); if (!ed) return;
  e.preventDefault();
  const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain');
  if (ed.dataset.rico === '1' && h) document.execCommand('insertHTML', false, sanitizar(h));
  else document.execCommand('insertText', false, t);
});

/* ---------- Alertas (painel abaixo do conteúdo) ---------- */
function htmlUmAlerta(a, g) {
  let extra = '';
  if (a.vincular) extra += `<select id="selClinica" aria-label="Clínica do remetente"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(cl => `<option value="${cl.id}" ${cl.id === S.clinicaSugerida ? 'selected' : ''}>${esc(cl.nome)}</option>`).join('')}</select><button class="btn sm" data-act="vincularClinica">${ic('check', 'sm')}Vincular e salvar e-mail no cadastro</button><button class="btn sm line" data-act="clinicaSoAgora">Usar só neste pedido</button>`;
  if (a.acaoCarteira) extra += `<button class="btn sm" data-act="respSemGuia" data-modelo="carteira_nao_localizada">${ic('mail', 'sm')}Não localizei: responder</button><button class="btn sm" data-act="respSemGuia" data-modelo="nome_carteira">${ic('mail', 'sm')}Nome e carteira não conferem: responder</button>`;
  if (a.cadastrarCodigo) extra += `<button class="btn sm" data-act="cadastrarCodigo" data-codigo="${a.cadastrarCodigo}">${ic('plus', 'sm')}Cadastrar código</button>`;
  const conferido = pedeConferi(a) && g.conf && g.conf[a.key];
  if (pedeConferi(a)) extra += `<label class="chk conferi"><input type="checkbox" data-conf="${esc(a.key)}" ${conferido ? 'checked' : ''}>Conferi</label>`;
  if (a.modo === 'obs') extra += `<span class="muted" style="font-size:var(--fs-xs)">Texto em “Incluir observação” (observações adicionais da resposta).</span>`;
  const ico = a.modo === 'bloqueio' ? 'ban' : a.modo === 'obs' ? 'message' : a.nivel === 'info' ? 'info' : 'alert';
  return `<div class="al ${a.modo === 'atencao' && a.nivel === 'info' ? 'info' : a.modo} ${conferido ? 'conferido' : ''}"><span>${ic(conferido ? 'check' : ico, 'sm')}</span><div class="tx"><b class="al-t">${a.modo === 'bloqueio' ? 'Bloqueio:' : a.modo === 'obs' ? 'Aviso com observação:' : a.nivel === 'info' ? 'Informativo:' : 'Atenção:'}</b> ${esc(a.texto)}</div>${extra ? `<div class="acoes-al">${extra}</div>` : ''}</div>`;
}
function htmlAlertas(g, st) {
  const ordem = a => ({ bloqueio: 0, obs: 1, atencao: 2 }[a.modo]);
  const principais = st.A.filter(a => !(a.modo === 'atencao' && a.nivel === 'info')).sort((a, b) => ordem(a) - ordem(b));
  const infos = st.A.filter(a => a.modo === 'atencao' && a.nivel === 'info');
  const l1 = principais.map(a => htmlUmAlerta(a, g)).join('');
  const l2 = infos.length ? `<details class="al-infos"><summary>${infos.length} informativo(s)</summary><div class="alertas">${infos.map(a => htmlUmAlerta(a, g)).join('')}</div></details>` : '';
  return (l1 || l2) ? l1 + l2 : `<div class="al info"><span>${ic('check', 'sm')}</span><div class="tx">Nenhum alerta para esta guia.</div></div>`;
}
function htmlPainelAlertas(g, st) {
  const tot = st.A.filter(pedeConferi).length, pend = atencaoPendente(g, st).length;
  return `<section class="card painel-al compacto ${st.bloqueios.length ? 'tem-bloqueio' : ''}" aria-label="Alertas e ocorrências">
    <div class="al-h">${ic(st.bloqueios.length ? 'ban' : 'bell')}<h2>Alertas e ocorrências</h2>
      ${st.bloqueios.length ? `<span class="tag bad">${ic('ban', 'sm')}${st.bloqueios.length} bloqueio(s)</span>` : '<span class="tag ok">' + ic('check', 'sm') + 'Sem bloqueios</span>'}
      ${st.obs.length ? `<span class="tag obs">${ic('message', 'sm')}${st.obs.length} com observação</span>` : ''}
      ${tot ? (pend ? `<span class="tag warn">${ic('alert', 'sm')}${pend} a conferir</span>` : `<span class="tag ok">${ic('check', 'sm')}Conferido</span>`) : ''}</div>
    <div class="al-corpo"><div class="alertas" id="alertas">${htmlAlertas(g, st)}</div></div></section>`;
}

/* ---------- Barra de guias e etapas ---------- */
function htmlBarraGuias() {
  if (S.guias.length < 2) return '';
  return `<div class="guias-bar" role="tablist" aria-label="Guias deste e-mail">${S.guias.map((g, i) => {
    const st = guiaTerminal(g) ? null : situacaoGuia(g);
    return `<button class="guia-tab ${i === S.ativa && S.vista > 1 ? 'ativa' : ''}" role="tab" aria-selected="${i === S.ativa}" data-act="selGuia" data-i="${i}">
      <span class="sq lg idc idc-${i % 10}">${i + 1}</span><span style="min-width:0"><span class="t1" style="display:block">${esc(nomeGuia(g))}</span>
      <span class="t2">${g.pedido.itens.length} item(ns) · ${g.status === 'concluido' ? tagResultado(g.resultado.situacao) : tagStatus(g.status)}${st && st.bloqueios.length ? ` <span class="tag bad">${ic('ban', 'sm')}${st.bloqueios.length}</span>` : ''}</span></span></button>`;
  }).join('')}</div>`;
}
function htmlPassos(g) {
  const st = situacaoGuia(g), v = S.vista, fin = g.status === 'concluido';
  const cegaPend = cegaExigida() && g.cega.iniciada && g.cega.resultado && !g.cega.resultado.ok;
  const def = [
    { n: 1, t: 'E-mail', e: v === 1 ? 'atual' : 'feito', s: v === 1 ? 'Você está aqui' : 'Pedido recebido', ok: true },
    { n: 2, t: 'Pedido e alertas', e: v === 2 ? 'atual' : st.bloqueios.length ? 'atencao' : (g.etapa > 2 || fin ? 'feito' : 'futuro'), s: st.bloqueios.length ? `${st.bloqueios.length} bloqueio(s)` : v === 2 ? 'Você está aqui' : g.etapa > 2 ? 'Concluída' : 'A fazer', ok: true },
    { n: 3, t: 'Guia e conferência', e: v === 3 ? 'atual' : cegaPend ? 'atencao' : ((g.cega.ok || !cegaExigida()) && g.etapa > 3) || fin ? 'feito' : 'futuro', s: !st.pode ? 'Resolva os bloqueios' : cegaPend ? 'Conferência divergente' : v === 3 ? 'Você está aqui' : g.cega.ok ? 'Conferida' : 'A fazer', ok: st.pode },
    { n: 4, t: usaConsolidada() ? (ehUltima(g) ? 'Finalizar e-mail' : 'Resultado e observação') : 'Finalizar', e: v === 4 ? 'atual' : fin ? 'feito' : 'futuro', s: fin ? 'Concluída' : v === 4 ? 'Você está aqui' : !podeFinal(g, st) ? 'Falta conferir' : 'A fazer', ok: podeFinal(g, st) || fin }
  ];
  return `<nav class="passos" aria-label="Etapas do atendimento">${def.map(d => `<button class="passo ${d.e}" data-act="irVista" data-v="${d.n}" ${d.ok ? '' : 'disabled'} ${d.e === 'atual' ? 'aria-current="step"' : ''} title="${esc(d.t + ' — ' + d.s)}">
    <span class="bola">${d.e === 'feito' ? ic('check', 'sm') : d.e === 'atencao' ? ic('alert', 'sm') : d.n}</span>
    <span class="tx"><small>Etapa ${d.n} · ${esc(d.s)}</small><b>${d.t}</b></span></button>`).join('')}</nav>`;
}

/* ---------- Tela principal do atendimento ---------- */
function render() {
  renderTopo();
  if (typeof pintarOfertaWebmail === 'function') pintarOfertaWebmail();
  const app = $('#app');
  if (aba === 'painel') return renderPainel(app);
  if (aba === 'quadro') return renderQuadro(app);
  if (aba === 'config') return renderConfig(app);
  if (!S) return renderEntrada(app);
  const g = guiaAtiva();
  const alvoId = 'etapa';
  app.innerHTML = htmlBarraGuias() + (S.vista === 1 ? '' : htmlPassos(g)) + `<div id="${alvoId}"></div>`;
  const alvo = $('#' + alvoId);
  if (S.vista === 1) renderVisao(alvo); else if (g.status === 'concluido' && S.vista === 4) renderConcluida(alvo, g);
  else if (S.vista === 2) renderPedido(alvo, g); else if (S.vista === 3) renderGuia(alvo, g); else renderFinal(alvo, g);
}
function renderEntrada(app) {
  const semOp = !operador();
  app.innerHTML = `
  ${semOp ? `<div class="aviso">${ic('user')}<div>Escolha seu nome em <b>Operador</b>, no topo, antes de começar.</div></div>` : ''}
  ${!Pasta.ok ? `<div class="aviso">${ic('folderx')}<div>${Pasta.handle ? 'A pasta compartilhada precisa ser reautorizada (um clique por dia).' : 'A pasta compartilhada não está conectada: os registros ficam só neste computador e não há visão conjunta entre operadores.'}</div><span class="acoes"><button class="btn sm" data-act="pasta">${ic('folder', 'sm')}${Pasta.handle ? 'Reautorizar pasta' : 'Conectar pasta'}</button></span></div>` : ''}
  ${ultimoConcluido ? `<div class="ultimo">${ic('check')}<div>Último registrado: <b>${esc(ultimoConcluido.texto)}</b> às ${fmtHora(ultimoConcluido.em)}.</div></div>` : ''}
  <div class="vazio" id="zona">
    <div class="ico">${ic('upload', 'xl')}</div>
    <h2>Nenhum pedido carregado</h2>
    <p>Arraste aqui o .eml do e-mail que você vai atender ou escolha o arquivo. Um e-mail pode ter de 1 a ${MAX_BENEFICIARIOS} beneficiários; cada um gera uma guia independente. No SmarterMail: abra o e-mail › menu ⋮ › baixar/salvar como .eml.</p>
    <button class="btn pri" data-act="escolherEml">${ic('upload')}Fazer upload do e-mail (.eml)</button>
  </div>
  <div class="card">
    <details>
      <summary>Sem o arquivo? Colar o texto do e-mail</summary>
      <div class="form-grid">
        <div><label class="lbl" for="coladoDe">E-mail do remetente</label><input type="text" id="coladoDe" placeholder="contato@clinica.com.br"></div>
        <div style="grid-column:1/-1"><label class="lbl" for="coladoTxt">Corpo do e-mail</label><textarea id="coladoTxt" rows="9"></textarea></div>
      </div>
      <div class="acoes"><button class="btn" data-act="usarColado">${ic('filecheck')}Ler texto colado</button></div>
    </details>
  </div>`;
  const z = $('#zona');
  z.addEventListener('dragover', ev => { ev.preventDefault(); z.classList.add('sobre'); });
  z.addEventListener('dragleave', () => z.classList.remove('sobre'));
  z.addEventListener('drop', ev => { ev.preventDefault(); z.classList.remove('sobre'); const f = ev.dataTransfer.files[0]; if (f) abrirArquivo(f); });
}
function realceEmail() {
  const e = S.email, usados = new Set(S.guias.flatMap(g => g.pedido.itens.map(i => i.codigo)));
  let html = esc(e.textoPrincipal).replace(/(?<!\d)(\d{8})(?!\d)/g, m => `<mark class="${usados.has(m) ? 'm-ok' : 'm-warn'}">${m}</mark>`);
  S.guias.forEach(g => { if (g.pedido.carteiraBruta) { const c = esc(g.pedido.carteiraBruta); const i = html.indexOf(c); if (i >= 0) html = html.slice(0, i) + `<mark class="m-cart">${c}</mark>` + html.slice(i + c.length); } });
  if (e.cortado && e.restante) html += `\n\n<span class="hist">${esc(e.restante)}</span>`;
  return html;
}
function htmlUltimaGuia() {
  const cl = clinicaDe(S), linhas = [], vistos = new Set();
  S.guias.forEach(g => {
    const cart = g.carteiraUsada || g.pedido.carteira; if (!cart || vistos.has(cart)) return; vistos.add(cart);
    const r = Reg.ultimaGuia(cart, S.atendId); if (!r) return;
    const outra = r.clinicaId && cl && r.clinicaId !== cl.id || (!cl && r.clinica);
    linhas.push(`<div class="ult-linha">${S.guias.length > 1 ? `<span class="muted">${esc(nomeGuia(g))}:</span> ` : ''}<b class="num">${esc(r.guia)}</b> <span class="muted">· ${fmtData(r.concluidoEm)}</span>${outra ? ` <span class="tag obs">${ic('building', 'sm')}${esc(r.clinica)}</span>` : ''}</div>`);
  });
  return linhas.length ? `<div class="ult-guia">${ic('clip')}<div><div class="eyebrow">Última guia gerada para ${vistos.size > 1 ? 'estes pacientes' : 'este paciente'}</div>${linhas.join('')}</div></div>` : '';
}
function htmlEmailCard() {
  const e = S.email, cl = clinicaDe(S);
  return `${htmlUltimaGuia()}<div class="card"><div class="card-h"><h2>E-mail recebido</h2></div>
    <dl class="email-meta">
      <dt>De</dt><dd>${esc(e.remetente.nome)} <span class="num">&lt;${esc(e.remetente.email)}&gt;</span> ${cl ? htmlClinica(cl) : `<span class="tag obs">${ic('info', 'sm')}Remetente não cadastrado</span>`}</dd>
      <dt>Recebido</dt><dd>${fmtDH(e.data)}</dd>
      <dt>Assunto</dt><dd>${esc(e.assunto)}</dd>
      ${e.anexos.length ? `<dt>Anexos</dt><dd><span class="tag info">${ic('clip', 'sm')}${e.anexos.length} anexo(s)</span> ${esc(e.anexos.join(', '))}</dd>` : ''}
    </dl>
    <pre class="original">${realceEmail()}</pre>
    <p class="dica" style="margin-top:8px"><mark class="m-ok">verde</mark> código lido como item · <mark class="m-warn">amarelo</mark> 8 dígitos não usados · <mark class="m-cart">azul</mark> carteira</p></div>`;
}
function renderVisao(alvo) {
  const todas = S.guias.every(guiaTerminal), multi = S.guias.length > 1;
  alvo.innerHTML = `<div class="stack">
  ${htmlEmailCard()}
  <div class="card"><div class="card-h"><h2>${multi ? `Guias deste e-mail (${S.guias.length})` : 'Solicitação deste e-mail'}</h2><span class="esp"></span>${multi ? `<span class="tag ${S.guias.filter(g => g.pedido && chaveBenef(g.pedido)).length ? 'ac' : ''}">${ic('user', 'sm')}${unicos(S.guias.map(g => g.chave)).length} beneficiário(s) diferente(s)</span>` : ''}</div>
    
    <div class="tabela-scroll"><table class="t"><thead><tr><th>Guia</th><th>Beneficiário</th><th>Carteira</th><th>Serviços (código × qtd.)</th><th>Estado</th><th>Alertas</th><th></th></tr></thead><tbody>
    ${S.guias.map((g, i) => { const st = situacaoGuia(g); return `<tr><td class="c"><span class="sq idc idc-${i % 10}">${i + 1}</span></td><td class="pri">${esc(nomeGuia(g))}</td><td class="num">${esc(g.carteiraUsada || g.pedido.carteiraBruta || '—')}</td>
      <td class="num">${g.pedido.itens.map(it => `${it.codigo} × ${it.qtd ?? '?'}`).join('<br>') || '—'}</td>
      <td>${g.status === 'concluido' ? tagResultado(g.resultado.situacao) + (g.numero && !g.semGuia ? ' <span class="num">' + esc(g.numero) + '</span>' : '') : tagStatus(g.status)} ${tagParam(g.param)}</td>
      <td>${st.bloqueios.length ? `<span class="tag bad">${ic('ban', 'sm')}${st.bloqueios.length} bloqueio(s)</span>` : ''} ${st.obs.length + atencaoPendente(g, st).length ? `<span class="tag warn">${ic('alert', 'sm')}${st.obs.length + atencaoPendente(g, st).length}</span>` : ''}</td>
      <td class="c"><button class="btn sm pri" data-act="selGuia" data-i="${i}">${g.status === 'concluido' ? 'Ver guia' : 'Abrir guia'}${ic('right', 'sm')}</button></td></tr>`; }).join('')}
    </tbody></table></div>
    ${todas ? `<div class="ultimo" style="margin-top:12px">${ic('check')}<div>Todas as guias deste e-mail foram processadas.</div></div>` : ''}
    <div class="acoes">
      ${!multi ? `<button class="btn pri" data-act="selGuia" data-i="0">Seguir para o pedido${ic('right')}</button>` : ''}
      ${multi ? `<button class="btn ${todas ? 'pri' : 'line'}" data-act="respostaEmail">${ic('mail')}Resposta do e-mail (todas as guias)</button>` : ''}
      <span class="esp"></span>
      ${todas ? `<button class="btn pri" data-act="encerrar">${ic('check')}Encerrar atendimento</button>` : ''}
      <button class="btn dng" data-act="descartar">${ic('trash')}Descartar e-mail</button>
    </div></div></div>`;
}

/* ====================================================================
   Etapa 2: pedido e alertas
   ==================================================================== */
function htmlTabelaItens(g, { copiar = false } = {}) {
  const cl = clinicaDe(S);
  return `<div class="tabela-scroll"><table class="t"><thead><tr><th>#</th><th>Código</th><th>Qtd.</th><th>Descrição ${cl ? '(cadastro da clínica)' : '(referência)'}</th><th>Descrição do e-mail</th><th>Situação</th></tr></thead><tbody>
  ${g.pedido.itens.map((it, i) => {
    const ref = descRefItem(g, it), est = estadoItem(g, it);
    const cpCod = copiar ? `<button class="btn cp ${g.copiados['c:' + it.codigo] === it.codigo ? 'copiado' : ''}" data-act="copiarItem" data-tipo="c" data-codigo="${it.codigo}" aria-label="Copiar código ${it.codigo}">${g.copiados['c:' + it.codigo] === it.codigo ? ic('check', 'sm') : ic('copy', 'sm')}</button>` : '';
    const cpQtd = copiar ? `<button class="btn cp ${g.copiados['q:' + it.codigo] === String(it.qtd) ? 'copiado' : ''}" data-act="copiarItem" data-tipo="q" data-codigo="${it.codigo}" aria-label="Copiar quantidade de ${it.codigo}">${g.copiados['q:' + it.codigo] === String(it.qtd) ? ic('check', 'sm') : ic('copy', 'sm')}</button>` : '';
    return `<tr><td class="c">${i + 1}</td>
      <td><div class="t-celula" style="justify-content:flex-start"><span class="cod">${it.codigo}</span>${cpCod}</div></td>
      <td><div class="t-celula" style="justify-content:flex-start"><span class="qtd ${copiar && it.qtd > 1 ? 'multi' : ''}" ${copiar && it.qtd > 1 ? 'title="Quantidade maior que 1"' : ''}>${it.qtd ?? '<span class="tag bad">' + ic('alert', 'sm') + 'Falta</span>'}</span>${it.qtd != null ? cpQtd : ''}</div></td>
      <td>${esc(ref.texto) || '<span class="muted">—</span>'} ${ref.provisoria ? `<span class="tag obs" title="Sem cadastro: a descrição do e-mail é a referência provisória.">Provisória</span> <button class="btn sm" data-act="cadastrarCodigo" data-codigo="${it.codigo}">${ic('plus', 'sm')}Cadastrar</button>` : ''}</td>
      <td class="muted">${esc(it.desc) || '—'}</td>
      <td>${tagItem(est)}</td></tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">Nenhum item lido.</td></tr>`}
  </tbody></table></div>`;
}
function htmlEditarItens(g) {
  const linhas = g._edit || g.pedido.itens.map(i => ({ codigo: i.codigo, desc: i.desc, qtd: i.qtd ?? '' }));
  return `<p class="dica">Corrige só a leitura deste e-mail.</p>
  <div class="tabela-scroll"><table class="t" id="tabEdicao"><thead><tr><th>Código (8 dígitos)</th><th>Descrição do e-mail</th><th>Qtd.</th><th></th></tr></thead><tbody>
  ${linhas.map((it, i) => `<tr><td><input type="text" inputmode="numeric" data-ei="codigo" value="${esc(it.codigo)}" maxlength="12" aria-label="Código"></td><td><input type="text" data-ei="desc" value="${esc(it.desc)}" aria-label="Descrição do e-mail"></td><td style="width:90px"><input type="text" inputmode="numeric" data-ei="qtd" value="${esc(it.qtd)}" maxlength="3" aria-label="Quantidade"></td><td class="c"><button class="btn sm ghost ico" data-act="remItem" data-i="${i}" aria-label="Remover linha" title="Remover linha">${ic('trash', 'sm')}</button></td></tr>`).join('')}
  </tbody></table></div>
  <div class="acoes"><button class="btn sm line" data-act="addItem">${ic('plus', 'sm')}Adicionar linha</button><span class="esp"></span><button class="btn sm ghost" data-act="cancelarItens">Cancelar</button><button class="btn sm pri" data-act="salvarItens">${ic('check', 'sm')}Aplicar correção</button></div>`;
}
function lerTabelaEdicao() { return $$('#tabEdicao tbody tr').map(tr => ({ codigo: $('[data-ei=codigo]', tr).value.replace(/\D/g, ''), desc: $('[data-ei=desc]', tr).value.trim(), qtd: $('[data-ei=qtd]', tr).value.replace(/\D/g, '') })); }

function htmlBannerParam(g) {
  const prm = paramDaGuia(g), cl = clinicaDe(S);
  if (g.param) {
    const feitos = (g.param.preenchido || []);
    return `<div class="banner-param">${ic('layers', 'lg')}<div class="esp"><b>Atendimento parametrizado</b> (${g.param.origem === 'criada' ? 'parametrização criada neste atendimento' : 'parametrização aplicada'}).${feitos.length ? ` Preenchido a partir dela: ${esc(feitos.join(', '))}.` : ''}</div><button class="btn sm line" data-act="parametrizar">${ic('edit', 'sm')}Ver ou editar</button></div>`;
  }
  if (prm) return `<div class="banner-param">${ic('layers', 'lg')}<div class="esp"><b>Parametrização encontrada</b> para ${esc(cl.nome)} e esta carteira (atualizada em ${fmtData(prm.atualizadoEm)}): médico ${esc(prm.medico)}, ${prm.terapias.length} terapia(s). Ao aplicar, só são preenchidos dados que faltam no e-mail.</div><button class="btn sm line" data-act="parametrizar">${ic('eye', 'sm')}Ver</button><button class="btn sm pri" data-act="aplicarParam">${ic('check', 'sm')}Aplicar parametrização</button></div>`;
  return '';
}
function renderPedido(alvo, g) {
  const p = g.pedido, st = situacaoGuia(g), cl = clinicaDe(S);
  const cartInvalida = g.carteiraUsada && !cartValida(g.carteiraUsada);
  alvo.innerHTML = `
  <div class="grid2">
    <div>${htmlEmailCard()}</div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Dados do pedido${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${cl ? htmlClinica(cl) : ''}${tagParam(g.param)}</div>
        <div class="form-grid">
          <div><label class="lbl" for="f-benef">Beneficiário</label><input type="text" id="f-benef" data-campo="beneficiario" value="${esc(p.beneficiario)}"></div>
          <div><label class="lbl">Carteira informada no e-mail</label><div style="min-height:34px;display:flex;align-items:center" class="num">${esc(p.carteiraBruta || '—')}</div></div>
          <div><label class="lbl" for="cartUsada">Carteira usada no sistema</label><div class="linha-flex" style="flex-wrap:nowrap;gap:6px"><input type="text" id="cartUsada" class="num ${cartInvalida ? 'invalido' : ''}" value="${esc(g.carteiraUsada)}" maxlength="30" placeholder="17 caracteres, sem espaços" aria-describedby="cartAjuda" style="flex:1;min-width:0">${btnCopiaCampo(g, 'carteira', 'cartUsada', 'carteira usada no sistema')}</div>${cartInvalida ? `<div class="campo-erro" id="cartAjuda">${ic('alert', 'sm')}Carteira fora do padrão (15 dígitos + 2 caracteres).</div>` : ''}</div>
          <div><label class="lbl" for="f-medico">Médico</label><input type="text" id="f-medico" data-campo="medico" value="${esc(p.medico.bruto)}">${!p.medico.nome && LS.get(chaveMedico(), '') ? `<button type="button" class="btn sm line" style="margin-top:6px" data-act="usarMedicoAnterior" title="Médico do último pedido deste remetente (confira no anexo)">${ic('user', 'sm')}Usar ${esc(LS.get(chaveMedico(), ''))}</button>` : ''}</div>
          <div><label class="lbl" for="f-cid">CID</label><input type="text" id="f-cid" data-campo="cid" value="${esc(p.cid)}"></div>
          <div><label class="lbl" for="f-em">Data do pedido médico</label><input type="text" id="f-em" data-campo="emissao" value="${esc(p.emissao.bruto)}" placeholder="dd/mm/aaaa ou SEM DATA"></div>
          <div><label class="lbl" for="f-local">Local do pedido</label><input type="text" id="f-local" data-campo="local" value="${esc(p.local)}"></div>
          ${p.obs ? `<div style="grid-column:1/-1"><label class="lbl">Observações do pedido</label><div>${esc(p.obs)}</div></div>` : ''}
        </div>
        <div class="card-h" style="margin-top:18px"><h3 style="margin:0">Serviços do pedido (${p.itens.length})</h3><span class="esp"></span>
          <button class="btn sm line" data-act="editarItens" title="Corrige a leitura deste e-mail, sem alterar cadastros">${ic('edit', 'sm')}${g.editandoItens ? 'Cancelar correção' : 'Corrigir leitura'}</button>
          <button class="btn sm" data-act="parametrizar" title="Registra médico, data e terapias como referência para os próximos atendimentos desta clínica">${ic('layers', 'sm')}Parametrizar</button></div>
        ${g.editandoItens ? htmlEditarItens(g) : htmlTabelaItens(g)}
      </div>
      ${htmlBannerParam(g)}
      <div class="card">
        <div class="card-h"><h2>Responder sem gerar guia</h2></div>
        <div class="linha-flex">${MODELOS_SEM_GUIA.map(k => `<button class="btn line" data-act="respSemGuia" data-modelo="${k}">${ic('mail')}${esc(nomeModelo(k))}</button>`).join('')}</div>
      </div>
    </div>
  </div>
  ${htmlPainelAlertas(g, st)}
  <div class="acoes" style="margin-top:0">
    <button class="btn" data-act="irVista" data-v="1">${ic('left')}E-mail</button>
    <button class="btn pri" data-act="irVista" data-v="3" ${st.pode ? '' : 'disabled'} title="${st.pode ? '' : 'Resolva os bloqueios ou responda à clínica'}">Seguir para a guia${ic('right')}</button>
    <span class="esp"></span>
    ${S.guias.length > 1 ? `<button class="btn ghost" data-act="ignorarGuia">${ic('x')}Ignorar esta solicitação</button>` : ''}
    <button class="btn dng" data-act="descartar">${ic('trash')}Descartar e-mail</button>
  </div>
  ${!st.pode ? `<p class="dica">${ic('ban', 'sm')} Há bloqueio: corrija os dados, ou responda à clínica cobrando a informação.</p>` : ''}`;
}

/* ====================================================================
   Etapa 3: guia e conferência
   ==================================================================== */
function valorCopia(g, campo) {
  const p = g.pedido, cl = clinicaDe(S);
  return ({
    executante: g.executante ?? (cl ? cl.executante : '') ?? '', medico_nome: p.medico.nome || '', medico_crm: p.medico.crm || '',
    local: p.local || '', data: dataPedidoTxt(p), carteira: g.carteiraUsada || '', benef: p.beneficiario || '', cid: p.cid || ''
  })[campo] ?? '';
}
function btnCopiaCampo(g, campo, ref, rotulo) {
  const v = valorCopia(g, campo).trim(), ok = v !== '' && g.copiados[campo] === v;
  return `<button class="btn cp ${ok ? 'copiado' : ''}" data-act="copiarCampo" data-campo="${campo}" data-ref="${ref}" aria-label="Copiar ${esc(rotulo)}">${ok ? ic('check', 'sm') : ic('copy', 'sm')}</button>`;
}
function campoCopia(g, { campo, rot, sub, curto, mid, ph, mono }) {
  const id = 'cp-' + campo, v = valorCopia(g, campo);
  return `<div class="cp-campo ${curto ? 'curto' : ''} ${mid ? 'mid' : ''}"><div class="wrapin">${sub ? `<span class="sub">${sub}</span>` : ''}<input type="text" id="${id}" class="${mono ? 'num' : ''}" data-cpcampo="${campo}" value="${esc(v)}" placeholder="${esc(ph || '')}" aria-label="${esc(rot)}"></div>${btnCopiaCampo(g, campo, id, rot)}</div>`;
}
function renderGuia(alvo, g) {
  const p = g.pedido, cl = clinicaDe(S), st = situacaoGuia(g), podeSeguir = podeFinal(g, st);
  const exec = valorCopia(g, 'executante');
  alvo.innerHTML = `
  <div class="stack">
  <div class="card">
    <div class="card-h"><h2>Dados da guia${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${cl ? htmlClinica(cl) : ''}${tagParam(g.param)}</div>
    <div class="cp-grupo"><span class="eyebrow">Prestador e solicitação</span>
      <div class="cp-linha"><div class="rot">1. Credenciado executante${!exec ? '<small>Não cadastrado: informe aqui</small>' : ''}</div><div class="cp-campos">${campoCopia(g, { campo: 'executante', rot: 'Credenciado executante', ph: 'Executante no sistema' })}</div></div>
      <div class="cp-linha"><div class="rot">2. Médico</div><div class="cp-campos">${campoCopia(g, { campo: 'medico_nome', rot: 'Nome do médico', sub: 'Nome' })}${campoCopia(g, { campo: 'medico_crm', rot: 'CRM do médico', sub: p.medico.conselho || 'CRM', curto: true, mono: true })}</div></div>
      <div class="cp-linha"><div class="rot">3. Local do pedido</div><div class="cp-campos">${campoCopia(g, { campo: 'local', rot: 'Local do pedido' })}</div></div>
      <div class="cp-linha"><div class="rot">4. Data do pedido médico</div><div class="cp-campos">${campoCopia(g, { campo: 'data', rot: 'Data do pedido médico', ph: 'dd/mm/aaaa', curto: true, mono: true })}</div></div>
    </div>
    <div class="cp-grupo"><span class="eyebrow">Beneficiário</span>
      <div class="cp-linha"><div class="rot">5. Carteira / beneficiário</div><div class="cp-campos">${campoCopia(g, { campo: 'carteira', rot: 'Carteira', sub: 'Carteira', mono: true, mid: true })}${campoCopia(g, { campo: 'benef', rot: 'Nome do beneficiário', sub: 'Beneficiário' })}</div></div>
    </div>
    <div class="cp-grupo"><span class="eyebrow">Diagnóstico</span>
      <div class="cp-linha"><div class="rot">6. CID</div><div class="cp-campos">${campoCopia(g, { campo: 'cid', rot: 'CID', curto: true, mono: true })}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-h"><h2>Serviços para lançar</h2><span class="esp"></span>
      <button class="btn sm line" data-act="editarItens3" title="Corrige a leitura deste e-mail, sem alterar cadastros">${ic('edit', 'sm')}${g.editandoItens ? 'Cancelar correção' : 'Corrigir leitura'}</button>
      <button class="btn sm" data-act="parametrizar">${ic('layers', 'sm')}Parametrizar</button></div>
    ${g.editandoItens ? htmlEditarItens(g) : !g.cega.iniciada ? `
    ${htmlTabelaItens(g, { copiar: true })}
    <div class="acoes">${cegaExigida() ? `<button class="btn pri" data-act="iniciarCega" ${p.itens.length ? '' : 'disabled'}>${ic('eye')}Lancei todos os itens: conferir a grade</button>` : ''}</div>` :
      `<p class="muted">Lista oculta durante a conferência cega. <button class="btn sm line" data-act="verItens">${ic('refresh', 'sm')}Ver itens de novo (reinicia a conferência)</button></p>`}
  </div>
  ${g.cega.iniciada && cegaExigida() ? `
  <div class="card">
    <div class="card-h"><h2>Conferência cega</h2>${g.cega.ok ? `<span class="tag ok">${ic('check', 'sm')}Conferido</span>` : ''}${g.cega.tentativas > 1 ? `<span class="tag warn">${ic('alert', 'sm')}Tentativa ${g.cega.tentativas}</span>` : ''}</div>
    <div class="cega">
      <p style="margin:0 0 8px"><b>Olhe só para a grade do sistema</b> e informe o que está lá, linha por linha.</p>
      <div class="linha-flex"><label for="cegaN">Quantas linhas preenchidas a grade tem?</label><input type="number" id="cegaN" min="0" max="20" value="${esc(g.cega.linhas)}" style="width:90px;text-align:center" ${g.cega.ok ? 'disabled' : ''}></div>
      <div id="cegaLinhas">${htmlLinhasCega(g)}</div>
      ${ambiguos(g).length ? `<p class="dica" style="margin-top:8px">Os códigos terminados em ${ambiguos(g).join(', ')} se repetem neste pedido: para eles, digite os 8 dígitos.</p>` : ''}
      ${g.cega.resultado ? htmlResultadoCega(g.cega.resultado) : ''}
      <div class="acoes">${g.cega.ok ? '' : (g.cega.resultado && !g.cega.resultado.ok ? `<button class="btn pri" data-act="refazerCega">${ic('refresh')}Corrigi no sistema: conferir de novo</button>` : `<button class="btn pri" data-act="conferir">${ic('check')}Conferir</button>`)}</div>
    </div>
  </div>` : ''}
  ${htmlPainelAlertas(g, st)}
  <div class="acoes" style="margin-top:0">
    <button class="btn" data-act="irVista" data-v="2">${ic('left')}Pedido e alertas</button>
    <button class="btn pri" data-act="irVista" data-v="4" ${podeSeguir ? '' : 'disabled'} title="${podeSeguir ? '' : 'Conclua a conferência sem divergências'}">Seguir para finalizar${ic('right')}</button>
    <span class="esp"></span>
  </div>
  ${!podeSeguir ? `<p class="dica">${cegaExigida() ? 'Para seguir: conclua a conferência da grade sem divergências.' : 'Resolva os bloqueios para seguir.'}</p>` : ''}
  </div>`;
}
function ambiguos(g) {
  const fins = {}; g.pedido.itens.forEach(i => { const f = i.codigo.slice(-4); fins[f] = (fins[f] || 0) + 1; });
  return Object.keys(fins).filter(f => fins[f] > 1);
}
function htmlLinhasCega(g) {
  const n = Math.min(20, Math.max(0, parseInt(g.cega.linhas, 10) || 0));
  if (!n) return '';
  let h = '<div class="cega-linhas"><span class="h">Linha</span><span class="h">Final do código</span><span class="h">Qtd.</span>';
  for (let i = 0; i < n; i++) {
    const v = g.cega.entradas[i] || {};
    h += `<span class="num">${i + 1}</span><input type="text" inputmode="numeric" maxlength="8" placeholder="4 últimos" data-cega="fim" data-i="${i}" value="${esc(v.fim || '')}" ${g.cega.ok ? 'disabled' : ''} aria-label="Final do código, linha ${i + 1}"><input type="text" inputmode="numeric" maxlength="1" data-cega="qtd" data-i="${i}" value="${esc(v.qtd || '')}" ${g.cega.ok ? 'disabled' : ''} aria-label="Quantidade, linha ${i + 1}">`;
  }
  return h + '</div>';
}
function compararCega(itens, n, entradas) {
  const res = { ok: true, erros: [], porItem: [], extras: [], n, m: itens.length };
  const lin = [];
  for (let i = 0; i < n; i++) {
    const e = entradas[i] || {}; const fim = String(e.fim || '').replace(/\D/g, ''); const qtd = String(e.qtd || '').replace(/\D/g, '');
    if (fim.length < 4 || qtd === '') res.erros.push(`Linha ${i + 1}: preencha pelo menos 4 dígitos do código e a quantidade.`);
    const cands = fim.length >= 4 ? itens.filter(it => it.codigo.endsWith(fim)) : [];
    lin.push({ i, fim, qtd, match: cands.length === 1 ? cands[0] : null, ambig: cands.length > 1 });
  }
  if (res.erros.length) { res.ok = false; res.incompleto = true; return res; }
  if (n !== itens.length) res.erros.push(`A grade tem ${n} linha(s) e o pedido tem ${itens.length} item(ns).`);
  for (const it of itens) {
    const ls = lin.filter(l => l.match === it);
    if (!ls.length) res.porItem.push({ it, st: 'omitido' });
    else if (ls.length > 1) res.porItem.push({ it, st: 'duplicado', linhas: ls.map(l => l.i + 1) });
    else if (Number(ls[0].qtd) !== Number(it.qtd)) res.porItem.push({ it, st: 'qtd', informado: ls[0].qtd, linha: ls[0].i + 1 });
    else res.porItem.push({ it, st: 'ok', linha: ls[0].i + 1 });
  }
  lin.filter(l => !l.match).forEach(l => res.extras.push({ linha: l.i + 1, fim: l.fim, ambig: l.ambig }));
  res.ok = !res.erros.length && !res.extras.length && res.porItem.every(x => x.st === 'ok');
  return res;
}
function htmlResultadoCega(r) {
  if (r.ok) return `<div class="res-ok" style="margin-top:12px">${ic('check')}Grade confere com o pedido: ${r.m} item(ns), códigos e quantidades corretos.</div>`;
  const li = [];
  r.erros.forEach(e => li.push(e));
  if (!r.incompleto) {
    r.porItem.forEach(x => {
      if (x.st === 'omitido') li.push(`<b>Omitido:</b> ${x.it.codigo} (${esc(x.it.desc)}) não está na grade.`);
      if (x.st === 'duplicado') li.push(`<b>Duplicado na grade:</b> ${x.it.codigo} aparece nas linhas ${x.linhas.join(' e ')}.`);
      if (x.st === 'qtd') li.push(`<b>Quantidade divergente:</b> ${x.it.codigo} está com ${x.informado} na linha ${x.linha}; o pedido pede <b>${x.it.qtd}</b>.`);
    });
    r.extras.forEach(x => li.push(x.ambig ? `<b>Linha ${x.linha}:</b> final "${x.fim}" combina com mais de um código; digite os 8 dígitos.` : `<b>Inclusão indevida:</b> a linha ${x.linha} (final ${x.fim}) não está no pedido.`));
  }
  return `<div class="res-bad" style="margin-top:12px"><b>${ic('alert', 'sm')} ${r.incompleto ? 'Conferência incompleta' : 'A grade não confere com o pedido'}</b><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
}

/* ====================================================================
   Etapa 4: finalizar a guia (resultado real, resposta e observação)
   ==================================================================== */
function pendenciasConclusao(g, st) {
  const P = [], r = g.resultado;
  if (g.semGuia) { if (mostraResposta(g) && r.emailPrestador && !emailValido(r.emailPrestador)) P.push('O e-mail do prestador não parece válido.'); return P; }
  if (!/^[TS]\d{8}$/.test(g.numero)) P.push('Informe o número da guia gerada no sistema oficial (T ou S + 8 dígitos).');
  if (!r.situacao) P.push('Selecione a situação da autorização.');
  if (r.situacao === 'autorizada' || r.situacao === 'parcial') {
    const gl = glosaDe(g);
    if (!gl.resp) P.push('Responda: retirou alguma glosa?');
    else if (gl.resp === 'sim') {
      const its = glosasValidas(g);
      if (!its.length) P.push('Selecione o(s) item(ns) em que a glosa foi retirada.');
      its.forEach(([c, x]) => { if (!(x.glosa || '').trim()) P.push(`Informe a glosa do item ${c}.`); if (!(x.motivo || '').trim()) P.push(`Informe por que a glosa do item ${c} foi retirada.`); });
    }
  }
  if (r.situacao === 'parcial') {
    const n = Object.keys(r.naoAut).length;
    if (!n) P.push('Marque os itens que não foram autorizados.');
    else if (n >= g.pedido.itens.length) P.push('Todos os itens estão marcados como não autorizados: use a situação “Não autorizada”.');
  }
  if (mostraResposta(g) && r.emailPrestador && !emailValido(r.emailPrestador)) P.push('O e-mail do prestador não parece válido.');
  if (!st.pode) P.push('Há bloqueio nesta guia (veja Alertas e ocorrências).');
  if (cegaExigida() && !g.cega.ok) P.push('Falta concluir a conferência da grade.');
  return P;
}
// Itens em que a glosa pode ser retirada: na parcial, só os autorizados (os negados ficam de fora)
const itensGlosaveis = g => g.resultado.situacao === 'parcial' ? g.pedido.itens.filter(it => g.resultado.naoAut[it.codigo] == null) : g.pedido.itens;
const glosasValidas = g => { const ok = new Set(itensGlosaveis(g).map(i => i.codigo)); return Object.entries(glosaDe(g).itens).filter(([c]) => ok.has(c)); };
function htmlGlosa(g) {
  const gl = glosaDe(g), lista = cfg.glosas || [];
  const campo = (it, x) => lista.length
    ? `<select data-glf="glosa" data-c="${it.codigo}" aria-label="Glosa do item ${it.codigo}"><option value="">Selecione a glosa…</option>${[...new Set([...(x.glosa && !lista.includes(x.glosa) ? [x.glosa] : []), ...lista])].map(v => `<option value="${esc(v)}" ${v === x.glosa ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`
    : `<input type="text" data-glf="glosa" data-c="${it.codigo}" value="${esc(x.glosa || '')}" placeholder="Glosa (cadastre a lista em Configurações)" aria-label="Glosa do item ${it.codigo}">`;
  return `<div class="glosa"><div class="linha-flex" style="margin-top:10px"><b>Retirou alguma glosa?</b><div class="seg" role="radiogroup" aria-label="Retirou alguma glosa?"><button type="button" role="radio" aria-checked="${gl.resp === 'sim'}" class="${gl.resp === 'sim' ? 'on igual' : ''}" data-act="setGlosa" data-v="sim">Sim</button><button type="button" role="radio" aria-checked="${gl.resp === 'nao'}" class="${gl.resp === 'nao' ? 'on igual' : ''}" data-act="setGlosa" data-v="nao">Não</button></div>${gl.resp ? '' : '<span class="tag warn">Obrigatório</span>'}</div>
    ${gl.resp === 'sim' ? `<div class="negados">${itensGlosaveis(g).map(it => { const x = gl.itens[it.codigo], ref = descRefItem(g, it); return `<div class="negado gl ${x ? 'on' : ''}" style="grid-template-columns:auto 1fr"><input type="checkbox" id="gl-${it.codigo}" data-gl="${it.codigo}" ${x ? 'checked' : ''}><label for="gl-${it.codigo}"><b class="num">${it.codigo}</b> — Qtd. ${it.qtd ?? '?'} — ${esc(ref.texto || it.desc)}</label>${x ? `<div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 2fr;gap:8px">${campo(it, x)}<input type="text" data-glf="motivo" data-c="${it.codigo}" value="${esc(x.motivo || '')}" placeholder="Por que a glosa foi retirada" aria-label="Motivo da retirada do item ${it.codigo}"></div>` : ''}</div>`; }).join('')}</div>` : ''}</div>`;
}
function optsMotivos(sel) { return `<option value="">Selecione o motivo…</option>` + cfg.motivos.map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.nome)}</option>`).join(''); }
function htmlSituacao(g) {
  const r = g.resultado;
  const op = (v, i, t, d) => `<button type="button" class="sit ${v === 'nao' ? 'nao' : v} ${r.situacao === v ? 'on' : ''}" role="radio" aria-checked="${r.situacao === v}" data-act="setSit" data-v="${v}">${ic(i, 'lg')}<span><b>${t}</b></span></button>`;
  let extra = '';
  if (r.situacao === 'parcial') {
    extra = `<div class="negados">${g.pedido.itens.map(it => { const neg = r.naoAut[it.codigo] != null; const ref = descRefItem(g, it); return `<div class="negado ${neg ? 'on' : ''}"><input type="checkbox" id="neg-${it.codigo}" data-neg="${it.codigo}" ${neg ? 'checked' : ''}><label for="neg-${it.codigo}"><b class="num">${it.codigo}</b> — Qtd. ${it.qtd ?? '?'} — ${esc(ref.texto || it.desc)}</label><select data-negmot="${it.codigo}" ${neg ? '' : 'disabled'} aria-label="Motivo da não autorização de ${it.codigo}">${optsMotivos(r.naoAut[it.codigo])}</select></div>`; }).join('')}</div>`;
  }
  if (r.situacao === 'nao') {
    extra = `<div class="form-grid" style="margin-top:12px"><div><label class="lbl" for="rMotivo">Motivo da não autorização</label><select id="rMotivo" data-resf="motivoId">${optsMotivos(r.motivoId)}</select></div><div><label class="lbl" for="rMotivoTxt">Detalhe do motivo (opcional)</label><input type="text" id="rMotivoTxt" data-resf="motivoTxt" value="${esc(r.motivoTxt)}"></div></div>`;
  }
  if (r.situacao === 'autorizada') extra = htmlGlosa(g);
  else if (r.situacao === 'parcial') extra += htmlGlosa(g);
  return `<div class="sit-opcoes" role="radiogroup" aria-label="Situação da autorização">
    ${op('autorizada', 'check', 'Autorizada', 'Todos os itens aplicáveis foram autorizados.')}
    ${op('parcial', 'halfcircle', 'Parcialmente autorizada', 'Somente parte dos itens foi autorizada.')}
    ${op('nao', 'x', 'Não autorizada', 'A guia foi gerada, mas a autorização não foi concedida.')}</div>${extra}`;
}
function htmlCardObs(g) {
  const obsTxt = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g);
  return `<div class="card">
  <div class="card-h"><h2>Observação da guia</h2><span class="tag info" title="O campo de observação do sistema oficial aceita só texto simples.">${ic('info', 'sm')}Texto simples</span><span class="esp"></span>
</div>
  <textarea id="txtObs" rows="9" aria-label="Observação da guia">${esc(obsTxt)}</textarea>
  <div class="acoes"><button class="btn cp ${g.copiados.obs === obsTxt ? 'copiado' : ''}" data-act="copiarObs">${g.copiados.obs === obsTxt ? ic('check', 'sm') : ic('copy', 'sm') + 'Copiar observação (texto simples)'}</button>${g.obsEdit != null ? `<button class="btn sm ghost" data-act="resetObs">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}</div>
      </div>`;
}
function renderFinal(alvo, g) {
  if (g.semGuia) return renderFinalSemGuia(alvo, g);
  const r = g.resultado, st = situacaoGuia(g), guiaOk = /^[TS]\d{8}$/.test(g.numero);
  const pend = pendenciasConclusao(g, st);
  const showResp = mostraResposta(g), multi = usaConsolidada(), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  const resp = showResp && (r.situacao || multi) ? respostaDaGuia(g, true) : null;
  const html = g.respEdit != null ? g.respEdit : (resp ? resp.html : '');
  const obsTxt = g.obsEdit != null ? g.obsEdit : observacaoDaGuia(g);
  const emailOk = r.emailPrestador && g.copiados.email === r.emailPrestador;
  alvo.innerHTML = `
  ${multi && !showResp ? `<div class="aviso">${ic('info')}<div>Este e-mail tem ${guiasAtivas().length} guias. Aqui você registra o número, o resultado e a observação desta guia. A <b>resposta ao prestador, com todas as guias</b>, aparece na última guia (faltam ${faltam}).</div></div>` : ''}
  ${multi && showResp ? `<div class="banner-param">${ic('mail', 'lg')}<div class="esp"><b>Última guia do e-mail.</b> A resposta abaixo reúne o resultado de todas as guias geradas neste e-mail.</div></div>` : ''}
  <div class="${showResp ? 'grid2' : ''}">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Número e resultado da guia${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${tagParam(g.param)}</div>
        <div class="form-grid">
          <div><label class="lbl" for="guia">Número da guia</label><input type="text" id="guia" class="num ${g.numero && !guiaOk ? 'invalido' : ''}" value="${esc(g.numero)}" maxlength="10" placeholder="T00000000 ou S00000000" autocomplete="off" aria-describedby="guiaAjuda">
            <div class="${g.numero && !guiaOk ? 'campo-erro' : 'campo-ajuda'}" id="guiaAjuda">${g.numero && !guiaOk ? ic('alert', 'sm') : ''}${g.numero && !guiaOk ? 'Formato: T ou S + 8 dígitos.' : ''}</div></div>
          ${showResp ? `<div><label class="lbl" for="emailPrest">E-mail do prestador</label>
            <div class="cp-campo"><div class="wrapin"><input type="text" id="emailPrest" data-resf="emailPrestador" value="${esc(r.emailPrestador)}" class="${r.emailPrestador && !emailValido(r.emailPrestador) ? 'invalido' : ''}" placeholder="contato@clinica.com.br"></div>
              <button class="btn cp ${emailOk ? 'copiado' : ''}" data-act="copiarEmail" aria-label="Copiar somente o e-mail do prestador">${emailOk ? ic('check', 'sm') : ic('copy', 'sm')}</button></div>
            </div>` : ''}
        </div>
        <h3>Situação da autorização</h3>
        ${htmlSituacao(g)}
        <div style="margin-top:12px"><div class="linha-flex" style="justify-content:space-between;margin-bottom:3px"><label class="lbl" for="rObs" style="margin:0">Observações adicionais (entram na resposta ao prestador)</label><button class="btn sm" data-act="incluirObs">${ic('plus', 'sm')}Incluir observação</button></div><textarea id="rObs" data-resf="obsAdicionais" rows="2">${esc(r.obsAdicionais)}</textarea></div>
      </div>
      ${htmlCardObs(g)}
    </div>
    ${showResp ? `<div class="stack">
      <div class="card">
        <div class="card-h"><h2>${multi ? 'Resposta ao prestador (todas as guias)' : 'Resposta ao prestador'}</h2>${resp ? `<span class="tag ac">${ic('mail', 'sm')}${esc(nomeModelo(resp.modelo))}</span>` : ''}<span class="esp"></span>
          ${!multi && r.situacao === 'autorizada' && /^\s*(re|res)\s*:/i.test(S.email.assunto) ? `<label class="chk" style="font-size:var(--fs-sm)"><input type="checkbox" data-resf="usarCorrecao" ${g.usarCorrecao ? 'checked' : ''}>Usar modelo de correção</label>` : ''}</div>
        ${!resp ? `<div class="aviso">${ic('info')}<div>Selecione a situação da autorização. O modelo da resposta é definido pelo resultado real da guia: autorizada, parcial ou não autorizada.</div></div>` : `
        ${resp.faltando.length ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>Campos sem valor, destacados no texto: <b>${resp.faltando.map(k => esc((CAMPO[k] || {}).nome || k)).join(', ')}</b>. Preencha-os acima ou edite o texto.</div></div>` : ''}
        ${htmlEditor({ id: 'edResp', valor: html, minAltura: 240 })}
        <div class="acoes"><button class="btn pri" data-act="copiarResp" ${guiaOk ? '' : 'disabled'} title="${guiaOk ? 'Copia texto formatado, para colar no e-mail' : 'Informe o número da guia'}">${ic('copy')}Copiar com formatação</button>
          <button class="btn line" data-act="copiarRespSimples" ${guiaOk ? '' : 'disabled'}>${ic('copy')}Copiar texto simples</button>
          ${(g.respEdit != null || g.respExtras.length) ? `<button class="btn sm ghost" data-act="resetResp">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}
          ${g.copiados.resp ? `<span class="tag ok">${ic('check', 'sm')}Resposta copiada</span>` : ''}</div>`}
      </div>
    </div>` : ''}
  </div>
  ${htmlPainelAlertas(g, st)}
  <div class="acoes" style="margin-top:0">
    <button class="btn" data-act="irVista" data-v="3">${ic('left')}Guia e conferência</button>
    <span class="esp"></span>
    <button class="btn pri" data-act="concluirGuia" ${pend.length ? 'disabled' : ''}>${ic('check')}Concluir guia</button>
  </div>
  ${pend.length ? `<ul class="dica" style="margin:0;padding-left:20px">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
}
function renderFinalSemGuia(alvo, g) {
  const multi = usaConsolidada(), showResp = mostraResposta(g), faltam = S.guias.filter(x => x !== g && !guiaTerminal(x)).length;
  const frag = renderModelo(g.semGuia + '_multi', ctxDe(g, extrasSemGuia(g, g.semGuia)), { marcar: true });
  const resp = showResp ? respostaDaGuia(g, true) : null, r = g.resultado;
  const html = g.respEdit != null ? g.respEdit : (resp ? resp.html : '');
  const emailOk = r.emailPrestador && g.copiados.email === r.emailPrestador, pend = pendenciasConclusao(g, situacaoGuia(g));
  alvo.innerHTML = `<div class="stack">
  <div class="card"><div class="card-h"><h2>Responder sem gerar guia${multi ? ` — guia ${g.idx + 1}` : ''}</h2><span class="tag obs">${ic('mail', 'sm')}${esc(nomeModelo(g.semGuia))}</span><span class="esp"></span><button class="btn sm line" data-act="desfazerSemGuia">${ic('left', 'sm')}Voltar e gerar a guia</button></div>
    ${multi && !showResp ? `<div class="aviso" style="margin-top:10px">${ic('info')}<div>A resposta única com todas as guias aparece na última guia (faltam ${faltam}). Abaixo, o trecho desta guia.</div></div>` : ''}
    ${multi ? `<h3>Trecho desta guia na resposta única</h3><div class="previa"><div class="previa-c">${frag.html}</div></div>` : ''}
  </div>
  ${showResp ? `<div class="card"><div class="card-h"><h2>${multi ? 'Resposta ao prestador (todas as guias)' : 'Resposta ao prestador'}</h2><span class="esp"></span></div>
    <div class="cp-campo" style="margin-bottom:10px"><div class="wrapin"><label class="lbl" for="emailPrest">E-mail do prestador</label><input type="text" id="emailPrest" data-resf="emailPrestador" value="${esc(r.emailPrestador)}" class="${r.emailPrestador && !emailValido(r.emailPrestador) ? 'invalido' : ''}"></div>
      <button class="btn cp ${emailOk ? 'copiado' : ''}" data-act="copiarEmail" style="align-self:flex-end" aria-label="Copiar somente o e-mail do prestador">${emailOk ? ic('check', 'sm') : ic('copy', 'sm')}</button></div>
    ${resp && resp.faltando.length ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>Campos sem valor, destacados no texto: <b>${resp.faltando.map(k => esc((CAMPO[k] || {}).nome || k)).join(', ')}</b>. Edite o texto antes de copiar.</div></div>` : ''}
    ${htmlEditor({ id: 'edResp', valor: html, minAltura: 240 })}
    <div class="acoes"><button class="btn pri" data-act="copiarResp">${ic('copy')}Copiar com formatação</button><button class="btn line" data-act="copiarRespSimples">${ic('copy')}Copiar texto simples</button>
      ${(g.respEdit != null || g.respExtras.length) ? `<button class="btn sm ghost" data-act="resetResp">${ic('undo', 'sm')}Refazer do modelo</button>` : ''}${g.copiados.resp ? `<span class="tag ok">${ic('check', 'sm')}Resposta copiada</span>` : ''}</div></div>` : ''}
  </div>
  <div class="acoes" style="margin-top:12px"><button class="btn" data-act="desfazerSemGuia">${ic('left')}Pedido e alertas</button><span class="esp"></span>
    <button class="btn pri" data-act="concluirGuia" ${pend.length ? 'disabled' : ''}>${ic('check')}Concluir guia</button></div>
  ${pend.length ? `<ul class="dica" style="margin:0;padding-left:20px">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
}
function renderConcluida(alvo, g) {
  const r = g.resultado, resp = respostaDaGuia(g, false), a = autorizadosDe(g), n = negadosDe(g);
  const prox = S.guias.findIndex(x => !guiaTerminal(x)), todas = S.guias.every(guiaTerminal);
  alvo.innerHTML = `<div class="grid2"><div class="stack">
    <div class="card"><div class="card-h"><h2>Guia concluída${S.guias.length > 1 ? ` — guia ${g.idx + 1}` : ''}</h2><span class="esp"></span>${tagResultado(r.situacao)}${tagParam(g.param)}</div>
      <dl class="kv">${g.semGuia ? `<dt>Situação</dt><dd>Guia não gerada: ${esc(nomeModelo(g.semGuia))}</dd>` : `<dt>Número da guia</dt><dd class="num"><b>${esc(g.numero)}</b></dd>`}<dt>Beneficiário</dt><dd>${esc(nomeGuia(g))}</dd><dt>Carteira</dt><dd class="num">${esc(g.carteiraUsada)}</dd>
      ${a.length ? `<dt>Autorizados</dt><dd>${a.map(i => `<span class="num">${i.codigo}</span> × ${i.qtd ?? '?'}`).join('<br>')}</dd>` : ''}
      ${n.length ? `<dt>Não autorizados</dt><dd>${n.map(x => `<span class="num">${x.it.codigo}</span> × ${x.it.qtd ?? '?'}${x.motivo ? ' — ' + esc(x.motivo) : ''}`).join('<br>')}</dd>` : ''}
      ${r.situacao === 'nao' && (r.motivoId || r.motivoTxt) ? `<dt>Motivo</dt><dd>${esc([motivoNome(r.motivoId), r.motivoTxt].filter(Boolean).join(' — '))}</dd>` : ''}</dl>
      <div class="acoes"><button class="btn line" data-act="reabrirGuia">${ic('edit')}Reabrir para correção</button><span class="esp"></span>
        ${prox >= 0 ? `<button class="btn pri" data-act="selGuia" data-i="${prox}">Próxima guia pendente${ic('right')}</button>` : ''}
        ${todas ? `<button class="btn pri" data-act="encerrar">${ic('check')}Encerrar atendimento</button>` : ''}</div></div>${g.semGuia ? '' : htmlCardObs(g)}</div>
    ${usaConsolidada() && !todas ? '' : `<div class="card"><div class="card-h"><h2>Resposta ao prestador${usaConsolidada() ? ' (todas as guias)' : ''}</h2></div>
      <div class="previa"><div class="previa-c">${resp.html.replace(/<mark class="lacuna">(.*?)<\/mark>/g, '$1')}</div></div>
      <div class="acoes"><button class="btn line" data-act="copiarRespConcluida">${ic('copy')}Copiar com formatação</button></div></div>`}</div>`;
}

/* ====================================================================
   Modais: resposta rápida, resposta do e-mail, observação, parametrização
   ==================================================================== */
function abrirRespostaEmail() {
  const g = guiaAtiva() || S.guias[0], pend = S.guias.filter(x => !guiaTerminal(x)).length;
  const r = renderModelo('resposta_multipla', ctxDe(g), { marcar: true });
  M = { tipo: 'resp', modelo: 'resposta_multipla', semGuia: false, copiou: false };
  abrirModal({
    titulo: 'Resposta do e-mail', sub: `${S.guias.filter(x => x.status !== 'descartado').length} guia(s) neste e-mail`, icone: 'mail', tamanho: 'g',
    corpo: `${pend ? `<div class="aviso" style="margin-bottom:10px">${ic('alert')}<div>${pend} guia(s) ainda não foi(ram) processada(s). O texto indica essas guias como pendentes; envie esta resposta só se for o caso.</div></div>` : ''}
      ${htmlEditor({ id: 'edModal', valor: r.html, minAltura: 280 })}`,
    rodape: `<span class="dica" id="modalEstado"></span><button class="btn" data-act="fecharModal">Fechar</button><button class="btn line" data-act="copiarModalSimples">${ic('copy')}Copiar texto simples</button><button class="btn pri" data-act="copiarModalRico">${ic('copy')}Copiar com formatação</button>`
  });
}

/* ---------- Incluir observação ---------- */
function opcoesObservacao(g, st) {
  const L = [];
  st.obs.forEach(a => L.push({ id: 'a:' + a.key, titulo: ALERTAS[a.tipo].nome, texto: a.obsTexto, pre: true }));
  const mo = renderModelo('observacao', ctxDe(g)).texto; if ((mo || '').trim()) L.push({ id: 'm:obs', titulo: nomeModelo('observacao') + ' (modelo)', texto: mo, pre: false });
  if (g.param) {
    L.push({ id: 'p:obs', titulo: 'Atendimento parametrizado', texto: renderModelo('obs_parametrizado', ctxDe(g)).texto, pre: !!cfg.preferencias.obsParametrizadoAuto });
    const prm = Param.porId(g.param.id); if (prm && prm.texto) L.push({ id: 'p:txt', titulo: 'Dados da parametrização', texto: prm.texto, pre: false });
  }
  if (!g.param) { const mp = renderModelo('obs_parametrizado', ctxDe(g)).texto; if ((mp || '').trim()) L.push({ id: 'm:par', titulo: nomeModelo('obs_parametrizado') + ' (modelo)', texto: mp, pre: false }); }
  if (g.pedido.obs) L.push({ id: 'o:ped', titulo: 'Observações do pedido (e-mail)', texto: g.pedido.obs, pre: false });
  return L;
}
const textoSelObs = () => M.itens.filter(i => M.sel.has(i.id) && !M.g.obsInc.includes(i.id)).map(i => i.texto).join('\n');
function htmlModalObs() {
  return `${M.itens.length ? M.itens.map(i => { const ja = M.g.obsInc.includes(i.id); return `<label class="chk" style="margin:6px 0;${ja ? 'opacity:.6' : ''}"><input type="checkbox" data-obssel="${esc(i.id)}" ${M.sel.has(i.id) && !ja ? 'checked' : ''} ${ja ? 'disabled' : ''}><span><b>${esc(i.titulo)}</b> ${ja ? `<span class="tag ok">${ic('check', 'sm')}Já incluída</span>` : ''}<br><span class="muted" style="font-size:var(--fs-sm)">${esc(i.texto)}</span></span></label>`; }).join('') : '<p class="muted">Nenhuma observação disponível para esta guia. Escreva abaixo se quiser.</p>'}
    <label class="lbl" for="obsTxt" style="margin-top:10px">Texto a inserir (editável)</label><textarea id="obsTxt" data-obstxt="txt" rows="4">${esc(M.txt)}</textarea>`;
}
function abrirModalObs() {
  const g = guiaAtiva(), st = situacaoGuia(g), itens = opcoesObservacao(g, st);
  M = { tipo: 'obs', g, itens, sel: new Set(itens.filter(i => i.pre).map(i => i.id)), txt: '', editado: false };
  M.txt = textoSelObs();
  abrirModal({ titulo: 'Incluir observação', sub: 'Vai para as observações adicionais da resposta ao prestador', icone: 'message', tamanho: 'g', corpo: htmlModalObs(),
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="inserirObs">${ic('check')}Inserir</button>` });
}

/* ---------- Parametrização ---------- */
function novoParamModal(g, prm) {
  const cl = clinicaDe(S);
  if (prm) return { tipo: 'param', id: prm.id, guiaId: g ? g.id : null, clinicaId: prm.clinicaId, carteira: prm.carteira, medico: prm.medico, data: prm.emissao ? diaBR(prm.emissao) : '', terapias: prm.terapias.map(t => ({ ...t })), texto: prm.texto || '', textoEditado: !!prm.texto, criadoEm: prm.criadoEm, criadoPor: prm.criadoPor };
  const p = g.pedido;
  return { tipo: 'param', id: null, guiaId: g.id, clinicaId: cl.id, carteira: g.carteiraUsada, medico: p.medico.nome || '', data: p.emissao.estado === 'valida' ? fmtData(p.emissao.data) : '',
    terapias: p.itens.map(it => ({ id: uid(), codigo: it.codigo, descricao: descRefItem(g, it).texto, qtd: it.qtd ?? '' })), texto: '', textoEditado: false };
}
function htmlModalParam() {
  const m = M, cl = cfg.clinicas.find(c => c.id === m.clinicaId);
  return `<div class="stack">
    <div class="linha-flex">${cl ? htmlClinica(cl) : ''}<span class="tag"><span class="muted">Carteira</span> <b class="num">${esc(m.carteira || '—')}</b></span>${m.id ? '<span class="tag ac">Parametrização existente</span>' : '<span class="tag info">Nova parametrização</span>'}</div>
    ${m.livre ? `<div class="form-grid"><div><label class="lbl" for="pmClinica">Clínica</label><select id="pmClinica" data-pm="clinicaId"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(c => `<option value="${c.id}" ${c.id === m.clinicaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div><div><label class="lbl" for="pmCart">Carteira (17 caracteres)</label><input type="text" id="pmCart" data-pm="carteira" class="num" value="${esc(m.carteira)}" maxlength="20"></div></div>` : ''}
    <div class="aviso-simples">${ic('info')}<div>A parametrização é uma referência para os <b>próximos atendimentos desta clínica e carteira</b>. É independente de “Corrigir leitura”: alterar aqui não muda os itens deste e-mail, e o contrário também.</div></div>
    <div class="form-grid">
      <div><label class="lbl" for="pmMedico">Nome do médico</label><input type="text" id="pmMedico" data-pm="medico" value="${esc(m.medico)}"></div>
      <div><label class="lbl" for="pmData">Data de emissão do pedido médico</label><input type="text" id="pmData" data-pm="data" value="${esc(m.data)}" placeholder="dd/mm/aaaa"></div>
    </div>
    <div><div class="card-h" style="margin-bottom:6px"><h3 style="margin:0">Terapias</h3><span class="esp"></span><button class="btn sm line" data-act="pmAdd">${ic('plus', 'sm')}Adicionar terapia</button></div>
      <div class="tabela-scroll"><table class="t"><thead><tr><th style="width:130px">Código (opcional)</th><th>Descrição da terapia</th><th style="width:90px">Qtd.</th><th style="width:48px"></th></tr></thead><tbody>
      ${m.terapias.map((t, i) => `<tr><td><input type="text" inputmode="numeric" data-pt="codigo" data-i="${i}" value="${esc(t.codigo || '')}" maxlength="8" aria-label="Código da terapia ${i + 1}"></td><td><input type="text" data-pt="descricao" data-i="${i}" value="${esc(t.descricao)}" aria-label="Descrição da terapia ${i + 1}"></td><td><input type="text" inputmode="numeric" data-pt="qtd" data-i="${i}" value="${esc(t.qtd)}" maxlength="3" aria-label="Quantidade da terapia ${i + 1}"></td><td class="c"><button class="btn sm ghost ico" data-act="pmRem" data-i="${i}" aria-label="Remover terapia ${i + 1}" title="Remover terapia">${ic('trash', 'sm')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhuma terapia. Use “Adicionar terapia”.</td></tr>'}
      </tbody></table></div></div>
    <div><div class="card-h" style="margin-bottom:6px"><h3 style="margin:0">Texto estruturado</h3>${m.textoEditado ? `<span class="tag warn" id="pmTag">${ic('edit', 'sm')}Editado manualmente</span>` : '<span class="tag ac" id="pmTag">Gerado automaticamente</span>'}<span class="esp"></span><button class="btn sm line" data-act="pmGerar" ${m.textoEditado ? '' : 'disabled'}>${ic('refresh', 'sm')}Gerar novamente</button></div>
      <textarea id="pmTexto" rows="6" data-pm="texto" aria-label="Texto estruturado da parametrização">${esc(m.texto)}</textarea>
      <p class="dica" style="margin:6px 0 0">O texto acompanha os campos enquanto você não o editar. O formato vem dos modelos (Configurações › Parametrizações).</p></div>
  </div>`;
}
function abrirModalParam(g, prm, livre) {
  M = novoParamModal(g, prm); M.livre = !!livre;
  if (!M.textoEditado) M.texto = textoParametrizacao(M);
  abrirModal({ titulo: M.id ? 'Parametrização' : 'Nova parametrização', sub: 'Referência para os próximos atendimentos', icone: 'layers', tamanho: 'g', corpo: htmlModalParam(),
    rodape: `${M.id ? `<button class="btn dng" data-act="pmExcluir">${ic('trash')}Excluir parametrização</button>` : ''}<span class="esp" style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="pmSalvar">${ic('save')}Salvar parametrização</button>` });
}

/* ---------- Cadastrar código (descrição provisória → cadastro da clínica) ---------- */
function abrirModalCadCodigo(codigo) {
  const g = guiaAtiva(), it = g.pedido.itens.find(x => x.codigo === codigo);
  M = { tipo: 'codcad', codigo };
  abrirModal({ titulo: 'Cadastrar código', sub: codigo, icone: 'tag', tamanho: 'p',
    corpo: `<div class="form-grid"><div style="grid-column:1/-1"><label class="lbl" for="ccClinica">Clínica</label><select id="ccClinica"><option value="">Escolha a clínica…</option>${cfg.clinicas.map(c => `<option value="${esc(c.id)}" ${S.clinicaId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div style="grid-column:1/-1"><label class="lbl" for="ccDesc">Descrição da terapia</label><input type="text" id="ccDesc" value="${esc((it && it.desc) || '')}" autofocus></div></div>`,
    rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="cadCodigoOk">${ic('check')}Cadastrar</button>` });
}

function htmlModalCorrigir() {
  return `<div class="form-grid"><div><label class="lbl" for="cgCart">Carteira</label><input type="text" id="cgCart" class="num" data-cgc="1" value="${esc(M.carteira)}" maxlength="20"></div></div>
    <div class="card-h" style="margin-top:12px"><h3 style="margin:0">Serviços e quantidades</h3><span class="esp"></span><button class="btn sm line" data-act="cgAdd">${ic('plus', 'sm')}Adicionar serviço</button></div>
    <div class="tabela-scroll"><table class="t"><thead><tr><th style="width:140px">Código</th><th>Descrição</th><th style="width:80px">Qtd.</th><th style="width:48px"></th></tr></thead><tbody>
    ${M.itens.map((i, k) => `<tr><td><input type="text" inputmode="numeric" data-cgi="c" data-i="${k}" value="${esc(i.c)}" maxlength="8" aria-label="Código ${k + 1}"></td><td><input type="text" data-cgi="d" data-i="${k}" value="${esc(i.d)}" aria-label="Descrição ${k + 1}"></td><td><input type="text" inputmode="numeric" data-cgi="q" data-i="${k}" value="${esc(i.q)}" maxlength="2" aria-label="Quantidade ${k + 1}"></td><td class="c"><button class="btn sm ghost ico" data-act="cgRem" data-i="${k}" aria-label="Remover serviço" title="Remover serviço">${ic('trash', 'sm')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum serviço.</td></tr>'}
    </tbody></table></div>`;
}

/* ====================================================================
   Painel do dia: visão operacional (sem caixa de pendências por operador)
   ==================================================================== */
let painelDia = isoDia(new Date());
let painelModo = 'dia';   // 'dia' | 'semana' | 'mes'
let painelMes = isoDia(new Date()).slice(0, 7);
// Semana ISO (segunda a domingo), no formato do <input type="week">: AAAA-Www
function semanaDe(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow); const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - a) / 864e5 + 1) / 7)).padStart(2, '0'); }
function intervaloSemana(v) { const m = /^(\d{4})-W(\d{2})$/.exec(v || ''); if (!m) return null; const j4 = new Date(Date.UTC(+m[1], 0, 4)); const seg = new Date(j4); seg.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() || 7) - 1) + (+m[2] - 1) * 7); const dom = new Date(seg); dom.setUTCDate(seg.getUTCDate() + 6); const f = x => x.toISOString().slice(0, 10); return { ini: f(seg), fim: f(dom) }; }
let painelSemana = semanaDe(new Date());
const rotuloSemana = v => { const i = intervaloSemana(v); return i ? diaBR(i.ini).slice(0, 5) + ' a ' + diaBR(i.fim).slice(0, 5) : v; };
const regsDoPeriodo = () => painelModo === 'mes' ? Reg.doMes(painelMes) : painelModo === 'semana' ? (i => Reg.doPeriodo(i.ini, i.fim))(intervaloSemana(painelSemana) || { ini: '', fim: '' }) : Reg.doDia(painelDia);
let painelFiltro = { q: '', status: '', res: '', clinica: '', param: '' };
let conc = null;    // resultado da conciliação
let amostra = null;
const resultadoDe = r => r.status === 'cancelado' ? '' : ((r.resultado && r.resultado.situacao) || (r.status === 'concluido' ? 'autorizada' : ''));
const regPorId = id => Reg.cache.find(x => x.id === id) || Reg.todos[id] || null;
function descDiv(d) { let m; if ((m = /^omitido:(.+)$/.exec(d))) return `Omitido na grade: ${m[1]}`; if ((m = /^qtd:(\d+)=(\d+)$/.exec(d))) return `Quantidade divergente em ${m[1]} (informado ${m[2]})`; if ((m = /^duplicado:(.+)$/.exec(d))) return `Duplicado na grade: ${m[1]}`; if ((m = /^indevida:(.+)$/.exec(d))) return `Inclusão indevida (final ${m[1]})`; return String(d).replace(/<[^>]+>/g, ''); }
const descreverDivergencias = divs => divs.map((d, i) => `Tentativa ${i + 1}: ` + (Array.isArray(d) ? d : [d]).map(descDiv).join('; ')).join('\n');
function obsCelula(r) {
  const T = [], rs = r.resultado || {}, divs = (r.conferencia && r.conferencia.divergencias) || [];
  if (r.parametrizado) T.push(tagParam(r.parametrizado));
  if (divs.length) T.push(`<span class="tag warn" title="${esc(descreverDivergencias(divs))}">${ic('alert', 'sm')}${divs.length} divergência(s)</span>`);
  const ao = (r.alertas || []).filter(a => a.m === 'obs'); if (ao.length) T.push(`<span class="tag obs" title="${esc(ao.map(a => a.t).join('\n'))}">${ic('message', 'sm')}Aviso c/ obs.</span>`);
  if (rs.situacao === 'sem_guia') T.push(`<span class="tag obs" title="${esc('Sem guia gerada: ' + nomeModelo(rs.modelo) + ((r.bloqueios || []).length ? '\n' + r.bloqueios.join('\n') : ''))}">${ic('mail', 'sm')}Sem guia: ${esc(nomeModelo(rs.modelo))}</span>`);
  if ((rs.glosas || []).length) T.push(`<span class="tag warn" title="${esc(rs.glosas.map(x => `${x.c}: glosa ${x.g || '—'}\nMotivo da retirada: ${x.m || '—'}`).join('\n\n'))}">${ic('check', 'sm')}Glosa retirada</span>`);
  if (r.status === 'cancelado') T.push(`<span class="tag bad" title="${esc(r.canceladoMotivo ? 'Motivo: ' + r.canceladoMotivo : 'Guia cancelada')}">${ic('ban', 'sm')}Cancelada</span>`);
  if (r.corrigida) T.push(`<span class="tag info" title="${esc('Corrigida em ' + fmtDH(r.corrigida.em) + ' por ' + (r.corrigida.por || '—') + '\nAntes: carteira ' + (r.corrigida.antes.carteira || '—') + '; itens ' + (r.corrigida.antes.itens || []).join(', '))}">${ic('edit', 'sm')}Corrigida</span>`);
  return T.join(' ');
}
function proximoPasso(r) {
  if (r.status !== 'em_andamento') return '';
  const e = r.etapa || 2;
  return e <= 2 ? 'Resolver alertas e confirmar os dados do pedido' : e === 3 ? 'Lançar no sistema e conferir a grade' : 'Informar número e resultado da guia';
}
function filtrarRegs(regs) {
  const f = painelFiltro, q = norm(f.q);
  return regs.filter(r => {
    if (f.status && r.status !== f.status) return false;
    if (f.res && resultadoDe(r) !== f.res) return false;
    if (f.clinica && (r.clinicaId || '') !== f.clinica) return false;
    if (f.param === 'sim' && !r.parametrizado) return false;
    if (f.param === 'nao' && r.parametrizado) return false;
    if (q && !norm([r.carteira, r.guia, r.assunto, r.clinica, r.remetente, (r.itens || []).map(i => i.c).join(' ')].join(' ')).includes(q)) return false;
    return true;
  });
}
function csvRegistros(regs) {
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['dia', 'abertura', 'conclusao', 'clinica', 'remetente', 'guia_n', 'guias_no_email', 'carteira', 'itens', 'numero_guia', 'status', 'resultado', 'itens_nao_autorizados', 'motivo_nao_autorizacao', 'parametrizado', 'alertas', 'bloqueios', 'tentativas_conferencia', 'divergencias_conferencia', 'editado_a_mao', 'duracao_min', 'registrado_por', 'aberto_por', 'glosas_retiradas'];
  const linhas = regs.map(r => {
    const rs = r.resultado || {}, neg = (r.itens || []).filter(i => i.aut === false).map(i => i.c).join(' ');
    return [r.dia, fmtHora(r.abertoEm), r.concluidoEm ? fmtHora(r.concluidoEm) : '', r.clinica, r.remetente, (r.idxGuia ?? 0) + 1, r.totalGuias ?? 1, r.carteira, (r.itens || []).map(i => i.c + 'x' + (i.q ?? '?')).join(' '), r.guia, STATUS[r.status] || r.status, SIT_ROTULO[resultadoDe(r)] || '',
      neg, [motivoNome(rs.motivoId), rs.motivoTxt].filter(Boolean).join(' — '), r.parametrizado ? (r.parametrizado.origem || 'sim') : '', (r.alertas || []).map(a => (a.m || '') + ':' + (a.k || a.t)).join(' | '), (r.bloqueios || []).join(' | '),
      r.conferencia?.tentativas ?? '', (r.conferencia?.divergencias || []).map(d => d.join ? d.join('; ') : d).join(' | '), r.editadoAMao ? 'sim' : '', ((r.duracaoSeg || 0) / 60).toFixed(1), r.operador, r.abertoPor || '', ((rs.glosas || []).map(x => `${x.c}: ${x.g} — retirada: ${x.m}`).join(' | '))].map(c).join(';');
  });
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n');
}
async function renderPainel(app) {
  app.innerHTML = '<p class="muted">Carregando registros…</p>';
  const mes = painelModo === 'mes', sem = painelModo === 'semana', longo = mes || sem;
  if (longo) await Reg.carregarTudo(); else { const dif = Math.round((new Date() - new Date(painelDia + 'T12:00')) / 864e5); await Reg.carregar(Math.max(0, dif - HIST_DIAS) + 1); }
  await Param.carregar();
  const base = regsDoPeriodo();
  const todos = base.filter(r => !r.tipo).sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : -1));
  const regs = todos.filter(r => r.status !== 'descartado' && r.status !== 'devolvido');
  const ativos = regs.filter(r => r.status !== 'cancelado');
  const lista = filtrarRegs(regs);
  const n = fn => ativos.filter(fn).length;
  const concl = ativos.filter(r => r.status === 'concluido');
  const emails = unicos(ativos.map(r => r.atendimentoId || r.messageId)).length;
  const pegos = concl.filter(r => (r.conferencia?.divergencias || []).length).length;
  const tempo = concl.length ? (concl.reduce((s, r) => s + (r.duracaoSeg || 0), 0) / concl.length / 60).toFixed(1).replace('.', ',') + ' min' : '—';
  const porClinica = {}; ativos.forEach(r => { const k = r.clinicaId || r.clinica || 'sem'; (porClinica[k] = porClinica[k] || { nome: r.clinica || 'Clínica não identificada', id: r.clinicaId, n: 0 }).n++; });
  const maxC = Math.max(1, ...Object.values(porClinica).map(x => x.n));
  const clinicasDia = unicos(regs.map(r => r.clinicaId).filter(Boolean));
  const per = mes ? 'mês' : sem ? 'semana' : 'dia';
  app.innerHTML = `
  <div class="card"><div class="linha-flex">
    <div class="seg" role="radiogroup" aria-label="Visualização"><button type="button" role="radio" aria-checked="${!longo}" class="${!longo ? 'on igual' : ''}" data-act="painelModo" data-v="dia">${ic('calendar', 'sm')} Dia</button><button type="button" role="radio" aria-checked="${sem}" class="${sem ? 'on igual' : ''}" data-act="painelModo" data-v="semana">${ic('calendar', 'sm')} Semana</button><button type="button" role="radio" aria-checked="${mes}" class="${mes ? 'on igual' : ''}" data-act="painelModo" data-v="mes">${ic('layers', 'sm')} Mês</button></div>
    ${sem ? `<div><label class="lbl" for="painelSemana">Semana</label><input type="week" id="painelSemana" value="${painelSemana}" style="width:auto"></div>` : mes ? `<div><label class="lbl" for="painelMes">Mês</label><input type="month" id="painelMes" value="${painelMes}" style="width:auto"></div>` : `<div><label class="lbl" for="painelDia">Dia</label><input type="date" id="painelDia" value="${painelDia}" style="width:auto"></div>`}
    <button class="btn" data-act="atualizarPainel" style="align-self:flex-end">${ic('refresh')}Atualizar</button>
    <span style="flex:1"></span>
    <button class="btn line" data-act="exportarCsv" style="align-self:flex-end" ${lista.length ? '' : 'disabled'} title="Exporta as linhas exibidas na tabela (respeita os filtros)">${ic('download')}Exportar CSV (${lista.length})</button></div></div>
  <div class="kpis">${[
    ['info', emails, 'E-mails com atendimento', true], ['', ativos.length, 'Guias no ' + per, true],
    ['ok', n(r => resultadoDe(r) === 'autorizada'), 'Autorizadas'], ['warn', n(r => resultadoDe(r) === 'parcial'), 'Parcialmente autorizadas'], ['bad', n(r => resultadoDe(r) === 'nao'), 'Não autorizadas'],
    ['obs', n(r => resultadoDe(r) === 'sem_guia'), 'Sem guia gerada (pendência)'], ['info', n(r => r.status === 'em_andamento'), 'Em andamento'], ['ac', n(r => r.parametrizado), 'Parametrizadas'],
    ['bad', regs.filter(r => r.status === 'cancelado').length, 'Canceladas'], ['', pegos, 'Divergências pegas na conferência'], ['', concl.length ? tempo : 0, 'Tempo médio por guia']
  ].filter(k => k[3] || (k[1] && k[1] !== 0)).map(([c, v, t]) => `<div class="kpi ${c}"><b>${v}</b><span>${t}</span></div>`).join('')}
  </div>
  <div class="card"><div class="card-h"><h2>Guias por clínica</h2></div>
    ${Object.values(porClinica).sort((a, b) => b.n - a.n).map(x => { const cl = cfg.clinicas.find(c => c.id === x.id); return `<div class="barra-clinica idc ${cl ? corClinica(cl) : ''}"><div>${htmlClinica(cl, x.nome)}</div><div class="trilho"><i style="width:${Math.round(x.n / maxC * 100)}%"></i></div><b class="num">${x.n}</b></div>`; }).join('') || '<p class="muted">Sem registros neste período.</p>'}</div>
  <div class="card">
    <div class="card-h"><h2>Guias do ${per} (${lista.length}${lista.length !== regs.length ? ' de ' + regs.length : ''})</h2></div>
    <div class="filtros" style="margin-bottom:12px">
      <div><label class="lbl" for="fQ">Buscar</label><div class="busca">${ic('search', 'sm')}<input type="search" id="fQ" data-fp="q" value="${esc(painelFiltro.q)}" placeholder="Carteira, guia, clínica, código…"></div></div>
      <div><label class="lbl" for="fS">Status</label><select id="fS" data-fp="status"><option value="">Todos</option>${['em_andamento', 'concluido'].map(s => `<option value="${s}" ${painelFiltro.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></div>
      <div><label class="lbl" for="fR">Resultado</label><select id="fR" data-fp="res"><option value="">Todos</option>${Object.entries(SIT_ROTULO).map(([k, v]) => `<option value="${k}" ${painelFiltro.res === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label class="lbl" for="fC">Clínica</label><select id="fC" data-fp="clinica"><option value="">Todas</option>${clinicasDia.map(id => { const c = cfg.clinicas.find(x => x.id === id); return `<option value="${esc(id)}" ${painelFiltro.clinica === id ? 'selected' : ''}>${esc(c ? c.nome : id)}</option>`; }).join('')}</select></div>
      <div><label class="lbl" for="fP">Parametrização</label><select id="fP" data-fp="param"><option value="">Todas</option><option value="sim" ${painelFiltro.param === 'sim' ? 'selected' : ''}>Parametrizadas</option><option value="nao" ${painelFiltro.param === 'nao' ? 'selected' : ''}>Não parametrizadas</option></select></div>
      <div><button class="btn ghost" data-act="limparFiltros" ${Object.values(painelFiltro).some(Boolean) ? '' : 'disabled'}>${ic('x', 'sm')}Limpar filtros</button></div>
    </div>
    <div class="tabela-scroll"><table class="t"><thead><tr><th>${longo ? 'Data' : 'Hora'}</th><th>Clínica</th><th>Guia</th><th>Carteira</th><th>Serviços</th><th>Nº da guia</th><th>Status</th><th>Resultado</th><th>Observações</th><th></th></tr></thead><tbody>
    ${lista.map(r => {
      const tot = r.totalGuias || 1, canc = r.status === 'cancelado';
      return `<tr style="${canc ? 'opacity:.7' : ''}"><td class="c num">${longo ? fmtData(r.abertoEm) + '<br>' : ''}${fmtHora(r.abertoEm)}</td><td>${htmlClinica(cfg.clinicas.find(c => c.id === r.clinicaId), r.clinica || r.remetente)}${r.operador ? `<div style="margin-top:4px" title="Quem gerou">${htmlOperador(r.operador, r.operadorId)}</div>` : ''}</td>
      <td class="c">${tot > 1 ? `<span class="sq idc idc-${(r.idxGuia || 0) % 10}" title="Guia ${(r.idxGuia || 0) + 1} de ${tot}">${(r.idxGuia || 0) + 1}/${tot}</span>` : '—'}</td>
      <td class="num">${esc(r.carteira || '')}</td><td class="num">${(r.itens || []).map(i => `${i.c} × ${i.q ?? '?'}${i.aut === false ? ' <span class="tag bad">' + ic('x', 'sm') + 'negado</span>' : ''}`).join('<br>')}</td><td class="num"><b>${esc(r.guia || '')}</b></td>
      <td>${tagStatus(r.status)}${r.status === 'em_andamento' ? `<div class="proximo">${esc(proximoPasso(r))}</div>` : ''}</td>
      <td>${tagResultado(resultadoDe(r))}</td>
      <td>${obsCelula(r)}</td>
      <td class="c"><div class="linha-flex" style="justify-content:center;flex-wrap:wrap;gap:4px">${r.status === 'concluido' ? `<button class="btn sm line" data-act="corrigirGuia" data-id="${r.id}">Corrigir guia</button><button class="btn sm line" data-act="cancelarGuia" data-id="${r.id}">Cancelar guia</button>` : ''}<button class="btn sm dng" data-act="excluirGuia" data-id="${r.id}">Excluir guia</button></div></td></tr>`;
    }).join('') || `<tr><td colspan="10" class="muted">${regs.length ? 'Nenhuma guia corresponde aos filtros.' : 'Nenhum registro neste período.'}</td></tr>`}
    </tbody></table></div>
  </div>
  ${longo ? '' : `<div class="card">
    <div class="card-h"><h2>Amostragem do apoio</h2></div>
    <div class="acoes" style="margin-top:0"><button class="btn" data-act="sortear">${ic('refresh')}Sortear amostra</button></div>
    ${amostra ? `<div class="tabela-scroll" style="margin-top:10px"><table class="t"><thead><tr><th>Guia</th><th>Resultado</th><th>Carteira</th><th>Itens (código × qtd.)</th></tr></thead><tbody>${amostra.map(r => `<tr><td class="num">${esc(r.guia)}</td><td>${tagResultado(resultadoDe(r))}</td><td class="num">${esc(r.carteira)}</td><td class="num">${r.itens.map(i => i.c + ' × ' + i.q).join(' · ')}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div>
  <div class="card">
    <div class="card-h"><h2>Conciliação de fim de dia</h2></div>
    <div class="grid2">
      <div>
        <h3 style="margin-top:0">E-mails recebidos × registros</h3>
        <p class="dica">ZIP do SmarterMail ou vários .eml.</p>
        <input type="file" id="arqConc" accept=".zip,.eml" multiple>
      </div>
      <div>
        <h3 style="margin-top:0">Relatório de guias do sistema × registros</h3>
        <p class="dica">Cole o relatório de guias do dia.</p>
        <textarea id="txtRelatorio" rows="5"></textarea>
        <div class="acoes"><button class="btn" data-act="conciliarGuias">${ic('check')}Comparar guias</button></div>
      </div>
    </div>
    <div id="resConc">${conc || ''}</div>
  </div>`}`;
}
async function conciliarEmails(files) {
  const emails = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) { for (const x of await lerZip(await f.arrayBuffer())) if (/\.eml$/i.test(x.nome)) { try { emails.push(lerEml(x.dados)); } catch (e) { } } }
    else if (/\.eml$/i.test(f.name)) { try { emails.push(lerEml(await f.arrayBuffer())); } catch (e) { } }
  }
  emails.sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1);
  await Reg.carregar(7);
  const porMsg = {}; Reg.cache.filter(r => !r.tipo).forEach(r => (porMsg[r.messageId] = porMsg[r.messageId] || []).push(r));
  const semReg = [], naoConcl = [], varias = [];
  for (const e of emails) {
    const todos = porMsg[e.messageId] || [];
    const rs = todos.filter(r => r.status !== 'descartado');
    if (!todos.length) semReg.push(e);
    else if (!rs.length) continue;
    else if (!rs.some(r => ['concluido', 'aguardando_clinica'].includes(r.status))) naoConcl.push([e, rs]);
    else if (rs.some(r => r.status === 'em_andamento')) naoConcl.push([e, rs.filter(r => r.status === 'em_andamento')]);
    const porIdx = {}; rs.filter(r => r.status === 'concluido').forEach(r => (porIdx[r.idxGuia || 0] = porIdx[r.idxGuia || 0] || []).push(r));
    Object.values(porIdx).filter(x => x.length > 1).forEach(x => varias.push([e, x]));
  }
  const ehResposta = e => /^\s*(re|res)\s*:/i.test(e.assunto);
  const lin = (e, x) => `<li><b>${fmtHora(e.data)}</b> · ${esc(e.remetente.email)} · ${esc(e.assunto)}${x ? ' — ' + x : ''}</li>`;
  conc = `<h3>Resultado: ${emails.length} e-mail(s) lido(s)</h3>
  <p class="linha-flex"><span class="tag ${semReg.length ? 'bad' : 'ok'}">${ic(semReg.length ? 'alert' : 'check', 'sm')}${semReg.length} sem nenhum registro</span> <span class="tag ${naoConcl.length ? 'warn' : 'ok'}">${ic(naoConcl.length ? 'alert' : 'check', 'sm')}${naoConcl.length} com guia sem conclusão</span> <span class="tag ${varias.length ? 'bad' : 'ok'}">${ic(varias.length ? 'alert' : 'check', 'sm')}${varias.length} com a mesma guia concluída mais de uma vez</span></p>
  ${semReg.length ? `<p class="dica">Sem registro: não passaram pela página (podem ser respostas, evoluções ou pedidos esquecidos).</p><ul>${semReg.map(e => lin(e, ehResposta(e) ? 'resposta' : '')).join('')}</ul>` : ''}
  ${naoConcl.length ? `<p class="dica">Abertos mas não concluídos:</p><ul>${naoConcl.map(([e, rs]) => lin(e, rs.map(r => `guia ${(r.idxGuia || 0) + 1}: ${STATUS[r.status]}`).join(', '))).join('')}</ul>` : ''}
  ${varias.length ? `<p class="dica">Mesma guia do e-mail concluída mais de uma vez:</p><ul>${varias.map(([e, rs]) => lin(e, rs.map(r => r.guia + ' (' + r.operador + ')').join(', '))).join('')}</ul>` : ''}`;
  $('#resConc').innerHTML = conc;
}
function conciliarGuias() {
  const txt = $('#txtRelatorio').value.toUpperCase();
  const doRel = new Set([...txt.matchAll(/([TS])\s?(\d{8})/g)].map(m => m[1] + m[2]));
  const regs = Reg.doDia(painelDia).filter(r => !r.tipo && r.status === 'concluido');
  const daPag = new Set(regs.map(r => r.guia));
  const soRel = [...doRel].filter(g => !daPag.has(g)), soPag = regs.filter(r => !doRel.has(r.guia));
  conc = `<h3>Guias: ${doRel.size} no relatório · ${daPag.size} na página</h3>
  <p class="linha-flex"><span class="tag ${soRel.length ? 'bad' : 'ok'}">${ic(soRel.length ? 'alert' : 'check', 'sm')}${soRel.length} só no relatório</span> <span class="tag ${soPag.length ? 'bad' : 'ok'}">${ic(soPag.length ? 'alert' : 'check', 'sm')}${soPag.length} só na página</span></p>
  ${soRel.length ? `<p class="dica">Guias geradas no sistema sem conferência registrada na página:</p><p class="num">${soRel.join(' · ')}</p>` : ''}
  ${soPag.length ? `<p class="dica">Registradas na página mas ausentes no relatório (número digitado errado?):</p><ul>${soPag.map(r => `<li class="num">${esc(r.guia)} — ${esc(r.operador)} · ${esc(r.clinica || '')} · ${esc(r.carteira)}</li>`).join('')}</ul>` : ''}`;
  $('#resConc').innerHTML = conc;
}

/* ====================================================================
   Aba Ações: onde está cada guia (lendo o pedido, gerando guia, anexando e-mail)
   ==================================================================== */
async function renderQuadro(app) {
  app.innerHTML = '<p class="muted">Carregando…</p>';
  await Reg.carregar();
  const hoje = isoDia(new Date());
  const mapa = new Map();
  const lim = cfg.preferencias.acoesMinutos, idade = r => (Date.now() - new Date(r.atualizadoEm || r.abertoEm)) / 60000;
  Reg.doDia(hoje).filter(r => !r.tipo && r.status === 'em_andamento' && (!lim || idade(r) <= lim)).forEach(r => mapa.set(r.id, r));
  if (S) S.guias.filter(g => !guiaTerminal(g)).forEach(g => mapa.set(g.id, montarRegistro(g, 'em_andamento')));   // o que está aberto aqui vale mais que o arquivo
  const lista = [...mapa.values()].sort((a, b) => ((a.atualizadoEm || '') < (b.atualizadoEm || '') ? 1 : -1));
  const cols = [
    [2, 'Lendo o pedido', 'search', 'Pedido e alertas (etapas 1 e 2)'],
    [3, 'Gerando guia', 'filecheck', 'Guia e conferência (etapa 3)'],
    [4, 'Anexando e-mail', 'mail', 'Finalizar: observação e resposta (etapa 4)']
  ];
  const col = r => { const v = r.vista || r.etapa || 2; return v <= 2 ? 2 : v >= 4 ? 4 : 3; };
  app.innerHTML = `<div class="card"><div class="card-h"><h2>Ações em andamento hoje</h2><span class="tag ${lista.length ? 'info' : 'ok'}">${ic(lista.length ? 'clip' : 'check', 'sm')}${lista.length ? lista.length + ' guia(s)' : 'Nada em andamento'}</span><span class="esp"></span><span class="muted" style="font-size:var(--fs-sm)">${diaBR(hoje)}</span><button class="btn sm line" data-act="atualizarQuadro">${ic('refresh', 'sm')}Atualizar</button></div>
    <p class="dica" style="margin:0">Paciente × clínica de cada guia aberta, na etapa em que está.${lim ? ` Some da lista após ${lim} min sem movimento.` : ''}</p></div>
  <div class="quadro">${cols.map(([n, t, i, d]) => { const its = lista.filter(r => col(r) === n);
    return `<section class="col-q"><h3>${ic(i)}${t} <span class="tag">${its.length}</span></h3><p class="dica" style="margin:-6px 0 10px">${d}</p>
    ${its.map(r => { const cl = cfg.clinicas.find(c => c.id === r.clinicaId), min = Math.max(0, Math.round((Date.now() - new Date(r.atualizadoEm || r.abertoEm)) / 60000));
      return `<div class="card-q"><div class="t1">${esc(r.paciente || r.pacienteIni || 'Paciente')} <span class="muted">×</span> ${htmlClinica(cl, r.clinica || r.remetente)}</div>
      <div class="proximo">${(r.totalGuias || 1) > 1 ? `Guia ${(r.idxGuia || 0) + 1} de ${r.totalGuias} · ` : ''}<span class="num">${esc(r.carteira || 'sem carteira')}</span> · ${(r.itens || []).length} item(ns) · ${min < 1 ? 'agora' : 'há ' + min + ' min'}</div>
      <div class="linha-flex" style="margin-top:6px">${htmlOperador(r.operador, r.operadorId)}</div></div>`; }).join('') || '<p class="muted" style="font-size:var(--fs-sm)">Nenhuma guia nesta etapa.</p>'}</section>`; }).join('')}</div>`;
}

/* ====================================================================
   Configurações (seções) — rascunho em cfgEdit, salvo só ao clicar em Salvar
   ==================================================================== */
let cfgEdit = null, cfgSecao = 'aparencia', cfgDirty = false, cfgErros = [], cfgClinicaSel = 0;
const cfgModeloSel = { modelos: 'autorizada', obs: 'observacao', param: 'parametrizacao' };
const CFG_SECOES = [
  ['aparencia', 'palette', 'Aparência'], ['perfil', 'user', 'Perfil e identificação'], ['clinicas', 'building', 'Clínicas e cadastros'],
  ['modelos', 'mail', 'Modelos de e-mail'], ['obs', 'message', 'Modelo de observação da guia'], ['param', 'layers', 'Parametrizações'],
  ['alertas', 'bell', 'Alertas e regras de validação'], ['export', 'download', 'Exportação'], ['prefs', 'sliders', 'Preferências operacionais'], ['info', 'info', 'Informações e versão do sistema']
];
let cfgOpsIni = [];
function iniciarCfgEdit() {
  cfgEdit = clonar(cfg); cfgOpsIni = cfg.operadores.map(o => o.id); cfgDirty = false; cfgErros = [];
  cfgEdit.clinicas.forEach(cl => { cl._lista = Object.entries(cl.codigos || {}).map(([c, d]) => ({ c, d })).sort((a, b) => a.c < b.c ? -1 : 1); });
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
  app.innerHTML = `<div class="cfg"><nav class="card cfg-nav" aria-label="Seções de configuração">${CFG_SECOES.map(([k, i, t]) => `<button data-act="cfgSecao" data-s="${k}" class="${cfgSecao === k ? 'ativo' : ''}" ${cfgSecao === k ? 'aria-current="true"' : ''}>${ic(i)}${t}</button>`).join('')}</nav>
    <div id="cfgCorpo">${nErr ? `<div class="erros-cfg" role="alert"><b>${ic('alert', 'sm')} Não foi possível salvar. Corrija os itens abaixo:</b><ul>${cfgErros.map(e => `<li>${esc(e.m)} <a href="#" data-act="cfgSecao" data-s="${e.s}">(ir para ${esc(CFG_SECOES.find(x => x[0] === e.s)[2])})</a></li>`).join('')}</ul></div>` : ''}${htmlCfgSecao()}</div></div>
    <div class="cfg-barra" id="cfgBarra"><span id="cfgEstado"></span><span class="esp"></span>
      <button class="btn" id="cfgDescartar" data-act="descartarCfg">${ic('undo')}Descartar alterações</button>
      <button class="btn pri" id="cfgSalvar" data-act="salvarCfg">${ic('save')}Salvar configurações</button></div>`;
  atualizarBarraCfg();
  if (cfgSecao === 'modelos' || cfgSecao === 'obs' || cfgSecao === 'param') montarEditorModelo();
}
function htmlCfgSecao() {
  switch (cfgSecao) {
    case 'aparencia': return cfgAparencia();
    case 'perfil': return cfgPerfil();
    case 'clinicas': return cfgClinicas();
    case 'modelos': return cfgModelos('modelos', k => MODELOS_META[k].destino === 'email', 'Modelos de e-mail', 'Textos das respostas enviadas às clínicas. Aceitam negrito, itálico, cor, listas e campos dinâmicos.');
    case 'obs': return cfgModelos('obs', k => ['observacao', 'obs_parametrizado'].includes(k), 'Modelo de observação da guia', 'Textos do campo de observação da guia no sistema oficial. São copiados como texto simples.');
    case 'param': return cfgParam();
    case 'alertas': return cfgAlertas();
    case 'export': return cfgExport();
    case 'prefs': return cfgPrefs();
    case 'info': return cfgInfo();
  }
  return '';
}
const cabSecao = (t, d) => `<div class="card-h"><h2>${t}</h2></div>`;

/* ---------- 1. Aparência ---------- */
function cfgAparencia() {
  const p = Tema.pref();
  const op = (v, i, t, d) => `<button type="button" class="sit ${p === v ? 'on autorizada' : ''}" role="radio" aria-checked="${p === v}" data-act="setTema" data-v="${v}">${ic(i, 'lg')}<span><b>${t}</b></span></button>`;
  return `<div class="card">${cabSecao('Aparência', 'Vale para este computador e é lembrada ao reabrir o sistema. Também pode ser alternada pelo botão no topo da página.')}
    <div class="sit-opcoes" role="radiogroup" aria-label="Tema">${op('auto', 'settings', 'Automático', 'Acompanha o tema do Windows.')}${op('claro', 'sun', 'Modo claro', 'Fundo claro, ideal para ambientes iluminados.')}${op('escuro', 'moon', 'Modo escuro', 'Fundo escuro, reduz o brilho da tela.')}</div>
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
    <div class="linha-flex"><div class="busca" style="flex:1;min-width:150px"><span class="sr"><label for="buscaCl">Buscar clínica</label></span>${ic('search', 'sm')}<input type="search" id="buscaCl" placeholder="Nome, cidade, e-mail ou código" data-filtro="cl"></div><button class="btn sm pri" data-act="clNova">${ic('plus', 'sm')}Nova clínica</button></div>
    <div class="lista-cl" id="listaCl">${cls.map((c, i) => `<button class="cl-item idc ${corClinica(c)} ${i === cfgClinicaSel ? 'ativa' : ''}" data-act="clSel" data-i="${i}" data-busca="${esc(norm([c.nome, c.cidade, c.emails.join(' '), Object.keys(c.codigos || {}).join(' '), c.apelidos].join(' ')))}"><span class="sq">${esc(iniciais(c.nome))}</span><span><span class="n" data-eco="clinicas.${i}.nome">${esc(c.nome || 'Sem nome')}</span><br><span class="s">${esc(c.cidade || 'Cidade não informada')} · ${c.emails.length} e-mail(s) · ${c._lista.filter(x => x.c).length} código(s)</span></span></button>`).join('') || '<p class="muted">Nenhuma clínica cadastrada.</p>'}</div>
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
    </div>
    <h3>E-mails do remetente</h3>
    <div class="chips-e">${cl.emails.map((e, j) => `<span class="chip-e">${esc(e)}<button data-act="clRemEmail" data-i="${i}" data-j="${j}" aria-label="Remover ${esc(e)}" title="Remover">${ic('x', 'sm')}</button></span>`).join('') || '<span class="muted" style="font-size:var(--fs-sm)">Nenhum e-mail cadastrado. Ao receber um pedido de remetente desconhecido, é possível vincular o e-mail à clínica na hora.</span>'}</div>
    <div class="linha-flex"><input type="email" id="novoEmail" placeholder="contato@clinica.com.br" style="flex:1;min-width:200px;width:auto" aria-label="Novo e-mail" data-enter="clAddEmail" data-i="${i}"><button class="btn line" data-act="clAddEmail" data-i="${i}">${ic('plus', 'sm')}Adicionar e-mail</button></div>
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
function cfgPrefs() {
  const p = cfgEdit.preferencias;
  return `<div class="card">${cabSecao('Preferências operacionais')}
    <div class="stack">
      <label class="switch"><input type="checkbox" data-cfg="preferencias.conferenciaCega" ${p.conferenciaCega ? 'checked' : ''}><span><b>Exigir a conferência cega antes de finalizar</b></span></label>
      <div style="max-width:300px"><label class="lbl" for="pAcoes">Limpar da aba Ações após (minutos sem movimento; 0 = não limpar)</label><input type="number" id="pAcoes" min="0" max="1440" data-cfg="preferencias.acoesMinutos" value="${p.acoesMinutos}"></div>
      <div style="max-width:300px"><label class="lbl" for="pQtd">Quantidade máxima por serviço</label><input type="number" id="pQtd" min="1" max="99" data-cfg="preferencias.qtdMax" value="${p.qtdMax}"></div>
      <label class="switch"><input type="checkbox" data-cfg="preferencias.obsParametrizadoAuto" ${p.obsParametrizadoAuto ? 'checked' : ''}><span><b>Pré-selecionar o texto de “atendimento parametrizado”</b></span></label>
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
    <button class="btn dng" data-act="limparAntigos">${ic('trash')}Apagar registros com mais de 180 dias</button></div>`;
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
    <dt>Dados guardados</dt><dd>Registros: carteira, códigos, quantidades, número e resultado da guia. Sem nome do beneficiário, CID ou médico. Parametrizações incluem o nome do médico informado por você.</dd></dl></div>`;
}

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
/* Webmail (extensão): o e-mail aberto fica "oferecido" numa barra; o operador decide quando abrir */
let webmailOferta = null;
function pintarOfertaWebmail() {
  const el = document.getElementById('barraWebmail'); if (!el) return;
  const e = webmailOferta, aberto = e && S && S.email && S.email.messageId === e.messageId;
  if (!e || aberto) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<span class="tag info">${ic('mail', 'sm')}Webmail</span><span class="bw-txt" title="${esc(e.assunto)}">${esc(e.assunto || '(sem assunto)')}</span><span class="bw-de muted">${esc(e.remetente.nome || e.remetente.email)}</span><button class="btn pri sm" data-act="abrirWebmail">${ic('filecheck', 'sm')}Abrir no conferidor</button>`;
}
function ofertarWebmail(m) { try { webmailOferta = emailDeWebmail(m); } catch (e) { console.error(e); return; } pintarOfertaWebmail(); }
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
function resumoUltimo(g) { const cl = clinicaDe(S); if (g.semGuia) return `Sem guia gerada (${nomeModelo(g.semGuia)}) · ${cl ? cl.nome : S.email.remetente.email}`; return `${g.numero || 'sem número'} — ${SIT_ROTULO[g.resultado.situacao] || STATUS[g.status]} · ${g.pedido.itens.length} item(ns), ${cl ? cl.nome : S.email.remetente.email}`; }
async function depoisDeGuiaTratada(g, texto) {
  ultimoConcluido = { texto, em: agora() }; LS.set('ultimo', ultimoConcluido);
  if (S.guias.length === 1) { finalizarAtendimento(texto); return; }
  const prox = S.guias.findIndex(x => !guiaTerminal(x));
  if (prox >= 0) { S.ativa = prox; S.vista = Math.max(2, S.guias[prox].vista || 2); toast('Guia registrada. Seguindo para a próxima.'); }
  else { S.vista = 1; toast('Todas as guias deste e-mail foram processadas.'); }
  persistir(); render(); window.scrollTo(0, 0);
}
function mudarVista(v) {
  const g = guiaAtiva(); S.vista = v;
  if (v >= 2) { g.vista = v; g.etapa = Math.max(g.etapa, v); if (g.status === 'em_andamento') gravarGuia(g, 'em_andamento'); }
  persistir(); render(); window.scrollTo(0, 0);
}
const alterarCampoGuia = (g, campo, v) => {
  const p = g.pedido; v = v.trim();
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
function estadoCopiaBtn(b, ok) { b.classList.toggle('copiado', ok); b.innerHTML = ok ? `${ic('check', 'sm')}` : `${ic('copy', 'sm')}`; }

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
      await carregarConfig(); await Param.carregar(); await Reg.carregar(); cfgEdit = null; cfgDirty = false; render();
      toast(Pasta.ok ? 'Pasta conectada.' : 'Permissão não concedida.', Pasta.ok ? '' : 'bad');
    } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível usar a pasta: ' + e.message, 'bad'); }
  },
  async abrirWebmail() { if (!webmailOferta) return; if (!operador()) { toast('Escolha o operador no topo da página.', 'bad'); return; } if (S && !confirm('Há um atendimento aberto. Abrir o e-mail do webmail no lugar dele?\n(o atendimento atual continua salvo como em andamento)')) return; aba = 'atend'; try { await iniciar(webmailOferta); } catch (e) { console.error(e); toast('Não consegui abrir esse e-mail: ' + e.message, 'bad'); } pintarOfertaWebmail(); },
  usarMedicoAnterior() { const g = guiaAtiva(); g.pedido.medico = lerMedico(LS.get(chaveMedico(), '')); persistir(); render(); toast('Médico preenchido com o do último pedido deste remetente. Confira no anexo.'); },
  topoMini() { LS.set('topoMini', !LS.get('topoMini', false)); render(); },
  alternarTema() { Tema.alternar(); render(); },
  setTema(b) { Tema.definir(b.dataset.v); render(); },
  fecharModal() { fecharModal(); },
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
    if (v === 3 && !st.pode) { toast('Resolva os bloqueios antes de seguir.', 'bad'); return; }
    if (v === 4 && g.status !== 'concluido' && !podeFinal(g, st)) { toast('Conclua a conferência antes de finalizar.', 'bad'); return; }
    if (v >= 3 && g.status !== 'concluido') gravarGuia(g, g.status);
    mudarVista(v);
  },
  async descartar() {
    if (!confirm('Descartar este e-mail? Use para mensagens que não são pedidos (evoluções, avisos, arquivo errado). As guias já concluídas são mantidas.')) return;
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
  encerrar() { finalizarAtendimento(S.guias.length > 1 ? `${S.guias.filter(g => g.status === 'concluido').length} guia(s) concluída(s) — ${clinicaDe(S) ? clinicaDe(S).nome : S.email.remetente.email}` : resumoUltimo(S.guias[0])); },

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
    p.invalidos = it.filter(x => x.codigo.length !== 8).map(x => x.codigo);
    p.itens = it.filter(x => x.codigo.length === 8).map(x => ({ codigo: x.codigo, desc: x.desc, qtd: /^\d+$/.test(x.qtd) ? Number(x.qtd) : null, origemQtd: 'manual' }));
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
    const id = M.id; if (!confirm('Excluir esta parametrização? Os próximos atendimentos deixam de usá-la.')) return;
    await Param.remover(id); if (S) S.guias.forEach(g => { if (g.param && g.param.id === id) g.param = null; });
    fecharModal(true); persistir(); render(); toast('Parametrização excluída.');
  },

  /* ---- etapa 3: cópia de campos e itens ---- */
  async copiarCampo(b) {
    const g = guiaAtiva(), campo = b.dataset.campo, el = $('#' + b.dataset.ref), v = (el ? el.value : '').trim();
    if (!v) { toast('O campo está vazio: não há nada para copiar.', 'bad'); return; }
    if (!(await copiar(v))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    g.copiados[campo] = v; persistir(); estadoCopiaBtn(b, true); toast('Copiado: ' + v);
  },
  async copiarItem(b) {
    const g = guiaAtiva(), it = g.pedido.itens.find(x => x.codigo === b.dataset.codigo); if (!it) return;
    const v = b.dataset.tipo === 'c' ? it.codigo : String(it.qtd);
    if (!(await copiar(v))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    g.copiados[b.dataset.tipo + ':' + it.codigo] = v; persistir(); estadoCopiaBtn(b, true); toast('Copiado: ' + v);
  },
  iniciarCega() { const g = guiaAtiva(); g.cega.iniciada = true; g.cega.tentativas = Math.max(1, g.cega.tentativas); persistir(); render(); setTimeout(() => $('#cegaN')?.focus(), 30); },
  verItens() { const g = guiaAtiva(); g.cega = { ...g.cega, iniciada: false, linhas: '', entradas: [], resultado: null, ok: false }; persistir(); render(); },
  conferir() {
    const g = guiaAtiva(), n = parseInt(g.cega.linhas, 10);
    if (!(n >= 0)) { toast('Informe quantas linhas a grade tem.', 'bad'); return; }
    const r = compararCega(g.pedido.itens, n, g.cega.entradas);
    g.cega.resultado = r; g.cega.ok = r.ok;
    if (!r.ok && !r.incompleto) g.cega.historico.push([...r.erros, ...r.porItem.filter(x => x.st !== 'ok').map(x => `${x.st}:${x.it.codigo}${x.informado ? '=' + x.informado : ''}`), ...r.extras.map(x => 'indevida:' + x.fim)]);
    persistir(); render();
  },
  refazerCega() { const g = guiaAtiva(); g.cega.tentativas++; g.cega.resultado = null; g.cega.entradas = []; g.cega.linhas = ''; persistir(); render(); setTimeout(() => $('#cegaN')?.focus(), 30); },

  /* ---- etapa 4: resultado, observação e resposta ---- */
  setGlosa(b) { const g = guiaAtiva(), gl = glosaDe(g); gl.resp = b.dataset.v; if (gl.resp === 'nao') gl.itens = {}; persistir(); render(); },
  setSit(b) { const g = guiaAtiva(), r = g.resultado; r.situacao = b.dataset.v; if (r.situacao !== 'parcial') r.naoAut = {}; if (r.situacao === 'nao') glosaDe(g).itens = {}; g.respEdit = null; persistir(); render(); },
  async copiarEmail(b) {
    const g = guiaAtiva(), v = $('#emailPrest').value.trim();
    if (!emailValido(v)) { toast('Informe um e-mail de prestador válido para copiar.', 'bad'); return; }
    if (!(await copiar(v))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    g.copiados.email = v; persistir(); estadoCopiaBtn(b, true); toast('E-mail copiado: ' + v);
  },
  async copiarObs(b) {
    const g = guiaAtiva(), v = $('#txtObs').value;
    if (!(await copiar(v))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    g.copiados.obs = v; persistir(); b.classList.add('copiado'); b.innerHTML = `${ic('check', 'sm')}`; toast('Observação copiada (texto simples).');
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
    if (!r) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    g.copiados.resp = true; persistir(); render(); toast(r === 'rico' ? 'Resposta copiada com formatação.' : 'O navegador só permitiu copiar texto simples (sem formatação).', r === 'rico' ? '' : 'bad');
  },
  async copiarRespSimples() {
    const g = guiaAtiva(), texto = htmlPlano(serializarEditor($('#edResp')));
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    if (!(await copiar(texto))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
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
    const r = await copiarRico(htmlParaEmail(html), texto); if (!r) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
    M.copiou = true;
    $('#modalEstado').innerHTML = `${ic('check', 'sm')} ${r === 'rico' ? 'Copiado com formatação.' : 'Copiado como texto simples (o navegador não permitiu formatação).'}`; toast(r === 'rico' ? 'Copiado com formatação.' : 'Copiado como texto simples.');
  },
  async copiarModalSimples() {
    const texto = htmlPlano(serializarEditor($('#edModal')));
    if (!texto) { toast('O texto está vazio.', 'bad'); return; }
    if (/\{[A-Z_]+\}/.test(texto) && !confirm('Ainda há campos sem valor (entre chaves) no texto. Copiar mesmo assim?')) return;
    if (!(await copiar(texto))) { toast('Não foi possível copiar. Tente novamente.', 'bad'); return; }
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
    const motivo = prompt(`Cancelar a guia ${r.guia || ''}? Informe o motivo (opcional) e confirme:`, '');
    if (motivo === null) return;
    const novo = clonar(r); novo.status = 'cancelado'; novo.canceladoEm = agora(); novo.canceladoPor = operador(); novo.canceladoMotivo = motivo.trim(); novo.atualizadoEm = agora();
    await Reg.salvar(novo); Reg.mesclarHist([novo]); render(); toast('Guia cancelada.');
  },
  async excluirGuia(b) {
    const r = regPorId(b.dataset.id); if (!r) return;
    if (!confirm(`Excluir definitivamente o registro${r.guia ? ' da guia ' + r.guia : ''}? Esta ação não pode ser desfeita.`)) return;
    await Reg.excluir(r.id); render(); toast('Registro excluído.');
  },
  sortear() {
    const c = Reg.doDia(painelDia).filter(r => !r.tipo && r.status === 'concluido');
    const emb = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    amostra = [...emb(c.filter(r => r.itens.length >= 4)), ...emb(c.filter(r => r.itens.length < 4))].slice(0, 10); render();
  },
  conciliarGuias() { conciliarGuias(); },
  /* ---- configurações: navegação e salvamento ---- */
  cfgSecao(b) { cfgSecao = b.dataset.s; render(); window.scrollTo(0, 0); },
  async salvarCfg() {
    prepararSalvar(cfgEdit); cfgErros = validarCfg(cfgEdit);
    if (cfgErros.length) { await render(); window.scrollTo(0, 0); toast(`${cfgErros.length} problema(s) encontrado(s). Nada foi salvo.`, 'bad'); return; }
    try {
      await mesclarOperadoresDaPasta(cfgEdit);
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
    baixar(nomeArquivo('Registros_' + diaBR(ini).replace(/\//g, '-') + '_a', fim, 'csv'), csvRegistros(regs), 'text/csv;charset=utf-8'); toast(`${regs.length} linha(s) exportada(s).`);
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
  clNova() { cfgEdit.clinicas.push({ id: 'nova-' + Date.now().toString(36), nome: '', cidade: '', executante: '', emails: [], apelidos: '', codigos: {}, _lista: [] }); cfgClinicaSel = cfgEdit.clinicas.length - 1; marcarSujo(); render(); setTimeout(() => $('#cl-nome')?.focus(), 30); },
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
    cl._lista.sort((a, b) => a.c < b.c ? -1 : 1); fecharModal(true); if (add || upd) marcarSujo(); render(); toast(`${add} código(s) adicionado(s), ${upd} atualizado(s). Salve para gravar.`);
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
    cl._lista.sort((a, b) => a.c < b.c ? -1 : 1); fecharModal(true); if (n) marcarSujo(); render(); toast(`${n} código(s) adicionado(s). Salve para gravar.`);
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
  abrirModal({ titulo: 'Nova parametrização', sub: 'Referência para os próximos atendimentos', icone: 'layers', tamanho: 'g', corpo: htmlModalParam(), rodape: `<span style="flex:1"></span><button class="btn" data-act="fecharModal">Cancelar</button><button class="btn pri" data-act="pmSalvar">${ic('save')}Salvar parametrização</button>` });
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
  if (t.id === 'txtObs') { g.obsEdit = t.value; persistir(); const bt = $('[data-act=copiarObs]'); if (bt && bt.classList.contains('copiado') && g.copiados.obs !== t.value) { bt.classList.remove('copiado'); bt.innerHTML = `${ic('copy', 'sm')}Copiar observação (texto simples)`; } return; }
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
  if (t.id === 'arquivoEml') { const f = t.files[0]; t.value = ''; if (f) abrirArquivo(f); return; }
  if (t.id === 'arqConc') { try { await conciliarEmails([...t.files]); } catch (err) { toast('Erro ao ler: ' + err.message, 'bad'); } return; }
  if (t.id === 'painelDia' || t.id === 'painelMes' || t.id === 'painelSemana') { acoes.atualizarPainel(); return; }
  if (t.id === 'impCfg') {
    const f = t.files[0]; if (!f) return;
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
  if (t.dataset.conf) { g.conf = g.conf || {}; g.conf[t.dataset.conf] = t.checked; persistir(); render(); return; }
  if (t.dataset.campo) {
    const k = t.dataset.campo, v = t.value.trim(), p = g.pedido;
    if (k === 'medico') p.medico = lerMedico(v); else if (k === 'emissao') p.emissao = lerEmissao(v, S.email.data); else if (k === 'cid') p.cid = v.toUpperCase(); else if (k === 'beneficiario') { p.beneficiario = v; p.beneficiarios = v ? [v] : []; } else p[k] = v;
    g.itensEditados = true; persistir(); render(); return;
  }
  if (t.id === 'cartUsada') { g.carteiraUsada = normCart(t.value); persistir(); render(); return; }
  if (t.dataset.cpcampo) { g.itensEditados = true; persistir(); return; }
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

// Ao voltar para a janela, relê o config.json da pasta (operadores e senhas de colegas) se não houver edição em curso
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !Pasta.ok || cfgDirty || M) return;
  try { const antes = JSON.stringify(cfg.operadores); await carregarConfig(); if (JSON.stringify(cfg.operadores) !== antes) { if (cfgEdit) iniciarCfgEdit(); render(); } } catch (e) { }
});

// Botões secundários viram só ícone (o texto vai para dica e leitor de tela)
const ROT_ICONE = /^(Copiar.*|Atualizar|Lista|Numerada|Limpar formatação|Corrigir guia|Cancelar guia|Excluir guia|Sortear amostra|Incluir observação|Exportar CSV.*|Baixar config\.json|Limpar filtros|Ver ou editar|Descartar.*|Remover.*|Adicionar.*)$/;
function soIcone(raiz) {
  raiz.querySelectorAll('.btn:not(.so):not(.pri)').forEach(b => {
    if (!b.querySelector('svg.ic')) return;
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if (!t || !ROT_ICONE.test(t)) return;
    b.classList.add('so'); if (!b.title) b.title = t; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', t);
  });
}
function iniciarSoIcone() {
  const alvos = ['#app', '#modalRoot'].map(s => document.querySelector(s)).filter(Boolean);
  const mo = new MutationObserver(() => alvos.forEach(soIcone));
  alvos.forEach(a => { mo.observe(a, { childList: true, subtree: true }); soIcone(a); });
}

async function init() {
  iniciarSoIcone();
  Tema.aplicar();
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
  const hoje = new Date();
  $('#printData').textContent = 'Emitido em ' + fmtData(hoje) + ', ' + fmtHora(hoje) + ' · Criado por Alexandre Neves';
  $('#anoRodape').textContent = hoje.getFullYear();
  await Pasta.init();
  await carregarConfig();
  await Param.carregar();
  await Reg.carregar();
  S = LS.get('atual', null);
  if (S && S.v !== 2) S = null;
  render();
}
init();
