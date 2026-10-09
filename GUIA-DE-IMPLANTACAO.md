# Conferidor de Guias: guia de implantação

Versão 1.0.0 · outubro de 2026

O Conferidor é uma página que roda no Chrome. Ela lê o .eml do pedido, aponta problemas e conduz a conferência da guia, item por item. Também gera a observação e a resposta, e registra tudo numa pasta compartilhada.

A página **não acessa o sistema da operadora** e **não gera guias**. A guia continua sendo feita pelo operador no sistema oficial.

---

## 1. O que vai em cada lugar

| Lugar | O que fica lá | Contém dados de pacientes? |
| --- | --- | --- |
| GitHub e Vercel | `public/index.html`, `public/logo-promedica.png` e `vercel.json`, só o código da página | Não |
| Pasta compartilhada do Windows | `config.json` (clínicas, modelos) e a pasta `registros/` | Sim, o mínimo: carteira, códigos, guia, operador. Sem nome, CID ou médico |
| Computador do operador | Nada instalado. O Chrome lembra qual é a pasta | Só o pedido em andamento, apagado ao concluir |

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

## 4. Primeira configuração (gestor, cerca de 30 minutos)

Abra **Configurações** com a pasta conectada.

- **Operadores:** confira os nomes, um por linha.
- **Clínicas:** o `config.json` já vem com 17 clínicas, as que aparecem nas pastas do SmarterMail. Só a Transcender tem e-mail cadastrado. Para cada uma das 25:
    - **Executante no sistema:** o nome exatamente como aparece no campo "Credenciado executante". É isso que o operador vai conferir no cabeçalho.
    - **E-mails:** todos os endereços conhecidos, separados por vírgula.
    - **Apelidos:** palavras que a clínica usa no assunto, se diferentes do nome (ex.: "Criar", "MRA").
- **Modelos de texto:** revise as respostas padrão e ajuste a linguagem da equipe.
- Clique em **Salvar configurações**. O arquivo é gravado na pasta e vale para todos.

Não precisa cadastrar todos os e-mails agora. No dia a dia, quando aparecer **Remetente não cadastrado**, o operador escolhe a clínica e clica em **Vincular e salvar e-mail no cadastro**.

Depois de 1 a 2 semanas de uso, clique em **Aprender códigos dos pedidos concluídos**. A página monta a lista de códigos de cada clínica e passa a alertar quando aparecer um código novo para aquela clínica.

---

## 5. Testar antes de usar de verdade

A pasta `testes/` tem 10 e-mails, 9 fictícios e 1 real. Abra cada um na página e confira se aparece o esperado:

| Arquivo | O que a página deve mostrar |
| --- | --- |
| 00-real-transcender | 1 item, carteira válida, sem bloqueio |
| 01-servico-unico | 1 item, quantidade vinda da linha "Quantidade" |
| 02-varios-servicos-asteriscos | 6 itens com "(QUANTIDADE n)" na linha de baixo; carteira com espaços normalizada |
| 03-travessao-quantidade | 6 itens com "— quantidade n"; alerta de emissão antiga (8 meses) |
| 04-sem-data-fisio | "SEM DATA" como informação, não como erro |
| 05-codigo-7-digitos | **Bloqueio**: código com 7 dígitos |
| 06-sem-quantidade-codigo-repetido | **Bloqueios**: código repetido e quantidade ausente; resposta de pendência pronta |
| 07-carteira-fora-do-padrao | Pede a carteira usada (localizar pelo nome) |
| 08-resposta-RE | Alerta de resposta (RE:); o histórico citado é ignorado |
| 09-latin1-com-anexo | Alerta de anexo e de número de 8 dígitos solto (telefone) |

Depois, junte **30 a 50 e-mails reais** de várias clínicas e passe pela página sem gerar guia, usando **Descartar** ao final de cada um. Anote qualquer leitura errada e me envie esses casos. O leitor é ajustado a partir deles.

**Teste da pasta compartilhada, com dois computadores:** abra o mesmo .eml nos dois. O segundo deve mostrar o alerta "Fulano abriu este e-mail…".

---

## 6. Rotina do operador

1. **Assumir o e-mail** como hoje: arraste para "PENDÊNCIAS – seu nome" e aplique a tag.
2. **Baixar o .eml** do e-mail aberto e **arrastar para a página**, ou clicar na área e escolher o arquivo.
3. **Etapa 2: pedido e alertas.**
    - À esquerda, o e-mail com os códigos marcados: verde virou item, laranja são 8 dígitos não usados.
    - **Bloqueio** (vermelho): clique em **Responder sem gerar guia**. A resposta de pendência vem pronta. Copie, responda à clínica, marque "Enviei" e salve como **Aguardando clínica**.
    - **Carteira** fora do padrão: localize o beneficiário pelo nome no sistema e digite a carteira usada. Se não achar, ou se nome e carteira não forem da mesma pessoa, use os botões de resposta do próprio alerta.
    - **Alerta** (amarelo): confira e marque **Conferi**. Alguns pedem um motivo curto.
    - Se a página leu algo errado, corrija nos campos ou em **Corrigir leitura dos itens**. Isso gera um alerta de "editado à mão", para conferir de novo.
4. **Etapa 3: guia e conferência.**
    - Abra ou copie a guia no sistema. Na página, marque cada campo do cabeçalho: **Igual na tela** ou **Corrigi**.
    - Lance os itens usando os botões de **copiar** de cada código, colando no sistema.
    - Clique em **Lancei todos os itens → conferência cega**. A lista some.
    - Olhando **só a grade do sistema**, informe o número de linhas e, para cada linha, os 4 últimos dígitos do código e a quantidade. Enter passa para o próximo campo.
    - Se não bater, a página diz o que está errado (omitido, quantidade, a mais). Corrija no sistema e confira de novo.
5. **Etapa 4: finalizar.**
    - Gere e envie a guia no sistema. Digite o número (só os 8 dígitos já bastam).
    - **Copiar observação** e colar no campo de observação da guia.
    - **Copiar resposta** e colar em "Responder" no e-mail original. A resposta lista os itens, e a clínica vira uma segunda conferência.
    - Mova o e-mail para a pasta da clínica, marque os 3 itens do checklist e clique em **Concluir pedido**.

**Interrupções:** se fechar o Chrome no meio, ao abrir de novo o pedido continua onde parou. Se for sair, use **Devolver à caixa**, e o próximo operador começa do zero. Para e-mails que não são pedido (evoluções, avisos), use **Descartar**.

---

## 7. Rotina do apoio (fim do dia, cerca de 15 minutos)

Na aba **Painel do dia**:

1. **Amostragem:** clique em **Sortear amostra**. São até 10 guias, priorizando as com 4 ou mais itens. Confira cada uma no sistema. Se houver erro, use **Registrar correção** na linha da guia, informando o motivo e quem detectou.
2. **Conciliação de e-mails:** no SmarterMail, selecione os e-mails do dia (caixa de entrada, pendências e pastas das clínicas), baixe o ZIP e solte em **E-mails recebidos × registros**. A página lista o que chegou e não passou por ela, o que foi aberto e não concluído, e o que recebeu duas guias.
3. **Conciliação de guias:** tire o relatório de guias geradas no dia no sistema, copie o conteúdo e cole em **Relatório de guias**. A página aponta guias geradas sem conferência e números digitados errado.
4. **Exportar CSV do dia**, se quiser guardar ou montar indicadores. O separador é ponto e vírgula e abre direto no Excel.

**Erros detectados por outros setores** (faturamento, atendimento, clínica por telefone) também devem ser lançados com **Registrar correção**, no dia em que forem descobertos. É o que permite medir se a taxa de erro caiu.

---

## 8. Regras aplicadas pela página

| Situação | Tipo | O que acontece |
| --- | --- | --- |
| Falta beneficiário, serviço, quantidade ou médico | Bloqueio | Não segue; resposta de pendência pronta |
| Código com mais ou menos de 8 dígitos | Bloqueio | Idem |
| Mesmo código duas vezes no pedido | Bloqueio | Idem |
| Quantidade 0 ou maior que 9 | Bloqueio | Idem |
| Mais de um beneficiário no e-mail | Bloqueio | Idem |
| Carteira fora do padrão (15 dígitos + 2) | Carteira | Localizar pelo nome e informar a carteira usada |
| Remetente fora do cadastro | Alerta + motivo | Vincular à clínica ou justificar |
| Assunto que não cita a clínica do remetente | Alerta | Conferir |
| Assunto "RE:", "ENC:", "Fwd:" | Alerta | Verificar se é correção ou cobrança |
| Mesmo e-mail já aberto ou concluído por alguém | Alerta + motivo | Evita trabalho dobrado |
| Mesma carteira e código concluídos nos últimos 7 dias | Alerta + motivo | Possível cobrança; resposta "já autorizado" pronta |
| Número de 8 dígitos no texto que não virou item | Alerta | Evita serviço esquecido |
| Emissão no futuro ou com mais de 6 meses | Alerta | Conferir |
| Anexo no e-mail | Alerta | Pedidos em anexo não são aceitos |
| SEM DATA, CID ausente, CRM ausente | Informação | Não impede |

Os prazos (7 dias, 6 meses) mudam em **Configurações → Parâmetros**.

---

## 9. SmarterMail: filtros de conteúdo e eventos

Não é preciso nada do SmarterMail para a página funcionar. Os filtros podem ajudar na triagem. Confira no painel do SmarterMail quais condições e ações ele oferece; as sugestões abaixo dependem disso.

- **Assunto começando com "RE:", "Res:" ou "ENC:":** aplicar uma marca ou mover para uma pasta "Respostas de clínicas". Respostas deixam de se misturar com pedidos novos.
- **Mensagens com anexo:** aplicar uma marca "Com anexo", para responder logo com o modelo "Pedido em anexo".
- **Remetente do domínio de cada clínica:** mover ou marcar automaticamente com o nome da clínica. Isso reforça a identificação pelo remetente, e não pelo assunto.
- **Resposta automática de recebimento (opcional):** confirma o recebimento e manda o modelo de pedido. Pode reduzir cobranças, mas gera um e-mail a mais por pedido. Avalie com a equipe.
- **Eventos:** em geral servem para notificações administrativas, como avisos de cota ou de mensagens recebidas. Não substituem o painel do dia. Vale usar só se houver um evento de "caixa com mais de N mensagens", para avisar o apoio quando a fila crescer.

---

## 10. Privacidade

- O e-mail é lido **dentro do Chrome**. Nada é enviado para a internet, para o GitHub nem para a Vercel.
- Os registros na pasta guardam: id do e-mail, assunto, remetente, clínica, operador, horários, **carteira**, **códigos e quantidades**, número da guia, alertas confirmados e resultado da conferência. **Não** guardam nome do paciente, CID nem médico.
- O pedido em andamento fica no navegador do operador até ser concluído, devolvido ou descartado.
- Em **Configurações** há o botão para apagar registros com mais de 180 dias.

---

## 11. Problemas comuns

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
