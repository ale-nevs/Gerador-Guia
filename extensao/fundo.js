/* Service worker: leva o e-mail do webmail para a aba do Conferidor de Guias (abre uma aba se necessário),
   pergunta ao Conferidor se o e-mail já está em atendimento e leva a resposta pronta de volta ao webmail.
   A resposta fica só na memória da sessão do navegador (storage.session) até ser colada ou descartada. */
const REG = 'conferidores', PEND = 'cfResp';
/* os scripts do webmail (todas as janelas e quadros) leem e acompanham a resposta pendente */
const liberarSessao = () => { try { return chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => { }); } catch (e) { return Promise.resolve(); } };
liberarSessao();
chrome.storage.session.remove('resposta').catch(() => { });   // formato da versão 1.2
const lerReg = async () => (await chrome.storage.session.get(REG))[REG] || {};
const gravarReg = r => chrome.storage.session.set({ [REG]: r });
const espera = ms => new Promise(r => setTimeout(r, ms));
const comPrazo = (p, ms, padrao) => Promise.race([p, espera(ms).then(() => padrao)]);

async function abaDoConferidor() {
  const reg = await lerReg(); const ids = Object.keys(reg).sort((a, b) => reg[b] - reg[a]);
  for (const id of ids) { try { const t = await chrome.tabs.get(+id); if (t) return t; } catch (e) { delete reg[id]; } }
  await gravarReg(reg); return null;
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
  await focar(aba);   // antes de entregar: se o Conferidor perguntar algo, a aba já está na frente
  const r = await comPrazo(chrome.tabs.sendMessage(aba.id, { tipo: 'entregar', msg }).catch(() => null), 15000, null);
  return r && r.ok === false ? r : { ok: true, nomes: (r && r.nomes) || [] };
}
async function statusDoEmail(msg) {
  const aba = await abaDoConferidor(); if (!aba) return { info: null };
  const r = await comPrazo(chrome.tabs.sendMessage(aba.id, { tipo: 'status', msg }).catch(() => null), 7000, null);
  return { info: (r && r.info) || null };
}
const txt = (v, n) => String(v == null ? '' : v).slice(0, n);
/* o e-mail que deve receber a resposta (a ponte só abre o Responder a todos sozinha se for ele o aberto) */
const limparAlvo = a => ({ messageIds: (a && Array.isArray(a.messageIds) ? a.messageIds : []).map(x => txt(x, 300)).filter(Boolean).slice(0, 20), assunto: txt(a && a.assunto, 300), de: txt(a && a.de, 200) });
async function levarResposta(resposta) {
  await liberarSessao();
  const { webmailAba } = await chrome.storage.session.get('webmailAba');
  let aba = null;
  if (webmailAba) { try { aba = await chrome.tabs.get(webmailAba); } catch (e) { aba = null; } }
  if (!aba) { const l = await chrome.tabs.query({ url: 'https://mail.promedica.com.br/*' }); aba = l.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null; }
  if (!aba) return { ok: false, motivo: 'Abra o webmail numa aba.' };
  const pend = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), html: txt(resposta.html, 400000), texto: txt(resposta.texto, 200000), quem: txt(resposta.quem, 160), assunto: txt(resposta.assunto, 300), alvo: limparAlvo(resposta.alvo), aba: aba.id, estado: 'novo', criado: Date.now() };
  await chrome.storage.session.set({ [PEND]: pend });
  try { await chrome.tabs.sendMessage(aba.id, { tipo: 'resposta', id: pend.id }, { frameId: 0 }); }
  catch (e) { await chrome.storage.session.remove(PEND); return { ok: false, motivo: 'Aperte F5 no webmail e tente de novo.' }; }
  await focar(aba);
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
  if (m.tipo === 'abrir' && m.msg) {
    if (sender.tab) chrome.storage.session.set({ webmailAba: sender.tab.id });
    entregar(m.msg).then(responder).catch(e => responder({ ok: false, motivo: String(e && e.message || e) })); return true;
  }
  if (m.tipo === 'status' && m.msg) { statusDoEmail(m.msg).then(responder).catch(() => responder({ info: null })); return true; }
  if (m.tipo === 'guardarResposta' && m.resposta) { levarResposta(m.resposta).then(responder).catch(e => responder({ ok: false, motivo: String(e && e.message || e) })); return true; }
  if (m.tipo === 'meuTab') { responder({ tabId: sender.tab ? sender.tab.id : -1, frameId: sender.frameId || 0 }); return; }
  if (m.tipo === 'acesso') { liberarSessao().then(() => responder({ ok: true })); return true; }
  if (m.tipo === 'respostaUsada') { chrome.storage.session.remove(PEND); return; }
});
chrome.runtime.onStartup.addListener(liberarSessao);
chrome.runtime.onInstalled.addListener(liberarSessao);
chrome.action.onClicked.addListener(async () => {
  const aba = await abaDoConferidor();
  if (aba) { await focar(aba); return; }
  const { urlConferidor } = await chrome.storage.local.get('urlConferidor');
  if (urlConferidor) chrome.tabs.create({ url: urlConferidor });
});
