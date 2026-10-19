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
4. Nada é respondido, enviado ou aberto sem esse clique.

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
