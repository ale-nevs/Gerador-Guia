'use strict';
/* ====================================================================
   Pasta compartilhada (File System Access API) + IndexedDB
   ==================================================================== */
function idbAbrir() { return new Promise((res, rej) => { const r = indexedDB.open('conferidor', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { try { const db = await idbAbrir(); return await new Promise(res => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbSet(k, v) { const db = await idbAbrir(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

const Pasta = {
  handle: null, ok: false, erro: null, suportado: 'showDirectoryPicker' in window,
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
  /* undefined = arquivo não existe; erro de leitura lança (para não sobrescrever um arquivo que só não foi lido) */
  async lerSeguro(partes, nome) {
    let d; try { d = await this.dir(partes, false); } catch (e) { if (e && e.name === 'NotFoundError') return undefined; throw e; }
    let fh; try { fh = await d.getFileHandle(nome); } catch (e) { if (e && e.name === 'NotFoundError') return undefined; throw e; }
    return JSON.parse(await (await fh.getFile()).text());
  },
  async ler(partes, nome) { try { const d = await this.dir(partes, false); const f = await (await d.getFileHandle(nome)).getFile(); return JSON.parse(await f.text()); } catch (e) { return null; } },
  async gravar(partes, nome, obj) {
    try {
      const d = await this.dir(partes, true); const fh = await d.getFileHandle(nome, { create: true });
      const w = await fh.createWritable(); await w.write(JSON.stringify(obj, null, 1)); await w.close();
      if (this.erro) { this.erro = null; if (typeof pintarSync === 'function') pintarSync(); }
    } catch (e) { this.erro = e.message || 'falha ao gravar'; if (typeof pintarSync === 'function') pintarSync(); throw e; }
  },
  /* confere de novo se a permissão da pasta ainda vale (ela expira) */
  async verificar() {
    if (!this.suportado || !this.handle) return;
    try { this.ok = (await this.handle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.ok = false; }
  },
  async listar(partes) { try { const d = await this.dir(partes, false); const out = []; for await (const [n, h] of d.entries()) out.push([n, h]); return out; } catch (e) { return []; } },
  /* como listar, mas uma falha de leitura lança (pasta que ainda não existe = lista vazia) */
  async listarSeguro(partes) {
    let d; try { d = await this.dir(partes, false); } catch (e) { if (e && e.name === 'NotFoundError') return []; throw e; }
    const out = []; for await (const [n, h] of d.entries()) out.push([n, h]); return out;
  },
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
  ajuste: { nome: 'Guia ajustada', texto:
`{SAUDACAO}!

Recebemos a solicitação de ajuste e informamos que a guia nº **{GUIA}**, de {BENEFICIARIO} (carteira {CARTEIRA}), foi ajustada.

Ajuste realizado:
{APONTAMENTOS}

Permanecemos à disposição.` },
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
  outra_clinica: { nome: 'Beneficiário já realiza atendimento em outra clínica', texto:
`{SAUDACAO}!

Informamos que, na verificação realizada, consta que o beneficiário {BENEFICIARIO} (carteira {CARTEIRA}) já realiza atendimento em outra clínica para o(s) serviço(s) solicitado(s):

{ITENS}

Por esse motivo, a solicitação depende de análise e regularização, conforme o procedimento aplicável. Pedimos que aguarde o nosso retorno ou nos informe, em resposta a este e-mail, os dados necessários para a análise.

{OBS_ADICIONAIS}

Permanecemos à disposição para eventuais esclarecimentos.` },
  excluido_carencia: { nome: 'Beneficiário excluído ou com carência', texto:
`{SAUDACAO}!

Informamos que não foi possível realizar a autorização do(s) serviço(s) solicitado(s) para o beneficiário {BENEFICIARIO} (carteira {CARTEIRA}), devido à situação identificada na verificação realizada (exclusão ou carência, conforme o resultado da consulta).

Serviços solicitados:
{ITENS}

{OBS_ADICIONAIS}

Em caso de dúvidas, responda este e-mail.

Permanecemos à disposição.` },
  sem_direito_local: { nome: 'Beneficiário sem direito no local ou prestador', texto:
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
  ajuste: { grupo: 'Ajuste de guia', destino: 'email', uso: 'Botão E-mail de ajuste (aba Corrigir guia, Painel, histórico da guia, Corrigir guia e Reabrir da lista): avisa a clínica que a solicitação foi recebida e a guia foi ajustada, com os apontamentos.' },
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
  { k: 'EMAIL_PRESTADOR', cat: 'Dados da clínica', nome: 'E-mail da clínica', desc: 'Endereço para a resposta (etapa Finalizar).', ex: 'contato@clinicaexemplo.com.br', opc: true, fn: c => c.g.resultado.emailPrestador },
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
  // Ajuste de guia
  { k: 'APONTAMENTOS', cat: 'Ajuste de guia', nome: 'Apontamentos do ajuste', desc: 'O que foi ajustado na guia, digitado no e-mail de ajuste (um por linha).', ex: '• Quantidade de 50000470 corrigida de 1 para 2', fn: c => ((c.extra || {}).apontamentos || '').trim(), html: c => esc(c.extra.apontamentos.trim()).replace(/\n/g, '<br>') },
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
  'dup-semana': { grupo: 'Serviços', nome: 'Possível pedido repetido: código já autorizado na semana', desc: 'O mesmo código já foi autorizado para a mesma carteira entre segunda e domingo desta semana, em outro e-mail. Aparece em vermelho no topo e no painel flutuante, e a guia só segue depois do "Conferi: não é repetido". Nunca vira aprendizado.', modo: 'atencao', nivel: 'critico' },
  'aprendido': { grupo: 'E-mail', nome: 'Correção já feita antes nesta clínica', desc: 'O valor lido já foi corrigido por um operador em atendimentos anteriores desta clínica. Oferece aplicar a mesma correção.', modo: 'atencao' },
  'regra-clinica': { grupo: 'Serviços', nome: 'Ajuste feito pela regra de leitura da clínica', desc: 'Código corrigido ou quantidade preenchida pelas regras de leitura cadastradas na clínica (Configurações › Clínicas). Confira no e-mail.', modo: 'atencao' },
  'solto': { grupo: 'Serviços', nome: 'Número de 8 dígitos que não virou item', desc: 'Pode ser um serviço esquecido ou um telefone.', modo: 'atencao' },
  'serv-repetido-guias': { grupo: 'Serviços', nome: 'Mesmo serviço em outra guia do mesmo beneficiário', desc: 'Dois pedidos do mesmo beneficiário no e-mail pedem o mesmo código. Pode ser duplicidade ou contradição.', modo: 'atencao' },
  'editado': { grupo: 'Serviços', nome: 'Leitura corrigida à mão', desc: 'Dados ou itens foram corrigidos pelo operador em relação à leitura automática.', modo: 'atencao' },
  'falta-med': { grupo: 'Pedido médico', nome: 'Médico não informado', desc: 'O pedido não traz nome nem CRM do médico.', modo: 'bloqueio' },
  'em-inv': { grupo: 'Pedido médico', nome: 'Data de emissão não reconhecida', desc: 'O texto da data não é uma data válida.', modo: 'atencao' },
  'em-fut': { grupo: 'Pedido médico', nome: 'Data de emissão no futuro', desc: 'A emissão é posterior ao recebimento do e-mail.', modo: 'atencao' },
  'em-inf': { grupo: 'Pedido médico', nome: 'Ano da emissão inferido', desc: 'A clínica escreveu dia e mês sem o ano; o ano foi deduzido pela data do e-mail. Confirme.', modo: 'atencao', nivel: 'info' },
  'cid-fmt': { grupo: 'Pedido médico', nome: 'CID fora do padrão', desc: 'O CID não tem o formato letra + 2 ou 3 dígitos (ex.: F84 ou F84.0).', modo: 'atencao' },
  'nao-pedido': { grupo: 'E-mail', nome: 'E-mail que não parece um pedido', desc: 'Sem beneficiário, carteira nem código de serviço. Pode ser outro assunto (dúvida, retificação, conversa).', modo: 'atencao' },
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
/* Observações automáticas da conferência pelos prints: aparecem como sugestão marcável, nunca entram sozinhas se desmarcadas.
   Campos: {CODIGO} {QTD_PEDIDO} {QTD_SISTEMA}. Os textos e a marcação padrão podem ser mudados nas configurações. */
const OBS_AUTO = {
  'item-ausente': { nome: 'Item que não consta na guia gerada', texto: 'Item {CODIGO}: não consta na guia gerada (solicitado {QTD_PEDIDO}).', padrao: true, itens: true },
  'item-menor': { nome: 'Item autorizado com quantidade menor', texto: 'Item {CODIGO}: autorizado com quantidade {QTD_SISTEMA} (solicitado {QTD_PEDIDO}).', padrao: true, itens: true },
  'item-qtd': { nome: 'Item com quantidade diferente (maior)', texto: 'Item {CODIGO}: guia com quantidade {QTD_SISTEMA} (solicitado {QTD_PEDIDO}).', padrao: true, itens: true },
  'item-extra': { nome: 'Item na guia que não estava no pedido', texto: 'Item {CODIGO}: consta na guia gerada (quantidade {QTD_SISTEMA}) e não estava no pedido.', padrao: true, itens: true },
  'item-status': { nome: 'Item com status diferente de Liberada', texto: 'Item {CODIGO}: status no sistema {STATUS}.', padrao: true, itens: true },
  profissional: { nome: 'Médico solicitante diferente', texto: 'Médico solicitante no sistema difere do informado no pedido.', padrao: true },
  registro: { nome: 'Registro (CRM) diferente', texto: 'Registro do médico no sistema difere do informado no pedido.', padrao: false },
  dtSolic: { nome: 'Data da solicitação diferente', texto: 'Data da solicitação no sistema difere da data do pedido.', padrao: false },
  guia: { nome: 'Número da guia diferente do digitado', texto: 'Número da guia diferente do digitado.', padrao: true },
  paciente: { nome: 'Nome do beneficiário diferente', texto: 'Nome do beneficiário no sistema difere do informado no pedido.', padrao: true },
  credNome: { nome: 'Credenciado executante diferente', texto: 'Credenciado executante no sistema difere do cadastrado.', padrao: true },
  ident: { nome: 'Carteira incorreta', texto: 'Carteira no sistema difere da carteira usada.', padrao: false },
  cid: { nome: 'CID diferente', texto: 'CID no sistema difere do informado no pedido.', padrao: false }
};
const obsAutoPadrao = () => Object.fromEntries(Object.entries(OBS_AUTO).map(([k, v]) => [k, { texto: v.texto, padrao: v.padrao }]));
const PREFS_PADRAO = { conferenciaCega: true, qtdMax: 9, obsParametrizadoAuto: false, acoesMinutos: 10, guardarPrints: true, minutosParado: 10 };

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
    obsAuto: obsAutoPadrao(),
    operadores: [
      { id: 'alipio', nome: 'Alípio', icone: '🦊', corRgb: '#2563eb', corAlfa: 25 },
      { id: 'rafael', nome: 'Rafael', icone: '🐻', corRgb: '#0891b2', corAlfa: 25 },
      { id: 'thiago', nome: 'Tiago', icone: '🦉', corRgb: '#0d9488', corAlfa: 25 },
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
    const r = { id, nome: /^thiago$/i.test(String(o.nome).trim()) ? 'Tiago' : String(o.nome).trim(), icone: AVATARES.includes(o.icone) ? o.icone : AVATARES[(i * 3 + 2) % AVATARES.length], corRgb, corAlfa };
    if (o.senhaHash && o.senhaSalt) { r.senhaHash = String(o.senhaHash); r.senhaSalt = String(o.senhaSalt); }
    return r;
  });
}
function mesclarConfig(base, c) {
  const r = clonar(base);
  if (!c) return r;
  const ops = normOperadores(c.operadores); if (ops.length) r.operadores = ops;
  if (Array.isArray(c.clinicas)) r.clinicas = c.clinicas;
  r.supervisor = c.supervisor && c.supervisor.pinHash && c.supervisor.pinSalt ? { pinHash: String(c.supervisor.pinHash), pinSalt: String(c.supervisor.pinSalt) } : null;
  r.clinicas.forEach(cl => { cl.leitura = normLeitura(cl.leitura); cl.id = cl.id || slug(cl.nome); cl.emails = unicos((cl.emails || []).map(e => String(e).toLowerCase().trim()).filter(Boolean)); cl.codigos = cl.codigos || {}; cl.executante = cl.executante || ''; cl.apelidos = cl.apelidos || ''; cl.cidade = cl.cidade || ''; });
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
    if (Number.isInteger(Number(p.minutosParado)) && Number(p.minutosParado) >= 0 && Number(p.minutosParado) <= 240) r.preferencias.minutosParado = Number(p.minutosParado);
    if (typeof p.guardarPrints === 'boolean') r.preferencias.guardarPrints = p.guardarPrints;
  }
  if (c.obsAuto) for (const k in OBS_AUTO) { const o = c.obsAuto[k]; if (!o) continue; if (typeof o.texto === 'string' && o.texto.trim()) r.obsAuto[k].texto = o.texto.trim(); if (typeof o.padrao === 'boolean') r.obsAuto[k].padrao = o.padrao; }
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
    clinicas: c.clinicas.map(cl => ({ id: cl.id, nome: cl.nome, cidade: cl.cidade || '', executante: cl.executante || '', emails: cl.emails || [], apelidos: cl.apelidos || '', nota: (cl.nota || '').trim(), lista: !!cl.lista, codigos: cl.codigos || {}, leitura: normLeitura(cl.leitura) })),
    modelos: Object.fromEntries(Object.entries(c.modelos).map(([k, m]) => [k, { nome: m.nome, html: m.html, texto: htmlPlano(m.html), ...(MODELOS_META[k].custom ? { uso: m.uso || '' } : {}) }])),
    alertas: c.alertas, motivos: c.motivos, glosas: c.glosas || [], obsAuto: c.obsAuto, preferencias: c.preferencias,
    supervisor: c.supervisor && c.supervisor.pinHash ? { pinHash: c.supervisor.pinHash, pinSalt: c.supervisor.pinSalt } : null
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

/* Registros: um por guia (com o nome do paciente; CID e médico ficam na auditoria). */
const carimboReg = r => r.atualizadoEm || r.registradoEm || '';
/* Junta duas versões do mesmo arquivo de registros pelo id: nada é descartado, vale a versão mais recente de cada
   registro, e o que foi excluído (lista "excluidos") não volta. */
function juntarDocsReg(a, b) {
  if (!a && !b) return null;
  const base = a || b, exc = new Set([...((a && a.excluidos) || []), ...((b && b.excluidos) || [])]), mapa = new Map();
  [...((a && a.registros) || []), ...((b && b.registros) || [])].forEach(r => {
    if (!r || exc.has(r.id)) return; const x = mapa.get(r.id); if (!x || carimboReg(r) >= carimboReg(x)) mapa.set(r.id, r);
  });
  return { ...base, registros: [...mapa.values()], excluidos: [...exc] };
}
const assinaturaReg = d => d ? JSON.stringify([(d.registros || []).map(r => r.id + '@' + carimboReg(r)).sort(), [...(d.excluidos || [])].sort()]) : '';
const Reg = {
  cache: [],
  arquivo(dia, op) { return { partes: ['registros', dia.slice(0, 7)], nome: `${dia}_${slug(op)}.json` }; },
  async salvar(reg) {
    const { partes, nome } = this.arquivo(reg.dia, reg.operador || 'sem-operador');
    const chave = `reg.${reg.dia}.${slug(reg.operador || 'sem-operador')}`;
    let doc = LS.get(chave, null), erro = null;
    if (Pasta.ok) { try { const lido = await Pasta.lerSeguro(partes, nome); if (lido) doc = juntarDocsReg(lido, doc); } catch (e) { erro = e; } }
    if (!doc) doc = { operador: reg.operador, dia: reg.dia, registros: [] };
    doc.registros = doc.registros || [];
    if (doc.excluidos) doc.excluidos = doc.excluidos.filter(x => x !== reg.id);
    const i = doc.registros.findIndex(r => r.id === reg.id);
    if (i >= 0) doc.registros[i] = reg; else doc.registros.push(reg);
    LS.set(chave, doc);
    if (Pasta.ok && !erro) { try { await Pasta.gravar(partes, nome, doc); } catch (e) { erro = e; } }
    if (!Pasta.ok || erro) this.pendente(chave, reg.id); else this.pendente(chave, null);
    const j = this.cache.findIndex(r => r.id === reg.id);
    if (j >= 0) this.cache[j] = reg; else this.cache.push(reg);
    if (erro) toast('Não consegui gravar na pasta compartilhada. O registro está guardado neste computador e será enviado depois.', 'bad');
    pintarSync();
  },
  /* Atendimentos gravados só neste computador (pasta fora ou falha), por arquivo: { chave: [ids] } */
  pendentes() { const p = LS.get('regPendentes', {}); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; },
  nPendentes() { return Object.values(this.pendentes()).reduce((s, l) => s + (l || []).length, 0); },
  pendente(chave, id) {
    const p = this.pendentes();
    if (id == null) delete p[chave]; else p[chave] = [...new Set([...(p[chave] || []), id])];
    LS.set('regPendentes', p);
  },
  /* Envia à pasta o que está só neste computador, juntando com o que já está lá (nada é sobrescrito). */
  async sincronizar(chaves) {
    if (!Pasta.ok) return 0;
    const p = this.pendentes(); let n = 0;
    for (const k of (chaves || Object.keys(p))) {
      const local = LS.get(k, null); if (!local) { delete p[k]; continue; }
      const dia = k.slice(4, 14), partes = ['registros', dia.slice(0, 7)], nome = `${dia}_${k.slice(15)}.json`;
      try {
        const lido = await Pasta.lerSeguro(partes, nome), junto = juntarDocsReg(lido, local);
        if (!lido || assinaturaReg(junto) !== assinaturaReg(lido)) await Pasta.gravar(partes, nome, junto);
        LS.set(k, junto); if (p[k]) n += p[k].length; delete p[k];
      } catch (e) { }
    }
    LS.set('regPendentes', p); pintarSync(); return n;
  },
  /* Uma vez por dia: confere os arquivos dos últimos 60 dias deste computador (recupera o que ficou só aqui). */
  async conferirLocais() {
    if (!Pasta.ok || LS.get('regConferidoEm', '') === isoDia(new Date())) return;
    const lim = isoDia(addDias(new Date(), -60));
    await this.sincronizar(LS.chaves('reg.').filter(k => k.slice(4, 14) >= lim));
    LS.set('regConferidoEm', isoDia(new Date()));
  },
  async carregar(diasExtra) {
    const dias = HIST_DIAS + (diasExtra || 0);
    const limite = isoDia(addDias(new Date(), -dias));
    const docs = [];
    if (Pasta.ok && this.nPendentes()) await this.sincronizar();
    if (Pasta.ok) {
      const meses = new Set(); for (let d = 0; d <= dias; d += 10) meses.add(isoDia(addDias(new Date(), -d)).slice(0, 7)); meses.add(limite.slice(0, 7));
      for (const m of meses) for (const [n, h] of await Pasta.listar(['registros', m])) {
        if (!n.endsWith('.json') || n.slice(0, 10) < limite) continue;
        try { docs.push(JSON.parse(await (await h.getFile()).text())); } catch (e) { }
      }
      for (const k of Object.keys(this.pendentes())) if (k.slice(4, 14) >= limite) { const d = LS.get(k, null); if (d) docs.push(d); }
    } else {
      for (const k of LS.chaves('reg.')) if (k.slice(4, 14) >= limite) { const d = LS.get(k, null); if (d) docs.push(d); }
    }
    const excl = new Set(docs.flatMap(d => d.excluidos || []));
    // o mesmo registro pode estar no arquivo de mais de um operador (quando outro continuou o atendimento): vale o mais recente
    const mapa = new Map();
    docs.flatMap(d => d.registros || []).forEach(r => { if (excl.has(r.id)) return; const a = mapa.get(r.id); if (!a || carimboReg(r) >= carimboReg(a)) mapa.set(r.id, r); });
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
    const mapa = new Map(), excl = new Set(docs.flatMap(d => d.excluidos || []));
    docs.flatMap(d => d.registros || []).forEach(r => { if (excl.has(r.id)) return; const a = mapa.get(r.id); if (!a || (r.atualizadoEm || '') >= (a.atualizadoEm || '')) mapa.set(r.id, r); });
    this.mesclarHist([...mapa.values()]);
    await this.carregar(); this.mesclarHist(this.cache); this.histPronto = true;
  },
  doPeriodo(ini, fim) { const ok = r => r.dia && r.dia >= ini && r.dia <= fim; const m = new Map(Object.values(this.todos).filter(ok).map(r => [r.id, r])); this.cache.filter(r => !r.tipo && ok(r)).forEach(r => m.set(r.id, r)); return [...m.values()]; },
  doMes(ym) { const m = new Map(Object.values(this.todos).filter(r => r.dia && r.dia.startsWith(ym)).map(r => [r.id, r])); this.cache.filter(r => !r.tipo && r.dia && r.dia.startsWith(ym)).forEach(r => m.set(r.id, r)); return [...m.values()]; },
  async excluir(id) {
    const r = this.cache.find(x => x.id === id) || this.todos[id]; if (!r) return false;
    const marcar = d => { d.registros = (d.registros || []).filter(x => x.id !== id); d.excluidos = [...new Set([...(d.excluidos || []), id])]; return d; };
    for (const k of LS.chaves('reg.' + r.dia)) { const d = LS.get(k, null); if (d && (d.registros || []).some(x => x.id === id)) LS.set(k, marcar(d)); }
    const pend = this.pendentes(); Object.keys(pend).forEach(k => { pend[k] = pend[k].filter(x => x !== id); if (!pend[k].length) delete pend[k]; }); LS.set('regPendentes', pend);
    if (Pasta.ok) { const partes = ['registros', r.dia.slice(0, 7)]; for (const [n] of await Pasta.listar(partes)) { if (!n.startsWith(r.dia) || !n.endsWith('.json')) continue; const doc = await Pasta.ler(partes, n); if (doc && (doc.registros || []).some(x => x.id === id)) await Pasta.gravar(partes, n, marcar(doc)); } }
    this.cache = this.cache.filter(x => x.id !== id); delete this.todos[id];
    Object.values(this.hist).forEach(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); });
    return true;
  },
  ultimaGuia(carteira, atendId) {
    const l = (this.hist[carteira] || []).filter(r => r.atendimentoId !== atendId).sort((a, b) => ((a.concluidoEm || '') < (b.concluidoEm || '') ? 1 : -1));
    return l[0] || null;
  }
};
