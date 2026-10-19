# Conferidor de Guias: guia de implantação

Versão 2.0.0 · outubro de 2026

O Conferidor é uma página que roda no Chrome. Ela lê o .eml do pedido, aponta problemas e conduz a conferência da guia, item por item. Também gera a observação e a resposta, e registra tudo numa pasta compartilhada.

A página **não acessa o sistema da operadora** e **não gera guias**. A guia continua sendo feita pelo operador no sistema oficial.

---

## 1. O que vai em cada lugar

| Lugar | O que fica lá | Contém dados de pacientes? |
| --- | --- | --- |
| GitHub e Vercel | `public/index.html`, `public/logo-promedica.png` e `vercel.json`, só o código da página | Não |
| Pasta compartilhada do Windows | `config.json` (clínicas, modelos, alertas), `parametrizacoes.json` e a pasta `registros/` | Sim, o mínimo: carteira, códigos, guia, operador. Sem nome, CID ou médico |
| Computador do operador | Nada instalado. O Chrome lembra a pasta, o operador e o tema | Só o pedido em andamento, apagado ao concluir |

> **Nunca envie o `config.json`, e-mails ou registros para o GitHub.** Mantenha o repositório sem esses arquivos (o `.gitignore` já os bloqueia).

---

## 2. Publicar a página na Vercel (cerca de 10 minutos)

O código da página fica no repositório `ale-nevs/gerador-guia`, no GitHub, e a Vercel publica a partir dele.

1. Acesse **vercel.com** e entre com a conta do GitHub (**Continue with GitHub**).
2. Clique em **Add New → Project** e importe o repositório `gerador-guia`.
3. Em **Framework Preset**, escolha **Other**. Deixe **Build Command** e **Install Command** vazios. O arquivo `vercel.json` já define `public` como pasta publicada.
4. Clique em **Deploy**. Em cerca de 1 minuto a Vercel mostra o endereço, por exemplo `https://gerador-guia.vercel.app`.
5. Abra esse endereço no Chrome de cada operador e **adicione aos favoritos**.

**Para publicar uma versão nova:** basta enviar a alteração para a branch de produção do repositório. A Vercel publica sozinha em cerca de 1 minuto. Os operadores atualizam com **Ctrl+F5**. A versão aparece no topo da página, ao lado da data.

**Plano B, sem Vercel:** copie `public/index.html` e `public/logo-promedica.png` para a pasta compartilhada e abra o `index.html` com duplo clique no Chrome. Funciona igual. Se o Chrome não deixar escolher a pasta nesse modo, use a Vercel.

## 3. Preparar a pasta compartilhada

1. Crie uma pasta na rede, por exemplo `\\servidor\Autorizacoes\Conferidor`. Thiago, Alípio, Rafael e o apoio precisam de **leitura e escrita**.
2. Copie para dentro dela o arquivo `pasta-compartilhada/config.json` do pacote.
3. Em **cada computador**, na primeira vez:
    - Abra a página e escolha seu nome em **Operador**.
    - Clique no botão vermelho **Pasta não conectada**, escolha a pasta e clique em **Permitir** quando o Chrome perguntar se pode editar arquivos.
4. **Todo dia**, ao abrir o Chrome, o botão fica amarelo (**Clique para reautorizar a pasta**). É um clique. O Chrome exige isso por segurança.

Se o Chrome recusar a pasta de rede, mapeie a pasta como unidade (por exemplo `Z:`) pelo Explorador de Arquivos, em "Mapear unidade de rede". Depois escolha a pasta pela unidade.

A página cria sozinha a estrutura `registros/AAAA-MM/AAAA-MM-DD_operador.json`. Cada operador grava só no próprio arquivo do dia, então não há conflito entre os três.

**Sem a pasta conectada a página funciona**, mas os registros ficam só naquele computador. Nesse modo, a detecção de duplicidade entre operadores e o painel conjunto não funcionam.

---

## 4. Primeira configuração (gestor)

Abra **Configurações**. A tela tem 10 seções; as alterações ficam em rascunho até clicar em **Salvar configurações** (a barra inferior avisa quando há algo não salvo).

- **Aparência:** modo claro, escuro ou automático (vale para cada computador).
- **Perfil e identificação:** nome de exibição, animal e cor de cada operador. É só identificação visual e de registro. Não existe caixa de pendências por operador.
- **Clínicas e cadastros:** lista com busca à esquerda e ficha à direita. Para cada clínica informe o **credenciado executante** (exatamente como aparece no sistema oficial), os e-mails e os **códigos com a descrição oficial**. Campos não informados ficam vazios; nada é preenchido por suposição. Códigos podem ser colados em lista ou sugeridos a partir de atendimentos concluídos (você escolhe quais adicionar).
- **Modelos de e-mail** e **Modelo de observação da guia:** editor com prévia, lista de campos por categoria (nome, descrição e exemplo) e texto rico (negrito, itálico, cor, listas). Textos que vão para campos de texto simples do sistema oficial não oferecem formatação, e o sistema avisa isso.
- **Parametrizações:** lista de parametrizações salvas e o formato do texto estruturado.
- **Alertas e regras de validação:** para cada alerta escolha **Bloqueio**, **Aviso com observação**, **Aviso de atenção** ou **Desativado**. A escolha muda o comportamento real do atendimento.
- **Exportação:** CSV de registros por período, cópia de segurança do config.json e das parametrizações.
- **Preferências operacionais:** conferência cega obrigatória (sim/não), quantidade máxima por serviço, pré-seleção do texto de parametrização e motivos de não autorização.
- **Informações e versão:** versão, pasta conectada e onde ficam os dados.

Não precisa cadastrar tudo de uma vez. No dia a dia, quando aparecer **Remetente fora do cadastro de clínicas**, o operador escolhe a clínica e clica em **Vincular e salvar e-mail no cadastro**.

Arquivos na pasta compartilhada: `config.json` (configurações), `parametrizacoes.json` (referências por clínica e carteira) e `registros/`.

---

## 5. Rotina do operador

1. Baixe o **.eml** do e-mail no SmarterMail e arraste para a página. O sistema lê de 1 a 5 beneficiários; cada um vira uma **guia independente**. O mesmo beneficiário em mais de um bloco gera mais de uma guia, com aviso.
2. **Etapa 2, pedido e alertas:** confira os dados, corrija a leitura se preciso (**Corrigir leitura** só altera este e-mail) e use **Parametrizar** para registrar médico, data e terapias como referência dos próximos atendimentos da clínica. Bloqueios impedem seguir; resolva ou use **Responder sem gerar guia** (pendência, já autorizado, carteira, outra clínica, excluído/carência, sem direito no local ou os 2 modelos personalizados). A guia vai direto à etapa final com o texto da resposta e é concluída **sem número**. Em e-mails com várias guias, o trecho de cada guia sem gerar entra na resposta única, no fim. Cada modelo tem um texto para guia única e outro para várias guias (Configurações › Modelos de e-mail).
3. **Etapa 3, guia e conferência:** os dados aparecem na ordem do sistema oficial, cada um com seu botão **Copiar** (fica verde depois de copiado). Os serviços mostram código e quantidade lado a lado, a descrição cadastrada da clínica e a descrição do e-mail. Depois faça a conferência cega.
4. **Etapa 4, finalizar:** informe o número real da guia (nunca invente), escolha **Autorizada** (responda obrigatoriamente "Houve alguma glosa?"; se sim, marque o item, a glosa e por que foi retirada), **Parcialmente autorizada** (marque os itens negados) ou **Não autorizada** (com motivo) e use **Incluir observação** para a observação da guia. Em e-mail com uma só guia, a resposta ao prestador aparece nessa mesma tela. Em e-mail com **várias guias**, cada guia mostra só número, resultado e observação (etapa "Resultado e observação"); a **resposta ao prestador com todas as guias** aparece na **última guia**, junto com o botão para copiar o e-mail do prestador.
5. **Concluir guia** registra aquela guia e leva à próxima. O e-mail só termina quando todas as guias foram tratadas.
6. Quem abre o e-mail é quem o finaliza. Se um colega já trabalhou no mesmo e-mail, o sistema avisa antes de abrir.

**Leitura do pedido:** o sistema reconhece rótulos variados (Paciente, Cartão, Procedimentos, Sessões…), campos na mesma linha separados por `|`, vários pacientes separados por traços ou por repetição de beneficiário/carteira, e vários pedidos do mesmo paciente quando médico ou data se repetem. Médico, CID, data e local escritos uma única vez no e-mail são aplicados às guias que não os têm, com aviso. Quantidades lidas do fim da linha também geram aviso.

Nada é enviado nem emitido automaticamente: toda resposta é revisada e copiada pelo operador.

---

## 6. Aba Ações e Painel do dia

A aba **Ações** mostra, em 3 colunas, onde está cada guia aberta hoje (paciente × clínica): **Lendo o pedido**, **Gerando guia** e **Anexando e-mail**. Ao abrir um e-mail, o sistema mostra a **última guia gerada** para a mesma carteira (de qualquer data) e, se for de outra clínica, o nome dela.

### Painel do dia

Mostra o trabalho do dia, sem separar por operador: totais por resultado, o que ainda precisa ser feito em cada guia (com botão para abrir), guias por clínica e a tabela do dia com filtros (status, resultado, clínica, parametrização e busca). **Exportar CSV** respeita os filtros aplicados. Há visualização por **dia** e por **mês**. Em cada guia concluída: **Corrigir guia** (carteira, serviços e quantidades), **Cancelar guia** e **Excluir guia**. Na coluna Observações, ao passar o mouse, aparecem as divergências da conferência, o motivo de guias sem gerar e as glosas retiradas. Continuam disponíveis, na visão por dia, a amostragem do apoio e a conciliação de e-mails e de guias.

---

### Perfis, cores e senha
- Em Configurações > Perfil cada operador escolhe nome, animal, **cor (RGB)** e **transparência**; o botão do operador no topo e as etiquetas usam essa cor.
- Cada operador pode definir uma **senha**, pedida ao trocar para ele. Perfis com senha só são editados pelo próprio operador.
- Atenção: é uma trava de uso, não segurança forte. O código (hash) fica no `config.json` da pasta compartilhada, e quem tem acesso à pasta pode alterá-lo.
- Ao salvar, o `config.json` da pasta é regravado, preservando operadores criados ou protegidos por colegas desde que a tela foi aberta. Outras máquinas releem o arquivo ao voltar para a janela.

### Topo compacto e telas estreitas
- O botão pequeno ao lado de Claro/Escuro oculta o menu de seções e o topo. Fica uma barra fina na cor do operador com o nome, uma luz da pasta (verde conectada, amarela reautorizar, vermelha sem pasta) e o botão para voltar. A escolha fica salva neste computador.
- No canto esquerdo do topo compacto há uma bolinha por operador com atendimento em andamento (inclusive colegas, lidos da pasta compartilhada e atualizados a cada 20 s): anel na cor e com o animal do operador, 33% lendo o pedido, 66% gerando a guia, 100% anexando e respondendo. Ao passar o mouse aparecem o paciente e a clínica. Sem atendimento, uma bolinha cinza.
- Botões secundários (copiar, atualizar, corrigir, excluir etc.) mostram só o ícone, com o nome na dica ao passar o mouse. Há um botão de copiar ao lado da carteira usada no sistema.
- A página foi ajustada para funcionar até 320 px de largura, sem rolagem horizontal.

### Extensão do Chrome
A pasta `extensao/` contém uma extensão (painel lateral) que lê o e-mail aberto no webmail e o oferece ao conferidor, sem baixar o .eml. Veja `extensao/LEIA-ME.md`.

### Visões do Painel
Dia, **Semana** (segunda a domingo) e Mês. A coluna Clínica mostra quem gerou a guia.

### Glosas
Em guias autorizadas e **parcialmente autorizadas** responda "Retirou alguma glosa?". Na parcial, os serviços negados não entram na lista. A glosa é escolhida entre as cadastradas em Configurações.

## 7. Regras de alertas

Os alertas e seus comportamentos padrão estão em **Configurações › Alertas e regras de validação**. Em resumo: falta de beneficiário, serviço, quantidade, médico, carteira inválida e código incorreto ou repetido são **bloqueios**; o restante é **aviso de atenção**. Anexo não é alerta: apenas o primeiro atendimento sem parametrização gera um aviso, e as divergências em relação a uma parametrização existente também. Não há mais prazos de duplicidade nem de emissão antiga.

Código sem cadastro na clínica é diferente de descrição divergente do cadastro: no primeiro caso a descrição do e-mail serve de referência provisória; no segundo o cadastro prevalece. O código solicitado nunca é alterado, e nada é cadastrado automaticamente.

---

## 8. SmarterMail: filtros de conteúdo e eventos

Não é preciso nada do SmarterMail para a página funcionar. Os filtros podem ajudar na triagem. Confira no painel do SmarterMail quais condições e ações ele oferece; as sugestões abaixo dependem disso.

- **Assunto começando com "RE:", "Res:" ou "ENC:":** aplicar uma marca ou mover para uma pasta "Respostas de clínicas". Respostas deixam de se misturar com pedidos novos.
- **Mensagens com anexo:** podem receber uma marca "Com anexo" para facilitar a identificação do primeiro atendimento (o pedido médico em anexo é esperado e serve de base para a parametrização).
- **Remetente do domínio de cada clínica:** mover ou marcar automaticamente com o nome da clínica. Isso reforça a identificação pelo remetente, e não pelo assunto.
- **Resposta automática de recebimento (opcional):** confirma o recebimento e manda o modelo de pedido. Pode reduzir cobranças, mas gera um e-mail a mais por pedido. Avalie com a equipe.
- **Eventos:** em geral servem para notificações administrativas, como avisos de cota ou de mensagens recebidas. Não substituem o painel do dia. Vale usar só se houver um evento de "caixa com mais de N mensagens", para avisar o apoio quando a fila crescer.

---

## 9. Privacidade

- O e-mail é lido **dentro do Chrome**. Nada é enviado para a internet, para o GitHub nem para a Vercel.
- Os registros na pasta guardam: id do e-mail, assunto, remetente, clínica, operador, horários, **carteira**, **códigos e quantidades**, número da guia, alertas confirmados e resultado da conferência. **Não** guardam nome do paciente, CID nem médico.
- O pedido em andamento fica no navegador do operador até ser concluído, devolvido ou descartado.
- Em **Configurações** há o botão para apagar registros com mais de 180 dias.

---

## 10. Problemas comuns

| Problema | Solução |
| --- | --- |
| Botão da pasta amarelo | Clique e permita. Acontece uma vez por dia |
| "Use o Google Chrome" | A página precisa do Chrome (ou Edge) para acessar a pasta |
| Não grava na pasta | Verifique permissão de escrita na rede. O registro fica no computador e a página avisa |
| Leitura errada de um e-mail | Corrija na etapa 2 (fica registrado como editado à mão) e me envie o .eml |
| Página antiga depois de atualizar | Ctrl+F5 |
| Clínica nova | Configurações → + clínica, ou vincule pelo alerta de remetente |

---

## Anexo: mensagem sugerida às clínicas

> Assunto: Novo modelo de pedido de autorização de terapias
>
> Prezados,
>
> Para agilizar as autorizações e evitar divergências, pedimos que os pedidos sejam enviados no corpo do e-mail, um beneficiário por e-mail, no modelo abaixo:
>
> Beneficiário:
> Carteira: (17 caracteres, sem espaços)
> Serviços (um por linha: CÓDIGO - DESCRIÇÃO - QUANTIDADE):
> Médico: (nome e CRM)
> CID:
> Emissão: (dd/mm/aaaa ou SEM DATA)
> Local de emissão:
> Observações:
>
> A partir de agora, nossa resposta trará a lista de serviços e quantidades autorizados. Caso algo não corresponda ao solicitado, basta responder o mesmo e-mail.
>
> Agradecemos a colaboração.
