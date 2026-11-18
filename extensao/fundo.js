/* Service worker: leva o e-mail do webmail para a aba do Conferidor de Guias (abre uma aba se necessário),
   consulta status em tempo real, sincroniza conclusões e leva a resposta pronta de volta ao webmail. */
const REG = 'conferidores';
const lerReg = async () => (await chrome.storage.session.get(REG))[REG] || {};
const gravarReg = r => chrome.storage.session.set({ [REG]: r });
const espera = ms => new Promise(r => setTimeout(r, ms));
const comPrazo = (p, ms, padrao) => Promise.race([p, espera(ms).then(() => padrao)]);

async function abaDoConferidor() {
  const reg = await lerReg();
  const ids = Object.keys(reg).sort((a, b) => reg[b] - reg[a]);
  for (const id of ids) {
    try { const t = await chrome.tabs.get(+id); if (t) return t; } catch (e) { delete reg[id]; }
  }
  await gravarReg(reg);
  return null;
}
async function focar(aba) {
  await chrome.tabs.update(aba.id, { active: true });
  try { await chrome.windows.update(aba.windowId, { focused: true }); } catch (e) { }
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
  await focar(aba); // antes de entregar: se o Conferidor pedir confirmação, a aba já está visível
  const r = await comPrazo(chrome.tabs.sendMessage(aba.id, { tipo: 'entregar', msg }).catch(() => null), 15000, null);
  if (!r) return { ok: false, motivo: 'O Conferidor demorou para responder. Verifique a aba aberta.' };
  return r.ok === false ? r : { ok: true, nomes: r.nomes || [] };
}
async function statusDoEmail(msg) {
  const aba = await abaDoConferidor();
  if (!aba) return { info: null, pastaDesconectada: false };
  const r = await comPrazo(chrome.tabs.sendMessage(aba.id, { tipo: 'status', msg }).catch(() => null), 7000, null);
  return { info: (r && r.info) || null, pastaDesconectada: !!(r && r.pastaDesconectada) };
}
async function levarResposta(resposta) {
  await chrome.storage.session.set({ resposta });
  const { webmailAba } = await chrome.storage.session.get('webmailAba');
  let aba = null;
  if (webmailAba) { try { aba = await chrome.tabs.get(webmailAba); } catch (e) { aba = null; } }
  if (!aba) { const l = await chrome.tabs.query({ url: 'https://mail.promedica.com.br/*' }); aba = l[0] || null; }
  if (!aba) return { ok: false, motivo: 'Abra o webmail numa aba.' };
  await focar(aba);
  let resPonte = null;
  try {
    resPonte = await comPrazo(chrome.tabs.sendMessage(aba.id, { tipo: 'resposta', resposta }), 6500, { ok: true, colado: false });
  } catch (e) {
    return { ok: false, motivo: 'Aperte F5 no webmail e tente de novo.' };
  }
  return { ok: true, colado: !!(resPonte && resPonte.colado) };
}
async function avisarWebmailAtualizado(messageId) {
  try {
    const abas = await chrome.tabs.query({ url: 'https://mail.promedica.com.br/*' });
    for (const a of abas) { try { chrome.tabs.sendMessage(a.id, { tipo: 'atendimentoAtualizado', messageId: messageId || '' }); } catch (e) { } }
  } catch (e) { }
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
  if (m.tipo === 'abrir' && m.msg) {
    if (sender.tab) chrome.storage.session.set({ webmailAba: sender.tab.id });
    entregar(m.msg).then(responder).catch(e => responder({ ok: false, motivo: String((e && e.message) || e) }));
    return true;
  }
  if (m.tipo === 'status' && m.msg) {
    statusDoEmail(m.msg).then(responder).catch(() => responder({ info: null, pastaDesconectada: false }));
    return true;
  }
  if (m.tipo === 'guardarResposta' && m.resposta) {
    levarResposta(m.resposta).then(responder).catch(e => responder({ ok: false, motivo: String((e && e.message) || e) }));
    return true;
  }
  if (m.tipo === 'atendimentoAtualizado') {
    avisarWebmailAtualizado(m.messageId);
    return;
  }
  if (m.tipo === 'pegarResposta') { chrome.storage.session.get('resposta').then(r => responder({ resposta: r.resposta || null })); return true; }
  if (m.tipo === 'respostaUsada') { chrome.storage.session.remove('resposta'); return; }
});
chrome.action.onClicked.addListener(async () => {
  const aba = await abaDoConferidor();
  if (aba) { await focar(aba); return; }
  const { urlConferidor } = await chrome.storage.local.get('urlConferidor');
  if (urlConferidor) chrome.tabs.create({ url: urlConferidor });
});
