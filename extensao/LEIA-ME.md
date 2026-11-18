# Extensão do Chrome/Edge: "Abrir no conferidor" (v1.3.0)

Cria um botão flutuante no webmail (`https://mail.promedica.com.br`) integrado em tempo real com a aba do
**Conferidor de Guias** — sem precisar baixar arquivos `.eml` nem copiar e colar respostas manualmente.

## Como funciona na versão 1.3.0
1. **Captura local (GET e POST + Reply-To):** a extensão observa no navegador a resposta que o SmarterMail recebe ao abrir um e-mail (`/api/v1/mail/message`) e guarda apenas os metadados úteis (remetente, `Reply-To`, assunto, data, corpo e nomes de anexos) num **cache local LRU (até 40 mensagens)** na memória da aba.
2. **Troca instantânea entre e-mails em cache:** um `MutationObserver` leve (com debounce) acompanha o painel de leitura. Ao clicar de volta num e-mail já carregado antes pelo SmarterMail, o botão reconhece automaticamente a mensagem visível sem reenviar o e-mail errado.
3. **Status ao vivo e avisos preventivos:** antes mesmo do clique, o botão consulta o Conferidor e mostra:
   - se o pedido **já foi atendido** (com operador e nº da guia);
   - se **está em atendimento** agora por você ou por um colega;
   - se está salvo em **Pausados** (rascunho pronto para retomar);
   - aviso caso a **pasta compartilhada esteja desconectada** no Conferidor.
   Ao concluir uma guia no Conferidor, o selo no webmail é atualizado automaticamente.
4. **Minimizar sem perder o botão:** o botão `–` recolhe o card numa pílula discreta (`Conferidor`) no canto inferior direito, podendo ser reexpandido a qualquer momento.
5. **Auto-Responder & Colar em 1 clique:** na Etapa 4 do Conferidor (ou no Painel Flutuante), clicar em **Responder no webmail** foca a aba do webmail, aciona automaticamente **Responder** e insere o HTML formatado no início do editor (acima do histórico citado). Se o editor não abrir sozinho, o botão vira **Inserir resposta** para colar com 1 clique.
6. **Revisão humana sempre:** nada é enviado sozinho — o operador sempre confere destinatário/texto e clica em **Enviar** no webmail.

## Instalar ou atualizar
1. No Conferidor, clique no botão da extensão no topo e baixe o `.zip` atualizado. Descompacte em uma pasta fixa.
2. Abra `chrome://extensions` (ou `edge://extensions`) > ative **Modo do desenvolvedor** > **Carregar sem compactação** > selecione a pasta descompactada.
3. Abra o Conferidor numa aba, recarregue o webmail (`F5`) e abra um e-mail.

## Desenvolvimento e empacotamento
- Permissões restritas ao webmail da Promédica (`https://mail.promedica.com.br/*`) e páginas `*.vercel.app` / `localhost` / `127.0.0.1` identificadas com `<meta name="conferidor-guias">`.
- Sempre que alterar arquivos em `extensao/`, gere novamente o pacote publicado pelo site executando:
  ```bash
  python3 extensao/empacotar.py
  ```
