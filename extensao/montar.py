#!/usr/bin/env python3
"""Gera extensao/painel/ a partir de public/index.html (a mesma interface do site).
O CSP das extensões não aceita script embutido, então os scripts viram arquivos."""
import re, shutil, pathlib
raiz = pathlib.Path(__file__).resolve().parent
pub = raiz.parent / 'public'
dest = raiz / 'painel'
if dest.exists(): shutil.rmtree(dest)
dest.mkdir()
for f in ['favicon.ico', 'icon-192.png', 'icon-180.png', 'logo-promedica.png']:
    shutil.copy(pub / f, dest / f)
shutil.copytree(pub / 'fonts', dest / 'fonts')
html = (pub / 'index.html').read_text(encoding='utf-8')
partes = list(re.finditer(r'<script>\n(.*?)</script>', html, re.S))
assert len(partes) == 2, len(partes)
nomes = ['tema.js', 'app.js']
for m, n in zip(partes, nomes):
    (dest / n).write_text(m.group(1), encoding='utf-8')
for m, n in reversed(list(zip(partes, nomes))):
    extra = '\n<script src="painel-ponte.js"></script>' if n == 'app.js' else ''
    html = html[:m.start()] + f'<script src="{n}"></script>' + extra + html[m.end():]
shutil.copy(raiz / 'painel-ponte.js', dest / 'painel-ponte.js')
(dest / 'painel.html').write_text(html, encoding='utf-8')
print('painel gerado em', dest)
