# Extensão do Chrome/Edge: "Abrir no conferidor"

Cria um botão flutuante no webmail (`https://mail.promedica.com.br`) que abre o e-mail aberto direto na aba do
Conferidor de Guias. Sem baixar o .eml, sem copiar e colar.

## Como funciona
1. No webmail, a extensão observa a resposta que o próprio SmarterMail recebe ao abrir um e-mail
   (`POST /api/v1/mail/message`) e guarda os campos úteis (remetente, assunto, data, texto, nomes dos anexos)
   só na memória da aba.
2. Aparece o botão flutuante **Abrir no conferidor** (canto inferior direito, com o assunto do e-mail).
3. Ao clicar, a extensão entrega o e-mail à aba do Conferidor (abre uma, se já souber o endereço) e a traz para a
   frente. O Conferidor abre o pedido. Se houver atendimento aberto, ele pergunta antes de substituir.
4. Ao abrir um e-mail, o botão já mostra se ele **está em atendimento** (e por quem) ou **já foi atendido** (com o nº da guia),
   consultando o Conferidor. Depois do clique, mostra "Abrindo…" e "Aberto: NOME" com o beneficiário lido.
5. Se o e-mail for fechado (o texto dele sai da tela), o botão fica cinza ("E-mail fechado") e só manda o último e-mail com
   um segundo clique de confirmação.
6. **Responder no webmail** (versão 1.3.0, igual à extensão da Ouvidoria): na etapa 4 do Conferidor (ou no painel flutuante),
   o botão "Responder no webmail" leva a resposta pronta para o webmail, que abre o **Responder a todos** e cola a resposta no
   topo do texto, acima da assinatura e da mensagem original. Revise e envie você mesmo.
   - Só abre sozinho se o e-mail aberto no webmail for o do atendimento (mesmo Message-ID, ou mesmo assunto sem RE:/ENC: e
     mesmo remetente). Se for outro, o botão flutuante avisa; ao abrir o e-mail certo, ele responde sozinho (até 3 min depois).
     Para responder ao e-mail aberto mesmo assim, clique duas vezes no botão.
   - Como abre: o atalho **A** do SmarterMail, disparado no mundo da página (`captura-main.js`). Se em 3,5 s nada abrir,
     clica no botão "Responder a todos". Se em ~9 s ainda nada abrir, o botão avisa: abra o Responder a todos (a resposta é
     colada quando o texto abrir, por até 2 min) ou clique no corpo do texto e no botão para colar ali.
   - `resposta.js` roda em todas as janelas e quadros do webmail (inclusive a janela de resposta aberta à parte, mesmo como
     `about:blank`). Ele fotografa os editores que já existem e só cola no editor que surgir depois (rascunhos não são
     tocados), confere se o texto apareceu (até 3 tentativas) e cola de novo se o webmail redesenhar o corpo. Se duas
     janelas acharem um editor ao mesmo tempo, só uma cola (reserva).
   - A resposta fica só na memória da sessão do navegador (`chrome.storage.session`) e é apagada logo depois de colada,
     ao clicar no × do botão (descartar) ou depois de 15 min.
7. Nada é enviado pela extensão: o envio do e-mail é sempre do operador, no webmail.

## Instalar
1. No Conferidor, clique no ícone de download do topo e baixe o .zip. Descompacte.
2. `chrome://extensions` (ou `edge://extensions`) > **Modo do desenvolvedor** > **Carregar sem compactação** > pasta descompactada.
3. Abra o Conferidor numa aba, recarregue o webmail (F5) e abra um e-mail.

## Atualizar
Substitua os arquivos da pasta pelos do .zip novo, clique em **recarregar** no cartão da extensão em `chrome://extensions`
e aperte F5 no webmail e no Conferidor. A versão 1.3.0 precisa do Chrome ou Edge 116 ou mais novo.

## Observações
- Permissões: apenas o webmail da Promédica e páginas `*.vercel.app` que tenham a marca `conferidor-guias` (e `storage`).
  Se o Conferidor usar domínio próprio (não `vercel.app`), inclua-o em `content_scripts[2].matches` do `manifest.json`.
- Depende do formato da API interna do SmarterMail (`captura-main.js`). Se uma atualização dele mudar isso, só esse
  arquivo precisa de ajuste.
- Para gerar o .zip do site depois de mudar a extensão: `python3 extensao/empacotar.py`.
