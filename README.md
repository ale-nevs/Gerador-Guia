# Conferidor de Guias

Núcleo Gestão de Terapias · Promédica. Criado por Alexandre Neves.

Página auxiliar para conferência de guias de autorização de terapias.

- Roda inteiramente no navegador (Chrome ou Edge). Nenhum dado é enviado para a internet.
- Este repositório contém **apenas o código da página**. Configurações (`config.json`), registros e e-mails ficam na pasta compartilhada da equipe, **nunca aqui**.
- Site estático: tudo em `public/` (`index.html` e `logo-promedica.png`). Não há build.

## Publicação na Vercel

1. Em vercel.com, **Add New → Project** e importe este repositório.
2. Framework Preset: **Other**. Deixe Build Command vazio. O `vercel.json` já define `public` como diretório de saída.
3. **Deploy**. Cada push na branch de produção publica uma nova versão automaticamente.

Os operadores abrem o endereço da Vercel no Chrome e adicionam aos favoritos. Para atualizar, **Ctrl+F5**. A versão aparece no topo da página.

Consulte `GUIA-DE-IMPLANTACAO.md` para a pasta compartilhada, configuração inicial e rotina de uso.
