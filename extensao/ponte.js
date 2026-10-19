/* Webmail (mundo isolado): recebe o e-mail visto pelo captura-main.js e mostra o botão flutuante "Abrir no conferidor".
   O clique é a única ação: nada é aberto, respondido ou enviado sem ele. */
(function () {
  let msg = null, host = null, raiz = null, timer = null;
  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function montar() {
    if (host) return;
    host = document.createElement('div'); host.id = 'conferidor-flutuante';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646';
    raiz = host.attachShadow({ mode: 'closed' });
    raiz.innerHTML = `<style>
      .cx{display:flex;align-items:stretch;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;border-radius:12px;box-shadow:0 6px 20px rgba(15,23,42,.35);overflow:hidden}
      button{all:unset;cursor:pointer;box-sizing:border-box}
      .abrir{display:flex;align-items:center;gap:9px;background:#2c4a70;color:#fff;padding:9px 14px;max-width:280px}
      .abrir:hover{background:#233c5c}.abrir:focus-visible{outline:2px solid #3aae9c;outline-offset:-2px}
      .tx{display:flex;flex-direction:column;gap:2px;min-width:0}.tx b{font-weight:700}
      .tx small{font-weight:500;opacity:.8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .fechar{background:#233c5c;color:#cbd5e1;padding:0 10px;display:flex;align-items:center;font-size:16px}
      .fechar:hover{background:#1e3350;color:#fff}
      .ok .abrir{background:#16a34a}.erro .abrir{background:#b91c1c}
    </style><div class="cx" id="cx"><button class="abrir" id="abrir" title="Abrir este e-mail no Conferidor de Guias">${ICONE}<span class="tx"><b id="t1">Abrir no conferidor</b><small id="t2"></small></span></button><button class="fechar" id="fechar" title="Ocultar" aria-label="Ocultar">×</button></div>`;
    raiz.getElementById('abrir').addEventListener('click', clicar);
    raiz.getElementById('fechar').addEventListener('click', () => { host.style.display = 'none'; });
    document.documentElement.appendChild(host);
  }
  function estado(cls, t1, t2) {
    const cx = raiz.getElementById('cx'); cx.className = 'cx ' + (cls || '');
    raiz.getElementById('t1').textContent = t1; raiz.getElementById('t2').textContent = t2 || '';
    clearTimeout(timer); if (cls) timer = setTimeout(() => estado('', 'Abrir no conferidor', msg ? (msg.assunto || '') : ''), 4500);
  }
  function clicar() {
    if (!msg) return;
    try {
      chrome.runtime.sendMessage({ tipo: 'abrir', msg }, r => {
        if (chrome.runtime.lastError) { estado('erro', 'Recarregue a página (F5)', 'A extensão foi atualizada.'); return; }
        if (r && r.ok) estado('ok', 'Aberto no conferidor', 'Veja a aba do Conferidor de Guias.');
        else if (r && r.motivo === 'sem-url') estado('erro', 'Abra o Conferidor antes', 'Abra o site do Conferidor numa aba uma vez e tente de novo.');
        else estado('erro', 'Não consegui abrir', (r && r.motivo) || '');
      });
    } catch (e) { estado('erro', 'Recarregue a página (F5)', 'A extensão foi atualizada.'); }
  }
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data; if (!d || d.__conferidor !== 'msg' || !d.msg) return;
    msg = d.msg;
    const mostrar = () => { montar(); host.style.display = ''; estado('', 'Abrir no conferidor', msg.assunto || ''); };
    if (document.documentElement) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar, { once: true });
  });
})();
