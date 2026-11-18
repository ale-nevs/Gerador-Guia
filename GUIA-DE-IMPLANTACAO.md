# Conferidor de Guias: guia de implantação

Versão 2.0.0 · outubro de 2026

O Conferidor é uma página que roda no Chrome. Ela lê o .eml do pedido, aponta problemas e conduz a conferência da guia, item por item. Também gera a observação e a resposta, e registra tudo numa pasta compartilhada.

A página **não acessa o sistema da operadora** e **não gera guias**. A guia continua sendo feita pelo operador no sistema oficial.

---

## 1. O que vai em cada lugar

| Lugar | O que fica lá | Contém dados de pacientes? |
| --- | --- | --- |
| GitHub e Vercel | a pasta `public/` (`index.html`, `css/app.css`, `js/*.js`, `ocr/`, `fonts/`, imagens e a extensão) e `vercel.json`, só o código da página | Não |
| Pasta compartilhada do Windows | `config.json` (clínicas, modelos, alertas, PIN do supervisor em código), `parametrizacoes.json`, `registros/` (com o nome do beneficiário), `auditoria/` (e-mail, prints e histórico de cada guia), `aprendizado/`, `notas/`, `presenca/` e `relatos/` | Sim: veja a seção 9 |
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

**Plano B, sem Vercel:** copie a pasta `public/` inteira (o `index.html` usa os arquivos de `css/` e `js/` ao lado dele) para a pasta compartilhada e abra o `index.html` com duplo clique no Chrome. Funciona igual. Se o Chrome não deixar escolher a pasta nesse modo, use a Vercel.

## 3. Preparar a pasta compartilhada

1. Crie uma pasta na rede, por exemplo `\\servidor\Autorizacoes\Conferidor`. Tiago, Alípio, Rafael e o apoio precisam de **leitura e escrita**.
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

## 6. Acompanhamento e Painel do dia

A aba **Acompanhamento** mostra quem está com o Conferidor aberto agora (lido da pasta, atualizado a cada minuto), o **Auditar** e, em 3 colunas, onde está cada guia aberta hoje (paciente × clínica): **Lendo o pedido**, **Gerando guia** e **Anexando e-mail**. Ao abrir um e-mail, o sistema mostra a **última guia gerada** para a mesma carteira (de qualquer data) e, se for de outra clínica, o nome dela.

### Painel do dia

Mostra o trabalho do dia, sem separar por operador: totais por resultado, o que ainda precisa ser feito em cada guia (com botão para abrir), guias por clínica e a tabela do dia com filtros (status, resultado, clínica, parametrização e busca). **Exportar CSV** respeita os filtros aplicados. Há visualização por **dia** e por **mês**. Em cada guia concluída: **Corrigir guia** (carteira, serviços e quantidades), **Cancelar guia** e **Excluir guia**. Na coluna Observações, ao passar o mouse, aparecem as divergências da conferência, o motivo de guias sem gerar e as glosas retiradas. Continuam disponíveis, na visão por dia, a amostragem do apoio (sorteia até 10 guias concluídas para conferência por amostragem) e a conciliação de e-mails e de guias. O cartão **Tempo e qualidade** mostra o tempo médio por operador e por clínica, a porcentagem de e-mails lidos sem correção por clínica (abaixo de 70%, vale criar regra de leitura) e as clínicas que mais geram correção.

---

### Perfis, cores e senha
- Em Configurações > Perfil cada operador escolhe nome, animal, **cor (RGB)** e **transparência**; o botão do operador no topo e as etiquetas usam essa cor.
- Cada operador pode definir uma **senha**, pedida ao trocar para ele. Perfis com senha só são editados pelo próprio operador.
- Atenção: é uma trava de uso, não segurança forte. O código (hash) fica no `config.json` da pasta compartilhada, e quem tem acesso à pasta pode alterá-lo.
- Ao salvar, o `config.json` da pasta é regravado, preservando operadores criados ou protegidos por colegas desde que a tela foi aberta. Outras máquinas releem o arquivo ao voltar para a janela.

### Visualização e densidade
- No topo, o seletor **Visualização** tem três opções, lembradas por operador neste computador: **Completa** (menu e todos os detalhes), **Simples** (topo compacto e tela única para gerar a guia: bom para monitor pequeno) e **Flutuante** (abre o painel que fica por cima do sistema).
- No topo compacto há uma bolinha por operador com atendimento em andamento (inclusive colegas, atualizados a cada 20 s): anel na cor e com o animal do operador, 33% lendo o pedido, 66% gerando a guia, 100% anexando e respondendo.
- Em Configurações › Aparência, **Densidade compacta** reduz alturas e espaços (vale só para você, neste computador).
- A página funciona até 320 px de largura, sem rolagem horizontal.

### Extensão do Chrome (botão "Abrir no conferidor")
No topo do site há um ícone de download: ele baixa a extensão (`public/extensao/conferidor-guias-extensao.zip`) e mostra o passo a passo. Instalada, o webmail ganha um botão flutuante **Abrir no conferidor**; o clique abre o e-mail na aba do Conferidor, sem baixar o .eml. O ícone do topo vira um sinal de "instalada" (ou **Atualizar extensão**, quando a instalada é mais antiga que a do site). Na versão 1.2.0 o botão mostra se o e-mail já está em atendimento ou já foi atendido, "Abrindo…" e "Aberto: NOME", fica cinza quando o e-mail é fechado (pede confirmação) e, com **Responder no webmail** (etapa 4), cola a resposta pronta no corpo da resposta do webmail; o envio continua sendo feito pelo operador. Detalhes e limites em `extensao/LEIA-ME.md`. Depois de mudar a extensão, rode `python3 extensao/empacotar.py` para atualizar o .zip do site.

### Conferência pelos prints (etapa 3)
No lugar da conferência cega, a etapa 3 lê os prints da tela "Liberação de Senhas" do sistema oficial, por OCR no próprio navegador (arquivos em `public/ocr/`, sem IA externa e sem enviar imagens).
- **Sistema:** acima da área de colar, escolha **Sistema novo (PS Web, tela larga)** ou **Sistema antigo (janela Liberação de Senhas)**. A escolha fica lembrada no computador. Se o print colado for claramente do outro sistema, aparece o aviso para trocar a seleção.
- **Colar:** copie o print da aba *Dados da Guia* e o da aba *Procedimentos* e use Ctrl+V, ou o botão **Colar print** (também aceita escolher ou arrastar arquivos). Se houver mais itens do que cabem na grade, cole um print rolado até o fim.
- **Como os campos são achados:** o app lê o print inteiro e localiza os títulos fixos da tela ("Identificação", "Profissional", "Nº Guia", "Código Serviço"…). A posição de cada campo é calculada a partir deles, com escala horizontal e vertical separadas e ajuste fino pelos títulos mais próximos. Funciona com zoom (90% a 150%), print da tela inteira, recorte, linhas mais altas e JPEG. Se a parte de baixo mostrar outra aba (ex.: Terapia) em vez de CID, o CID aparece como "aba CID fechada". Print da tela vazia é recusado. Com poucos títulos legíveis, usa a barra amarela do topo como reserva.
- **O que confere:** nº da guia, nome do paciente, credenciado executante, carteira (identificação), CID, **médico solicitante, registro (CRM) e data da solicitação** e, item a item, código, quantidade e **status** (só "Liberada" é aceita sem aviso; Negada, Cancelada ou Aberta viram alerta) × pedido. Cada campo é lido com vários preparos da imagem até passar na validação do seu formato (ex.: carteira = 15 dígitos + 2 caracteres), e vale a maioria. Cada valor lido aparece com o recorte da imagem para você ver.
- **Número da guia:** vai sozinho para a etapa 4 (aceita T ou S + 7 ou 8 dígitos).
- **Ignorar:** ao lado de "Diverge" (e "Conferir") o botão **Ignorar** aceita a divergência: o item com quantidade menor vira "Autorizado a menor", os demais "Ignorado". A conferência passa com ressalva e a etapa 4 mostra um alerta para detalhar o motivo, sem bloquear. **Desfazer** reverte. Cada divergência ignorada gera uma **observação sugerida, com caixa de seleção** ("Incluir na observação ao prestador"): marcada, entra nas observações adicionais da resposta (sem nome, CID ou carteira, só o texto configurado). Vêm marcadas por padrão as de itens, número da guia, nome e credenciado; vêm **desmarcadas** as de CID e de carteira incorreta. Os textos e a marcação padrão mudam em Configurações > **Observações automáticas**.
- Sem prints: o botão "conferir a grade manualmente (conferência cega)" continua disponível.
- O recurso precisa do site publicado (não funciona abrindo o arquivo direto) e baixa cerca de 14 MB de arquivos de leitura na primeira vez.

### Captura da janela, modo simples e painel flutuante
- **Conectar à janela do sistema** (etapa 3, ao lado de Colar print): o Chrome pergunta qual janela compartilhar; escolha a do sistema (PS Web ou Liberação de Senhas). Depois, abra no sistema a aba que quer conferir e clique em **Capturar a janela do sistema**: a imagem é lida como um print colado, sem Print Screen. A conexão vale até recarregar a página ou clicar em "Parar de compartilhar" no Chrome. A janela do sistema não pode estar minimizada (pode estar atrás de outras).
- **Modo simples** (etapa 3): mostra só o essencial — os campos na ordem de lançamento, cada um copiável com um clique (fica verde quando copiado), a conferência pelos prints, os alertas e o botão de seguir. Bom para monitor pequeno. O botão volta ao modo completo.
- **Painel flutuante**: abre uma janelinha que fica **por cima do sistema**, no canto da tela, com os mesmos campos para copiar, o contador de copiados, os botões Capturar/Colar print, o resumo da conferência e o nº da guia. Acompanha o atendimento em tempo real. Funciona no Chrome e no Edge atuais (em navegador antigo abre como janela comum).

### Prevenção de erros e aprendizado
- **Antes de aceitar uma divergência do print** (botão Ignorar), o app lê aquela parte de novo com mais preparos e posições. Se a releitura bater com o pedido, era erro de leitura: corrige sozinho e nada é ignorado.
- Se continuar diferente, abre o **motivo**: obrigatório para nome do paciente e carteira, com opções prontas (erro de leitura conferido na tela, nome abreviado, carteira nova, autorizado a menor…) e detalhe. "Erro de leitura" não gera observação ao prestador.
- **Alerta "Mesmo código e carteira já autorizados na semana"** (segunda a domingo, em outro e-mail), com Conferi.
- **Linha do tempo da guia:** edições de campos, correção da leitura do e-mail, carteira usada, prints lidos/recusados, releituras, divergências aceitas (com motivo), alertas conferidos e o nº da guia. Vai para o histórico (botão Histórico) e o registro guarda o número de correções e aceites; em Ações › Auditar dá para listar só as guias com correções.
- **Aprendizado** (Configurações › Aprendizado): cada correção fica registrada na pasta (`aprendizado/correcoes.json`). Quando o mesmo valor volta num e-mail da mesma clínica, aparece o alerta "Correção já feita antes nesta clínica" com o botão **Aplicar a mesma correção**. Correções de código e de quantidade ausente podem **virar regra da clínica** com um clique. Erros de leitura de print confirmados viram aviso de "leitura conhecida" e podem ser baixados (.json) para ajuste do leitor.

### Histórico da guia e Auditar
- **Histórico** (Painel do dia, ao lado de Corrigir/Cancelar/Excluir guia): abre o histórico da guia — prints enviados, o que foi lido em cada campo, o que conferiu, o que foi **ignorado** (e se a observação foi incluída), o que foi **copiado** para o sistema, o número da guia (lido do print ou digitado), alertas, pedido lido do e-mail e resposta.
- O histórico é gravado ao concluir, cancelar, devolver ou descartar a guia, em `auditoria/AAAA-MM/<id>.json` na pasta compartilhada (sem a pasta, só no navegador deste computador). Os prints vão reduzidos (JPEG). Para não guardar prints, desmarque em Configurações › Preferências operacionais.
- **Acompanhamento › Auditar:** busca em todos os dias pelo nome do paciente, pela carteira ou pelo número da guia e abre o histórico. O nome completo do paciente passou a ficar no registro a partir desta versão; nos registros antigos só há as iniciais (a busca por carteira e guia funciona em todos).

### Listas do dia (Erasmo Neto)
A Erasmo Neto manda a agenda do dia num e-mail só, com muitos beneficiários ("Beneficiário:", "Carteira:", "Serviço:", "Quantidade:", "Médico:", "CID:", "Emissão:", "Local de emissão:", "Obs:"). Esse e-mail **não** abre como atendimento normal: vira uma **lista do dia**.
- **Como o app reconhece:** clínica marcada em Configurações › Clínicas com **"Manda a agenda do dia em lista"**, ou e-mail do domínio `clinicaserasmoneto.com.br` / assunto "Erasmo Neto". Qualquer e-mail com mais de 5 beneficiários também oferece abrir como lista. Vale para .eml, texto colado e o botão da extensão no webmail.
- **Dividir:** escolha os operadores (os que estão on-line vêm marcados). Cada beneficiário fica inteiro com um operador (todos os serviços dele), em blocos por ordem alfabética, com quantidades parecidas. A prévia mostra quantas guias e de qual nome a qual nome cada um recebe.
- **Aba Erasmo › Continuar Erasmo:** a fila de cada operador. A guia atual mostra beneficiário, carteira, serviço, quantidade (maior que 1 em destaque), CID, emissão, local, CRM e médico, cada um copiável com um clique, a observação da clínica e um aviso se a mesma carteira e serviço já tiveram guia na semana. Digite o nº da guia e **Enter** (ou **Registrar guia**); sem guia, use **Sem guia ▾** (Paciente excluso, Guia já liberada em…, Carteira não localizada, Sem cobertura, Carência, Aguardando documentação ou outro motivo). **Passar para…** envia uma guia a outro operador; **Passar todas as pendentes para…**, a fila inteira. No topo, o atalho **Continuar Erasmo (N)** aparece em qualquer aba enquanto houver guias suas pendentes.
- **Acompanhar:** em tempo real (a cada 10 s): totais, progresso de cada operador e a tabela de todas as guias com operador, situação, quem passou para quem, filtros e **Passar para**.
- **E-mail de entrega:** a tabela **Nº da Guia | Beneficiário | Carteira | Serviço**, formatada para o e-mail (pendentes em vermelho, sem guia em laranja com o motivo), com texto de abertura editável, **Copiar com formatação**, **Copiar texto simples**, **Responder no webmail** e **Marcar lista como entregue**.
- **Outro e-mail da Erasmo no mesmo dia:** o app pergunta se as guias entram na **lista do dia** (só as novas; repetidas ficam de fora) ou viram uma **lista separada** (Lista 2).
- **Registro:** cada guia registrada vai para o Painel, o Auditar e o Histórico com o nome do operador que gerou, a lista, quem distribuiu e quem passou para quem. Na pasta, `listas/AAAA-MM-DD/<lista>/` guarda o cabeçalho e um arquivo por operador (cada um grava só o seu: dois operadores ao mesmo tempo não apagam o trabalho um do outro).
- **No painel flutuante:** a aba **Erasmo** mostra a próxima guia da sua fila para gerar sem sair do sistema (copiar próximo com a barra de espaço, nº da guia + Enter, sem guia com o motivo ali mesmo, pular).

### Painel flutuante
- **Copiar próximo:** botão grande com o próximo campo na ordem do sistema (atalho: barra de espaço com o painel selecionado); a linha do próximo fica marcada e há barra de progresso.
- Bloqueios no topo, quantidade maior que 1 em destaque, divergências dos prints com o valor lido e o pedido, captura/colar print e o **nº da guia digitável no painel** (vai para a etapa 4).
- Abas **Guia atual** e **Erasmo** (quando há lista do dia).

### Reabrir guia e Guias do dia (versão 2.2.3)
- **Reabrir guia concluída:** no Painel (Guias do dia) e no **Histórico da guia** (também pelo Auditar), o botão **Reabrir** abre a guia de novo na etapa 4. Ela é montada com o e-mail guardado no histórico e os dados registrados: número, situação, itens não autorizados, glosa, observação e as correções feitas à mão. Dá para corrigir o número, a situação, a observação ou a resposta e concluir de novo.
  - O registro continua como estava até você clicar em **Concluir guia**. **Desistir da correção** (ou descartar o atendimento) deixa a guia exatamente como estava registrada.
  - Ao concluir de novo, o registro é atualizado no mesmo dia e com o mesmo operador que gerou a guia. Ele fica marcado como **Reaberta** (com o número e a situação anteriores), os prints da primeira vez continuam no histórico e o tempo médio conta só o tempo da correção.
  - **Reabrir para correção** dentro do atendimento passou a seguir a mesma regra: antes, descartar o e-mail com a guia reaberta marcava como descartada uma guia que já tinha sido gerada.
  - Precisa do e-mail no histórico (guias concluídas com a pasta da auditoria). Guias da lista do dia continuam com **Desfazer** na aba da lista, e **Corrigir guia** segue para trocar só a carteira e os serviços.
- **Busca e filtros de Guias do dia:**
  - Filtrar e buscar não relê mais a pasta nem redesenha a página: a tabela muda na hora, a página não volta para o topo e as letras digitadas não se perdem.
  - A busca procura também o nome do beneficiário e o operador, aceita as palavras em qualquer ordem e acha carteira ou número da guia digitados com espaços ou pontos.
  - Status ganhou **Cancelada**; Clínica ganhou **Clínica não identificada**; o filtro de clínica escolhido continua aparecendo no seletor ao trocar de dia.
  - Atualizar o Painel (ou cancelar e corrigir uma guia) mantém a posição da página.

### Acompanhamento mais confiável (versão 2.2.2)
- **Mesmo operador em dois computadores:** cada navegador grava a própria presença (`presenca/<operador>--<código do navegador>.json`) e o quadro soma as guias dos dois; antes, o último a gravar apagava as guias do outro.
- **Troca de operador:** a presença do operador anterior é apagada na hora, e as guias passam a aparecer com o novo operador (antes, o anterior continuava "ao vivo" por até 3 min).
- **Quadro e topo compacto se atualizam sozinhos:** o Acompanhamento relê a pasta a cada 30 s e o topo compacto a cada 20 s, sem clicar em Atualizar (a busca do Auditar fica como está).
- **Falha ao ler a pasta:** o cartão "Com o Conferidor aberto agora" avisa que não conseguiu ler e mostra o último retrato, marcado como incompleto, em vez de parecer que ninguém está on-line.
- **Tempo na etapa por guia:** ao passar para a próxima guia do e-mail, o "nesta etapa há N min" começa do zero (antes herdava o tempo da guia anterior).
- **Credenciado executante:** como o Médico solicitante, o **Ignorar** na conferência pelos prints aceita na hora, sem ler o print de novo e sem o modal de motivo (fica na linha do tempo da guia). Nome do beneficiário e carteira continuam pedindo o motivo.
- **Prints em fila:** dois prints colados ou capturados em seguida na mesma guia são lidos um depois do outro; o mais novo é sempre o que vale.
- **Captura com a aba em segundo plano:** se o Chrome não mandar a imagem atual, a captura avisa (clique na aba do Conferidor ou cole o print com Ctrl+V) em vez de conferir uma imagem antiga.
- **Segurança:** os arquivos de presença vindos da pasta são conferidos campo a campo (tipo, tamanho e faixa) antes de ir para a tela, e uma tela que demora para carregar não pinta mais por cima da tela aberta depois.

### Topo, quadro ao vivo e painel flutuante (versão 2.2.1)
- **Sistema: Novo | Antigo** fica no topo, entre o botão do tema (só o ícone da lua/sol) e a Visualização. Vale para colar, capturar e testar prints; o cartão dos prints só mostra qual está escolhido.
- **Guias em andamento hoje (Acompanhamento):** cada computador avisa a cada 30 s (e logo depois de cada mudança de etapa) o beneficiário, a clínica e a etapa que está atendendo. A guia de quem está trabalhando aparece sempre como **ao vivo**, com há quanto tempo está na etapa; antes, quem ficava mais de 10 min na mesma etapa sumia do quadro. Guia que ninguém tem aberta aparece como **parada há N min** e some depois do tempo das Preferências. O cartão de presença diz onde cada um está (ex.: "JANY G. × MRA · Guia e conferência há 4 min").
- **Painel flutuante:** a captura pega a imagem direto da janela do sistema, mesmo com a aba do Conferidor atrás de outras janelas (antes ela travava porque o Chrome pausa o vídeo de abas em segundo plano). O andamento e os erros da leitura aparecem no próprio painel, junto com a conferência campo a campo (✓, !, ✕). Ctrl+V no painel também lê o print. Se o Chrome não deixar conectar a janela pelo painel, conecte uma vez pela etapa 3 do conferidor; depois a captura funciona pelo painel.

### Ajustes de uso (versão 2.2)
- **Botões com texto:** antes, vários botões secundários (Corrigir guia, Excluir guia, Adicionar…, Remover…) mostravam só o ícone. Agora todos têm texto; só os de copiar seguem só com ícone (com dica).
- **Cliques que não “pegavam”:** ao editar um campo e clicar logo num botão, a tela era redesenhada no meio do clique e o clique se perdia; ao sair de um campo com Tab, o foco sumia. Agora o redesenho espera o clique terminar e o foco ir para o próximo campo, e devolve o foco, o cursor e a rolagem das listas.
- **Responder no webmail** aparece também na resposta sem gerar guia, na guia concluída e no e-mail de entrega da lista; sem a extensão instalada, o botão mostra como instalar.
- **Abertura à prova de falhas:** se uma parte não carregar (pasta lenta, dado com defeito), a página abre assim mesmo; se não abrir, mostra o erro com **Copiar detalhes**.

### Novidades da versão 2.1 (organização e prevenção de erros)
- **Barra fixa no rodapé** em cada etapa: Voltar, o primeiro bloqueio ou pendência (com **ver**, que leva aos alertas) e Seguir/Concluir.
- **Etapas** com nome fixo e o estado num selo (Agora, Concluída, Pendente, N bloqueios). O **Conferi** dos avisos virou botão.
- **Etapa 2:** o texto do e-mail fica fixo ao rolar e realça beneficiário, carteira, médico, CID e data nas cores dos campos (passar o mouse no campo acende o trecho). Cada campo tem um ícone de origem: e-mail, regra da clínica, aprendizado, digitado, parametrização ou cadastro. "Responder sem gerar guia" mostra as 3 respostas mais usadas e as outras num menu.
- **Etapa 3:** a conferência pelos prints destaca a diferença letra a letra entre pedido e lido; o modal de motivo só libera **Aceitar divergência** depois de escolher (teclas 1 a 4).
- **Etapa 4:** a situação da autorização vem **sugerida pelos prints** (confira e troque se preciso); sem situação, a resposta aparece em prévia com o modelo provável. **Copiar observação da guia** fica ao lado do nº da guia.
- **Notas fixas:** da clínica (no cadastro) e do beneficiário (por carteira, botão **Nota do beneficiário** na etapa 2) aparecem em todo atendimento.
- **Relatar problema** (cartão dos prints e Histórico): baixa um arquivo com a leitura dos prints, as imagens, as correções e o histórico da guia, e guarda uma cópia em `relatos/` na pasta. Contém dados do beneficiário: envie só por canal interno.
- **Atendimento parado:** aviso quando o atendimento fica mais de X minutos na mesma etapa (Preferências; 0 desliga).
- **PIN do supervisor** (Configurações › Perfil): protege alertas, modelos, observações automáticas, regras de leitura das clínicas, importação de configurações, **Virar regra** e a limpeza da auditoria. Liberado por 15 minutos.
- **Histórico detalhado (Preferências):** mostra quanto a pasta `auditoria` ocupa e apaga as imagens dos prints mais antigas que 3, 6, 12 ou 24 meses, mantendo o texto. Os registros do Painel não são afetados.
- **Segurança dos registros:** atendimento salvo com a pasta fora do ar fica guardado no computador, aparece num aviso fixo com contador e vai sozinho para a pasta quando ela volta (sem apagar o que já está lá). Duas abas do Conferidor no mesmo computador: a mais recente avisa e a outra fica pausada. Fechar a aba com atendimento aberto pede confirmação.

### Importar lista de clínicas
Em Configurações › Clínicas, **Importar lista** recebe a tabela copiada da planilha (número, nome, cidade e e-mails, uma clínica por linha; o cabeçalho é ignorado). **Pré-visualizar** mostra o que será feito: clínica nova, clínica a atualizar ou sem mudança. Uma clínica já cadastrada (reconhecida pelo e-mail ou pelo nome, ex.: "CLÍNICA CRIAR" = "Criar Clínica de Integração") só ganha os e-mails que faltam e a cidade, se estiver vazia; nada é apagado. E-mail que já pertence a outra clínica é ignorado e aparece em vermelho. Depois de importar, confira e clique em **Salvar configurações**.

### Regras de leitura por clínica
Em Configurações › Clínicas, cada clínica tem **Regras de leitura do e-mail**, para erros que ela repete: **quantidade quando o e-mail não informar** (ex.: a MRA não escreve a quantidade: use 1), **código com um dígito a mais ou a menos** (corrige para o código cadastrado da clínica que só difere nesse dígito, ex.: 5000470 → 50000470), **quantidade colada no CRM** ("PSICOLOGIA 19700-" = 1 + CRM 9700; com 6 dígitos, "119741", isso já é automático) e uma lista de **códigos que a clínica escreve errado** (escrito = certo). Valem só para os e-mails daquela clínica (reconhecida pelo e-mail do remetente) e cada ajuste aparece como alerta "Ajuste feito pela regra de leitura da clínica" para conferir. Em Testar leitura, **Ler de novo** aplica as regras ainda não salvas.

### Testar leitura (Configurações)
Em Configurações › **Testar leitura** dá para conferir os leitores sem abrir atendimento. **Prints:** cole (Ctrl+V), arraste ou escolha os arquivos; cada campo aparece com o recorte da imagem, o valor lido e uma coluna **Correto** para corrigir o que saiu errado (na aba Procedimentos também há onde listar itens que não foram lidos). **E-mails:** arraste o .eml ou cole o texto; cada pedido mostra beneficiário, carteira, médico, CRM, CID, data, local e serviços para corrigir. Depois, **Baixar registro (.json)** gera um arquivo com o que foi lido, o que deveria ser e os detalhes da leitura (layout, posição da tela, leituras alternativas e, se marcado, os recortes dos campos errados, o print inteiro e o texto do e-mail). Junte vários e envie ao suporte para ajustar os leitores. **Copiar resumo** gera um texto curto. A opção de trocar nomes e carteiras por fictícios vale para os e-mails. Nada fica salvo: ao recarregar a página os testes somem.

### Leitura do e-mail
Além do formato com rótulos (Beneficiário:, Carteira:, Serviço: ...), o app lê pedidos em **texto livre** (uma linha "NOME  CARTEIRA  CÓDIGO  DESCRIÇÃO" e linhas soltas com CRM, médico, CID, data e local em qualquer ordem), inclusive vários pacientes sem rótulos. Também lê **tabelas em HTML** (uma linha por paciente, tabela vertical "campo | valor" ou tabela de serviços valendo para todos os pacientes) e reconhece "Dr./Dra." antes do médico, datas por extenso e sem ano (o ano é deduzido pela data do e-mail, com alerta), código com dígito a mais ou a menos (sugere o código cadastrado mais parecido), CID fora do padrão e e-mails que não parecem pedido.

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
- Os registros na pasta guardam: id do e-mail, assunto, remetente, clínica, operador, horários, **nome do paciente** (para a busca em Ações › Auditar), **carteira**, **códigos e quantidades**, número da guia, alertas confirmados e resultado da conferência.
- O **histórico de cada guia** (pasta `auditoria`) guarda também o texto do e-mail, médico, CID e, se a opção estiver ligada, os **prints** e recortes da conferência. Ele é usado para auditar; desligue a opção "Guardar os prints" em Preferências se não quiser imagens na pasta.
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
