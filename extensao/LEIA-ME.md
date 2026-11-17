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
6. **Responder no webmail**: na etapa 4 do Conferidor, o botão "Responder no webmail" leva a resposta pronta para o webmail.
   Lá, clique em **Responder**, clique no corpo do texto e no botão flutuante **Colar resposta**. Revise e envie você mesmo.
7. Nada é respondido, enviado ou aberto sem o clique do operador: o envio do e-mail é sempre no webmail.

## Instalar
1. No Conferidor, clique no ícone de download do topo e baixe o .zip. Descompacte.
2. `chrome://extensions` (ou `edge://extensions`) > **Modo do desenvolvedor** > **Carregar sem compactação** > pasta descompactada.
3. Abra o Conferidor numa aba, recarregue o webmail (F5) e abra um e-mail.

## Observações
- Permissões: apenas o webmail da Promédica e páginas `*.vercel.app` que tenham a marca `conferidor-guias`.
  Se o Conferidor usar domínio próprio (não `vercel.app`), inclua-o em `content_scripts[2].matches` do `manifest.json`.
- Depende do formato da API interna do SmarterMail (`captura-main.js`). Se uma atualização dele mudar isso, só esse
  arquivo precisa de ajuste.
- Para gerar o .zip do site depois de mudar a extensão: `python3 extensao/empacotar.py`.
