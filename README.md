# Conferidor de Guias · Promédica (v2.2.0)

Aplicação web estática (100% client-side, zero banco externo e zero envio de dados para a nuvem) para leitura de pedidos médicos (`.eml` ou integração direta com o webmail), validação assistida de regras clínicas, lançamento guiado no sistema oficial, conferência automática por OCR local (Tesseract.js WebAssembly) e padronização de respostas e auditoria em pasta compartilhada SMB.

## Destaques da versão 2.2.0

- **Novo Sistema de Design Clínico (Claro e Escuro):** tipografia `Inter` com números tabulares (`tabular-nums`), paleta institucional Marinho Promédica + Verde-Água Clínico, superfícies em camadas sem bordas laterais pesadas e contraste acessível WCAG AA.
- **Fila Multi-Atendimento ("Pausados"):** estacione atendimentos com pendência em `IndexedDB` (até 15 rascunhos) e retome de onde parou a qualquer momento pelo topo, Painel do Dia ou aba Acompanhamento.
- **Modo Turbo (`Espaço`) & Painel Flutuante Completo (PiP):** copie sequencialmente todos os campos e códigos pendentes na Etapa 3 com a barra de espaço e finalize a guia (nº da guia, situação, observação e resposta ao webmail) direto da janelinha flutuante sobre o sistema oficial.
- **OCR Local Paralelo (Pool de 2 Workers):** leitura simultânea de recortes das abas *Dados da Guia* e *Procedimentos* (Tesseract.js rodando 100% offline/local no navegador).
- **Segurança & Concorrência na Pasta Compartilhada (SMB):** transações JSON com releitura + mesclagem (`Pasta.transacaoJson`), tentativas automáticas com *exponential backoff*, *tombstones* em parametrizações, índice mensal consolidado (`_indice.json`) e anonimização LGPD de registros com mais de 180 dias.
- **Extensão Chrome/Edge v1.3.0:** cache LRU de mensagens no webmail, `MutationObserver` leve, botão minimizável em pílula, sincronização de conclusão em tempo real e **Auto-Responder & Colar** em 1 clique.

## Estrutura do Projeto

- `public/` — Aplicação estática publicada na Vercel (`index.html`, `css/app.css`, `js/01-base.js` … `js/10-painel-e-inicio.js`, `ocr/`, `fonts/`).
- `extensao/` — Código-fonte da extensão Manifest V3 (`manifest.json`, `captura-main.js`, `ponte.js`, `conferidor.js`, `fundo.js`, `empacotar.py`).
- `pasta-compartilhada/` — Modelo inicial do `config.json` para a pasta de rede.
- `tests/` — Suíte automatizada de testes unitários e de integração (`node:test`).
- [GUIA-DE-IMPLANTACAO.md](GUIA-DE-IMPLANTACAO.md) — Manual completo de implantação, operação e privacidade.

## Comandos Úteis

```bash
# Executar a suíte de testes automatizados (Node.js >= 20)
node --test tests/conferidor.test.mjs

# Empacotar a extensão do navegador em public/extensao/conferidor-guias-extensao.zip
python3 extensao/empacotar.py
```
