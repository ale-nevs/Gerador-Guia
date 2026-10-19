/* Service worker: leva o e-mail do webmail para a aba do Conferidor de Guias (abre uma aba se necessário). */
const REG = 'conferidores';
const lerReg = async () => (await chrome.storage.session.get(REG))[REG] || {};
const gravarReg = r => chrome.storage.session.set({ [REG]: r });
const espera = ms => new Promise(r => setTimeout(r, ms));

async function abaDoConferidor() {
  const reg = await lerReg(); const ids = Object.keys(reg).sort((a, b) => reg[b] - reg[a]);
  for (const id of ids) { try { const t = await chrome.tabs.get(+id); if (t) return t; } catch (e) { delete reg[id]; } }
  await gravarReg(reg); return null;
}
async function entregar(msg) {
  let aba = await abaDoConferidor();
  if (!aba) {
    const { urlConferidor } = await chrome.storage.local.get('urlConferidor');
    if (!urlConferidor) return { ok: false, motivo: 'sem-url' };
    await chrome.tabs.create({ url: urlConferidor });
    for (let i = 0; i < 40 && !aba; i++) { await espera(250); aba = await abaDoConferidor(); }
    if (!aba) return { ok: false, motivo: 'O Conferidor não carregou a tempo.' };
  }
  await chrome.tabs.sendMessage(aba.id, { tipo: 'entregar', msg });
  await chrome.tabs.update(aba.id, { active: true });
  try { await chrome.windows.update(aba.windowId, { focused: true }); } catch (e) { }
  return { ok: true };
}
chrome.runtime.onMessage.addListener((m, sender, responder) => {
  if (!m) return;
  if (m.tipo === 'conferidor-pronto' && sender.tab) {
    (async () => {
      const reg = await lerReg(); reg[sender.tab.id] = Date.now(); await gravarReg(reg);
      try { const u = new URL(sender.tab.url); await chrome.storage.local.set({ urlConferidor: u.origin + u.pathname }); } catch (e) { }
    })();
    return;
  }
  if (m.tipo === 'abrir' && m.msg) { entregar(m.msg).then(responder).catch(e => responder({ ok: false, motivo: String(e && e.message || e) })); return true; }
});
chrome.action.onClicked.addListener(async () => {
  const aba = await abaDoConferidor();
  if (aba) { await chrome.tabs.update(aba.id, { active: true }); try { await chrome.windows.update(aba.windowId, { focused: true }); } catch (e) { } return; }
  const { urlConferidor } = await chrome.storage.local.get('urlConferidor');
  if (urlConferidor) chrome.tabs.create({ url: urlConferidor });
});
