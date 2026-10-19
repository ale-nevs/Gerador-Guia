# Extensão do Chrome/Edge: Conferidor de Guias no webmail

Painel lateral com a mesma interface do site, ligado ao webmail `https://mail.promedica.com.br`.

## Como funciona
1. Ao abrir um e-mail no SmarterMail, a extensão observa a resposta que o próprio webmail recebe
   (`POST /api/v1/mail/message`) e guarda os campos úteis (remetente, assunto, data, texto, nomes dos anexos)
   **somente na sessão do navegador** (`chrome.storage.session`, nunca em disco).
2. O painel lateral mostra uma barra "Webmail: assunto · remetente · Abrir no conferidor". O atendimento só começa
   quando o operador clica. Nada é aberto, respondido ou enviado automaticamente.
3. O restante é idêntico ao site: parser, alertas, conferência, Painel, Ações, configurações e pasta compartilhada.

## Instalar (modo desenvolvedor)
1. Abra `chrome://extensions` (ou `edge://extensions`) e ative o **Modo do desenvolvedor**.
2. **Carregar sem compactação** e escolha esta pasta (`extensao`).
3. Recarregue a página do webmail (F5) e clique no ícone da extensão para abrir o painel lateral.

## Atualizar o painel
O painel é gerado a partir de `public/index.html`:

    python3 extensao/montar.py

Depois, em `chrome://extensions`, clique em recarregar na extensão.

## Limites conhecidos
- Depende do formato da API interna do SmarterMail (campos `messageData.*`). Se uma atualização do SmarterMail mudar
  isso, só `captura-main.js` precisa de ajuste.
- A extensão pede acesso apenas a `https://mail.promedica.com.br/*`.
- Inserir a resposta direto no editor de resposta do SmarterMail ainda não foi feito.
